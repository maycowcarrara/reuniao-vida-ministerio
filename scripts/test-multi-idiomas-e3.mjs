import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDadosEnsaioGrupos, createDadosEnsaioReunioes } from '../src/data/ensaioGrupos.js';
import { GRUPO_PORTUGUES_ID as PT, GRUPO_ESPANHOL_ID as ES } from '../src/utils/gruposProgramacao.js';
import { aplicarOperacoesProgramacao, createProgramacoesController, patchConfiguracaoGrupo } from '../src/utils/programacoesPorGrupo.js';
import { prepararAgendamento, prepararGeracaoReunioes, prepararImportacaoMeioSemana, prepararEstadoOcorrencia, prepararEdicaoDiscurso } from '../src/utils/agendamentoReunioes.js';
import { normalizeOcorrenciaReuniao } from '../src/utils/ocorrenciasReuniao.js';

const original = createDadosEnsaioGrupos();
const config = original.configuracoes;
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
freeze(original);
const ctx = (programacoes = [], cfg = config, grupoId = ES) => ({ programacoes, config: cfg, grupoId });
const aplicar = (contexto, resultado) => aplicarOperacoesProgramacao({ ...contexto, operacoes: resultado.operacoes });
const manual = (contexto = ctx(), extra = {}) => prepararAgendamento({ ...contexto, tipo: 'fimDeSemana', data: '2026-12-06', horario: '10:45', ...extra });
const semanal = (cfg = config, tipo = 'fimDeSemana') => patchConfiguracaoGrupo(cfg, { grupoId: ES,
    alteracoes: { [tipo]: { habilitada: true, frequencia: 'semanal', dia: 'sunday', horario: '09:30' } } });
const gerar = (contexto, extra = {}) => prepararGeracaoReunioes({ ...contexto, tipo: 'fimDeSemana', inicio: '2026-11-01', fim: '2026-11-30', ...extra });
const dadosImportados = { semana: '2-8 de noviembre de 2026', dataInicio: '2026-11-02', presidente: null,
    partes: [{ id: 'p1', titulo: '6. ¿Qué dirías?', tipo: 'parte', secao: 'ministerio' }] };
const importar = (contexto, extra = {}) => prepararImportacaoMeioSemana({ ...contexto, dados: dadosImportados, data: '2026-11-04', horario: '19:15', ...extra });

test('fim de semana sem apostila cria slots existentes, orador manual e rascunho inativo sem publicação', () => {
    const [reuniao] = aplicar(ctx(), manual());
    assert.equal(reuniao.id, 'prog-grupo-espanhol-2026-11-30');
    assert.equal(reuniao.fimDeSemana.horario, '10:45');
    assert.equal(reuniao.fimDeSemana.ativo, false);
    assert.equal(reuniao.fimDeSemana.reuniaoPublica.oradorNomeManual, '');
    assert.equal(reuniao.fimDeSemana.presidente, null);
    assert.deepEqual(reuniao.fimDeSemana.responsabilidades.microfonesVolantes, []);
    assert.deepEqual(reuniao.partes, []);
    assert.equal(reuniao.meioSemana.ativo, false);
    assert.equal(reuniao.publicadaNoQuadro, false);
});
test('datas escolhidas não têm teto mensal e não inventam dia/horário ES', () => {
    let lista = [];
    for (const data of ['2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27']) lista = aplicar(ctx(lista), manual(ctx(lista), { data }));
    assert.equal(lista.length, 4);
    assert.throws(() => manual(ctx(), { horario: '' }), /horário/);
    assert.equal(config.grupos[ES].fimDeSemana.dia, null);
    assert.equal(config.grupos[ES].nome, 'Pré-grupo / Grupo de espanhol');
});
test('datas impossíveis, horários inválidos e intervalos não finitos são recusados', () => {
    for (const data of ['2026-02-30', 'x', '', '2026-13-01']) assert.throws(() => manual(ctx(), { data }));
    for (const horario of ['24:00', '9:30', '', '12:60']) assert.throws(() => manual(ctx(), { horario }));
    const contexto = ctx([], semanal());
    for (const extra of [{ inicio: '' }, { fim: '' }, { inicio: '2027-01-01' }, { fim: '2030-01-01' }]) assert.throws(() => gerar(contexto, extra));
});
test('frequência por tipo independe da identificação e ES suporta ambos semanais ainda como grupo', () => {
    const cfg = semanal(semanal(config, 'meioSemana'));
    assert.equal(cfg.grupos[ES].identificacao, 'Pré-grupo / Grupo');
    assert.equal(gerar(ctx([], cfg)).previa.length, 5);
    assert.equal(gerar(ctx([], cfg), { tipo: 'meioSemana' }).previa.length, 5);
    assert.throws(() => gerar(ctx()), /datas explícitas/);
});
test('prévia é pura, finita e repetição da geração é idempotente preservando designados/publicação/metadados', () => {
    const contexto = ctx(original.historico_reunioes, semanal());
    const antes = JSON.stringify(contexto);
    const previa = gerar(contexto);
    assert.equal(JSON.stringify(contexto), antes);
    assert.deepEqual(previa.previa.map(item => item.data), ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29']);
    const lista = aplicar(contexto, previa).map(item => item.fimDeSemana?.data === '2026-11-22' ? {
        ...item, publicadaNoQuadro: true, token: 'preservar', fimDeSemana: { ...item.fimDeSemana, presidente: { id: 'ficticio' } },
    } : item);
    freeze(lista);
    assert.deepEqual(gerar(ctx(lista, contexto.config)).operacoes, []);
    assert.deepEqual(aplicar(ctx(lista, contexto.config), gerar(ctx(lista, contexto.config))), lista);
});
test('cancelamentos persistem inativos e não reabrem por geração, agendamento, importação ou ativação', () => {
    const [programa] = aplicar(ctx(), manual());
    const cancelado = aplicar(ctx([programa]), prepararEstadoOcorrencia({ ...ctx([programa]), tipo: 'fimDeSemana', programacaoId: programa.id, cancelar: true }));
    assert.equal(cancelado[0].fimDeSemana.ativo, false);
    assert.equal(cancelado[0].fimDeSemana.cancelada, true);
    assert.equal(manual(ctx(cancelado)).status, 'cancelada');
    assert.deepEqual(gerar(ctx(cancelado, semanal()), { inicio: '2026-12-01', fim: '2026-12-06' }).operacoes, []);
    assert.throws(() => prepararEstadoOcorrencia({ ...ctx(cancelado), tipo: 'fimDeSemana', programacaoId: programa.id }), /cancelada/);
    const todoCancelado = [{ ...programa, cancelada: true }];
    assert.throws(() => importar(ctx(todoCancelado, semanal(config, 'meioSemana')), { data: '2026-12-02', dados: { ...dadosImportados, dataInicio: '2026-11-30' } }), /cancelada/);
});
test('ativação é explícita e não publica; edição manual preserva slots e desconhecidos', () => {
    const [base] = aplicar(ctx(), manual());
    const lista = [{ ...base, token: 'legado', fimDeSemana: { ...base.fimDeSemana, presidente: { id: 'fixture' }, estranho: 42 } }];
    const ativa = aplicar(ctx(lista), prepararEstadoOcorrencia({ ...ctx(lista), tipo: 'fimDeSemana', programacaoId: base.id }));
    assert.equal(ativa[0].fimDeSemana.ativo, true);
    assert.equal(ativa[0].publicadaNoQuadro, false);
    const editada = aplicar(ctx(ativa), prepararEdicaoDiscurso({ ...ctx(ativa), programacaoId: base.id, valores: { oradorNomeManual: 'Orador fictício', temaDiscurso: 'Tema', presidente: null } }));
    assert.equal(editada[0].fimDeSemana.reuniaoPublica.oradorNomeManual, 'Orador fictício');
    assert.deepEqual(editada[0].fimDeSemana.presidente, { id: 'fixture' });
    assert.equal(editada[0].fimDeSemana.estranho, 42);
    assert.equal(editada[0].token, 'legado');
});
test('mesma semana PT/ES não colide e segunda reunião do mesmo tipo é conflito sem sobrescrita', () => {
    const pt = aplicar(ctx([], config, PT), manual(ctx([], config, PT)));
    const ambos = aplicar(ctx(pt), manual(ctx(pt)));
    assert.equal(ambos.length, 2);
    assert.notEqual(ambos[0].id, ambos[1].id);
    const previa = manual(ctx(ambos), { data: '2026-12-05' });
    assert.equal(previa.status, 'conflito');
    assert.deepEqual(previa.operacoes, []);
    assert.deepEqual(aplicar(ctx(ambos), previa), ambos);
});
test('acrescentar e ativar outro tipo em semana publicada preserva publicação antiga sem publicar a nova ocorrência', () => {
    const cfg = semanal(config, 'meioSemana');
    const publicada = { ...original.historico_reunioes[1], publicadaNoQuadro: true };
    const importada = aplicar(ctx([publicada], cfg), importar(ctx([publicada], cfg)));
    const ativa = aplicar(ctx(importada, cfg), prepararEstadoOcorrencia({ ...ctx(importada, cfg), programacaoId: publicada.id, tipo: 'meioSemana' }));
    assert.equal(ativa[0].publicadaNoQuadro, true);
    assert.equal(normalizeOcorrenciaReuniao(ativa[0], 'fimDeSemana', cfg).publica, true);
    assert.equal(normalizeOcorrenciaReuniao(ativa[0], 'meioSemana', cfg).publica, false);
    assert.equal(ativa[0].meioSemana.ativo, true);
    assert.equal(ativa[0].meioSemana.publicadaNoQuadro, false);
});
test('alterar configuração não move ocorrências e prévia recusa conflito com novo padrão', () => {
    const cfg = semanal();
    const lista = aplicar(ctx([], cfg), manual(ctx([], cfg), { data: '2026-11-08', horario: '12:00' }));
    const alterada = patchConfiguracaoGrupo(cfg, { grupoId: ES, alteracoes: { fimDeSemana: { dia: 'saturday', horario: '16:00' } } });
    const previa = gerar(ctx(lista, alterada), { inicio: '2026-11-02', fim: '2026-11-08' });
    assert.equal(previa.previa[0].status, 'conflito');
    assert.deepEqual(previa.operacoes, []);
    assert.equal(normalizeOcorrenciaReuniao(lista[0], 'fimDeSemana', alterada).horario, '12:00');
    assert.equal(lista[0].fimDeSemana.data, '2026-11-08');
});
test('eventos só do próprio grupo bloqueiam ou acompanham prévia; bloqueados não geram', () => {
    const cfg = structuredClone(semanal());
    cfg.grupos[PT].eventosAnuais = [{ dataInicio: '2026-11-02', tipo: 'assembleia' }];
    cfg.grupos[ES].eventosAnuais = [{ dataInicio: '2026-11-09', tipo: 'assembleia' }, { dataInicio: '2026-11-16', tipo: 'visita' }];
    const previa = gerar(ctx([], cfg), { inicio: '2026-11-02', fim: '2026-11-22' });
    assert.deepEqual(previa.previa.map(item => item.status), ['criar', 'evento', 'criar']);
    const lista = aplicar(ctx([], cfg), previa);
    assert.equal(lista.length, 2);
    assert.equal(lista[1].fimDeSemana.eventoEspecial.tipo, 'visita');
    assert.equal(lista[1].fimDeSemana.data, '2026-11-22');
    assert.equal(lista[0].fimDeSemana.eventoEspecial, undefined);
});
test('importação desabilitada é recusada no domínio inclusive com conteúdo já importado', () => {
    assert.throws(() => importar(ctx()), /desabilitado/);
    assert.throws(() => gerar(ctx(), { tipo: 'meioSemana' }), /desabilitado/);
    const cfg = structuredClone(config); cfg.grupos[ES].ativo = false;
    assert.throws(() => manual(ctx([], cfg)), /inativo/);
});
test('importar ES preserva PT, fimDeSemana completo, ID, publicação e vínculos legados', () => {
    const cfg = semanal(config, 'meioSemana');
    const [pt, es] = original.historico_reunioes;
    const destino = { ...es, id: 'id-antigo-es', publicadaNoQuadro: true, assignmentKey: 'antiga', desconhecido: { a: 1 },
        presidente: { id: 'fixture-presidente' }, fimDeSemana: { ...es.fimDeSemana, token: 'fixture', presidente: { id: 'ficticio' } } };
    freeze(destino);
    const contexto = ctx([pt, destino], cfg);
    const lista = aplicar(contexto, importar(contexto, { dados: { ...dadosImportados, fimDeSemana: { ativo: false }, publicadaNoQuadro: false, desconhecido: null } }));
    assert.deepEqual(lista[0], pt);
    const novo = lista[1];
    assert.deepEqual(novo.fimDeSemana, destino.fimDeSemana);
    assert.equal(novo.id, destino.id);
    assert.equal(novo.assignmentKey, 'antiga');
    assert.deepEqual(novo.presidente, destino.presidente);
    assert.equal(novo.publicadaNoQuadro, true);
    assert.deepEqual(novo.desconhecido, { a: 1 });
    assert.equal(novo.meioSemana.data, '2026-11-04');
    assert.equal(novo.meioSemana.horario, '19:15');
    assert.equal(novo.partes[0].titulo, '6. ¿Qué dirías?');
});
test('importação preserva IDs legados sem grupo e grupoLegadoId mesmo com principal ES', () => {
    const cfg = { ...config, grupoPrincipalId: ES };
    const [pt] = original.historico_reunioes;
    const lista = aplicar(ctx([pt], cfg, PT), importar(ctx([pt], cfg, PT), { data: '2026-11-02' }));
    assert.equal(lista[0].id, pt.id);
    assert.equal(lista[0].grupoId, undefined);
    assert.equal(normalizeOcorrenciaReuniao(lista[0], 'meioSemana', cfg).ativo, true);
    assert.equal(cfg.grupoLegadoId, PT);
});
test('importação preenche ocorrência vazia semanal com horário explícito preservado e não apaga designações', () => {
    const cfg = semanal(config, 'meioSemana');
    const base = aplicar(ctx([], cfg), manual(ctx([], cfg), { tipo: 'meioSemana', data: '2026-11-04', horario: '20:00' }));
    const lista = aplicar(ctx(base, cfg), importar(ctx(base, cfg)));
    assert.equal(lista[0].meioSemana.horario, '20:00');
    assert.deepEqual(importar(ctx(lista, cfg)).operacoes, []);
    const designada = [{ ...lista[0], partes: [{ ...lista[0].partes[0], estudante: { id: 'fixture' } }] }];
    assert.throws(() => importar(ctx(designada, cfg)), /revisão explícita/);
    assert.throws(() => importar(ctx(lista, cfg), { data: '2026-11-05' }), /segunda reunião/);
});
test('importação recusa origem/ID/semana incompatíveis, cancelamento e evento do destino', () => {
    const cfg = semanal(config, 'meioSemana');
    for (const dados of [{ ...dadosImportados, grupoId: PT }, { ...dadosImportados, id: 'id-pt' }, { ...dadosImportados, dataInicio: '2026-12-07' }]) {
        assert.throws(() => importar(ctx([], cfg), { dados }));
    }
    const eventoCfg = structuredClone(cfg); eventoCfg.grupos[ES].eventosAnuais = [{ dataInicio: '2026-11-02', tipo: 'congresso' }];
    assert.throws(() => importar(ctx([], eventoCfg)), /Evento impeditivo/);
    const cancelada = [{ ...original.historico_reunioes[1], meioSemana: { cancelada: true, ativo: false, data: '2026-11-04' } }];
    assert.throws(() => importar(ctx(cancelada, cfg)), /cancelada/);
});
test('controller revalida prévia contra fonte atual sem reabrir cancelamento; falha não grava', async () => {
    let estado = { configuracoes: semanal(), historico_reunioes: [] };
    let gravacoes = 0;
    const controller = createProgramacoesController({ getEstado: () => estado, salvarLote: async lote => {
        gravacoes++; estado = { ...estado, historico_reunioes: [...estado.historico_reunioes.filter(item => !lote.upserts.some(up => up.id === item.id)), ...lote.upserts] };
    }, publicar: () => { throw new Error('Publicação proibida neste teste'); } });
    gerar(ctx([], estado.configuracoes)); // prévia antiga vazia
    estado.historico_reunioes = createDadosEnsaioReunioes().historico_reunioes;
    await controller.executar({ grupoId: ES, preparar: contexto => gerar(contexto) });
    assert.equal(gravacoes, 1);
    assert.equal(estado.historico_reunioes.find(item => item.id === 'fixture-es-cancelada').fimDeSemana.cancelada, true);
    await controller.executar({ grupoId: ES, preparar: contexto => gerar(contexto) });
    assert.equal(gravacoes, 1);
    await assert.rejects(controller.executar({ grupoId: ES, preparar: contexto => importar(contexto) }), /desabilitado/);
    assert.equal(gravacoes, 1);
});

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(() => vite.close());
test('parser real PT/ES alimenta importação local sem ampliar habilitação nem substituir fim de semana', async () => {
    const { extrairDados } = await vite.ssrLoadModule('/src/utils/importador/parser.js');
    for (const [idioma, secao, titulo] of [['pt', 'FAÇA SEU MELHOR NO MINISTÉRIO', '6. O que você diria?'], ['es', 'SEAMOS MEJORES MAESTROS', '6. ¿Qué dirías?']]) {
        const dados = await extrairDados(`${secao}\n${titulo} (5 min)\nAnálise com o auditório.`, 'texto', idioma);
        assert.ok(dados?.partes.length);
        const contexto = ctx(original.historico_reunioes, semanal(config, 'meioSemana'));
        const lista = aplicar(contexto, importar(contexto, { dados: { ...dados, dataInicio: '2026-11-02' } }));
        assert.deepEqual(lista[0], original.historico_reunioes[0]);
        assert.deepEqual(lista[1].fimDeSemana, original.historico_reunioes[1].fimDeSemana);
        assert.ok(lista[1].partes.some(parte => parte.titulo.includes(idioma === 'es' ? 'dirías' : 'diria')));
        assert.deepEqual(original.alunos[0].partesHabilitadas, ['presidente_rvm']);
    }
});
test('agregado preserva arquivamento e junta os dois tipos sem tornar publicação automática', () => {
    const cfg = semanal(config, 'meioSemana');
    const base = aplicar(ctx([], cfg), manual(ctx([], cfg), { data: '2026-11-08' }));
    const arquivada = [{ ...base[0], arquivada: true }];
    assert.equal(manual(ctx(arquivada, cfg), { data: '2026-11-08' }).status, 'arquivada');
    assert.throws(() => importar(ctx(arquivada, cfg)), /arquivada/);
    const juntos = aplicar(ctx(base, cfg), importar(ctx(base, cfg)));
    assert.equal(juntos.length, 1);
    assert.equal(juntos[0].meioSemana.ativo, false);
    assert.equal(juntos[0].fimDeSemana.ativo, false);
    assert.equal(juntos[0].publicadaNoQuadro, false);
});
test('UI PT/ES expõe somente ações E3 e oculta importação/geração desabilitadas sem listeners remotos', async () => {
    const { default: Componente } = await vite.ssrLoadModule('/src/components/ReunioesIndependentes.jsx');
    const { I18nProvider } = await vite.ssrLoadModule('/src/i18n/index.js');
    for (const lang of ['pt', 'es']) {
        const render = props => renderToStaticMarkup(createElement(I18nProvider, { lang }, createElement(Componente, {
            config, grupoId: ES, programacoes: [], onExecutar: () => {}, ...props,
        })));
        const html = render({});
        assert.match(html, /type="date"/);
        assert.match(html, /Pré-grupo/);
        assert.doesNotMatch(html, /Gerar rascunhos|Generar borradores/);
        const importHtml = render({ importar: true });
        assert.doesNotMatch(importHtml, /<textarea|type="date"/);
        const habilitado = render({ importar: true, config: semanal(config, 'meioSemana') });
        assert.match(habilitado, /<textarea/);
        assert.doesNotMatch(habilitado, /https:\/\/|<a /);
    }
});
