import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeGruposProgramacao, createParticipacaoAlunoDefault, getGruposParticipantes, validarParticipacaoAluno } from '../src/utils/gruposProgramacao.js';
import { patchConfiguracoesGrupos, patchConfiguracaoGrupo, aplicarOperacoesProgramacao } from '../src/utils/programacoesPorGrupo.js';
import { prepararAgendamento, prepararImportacaoMeioSemana } from '../src/utils/agendamentoReunioes.js';
import { listarSlotsReuniao, classificarCandidatosGrupo, prepararAtribuicaoGrupo } from '../src/utils/designacoesPorGrupo.js';
import { criarFilaGrupo } from '../src/utils/integracoesGrupo.js';
import { createIntegracoesLocais } from '../src/services/integracoesLocais.js';
import { gruposPublicadosDisponiveis, projetarQuadroPublico } from '../src/utils/quadroPublico.js';
import { escolherGrupoAtivo } from '../src/utils/grupoAtivo.js';
const PT = 'grupo-portugues', ES = 'grupo-espanhol';
const inicial = () => normalizeGruposProgramacao({ idioma: 'pt', nome_cong: 'Congregação local', segredo: 'preservar' });
const somenteES = config => patchConfiguracoesGrupos(config, { grupoPrincipalId: ES, alteracoesPorGrupo: { [PT]: { ativo: false } } });

for (const [pt, es, esperado] of [[true,true,PT], [true,false,PT], [false,true,ES]]) test(`Adendo A: novo cadastro PT=${pt} ES=${es}, independente de idioma/principal`, () => {
    const config = inicial(); config.grupos[PT].ativo = pt; config.grupos[ES].ativo = es;
    config.grupoPrincipalId = ES; config.grupoSelecionadoId = ES;
    assert.deepEqual(createParticipacaoAlunoDefault(config), [esperado]);
    const escolha = createParticipacaoAlunoDefault(config); escolha.push('nao-altera-default');
    assert.deepEqual(createParticipacaoAlunoDefault(config), [esperado]);
    assert.deepEqual(getGruposParticipantes({ id: 'legado' }, config), [PT]);
});

test('Adendo A: nenhum grupo ativo é inválido, inclusive para novo cadastro', () => {
    const config = inicial(); Object.values(config.grupos).forEach(g => g.ativo = false);
    assert.throws(() => createParticipacaoAlunoDefault(config), /ativo/);
    assert.throws(() => patchConfiguracoesGrupos(config, {}), /ativo/);
});

test('Adendo A: salvar PT ou ES preserva integralmente o outro, geral e grupo legado', () => {
    for (const [id,outro] of [[PT,ES],[ES,PT]]) {
        const config = inicial(), antes = structuredClone(config);
        const next = patchConfiguracaoGrupo(config, { grupoId: id, alteracoes: { nome: 'Novo nome', identificacao: 'Congregación' } });
        assert.deepEqual(next.grupos[outro], antes.grupos[outro]);
        assert.equal(next.grupoLegadoId, PT); assert.equal(next.segredo, 'preservar');
        assert.deepEqual(config, antes); assert.equal(next.grupos[id].meioSemana.habilitada, config.grupos[id].meioSemana.habilitada);
    }
});

test('Adendo A: transição atômica somente ES e conflito de configuração não sobrescrevem rascunhos', () => {
    const config = inicial(), original = structuredClone(config);
    const next = somenteES(config);
    assert.equal(next.grupoPrincipalId, ES); assert.equal(next.grupos[PT].ativo, false);
    assert.equal(next.grupoLegadoId, PT);
    assert.throws(() => patchConfiguracoesGrupos(next, { configOriginal: original, alteracoesPorGrupo: config.grupos }), /configuracaoConflito/);
    assert.equal(escolherGrupoAtivo({ ...next, preferencia: PT }), ES);
    assert.deepEqual(createParticipacaoAlunoDefault(config), [PT]);
});

test('Adendo A: formulário aberto não troca escolhas; gravação rejeita nova participação inativa e conserva antiga', () => {
    const config = inicial(), novo = { gruposParticipantes: createParticipacaoAlunoDefault(config) };
    const next = somenteES(config);
    assert.throws(() => validarParticipacaoAluno(novo, next), /participacaoInativa/);
    assert.deepEqual(novo.gruposParticipantes, [PT]);
    assert.doesNotThrow(() => validarParticipacaoAluno({ gruposParticipantes: [PT,ES] }, next, { gruposParticipantes: [PT] }));
    for (const escolha of [[],[PT],[ES],[PT,ES]]) {
        const pessoa = { id: 'antiga', gruposParticipantes: escolha, partesHabilitadas: ['o_que_voce_diria'], historico: [{ token: 'preservar' }] };
        const antes = structuredClone(pessoa);
        validarParticipacaoAluno(pessoa, next, pessoa);
        assert.deepEqual(pessoa, antes);
    }
});

for (const exclusivo of [false,true]) test(`Adendo A: fluxo integrado ${exclusivo ? 'somente ES' : 'simultâneo'} sem importação, sugestão, designação, revisão/envio simulado e quadro`, async () => {
    const config = exclusivo ? somenteES(inicial()) : inicial();
    const pt = { id: 'pt-legado', dataInicio: '2026-12-07', semana: '7-13 de dezembro de 2026', partes: [], presidente: { id:'antigo', nome:'Antigo' }, publicadaNoQuadro: true, token:'preservar', calendarId:'evento-original' };
    const antesPT = structuredClone(pt);
    let programacoes = [pt];
    const pedido = prepararAgendamento({ config, grupoId: ES, programacoes, tipo: 'fimDeSemana', data: '2026-12-13', horario: '10:45' });
    programacoes = aplicarOperacoesProgramacao({ config, grupoId: ES, programacoes, operacoes: pedido.operacoes });
    let es = programacoes.find(p => p.grupoId === ES);
    // Atividade e publicação permanecem ações explícitas.
    es.fimDeSemana.ativo = true;
    es.partes = [{ id: 'inativa', titulo: 'Conteúdo conservado' }];
    const alunos = [{ id:'novo-es', nome:'Pessoa local', tipo:'anciao', partesHabilitadas:['presidente_fds'],
        gruposParticipantes: exclusivo ? createParticipacaoAlunoDefault(config) : [PT,ES] }];
    const cargosMap = { anciao: { gen:'M' } };
    const slot = listarSlotsReuniao(es,'fimDeSemana').find(s => s.slotKey === 'presidente_fds');
    const ctx = { config, grupoId: ES, programacoes, alunos, cargosMap, programacaoId: es.id, tipo:'fimDeSemana', slotId:slot.slotId };
    const candidatos = classificarCandidatosGrupo({ ...ctx, programacao:es, slot });
    assert.ok(candidatos.some(c => c.aluno.id === 'novo-es'));
    const atribuicao = prepararAtribuicaoGrupo({ ...ctx, alunoId:'novo-es' });
    programacoes = aplicarOperacoesProgramacao({ ...ctx, operacoes:atribuicao.operacoes });
    es = programacoes.find(p => p.grupoId === ES);
    assert.equal(es.fimDeSemana.presidente.id,'novo-es'); assert.equal(es.partes[0].id,'inativa');
    const fila = criarFilaGrupo({ config, grupoId:ES, programacoes });
    assert.equal(fila.length,1); assert.equal(fila[0].lang,'es');
    const integracoes = createIntegracoesLocais({ getEstado: () => ({ configuracoes: config, historico_reunioes: programacoes }), now: () => '2026-10-24T20:00:00Z' });
    const enviada = await integracoes.send({ data: fila[0].confirmation, channel:'mail', transport: async () => ({ sucesso:true }) });
    assert.ok(enviada.sentChannels.mail);
    assert.deepEqual(gruposPublicadosDisponiveis(programacoes,config)[ES], undefined);
    es.publicadaNoQuadro = true; es.fimDeSemana.publicadaNoQuadro = true;
    const quadro = projetarQuadroPublico({ configuracoes:config, historico_reunioes:programacoes });
    assert.ok(quadro.historico_reunioes.some(p => p.grupoId === ES));
    assert.equal(Object.keys(gruposPublicadosDisponiveis(quadro.historico_reunioes,quadro.configuracoes)).length, exclusivo ? 1 : 2);
    assert.deepEqual(programacoes.find(p => p.id === pt.id),antesPT);
    const reativada = patchConfiguracaoGrupo(config,{ grupoId:PT, alteracoes:{ ativo:true } });
    assert.equal(reativada.grupoLegadoId,PT); assert.equal(reativada.grupoPrincipalId,config.grupoPrincipalId);
    assert.deepEqual(alunos[0].gruposParticipantes, exclusivo ? [ES] : [PT,ES]);
});




test('Adendo A: configuração normalizada equivale ao mapa salvo com outra ordem de campos', () => {
    const config = inicial();
    const inverter = value => Array.isArray(value) ? value.map(inverter) : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).reverse().map(([k,v]) => [k,inverter(v)])) : value;
    assert.doesNotThrow(() => patchConfiguracoesGrupos(inverter(config), { configOriginal:config, alteracoesPorGrupo: { [ES]: { nome:'Novo nome ES' } } }));
});

test('Adendo A: somente ES pode habilitar meio de semana e importar sem alterar fim de semana ou identificação', () => {
    const original = somenteES(inicial());
    const config = patchConfiguracaoGrupo(original, { grupoId:ES, alteracoes: { meioSemana: { habilitada:true, dia:'wednesday', horario:'19:15' } } });
    assert.equal(config.grupos[ES].identificacao,original.grupos[ES].identificacao);
    const ctx = { config, grupoId:ES, programacoes:[] };
    const fds = prepararAgendamento({ ...ctx, tipo:'fimDeSemana', data:'2026-12-13', horario:'10:45' });
    const programacoes = aplicarOperacoesProgramacao({ ...ctx, operacoes:fds.operacoes });
    const antes = structuredClone(programacoes[0].fimDeSemana);
    const dados = { semana:'7-13 de diciembre de 2026', dataInicio:'2026-12-07', partes:[{ id:'parte-es', titulo:'Tesoros de la Biblia', secao:'tesouros' }] };
    const importacao = prepararImportacaoMeioSemana({ ...ctx, programacoes, dados, data:'2026-12-09', horario:'19:15' });
    const [next] = aplicarOperacoesProgramacao({ ...ctx, programacoes, operacoes:importacao.operacoes });
    assert.equal(next.id,programacoes[0].id); assert.deepEqual(next.fimDeSemana,antes);
    assert.equal(next.partes[0].id,'parte-es'); assert.equal(config.grupoLegadoId,PT);
});


test('Adendo A: configuração em PT/ES identifica Geral e ambos os grupos sem seletor duplicado', async () => {
    const { createServer } = await import('vite');
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const server = await createServer({ server: { middlewareMode:true, hmr:false }, appType:'custom' });
    try {
        const { I18nProvider, getSectionMessages } = await server.ssrLoadModule('/src/i18n/index.js');
        const { default: Configuracoes } = await server.ssrLoadModule('/src/components/ConfiguracoesGrupos.jsx');
        const config = somenteES(inicial()); config.grupos[ES].identificacao = 'Congregación';
        for (const lang of ['pt','es']) {
            const T = getSectionMessages('gruposProgramacao', lang);
            const html = renderToStaticMarkup(createElement(I18nProvider,{ lang },createElement(Configuracoes,{ config, grupoId:ES, lang, mostrarAcessos:true, onDesignar(){} })));
            for (const texto of [T.geral,T.padraoAbrir,T.inativo,T.somenteFimDeSemana,T.irAgendar,'Español','Português','Congregación']) assert.ok(html.includes(texto), texto);
            assert.doesNotMatch(html,/Idioma do [Ss]istema|Idioma del [Ss]istema|🇧🇷|🇪🇸/);
            assert.match(html,/form="config-grupos"/);
        }
    } finally { await server.close(); }
});
