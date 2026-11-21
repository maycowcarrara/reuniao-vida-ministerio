import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validarEventoExistente, sincronizarAgendaGrupo } from '../src/services/agendaGrupos.js';
import { normalizeGruposProgramacao } from '../src/utils/gruposProgramacao.js';
import { planejarAgendaGrupo } from '../src/utils/integracoesGrupo.js';
const config = normalizeGruposProgramacao({ idioma: 'pt' });
const program = { id: 'pt-fixture', versaoProgramacao: 2, grupoId: 'grupo-portugues', publicadaNoQuadro: true,
    semana: 'Semana fictícia', meioSemana: { ativo: true, data: '2026-11-05', horario: '19:30' }, partes: [],
    presidente: { id: 'fixture', nome: 'Fictício' }, fimDeSemana: { ativo: false },
    identidadeLegada: { versao: 1, programacaoId: 'pt-fixture', dataMeioSemana: '2026-11-05', partes: {} } };
const args = { token: 'fake-test-token', calendarId: 'fixture-calendar', programacoes: [program], config, grupoId: 'grupo-portugues' };

function agendaFalsa(iniciais = []) {
    const eventos = new Map(iniciais.map(e => [e.id, structuredClone(e)]));
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
        const method = options.method || 'GET';
        calls.push({ url, method });
        const id = new URL(url).pathname.split('/').at(-1);
        const response = (status, data) => ({ status, ok: status < 400, json: async () => structuredClone(data) });
        if (method === 'GET') return response(eventos.has(id) ? 200 : 404, eventos.get(id) || {});
        const body = JSON.parse(options.body);
        if (method === 'POST') {
            if (eventos.has(body.id)) return response(409, {});
            eventos.set(body.id, { ...body, etag: 'created' });
            return response(200, eventos.get(body.id));
        }
        assert.equal(method, 'PATCH');
        assert.equal(options.headers['If-Match'], eventos.get(id).etag);
        eventos.set(id, { ...eventos.get(id), ...body, etag: 'updated' });
        return response(200, eventos.get(id));
    };
    return { eventos, calls, fetchImpl };
}

test('Agenda: segunda sincronização v2 recupera vínculos e atualiza data/pessoa sem duplicar', async () => {
    const nativa = { ...program }; delete nativa.identidadeLegada;
    const agenda = agendaFalsa();
    const primeira = await sincronizarAgendaGrupo({ ...args, programacoes: [nativa], fetchImpl: agenda.fetchImpl });
    assert.equal(primeira.sucesso, true);
    const [id] = agenda.eventos.keys();
    const alterada = { ...nativa, agendaSincronizadaEm: '2026-11-01T12:00:00Z',
        meioSemana: { ...nativa.meioSemana, data: '2026-11-04', horario: '20:00' },
        presidente: { id: 'substituto', nome: 'Novo presidente' } };
    agenda.calls.length = 0;
    const segunda = await sincronizarAgendaGrupo({ ...args, programacoes: [alterada], fetchImpl: agenda.fetchImpl });
    assert.equal(segunda.sucesso, true);
    assert.deepEqual(segunda.programacaoIdsSincronizadas, [nativa.id]);
    assert.equal(agenda.eventos.size, 1);
    assert.match(agenda.eventos.get(id).summary, /Novo presidente/);
    assert.equal(agenda.eventos.get(id).start.dateTime, new Date('2026-11-04T20:00:00').toISOString());
    assert.deepEqual(agenda.calls.map(c => c.method), ['GET', 'PATCH']);
    assert.equal(alterada.agendaSincronizadaEm, '2026-11-01T12:00:00Z');
});

test('Agenda: semana v2 já sincronizada permite preencher novo slot sem recriar os existentes', async () => {
    const nativa = { ...program }; delete nativa.identidadeLegada;
    const agenda = agendaFalsa();
    await sincronizarAgendaGrupo({ ...args, programacoes: [nativa], fetchImpl: agenda.fetchImpl });
    const alterada = { ...nativa, agendaSincronizadaEm: 'antes', partes: [
        { id: 'nova-parte', titulo: 'Discurso', tempo: 5, estudante: { id: 'outro', nome: 'Outro' } } ] };
    const result = await sincronizarAgendaGrupo({ ...args, programacoes: [alterada], fetchImpl: agenda.fetchImpl });
    assert.equal(result.sucesso, true);
    assert.equal(agenda.eventos.size, 2);
});

test('Agenda: ausência de vínculos ou identidade conflitante bloqueia antes de qualquer gravação', async () => {
    const nativa = { ...program, agendaSincronizadaEm: 'antes' }; delete nativa.identidadeLegada;
    const [evento] = await planejarAgendaGrupo({ ...args, programacoes: [{ ...nativa, agendaSincronizadaEm: null }] });
    for (const iniciais of [[], [{ ...evento, extendedProperties: { private: { rvmIdentity: 'outro-grupo' } } }]]) {
        const agenda = agendaFalsa(iniciais);
        await assert.rejects(sincronizarAgendaGrupo({ ...args, programacoes: [nativa], fetchImpl: agenda.fetchImpl }));
        assert.equal(agenda.calls.every(c => c.method === 'GET'), true);
        assert.deepEqual([...agenda.eventos.values()], iniciais);
    }
});

test('Agenda: vínculo recuperado continua sujeito ao ETag e falha não marca semana sincronizada', async () => {
    const nativa = { ...program, agendaSincronizadaEm: 'antes' }; delete nativa.identidadeLegada;
    const [evento] = await planejarAgendaGrupo({ ...args, programacoes: [{ ...nativa, agendaSincronizadaEm: null }] });
    const agenda = agendaFalsa([{ ...evento, etag: 'old' }]);
    const result = await sincronizarAgendaGrupo({ ...args, programacoes: [nativa], fetchImpl: (url, options = {}) =>
        options.method === 'PATCH' ? Promise.resolve({ ok: false, status: 412 }) : agenda.fetchImpl(url, options) });
    assert.equal(result.sucesso, false);
    assert.deepEqual(result.programacaoIdsSincronizadas, []);
    assert.equal(agenda.eventos.get(evento.id).etag, 'old');
});
test('Agenda: vínculo legado exige ID, data, grupo e origem exatos', async () => {
    const [evento] = await planejarAgendaGrupo(args);
    const atual = { id: evento.id, summary: '[RVM] Presidente', start: { dateTime: '2026-11-05T19:30:00-03:00' }, etag: 'old' };
    validarEventoExistente(evento, atual, args.grupoId);
    for (const changed of [{ ...atual, summary: 'Outro aplicativo' }, { ...atual, id: 'other' }, { ...atual, start: { date: '2026-11-06' } }]) assert.throws(() => validarEventoExistente(evento, changed, args.grupoId));
});
test('Agenda: PATCH condicionado preserva metadados e falha parcial não marca sucesso', async () => {
    const [evento] = await planejarAgendaGrupo(args), calls = [];
    const r = await sincronizarAgendaGrupo({ ...args, fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return options.method === 'PATCH' ? { ok: false, status: 412 } : { ok: true, status: 200, json: async () => ({ id: evento.id, summary: '[RVM] Presidente', start: { date: '2026-11-05' }, etag: 'old', extendedProperties: { private: { outro: 'preservar' } } }) };
    } });
    assert.equal(r.sucesso, false); assert.equal(r.resultados[0].ok, false);
    assert.equal(calls[1].options.headers['If-Match'], 'old');
    assert.equal(JSON.parse(calls[1].options.body).extendedProperties.private.outro, 'preservar');
    assert.equal(calls.some(c => c.options.method === 'DELETE'), false);
});
test('Agenda: criação idempotente trata corrida 409 e não duplica evento', async () => {
    const [evento] = await planejarAgendaGrupo(args); let n = 0;
    const r = await sincronizarAgendaGrupo({ ...args, fetchImpl: async (_url, options) => {
        n++;
        if (n === 1) return { ok: false, status: 404, json: async () => ({}) };
        if (n === 2) { assert.equal(options.method, 'POST'); return { ok: false, status: 409, json: async () => ({}) }; }
        if (n === 3) return { ok: true, status: 200, json: async () => ({ ...evento, etag: 'concurrent' }) };
        assert.equal(options.method, 'PATCH'); return { ok: true, status: 200 };
    } });
    assert.equal(r.sucesso, true); assert.equal(n, 4);
});

test('Integração real: renderiza ações do grupo sem disparar provedores', async () => {
    const { createServer } = await import('vite');
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    try {
        const { default: Component } = await server.ssrLoadModule('/src/components/IntegracoesGrupoReal.jsx');
        const html = renderToStaticMarkup(createElement(Component, { config, grupoId: 'grupo-portugues', ownerUid: 'fixture', programacoes: [program], confirmacoes: [], alunos: [] }));
        assert.match(html, /Conectar Google Agenda/); assert.match(html, /Enviar e-mail/); assert.match(html, /Marcar WhatsApp enviado/);
        assert.doesNotMatch(html, /simulado|ensaio-local-e2/);
    } finally { await server.close(); }
});
