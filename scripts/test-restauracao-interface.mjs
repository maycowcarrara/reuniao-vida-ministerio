import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prepararEdicaoClassica, criarReferenciasInterfaceClassica, projetarProgramaOperacionalInterface, avaliarSlotClassico } from '../src/utils/interfaceClassicaGrupos.js';
import { normalizeGruposProgramacao } from '../src/utils/gruposProgramacao.js';
import { projetarConfigGrupo } from '../src/utils/grupoAtivo.js';
import { buildLegacyAssignmentKey } from '../src/utils/assignmentIdentity.js';
import { selecionarDesignacoes } from '../src/utils/designacoesPorGrupo.js';
import { legacyKeyFromDesignacao } from '../src/utils/integracoesGrupo.js';
import { createProgramacoesController, operacoesDaListaDoGrupo } from '../src/utils/programacoesPorGrupo.js';
import { projetarQuadroPublico } from '../src/utils/quadroPublico.js';
const PT = 'grupo-portugues', ES = 'grupo-espanhol';
const config = normalizeGruposProgramacao({ idioma: 'pt', nome_cong: 'Congregação fictícia', ativacaoMultiGrupos: { contrato: 2, status: 'ativa' } });
const pessoa = { id: 'pessoa', nome: 'Pessoa fictícia', tipo: 'anciao', gruposParticipantes: [PT], partesHabilitadas: ['presidente_rvm'] };
const cargosMap = { anciao: { gen: 'M' } };
const programa = { id: 'semana-fixture', grupoId: PT, versaoProgramacao: 2, publicadaNoQuadro: true, semana: '2-8 de novembro de 2026',
    meioSemana: { ativo: true, data: '2026-11-05', horario: '19:30' }, fimDeSemana: { ativo: false }, partes: [], presidente: null, desconhecido: 'preservar' };
const preparar = next => prepararEdicaoClassica({ anteriores: [programa], proximas: [next], config, grupoId: PT, alunos: [pessoa], cargosMap });

const ensaioArquivamento = ({ falhaSalvar = false, falhaPublicar = false, programas } = {}) => {
    let estado = { configuracoes: config, historico_reunioes: programas || [
        { ...programa, presidente: pessoa },
        { ...programa, id: 'segunda-semana', semana: '9-15 de novembro de 2026', dataInicio: '2026-11-09',
            meioSemana: { ativo: true, data: '2026-11-12', horario: '19:30' } },
        { ...programa, id: 'espanhol', grupoId: ES, meioSemana: { ativo: false },
            fimDeSemana: { ativo: true, data: '2026-11-08', horario: '10:45' } },
    ] };
    let quadro = projetarQuadroPublico(estado);
    const etapas = [];
    const controller = createProgramacoesController({ getEstado: () => estado,
        salvarLote: async ({ upserts }) => {
            if (falhaSalvar) throw new Error('falha-salvar');
            etapas.push('salvar');
            estado = { ...estado, historico_reunioes: estado.historico_reunioes.map(p => upserts.find(n => n.id === p.id) || p) };
        },
        publicar: async payload => {
            etapas.push('publicar');
            if (falhaPublicar) throw new Error('falha-publicar');
            assert.deepEqual(payload.historico_reunioes, estado.historico_reunioes);
            quadro = projetarQuadroPublico(payload);
        } });
    return { controller, etapas, estado: () => estado, quadro: () => quadro, permitirPublicacao: () => { falhaPublicar = false; } };
};

for (const fluxo of ['lista individual', 'lista em lote', 'operação por ID']) {
    test(`Arquivar e restaurar sincroniza o quadro automaticamente: ${fluxo}`, async () => {
        const h = ensaioArquivamento();
        const original = structuredClone(h.estado().historico_reunioes);
        const alvos = fluxo === 'lista em lote' ? original.filter(p => p.grupoId === PT) : [original[0]];
        const ids = alvos.map(p => p.id);
        const espanhol = h.quadro().historico_reunioes.find(p => p.id === 'espanhol');
        for (const arquivada of [true, false]) {
            const alteradas = original.filter(p => p.grupoId === PT).map(p => ids.includes(p.id)
                ? { ...p, arquivada, arquivadaEm: arquivada ? '2026-10-25T12:00:00Z' : null } : p);
            const resultado = fluxo === 'operação por ID'
                ? await h.controller.arquivarProgramacoes({ grupoId: PT, ids, arquivada })
                : await h.controller.executar({ grupoId: PT, operacoes: operacoesDaListaDoGrupo({ grupoId: PT, lista: alteradas }) });
            assert.equal(resultado.salvo, true);
            assert.equal(resultado.publicado, true);
            for (const id of ids) assert.equal(h.quadro().historico_reunioes.some(p => p.id === id), !arquivada);
            assert.deepEqual(h.quadro().historico_reunioes.find(p => p.id === 'espanhol'), espanhol);
        }
        assert.deepEqual(h.etapas, ['salvar', 'publicar', 'salvar', 'publicar']);
        for (const p of h.estado().historico_reunioes.filter(p => ids.includes(p.id))) {
            const { arquivada, arquivadaEm, ...conteudo } = p;
            assert.equal(arquivada, false); assert.equal(arquivadaEm, null);
            assert.deepEqual(conteudo, original.find(old => old.id === p.id));
        }
    });
}

test('Restaurar conserva rascunhos, ocorrências ocultas e cancelamentos', async () => {
    const programas = [
        { ...programa, arquivada: true, publicadaNoQuadro: false },
        { ...programa, id: 'ocorrencia-oculta', arquivada: true, meioSemana: { ...programa.meioSemana, publicadaNoQuadro: false } },
        { ...programa, id: 'cancelada', arquivada: true, meioSemana: { ...programa.meioSemana, cancelada: true } },
    ];
    const h = ensaioArquivamento({ programas });
    const resultado = await h.controller.arquivarProgramacoes({ grupoId: PT, ids: programas.map(p => p.id), arquivada: false });
    assert.equal(resultado.publicado, true);
    assert.equal(h.quadro().historico_reunioes.length, 0);
    assert.equal(h.estado().historico_reunioes[0].publicadaNoQuadro, false);
    assert.equal(h.estado().historico_reunioes[1].meioSemana.publicadaNoQuadro, false);
    assert.equal(h.estado().historico_reunioes[2].meioSemana.cancelada, true);
});

test('Restauração: falha ao salvar não publica; falha ao publicar permite republicar depois', async () => {
    const programas = [{ ...programa, arquivada: true }];
    const falha = ensaioArquivamento({ programas, falhaSalvar: true });
    await assert.rejects(falha.controller.arquivarProgramacoes({ grupoId: PT, ids: [programa.id], arquivada: false }), /falha-salvar/);
    assert.deepEqual(falha.etapas, []);
    const h = ensaioArquivamento({ programas, falhaPublicar: true });
    const resultado = await h.controller.arquivarProgramacoes({ grupoId: PT, ids: [programa.id], arquivada: false });
    assert.equal(resultado.salvo, true); assert.equal(resultado.publicado, false);
    assert.match(resultado.erroPublicacao.message, /falha-publicar/);
    assert.equal(h.estado().historico_reunioes[0].arquivada, false);
    assert.equal(h.quadro().historico_reunioes.length, 0);
    h.permitirPublicacao();
    await h.controller.executar({ grupoId: PT, operacoes: [], republicar: true });
    assert.equal(h.quadro().historico_reunioes.length, 1);
});
test('Interface clássica: atribuição usa cadastro atual e conserva identidade/conteúdo', () => {
    const [next] = preparar({ ...programa, presidente: pessoa });
    assert.equal(next.id, programa.id); assert.equal(next.desconhecido, 'preservar');
    assert.equal(next.meioSemana.data, '2026-11-05');
});
test('Interface clássica: pessoa sem participação ou reunião cancelada não pode ser alterada', () => {
    for (const alteracoes of [{ presidente: { id: 'fora' } }, { presidente: pessoa, meioSemana: { ...programa.meioSemana, cancelada: true } }, { grupoId: ES }]) assert.throws(() => preparar({ ...programa, ...alteracoes }));
    assert.throws(() => prepararEdicaoClassica({ anteriores: [programa], proximas: [{ ...programa, presidente: pessoa }], config, grupoId: PT,
        alunos: [{ ...pessoa, gruposParticipantes: [ES] }], cargosMap }), /participa/);
});
test('Interface clássica: publicação antiga também atualiza marca explícita da ocorrência', () => {
    const old = { ...programa, publicadaNoQuadro: false, meioSemana: { ...programa.meioSemana, publicadaNoQuadro: false } };
    const [next] = prepararEdicaoClassica({ anteriores: [old], proximas: [{ ...old, publicadaNoQuadro: true }], config, grupoId: PT, alunos: [pessoa], cargosMap });
    assert.equal(next.meioSemana.publicadaNoQuadro, true);
});
test('Interface clássica: confirmações existentes reutilizam chave/token e novas recebem identidade v2', () => {
    const p = { ...programa, presidente: pessoa };
    const item = selecionarDesignacoes({ programacoes: [p], config })[0];
    const legacy = legacyKeyFromDesignacao(item, config);
    const c = { assignmentKey: legacy, token: 'fixture-only', status: 'confirmado' };
    const old = criarReferenciasInterfaceClassica({ programacoes: [p], config, grupoId: PT, confirmacoes: [c] });
    const fields = { dataISO: '2026-11-05', semana: p.semana, parteId: 'presidente', pessoaId: pessoa.id, role: 'presidente' };
    assert.equal(buildLegacyAssignmentKey(fields), legacy); assert.equal(old.buildKey(fields), legacy);
    assert.equal(old.porChave.get(legacy).confirmation.token, c.token);
    const novo = criarReferenciasInterfaceClassica({ programacoes: [p], config, grupoId: PT, confirmacoes: [] });
    const key = novo.buildKey(fields); assert.match(key, /^v2-/);
    assert.equal(novo.porChave.get(key).confirmation.programacaoId, p.id);
});
test('Interface clássica: as três telas originais renderizam com configuração v2', async () => {
    const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    try {
        const { I18nProvider, getSectionMessages } = await server.ssrLoadModule('/src/i18n/index.js');
        const foco = projetarConfigGrupo(config, PT);
        const assigned = { ...programa, presidente: pessoa };
        const novo = criarReferenciasInterfaceClassica({ programacoes: [assigned], config, grupoId: PT, confirmacoes: [] });
        const confirmation = { ...[...novo.porChave.values()][0].confirmation, status: 'confirmado' };
        const common = { config: foco, alunos: [pessoa], listaProgramacoes: [assigned], historico: [assigned], confirmacoes: [confirmation], cargosMap,
            lang: 'pt', t: getSectionMessages('adminPanel', 'pt'), setAbaAtiva() {}, setListaProgramacoes() {} };
        for (const path of ['/src/components/Dashboard.jsx', '/src/components/Designar/index.jsx', '/src/components/RevisarEnviar/index.jsx']) {
            const { default: Component } = await server.ssrLoadModule(path);
            const html = renderToStaticMarkup(createElement(I18nProvider, { lang: 'pt' }, createElement(Component, common)));
            assert.ok(html.length > 1000, path); assert.doesNotMatch(html, /Integrações simuladas|Tablero simulado|Sincronizar agenda simulada/);
        }
    } finally { await server.close(); }
});

test('Interface clássica ES: só FDS, contatos atuais e nenhuma alteração na fonte', () => {
    const foco = projetarConfigGrupo(config, ES);
    const es = { ...programa, id: 'es-fixture', grupoId: ES, meioSemana: { ativo: false }, partes: [{ id: 'dado-preservado', titulo: 'Fonte privada preservada' }],
        presidente: pessoa, fimDeSemana: { ativo: true, data: '2026-11-08', horario: '10:45', presidente: { id: pessoa.id, nome: pessoa.nome } } };
    const source = JSON.stringify(es);
    const view = projetarProgramaOperacionalInterface(es, foco, [{ ...pessoa, telefone: 'fixture-only' }]);
    assert.equal(view.meioSemana.ativo, false); assert.equal(view.presidente, null); assert.equal(view.partes.length, 0);
    assert.equal(view.fimDeSemana.horario, '10:45'); assert.equal(view.fimDeSemana.presidente.telefone, 'fixture-only');
    assert.equal(JSON.stringify(es), source);
    const aluno = { ...pessoa, gruposParticipantes: [ES], partesHabilitadas: ['presidente_fds'] };
    assert.equal(avaliarSlotClassico({ aluno, alunos: [aluno], programacao: es, targetSlot: { fds: true, key: 'presidente_fds' }, config: foco, cargosMap }).eligible, true);
    assert.equal(avaliarSlotClassico({ aluno, alunos: [aluno], programacao: es, targetSlot: { key: 'presidente' }, config: foco, cargosMap }).eligible, false);
});
test('Interface clássica: ativação sem horário/data ou mudança para outra semana é recusada', () => {
    const old = { ...programa, fimDeSemana: { ativo: false } };
    for (const bloco of [{ ativo: true }, { ativo: true, data: '2026-11-15', horario: '10:45' }]) assert.throws(() => prepararEdicaoClassica({ anteriores: [old], proximas: [{ ...old, fimDeSemana: bloco }], config, grupoId: PT, alunos: [pessoa], cargosMap }));
});
