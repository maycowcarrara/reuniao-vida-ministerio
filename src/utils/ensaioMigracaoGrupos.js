import { normalizeGruposProgramacao, getGrupoEfetivoId, getGrupoLegadoId, getGruposParticipantes, isProgramacaoV2 } from './gruposProgramacao.js';
import { getProgramacaoWeekStartISO } from './programacoes.js';

const canonical = value => JSON.stringify(value, function (_key, entry) {
    return entry && typeof entry === 'object' && !Array.isArray(entry)
        ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry;
});
export const hashEnsaio = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)))), byte => byte.toString(16).padStart(2, '0')).join('');

// Inventário de exportação/fixtures já em memória. Não importa Firebase, lê
// arquivos, autentica, publica ou aplica qualquer operação remota.
export async function prepararEnsaioMigracao(snapshot, { materializarParticipacao = false } = {}) {
    const erros = [], avisos = [], passos = [];
    let config;
    try { config = normalizeGruposProgramacao(snapshot.configuracoes); }
    catch { erros.push('origem_legada_ambigua'); }
    const add = async (colecao, id, before, after) => {
        if (canonical(before) === canonical(after)) return;
        passos.push({ id: `${colecao}:${id}`, colecao, registroId: String(id), beforeHash: await hashEnsaio(before), afterHash: await hashEnsaio(after), after: structuredClone(after) });
    };
    if (config) {
        await add('configuracoes', 'geral', snapshot.configuracoes, config);
        const ids = new Set(), semanas = new Set();
        for (const p of snapshot.historico_reunioes || []) {
            if (!p.id || ids.has(String(p.id))) { erros.push('programacao_id_ausente_duplicado'); continue; }
            ids.add(String(p.id));
            const grupoId = getGrupoEfetivoId(p, config);
            if (!config.grupos[grupoId]) { erros.push('grupo_desconhecido'); continue; }
            try {
                const key = JSON.stringify([grupoId, getProgramacaoWeekStartISO(p)]);
                if (semanas.has(key)) erros.push('programacoes_ambiguas_na_mesma_semana');
                semanas.add(key);
            } catch { erros.push('data_programacao_invalida'); continue; }
            if (p.agendaSincronizadaEm && !(snapshot.vinculosAgenda || []).some(v => v.programacaoId === String(p.id) && v.grupoId === grupoId)) erros.push('agenda_sem_inventario');
            if (!isProgramacaoV2(p)) {
                const data = p.meioSemana?.data || p.dataReuniao || p.dataExata;
                const ativo = p.meioSemana?.ativo ?? true;
                if ((ativo && !data) || (p.fimDeSemana?.ativo && !p.fimDeSemana.data)) { erros.push('data_legada_exige_revisao'); continue; }
                // Materializa apenas identidade/controle. Nunca renomeia IDs,
                // altera partes, datas, cancelamentos, designados ou vínculos.
                await add('historico_reunioes', p.id, p, { ...p, grupoId: getGrupoLegadoId(config), versaoProgramacao: 2,
                    publicadaNoQuadro: p.publicadaNoQuadro ?? true,
                    meioSemana: { ...p.meioSemana, ativo, ...(data ? { data } : {}), horario: p.meioSemana?.horario || config.grupos[grupoId].meioSemana.horario } });
            }
        }
        for (const aluno of snapshot.alunos || []) {
            if (!aluno.id) { erros.push('pessoa_sem_id'); continue; }
            if (materializarParticipacao && aluno.gruposParticipantes === undefined) await add('alunos', aluno.id, aluno, { ...aluno, gruposParticipantes: getGruposParticipantes(aluno, config) });
            if ((aluno.historico || []).some(h => !h.programacaoId || !h.tipoReuniao)) avisos.push('historico_ambiguo_preservado');
        }
    }
    const tokens = new Map(), keys = new Set();
    for (const c of snapshot.confirmacoes || []) {
        if (!c.assignmentKey || keys.has(c.assignmentKey)) erros.push('confirmacao_chave_ambigua');
        keys.add(c.assignmentKey);
        if (!c.token) erros.push('confirmacao_sem_token');
        else if (tokens.has(c.token) && tokens.get(c.token) !== c.assignmentKey) erros.push('token_com_destinos_distintos');
        tokens.set(c.token, c.assignmentKey);
    }
    const conteudo = { schemaVersion: 1, sourceHash: await hashEnsaio(snapshot), passos, erros: [...new Set(erros)], avisos: [...new Set(avisos)] };
    return { ...conteudo, planHash: await hashEnsaio(conteudo), aplicavelLocalmente: !erros.length };
}

const registro = (estado, passo) => passo.colecao === 'configuracoes' ? estado.configuracoes
    : estado[passo.colecao]?.find(item => String(item.id) === passo.registroId);
export async function executarEnsaioMigracao({ snapshot, plano, checkpoint = null, pararDepois = Infinity }) {
    if (!plano.aplicavelLocalmente) throw new Error('Inventário possui bloqueios; nenhum passo aplicado.');
    const { planHash, aplicavelLocalmente: _ok, ...conteudo } = plano;
    if (await hashEnsaio(conteudo) !== planHash) throw new Error('Plano adulterado.');
    if (checkpoint && checkpoint.planHash !== planHash) throw new Error('Checkpoint de outro plano.');
    const concluidos = new Set(checkpoint?.concluidos || []);
    if ([...concluidos].some(id => !plano.passos.some(p => p.id === id))) throw new Error('Checkpoint desconhece o plano.');
    if (!checkpoint && await hashEnsaio(snapshot) !== plano.sourceHash) throw new Error('Exportação mudou; refaça o inventário.');
    const estado = structuredClone(snapshot);
    let aplicados = 0;
    for (const passo of plano.passos) {
        const currentHash = await hashEnsaio(registro(estado, passo));
        if (concluidos.has(passo.id)) {
            if (currentHash !== passo.afterHash) throw new Error('Registro concluído mudou; revisão necessária.');
            continue;
        }
        if (aplicados >= pararDepois) break;
        if (currentHash !== passo.beforeHash && currentHash !== passo.afterHash) throw new Error('Conflito concorrente no destino; nenhum resultado liberado.');
        if (passo.colecao === 'configuracoes') estado.configuracoes = structuredClone(passo.after);
        else estado[passo.colecao] = estado[passo.colecao].map(item => String(item.id) === passo.registroId ? structuredClone(passo.after) : item);
        concluidos.add(passo.id); aplicados++;
    }
    return { estado, checkpoint: { planHash, concluidos: [...concluidos] }, completo: concluidos.size === plano.passos.length };
}

export const verificarPreparacaoAtivacao = evidencias => {
    const exigidas = ['regressaoIntegrada', 'rulesEmulador', 'pdfRenderizado', 'aceiteVisual', 'clientesAntigos', 'pwaDuasAbasReconexao',
        'inventarioDoAlvo', 'backupDoAlvo', 'adaptadoresRemotosRevisados', 'autorizacaoSuperficies'];
    const pendencias = exigidas.filter(key => evidencias[key] !== true);
    return { prontoParaAtivar: pendencias.length === 0, pendencias };
};

// Relatório redigido: nunca serializar passos.after ou registros de confirmação
// no relatório de inventário; podem conter dados privados/tokens do export local.
export const resumirEnsaio = plano => ({ schemaVersion: plano.schemaVersion, sourceHash: plano.sourceHash, planHash: plano.planHash,
    aplicavelLocalmente: plano.aplicavelLocalmente, erros: plano.erros, avisos: plano.avisos,
    passos: plano.passos.map(({ id, colecao, beforeHash, afterHash }) => ({ id, colecao, beforeHash, afterHash })) });
