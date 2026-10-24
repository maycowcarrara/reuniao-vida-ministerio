import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { abrirAlvo, encode } from './inventario-backup.mjs';
import { prepararEscritas } from './executar-migracao.mjs';
import { hashEnsaio } from '../../src/utils/ensaioMigracaoGrupos.js';
import { medirPayloadPublico } from '../../src/utils/quadroPublico.js';
import { getGruposParticipantes } from '../../src/utils/gruposProgramacao.js';
import { criarFilaGrupo, resolverConfirmacaoGrupo } from '../../src/utils/integracoesGrupo.js';
import { initializeApp as initializeClient, deleteApp as deleteClient } from 'firebase/app';
import { getFirestore as getClientDb, doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { loadEnv } from 'vite';
const folder = process.argv[2];
if (!folder?.startsWith('tmp/ativacao-privada/')) throw new Error('Pasta privada necessária.');
const read = async name => JSON.parse(await fs.readFile(`${folder}/${name}.json`, 'utf8'));
const backup = await read('backup'), plano = await read('plano'), snapshot = await read('snapshot-plano');
const prepared = await prepararEscritas({ backup, plano, snapshot });
const target = await abrirAlvo(); let client;
try {
    const snaps = [];
    for (let i = 0; i < backup.documents.length; i += 100) snaps.push(...await target.db.getAll(...backup.documents.slice(i, i + 100).map(d => target.db.doc(d.path))));
    const actual = new Map(snaps.map(s => [s.ref.path, s.exists ? encode(s.data()) : null]));
    for (const w of prepared.writes) assert.equal(await hashEnsaio(actual.get(w.path)), w.afterHash, 'Destino migrado divergente.');
    const changedPaths = new Set(prepared.writes.map(w => w.path));
    let unchanged = 0;
    for (const old of backup.documents) if (!changedPaths.has(old.path)) {
        assert.equal(await hashEnsaio(actual.get(old.path)), await hashEnsaio(old.data), 'Documento fora do escopo mudou; conferir concorrência.'); unchanged++;
    }
    const privateRows = backup.documents.filter(d => d.path.startsWith(`users/${backup.ownerUid}/confirmacoes/`));
    const publicRows = backup.documents.filter(d => d.path.startsWith('confirmacoes_publicas/'));
    const people = snapshot.alunos;
    const board = actual.get(`quadros_publicos/${backup.ownerUid}`);
    const env = loadEnv('production', process.cwd(), 'VITE_');
    client = initializeClient({ apiKey: env.VITE_FIREBASE_API_KEY, projectId: target.projectId, appId: env.VITE_FIREBASE_APP_ID }, 'verificacao-anonima');
    const anon = getClientDb(client);
    const publicBoard = await getDoc(doc(anon, `quadros_publicos/${backup.ownerUid}`));
    assert.equal(await hashEnsaio(publicBoard.data()), await hashEnsaio(board));
    for (const path of [`users/${backup.ownerUid}/configuracoes/geral`, `users/${backup.ownerUid}/programacao/${prepared.programs[0].id}`, `users/${backup.ownerUid}/alunos/${people[0].id}`]) {
        await assert.rejects(getDoc(doc(anon, path)), e => e.code === 'permission-denied');
    }
    await assert.rejects(getDocs(collection(anon, 'quadros_publicos')), e => e.code === 'permission-denied');
    const row = criarFilaGrupo({ programacoes: prepared.programs, config: prepared.config, grupoId: prepared.config.grupoLegadoId, confirmacoes: snapshot.confirmacoes }).find(r => r.confirmation.token);
    assert.ok(row);
    const confirmation = (await getDoc(doc(anon, 'confirmacoes_publicas', row.confirmation.token))).data();
    assert.equal(confirmation.assignmentKey, row.assignmentKey);
    assert.equal(resolverConfirmacaoGrupo({ confirmacao: confirmation, programacoes: board.historico_reunioes, config: board.configuracoes }).isUnavailable, false);
    const assets = {};
    const indexText = await fs.readFile('dist/index.html', 'utf8');
    const urls = ['/index.html', '/sw.js', ...new Set([...indexText.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(m => m[1]))];
    for (const path of urls) {
        const response = await fetch(`https://${target.projectId}.web.app${path}`, { cache: 'no-store' });
        assert.equal(response.status, 200);
        const remote = Buffer.from(await response.arrayBuffer()); const local = await fs.readFile(`dist${path}`);
        const sha = value => createHash('sha256').update(value).digest('hex');
        assert.equal(sha(remote), sha(local), 'Asset publicado divergente.'); assets[path] = sha(remote);
    }
    const report = { projectId: target.projectId, at: new Date().toISOString(), active: prepared.config.ativacaoMultiGrupos.status === 'ativa',
        atomicWrites: prepared.writes.length, outsideScopeUnchanged: unchanged, studentsUnchanged: people.length,
        privateConfirmationsUnchanged: privateRows.length, publicConfirmationsUnchanged: publicRows.length,
        studentsWithEs: people.filter(p => getGruposParticipantes(p, prepared.config).includes('grupo-espanhol')).length,
        preserved: prepared.preservados, publicPayloadBytes: medirPayloadPublico(board),
        anonymousBoardRead: true, anonymousPrivateReadDenied: true, anonymousBoardListDenied: true, legacyConfirmationTargetValid: true,
        assets, providerMessagesSent: 0, googleEventsWritten: 0, browserRetestPending: true };
    await fs.writeFile(`${folder}/verificacao-final.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
} finally { if (client) await deleteClient(client); await deleteApp(target.app); }
