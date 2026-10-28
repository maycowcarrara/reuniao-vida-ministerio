import { getGrupoEfetivoId, getGrupoLegadoId, isProgramacaoV2, normalizeGruposProgramacao } from './gruposProgramacao.js';
import { createProgramacaoId, getProgramacaoWeekStartISO } from './programacoes.js';
import { dadosIguais } from './compararDados.js';

const isObject = value => !!value && Object.getPrototypeOf(value) === Object.prototype;

// Objetos são patches; arrays são valores explícitos. Nunca reconstruir documento
// a partir de uma projeção de tela/pública nem apagar campos que ela desconhece.
export const mergeCamposPreservados = (atual, patch) => {
    const next = { ...atual };
    for (const [key, value] of Object.entries(patch || {})) {
        if (value === undefined) continue;
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Campo inválido.');
        next[key] = isObject(value) ? mergeCamposPreservados(isObject(atual?.[key]) ? atual[key] : {}, value) : value;
    }
    return next;
};

export const selecionarProgramacoesGrupo = (lista = [], grupoId, config = {}) =>
    lista.filter(item => getGrupoEfetivoId(item, config) === grupoId);

export const aplicarOperacoesProgramacao = ({ programacoes = [], config = {}, grupoId, operacoes = [] }) => {
    if (!grupoId || !normalizeGruposProgramacao(config).grupos[grupoId]) throw new Error('Grupo inválido.');
    const mapa = new Map(programacoes.map(item => [createProgramacaoId(item, { config }), item]));
    if (mapa.size !== programacoes.length) throw new Error('IDs duplicados na fonte completa.');
    for (const operacao of operacoes) {
        const { tipo, programacao, alteracoes = {} } = operacao;
        const id = String(operacao.programacaoId || programacao?.id || (tipo === 'upsert'
            ? createProgramacaoId({ ...programacao, grupoId, versaoProgramacao: 2 }, { config }) : ''));
        const atual = mapa.get(id);
        if (atual && getGrupoEfetivoId(atual, config) !== grupoId) throw new Error('ID pertence a outro grupo.');
        if (tipo !== 'upsert' && !atual) throw new Error('Programação não encontrada no grupo.');
        if (tipo === 'excluir') { mapa.delete(id); continue; }
        if (!['upsert', 'patch', 'arquivar'].includes(tipo)) throw new Error('Operação inválida.');
        const patch = tipo === 'upsert' ? programacao : tipo === 'arquivar'
            ? { arquivada: operacao.arquivada !== false, arquivadaEm: operacao.arquivada === false ? null : operacao.agoraIso }
            : alteracoes;
        if (patch?.id != null && String(patch.id) !== id) throw new Error('ID é imutável.');
        if (patch?.grupoId !== undefined && patch.grupoId !== grupoId) throw new Error('Grupo é imutável.');
        if (atual?.versaoProgramacao >= 2 && patch?.versaoProgramacao !== undefined && patch.versaoProgramacao < 2) {
            throw new Error('Não é permitido degradar a identidade v2.');
        }
        const next = atual ? mergeCamposPreservados(atual, patch) : {
            ...programacao, id, grupoId, versaoProgramacao: 2, publicadaNoQuadro: false,
            meioSemana: { ativo: false, ...programacao?.meioSemana },
        };
        if (atual && !isProgramacaoV2(atual) && isProgramacaoV2(next)) {
            next.versaoProgramacao = 2;
            next.meioSemana = { ativo: atual.meioSemana?.ativo ?? true, ...next.meioSemana };
            if (next.publicadaNoQuadro === undefined) next.publicadaNoQuadro = atual.publicadaNoQuadro !== false;
        }
        // Movimentar uma ocorrência com vínculos precisa de política própria.
        if (atual && ['dataInicio', 'dataReuniao', 'dataExata', 'data'].some(key =>
            patch?.[key] !== undefined && patch[key] !== atual[key])) {
            let semanaAnterior;
            try { semanaAnterior = getProgramacaoWeekStartISO(atual); } catch { /* Legado sem data: permite a primeira data. */ }
            if (semanaAnterior && getProgramacaoWeekStartISO(next) !== semanaAnterior) {
                throw new Error('Movimentação entre semanas exige revisão dos vínculos.');
            }
        }
        if (patch?.fimDeSemana?.data && patch.fimDeSemana.data !== atual?.fimDeSemana?.data
            && getProgramacaoWeekStartISO({ dataInicio: patch.fimDeSemana.data }) !== getProgramacaoWeekStartISO(next)) {
            throw new Error('Fim de semana fora da semana da programação exige revisão dos vínculos.');
        }
        if (!atual && isProgramacaoV2(next)) {
            const semana = getProgramacaoWeekStartISO(next);
            const colisao = [...mapa.values()].some(item => {
                if (getGrupoEfetivoId(item, config) !== grupoId) return false;
                try { return getProgramacaoWeekStartISO(item) === semana; } catch { return false; }
            });
            if (colisao) throw new Error('Já existe programação deste grupo nesta semana.');
        }
        mapa.set(id, next);
    }
    return [...mapa.values()];
};

// Adaptador temporário para componentes antigos. Omissão de uma semana na lista
// visível nunca significa exclusão; exclusões usam a operação explícita por ID.
export const operacoesDaListaDoGrupo = ({ lista, grupoId }) => lista.map(programacao => {
    if (programacao.grupoId && programacao.grupoId !== grupoId) throw new Error('Lista contém outro grupo.');
    return { tipo: 'upsert', programacao };
});

export const patchConfiguracoesGrupos = (config, { alteracoesPorGrupo = {}, grupoPrincipalId, configOriginal }) => {
    const normalized = normalizeGruposProgramacao(config);
    if (configOriginal) {
        const conteudo = c => JSON.stringify([c.grupos, c.grupoPrincipalId, c.grupoLegadoId], (_, value) =>
            isObject(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
        if (conteudo(normalized) !== conteudo(normalizeGruposProgramacao(configOriginal))) throw new Error('configuracaoConflito');
    }
    const next = { ...normalized, grupos: { ...normalized.grupos },
        grupoPrincipalId: grupoPrincipalId || normalized.grupoPrincipalId };
    for (const [grupoId, alteracoes] of Object.entries(alteracoesPorGrupo)) {
        if (!normalized.grupos[grupoId]) throw new Error('Grupo inválido.');
        if (alteracoes.id !== undefined && alteracoes.id !== grupoId) throw new Error('ID do grupo é imutável.');
        const grupo = mergeCamposPreservados(normalized.grupos[grupoId], alteracoes);
        next.grupos[grupoId] = grupo;
        for (const tipo of ['meioSemana', 'fimDeSemana']) {
            const reuniao = grupo[tipo];
            if (!['semanal', 'datas'].includes(reuniao.frequencia)) throw new Error('Frequência inválida.');
            if (reuniao.habilitada && reuniao.frequencia === 'semanal' && (!reuniao.dia || !reuniao.horario)) {
                throw new Error('Informe dia e horário da reunião semanal.');
            }
        }
        if (grupoId === getGrupoLegadoId(next)) {
            Object.assign(next, { nome_cong: grupo.nome, idioma: grupo.idioma,
                dia_reuniao: grupo.meioSemana.dia, horario: grupo.meioSemana.horario,
                dia_reuniao_fds: grupo.fimDeSemana.dia, horario_fds: grupo.fimDeSemana.horario,
                eventosAnuais: grupo.eventosAnuais });
        }
    }
    if (!Object.values(next.grupos).some(item => item.ativo)) throw new Error('Mantenha pelo menos um grupo ativo.');
    if (!next.grupos[next.grupoPrincipalId]?.ativo) throw new Error('O grupo principal precisa estar ativo.');
    return next;
};

export const patchConfiguracaoGrupo = (config, { grupoId, alteracoes = {}, grupoPrincipalId }) =>
    patchConfiguracoesGrupos(config, { alteracoesPorGrupo: { [grupoId]: alteracoes }, grupoPrincipalId });

// Uma operação captura seu grupo/IDs no início. Adaptadores de teste/local são
// injetados; publicação usa sempre a fonte completa resultante da gravação.
export const createProgramacoesController = ({ getEstado, salvarLote, publicar }) => {
    let emAndamento = false;
    const executar = async ({ grupoId, operacoes, preparar, republicar = false }) => {
        if (emAndamento) throw new Error('Uma gravação já está em andamento.');
        emAndamento = true;
        try {
            const estado = getEstado();
            const config = estado.configuracoes;
            const antes = estado.historico_reunioes;
            const anterioresPorId = new Map(antes.map(item => [createProgramacaoId(item, { config }), item]));
            // E3: revalida prévias na fonte atual, dentro da mesma exclusão mútua.
            if (preparar) operacoes = preparar({ programacoes: antes, alunos: estado.alunos || [], config, grupoId }).operacoes;
            const next = aplicarOperacoesProgramacao({ programacoes: antes, config, grupoId, operacoes });
            const ids = new Set(next.map(item => createProgramacaoId(item, { config })));
            const upserts = next.filter(item => !dadosIguais(item, anterioresPorId.get(createProgramacaoId(item, { config }))));
            const alteradosIds = new Set(upserts.map(item => createProgramacaoId(item, { config })));
            const excluirIds = antes.filter(item => !ids.has(createProgramacaoId(item, { config })))
                .map(item => createProgramacaoId(item, { config }));
            // Arquivar/restaurar muda a visibilidade de reuniões já publicadas.
            // Vale também para os upserts da interface clássica, individuais ou em lote.
            const mudouArquivamento = upserts.some(item => {
                const anterior = anterioresPorId.get(createProgramacaoId(item, { config }));
                return anterior && !!anterior.arquivada !== !!item.arquivada;
            });
            const deveRepublicar = republicar || mudouArquivamento;
            if (upserts.length || excluirIds.length) await salvarLote({ grupoId, upserts, excluirIds,
                anteriores: antes.filter(p => alteradosIds.has(createProgramacaoId(p, { config })) || !ids.has(createProgramacaoId(p, { config }))) });
            if (deveRepublicar) {
                try { await publicar({ configuracoes: config, historico_reunioes: next }); }
                catch (erroPublicacao) { return { salvo: true, publicado: false, erroPublicacao }; }
            }
            return { salvo: true, publicado: deveRepublicar };
        } finally { emAndamento = false; }
    };
    return {
        executar,
        upsertProgramacao: ({ grupoId, programacao }) => executar({ grupoId, operacoes: [{ tipo: 'upsert', programacao }] }),
        patchProgramacao: ({ grupoId, programacaoId, alteracoes }) => executar({ grupoId, operacoes: [{ tipo: 'patch', programacaoId, alteracoes }] }),
        arquivarProgramacoes: ({ grupoId, ids, arquivada = true }) => executar({ grupoId,
            operacoes: ids.map(programacaoId => ({ tipo: 'arquivar', programacaoId, arquivada, agoraIso: new Date().toISOString() })) }),
        excluirProgramacoes: ({ grupoId, ids }) => executar({ grupoId, operacoes: ids.map(programacaoId => ({ tipo: 'excluir', programacaoId })) }),
    };
};
