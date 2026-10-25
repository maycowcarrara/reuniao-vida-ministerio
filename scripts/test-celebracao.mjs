import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createDadosEnsaioGrupos } from '../src/data/ensaioGrupos.js';
import { GRUPO_PORTUGUES_ID as PT, GRUPO_ESPANHOL_ID as ES } from '../src/utils/gruposProgramacao.js';
import { getCelebracao, eventoSubstituiReuniao, textosCelebracao } from '../src/utils/celebracao.js';
import { prepararEventoGrupo, listarSlotsReuniao, prepararAtribuicaoGrupo, selecionarDesignacoes, reconstruirHistoricoGrupo, avaliarElegibilidadeGrupo } from '../src/utils/designacoesPorGrupo.js';
import { prepararSemanaEvento, prepararImportacaoMeioSemana, prepararEdicaoCelebracao, prepararAgendamento } from '../src/utils/agendamentoReunioes.js';
import { aplicarOperacoesProgramacao } from '../src/utils/programacoesPorGrupo.js';
import { normalizeOcorrenciaReuniao } from '../src/utils/ocorrenciasReuniao.js';
import { projetarQuadroPublico, gruposPublicadosDisponiveis } from '../src/utils/quadroPublico.js';
import { projetarConfigGrupo } from '../src/utils/grupoAtivo.js';
import { criarFilaGrupo, resolverConfirmacaoGrupo, planejarAgendaGrupo } from '../src/utils/integracoesGrupo.js';
import { progressoSemanaCelebracao } from '../src/utils/progressoCelebracao.js';
import { buildLegacyAssignmentKey } from '../src/utils/assignmentIdentity.js';

const baseConfig = () => {
    const c = createDadosEnsaioGrupos().configuracoes;
    for (const grupo of Object.values(c.grupos)) {
        grupo.meioSemana = { habilitada: true, dia: 'wednesday', horario: '19:30', frequencia: 'semanal' };
        grupo.fimDeSemana = { habilitada: true, dia: 'sunday', horario: '10:00', frequencia: 'semanal' };
    }
    return c;
};
const pessoa = { id: 'apoio', nome: 'Irmão Apoio', tipo: 'anciao', gruposParticipantes: [PT, ES], partesHabilitadas: ['audio_video', 'presidente_rvm', 'presidente_fds'] };
const cargosMap = { anciao: { gen: 'M' } };
const programa = (grupoId = PT) => ({ id: `fixture-${grupoId}`, grupoId, versaoProgramacao: 2, semana: '2-8 de novembro', dataInicio: '2026-11-02', publicadaNoQuadro: true,
    meioSemana: { ativo: true, data: '2026-11-04', horario: '19:30' }, presidente: { id: 'normal-meio', nome: 'Presidente normal meio' },
    partes: [{ id: 'parte-normal', titulo: 'Parte normal do meio', estudante: { id: 'normal-parte', nome: 'Estudante normal' } }],
    responsabilidades: { videoZoomSom: [{ id: 'normal-apoio', nome: 'Apoio normal meio' }] },
    fimDeSemana: { ativo: true, data: '2026-11-08', horario: '10:00', presidente: { id: 'normal-fim', nome: 'Presidente normal fim' },
        reuniaoPublica: { oradorNomeManual: 'Orador público normal', temaDiscurso: 'Tema normal', congregacaoOrador: 'Congregação' },
        estudoSentinela: { leitor: { id: 'leitor', nome: 'Leitor normal' } }, responsabilidades: {} },
    metadado: { conservar: true } });
function configurar(data = '2026-11-06', grupoId = PT, config = baseConfig(), programacoes = [programa()]) {
    const next = prepararEventoGrupo({ config, grupoId, data, tipo: 'celebracao' });
    const pedido = prepararSemanaEvento({ config: next, grupoId, data, tipo: 'celebracao', programacoes });
    const lista = aplicarOperacoesProgramacao({ config: next, grupoId, programacoes, operacoes: pedido.operacoes });
    return { config: next, grupoId, programacoes: lista, alunos: [pessoa], cargosMap };
}
for (let dia = 2; dia <= 8; dia++) test(`celebração dia ${dia}: política por reunião e importação`, () => {
    const data = `2026-11-0${dia}`;
    const ctx = configurar(data);
    const p = ctx.programacoes[0];
    const tipo = dia < 7 ? 'meioSemana' : 'fimDeSemana';
    const outra = tipo === 'meioSemana' ? 'fimDeSemana' : 'meioSemana';
    assert.equal(getCelebracao(p, ctx.config).tipoReuniao, tipo);
    assert.equal(normalizeOcorrenciaReuniao(p, tipo, ctx.config).data, data);
    assert.equal(normalizeOcorrenciaReuniao(p, tipo, ctx.config).celebracao, true);
    assert.equal(normalizeOcorrenciaReuniao(p, outra, ctx.config).operacional, true);
    assert.equal(normalizeOcorrenciaReuniao(p, outra, ctx.config).data, outra === 'meioSemana' ? '2026-11-04' : '2026-11-08');
    assert.deepEqual(p.partes, programa().partes);
    assert.deepEqual(p.fimDeSemana, programa().fimDeSemana);
    assert.equal(eventoSubstituiReuniao({ tipo: 'celebracao', dataInput: data }, 'meioSemana'), dia < 7);
    const pedido = { ...ctx, programacoes: [{ ...p, partes: [] }], dados: { partes: [{ id: 'nova', titulo: 'Importada' }] }, data: '2026-11-04', horario: '19:30' };
    if (dia < 7) assert.throws(() => prepararImportacaoMeioSemana(pedido), /celebração/);
    else assert.equal(prepararImportacaoMeioSemana(pedido).operacoes.length, 1);
});
test('evento por grupo: ES não altera nem bloqueia PT e suporta celebração com meio desabilitado', () => {
    const cfg = baseConfig(); cfg.grupos[ES].meioSemana.habilitada = false;
    const pt = programa(), es = programa(ES);
    const ctx = configurar('2026-11-06', ES, cfg, [pt, es]);
    assert.deepEqual(ctx.programacoes[0], pt);
    assert.equal(getCelebracao(pt, ctx.config), null);
    assert.equal(normalizeOcorrenciaReuniao(ctx.programacoes[1], 'meioSemana', ctx.config).operacional, true);
    assert.deepEqual(ctx.config.grupos[PT], cfg.grupos[PT]);
    assert.throws(() => prepararEventoGrupo({ config: cfg, grupoId: ES, tipo: 'celebracao', data: '2026-02-30' }), /Data/);
});
test('sem importação: cria/reutiliza semana e permite importar somente a outra reunião sem perder celebração', () => {
    const ctx = configurar('2026-11-08', ES, baseConfig(), []);
    const p = ctx.programacoes[0];
    assert.equal(p.publicadaNoQuadro, false);
    assert.equal(getCelebracao(p, ctx.config).data, '2026-11-08');
    const edit = prepararEdicaoCelebracao({ ...ctx, programacaoId: p.id, valores: { horario: '18:30', oradorNomeManual: 'Orador sem cadastro' } });
    const lista = aplicarOperacoesProgramacao({ ...ctx, operacoes: edit.operacoes });
    const imp = prepararImportacaoMeioSemana({ ...ctx, programacoes: lista, dados: { partes: [{ id: 'texto' }] }, data: '2026-11-04', horario: '19:30' });
    const final = aplicarOperacoesProgramacao({ ...ctx, programacoes: lista, operacoes: imp.operacoes });
    assert.equal(final.length, 1); assert.equal(final[0].id, p.id);
    assert.equal(final[0].celebracao.oradorNomeManual, 'Orador sem cadastro');
    assert.deepEqual(final[0].partes, [{ id: 'texto' }]);
    assert.equal(prepararAgendamento({ ...ctx, tipo: 'fimDeSemana', data: '2026-11-08', horario: '10:00' }).status, 'evento');
});
test('apoio: habilitação, participação, data real, seleção obsoleta e bloco próprio preservado', () => {
    const ctx = configurar(); const p = ctx.programacoes[0];
    const slot = listarSlotsReuniao(p, 'meioSemana', { config: ctx.config })[0];
    assert.equal(slot.celebracao, true); assert.equal(slot.slotKey, 'audio_video');
    const check = aluno => avaliarElegibilidadeGrupo({ ...ctx, aluno, programacao: p, tipo: 'meioSemana', slot });
    assert.equal(check(pessoa).eligible, true);
    assert.equal(check({ ...pessoa, partesHabilitadas: [] }).eligible, false);
    assert.equal(check({ ...pessoa, gruposParticipantes: [ES] }).eligible, false);
    assert.equal(check({ ...pessoa, datasIndisponiveis: [{ inicio: '2026-11-06', fim: '2026-11-06' }] }).eligible, false);
    assert.equal(check({ ...pessoa, datasIndisponiveis: [{ inicio: '2026-11-04', fim: '2026-11-04' }] }).eligible, true);
    const atribuicao = prepararAtribuicaoGrupo({ ...ctx, programacaoId: p.id, tipo: 'meioSemana', slotId: slot.slotId, alunoId: pessoa.id });
    const next = aplicarOperacoesProgramacao({ ...ctx, operacoes: atribuicao.operacoes })[0];
    assert.equal(next.celebracao.responsabilidades.videoZoomSom[0].id, pessoa.id);
    assert.deepEqual(next.responsabilidades, p.responsabilidades); assert.deepEqual(next.fimDeSemana, p.fimDeSemana);
    assert.throws(() => prepararAtribuicaoGrupo({ ...ctx, programacaoId: p.id, tipo: 'meioSemana', slotId: '["presidente"]', alunoId: pessoa.id }), /Slot/);
});
function preenchido(data = '2026-11-06') {
    const ctx = configurar(data); const p = ctx.programacoes[0];
    p.celebracao.horario = '18:30'; p.celebracao.oradorNomeManual = 'Orador da celebração';
    for (const key of Object.keys(p.celebracao.responsabilidades)) p.celebracao.responsabilidades[key] = [{ ...pessoa, email: 'privado@example.test', partesHabilitadas: ['privado'] }];
    return ctx;
}
test('quadro allowlist: publica celebração e outra reunião, sem partes substituídas, contatos ou metadados', () => {
    for (const data of ['2026-11-06', '2026-11-08']) {
        const ctx = preenchido(data); const p = ctx.programacoes[0];
        const payload = projetarQuadroPublico({ configuracoes: ctx.config, historico_reunioes: ctx.programacoes });
        const text = JSON.stringify(payload);
        assert.ok(text.includes('Orador da celebração')); assert.ok(!text.includes('privado@example')); assert.ok(!text.includes('partesHabilitadas')); assert.ok(!text.includes('metadado'));
        if (data.endsWith('06')) { assert.equal(payload.historico_reunioes[0].partes.length, 0); assert.ok(!text.includes('Apoio normal meio')); }
        else { assert.ok(!text.includes('Orador público normal')); assert.ok(!text.includes('Leitor normal')); assert.ok(text.includes('Parte normal do meio')); }
        const tipo = getCelebracao(p, ctx.config).tipoReuniao;
        p[tipo].publicadaNoQuadro = false;
        const hidden = projetarQuadroPublico({ configuracoes: ctx.config, historico_reunioes: ctx.programacoes });
        assert.equal(normalizeOcorrenciaReuniao(hidden.historico_reunioes[0], tipo, hidden.configuracoes).operacional, false);
        assert.ok(!JSON.stringify(hidden).includes('Orador da celebração'));
    }
});
test('fila, confirmações e histórico: apoios da celebração têm identidade própria e inativam vínculos antigos', () => {
    const original = programa();
    const filaAntiga = criarFilaGrupo({ config: baseConfig(), grupoId: PT, programacoes: [original] });
    const ctx = preenchido();
    const fila = criarFilaGrupo(ctx);
    assert.ok(!fila.some(row => row.item.pessoa.id === 'normal-meio'));
    const c = fila.filter(row => row.item.celebracao);
    assert.equal(c.length, 4); assert.ok(c.every(row => row.preview.includes('Celebração') && row.confirmation.dataISO === '2026-11-06'));
    const antiga = { ...filaAntiga.find(row => row.item.pessoa.id === 'normal-meio').confirmation, ownerUid: 'fixture' };
    assert.equal(resolverConfirmacaoGrupo({ confirmacao: antiga, ...ctx }).isUnavailable, true);
    const atual = { ...c[0].confirmation, ownerUid: 'fixture' };
    assert.equal(resolverConfirmacaoGrupo({ confirmacao: atual, ...ctx }).isUnavailable, false);
    const alterada = prepararEventoGrupo({ ...ctx, data: '2026-11-05', tipo: 'celebracao' });
    assert.equal(resolverConfirmacaoGrupo({ ...ctx, config: alterada, confirmacao: atual }).isUnavailable, true);
    const historico = reconstruirHistoricoGrupo({ ...ctx, alunos: [{ ...pessoa, historico: [{ grupoId: ES, data: '2026-11-04', parte: 'presidente' }] }], programacaoIds: [original.id], tipos: ['meioSemana'] });
    assert.equal(historico[0].historico.filter(h => h.grupoId === ES).length, 1);
    assert.ok(historico[0].historico.filter(h => h.grupoId === PT).every(h => h.data === '2026-11-06' && h.slotId.includes('celebracao')));
});
test('alteração/remoção de evento preserva todas as designações e recalcula operação/completude', () => {
    const ctx = preenchido(); const p = ctx.programacoes[0];
    assert.ok(progressoSemanaCelebracao(p, ctx.config).total < 20);
    const sem = prepararEventoGrupo({ ...ctx, tipo: 'normal', data: '2026-11-06' });
    assert.equal(getCelebracao(p, sem), null);
    assert.ok(selecionarDesignacoes({ ...ctx, config: sem }).some(row => row.pessoa.id === 'normal-meio'));
    assert.equal(p.celebracao.oradorNomeManual, 'Orador da celebração');
    const domingo = prepararEventoGrupo({ ...ctx, data: '2026-11-08', tipo: 'celebracao' });
    assert.equal(getCelebracao(p, domingo).tipoReuniao, 'fimDeSemana');
    assert.ok(selecionarDesignacoes({ ...ctx, config: domingo }).some(row => row.pessoa.id === 'normal-meio'));
});
test('agenda: datas independentes e IDs sem colisão com reunião substituída', async () => {
    const ctx = preenchido();
    const agenda = await planejarAgendaGrupo(ctx);
    const c = agenda.filter(evento => evento.summary.includes('Celebração'));
    assert.equal(c.length, 4); assert.ok(c.every(e => e.data === '2026-11-06' && e.horario === '18:30'));
    assert.ok(agenda.some(e => e.data === '2026-11-08' && e.horario === '10:00'));
    const normais = await planejarAgendaGrupo({ config: baseConfig(), grupoId: PT, programacoes: [programa()] });
    assert.ok(c.every(e => !normais.some(n => n.id === e.id)));
});
test('datas de fronteira e assembleias/visita continuam corretas', () => {
    const ctx = configurar('2027-01-03', ES, baseConfig(), []);
    assert.equal(ctx.programacoes[0].dataInicio, '2026-12-28');
    assert.equal(getCelebracao(ctx.programacoes[0], ctx.config).tipoReuniao, 'fimDeSemana');
    for (const tipo of ['assembleia', 'assembleia_betel', 'assembleia_circuito', 'congresso']) {
        const cfg = prepararEventoGrupo({ config: baseConfig(), grupoId: PT, data: '2026-11-08', tipo });
        assert.equal(normalizeOcorrenciaReuniao(programa(), 'meioSemana', cfg).operacional, false);
        assert.equal(normalizeOcorrenciaReuniao(programa(), 'fimDeSemana', cfg).operacional, false);
    }
    const cfg = prepararEventoGrupo({ config: baseConfig(), grupoId: PT, data: '2026-11-03', tipo: 'visita' });
    assert.equal(normalizeOcorrenciaReuniao(programa(), 'meioSemana', cfg).operacional, true);
    assert.equal(normalizeOcorrenciaReuniao({ ...programa(), evento: 'assembleia_betel' }, 'fimDeSemana', baseConfig()).operacional, false);
});

let vite;
after(async () => vite?.close());
test('SSR PT/ES: editor, impressão e quadro mostram a celebração na posição correta sem partes substituídas', async () => {
    vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    const { default: Print } = await vite.ssrLoadModule('/src/components/SemanaCelebracaoPrint.jsx');
    const { default: Editor } = await vite.ssrLoadModule('/src/components/Celebracao.jsx');
    const { default: Quadro } = await vite.ssrLoadModule('/src/components/QuadroPublico.jsx');
    const { I18nProvider } = await vite.ssrLoadModule('/src/i18n/index.js');
    const { collectAssignmentKeysForWeek } = await vite.ssrLoadModule('/src/services/confirmacoesPublicas.js');
    for (const lang of ['pt', 'es']) for (const data of ['2026-11-06', '2026-11-08']) {
        const ctx = preenchido(data); ctx.config.grupos[PT].idioma = lang;
        const p = ctx.programacoes[0], foco = projetarConfigGrupo(ctx.config, PT);
        const titulo = textosCelebracao(lang).titulo;
        const chaveLegada = buildLegacyAssignmentKey({ dataISO: '2026-11-04', semana: p.semana, parteId: 'presidente', pessoaId: 'normal-meio', role: 'presidente' });
        assert.equal(collectAssignmentKeysForWeek(p, foco).has(chaveLegada), data.endsWith('08'));
        const html = renderToStaticMarkup(createElement(Print, { programa: p, config: foco, lang }));
        assert.ok(html.includes(titulo));
        if (data.endsWith('06')) { assert.ok(!html.includes('Parte normal do meio')); assert.ok(html.indexOf(titulo) < html.indexOf('Orador público normal')); }
        else { assert.ok(!html.includes('Orador público normal')); assert.ok(html.indexOf('Parte normal do meio') < html.indexOf(titulo)); }
        const editor = renderToStaticMarkup(createElement(Editor, { programa: p, programacoes: ctx.programacoes, config: foco, alunos: [], cargosMap }));
        assert.ok(editor.includes('name="oradorNomeManual"')); assert.ok(!editor.includes('name="estudante"'));
        const quadro = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(I18nProvider, { lang }, createElement(Quadro, { programacoes: [p], config: foco }))));
        assert.ok(quadro.includes(titulo));
        assert.ok(!quadro.includes(data.endsWith('06') ? 'Parte normal do meio' : 'Orador público normal'));
        const payload = projetarQuadroPublico({ configuracoes: ctx.config, historico_reunioes: [p] });
        assert.ok(gruposPublicadosDisponiveis(payload.historico_reunioes, payload.configuracoes)[PT]);
    }
});
