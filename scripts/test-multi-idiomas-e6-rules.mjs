import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test, before, after } from 'node:test';
import { buildAssignmentKey } from '../src/utils/assignmentIdentity.js';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (host !== '127.0.0.1:8186') throw new Error('Este teste só aceita emulador em 127.0.0.1:8186.');
const projectId = 'demo-rvm-multi-e6';
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) throw new Error('Projeto de teste divergente.');
const require = createRequire(new URL('../tmp/e6-rules-runtime/package.json', import.meta.url));
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocFromServer, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp, disableNetwork, enableNetwork } = require('firebase/firestore');
const owner = 'fixture-owner';
const identity = { identityVersion: 2, grupoId: 'grupo-espanhol', programacaoId: 'es-fixture', tipoReuniao: 'fimDeSemana', slotId: 'presidente', pessoaId: 'fixture-pessoa', papel: 'presidente_fds' };
const key = buildAssignmentKey(identity);
const confirmation = { ...identity, assignmentKey: key, ownerUid: owner, token: 'fixture-token', pessoaNome: 'Pessoa fictícia', tituloParte: 'presidente', semana: 'Semana fictícia', dataISO: '2099-11-08', status: 'pendente', weekReminderStatus: 'nao_enviado' };
const program = { id: 'es-fixture', versaoProgramacao: 2, grupoId: 'grupo-espanhol', publicadaNoQuadro: false, meioSemana: { ativo: false }, fimDeSemana: { ativo: true, cancelada: false, privadoDesconhecido: 'preservar' }, desconhecido: 'preservar' };
let env, admin, anon, outsider;
const priv = db => doc(db, `users/${owner}/confirmacoes/${key}`);
const pub = db => doc(db, 'confirmacoes_publicas/fixture-token');
const prog = db => doc(db, `users/${owner}/programacao/es-fixture`);
before(async () => {
    const raw = await readFile('firestore.rules', 'utf8');
    // Mesma política, com os dois identificadores fixos substituídos por UID
    // fictício. Nenhuma credencial é carregada ou autenticada.
    const rules = raw.replace(/return "P8B0fY6m8JVjoLFGZEcXQ1uWsWs2";/g, 'return "fixture-owner";');
    assert.notEqual(raw, rules);
    env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8186, rules } });
    admin = env.authenticatedContext(owner, { email: 'fixture@local.invalid' }).firestore();
    anon = env.unauthenticatedContext().firestore();
    outsider = env.authenticatedContext('fixture-estranho', { email: 'estranho@local.invalid' }).firestore();
    await env.withSecurityRulesDisabled(async ctx => {
        const db = ctx.firestore();
        await setDoc(pub(db), confirmation); await setDoc(priv(db), confirmation); await setDoc(prog(db), program);
        await setDoc(doc(db, `users/${owner}/configuracoes/geral`), { versaoProgramacao: 2, grupoLegadoId: 'grupo-portugues', grupos: { 'grupo-portugues': { id: 'grupo-portugues' }, 'grupo-espanhol': { id: 'grupo-espanhol' } }, privado: 'fixture' });
        await setDoc(doc(db, 'quadros_publicos/' + owner), { ownerUid: owner, configuracoes: { destinosConfirmacao: { [key]: identity } }, historico_reunioes: [] });
        await setDoc(doc(db, `users/${owner}/alunos/fixture-pessoa`), { nome: 'Pessoa fictícia', gruposParticipantes: ['grupo-portugues'], partesHabilitadas: [], privado: 'preservar' });
    });
});
after(async () => { await env?.cleanup(); });
test('E6 Rules: quadro público get permitido, listagem negada', async () => {
    await assertSucceeds(getDoc(doc(anon, 'quadros_publicos/' + owner)));
    await assertFails(getDocs(collection(anon, 'quadros_publicos')));
});
test('E6 Rules: programação/configuração/alunos privados negados a anônimo e estranho', async () => {
    for (const db of [anon, outsider]) {
        await assertFails(getDoc(prog(db)));
        await assertFails(getDocs(collection(db, `users/${owner}/programacao`)));
        await assertFails(getDoc(doc(db, `users/${owner}/configuracoes/geral`)));
        await assertFails(getDoc(doc(db, `users/${owner}/alunos/fixture-pessoa`)));
    }
});
test('E6 Rules: resposta pública v2 válida conserva identidade', async () => {
    await assertSucceeds(getDoc(pub(anon)));
    await assertSucceeds(updateDoc(pub(anon), { status: 'confirmado' }));
    await assertSucceeds(updateDoc(priv(anon), { status: 'confirmado' }));
    await assertSucceeds(updateDoc(pub(anon), { weekReminderStatus: 'imprevisto' }));
});
for (const [field, value] of Object.entries({ token: 'outro', ownerUid: 'outro', assignmentKey: 'outro', identityVersion: 1, grupoId: 'grupo-portugues', programacaoId: 'pt', tipoReuniao: 'meioSemana', slotId: 'outra', pessoaId: 'outro', papel: 'outro' })) {
    test(`E6 Rules: ${field} imutável até para administrador`, async () => {
        for (const db of [admin, anon]) {
            await assertFails(updateDoc(pub(db), { [field]: value }));
            await assertFails(updateDoc(priv(db), { [field]: value }));
        }
    });
}
test('E6 Rules: v1 continua criando e respondendo sem campos v2', async () => {
    const c = { ...confirmation, token: 'legacy-fixture', assignmentKey: 'legacy-key' };
    for (const field of Object.keys(identity)) delete c[field];
    const ref = doc(admin, 'confirmacoes_publicas/legacy-fixture');
    await assertSucceeds(setDoc(ref, c));
    await assertSucceeds(updateDoc(doc(anon, 'confirmacoes_publicas/legacy-fixture'), { status: 'nao_pode' }));
});
test('E6 Rules: criação v2 incompleta/versão desconhecida recusada', async () => {
    const broken = { ...confirmation, token: 'broken' }; delete broken.grupoId;
    await assertFails(setDoc(doc(admin, 'confirmacoes_publicas/broken'), broken));
    await assertFails(setDoc(doc(admin, 'confirmacoes_publicas/broken'), { ...confirmation, identityVersion: 3 }));
});
test('E6 Rules: cliente antigo não degrada programação nem remove campos desconhecidos', async () => {
    await assertFails(setDoc(prog(admin), { id: program.id, partes: [] }));
    await assertFails(updateDoc(prog(admin), { grupoId: 'grupo-portugues' }));
    const broken = structuredClone(program); delete broken.fimDeSemana.privadoDesconhecido;
    await assertFails(setDoc(prog(admin), broken));
    await assertSucceeds(updateDoc(prog(admin), { publicadaNoQuadro: true }));
});
test('E6 Rules: configuração v2 e grupo legado não podem ser degradados', async () => {
    const ref = doc(admin, `users/${owner}/configuracoes/geral`);
    await assertFails(setDoc(ref, { idioma: 'pt' }));
    await assertFails(updateDoc(ref, { grupoLegadoId: 'grupo-espanhol' }));
    await assertSucceeds(updateDoc(ref, { grupoPrincipalId: 'grupo-espanhol' }));
});
test('E6 Rules: cadastro antigo não apaga participação/habilitações explícitas', async () => {
    const ref = doc(admin, `users/${owner}/alunos/fixture-pessoa`);
    await assertFails(setDoc(ref, { nome: 'Renomeado' }));
    await assertSucceeds(updateDoc(ref, { nome: 'Renomeado' }));
});
test('E6 Rules: confirmação pública não admite listagem, status estranho ou exclusão anônima', async () => {
    await assertFails(getDocs(collection(anon, 'confirmacoes_publicas')));
    await assertFails(updateDoc(pub(anon), { status: 'qualquer' }));
    await assertFails(deleteDoc(pub(anon)));
});
test('E6 Rules: alerta público deve corresponder à identidade e ao dono da confirmação', async () => {
    await assertSucceeds(updateDoc(pub(admin), { status: 'confirmado', previousStatus: 'pendente', lastStatusChangeKey: 'fixture-change' }));
    const id = 'fixture-token_confirmacao_status_fixture-change';
    const notification = { id, ownerUid: owner, token: 'fixture-token', assignmentKey: key, dataISO: confirmation.dataISO, semana: confirmation.semana,
        pessoaNome: confirmation.pessoaNome, type: 'confirmacao_status', title: 'Resposta fictícia', description: 'Fixture', status: 'confirmado', previousStatus: 'pendente',
        meta: { ...identity, tituloParte: confirmation.tituloParte, congregacaoNome: '' }, readAt: null, readAtIso: null, createdAt: serverTimestamp(), createdAtIso: '2099-01-01T00:00:00Z' };
    const ref = doc(anon, 'notificacoes/' + id);
    await assertFails(setDoc(ref, { ...notification, meta: { ...notification.meta, grupoId: 'grupo-portugues' } }));
    await assertFails(setDoc(ref, { ...notification, ownerUid: 'outro' }));
    await assertSucceeds(setDoc(ref, notification));
    await assertFails(getDoc(ref));
});
test('E6 Rules: novo programa v2 exige atividade e publicação explícitas', async () => {
    const ref = doc(admin, `users/${owner}/programacao/new-fixture`);
    await assertFails(setDoc(ref, { id: 'new-fixture', versaoProgramacao: 2, grupoId: 'grupo-espanhol' }));
    await assertSucceeds(setDoc(ref, { ...program, id: 'new-fixture' }));
});
test('E6 Rules: ocorrência retirada da projeção não pode receber resposta pública v2', async () => {
    await assertSucceeds(updateDoc(doc(admin, 'quadros_publicos/' + owner), { configuracoes: { destinosConfirmacao: {} } }));
    await assertFails(updateDoc(pub(anon), { status: 'nao_pode' }));
    await assertFails(updateDoc(priv(anon), { status: 'nao_pode' }));
});
test('E7 Rules: duas sessões e reconexão não permitem sobrescrita degradada em fila offline', async () => {
    const antiga = env.authenticatedContext(owner, { email: 'fixture@local.invalid' }).firestore();
    const atual = env.authenticatedContext(owner, { email: 'fixture@local.invalid' }).firestore();
    await assertSucceeds(updateDoc(prog(atual), { marcadorDaAbaAtual: 'preservar', publicadaNoQuadro: true }));
    await disableNetwork(antiga);
    const queued = setDoc(prog(antiga), { id: program.id, partes: [], semana: 'Cliente antigo' })
        .then(() => ({ accepted: true }), error => ({ accepted: false, code: error.code }));
    await enableNetwork(antiga);
    const result = await queued;
    assert.equal(result.accepted, false); assert.equal(result.code, 'permission-denied');
    const saved = (await getDocFromServer(prog(atual))).data();
    assert.equal(saved.grupoId, 'grupo-espanhol'); assert.equal(saved.versaoProgramacao, 2);
    assert.equal(saved.marcadorDaAbaAtual, 'preservar');
    assert.equal(saved.fimDeSemana.privadoDesconhecido, 'preservar');
    await assertFails(deleteDoc(prog(antiga)));
});
