import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { deleteApp } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';
import { abrirAlvo, encode } from './ativacao/inventario-backup.mjs';
import { prepararReparoImportacaoSemanal } from '../src/utils/agendamentoReunioes.js';

export async function repararImportacao({ id, grupoId = 'grupo-portugues', executar = false }) {
    if (!id || !/^[\w-]+$/.test(id)) throw new Error('Informe --id com o ID exato da programacao.');
    const target = await abrirAlvo();
    try {
        const configRef = target.db.doc(`users/${target.ownerUid}/configuracoes/geral`);
        const ref = target.db.doc(`users/${target.ownerUid}/programacao/${id}`);
        const [configSnap, snap] = await target.db.getAll(configRef, ref);
        const atual = { ...snap.data(), id };
        const config = configSnap.data();
        const { operacoes } = prepararReparoImportacaoSemanal({ programacoes: [atual], config, grupoId, programacaoId: id });
        const patch = operacoes[0].alteracoes;
        const resumo = { projectId: target.projectId, id, grupoId, executar, meioSemana: patch.meioSemana,
            fimDeSemana: patch.fimDeSemana ? { ativo: patch.fimDeSemana.ativo, data: patch.fimDeSemana.data, horario: patch.fimDeSemana.horario } : 'preservado',
            partesPreservadas: atual.partes.length };
        if (executar) {
            const folder = `tmp/reparo-importacao/${new Date().toISOString().replaceAll(':', '-')}`;
            await fs.mkdir(folder, { recursive: true });
            await fs.writeFile(`${folder}/backup.json`, JSON.stringify({ path: ref.path, data: encode(snap.data()),
                updateTime: encode(snap.updateTime), patch }, null, 2), { flag: 'wx' });
            await target.db.runTransaction(async tx => {
                const [c, p] = await tx.getAll(configRef, ref);
                if (!p.updateTime?.isEqual(snap.updateTime) || !c.updateTime?.isEqual(configSnap.updateTime)) {
                    throw new Error('Dados mudaram durante o reparo; nenhuma alteracao aplicada.');
                }
                tx.update(ref, patch);
                tx.update(configRef, { revisionProgramacoes: FieldValue.increment(1) });
            });
            const depois = (await ref.get()).data();
            const esperado = { ...snap.data(), ...patch };
            if (!isDeepStrictEqual(encode(depois), encode(esperado))) throw new Error('Verificacao do reparo divergiu.');
            resumo.verificado = true;
            await fs.writeFile(`${folder}/resultado.json`, JSON.stringify(resumo, null, 2));
        }
        console.log(JSON.stringify(resumo, null, 2));
        return resumo;
    } finally { await deleteApp(target.app); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
    await repararImportacao({ id: arg('--id'), grupoId: arg('--grupo') || 'grupo-portugues', executar: process.argv.includes('--execute') });
}
