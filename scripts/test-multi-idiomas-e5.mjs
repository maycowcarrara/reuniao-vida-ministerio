import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createDadosEnsaioGrupos } from '../src/data/ensaioGrupos.js';
import { projetarQuadroPublico, gruposPublicadosDisponiveis, medirPayloadPublico } from '../src/utils/quadroPublico.js';
import { paginarImpressao } from '../src/utils/impressaoGrupo.js';
import { escolherGrupoAtivo, projetarConfigGrupo } from '../src/utils/grupoAtivo.js';
import { createProgramacoesController } from '../src/utils/programacoesPorGrupo.js';
import { publicarQuadroLocal, lerQuadroLocal } from '../src/services/quadroLocal.js';
const PT = 'grupo-portugues', ES = 'grupo-espanhol';
const dados = () => {
    const d = createDadosEnsaioGrupos();
    d.historico_reunioes.forEach(p => { p.publicadaNoQuadro = true; });
    return d;
};
test('E5: allowlist recursiva mantém IDs e exclui contatos e campos desconhecidos', () => {
    const d = dados(); const p = d.historico_reunioes[1];
    d.configuracoes.email = 'PRIVADO'; d.configuracoes.grupos[ES].segredo = 'PRIVADO';
    p.segredo = 'PRIVADO'; p.fimDeSemana.presidente = { id: 'p1', nome: 'Pessoa', email: 'PRIVADO', telefone: 'PRIVADO', ausencias: ['PRIVADO'], partesHabilitadas: ['PRIVADO'], gruposParticipantes: ['PRIVADO'] };
    const publico = projetarQuadroPublico(d);
    assert.equal(JSON.stringify(publico).includes('PRIVADO'), false);
    assert.deepEqual(publico.historico_reunioes[1].fimDeSemana.presidente, { id: 'p1', nome: 'Pessoa' });
    assert.equal(p.segredo, 'PRIVADO');
});
for (const [nome, modificar] of [
    ['rascunho agregado', d => d.historico_reunioes[1].publicadaNoQuadro = false],
    ['rascunho ocorrência', d => d.historico_reunioes[1].fimDeSemana.publicadaNoQuadro = false],
    ['cancelada', d => d.historico_reunioes[1].fimDeSemana.cancelada = true],
    ['inativa', d => d.historico_reunioes[1].fimDeSemana.ativo = false],
    ['arquivada', d => d.historico_reunioes[1].arquivada = true],
    ['tipo desabilitado', d => d.configuracoes.grupos[ES].fimDeSemana.habilitada = false],
    ['grupo desativado', d => d.configuracoes.grupos[ES].ativo = false],
]) test(`E5: ${nome} não publica ES nem remove PT`, () => {
    const d = dados(); modificar(d);
    assert.deepEqual(projetarQuadroPublico(d).historico_reunioes.map(p => p.id), ['semana-legada-fixture']);
});
test('E5: incompleta e passada continua disponível; preferência ES e fallback principal', () => {
    const d = dados(); d.historico_reunioes[1].fimDeSemana.data = '2020-01-05';
    const grupos = gruposPublicadosDisponiveis(d.historico_reunioes, d.configuracoes);
    assert.equal(Object.keys(grupos).length, 2);
    assert.equal(escolherGrupoAtivo({ grupos, grupoPrincipalId: PT, preferencia: ES }), ES);
    delete grupos[ES];
    assert.equal(escolherGrupoAtivo({ grupos, grupoPrincipalId: PT, preferencia: ES }), PT);
});
test('E5: payload completo medido e excesso falha sem truncamento ou mutação', () => {
    const d = dados(); const before = structuredClone(d);
    const payload = projetarQuadroPublico(d);
    assert.ok(medirPayloadPublico(payload) > 1000);
    assert.throws(() => projetarQuadroPublico(d, 1000), /Nenhum grupo/);
    assert.deepEqual(d, before);
});
for (const qtd of [1, 2, 4, 5]) test(`E5: layout ${qtd}, fim isolado sempre em página própria e PT preservado`, () => {
    const d = dados();
    const pt = d.historico_reunioes[0], es = d.historico_reunioes[1];
    const lote = Array.from({ length: 10 }, (_, i) => ({ ...pt, id: `pt-${i}` }));
    assert.deepEqual(paginarImpressao(lote, qtd, d.configuracoes).map(p => p.length), Array.from({ length: Math.ceil(10/qtd) }, (_, i) => Math.min(qtd, 10-i*qtd)));
    assert.deepEqual(paginarImpressao([es, es], qtd, d.configuracoes).map(p => p.length), [1, 1]);
});
test('E5: salvar ES e falhar publicação informa parcial; republicação mantém ambos', async () => {
    let estado = dados(); let falhar = true;
    const controller = createProgramacoesController({ getEstado: () => estado,
        salvarLote: async ({ upserts }) => { estado = { ...estado, historico_reunioes: estado.historico_reunioes.map(p => upserts.find(x => x.id === p.id) || p) }; },
        publicar: async payload => { if (falhar) throw new Error('simulada'); publicarQuadroLocal(projetarQuadroPublico(payload)); } });
    const resultado = await controller.executar({ grupoId: ES, republicar: true, operacoes: [{ tipo: 'patch', programacaoId: estado.historico_reunioes[1].id, alteracoes: { fimDeSemana: { horario: '11:17' } } }] });
    assert.equal(resultado.salvo, true); assert.equal(resultado.publicado, false);
    falhar = false; await controller.executar({ grupoId: ES, republicar: true, operacoes: [] });
    assert.equal(lerQuadroLocal().historico_reunioes.length, 2);
    assert.equal(lerQuadroLocal().historico_reunioes[1].fimDeSemana.horario, '11:17');
});
let server;
after(async () => { await server?.close(); });
test('E5: SSR impressão ES isolada tem data explícita e nenhum cabeçalho de meio de semana', async () => {
    server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    const { default: Revisar } = await server.ssrLoadModule('/src/components/RevisarEnviar/index.jsx');
    const d = dados(); const es = d.historico_reunioes[1];
    es.fimDeSemana.horario = '11:17';
    const html = renderToStaticMarkup(createElement(Revisar, { somenteImpressao: true, historico: [es], alunos: [], config: projetarConfigGrupo(d.configuracoes, ES) }));
    const print = html.slice(html.indexOf('id="print-root"'));
    assert.match(print, /data-fim-isolado="true"/); assert.match(print, /11:17/);
    assert.doesNotMatch(print, /Reunião de meio de semana|Reunión de entre semana|Congregação de ensaio local/);
});
test('E5: quadro SSR ES só fim de semana, busca de nome, sem reunião fantasma', async () => {
    server ||= await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    const { default: Quadro } = await server.ssrLoadModule('/src/components/QuadroPublico.jsx');
    const { I18nProvider } = await server.ssrLoadModule('/src/i18n/index.js');
    const d = dados(); const es = d.historico_reunioes[1];
    es.fimDeSemana.data = '2099-11-08';
    es.fimDeSemana.presidente = { id: 'p1', nome: 'Presidente exclusivo ES' };
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/quadro?p=Presidente'] },
        createElement(I18nProvider, { lang: 'es' }, createElement(Quadro, { programacoes: [es], config: projetarConfigGrupo(d.configuracoes, ES) }))));
    assert.match(html, /2099/); assert.match(html, /09:30/); assert.match(html, /exclusivo ES/);
    assert.doesNotMatch(html, /tipoVisual.*meioSemana|Congregação de ensaio local/);
    const { default: QuadroPorGrupo } = await server.ssrLoadModule('/src/components/QuadroPorGrupo.jsx');
    const wrapped = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(QuadroPorGrupo, { dados: d })));
    const header = wrapped.match(/<header[\s\S]*?<\/header>/)?.[0] || '';
    assert.match(header, /role="group"/); // Seletor pertence ao fluxo do cabeçalho.
    assert.match(header, /aria-pressed="true"/);
});
