import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createRemoteGroupAdapter } from '../src/services/adaptadorGruposFirestore.js';
import { normalizeGruposProgramacao } from '../src/utils/gruposProgramacao.js';
import { dadosIguais, registrosAlterados } from '../src/utils/compararDados.js';
import { acompanharOperacao, progressoOperacoes } from '../src/utils/progressoOperacoes.js';

const config = normalizeGruposProgramacao({ idioma: 'pt', revisionProgramacoes: 1, ativacaoMultiGrupos: { contrato: 2, status: 'ativa' } });
const pessoa = { id: 'p1', nome: 'Pessoa fictícia', tipo: 'anciao', gruposParticipantes: ['grupo-portugues'], telefone: '111', historico: [{ preservar: true }] };
const programa = { id: 'pt-1', grupoId: 'grupo-portugues', versaoProgramacao: 2, publicadaNoQuadro: true,
    semana: '2-8 de novembro de 2026', meioSemana: { ativo: true, data: '2026-11-05', horario: '19:30' }, fimDeSemana: { ativo: false }, partes: [] };

function fixture({ pessoaAtual = pessoa, configAtual = config } = {}) {
    const base = 'users/fixture';
    const documentos = new Map([[`${base}/configuracoes/geral`, structuredClone(configAtual)], [`${base}/alunos/p1`, structuredClone(pessoaAtual)], [`${base}/programacao/pt-1`, structuredClone(programa)]]);
    const dados = { configuracoes: config, alunos: [pessoa], historico_reunioes: [programa] };
    let emVoo = 0, maximo = 0, transacoes = 0;
    const escritas = [], leituras = [];
    const snapshot = ref => ({ id: ref.path.split('/').at(-1), ref, exists: () => documentos.has(ref.path), data: () => structuredClone(documentos.get(ref.path)) });
    const ler = async ref => {
        leituras.push(ref.path); emVoo++; maximo = Math.max(maximo, emVoo);
        await new Promise(resolve => setTimeout(resolve, 3));
        emVoo--; return snapshot(ref);
    };
    const sdk = {
        doc: (_db, path) => ({ path }), collection: (_db, path) => ({ path }),
        getDocFromServer: ler,
        getDocsFromServer: async ref => ({ docs: [...documentos.keys()].filter(path => path.startsWith(ref.path + '/')).map(path => snapshot({ path })) }),
        increment: value => ({ incremento: value }), serverTimestamp: () => 'data-ficticia',
        runTransaction: async (_db, executar) => {
            transacoes++;
            const gravar = (tipo, ref, data) => { assert.equal(emVoo, 0, 'todas as leituras terminam antes da escrita'); escritas.push({ tipo, path: ref.path, data }); };
            return executar({ get: ler, set: (ref, data) => gravar('set', ref, data), update: (ref, data) => gravar('update', ref, data), delete: ref => gravar('delete', ref) });
        },
    };
    const adapter = createRemoteGroupAdapter({ db: {}, sdk, getOwnerUid: () => 'fixture', getEstado: () => dados });
    return { adapter, documentos, escritas, leituras, maximo: () => maximo, transacoes: () => transacoes };
}

test('Salvar um cadastro lê configuração e pessoa juntos e grava só o campo alterado', async () => {
    const f = fixture({ pessoaAtual: { ...pessoa, telefone: 'telefone atualizado em outra sessão', historico: [{ preservar: 'histórico remoto' }] } });
    await f.adapter.salvarAluno({ ...pessoa, nome: 'Nome novo' }, { original: pessoa });
    assert.equal(f.maximo(), 2);
    assert.deepEqual(f.escritas, [{ tipo: 'update', path: 'users/fixture/alunos/p1', data: { nome: 'Nome novo' } }]);
});

test('Cadastro sem mudanças não abre transação nem faz leitura online', async () => {
    const f = fixture();
    await f.adapter.salvarAluno(structuredClone(pessoa), { original: pessoa });
    assert.equal(f.transacoes(), 0); assert.deepEqual(f.leituras, []); assert.deepEqual(f.escritas, []);
});

test('Edição concorrente no mesmo campo continua bloqueada', async () => {
    const f = fixture({ pessoaAtual: { ...pessoa, nome: 'Outro administrador editou' } });
    await assert.rejects(f.adapter.salvarAluno({ ...pessoa, nome: 'Minha edição' }, { original: pessoa }), /mudou em outra sessão/);
    assert.deepEqual(f.escritas, []);
});

test('Configuração alterada em outra sessão continua bloqueada', async () => {
    const f = fixture({ configAtual: { ...config, nome_cong: 'Edição de outra sessão' } });
    await assert.rejects(f.adapter.salvarConfig({ ...config, nome_cong: 'Minha edição' }), /mudou em outra sessão/);
    assert.deepEqual(f.escritas, []);
});

test('Novo cadastro não sobrescreve pessoa existente e grupo inativo continua bloqueado', async () => {
    const f = fixture();
    await assert.rejects(f.adapter.salvarAluno({ ...pessoa, nome: 'Novo por cima' }), /já cadastrado/);
    assert.deepEqual(f.escritas, []);
    const inactive = structuredClone(config); inactive.grupos['grupo-portugues'].ativo = false;
    const g = fixture({ configAtual: inactive });
    await assert.rejects(g.adapter.salvarAluno({ ...pessoa, id: 'nova' }), /participacaoInativa/);
    assert.deepEqual(g.escritas, []);
});

test('Programação lê configuração e destino juntos e ainda valida o documento anterior', async () => {
    const f = fixture();
    await f.adapter.salvarLote({ grupoId: programa.grupoId, upserts: [{ ...programa, arquivada: true }], excluirIds: [], anteriores: [programa] });
    assert.equal(f.maximo(), 2);
    assert.equal(f.escritas.length, 2);
    const g = fixture(); g.documentos.set('users/fixture/programacao/pt-1', { ...programa, outraEdicao: true });
    await assert.rejects(g.adapter.salvarLote({ grupoId: programa.grupoId, upserts: [{ ...programa, arquivada: true }], excluirIds: [], anteriores: [programa] }), /mudou em outra sessão/);
    assert.deepEqual(g.escritas, []);
});

test('Republicação mantém leitura transacional de cada programação e revisão exata', async () => {
    const f = fixture(); await f.adapter.publicar();
    assert.equal(f.maximo(), 2);
    assert.ok(f.leituras.includes('users/fixture/programacao/pt-1'));
    const quadro = f.escritas.find(item => item.path === 'quadros_publicos/fixture');
    assert.equal(quadro.data.configuracoes.revisionProgramacoes, 1);
    assert.equal(quadro.data.historico_reunioes.length, 1);
    const g = fixture();
    let chamadas = 0;
    const initial = structuredClone(config);
    // A revisão muda entre a primeira leitura de configuração e a transação.
    const originalGet = g.documentos.get.bind(g.documentos);
    g.documentos.get = key => {
        if (key.endsWith('/configuracoes/geral')) return { ...initial, revisionProgramacoes: ++chamadas };
        return originalGet(key);
    };
    await assert.rejects(g.adapter.publicar(), /quadro-obsoleto/);
    assert.deepEqual(g.escritas, []);
});

test('Comparação ignora ordem de campos sem ignorar arrays, IDs ou conteúdo', () => {
    assert.equal(dadosIguais({ a: 1, b: [2, 3] }, { b: [2, 3], a: 1 }), true);
    assert.equal(dadosIguais({ a: [2, 3] }, { a: [3, 2] }), false);
    const lista = Array.from({ length: 300 }, (_, i) => ({ ...pessoa, id: String(i) }));
    const next = structuredClone(lista); next[150].nome = 'Alterado';
    assert.deepEqual(registrosAlterados(next, lista).map(p => p.id), ['150']);
    assert.equal(registrosAlterados(structuredClone(lista), lista).length, 0);
});

test('Progresso aparece antes da ação, permanece pendente e termina com a promessa real', async () => {
    let concluir;
    const pendente = new Promise(resolve => { concluir = resolve; });
    const tarefa = acompanharOperacao('salvarCadastro', () => {
        assert.equal(progressoOperacoes.getSnapshot().tipo, 'salvarCadastro'); return pendente;
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(progressoOperacoes.getSnapshot().pendentes, 1);
    concluir('salvou'); assert.equal(await tarefa, 'salvou');
    assert.equal(progressoOperacoes.getSnapshot().pendentes, 0);
});

test('Falha e operações sobrepostas não deixam indicador preso nem escondem outra ação', async () => {
    await new Promise(resolve => setTimeout(resolve, 140));
    const mudancas = [];
    const unsub = progressoOperacoes.subscribe(() => mudancas.push(progressoOperacoes.getSnapshot().pendentes));
    try {
        await assert.rejects(acompanharOperacao('processando', () => acompanharOperacao('publicar', () => { throw new Error('falha real'); })), /falha real/);
        assert.deepEqual(mudancas, [1, 2, 1, 0]);
    } finally { unsub(); }
});

test('Salvar e publicar em sequência têm um ciclo, sem conclusão intermediária ou atraso na promessa', async () => {
    await new Promise(resolve => setTimeout(resolve, 140));
    const estados = [];
    const unsub = progressoOperacoes.subscribe(() => estados.push(progressoOperacoes.getSnapshot()));
    try {
        await acompanharOperacao('salvarProgramacoes', async () => {});
        const primeira = progressoOperacoes.getSnapshot();
        assert.equal(primeira.pendentes, 0, 'a promessa termina antes da animação');
        assert.equal(primeira.fase, 'processando');
        await new Promise(resolve => setTimeout(resolve, 40));
        await acompanharOperacao('publicar', async () => {});
        const segunda = progressoOperacoes.getSnapshot();
        assert.equal(segunda.ciclo, primeira.ciclo);
        assert.equal(segunda.desde, primeira.desde);
        assert.equal(estados.some(s => s.fase === 'concluido'), false);
        await new Promise(resolve => setTimeout(resolve, 150));
        assert.equal(estados.filter(s => s.fase === 'concluido').length, 1);
        assert.equal(progressoOperacoes.getSnapshot().pendentes, 0);
    } finally { unsub(); }
});

test('Etapa longa dentro da mesma ação preserva o início e só conclui após a última etapa', async () => {
    await new Promise(resolve => setTimeout(resolve, 140));
    let inicio;
    await acompanharOperacao('processando', async () => {
        inicio = progressoOperacoes.getSnapshot();
        await acompanharOperacao('salvarCadastro', async () => {});
        await new Promise(resolve => setTimeout(resolve, 180));
        assert.equal(progressoOperacoes.getSnapshot().fase, 'processando');
        assert.equal(progressoOperacoes.getSnapshot().desde, inicio.desde);
        await acompanharOperacao('publicar', async () => {});
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(progressoOperacoes.getSnapshot().ciclo, inicio.ciclo);
    assert.equal(progressoOperacoes.getSnapshot().fase, 'concluido');
});

test('Um novo clique após a conclusão cria um ciclo e limpa o erro anterior', async () => {
    await new Promise(resolve => setTimeout(resolve, 140));
    await assert.rejects(acompanharOperacao('salvarCadastro', async () => { throw new Error('erro fixture'); }));
    await new Promise(resolve => setTimeout(resolve, 150));
    const anterior = progressoOperacoes.getSnapshot();
    assert.equal(anterior.falhou, true);
    await acompanharOperacao('salvarCadastro', async () => {});
    assert.ok(progressoOperacoes.getSnapshot().ciclo > anterior.ciclo);
    assert.equal(progressoOperacoes.getSnapshot().falhou, false);
});

let server;
after(async () => { await server?.close(); });
test('Barra fina no topo avança, conclui ações rápidas e indica erros sem mensagem flutuante', async () => {
    server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, entries: [] } });
    const { BarraOperacao } = await server.ssrLoadModule('/src/components/ProgressoOperacao.jsx');
    const { getSectionMessages } = await server.ssrLoadModule('/src/i18n/index.js');
    for (const lang of ['pt', 'es']) {
        const textos = getSectionMessages('andamento', lang);
        for (const [tipo, agora, online, detalhe] of [
            ['salvarCadastro', 1000, true, textos.salvarCadastro],
            ['salvarConfiguracoes', 10000, true, textos.salvarConfiguracoes],
            ['publicar', 1000, false, textos.semConexao],
        ]) {
            const html = renderToStaticMarkup(createElement(BarraOperacao, { estado: { pendentes: 1, tipo, desde: 1000 }, agora, online, textos }));
            assert.ok(html.includes(detalhe)); assert.match(html, /role="progressbar"/);
            assert.doesNotMatch(html, /aria-valuenow|bottom-4|role="status"/);
            const width = Number(html.match(/width:([\d.]+)%/)[1]);
            assert.ok(width >= 12 && width < 100);
        }
        const concluir = agora => renderToStaticMarkup(createElement(BarraOperacao, { estado: { pendentes: 0, desde: 1000, terminouEm: 1001 }, agora, textos }));
        assert.match(concluir(1001), /aria-valuenow="100"/);
        assert.equal(concluir(1300), '');
        assert.equal(renderToStaticMarkup(createElement(BarraOperacao, { estado: { pendentes: 0 }, agora: 1000, textos })), '');
    }
});
