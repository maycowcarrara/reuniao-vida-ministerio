import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    aplicarOperacoesProgramacao, createProgramacoesController, mergeCamposPreservados,
    operacoesDaListaDoGrupo, patchConfiguracaoGrupo, selecionarProgramacoesGrupo,
} from '../src/utils/programacoesPorGrupo.js';
import { escolherGrupoAtivo, lerPreferenciaGrupo, salvarPreferenciaGrupo, projetarConfigGrupo } from '../src/utils/grupoAtivo.js';
import { createDadosEnsaioGrupos } from '../src/data/ensaioGrupos.js';
import { GRUPO_PORTUGUES_ID as PT, GRUPO_ESPANHOL_ID as ES, getGruposParticipantes } from '../src/utils/gruposProgramacao.js';

const clone = value => structuredClone(value);
const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
};
const fixture = freeze(createDadosEnsaioGrupos());
const [pt, es] = fixture.historico_reunioes;
const config = fixture.configuracoes;
const apply = (operacoes, grupoId = ES) => aplicarOperacoesProgramacao({ programacoes: fixture.historico_reunioes, config, grupoId, operacoes });

test('patch ES preserva todo o documento PT e campos desconhecidos ES sem mutar a fonte', () => {
    const programas = [pt, { ...es, desconhecido: { manter: true }, fimDeSemana: { ...es.fimDeSemana, token: 'fixture-token' } }];
    freeze(programas);
    const result = aplicarOperacoesProgramacao({ programacoes: programas, config, grupoId: ES,
        operacoes: [{ tipo: 'patch', programacaoId: es.id, alteracoes: { fimDeSemana: { horario: '10:00' } } }] });
    assert.equal(result[0], pt);
    assert.deepEqual(result[1].desconhecido, { manter: true });
    assert.equal(result[1].fimDeSemana.token, 'fixture-token');
    assert.equal(result[1].fimDeSemana.horario, '10:00');
    assert.equal(programas[1].fimDeSemana.horario, '09:30');
});

test('adapter de props filtradas aplica patches ao conjunto completo e omissão não exclui', () => {
    const result = apply(operacoesDaListaDoGrupo({ grupoId: ES, lista: [{ id: es.id, fimDeSemana: { horario: '10:00' } }] }));
    assert.equal(result[0], pt);
    assert.equal(result[1].grupoId, ES);
    assert.equal(result[1].fimDeSemana.data, es.fimDeSemana.data);
    assert.deepEqual(apply(operacoesDaListaDoGrupo({ grupoId: ES, lista: [] })), fixture.historico_reunioes);
    assert.throws(() => operacoesDaListaDoGrupo({ grupoId: PT, lista: [es] }), /outro grupo/);
});

test('operações por ID recusam troca de grupo, ID, versão e acesso cruzado', () => {
    for (const alteracoes of [{ grupoId: PT }, { grupoId: '' }, { grupoId: null }, { id: 'outro' }, { versaoProgramacao: 1 }]) {
        assert.throws(() => apply([{ tipo: 'patch', programacaoId: es.id, alteracoes }]));
    }
    for (const tipo of ['patch', 'excluir', 'arquivar']) {
        assert.throws(() => apply([{ tipo, programacaoId: pt.id }]), /outro grupo/);
        assert.throws(() => apply([{ tipo, programacaoId: 'inexistente' }]), /não encontrada/);
    }
    assert.throws(() => apply([{ tipo: 'upsert', programacao: { ...es, id: pt.id } }]), /outro grupo/);
});

test('arquivar, restaurar e excluir afetam somente IDs do grupo capturado', () => {
    const arquivadas = apply([{ tipo: 'arquivar', programacaoId: es.id, agoraIso: '2026-10-24T12:00:00Z' }]);
    assert.equal(arquivadas[0], pt);
    assert.equal(arquivadas[1].arquivada, true);
    const restauradas = aplicarOperacoesProgramacao({ programacoes: arquivadas, config, grupoId: ES,
        operacoes: [{ tipo: 'arquivar', programacaoId: es.id, arquivada: false }] });
    assert.equal(restauradas[1].arquivada, false);
    assert.deepEqual(apply([{ tipo: 'excluir', programacaoId: es.id }]), [pt]);
});

test('novo documento é rascunho com grupo/ID determinístico e colisão na semana é recusada', () => {
    const result = apply([{ tipo: 'upsert', programacao: { dataInicio: '2026-11-09', publicadaNoQuadro: true } }]);
    const novo = result.at(-1);
    assert.equal(novo.id, 'prog-grupo-espanhol-2026-11-09');
    assert.equal(novo.grupoId, ES);
    assert.equal(novo.publicadaNoQuadro, false);
    assert.equal(novo.meioSemana.ativo, false);
    assert.throws(() => apply([{ tipo: 'upsert', programacao: { id: 'id-diferente', dataInicio: '2026-11-02' } }]), /Já existe/);
    assert.throws(() => apply([{ tipo: 'patch', programacaoId: es.id, alteracoes: { dataInicio: '2026-11-09' } }]), /Movimentação/);
});

test('atualizar legado preserva ausência de campos v2, IDs e vínculos', () => {
    const legado = { ...pt, token: 'token-antigo', calendario: 'evento-antigo' };
    const result = aplicarOperacoesProgramacao({ programacoes: [legado, es], config, grupoId: PT,
        operacoes: [{ tipo: 'upsert', programacao: { id: legado.id, arquivada: true } }] });
    assert.deepEqual(result[0], { ...legado, arquivada: true });
    assert.equal(result[0].grupoId, undefined);
    assert.equal(result[0].versaoProgramacao, undefined);
    assert.equal(result[1], es);
    const marcado = aplicarOperacoesProgramacao({ programacoes: [legado, es], config, grupoId: PT,
        operacoes: [{ tipo: 'patch', programacaoId: legado.id, alteracoes: { grupoId: PT } }] });
    assert.equal(marcado[0].meioSemana.ativo, true);
    assert.equal(marcado[0].publicadaNoQuadro, false);
});

test('datas explícitas de fim de semana não movem silenciosamente o agregado nem seus vínculos', () => {
    assert.throws(() => apply([{ tipo: 'patch', programacaoId: es.id,
        alteracoes: { fimDeSemana: { data: '2026-11-15' } } }]), /fora da semana/);
    const semDataSemanal = { ...es, dataInicio: undefined };
    assert.throws(() => aplicarOperacoesProgramacao({ programacoes: [semDataSemanal], config, grupoId: ES,
        operacoes: [{ tipo: 'patch', programacaoId: es.id, alteracoes: { dataInicio: '2026-11-09' } }] }), /Movimentação/);
});

test('configuração ES/principal preserva espelhos PT, eventos, alunos e datas de ocorrências', () => {
    const snapshot = JSON.stringify(fixture);
    const next = patchConfiguracaoGrupo(config, { grupoId: ES, alteracoes: {
        nome: 'Pré-grupo / Grupo de espanhol', fimDeSemana: { frequencia: 'semanal', dia: 'sunday', horario: '10:00' },
        meioSemana: { habilitada: true, dia: 'tuesday', horario: '19:00' },
    }, grupoPrincipalId: ES });
    assert.equal(next.grupoPrincipalId, ES);
    assert.equal(next.grupoLegadoId, PT);
    assert.equal(next.nome_cong, config.nome_cong);
    assert.deepEqual(next.grupos[PT], config.grupos[PT]);
    assert.equal(next.grupos[ES].identificacao, 'Pré-grupo / Grupo');
    assert.equal(next.grupos[ES].fimDeSemana.frequencia, 'semanal');
    assert.equal(JSON.stringify(fixture), snapshot);
    assert.deepEqual(getGruposParticipantes(fixture.alunos[0], next), [PT]);
    const ptAtualizada = patchConfiguracaoGrupo(next, { grupoId: PT, alteracoes: { nome: 'Novo nome PT' } });
    assert.equal(ptAtualizada.nome_cong, 'Novo nome PT');
    assert.deepEqual(ptAtualizada.grupos[ES], next.grupos[ES]);
});

test('configuração exige grupo principal ativo e dia/horário para recorrência semanal', () => {
    assert.throws(() => patchConfiguracaoGrupo(config, { grupoId: PT, alteracoes: { ativo: false } }), /principal/);
    assert.throws(() => patchConfiguracaoGrupo(config, { grupoId: ES, alteracoes: { fimDeSemana: { frequencia: 'semanal' } } }), /dia e horário/);
    assert.throws(() => patchConfiguracaoGrupo(config, { grupoId: ES, alteracoes: { id: PT } }), /imutável/);
    assert.throws(() => mergeCamposPreservados({}, JSON.parse('{"__proto__":{"injetado":true}}')), /inválido/);
});

test('preferência é por dono; fallback válido não usa app_lang e storage pode falhar', () => {
    const items = new Map();
    const storage = { getItem: key => items.get(key), setItem: (key, value) => items.set(key, value) };
    salvarPreferenciaGrupo(storage, 'dono1', ES);
    salvarPreferenciaGrupo(storage, 'dono2', PT);
    assert.equal(lerPreferenciaGrupo(storage, 'dono1'), ES);
    assert.equal(lerPreferenciaGrupo(storage, 'dono2'), PT);
    assert.deepEqual([...items.keys()], ['rvm_grupo_ativo:v2:dono1', 'rvm_grupo_ativo:v2:dono2']);
    assert.equal(escolherGrupoAtivo({ ...config, preferencia: ES }), ES);
    assert.equal(escolherGrupoAtivo({ ...config, preferencia: 'inexistente' }), PT);
    assert.equal(escolherGrupoAtivo({ ...config, grupoPrincipalId: ES }), ES);
    const inativo = { ...config.grupos, [ES]: { ...config.grupos[ES], ativo: false } };
    assert.equal(escolherGrupoAtivo({ ...config, grupos: inativo, preferencia: ES }), PT);
    const falha = { getItem: () => { throw new Error('storage'); }, setItem: () => { throw new Error('storage'); } };
    assert.equal(lerPreferenciaGrupo(falha, 'dono1'), null);
    assert.doesNotThrow(() => salvarPreferenciaGrupo(falha, 'dono1', ES));
    assert.equal(escolherGrupoAtivo({ grupos: {} }), null);
    assert.equal(projetarConfigGrupo(config, ES).nome_cong, 'Pré-grupo / Grupo de espanhol');
    assert.equal(config.nome_cong, 'Congregação de ensaio local');
});

const createHarness = ({ salvarFalha = false, publicarFalha = false, esperar = Promise.resolve() } = {}) => {
    let estado = clone(fixture);
    const publicacoes = [];
    const lotes = [];
    const controller = createProgramacoesController({
        getEstado: () => estado,
        salvarLote: async lote => {
            await esperar;
            if (salvarFalha) throw new Error('gravação-fixture');
            lotes.push(lote);
            estado = { ...estado, historico_reunioes: [...estado.historico_reunioes.filter(item =>
                !lote.excluirIds.includes(item.id) && !lote.upserts.some(next => next.id === item.id)), ...lote.upserts] };
        },
        publicar: async payload => { if (publicarFalha) throw new Error('publicação-fixture'); publicacoes.push(payload); },
    });
    return { controller, getEstado: () => estado, publicacoes, lotes };
};

test('publicação explícita usa fonte completa; edição simples não publica', async () => {
    const h = createHarness();
    await h.controller.patchProgramacao({ grupoId: ES, programacaoId: es.id, alteracoes: { fimDeSemana: { horario: '10:00' } } });
    assert.equal(h.publicacoes.length, 0);
    assert.equal(h.lotes[0].upserts.length, 1);
    assert.equal(h.lotes[0].upserts[0].grupoId, ES);
    const result = await h.controller.executar({ grupoId: ES, operacoes: [], republicar: true });
    assert.equal(result.publicado, true);
    assert.equal(h.publicacoes[0].historico_reunioes.length, 2);
    assert.deepEqual(h.publicacoes[0].historico_reunioes.find(item => item.id === pt.id), pt);
});

test('falha de gravação não publica; falha de publicação informa sucesso parcial sem perder dados', async () => {
    const failSave = createHarness({ salvarFalha: true });
    await assert.rejects(failSave.controller.executar({ grupoId: ES, republicar: true,
        operacoes: [{ tipo: 'patch', programacaoId: es.id, alteracoes: { arquivada: true } }] }), /gravação-fixture/);
    assert.deepEqual(failSave.getEstado(), fixture);
    assert.equal(failSave.publicacoes.length, 0);
    const failPublish = createHarness({ publicarFalha: true });
    const result = await failPublish.controller.executar({ grupoId: ES, republicar: true,
        operacoes: [{ tipo: 'patch', programacaoId: es.id, alteracoes: { arquivada: true } }] });
    assert.equal(result.salvo, true);
    assert.equal(result.publicado, false);
    assert.match(result.erroPublicacao.message, /publicação-fixture/);
    assert.equal(failPublish.getEstado().historico_reunioes.find(item => item.id === es.id).arquivada, true);
    assert.deepEqual(failPublish.getEstado().historico_reunioes.find(item => item.id === pt.id), pt);
});

test('operação pendente mantém grupo/IDs de origem e recusa cliques duplicados', async () => {
    let liberar;
    const esperar = new Promise(resolve => { liberar = resolve; });
    const h = createHarness({ esperar });
    let selecionado = ES;
    const pedido = { grupoId: selecionado, programacaoId: es.id, alteracoes: { arquivada: true } };
    const primeira = h.controller.patchProgramacao(pedido);
    selecionado = PT;
    await assert.rejects(h.controller.patchProgramacao({ grupoId: selecionado, programacaoId: pt.id, alteracoes: { arquivada: true } }), /andamento/);
    liberar();
    await primeira;
    assert.equal(h.lotes.length, 1);
    assert.equal(h.lotes[0].grupoId, ES);
    assert.deepEqual(h.getEstado().historico_reunioes.find(item => item.id === pt.id), pt);
    await h.controller.arquivarProgramacoes({ grupoId: ES, ids: [es.id], arquivada: false });
    await h.controller.excluirProgramacoes({ grupoId: ES, ids: [es.id] });
    assert.deepEqual(h.getEstado().historico_reunioes, [pt]);
});

test('fonte completa atualizada é usada a cada operação, sem restaurar documento excluído', async () => {
    const h = createHarness();
    await h.controller.excluirProgramacoes({ grupoId: ES, ids: [es.id] });
    await h.controller.patchProgramacao({ grupoId: PT, programacaoId: pt.id, alteracoes: { arquivada: true } });
    assert.equal(h.getEstado().historico_reunioes.length, 1);
    assert.equal(h.getEstado().historico_reunioes[0].id, pt.id);
});

let server;
after(async () => { await server?.close(); });
test('renderização local PT/ES: seletor acessível, configuração e cadastro vazio ainda oferecem os grupos', async () => {
    server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, entries: [] } });
    const { I18nProvider } = await server.ssrLoadModule('/src/i18n/index.js');
    const { default: Seletor } = await server.ssrLoadModule('/src/components/SeletorGrupo.jsx');
    const { default: Configuracoes } = await server.ssrLoadModule('/src/components/ConfiguracoesGrupos.jsx');
    const { default: Form } = await server.ssrLoadModule('/src/components/ListaAlunos/ModalFormulario.jsx');
    const { TRANSLATIONS, CARGOS_MAP_FALLBACK } = await server.ssrLoadModule('/src/components/ListaAlunos/utils.js');
    for (const lang of ['pt', 'es']) {
        const html = renderToStaticMarkup(createElement(I18nProvider, { lang }, createElement(Seletor,
            { grupos: config.grupos, grupoId: ES, onChange: () => {} })));
        assert.match(html, /aria-pressed="true"/);
        assert.match(html, /Pré-grupo \/ Grupo de espanhol/);
        assert.match(html, /PT/);
        assert.match(html, /ES/);
        const settings = renderToStaticMarkup(createElement(I18nProvider, { lang }, createElement(Configuracoes,
            { config, grupoId: ES, lang, onSalvar: () => {} })));
        assert.match(settings, /Pré-grupo \/ Grupo de espanhol/);
        assert.match(settings, /value="datas" selected/);
        const form = renderToStaticMarkup(createElement(I18nProvider, { lang }, createElement(Form, {
            alunoEmEdicao: { nome: '', tipo: 'irma', gruposParticipantes: [PT] }, setAlunoEmEdicao: () => {},
            isOpen: true, onClose: () => {}, onSave: () => {}, cargosMap: CARGOS_MAP_FALLBACK,
            t: TRANSLATIONS[lang], lang, multiGrupos: true, config,
        })));
        assert.match(form, /Português/);
        assert.match(form, /Español/);
        assert.match(form, lang === 'pt' ? /Participa das programações/ : /Participa en los programas/);
        const groupControls = form.slice(form.indexOf('<legend'), form.indexOf('</fieldset>'));
        assert.equal((groupControls.match(/checked=""/g) || []).length, 1);
    }
});
