import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { abrirAlvo, encode, decode } from './inventario-backup.mjs';
import { hashEnsaio } from '../../src/utils/ensaioMigracaoGrupos.js';
import { projetarQuadroPublico } from '../../src/utils/quadroPublico.js';
import { planejarAgendaGrupo, criarFilaGrupo } from '../../src/utils/integracoesGrupo.js';

export async function prepararEscritas({ backup, plano, snapshot }) {
    const { planHash, aplicavelLocalmente, ...conteudo } = plano;
    if (!aplicavelLocalmente || plano.erros.length || await hashEnsaio(conteudo) !== planHash) throw new Error('Plano inválido ou adulterado.');
    if (await hashEnsaio(snapshot) !== plano.sourceHash) throw new Error('Snapshot divergente.');
    if (backup.projectId !== 'rvm-sbssc' || !backup.ownerUid) throw new Error('Backup de outro alvo.');
    const writes = [];
    for (const step of plano.passos) {
        if (!['configuracoes', 'historico_reunioes'].includes(step.colecao)) throw new Error('Coleção fora do escopo autorizado da migração.');
        if (await hashEnsaio(step.after) !== step.afterHash) throw new Error('Conteúdo de passo adulterado.');
        const collection = step.colecao === 'historico_reunioes' ? 'programacao' : 'configuracoes';
        const path = `users/${backup.ownerUid}/${collection}/${step.registroId}`;
        const old = backup.documents.find(d => d.path === path);
        if (!old || await hashEnsaio({ ...old.data, id: step.registroId }) !== step.beforeHash) throw new Error('Passo não corresponde ao backup.');
        const data = structuredClone(step.after);
        if (collection === 'configuracoes') data.ativacaoMultiGrupos = { ...data.ativacaoMultiGrupos, status: 'ativa', planHash };
        writes.push({ path, beforeHash: await hashEnsaio(old.data), data, afterHash: await hashEnsaio(data) });
    }
    const config = writes.find(w => w.path.endsWith('/configuracoes/geral'))?.data;
    if (!config || config.ativacaoMultiGrupos.status !== 'ativa') throw new Error('Configuração de ativação ausente.');
    const programs = writes.filter(w => w.path.includes('/programacao/')).map(w => w.data);
    if (programs.length !== snapshot.historico_reunioes.length) throw new Error('Migração deve conter a fonte completa.');
    const oldEvents = await planejarAgendaGrupo({ programacoes: snapshot.historico_reunioes, config: snapshot.configuracoes, grupoId: config.grupoLegadoId });
    const newEvents = await planejarAgendaGrupo({ programacoes: programs, config, grupoId: config.grupoLegadoId });
    if (JSON.stringify(oldEvents.map(e => e.id).sort()) !== JSON.stringify(newEvents.map(e => e.id).sort())) throw new Error('Migração alteraria IDs legados da agenda.');
    const oldTokens = criarFilaGrupo({ programacoes: snapshot.historico_reunioes, config: snapshot.configuracoes, grupoId: config.grupoLegadoId, confirmacoes: snapshot.confirmacoes }).filter(r => r.confirmation.token).map(r => r.confirmation.token).sort();
    const newTokens = criarFilaGrupo({ programacoes: programs, config, grupoId: config.grupoLegadoId, confirmacoes: snapshot.confirmacoes }).filter(r => r.confirmation.token).map(r => r.confirmation.token).sort();
    if (JSON.stringify(oldTokens) !== JSON.stringify(newTokens)) throw new Error('Migração alteraria vínculos de confirmações.');
    const boardPath = `quadros_publicos/${backup.ownerUid}`;
    const oldBoard = backup.documents.find(d => d.path === boardPath);
    const board = projetarQuadroPublico({ ownerUid: backup.ownerUid, configuracoes: config, historico_reunioes: programs, updatedAtIso: config.ativacaoMultiGrupos.autorizadaEm });
    writes.push({ path: boardPath, beforeHash: await hashEnsaio(oldBoard?.data ?? null), data: board, afterHash: await hashEnsaio(board) });
    return { writes, config, programs, preservados: { tokensAtivos: newTokens.length, idsAgenda: newEvents.length } };
}

export async function executar(folder, aplicar = false) {
    if (!folder?.startsWith('tmp/ativacao-privada/')) throw new Error('Pasta privada necessária.');
    const raw = await fs.readFile(`${folder}/backup.json`, 'utf8');
    const resumo = JSON.parse(await fs.readFile(`${folder}/resumo.json`, 'utf8'));
    if (createHash('sha256').update(raw).digest('hex') !== resumo.backupSha256) throw new Error('Checksum do backup divergente.');
    const backup = JSON.parse(raw);
    const plano = JSON.parse(await fs.readFile(`${folder}/plano.json`, 'utf8'));
    const snapshot = JSON.parse(await fs.readFile(`${folder}/snapshot-plano.json`, 'utf8'));
    const prepared = await prepararEscritas({ backup, plano, snapshot });
    const target = await abrirAlvo();
    try {
        if (target.ownerUid !== backup.ownerUid || target.projectId !== backup.projectId) throw new Error('Alvo não corresponde ao backup.');
        const { db } = target;
        const result = await db.runTransaction(async tx => {
            const programQuery = await tx.get(db.collection(`users/${target.ownerUid}/programacao`));
            if (JSON.stringify(programQuery.docs.map(d => d.id).sort()) !== JSON.stringify(prepared.programs.map(p => p.id).sort())) throw new Error('Inventário de programações mudou.');
            const snaps = await tx.getAll(...prepared.writes.map(w => db.doc(w.path)));
            const hashes = await Promise.all(snaps.map(s => hashEnsaio(s.exists ? encode(s.data()) : null)));
            const alreadyDone = hashes.every((h, i) => h === prepared.writes[i].afterHash);
            if (alreadyDone) return { jaAplicado: true };
            for (let i = 0; i < hashes.length; i++) if (hashes[i] !== prepared.writes[i].beforeHash) throw new Error('Conflito concorrente no alvo; nada foi gravado.');
            if (aplicar) for (const write of prepared.writes) tx.set(db.doc(write.path), decode(write.data, db));
            return { jaAplicado: false };
        });
        const report = { projectId: target.projectId, planHash: plano.planHash, backupSha256: resumo.backupSha256,
            applied: aplicar || result.jaAplicado, alreadyDone: result.jaAplicado, atomicWrites: prepared.writes.length, preservados: prepared.preservados, at: new Date().toISOString() };
        await fs.writeFile(`${folder}/${aplicar ? 'checkpoint-aplicado' : 'preflight'}.json`, JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
        return report;
    } finally { await deleteApp(target.app); }
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/executar-migracao.mjs')) await executar(process.argv[2], process.argv[3] === '--apply-rvm-sbssc');
