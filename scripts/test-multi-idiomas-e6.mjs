import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createDadosEnsaioGrupos, lerDadosSessaoEnsaio, guardarDadosSessaoEnsaio } from '../src/data/ensaioGrupos.js';
import { assignmentIdentity, buildAssignmentKey, buildLegacyAssignmentKey, calendarEventId } from '../src/utils/assignmentIdentity.js';
import { criarFilaGrupo, resolverConfirmacaoGrupo, planejarAgendaGrupo, sincronizarAgendaSimulada, removerEventoSimulado, legacyKeyFromDesignacao, lerAgendaGrupo, salvarAgendaGrupo, destinoNotificacao } from '../src/utils/integracoesGrupo.js';
import { selecionarDesignacoes, reconstruirHistoricoGrupo } from '../src/utils/designacoesPorGrupo.js';
import { createIntegracoesLocais } from '../src/services/integracoesLocais.js';
const PT = 'grupo-portugues', ES = 'grupo-espanhol';
const fixture = () => {
    const d = createDadosEnsaioGrupos();
    for (const p of d.historico_reunioes) {
        p.publicadaNoQuadro = true;
        if (p.grupoId === ES) p.fimDeSemana.presidente = { id: 'pessoa-fixture-001', nome: 'Pessoa de ensaio' };
        else p.presidente = { id: 'pessoa-fixture-001', nome: 'Pessoa de ensaio' };
    }
    return d;
};
const rows = (d, grupoId = ES, confirmacoes = []) => criarFilaGrupo({ programacoes: d.historico_reunioes, config: d.configuracoes, grupoId, confirmacoes });
const confirm = d => ({ ...rows(d)[0].confirmation, ownerUid: 'fixture-owner', token: 'fixture-token' });
const identity = () => assignmentIdentity({ grupoId: ES, programacaoId: 'prog/|á', tipoReuniao: 'fimDeSemana', slotId: '["a/b"]', pessoaId: 'pessoa/á', papel: 'presidente' });
test('E6: chave central v1 permanece byte a byte, inclusive caracteres e campos vazios', () => {
    const data = { dataISO: '2026-11-01', semana: 'Semana / igual', parteId: 'parte', pessoaId: 'id', role: 'resp' };
    assert.equal(buildAssignmentKey(data), '2026-11-01|Semana / igual|parte|id|resp');
    assert.equal(buildAssignmentKey({}), '||||');
});
test('E6: identidade v2 determinística, segura para documento, sem colisão de delimitadores', () => {
    const id = identity(); const key = buildAssignmentKey(id);
    assert.equal(key, buildAssignmentKey({ ...id })); assert.match(key, /^v2-[0-9a-f]+$/);
    assert.notEqual(key, buildAssignmentKey({ ...id, grupoId: PT }));
    assert.notEqual(buildAssignmentKey({ ...id, slotId: 'a|b', papel: 'c' }), buildAssignmentKey({ ...id, slotId: 'a', papel: 'b|c' }));
    assert.throws(() => buildAssignmentKey({ ...id, slotId: '' }), /incompleta/);
    assert.throws(() => buildAssignmentKey({ ...id, slotId: 'a'.repeat(900) }), /limite/);
});
test('E6: agenda distingue grupo/programa/tipo/slot e mantém ID ao substituir pessoa', async () => {
    const id = identity(); const eventId = await calendarEventId(id);
    assert.match(eventId, /^[a-v0-9]+$/);
    assert.equal(await calendarEventId({ ...id, pessoaId: 'substituto' }), eventId);
    for (const patch of [{ grupoId: PT }, { programacaoId: 'outra' }, { tipoReuniao: 'meioSemana' }, { slotId: 'outro' }]) assert.notEqual(await calendarEventId({ ...id, ...patch }), eventId);
});
test('E6: fila ES captura idioma/destino; mudança de preferência não muda prévia', () => {
    const d = fixture(); const fila = rows(d);
    d.configuracoes.idioma = 'pt'; d.configuracoes.grupoPrincipalId = PT;
    assert.equal(fila.length, 1); assert.equal(fila[0].lang, 'es'); assert.match(fila[0].preview, /tu asignación/);
    assert.equal(fila[0].grupoId, ES); assert.notEqual(fila[0].assignmentKey, rows(d, PT)[0].assignmentKey);
});
for (const [name, patch] of [
    ['cancelamento', d => d.historico_reunioes[1].fimDeSemana.cancelada = true],
    ['inatividade', d => d.historico_reunioes[1].fimDeSemana.ativo = false],
    ['arquivamento', d => d.historico_reunioes[1].arquivada = true],
    ['tipo desabilitado', d => d.configuracoes.grupos[ES].fimDeSemana.habilitada = false],
    ['grupo inativo', d => d.configuracoes.grupos[ES].ativo = false],
]) test(`E6: ${name} retira da fila e torna token indisponível sem fallback PT`, () => {
    const d = fixture(); const c = confirm(d); patch(d);
    assert.deepEqual(rows(d), []);
    assert.equal(resolverConfirmacaoGrupo({ confirmacao: c, programacoes: d.historico_reunioes, config: d.configuracoes }).isUnavailable, true);
    assert.equal(rows(d, PT).length, 1);
});
test('E6: v2 não resolve outro programa com mesma data/título/pessoa; adulteração recusada', () => {
    const d = fixture(), c = confirm(d);
    const check = () => resolverConfirmacaoGrupo({ confirmacao: c, programacoes: d.historico_reunioes, config: d.configuracoes });
    assert.equal(check().isUnavailable, false);
    d.historico_reunioes[1].id = 'outro-id'; assert.equal(check().isUnavailable, true);
    c.programacaoId = 'outro-id'; assert.equal(check().unavailableReason, 'identity_conflict');
});
test('E6: v1 reutiliza chave/token/status/históricos/checks e só pertence ao grupo legado fixo', () => {
    const d = fixture();
    const item = selecionarDesignacoes({ programacoes: d.historico_reunioes, config: d.configuracoes }).find(i => i.grupoId === PT);
    const legacy = { assignmentKey: legacyKeyFromDesignacao(item), token: 'ANTIGO', ownerUid: 'fixture-owner', semana: item.programacao.semana,
        status: 'nao_pode', weekReminderStatus: 'imprevisto', responseHistory: [{ status: 'nao_pode' }], sentChannels: { mail: 'antes' } };
    const row = rows(d, PT, [legacy])[0];
    assert.deepEqual(row.confirmation, legacy); assert.equal(row.assignmentKey, legacy.assignmentKey);
    d.configuracoes.grupoPrincipalId = ES;
    assert.equal(resolverConfirmacaoGrupo({ confirmacao: legacy, programacoes: d.historico_reunioes, config: d.configuracoes }).isUnavailable, false);
    assert.notEqual(rows(d, ES, [legacy])[0].assignmentKey, legacy.assignmentKey);
    d.historico_reunioes = d.historico_reunioes.filter(p => p.grupoId === ES);
    assert.equal(resolverConfirmacaoGrupo({ confirmacao: legacy, programacoes: d.historico_reunioes, config: d.configuracoes }).isUnavailable, true);
});
test('E6: duas confirmações do mesmo alvo produzem conflito, sem escolher uma silenciosamente', () => {
    const d = fixture(); const c = confirm(d);
    assert.throws(() => rows(d, ES, [c, { ...c, token: 'outro' }]), /Conflito/);
});
test('E6: simulador preserva resposta inicial, lembrete e checks de canais separadamente', () => {
    const d = fixture(); const engine = createIntegracoesLocais({ getEstado: () => d, now: () => '2099-01-01T00:00:00Z' });
    const row = rows(d)[0]; const c = engine.ensure(row.confirmation);
    engine.channel(c.assignmentKey, 'mail'); engine.update(c.token, 'primary', 'confirmado');
    engine.channel(c.assignmentKey, 'waReminder'); engine.update(c.token, 'week', 'imprevisto');
    const result = engine.ensure(row.confirmation);
    assert.equal(result.token, c.token); assert.equal(result.status, 'confirmado'); assert.equal(result.weekReminderStatus, 'imprevisto');
    assert.equal(result.responseHistory.length, 1); assert.equal(result.weekReminderHistory.length, 1);
    assert.deepEqual(Object.keys(result.sentChannels), ['mail', 'waReminder']);
    assert.equal(engine.snapshot().confirmacoes.length, 1);
    assert.deepEqual(destinoNotificacao(engine.snapshot().notificacoes[0], d.configuracoes), { grupoId: ES, programacaoId: row.programacaoId, tipoReuniao: 'fimDeSemana' });
    d.historico_reunioes[1].fimDeSemana.cancelada = true;
    assert.throws(() => engine.update(c.token, 'primary', 'nao_pode'), /indisponível/);
    assert.equal(engine.snapshot().confirmacoes[0].status, 'confirmado');
});
test('E6: histórico novo usa identidade compartilhada; reconstrução ES preserva PT e metadados legados', () => {
    const d = fixture(); d.alunos[0].historico = [{ data: '2026-11-08', parte: 'presidente', legado: 'preservar' }];
    const next = reconstruirHistoricoGrupo({ alunos: d.alunos, programacoes: d.historico_reunioes, config: d.configuracoes, grupoId: ES, programacaoIds: [d.historico_reunioes[1].id], tipos: ['fimDeSemana'] });
    assert.equal(next[0].historico.length, 2);
    assert.equal(next[0].historico[1].assignmentKey, rows(d)[0].assignmentKey);
    assert.equal(next[0].historico[0].legado, 'preservar');
});
test('E6: agenda ES isolada tem horário explícito; vínculo antigo mantém ID', async () => {
    const d = fixture(); const request = { programacoes: d.historico_reunioes, config: d.configuracoes, grupoId: ES };
    const [event] = await planejarAgendaGrupo(request);
    assert.equal(event.horario, '09:30'); assert.equal(event.data, '2026-11-08'); assert.equal(event.identity.tipoReuniao, 'fimDeSemana');
    assert.equal(new Date(event.start.dateTime).getHours(), 9); assert.equal(new Date(event.start.dateTime).getMinutes(), 30);
    assert.equal((Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime)) / 60000, 105);
    const [legacy] = await planejarAgendaGrupo({ ...request, grupoId: PT });
    assert.equal(legacy.id, 'rvm20261102presidente');
    const legacyBinding = { ...legacy.identity, identityVersion: 1, eventId: 'rvm20261102presidente' };
    const [kept] = await planejarAgendaGrupo({ ...request, grupoId: PT, vinculos: [legacyBinding] }); assert.equal(kept.id, legacyBinding.eventId);
    d.historico_reunioes[0] = { ...d.historico_reunioes[0], grupoId: PT, versaoProgramacao: 2, meioSemana: { ativo: true }, agendaSincronizadaEm: 'antes' };
    await assert.rejects(planejarAgendaGrupo({ ...request, programacoes: d.historico_reunioes, grupoId: PT }), /inventário/);
});
test('E6: agenda simulada mantém PT ao atualizar/remover ES; falha parcial e conflito não sobrescrevem', async () => {
    const d = fixture(); const base = { programacoes: d.historico_reunioes, config: d.configuracoes };
    const es = await planejarAgendaGrupo({ ...base, grupoId: ES }); const pt = await planejarAgendaGrupo({ ...base, grupoId: PT });
    const engine = createIntegracoesLocais({ getEstado: () => d });
    assert.equal((await engine.syncCalendar({ eventos: [...pt, ...es], calendarId: 'shared' })).sucesso, true);
    const ptBefore = await engine.adapter.get('shared', pt[0].id);
    const bad = { ...es[0], id: pt[0].id };
    const result = await engine.syncCalendar({ eventos: [bad, es[0]], calendarId: 'shared' });
    assert.deepEqual(result.resultados.map(r => r.ok), [false, true]);
    assert.deepEqual(await engine.adapter.get('shared', pt[0].id), ptBefore);
    await assert.rejects(removerEventoSimulado({ evento: bad, adapter: engine.adapter, calendarId: 'shared' }), /não confere/);
    await removerEventoSimulado({ evento: es[0], adapter: engine.adapter, calendarId: 'shared' });
    assert.deepEqual(await engine.adapter.get('shared', pt[0].id), ptBefore);
    const failure = await sincronizarAgendaSimulada({ eventos: es, calendarId: 'x', adapter: { get: async () => { throw new Error('falha simulada'); } } });
    assert.equal(failure.sucesso, false); assert.match(failure.resultados[0].erro, /falha simulada/);
});
test('E6: preferência da agenda por dono/grupo; global antiga apenas no legado; storage opcional', () => {
    const d = fixture(); const values = new Map([['rvm_saved_calendar_id', 'antiga']]);
    const storage = { getItem: key => values.get(key), setItem: (k,v) => values.set(k,v) };
    assert.equal(lerAgendaGrupo(storage, 'a', PT, d.configuracoes), 'antiga'); assert.equal(lerAgendaGrupo(storage, 'a', ES, d.configuracoes), '');
    salvarAgendaGrupo(storage, 'a', ES, 'es'); assert.equal(lerAgendaGrupo(storage, 'a', ES, d.configuracoes), 'es');
    assert.equal(lerAgendaGrupo(storage, 'b', ES, d.configuracoes), '');
    assert.equal(lerAgendaGrupo({ getItem: () => { throw new Error(); } }, 'a', ES, d.configuracoes), '');
});
let server; after(async () => { await server?.close(); });
test('E6: SSR ensaio não expõe envio/OAuth reais e mantém fila ES', async () => {
    server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    const { default: Integracoes } = await server.ssrLoadModule('/src/components/IntegracoesGrupo.jsx');
    const d = fixture();
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Integracoes, { config: d.configuracoes, grupoId: ES, programacoes: d.historico_reunioes, confirmacoes: [] })));
    assert.match(html, /Integraciones simuladas/); assert.match(html, /tu asignación/); assert.doesNotMatch(html, /accounts.google|api.whatsapp|mailto:/);
});
test('E6: escritor Agenda legado preserva IDs e aceita fim de semana sem partes de meio de semana (fetch simulado)', async () => {
    const { enviarEventosParaAgenda } = await server.ssrLoadModule('/src/services/calendarSync.js');
    const d = fixture(); const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => { calls.push({ url, payload: JSON.parse(options.body) }); return { ok: true, status: 200 }; };
    try {
        const pt = d.historico_reunioes[0];
        const result = await enviarEventosParaAgenda('fixture-token', 'fixture-calendar', [{ ...pt, dataExata: pt.dataReuniao }], d.configuracoes);
        assert.equal(result.sucesso, true); assert.equal(calls[0].payload.id, 'rvm20261102presidente');
        calls.length = 0;
        const fim = { id: 'legado-fim', semana: 'Semana', meioSemana: { ativo: false }, fimDeSemana: { ativo: true, data: '2026-11-08', horario: '11:17', presidente: { id: 'p1', nome: 'Presidente' } } };
        const only = await enviarEventosParaAgenda('fixture-token', 'fixture-calendar', [fim], d.configuracoes);
        assert.equal(only.sucesso, true); assert.equal(calls.length, 1); assert.equal(calls[0].payload.id, 'rvmfds20261108presidentefds');
        assert.match(calls[0].payload.start.dateTime, /2026-11-08/);
        const date = new Date(calls[0].payload.start.dateTime); assert.equal(date.getHours(), 11); assert.equal(date.getMinutes(), 17);
        calls.length = 0;
        const blocked = await enviarEventosParaAgenda('fixture-token', 'fixture-calendar', [d.historico_reunioes[1]], d.configuracoes);
        assert.equal(blocked.sucesso, false); assert.equal(calls.length, 0);
    } finally { globalThis.fetch = originalFetch; }
});
test('E6: serviços de confirmação no ensaio usam apenas memória e guardam links/checks', async () => {
    const local = await createServer({ server: { middlewareMode: true }, appType: 'custom', define: { 'import.meta.env.VITE_MULTI_GRUPOS_LOCAL': JSON.stringify('true') } });
    try {
        const svc = await local.ssrLoadModule('/src/services/confirmacoesPublicas.js');
        const store = await local.ssrLoadModule('/src/services/integracoesLocais.js');
        const d = fixture(); store.atualizarContextoIntegracoesLocal(d);
        const c = await svc.ensurePublicConfirmation(rows(d)[0].confirmation);
        assert.match(c.token, /fixture-token/);
        await svc.registerNotificationChannelByAssignment(c.assignmentKey, 'mail');
        await svc.respondToPublicConfirmation(c.token, 'confirmado');
        await svc.registerConfirmationReminder(c.assignmentKey);
        await svc.respondToWeekReminderByAssignment(c.assignmentKey, 'imprevisto');
        const after = await svc.getPublicConfirmation(c.token);
        assert.equal(after.status, 'confirmado'); assert.equal(after.weekReminderStatus, 'imprevisto');
        assert.ok(after.sentChannels.mail); assert.ok(after.sentChannels.waReminder);
        d.historico_reunioes[1].fimDeSemana.cancelada = true;
        store.atualizarContextoIntegracoesLocal(d);
        assert.equal((await svc.getPublicConfirmation(c.token)).isUnavailable, true);
    } finally { await local.close(); }
});
test('E6: falha de transporte simulado não marca canal nem perde resposta/lembrete', async () => {
    const d = fixture(); const engine = createIntegracoesLocais({ getEstado: () => d });
    const data = rows(d)[0].confirmation;
    const c = engine.ensure(data); engine.update(c.token, 'primary', 'confirmado');
    await assert.rejects(engine.send({ data, channel: 'mail', transport: async () => ({ sucesso: false, erro: 'fixture failure' }) }), /fixture failure/);
    assert.deepEqual(engine.get(c.token).sentChannels, {});
    assert.equal(engine.get(c.token).status, 'confirmado');
    await engine.send({ data, channel: 'mail', transport: async () => ({ sucesso: true }) });
    assert.ok(engine.get(c.token).sentChannels.mail);
    assert.equal(engine.snapshot().confirmacoes.length, 1);
});
test('E6: legado com vários papéis na mesma parte mantém um evento por parte', async () => {
    const d = fixture(); d.historico_reunioes[0].partes = [{ id: 'parte-legada', secao: 'ministerio', titulo: 'Iniciando conversas', estudante: { id: 'p1', nome: 'Um' }, ajudante: { id: 'p2', nome: 'Dois' } }];
    const planned = await planejarAgendaGrupo({ programacoes: d.historico_reunioes, config: d.configuracoes, grupoId: PT });
    assert.deepEqual(planned.map(p => p.id), ['rvm20261102presidente', 'rvm20261102parte0']);
});
test('E6: vínculo v1 sem data explícita usa dia configurado e nunca cria confirmação paralela', () => {
    const d = fixture(); const p = d.historico_reunioes[0]; delete p.dataReuniao;
    d.configuracoes.grupos[PT].meioSemana.dia = 'thursday';
    p.partes = [{ id: 0, titulo: 'Oração inicial', tipo: 'oracao_inicial', estudante: { id: 'p0', nome: 'Pessoa zero' } }];
    const item = selecionarDesignacoes({ programacoes: [p], config: d.configuracoes }).find(i => i.pessoa.id === 'p0');
    const key = buildLegacyAssignmentKey({ dataISO: '2026-11-05', semana: p.semana, parteId: 0, pessoaId: 'p0', role: 'oracao' });
    assert.equal(legacyKeyFromDesignacao(item, d.configuracoes), key);
    const legacy = { assignmentKey: key, ownerUid: 'fixture-owner', token: 'preservado', status: 'confirmado' };
    const found = rows(d, PT, [legacy]).find(r => r.pessoaId === 'p0');
    assert.equal(found.confirmation.token, 'preservado');
});
test('E6: retorno de rota local compartilha a sessão em memória, preservando fixtures-base puras', () => {
    const session = structuredClone(lerDadosSessaoEnsaio());
    session.historico_reunioes[0].presidente = { id: 'fixture', nome: 'Designação da sessão' };
    guardarDadosSessaoEnsaio(session);
    assert.equal(lerDadosSessaoEnsaio().historico_reunioes[0].presidente.nome, 'Designação da sessão');
    assert.equal(createDadosEnsaioGrupos().historico_reunioes[0].presidente, undefined);
});
