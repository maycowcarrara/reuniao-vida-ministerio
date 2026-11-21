import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { getDataSemanalVigente, getDiaReuniaoVigente, promoverDiaReuniao, promoverTrocasConfiguracao, validarProximaTroca } from '../src/config/meetingSchedule.js';
import { getCanonicalMeetingDateISO, getMeetingDateISOFromSemana } from '../src/utils/revisarEnviar/dates.js';
import { normalizeGruposProgramacao, GRUPO_PORTUGUES_ID as PT, GRUPO_ESPANHOL_ID as ES } from '../src/utils/gruposProgramacao.js';
import { prepararGeracaoReunioes, prepararImportacaoSemanal } from '../src/utils/agendamentoReunioes.js';
import { projetarConfigGrupo } from '../src/utils/grupoAtivo.js';
import { patchConfiguracaoGrupo } from '../src/utils/programacoesPorGrupo.js';
import { atualizarProgramacoesPorTroca } from '../src/utils/trocaDiasReuniao.js';
import { getDataDesignacao } from '../src/utils/sugestoesDesignacao.js';
import { criarFilaGrupo, planejarAgendaGrupo, resolverConfirmacaoGrupo } from '../src/utils/integracoesGrupo.js';
import { reconstruirHistoricoGrupo } from '../src/utils/designacoesPorGrupo.js';
import { projetarQuadroPublico } from '../src/utils/quadroPublico.js';

const meio = { dia: 'thursday', proximaTroca: { data: '2027-01-01', dia: 'wednesday' } };
const fim = { dia: 'sunday', proximaTroca: { data: '2027-01-01', dia: 'saturday' } };
const legado = { idioma: 'pt', dia_reuniao: meio.dia, dia_reuniao_fds: fim.dia,
    planejamentoReunioes: { meioSemana: { proximaTroca: meio.proximaTroca }, fimDeSemana: { proximaTroca: fim.proximaTroca } } };
const config = normalizeGruposProgramacao(legado);
const semana = { semana: '28 de dezembro de 2026-3 de janeiro de 2027', dataInicio: '2026-12-28' };
const obter = (tipo, sem = semana, cfg = legado) => getCanonicalMeetingDateISO({ sem, config: cfg, tipoReuniao: tipo });
const pessoa = { id: 'irmao', nome: 'Irmao exemplo' };
const programa = { ...semana, id: 'troca-ano', grupoId: PT, versaoProgramacao: 2, publicadaNoQuadro: true,
    meioSemana: { ativo: true, data: '2026-12-31', horario: '19:30' }, presidente: pessoa, partes: [],
    fimDeSemana: { ativo: true, data: '2027-01-03', horario: '18:00', presidente: pessoa }, desconhecido: { preservar: true } };
const semTroca = normalizeGruposProgramacao({ ...legado, planejamentoReunioes: {} });
const atualizar = (programacoes, extra = {}) => atualizarProgramacoesPorTroca({ programacoes, configAntes: semTroca, configDepois: config, hoje: '2026-11-21', ...extra });

test('Virada: cada reuniao usa a propria vigencia, nao o inicio da semana nem o dia de hoje', () => {
    const antes = structuredClone(legado);
    assert.equal(obter('meioSemana'), '2026-12-31');
    assert.equal(obter('fimDeSemana'), '2027-01-02');
    assert.equal(obter('meioSemana', { semana: '4-10 de janeiro de 2027', dataInicio: '2027-01-04' }), '2027-01-06');
    assert.equal(obter('fimDeSemana', { semana: '21-27 de dezembro de 2026', dataInicio: '2026-12-21' }), '2026-12-27');
    assert.deepEqual(legado, antes);
});

test('Datas: vigencia inclusiva, datas ISO sem rotulo e override de visita independente', () => {
    assert.equal(getDiaReuniaoVigente(fim, '2026-12-31'), 'sunday');
    assert.equal(getDiaReuniaoVigente(fim, '2027-01-01'), 'saturday');
    assert.equal(getMeetingDateISOFromSemana({ config: legado, isoFallback: '2027-01-04' }), '2027-01-06');
    assert.equal(getMeetingDateISOFromSemana({ config: legado, semanaStr: semana.semana, overrideDia: 'tuesday' }), '2026-12-29');
});

test('Promocao: novo dia vira atual, proxima fica vazia, historico e repeticao ficam corretos', () => {
    assert.equal(promoverDiaReuniao(meio, '2026-12-31'), meio);
    const next = promoverDiaReuniao(meio, '2027-01-01');
    assert.equal(next.dia, 'wednesday'); assert.equal(next.proximaTroca, null);
    assert.equal(getDataSemanalVigente('2026-12-28', next), '2026-12-31');
    assert.equal(getDataSemanalVigente('2027-01-04', next), '2027-01-06');
    assert.deepEqual(promoverDiaReuniao(next, '2027-02-01'), next);
    const cfg = promoverTrocasConfiguracao(config, '2027-01-01');
    assert.equal(cfg.dia_reuniao, 'wednesday'); assert.equal(cfg.dia_reuniao_fds, 'saturday');
    assert.equal(cfg.grupos[PT].fimDeSemana.proximaTroca, null);
    assert.equal(obter('fimDeSemana', semana, projetarConfigGrupo(cfg, PT)), '2027-01-02');
    assert.equal(obter('meioSemana', semana, cfg), '2026-12-31');
});

test('Promocao: uma segunda troca anual nao apaga os dias de anos anteriores', () => {
    const ano2027 = promoverDiaReuniao(meio, '2027-01-01');
    const ano2028 = promoverDiaReuniao({ ...ano2027, proximaTroca: { data: '2028-01-01', dia: 'tuesday' } }, '2028-01-01');
    assert.equal(ano2028.historicoDias.length, 2);
    for (const [inicio, esperado] of [['2026-12-28', '2026-12-31'], ['2027-01-04', '2027-01-06'], ['2028-01-03', '2028-01-04']]) {
        assert.equal(getDataSemanalVigente(inicio, ano2028), esperado);
    }
});

test('Validacao: datas impossiveis e mudancas que eliminam ou duplicam reuniao sao recusadas', () => {
    for (const data of ['', '2027-02-30', '2027-13-01']) assert.throws(() => validarProximaTroca({ ...meio, proximaTroca: { data, dia: 'wednesday' } }), /trocaDiaInvalida/);
    assert.throws(() => validarProximaTroca({ ...meio, proximaTroca: { data: '2027-01-07', dia: 'wednesday' } }), /trocaDiaSemanaAmbigua/);
    assert.throws(() => validarProximaTroca({ dia: 'monday', proximaTroca: { data: '2027-01-07', dia: 'friday' } }), /trocaDiaSemanaAmbigua/);
    assert.doesNotThrow(() => validarProximaTroca(meio));
    assert.doesNotThrow(() => validarProximaTroca(fim));
});

test('Grupos: troca e cancelamento de planejamento sao isolados por idioma e tipo', () => {
    const cfg = patchConfiguracaoGrupo(config, { grupoId: PT, alteracoes: { fimDeSemana: { proximaTroca: null } } });
    assert.equal(cfg.grupos[PT].fimDeSemana.proximaTroca, null);
    assert.deepEqual(cfg.grupos[PT].meioSemana.proximaTroca, meio.proximaTroca);
    assert.deepEqual(cfg.grupos[ES], config.grupos[ES]);
    assert.equal(obter('fimDeSemana', semana, projetarConfigGrupo(cfg, PT)), '2027-01-03');
    assert.throws(() => patchConfiguracaoGrupo(config, { grupoId: PT, alteracoes: { meioSemana: { proximaTroca: { data: '2027-02-30', dia: 'monday' } } } }), /trocaDiaInvalida/);
});

test('Importacao semanal e geracao em lote atravessam a troca sem duplicar a semana', () => {
    const resultado = prepararImportacaoSemanal({ config, grupoId: PT, dados: { ...semana, partes: [{ id: 'p', titulo: 'Parte', tipo: 'parte' }] } });
    assert.equal(resultado.operacoes[0].programacao.meioSemana.data, '2026-12-31');
    assert.equal(resultado.operacoes[0].programacao.fimDeSemana.data, '2027-01-02');
    const gerar = tipo => prepararGeracaoReunioes({ config, grupoId: PT, tipo, inicio: '2026-12-21', fim: '2027-01-10' }).previa.map(p => p.data);
    assert.deepEqual(gerar('meioSemana'), ['2026-12-24', '2026-12-31', '2027-01-06']);
    assert.deepEqual(gerar('fimDeSemana'), ['2026-12-27', '2027-01-02', '2027-01-09']);
});

test('Programacoes existentes: ajusta data futura, conserva designados, IDs e marca sincronizacao', () => {
    const antes = structuredClone(programa);
    const [next] = atualizar([programa]);
    assert.equal(next.meioSemana.data, '2026-12-31'); assert.equal(next.fimDeSemana.data, '2027-01-02');
    assert.equal(next.id, programa.id); assert.deepEqual(next.fimDeSemana.presidente, pessoa);
    assert.deepEqual(next.desconhecido, programa.desconhecido);
    assert.equal(next.agendaPendenteSync, true); assert.equal(next.historicoPendenteSync, true);
    assert.deepEqual(programa, antes);
    const [cancelamento] = atualizarProgramacoesPorTroca({ programacoes: [next], configAntes: config, configDepois: semTroca, hoje: '2026-11-21' });
    assert.equal(cancelamento.fimDeSemana.data, '2027-01-03');
});

test('Programacoes existentes: preserva passadas, datas manuais, arquivos e cancelamentos', () => {
    const casos = [ { ...programa, arquivada: true }, { ...programa, cancelada: true },
        { ...programa, fimDeSemana: { ...programa.fimDeSemana, cancelada: true } },
        { ...programa, fimDeSemana: { ...programa.fimDeSemana, data: '2027-01-01' } } ];
    assert.deepEqual(atualizar(casos), casos);
    assert.deepEqual(atualizar([programa], { hoje: '2027-01-04' }), [programa]);
    const [draft] = atualizar([{ ...programa, publicadaNoQuadro: false }]);
    assert.equal(draft.fimDeSemana.data, '2027-01-02'); assert.equal(draft.agendaPendenteSync, undefined);
});

test('Eventos: visita e celebracao mantem suas datas especiais', () => {
    const visita = { ...semana, evento: 'visita', dataEventoEspecial: '2026-12-29' };
    const cfg = { ...config, grupos: { ...config.grupos, [PT]: { ...config.grupos[PT], eventosAnuais: [{ dataInicio: '2026-12-28', dataInput: '2026-12-29', tipo: 'visita' }] } } };
    const [next] = atualizar([ { ...programa, ...visita, meioSemana: { ...programa.meioSemana, data: '2026-12-29' } } ], { configDepois: cfg });
    assert.equal(next.meioSemana.data, '2026-12-29'); assert.equal(next.fimDeSemana.data, '2027-01-02');
    const celebracao = { ...config, grupos: { ...config.grupos, [PT]: { ...config.grupos[PT], eventosAnuais: [{ dataInicio: '2026-12-28', dataInput: '2027-01-02', tipo: 'celebracao' }] } } };
    assert.deepEqual(atualizar([programa], { configAntes: celebracao, configDepois: config }), [programa]);
});

test('Integracoes: quadro, sugestoes, notificacoes, agenda e historico usam as mesmas datas', async () => {
    const [next] = atualizar([programa]);
    const args = { config, grupoId: PT, programacoes: [next] };
    const fila = criarFilaGrupo(args);
    assert.equal(fila.find(r => r.tipoReuniao === 'fimDeSemana').confirmation.dataISO, '2027-01-02');
    assert.match(fila.find(r => r.tipoReuniao === 'fimDeSemana').preview, /2027-01-02/);
    const eventos = await planejarAgendaGrupo(args);
    assert.match(eventos.find(e => e.identity.tipoReuniao === 'fimDeSemana').start.dateTime, /^2027-01-02/);
    assert.equal(getDataDesignacao(semana, 'fimDeSemana', legado), '2027-01-02');
    const quadro = projetarQuadroPublico({ configuracoes: config, historico_reunioes: [next] });
    assert.equal(quadro.historico_reunioes[0].fimDeSemana.data, '2027-01-02');
    assert.deepEqual(quadro.configuracoes.grupos[PT].fimDeSemana.proximaTroca, fim.proximaTroca);
    const alunos = reconstruirHistoricoGrupo({ ...args, alunos: [{ ...pessoa, historico: [] }], programacaoIds: [next.id], tipos: ['meioSemana', 'fimDeSemana'] });
    assert.deepEqual(alunos[0].historico.map(h => h.data).sort(), ['2026-12-31', '2027-01-02']);
});

test('Fusos: calculo mantem a mesma data em Sao Paulo, UTC e Pacifico', () => {
    const code = `import { getCanonicalMeetingDateISO } from './src/utils/revisarEnviar/dates.js'; console.log(getCanonicalMeetingDateISO(${JSON.stringify({ sem: semana, config: legado, tipoReuniao: 'fimDeSemana' })}));`;
    for (const TZ of ['America/Sao_Paulo', 'UTC', 'Pacific/Auckland']) {
        assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ }, encoding: 'utf8' }).trim(), '2027-01-02');
    }
});

test('Confirmacao enviada: troca preserva identidade, token e respostas e exibe a data atualizada', () => {
    const anterior = criarFilaGrupo({ config: semTroca, grupoId: PT, programacoes: [programa] }).find(r => r.tipoReuniao === 'fimDeSemana');
    const enviada = { ...anterior.confirmation, ownerUid: 'fixture', token: 'link-original', status: 'confirmado',
        responseHistory: [{ status: 'confirmado' }], sentChannels: { mail: '2026-11-21' } };
    const [next] = atualizar([programa]);
    const atual = criarFilaGrupo({ config, grupoId: PT, programacoes: [next], confirmacoes: [enviada] }).find(r => r.tipoReuniao === 'fimDeSemana');
    assert.equal(atual.assignmentKey, anterior.assignmentKey);
    assert.equal(atual.confirmation.token, enviada.token);
    assert.equal(atual.confirmation.status, 'confirmado');
    assert.deepEqual(atual.confirmation.responseHistory, enviada.responseHistory);
    assert.deepEqual(atual.confirmation.sentChannels, enviada.sentChannels);
    assert.equal(atual.confirmation.dataISO, '2027-01-02');
    const publico = resolverConfirmacaoGrupo({ confirmacao: enviada, config, programacoes: [next] });
    assert.equal(publico.isUnavailable, false); assert.equal(publico.dataISO, '2027-01-02');
});

test('Interface: configuracoes exibem vigencia, dia atual e proxima troca em portugues e espanhol', async () => {
    const { createServer } = await import('vite');
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    try {
        const { default: Component } = await server.ssrLoadModule('/src/components/ConfiguracoesGrupos.jsx');
        const { I18nProvider } = await server.ssrLoadModule('/src/i18n/index.js');
        for (const [lang, titulo] of [['pt', 'Próxima troca de dia'], ['es', 'Próximo cambio de día']]) {
            const html = renderToStaticMarkup(createElement(I18nProvider, { lang }, createElement(Component, { config, grupoId: PT, lang, mostrarAcessos: false })));
            assert.ok(html.includes(titulo)); assert.match(html, /2027-01-01/); assert.match(html, /01\/01\/2027/);
            assert.match(html, /value="wednesday" selected/); assert.match(html, /value="saturday" selected/);
        }
    } finally { await server.close(); }
});
