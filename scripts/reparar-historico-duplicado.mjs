import fs from 'node:fs';
import path from 'node:path';
import { createAdminClients, closeClients } from './firebase-migration/common.mjs';
import { getGrupoEfetivoId, getGrupoLegadoId } from '../src/utils/gruposProgramacao.js';
import { selecionarDesignacoes } from '../src/utils/designacoesPorGrupo.js';
import { getAssignmentCapabilityForSlot } from '../src/utils/assignmentEligibility.js';
import { buildAssignmentKey, identityFromDesignacao } from '../src/utils/assignmentIdentity.js';
import { deduplicarHistorico, isLegacyHistoricoEntry } from '../src/utils/revisarEnviar/historico.js';

const DEFAULT_KEY = 'rvm-sbssc-firebase-adminsdk-fbsvc-131d05c7d0.json';
const DEFAULT_UID = 'P8B0fY6m8JVjoLFGZEcXQ1uWsWs2';

const BUCKET = {
    presidente_rvm: 'presidente',
    discurso_inicial: 'tesouros',
    joias_espirituais: 'joias',
    leitura_biblia: 'leitura',
    vida_crista: 'vidacrista',
    estudo_biblico_congregacao: 'estudobiblico',
    leitor_ebc: 'leitor',
};

function parseArgs(argv = process.argv.slice(2)) {
    const opts = { key: DEFAULT_KEY, uid: DEFAULT_UID, apply: false };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--key') opts.key = argv[++i];
        else if (arg === '--uid') opts.uid = argv[++i];
        else if (arg === '--apply') opts.apply = true;
        else if (arg === '--dry-run') opts.apply = false;
        else throw new Error(`Argumento desconhecido: ${arg}`);
    }
    return opts;
}

function buildCanonicalV2Entry(item, grupoId) {
    const capability = getAssignmentCapabilityForSlot({ parte: item.parte, slotKey: item.slotKey });
    const parte = item.slotKey === 'ajudante'
        ? 'ajudante'
        : item.slotKey === 'oracao_fds'
            ? 'oracao_fds'
            : BUCKET[capability] || capability;
    if (!parte || !item.reuniao?.data) return null;
    const identity = identityFromDesignacao(item);
    return {
        ...identity,
        assignmentKey: buildAssignmentKey(identity),
        grupoId,
        programacaoId: item.programacaoId,
        tipoReuniao: item.tipoReuniao,
        slotId: item.slotId,
        papel: item.slotKey,
        data: item.reuniao.data,
        parte,
        ajudante: item.slotKey === 'ajudante' ? item.parte?.estudante?.nome || '' : item.parte?.ajudante?.nome || '',
    };
}

function matchesLegacyPart(legacyParte, v2Parte) {
    if (legacyParte === v2Parte) return true;
    // Partes "O que você diria?" eram gravadas como "ministerio" no legado v1
    if (legacyParte === 'ministerio' && v2Parte === 'o_que_voce_diria') return true;
    return false;
}

async function main() {
    const opts = parseArgs();
    const client = createAdminClients('reparar-historico-duplicado', opts.key);

    try {
        const cfgSnap = await client.db.doc(`users/${opts.uid}/configuracoes/geral`).get();
        const config = cfgSnap.exists ? cfgSnap.data() : {};
        const grupoLegadoId = getGrupoLegadoId(config);

        const [progsSnap, alunosSnap] = await Promise.all([
            client.db.collection(`users/${opts.uid}/programacao`).get(),
            client.db.collection(`users/${opts.uid}/alunos`).get(),
        ]);

        const programacoes = progsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        const alunos = alunosSnap.docs
            .map(d => ({ ...d.data(), id: d.id }))
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));

        // Datas já sincronizadas em v2 no grupo legado
        const v2LegacyDates = new Set();
        for (const aluno of alunos) {
            for (const h of (aluno.historico || [])) {
                if (!isLegacyHistoricoEntry(h) && (h.grupoId || grupoLegadoId) === grupoLegadoId && h.data) {
                    v2LegacyDates.add(h.data);
                }
            }
        }

        // Designações canônicas atuais das programações do grupo legado (incluindo arquivadas)
        const legacyProgs = programacoes.filter(p => getGrupoEfetivoId(p, config) === grupoLegadoId);
        const expectedByAlunoDate = new Map();
        for (const item of selecionarDesignacoes({ programacoes: legacyProgs, config, apenasOperacionais: true, incluirArquivadas: true })) {
            const entry = buildCanonicalV2Entry(item, grupoLegadoId);
            if (!entry || !v2LegacyDates.has(entry.data)) continue;
            const key = `${String(item.pessoa.id)}|${entry.data}`;
            if (!expectedByAlunoDate.has(key)) expectedByAlunoDate.set(key, []);
            expectedByAlunoDate.get(key).push(entry);
        }

        const changes = [];
        const stats = {
            alunosAnalisados: alunos.length,
            alunosAlterados: 0,
            removidosDupExata: 0,
            removidosDupAjudanteOuParteRenomeada: 0,
            removidosLegadoSubstituido: 0,
            promovidosParaV2: 0,
            removidosPorDeduplicacao: 0,
        };

        for (const aluno of alunos) {
            const original = Array.isArray(aluno.historico) ? aluno.historico : [];
            if (original.length === 0) continue;

            const v2LegacyEntries = original.filter(h => !isLegacyHistoricoEntry(h) && (h.grupoId || grupoLegadoId) === grupoLegadoId);
            const nextRaw = [];
            const detalhes = [];

            for (const h of original) {
                if (!isLegacyHistoricoEntry(h)) {
                    nextRaw.push(h);
                    continue;
                }

                if (!h.data || !v2LegacyDates.has(h.data)) {
                    nextRaw.push(h);
                    continue;
                }

                const v2MesmaData = v2LegacyEntries.filter(v => v.data === h.data);
                const exactMatch = v2MesmaData.find(v =>
                    v.parte === h.parte &&
                    String(v.ajudante ?? '').trim() === String(h.ajudante ?? '').trim()
                );
                if (exactMatch) {
                    stats.removidosDupExata += 1;
                    detalhes.push({ acao: 'remover_dup_exata', registro: h });
                    continue;
                }

                const samePartMatch = v2MesmaData.find(v => matchesLegacyPart(h.parte, v.parte));
                if (samePartMatch) {
                    stats.removidosDupAjudanteOuParteRenomeada += 1;
                    detalhes.push({ acao: 'remover_dup_atualizada', registro: h, substituidoPor: { data: samePartMatch.data, parte: samePartMatch.parte, ajudante: samePartMatch.ajudante } });
                    continue;
                }

                // Não tem v2 na data: verificar se o aluno realmente ainda está designado nessa programação
                const expectedList = expectedByAlunoDate.get(`${String(aluno.id)}|${h.data}`) || [];
                const expectedMatch = expectedList.find(v => matchesLegacyPart(h.parte, v.parte));
                if (expectedMatch) {
                    stats.promovidosParaV2 += 1;
                    detalhes.push({ acao: 'promover_legado_para_v2', de: h, para: { data: expectedMatch.data, parte: expectedMatch.parte, ajudante: expectedMatch.ajudante, programacaoId: expectedMatch.programacaoId } });
                    nextRaw.push(expectedMatch);
                    continue;
                }

                stats.removidosLegadoSubstituido += 1;
                detalhes.push({ acao: 'remover_legado_obsoleto_substituido', registro: h });
            }

            const deduped = deduplicarHistorico(nextRaw, { alunoId: aluno.id, grupoLegadoId });
            if (deduped.length < nextRaw.length) {
                stats.removidosPorDeduplicacao += (nextRaw.length - deduped.length);
            }

            if (JSON.stringify(deduped) !== JSON.stringify(original)) {
                stats.alunosAlterados += 1;
                changes.push({
                    id: aluno.id,
                    nome: aluno.nome,
                    antes: original.length,
                    depois: deduped.length,
                    detalhes,
                    novoHistorico: deduped,
                });
            }
        }

        console.log(JSON.stringify({
            modo: opts.apply ? 'APPLY' : 'DRY_RUN',
            projectId: client.projectId,
            uid: opts.uid,
            grupoLegadoId,
            stats,
            amostraAlteracoes: changes.map(({ id, nome, antes, depois, detalhes }) => ({
                id, nome, antes, depois,
                detalhes: detalhes.filter(d => d.acao !== 'remover_dup_exata'),
                dupExatasRemovidas: detalhes.filter(d => d.acao === 'remover_dup_exata').length,
            })),
        }, null, 2));

        if (!opts.apply) {
            console.log('\n[DRY-RUN] Nenhuma alteração gravada no Firestore. Use --apply para aplicar.');
            return;
        }

        if (changes.length === 0) {
            console.log('\nNenhuma alteração necessária.');
            return;
        }

        // Backup completo obrigatório antes de qualquer gravação
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.resolve('tmp', `backup-alunos-historico-${client.projectId}-${ts}.json`);
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, JSON.stringify({
            geradoEm: new Date().toISOString(),
            projectId: client.projectId,
            uid: opts.uid,
            totalAlunos: alunos.length,
            alunos,
        }, null, 2));
        console.log(`\nBackup salvo em: ${backupPath}`);

        // Grava em lotes atômicos (máximo 400 por batch)
        const BATCH_SIZE = 400;
        for (let i = 0; i < changes.length; i += BATCH_SIZE) {
            const slice = changes.slice(i, i + BATCH_SIZE);
            const batch = client.db.batch();
            for (const change of slice) {
                const ref = client.db.doc(`users/${opts.uid}/alunos/${change.id}`);
                batch.update(ref, { historico: change.novoHistorico });
            }
            await batch.commit();
        }

        console.log(`\nSucesso! ${changes.length} alunos atualizados no Firestore (${client.projectId}).`);
    } finally {
        await closeClients(client);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
