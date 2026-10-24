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
