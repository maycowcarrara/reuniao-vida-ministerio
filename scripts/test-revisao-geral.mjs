import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepararRespostaConfirmacao } from '../src/utils/respostasConfirmacao.js';
import { normalizeGruposProgramacao } from '../src/utils/gruposProgramacao.js';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const base = { status: 'pendente', weekReminderStatus: 'nao_enviado', dataISO: '2099-11-08', responseHistory: [], weekReminderHistory: [], sentChannels: { mail: 'preservar' } };
const options = { mode: 'primary', status: 'confirmado', nowISO: '2026-10-24T18:00:00Z', todayISO: '2026-10-24', requestId: 'fixture', timestamp: () => 'server-time-fixture' };
test('Revisão: resposta repetida é no-op; status estranho não vira aceite', () => {
    assert.equal(prepararRespostaConfirmacao({ ...base, status: 'confirmado' }, options), null);
    for (const status of ['pendente', 'qualquer', null]) assert.throws(() => prepararRespostaConfirmacao(base, { ...options, status }), /inválido/);
    assert.throws(() => prepararRespostaConfirmacao(base, { ...options, mode: 'desconhecido' }), /inválido/);
});
test('Revisão: resposta mantém histórico anterior e distingue aceite de imprevisto semanal', () => {
    const before = { ...base, responseHistory: [{ status: 'nao_pode' }] };
    const response = prepararRespostaConfirmacao(before, options);
    assert.equal(response.responseHistory.length, 2); assert.deepEqual(before.responseHistory, [{ status: 'nao_pode' }]);
    const reminder = prepararRespostaConfirmacao(base, { ...options, mode: 'week', status: 'imprevisto' });
    assert.equal(reminder.weekReminderStatus, 'imprevisto'); assert.equal(reminder.weekReminderHistory[0].responseCode, 'i');
    assert.equal(reminder.status, undefined); assert.equal(response.sentChannels, undefined);
});
test('Revisão: reunião passada mantém bloqueio; primeira resposta passada continua permitida', () => {
    assert.throws(() => prepararRespostaConfirmacao({ ...base, dataISO: '2026-01-01', status: 'nao_pode' }, options), /após a data/);
    assert.equal(prepararRespostaConfirmacao({ ...base, dataISO: '2026-01-01' }, options).status, 'confirmado');
});
test('Revisão: configurações preservam estrutura, acesso e idioma; agendamento modal não expõe texto de ensaio', async () => {
    const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    try {
        const { I18nProvider } = await server.ssrLoadModule('/src/i18n/index.js');
        const config = normalizeGruposProgramacao({ idioma: 'pt', nome_cong: 'Congregação fictícia' });
        const render = (Component, props, lang = 'pt') => renderToStaticMarkup(createElement(I18nProvider, { lang }, createElement(Component, props)));
        const { default: Config } = await server.ssrLoadModule('/src/components/ConfiguracoesGrupos.jsx');
        const configHtml = render(Config, { config, grupoId: 'grupo-portugues', lang: 'pt', mostrarAcessos: true });
        for (const text of ['Ajustes do Sistema', 'Controle de usuários', 'Programação padrão ao abrir', 'Salvar configuração']) assert.ok(configHtml.toLowerCase().includes(text.toLowerCase()), text);
        assert.doesNotMatch(configHtml, /salva no ensaio|dados fictícios/);
        const { default: Agenda } = await server.ssrLoadModule('/src/components/ReunioesIndependentes.jsx');
        const html = render(Agenda, { config, grupoId: 'grupo-portugues', programacoes: [], modal: true });
        assert.match(html, /role="dialog"/); assert.match(html, /Agendamento de reuniões/); assert.match(html, /Uma data/);
        assert.doesNotMatch(html, /dados fictícios|somente na memória|Reuniões independentes|sunday|saturday/);
        const { default: Designar } = await server.ssrLoadModule('/src/components/Designar/index.jsx');
        const { projetarConfigGrupo } = await import('../src/utils/grupoAtivo.js');
        const es = { id: 'es-visual', grupoId: 'grupo-espanhol', versaoProgramacao: 2, semana: '2-8 de noviembre de 2026', dataInicio: '2026-11-02', meioSemana: { ativo: false }, publicadaNoQuadro: false, partes: [], fimDeSemana: { ativo: true, data: '2026-11-08', horario: '10:45' } };
        const cancelada = { ...es, id: 'es-cancelada-visual', fimDeSemana: { ...es.fimDeSemana, ativo: false, cancelada: true } };
        const designHtml = render(Designar, { config: projetarConfigGrupo(config, 'grupo-espanhol'), alunos: [], listaProgramacoes: [es, cancelada], sharedWeekSelection: { [es.id]: true, [cancelada.id]: true }, cargosMap: {}, lang: 'es' }, 'es');
        assert.match(designHtml, />Cancelada</); assert.match(designHtml, />Borrador</);
        assert.match(designHtml, /<fieldset disabled/); assert.doesNotMatch(designHtml, /0:00|>Publicada<|Entre semana/);
        const { default: Header } = await server.ssrLoadModule('/src/components/Designar/DesignarHeader.jsx');
        const { getSectionMessages } = await server.ssrLoadModule('/src/i18n/index.js');
        const header = render(Header, { TT: getSectionMessages('designar', 'pt'), config, listaFiltradaPorFlag: [], totalSelecionadas: 0, semanasSelecionadas: {}, onAbrirAgendamento() {} });
        assert.match(header, /Agendar reunião/);
    } finally { await server.close(); }
});

test('Revisão: proxy de importação restringe a entrada a HTTPS de jw.org', async () => {
    const { default: proxy } = await import('../workers/jw-proxy/src/index.js');
    const original = globalThis.fetch, requests = [];
    globalThis.fetch = async (url, options) => { requests.push({ url: String(url), options }); return new Response('<html>Fixture JW</html>', { headers: { 'Content-Type': 'text/html' } }); };
    try {
        for (const url of ['http://www.jw.org/pt/', 'https://jw.org.evil.invalid/', 'https://jw.org@evil.invalid/']) {
            assert.equal((await proxy.fetch(new Request('https://proxy.local/?url=' + encodeURIComponent(url)))).status, 400);
        }
        assert.equal(requests.length, 0);
        const result = await proxy.fetch(new Request('https://proxy.local/?url=' + encodeURIComponent('https://www.jw.org/pt/biblioteca/')));
        assert.equal(result.status, 200); assert.equal(requests.length, 1);
        assert.equal((await proxy.fetch(new Request('https://proxy.local/', { method: 'PUT' }))).status, 405);
    } finally { globalThis.fetch = original; }
});

test('Revisão: token inválido é recusado antes de acessar o Firestore', async () => {
    const { responderParConfirmacao } = await import('../src/services/confirmacoesGrupoFirestore.js');
    for (const token of ['', 'pasta/token', '..\\token', 'a'.repeat(201)]) await assert.rejects(responderParConfirmacao({ token }), /Token de confirmação inválido/);
});
