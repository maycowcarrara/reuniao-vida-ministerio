import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { before, after, test } from 'node:test';
import { garantirParConfirmacao, registrarCanalConfirmacao } from '../src/services/confirmacoesGrupoFirestore.js';
import { criarFilaGrupo } from '../src/utils/integracoesGrupo.js';
import { createRemoteGroupAdapter } from '../src/services/adaptadorGruposFirestore.js';
import { normalizeGruposProgramacao } from '../src/utils/gruposProgramacao.js';
const require = createRequire(new URL('../tmp/e6-rules-runtime/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const sdk = require('firebase/firestore');
const { doc, setDoc, getDoc, updateDoc, deleteDoc } = sdk;
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8186') throw new Error('Somente emulador.');
const owner = 'fixture-owner';
let env, db, estado, adapter;
const configRef = () => doc(db, `users/${owner}/configuracoes/geral`);
const programRef = id => doc(db, `users/${owner}/programacao/${id}`);
const base = { id: 'pt-1', versaoProgramacao: 2, grupoId: 'grupo-portugues', publicadaNoQuadro: true,
    semana: '2-8 de novembro de 2026', dataReuniao: '2026-11-05', meioSemana: { ativo: true, data: '2026-11-05', horario: '19:30' },
    fimDeSemana: { ativo: false }, partes: [], privado: 'preservar', identidadeLegada: { versao: 1, partes: {} } };
before(async () => {
    const rules = (await readFile('firestore.rules', 'utf8')).replaceAll('P8B0fY6m8JVjoLFGZEcXQ1uWsWs2', owner);
    env = await initializeTestEnvironment({ projectId: 'demo-rvm-multi-e6', firestore: { host: '127.0.0.1', port: 8186, rules } });
    await env.clearFirestore();
    db = env.authenticatedContext(owner, { email: 'fixture@local.invalid' }).firestore();
    estado = { configuracoes: normalizeGruposProgramacao({ idioma: 'pt', versaoProgramacao: 2, grupoLegadoId: 'grupo-portugues', revisionProgramacoes: 0,
        ativacaoMultiGrupos: { contrato: 2, status: 'ativa' } }), historico_reunioes: [base], alunos: [] };
    await env.withSecurityRulesDisabled(async ctx => { const b = ctx.firestore();
        await setDoc(doc(b, configRef().path), estado.configuracoes); await setDoc(doc(b, programRef(base.id).path), base);
    });
    adapter = createRemoteGroupAdapter({ db, getOwnerUid: () => owner, getEstado: () => estado, sdk });
});
after(async () => { await env?.cleanup(); });
const refresh = async () => { estado.configuracoes = (await getDoc(configRef())).data(); };
test('Ativação: escritor antigo e downgrade da ativação são recusados', async () => {
    await assertFails(updateDoc(programRef(base.id), { publicadaNoQuadro: false }));
    await assertFails(deleteDoc(programRef(base.id)));
    await assertFails(updateDoc(configRef(), { 'ativacaoMultiGrupos.status': 'preparada' }));
});
test('Ativação: lote transacional preserva campos e incrementa revisão', async () => {
    const next = { ...base, publicadaNoQuadro: false };
    await adapter.salvarLote({ grupoId: base.grupoId, upserts: [next], excluirIds: [], anteriores: [base] });
    assert.deepEqual((await getDoc(programRef(base.id))).data(), next);
    await refresh(); assert.equal(estado.configuracoes.revisionProgramacoes, 1);
    // Segunda sessão com snapshot anterior não sobrescreve o destino.
    await assert.rejects(adapter.salvarLote({ grupoId: base.grupoId, upserts: [base], excluirIds: [], anteriores: [base] }), /outra sessão/);
    estado.historico_reunioes = [next];
});
test('Ativação: identidade legada imutável e grupo incorreto recusados', async () => {
    const old = estado.historico_reunioes[0];
    await assert.rejects(adapter.salvarLote({ grupoId: base.grupoId, upserts: [{ ...old, identidadeLegada: {} }], excluirIds: [], anteriores: [old] }));
    await assert.rejects(adapter.salvarLote({ grupoId: 'grupo-espanhol', upserts: [], excluirIds: [base.id], anteriores: [old] }), /outro grupo/);
});
test('Ativação: criação ES, configuração e publicação completa usam adaptador real', async () => {
    const es = { ...base, id: 'es-1', grupoId: 'grupo-espanhol', meioSemana: { ativo: false }, fimDeSemana: { ativo: true, data: '2026-11-08', horario: '10:00' } };
    delete es.identidadeLegada;
    await adapter.salvarLote({ grupoId: es.grupoId, upserts: [es], excluirIds: [], anteriores: [] }); await refresh();
    estado.historico_reunioes.push(es);
    await adapter.salvarConfig({ ...estado.configuracoes, grupoPrincipalId: es.grupoId }); await refresh();
    await adapter.publicar();
    const board = (await getDoc(doc(db, `quadros_publicos/${owner}`))).data();
    assert.equal(board.configuracoes.revisionProgramacoes, 3);
    assert.equal(board.configuracoes.ativacaoMultiGrupos, undefined);
    assert.equal(board.historico_reunioes.some(p => p.id === 'es-1'), true);
    await assertFails(setDoc(doc(db, `quadros_publicos/${owner}`), { ...board, configuracoes: { ...board.configuracoes, privado: 'vazar' } }));
});
test('Ativação: exclusão exata não toca outro grupo e marcador não pode ser reutilizado', async () => {
    const old = estado.historico_reunioes.find(p => p.id === base.id);
    await adapter.salvarLote({ grupoId: base.grupoId, upserts: [], excluirIds: [base.id], anteriores: [old] });
    assert.equal((await getDoc(programRef(base.id))).exists(), false);
    assert.equal((await getDoc(programRef('es-1'))).exists(), true);
    await assertFails(deleteDoc(programRef('es-1')));
});

test('Ativação: confirmações v2 são atômicas, reusam token e preservam respostas/canais', async () => {
    const es = { ...(await getDoc(programRef('es-1'))).data(), fimDeSemana: { ativo: true, data: '2026-11-08', horario: '10:00', presidente: { id: 'pessoa-1', nome: 'Fictício' } } };
    estado.historico_reunioes = [es]; await refresh();
    const before = (await getDoc(programRef('es-1'))).data();
    await adapter.salvarLote({ grupoId: es.grupoId, upserts: [es], excluirIds: [], anteriores: [before] }); await refresh();
    const row = criarFilaGrupo({ programacoes: [es], config: estado.configuracoes, grupoId: es.grupoId })[0];
    const input = { db, sdk, ownerUid: owner, safeKey: row.assignmentKey, candidate: 'token-v2-fixture', dados: row.confirmation };
    const c = await garantirParConfirmacao(input); assert.equal(c.token, input.candidate);
    const pubRef = doc(db, 'confirmacoes_publicas', c.token), privRef = doc(db, `users/${owner}/confirmacoes`, row.assignmentKey);
    await updateDoc(pubRef, { status: 'confirmado', responseHistory: [{ status: 'confirmado' }], sentChannels: { mail: '2026-10-24' } });
    await garantirParConfirmacao({ ...input, candidate: 'never-regenerate' });
    const publicData = (await getDoc(pubRef)).data(), privateData = (await getDoc(privRef)).data();
    assert.equal(privateData.token, c.token); assert.equal(publicData.status, 'confirmado');
    assert.deepEqual(privateData.responseHistory, publicData.responseHistory); assert.deepEqual(privateData.sentChannels, { mail: '2026-10-24' });
    // Outro grupo/identidade e slot removido não podem materializar confirmação.
    await assert.rejects(garantirParConfirmacao({ ...input, dados: { ...row.confirmation, grupoId: 'grupo-portugues' } }), /divergente/);
    await adapter.salvarLote({ grupoId: es.grupoId, upserts: [{ ...es, fimDeSemana: { ...es.fimDeSemana, presidente: null } }], excluirIds: [], anteriores: [es] });
    await assert.rejects(garantirParConfirmacao(input), /designação mudou/);
});

test('Ativação: histórico exige escopo atual, conserva outros campos e rejeita snapshot concorrente', async () => {
    const personRef = doc(db, `users/${owner}/alunos/fixture-history`);
    const oldHistory = [{ grupoId: 'grupo-portugues', programacaoId: 'old', nota: 'preservar' }];
    await setDoc(personRef, { nome: 'Fictício', privado: 'preservar', historico: oldHistory });
    estado.alunos = [{ id: 'fixture-history', nome: 'Fictício', historico: oldHistory }];
    estado.historico_reunioes = [{ ...(await getDoc(programRef('es-1'))).data(), id: 'es-1' }]; await refresh();
    const next = [...oldHistory, { grupoId: 'grupo-espanhol', programacaoId: 'es-1', tipoReuniao: 'fimDeSemana', slotId: 'presidente', papel: 'presidente_fds' }];
    const input = [{ ...estado.alunos[0], historico: next }];
    await assert.rejects(adapter.salvarHistoricos(input, { grupoId: 'grupo-portugues', programacaoIds: ['es-1'] }), /Programação mudou/);
    await adapter.salvarHistoricos(input, { grupoId: 'grupo-espanhol', programacaoIds: ['es-1'] });
    assert.equal((await getDoc(personRef)).data().privado, 'preservar');
    assert.deepEqual((await getDoc(personRef)).data().historico, next);
    await assert.rejects(adapter.salvarHistoricos(input, { grupoId: 'grupo-espanhol', programacaoIds: ['es-1'] }), /Histórico mudou/);
});

test('Ativação: canais concorrentes são atômicos e lembrete não apaga resposta', async () => {
    const pub = doc(db, 'confirmacoes_publicas/token-v2-fixture');
    const data = (await getDoc(pub)).data();
    await updateDoc(pub, { weekReminderStatus: 'confirmado' });
    const input = { db, sdk, ownerUid: owner, assignmentKey: data.assignmentKey };
    for (let i = 0; i < 5; i++) await Promise.all([registrarCanalConfirmacao({ ...input, channel: 'wa' }), registrarCanalConfirmacao({ ...input, channel: 'mail' })]);
    await registrarCanalConfirmacao({ ...input, channel: 'waReminder', lembrete: true });
    const current = (await getDoc(pub)).data();
    assert.equal(current.weekReminderStatus, 'confirmado');
    assert.deepEqual(Object.keys(current.sentChannels).sort(), ['mail', 'wa', 'waReminder']);
    assert.deepEqual((await getDoc(doc(db, `users/${owner}/confirmacoes`, data.assignmentKey))).data().sentChannels, current.sentChannels);
});
