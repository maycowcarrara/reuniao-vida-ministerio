import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createDadosEnsaioReunioes } from '../src/data/ensaioGrupos.js';
import { prepararEnsaioMigracao, executarEnsaioMigracao, resumirEnsaio, verificarPreparacaoAtivacao } from '../src/utils/ensaioMigracaoGrupos.js';
import { criarFilaGrupo, planejarAgendaGrupo } from '../src/utils/integracoesGrupo.js';
import { projetarQuadroPublico } from '../src/utils/quadroPublico.js';
import { exigirEscritaCompativel } from '../src/utils/compatibilidadeGrupos.js';

test('E7: migração local preserva campos, IDs, cancelamentos, referências e participação simultânea', async () => {
    const d = createDadosEnsaioReunioes();
    d.alunos.push({ id: 'duas', gruposParticipantes: ['grupo-portugues', 'grupo-espanhol'], desconhecido: 'preservar', historico: [] });
    d.confirmacoes = [{ token: 'SEGREDO', assignmentKey: 'CHAVE', status: 'confirmado', sentChannels: { mail: 'antes' } }];
    d.historico_reunioes[0].metadado = { desconhecido: true };
    const before = structuredClone(d);
    const plano = await prepararEnsaioMigracao(d, { materializarParticipacao: true });
    const result = await executarEnsaioMigracao({ snapshot: d, plano });
    assert.deepEqual(d, before);
    assert.deepEqual(result.estado.confirmacoes, d.confirmacoes);
    assert.deepEqual(result.estado.alunos[1], d.alunos[1]);
    assert.deepEqual(result.estado.historico_reunioes.map(p => p.id), d.historico_reunioes.map(p => p.id));
    assert.deepEqual(result.estado.historico_reunioes[2], d.historico_reunioes[2]);
    assert.deepEqual(result.estado.historico_reunioes[0].metadado, { desconhecido: true });
    assert.deepEqual(result.estado.alunos[0].gruposParticipantes, ['grupo-portugues']);
});
test('E7: ensaio interrompe/retoma e é idempotente; checkpoint ou plano adulterado recusado', async () => {
    const d = createDadosEnsaioReunioes(); const plano = await prepararEnsaioMigracao(d, { materializarParticipacao: true });
    const one = await executarEnsaioMigracao({ snapshot: d, plano, pararDepois: 1 }); assert.equal(one.completo, false);
    const resumed = await executarEnsaioMigracao({ snapshot: one.estado, plano, checkpoint: one.checkpoint });
    assert.equal(resumed.completo, true);
    assert.equal((await prepararEnsaioMigracao(resumed.estado, { materializarParticipacao: true })).passos.length, 0);
    const again = await executarEnsaioMigracao({ snapshot: resumed.estado, plano, checkpoint: resumed.checkpoint });
    assert.deepEqual(again.estado, resumed.estado);
    await assert.rejects(executarEnsaioMigracao({ snapshot: d, plano: { ...plano, passos: [] } }), /adulterado/);
    await assert.rejects(executarEnsaioMigracao({ snapshot: d, plano, checkpoint: { planHash: 'outro', concluidos: [] } }), /outro plano/);
});
test('E7: conflito de origem e edição concorrente recusados sem sobrescrever', async () => {
    const d = createDadosEnsaioReunioes(), plano = await prepararEnsaioMigracao(d);
    const changed = structuredClone(d); changed.historico_reunioes[0].fixtureDesconhecida = 'mudou';
    await assert.rejects(executarEnsaioMigracao({ snapshot: changed, plano }), /Exportação mudou/);
    const one = await executarEnsaioMigracao({ snapshot: d, plano, pararDepois: 0 });
    one.estado.historico_reunioes[0].fixtureDesconhecida = 'concorrente';
    await assert.rejects(executarEnsaioMigracao({ snapshot: one.estado, plano, checkpoint: one.checkpoint }), /Conflito/);
    assert.equal(one.estado.historico_reunioes[0].fixtureDesconhecida, 'concorrente');
});
for (const [codigo, alterar] of [
    ['origem_legada_ambigua', d => d.configuracoes = { idioma: 'es' }],
    ['programacao_id_ausente_duplicado', d => d.historico_reunioes.push(d.historico_reunioes[0])],
    ['agenda_sem_inventario', d => d.historico_reunioes[0].agendaSincronizadaEm = 'antes'],
    ['data_legada_exige_revisao', d => delete d.historico_reunioes[0].dataReuniao],
    ['token_com_destinos_distintos', d => d.confirmacoes = [{ token: 'igual', assignmentKey: 'a' }, { token: 'igual', assignmentKey: 'b' }]],
]) test(`E7: inventário bloqueia ${codigo}, sem tentar adivinhar vínculos`, async () => {
    const d = createDadosEnsaioReunioes(); alterar(d);
    const plano = await prepararEnsaioMigracao(d);
    assert.ok(plano.erros.includes(codigo)); assert.equal(plano.aplicavelLocalmente, false);
    await assert.rejects(executarEnsaioMigracao({ snapshot: d, plano }), /bloqueios/);
});
test('E7: relatório não expõe contatos/tokens e mantém histórico ambíguo intacto', async () => {
    const d = createDadosEnsaioReunioes(); d.alunos[0].email = 'EMAIL_PRIVADO'; d.alunos[0].historico = [{ parte: 'presidente', data: '2026-11-02' }];
    d.confirmacoes = [{ assignmentKey: 'chave', token: 'TOKEN_PRIVADO' }];
    const plano = await prepararEnsaioMigracao(d);
    const report = JSON.stringify(resumirEnsaio(plano));
    assert.doesNotMatch(report, /EMAIL_PRIVADO|TOKEN_PRIVADO/);
    assert.ok(plano.avisos.includes('historico_ambiguo_preservado'));
    const result = await executarEnsaioMigracao({ snapshot: d, plano });
    assert.deepEqual(result.estado.alunos[0].historico, d.alunos[0].historico);
});
test('E7: publicação, filas e agenda preservadas após materializar legado; nada publicado por migrar', async () => {
    const d = createDadosEnsaioReunioes();
    const pt = d.historico_reunioes[0]; pt.presidente = { id: 'fixture', nome: 'Pessoa' }; pt.publicadaNoQuadro = true;
    const before = criarFilaGrupo({ programacoes: d.historico_reunioes, config: d.configuracoes, grupoId: 'grupo-portugues' });
    const old = { ...before[0].confirmation, assignmentKey: '2026-11-02|2-8 de novembro de 2026|presidente|fixture|presidente', token: 'legado', identityVersion: 1 };
    const plano = await prepararEnsaioMigracao(d);
    const migrated = (await executarEnsaioMigracao({ snapshot: d, plano })).estado;
    const after = criarFilaGrupo({ programacoes: migrated.historico_reunioes, config: migrated.configuracoes, grupoId: 'grupo-portugues', confirmacoes: [old] });
    assert.equal(after[0].confirmation.token, 'legado');
    assert.equal(projetarQuadroPublico(migrated).historico_reunioes.length, 1);
    const [event] = await planejarAgendaGrupo({ programacoes: d.historico_reunioes, config: d.configuracoes, grupoId: 'grupo-portugues' });
    const [kept] = await planejarAgendaGrupo({ programacoes: migrated.historico_reunioes, config: migrated.configuracoes, grupoId: 'grupo-portugues', vinculos: [{ ...event.identity, identityVersion: 1, eventId: event.id }] });
    assert.equal(kept.id, event.id);
});
test('E7: ausência de evidência ou autorização bloqueia prontidão de ativação', () => {
    const report = verificarPreparacaoAtivacao({ regressaoIntegrada: true, rulesEmulador: true });
    assert.equal(report.prontoParaAtivar, false); assert.ok(report.pendencias.includes('autorizacaoSuperficies'));
    assert.ok(report.pendencias.includes('adaptadoresRemotosRevisados'));
});
test('E7: escritor real legado continua possível; v2 exige atualização e ativação explícitas', () => {
    assert.doesNotThrow(() => exigirEscritaCompativel({ idioma: 'pt' }, { id: 'legado' }));
    assert.throws(() => exigirEscritaCompativel({ versaoProgramacao: 2 }), error => error.code === 'client-update-required' && /Versão do Sistema/.test(error.message));
    assert.throws(() => exigirEscritaCompativel({}, { grupoId: 'grupo-espanhol' }), /protegida/);
});
test('E7: CLI não sobrescreve seu export de entrada e não aceita modo remoto', async () => {
    const folder = await mkdtemp('tmp/e7-cli-');
    const path = resolve(folder, 'export-fixture.json');
    const content = JSON.stringify(createDadosEnsaioReunioes());
    await writeFile(path, content);
    const cmd = 'scripts/ensaio-multi-idiomas-e7.mjs';
    const same = spawnSync(process.execPath, [cmd, '--input', path, '--output', path], { encoding: 'utf8' });
    assert.notEqual(same.status, 0); assert.match(same.stderr, /não pode substituir/);
    assert.equal(await readFile(path, 'utf8'), content);
    assert.notEqual(spawnSync(process.execPath, [cmd, '--execute', 'true']).status, 0);
});
test('E7: atualização explícita preserva precache novo; recuperação de asset mantém limpeza', async () => {
    const oldWindow = globalThis.window;
    const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const removidos = [], destinos = [], comandos = [];
    const waiting = new EventTarget();
    waiting.state = 'installed';
    waiting.postMessage = m => { comandos.push(m.type); waiting.state = 'activated'; waiting.dispatchEvent(new Event('statechange')); };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: {
        getRegistrations: async () => [{ active: { state: 'activated' }, update: async () => comandos.push('update'), waiting }],
        addEventListener: (_event, callback) => callback(),
    } } });
    globalThis.window = { location: { href: 'http://127.0.0.1/admin', replace: url => destinos.push(url) },
        fetch: async () => ({ ok: true, json: async () => ({ version: 'fixture-B', entry: '/assets/fixture-B.js' }) }),
        navigator: globalThis.navigator, caches: { keys: async () => ['workbox-precache-v2'], delete: async key => removidos.push(key) },
        setTimeout: fn => { queueMicrotask(fn); return 1; }, clearTimeout: () => {}, sessionStorage: { getItem: () => null, setItem: () => {} } };
    try {
        const updater = await import('../src/services/appUpdater.js');
        await updater.refreshAppVersion('fixture-B');
        assert.deepEqual(removidos, []); assert.deepEqual(comandos, ['update', 'SKIP_WAITING']);
        assert.match(destinos[0], /appv=fixture-B/);
        await updater.reloadAppWithCacheBust('teste-fixture');
        assert.deepEqual(removidos, ['workbox-precache-v2']); assert.match(destinos[1], /assetReload=/);
    } finally {
        if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
        if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
    }
});
