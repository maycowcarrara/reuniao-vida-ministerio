import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeGruposProgramacao } from '../src/utils/gruposProgramacao.js';
import { prepararImportacaoSemanal, prepararAgendamento, prepararReparoImportacaoSemanal } from '../src/utils/agendamentoReunioes.js';
import { aplicarOperacoesProgramacao, createProgramacoesController } from '../src/utils/programacoesPorGrupo.js';
import { normalizeOcorrenciaReuniao } from '../src/utils/ocorrenciasReuniao.js';
import { projetarConfigGrupo } from '../src/utils/grupoAtivo.js';
import { projetarProgramaOperacionalInterface } from '../src/utils/interfaceClassicaGrupos.js';
import { projetarQuadroPublico } from '../src/utils/quadroPublico.js';

const PT = 'grupo-portugues', ES = 'grupo-espanhol';
const config = normalizeGruposProgramacao({ idioma: 'pt', dia_reuniao: 'thursday', horario: '19:45',
    dia_reuniao_fds: 'saturday', horario_fds: '18:30' });
const dados = { semana: '21-27 de dezembro - EZEQUIEL 7-8', dataInicio: '2026-12-21',
    partes: [{ id: 'tesouros', titulo: '1. Tesouros da Palavra de Deus', secao: 'tesouros', tipo: 'parte', tempo: '10' }] };
const importar = (programacoes = [], cfg = config, conteudo = dados) => {
    const contexto = { programacoes, config: cfg, grupoId: PT, dados: conteudo };
    return aplicarOperacoesProgramacao({ ...contexto, operacoes: prepararImportacaoSemanal(contexto).operacoes });
};

test('importacao semanal cria os dois tipos com datas e partes visiveis, sem publicar', () => {
    const [p] = importar();
    assert.equal(p.dataInicio, '2026-12-21');
    assert.equal(p.meioSemana.data, '2026-12-24');
    assert.equal(p.meioSemana.horario, '19:45');
    assert.equal(p.fimDeSemana.data, '2026-12-26');
    assert.equal(p.fimDeSemana.horario, '18:30');
    const foco = projetarConfigGrupo(config, PT);
    assert.deepEqual(projetarProgramaOperacionalInterface(p, foco).partes, dados.partes);
    for (const tipo of ['meioSemana', 'fimDeSemana']) {
        assert.equal(normalizeOcorrenciaReuniao(p, tipo, config).operacional, true);
        assert.equal(normalizeOcorrenciaReuniao(p, tipo, config).publica, false);
    }
    assert.equal(projetarQuadroPublico({ configuracoes: config, historico_reunioes: [p] }).historico_reunioes.length, 0);
});

test('dias e horarios pertencem ao grupo; datas explicitas ou tipos desabilitados nao sao gerados', () => {
    for (const fim of [{ habilitada: false }, { frequencia: 'datas', dia: null, horario: '' }]) {
        const cfg = structuredClone(config);
        Object.assign(cfg.grupos[PT].fimDeSemana, fim);
        assert.equal(importar([], cfg)[0].fimDeSemana, undefined);
    }
    for (const meio of [{ habilitada: false }, { frequencia: 'datas' }]) {
        const cfg = structuredClone(config); Object.assign(cfg.grupos[PT].meioSemana, meio);
        assert.throws(() => importar([], cfg));
    }
    const cfg = structuredClone(config);
    cfg.dia_reuniao = 'monday'; cfg.horario = '09:00';
    cfg.grupos[PT].fimDeSemana.dia = 'sunday';
    const [p] = importar([], cfg);
    assert.equal(p.meioSemana.data, '2026-12-24');
    assert.equal(p.fimDeSemana.data, '2026-12-27');
});

test('importacao preserva datas, horarios, inatividade e conteudo de ocorrencias ja agendadas', () => {
    const ctx = { config, grupoId: PT, programacoes: [] };
    const lista = aplicarOperacoesProgramacao({ ...ctx, operacoes: prepararAgendamento({ ...ctx,
        tipo: 'meioSemana', data: '2026-12-23', horario: '20:15' }).operacoes });
    const base = { ...lista[0], desconhecido: 42, publicadaNoQuadro: true,
        fimDeSemana: { ativo: true, data: '2026-12-27', horario: '10:00',
            reuniaoPublica: { temaDiscurso: 'Tema preservado' }, presidente: { id: 'pessoa' }, token: 'preservar' } };
    const [p] = importar([base]);
    assert.equal(p.id, base.id);
    assert.equal(p.desconhecido, 42);
    assert.equal(p.meioSemana.ativo, false);
    assert.equal(p.meioSemana.data, '2026-12-23');
    assert.equal(p.meioSemana.horario, '20:15');
    assert.deepEqual(p.fimDeSemana, base.fimDeSemana);
    assert.equal(p.publicadaNoQuadro, true);
    assert.deepEqual(prepararImportacaoSemanal({ programacoes: [p], config, grupoId: PT, dados }).operacoes, []);
    assert.throws(() => importar([p], config, { ...dados, partes: [{ ...dados.partes[0], titulo: 'Outro conteudo' }] }), /revis[aã]o/);
});

test('semanas iguais PT e ES nao colidem; cancelamentos e eventos sao preservados', () => {
    const es = { id: 'espanhol', grupoId: ES, versaoProgramacao: 2, dataInicio: dados.dataInicio,
        meioSemana: { ativo: false }, fimDeSemana: { ativo: true, data: '2026-12-27', horario: '10:45' } };
    const lista = importar([es]); assert.deepEqual(lista[0], es); assert.equal(lista.length, 2);
    const cfg = structuredClone(config);
    cfg.grupos[PT].eventosAnuais = [{ tipo: 'assembleia', dataInicio: dados.dataInicio }];
    assert.throws(() => importar([], cfg), /Evento impeditivo/);
    for (const extra of [{ cancelada: true }, { arquivada: true }, { meioSemana: { cancelada: true } }]) {
        assert.throws(() => importar([{ ...lista[1], partes: [], ...extra }]), /cancelada|arquivada/);
    }
    const cancelada = { ...lista[1], partes: [], fimDeSemana: { cancelada: true, ativo: false } };
    assert.deepEqual(importar([cancelada])[0].fimDeSemana, cancelada.fimDeSemana);
});

test('calendario usa a semana ISO ao cruzar meses e anos', () => {
    const [p] = importar([], config, { ...dados, semana: '28 de dezembro-3 de janeiro', dataInicio: '2026-12-28' });
    assert.equal(p.meioSemana.data, '2026-12-31');
    assert.equal(p.fimDeSemana.data, '2027-01-02');
});

test('reparo explicito recupera apostila em rascunho sem alterar partes nem designacoes', () => {
    const atual = { ...importar()[0], meioSemana: { ativo: false, data: '2026-12-24', horario: '19:45' },
        partes: [{ ...dados.partes[0], estudante: { id: 'pessoa' }, token: 'preservar' }], presidente: { id: 'presidente' },
        campoExtra: { valor: 42 }, fimDeSemana: { ativo: true, horario: '18:30', presidente: { id: 'fds' } } };
    const contexto = { programacoes: [atual], config, grupoId: PT, programacaoId: atual.id };
    const [corrigida] = aplicarOperacoesProgramacao({ ...contexto, operacoes: prepararReparoImportacaoSemanal(contexto).operacoes });
    assert.equal(corrigida.meioSemana.ativo, true);
    assert.equal(corrigida.fimDeSemana.data, '2026-12-26');
    assert.deepEqual(corrigida.fimDeSemana.presidente, atual.fimDeSemana.presidente);
    for (const key of ['id', 'partes', 'presidente', 'campoExtra', 'publicadaNoQuadro']) assert.deepEqual(corrigida[key], atual[key]);
    for (const extra of [{ publicadaNoQuadro: true }, { cancelada: true }, { arquivada: true }, { meioSemana: { cancelada: true, ativo: false } }, { evento: 'assembleia' }]) {
        assert.throws(() => prepararReparoImportacaoSemanal({ ...contexto, programacoes: [{ ...atual, ...extra }] }));
    }
    assert.throws(() => prepararReparoImportacaoSemanal({ ...contexto, grupoId: ES }));
});

test('controller revalida contra a configuracao atual e salva uma vez sem publicar', async () => {
    let estado = { configuracoes: config, historico_reunioes: [] }, gravacoes = 0;
    const controller = createProgramacoesController({ getEstado: () => estado, salvarLote: async lote => {
        gravacoes++; estado.historico_reunioes = lote.upserts;
    }, publicar: () => assert.fail('Nao deve publicar') });
    const preparar = ctx => prepararImportacaoSemanal({ ...ctx, dados });
    await controller.executar({ grupoId: PT, preparar });
    await controller.executar({ grupoId: PT, preparar });
    assert.equal(gravacoes, 1);
    estado = { ...estado, configuracoes: structuredClone(config) };
    estado.configuracoes.grupos[PT].meioSemana.habilitada = false;
    await assert.rejects(controller.executar({ grupoId: PT, preparar }), /desabilitado/);
});

test('tela de designacoes mostra o programa e as datas da semana importada', async () => {
    const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    try {
        const { default: Designar } = await vite.ssrLoadModule('/src/components/Designar/index.jsx');
        const { I18nProvider, getSectionMessages } = await vite.ssrLoadModule('/src/i18n/index.js');
        const foco = projetarConfigGrupo(config, PT);
        const programa = projetarProgramaOperacionalInterface(importar()[0], foco);
        const html = renderToStaticMarkup(createElement(I18nProvider, { lang: 'pt' }, createElement(Designar, {
            listaProgramacoes: [programa], config: foco, alunos: [], cargosMap: {}, lang: 'pt',
            t: getSectionMessages('adminPanel', 'pt'), setListaProgramacoes() {}, sharedWeekSelection: { [programa.id]: true },
        })));
        assert.match(html, /1\. Tesouros da Palavra de Deus/);
        assert.match(html, /24 de dezembro/);
        assert.match(html, /26 de dezembro/);
        assert.doesNotMatch(html, /Data n[aã]o definida/);
    } finally { await vite.close(); }
});
