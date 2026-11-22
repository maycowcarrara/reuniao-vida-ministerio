import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sincronizarAgendaGrupo } from '../src/services/agendaGrupos.js';
import { criarClienteAgenda, sincronizarEventosAgenda } from '../src/services/agendaEventos.js';
import { aplicarResultadoAgenda, eventoAtualizado } from '../src/utils/agendaDelta.js';
import { normalizeGruposProgramacao } from '../src/utils/gruposProgramacao.js';
import { createRemoteGroupAdapter } from '../src/services/adaptadorGruposFirestore.js';
import { prepararEdicaoClassica, pessoaParaDesignacao } from '../src/utils/interfaceClassicaGrupos.js';
import { historicosIguais } from '../src/utils/compararDados.js';

const grupoId = 'grupo-portugues';
const config = normalizeGruposProgramacao({ idioma: 'pt', ativacaoMultiGrupos: { contrato: 2, status: 'ativa' } });
const programa = () => ({ id: 'teste', grupoId, versaoProgramacao: 2, publicadaNoQuadro: true,
    semana: '2-8 de novembro de 2026', meioSemana: { ativo: true, data: '2026-11-05', horario: '19:30' },
    fimDeSemana: { ativo: false }, presidente: { id: 'presidente', nome: 'Presidente' },
    partes: Array.from({ length: 8 }, (_, i) => ({ id: `parte-${i}`, titulo: 'Discurso', tempo: 5, estudante: { id: `p-${i}`, nome: `Pessoa ${i}` } })),
});

function agenda() {
    const eventos = new Map(), calls = [];
    let falhar = '', ativas = 0, maximo = 0;
    const fetchImpl = async (url, options = {}) => {
        const method = options.method || 'GET';
        const path = new URL(url).pathname;
        const id = path.split('/').at(-1);
        const chave = method === 'POST' ? `${path}/${JSON.parse(options.body).id}` : path;
        calls.push({ method, id });
        ativas++; maximo = Math.max(maximo, ativas);
        await new Promise(resolve => setTimeout(resolve, 1));
        ativas--;
        const response = (status, data) => ({ status, ok: status < 400, json: async () => structuredClone(data) });
        if (method === 'GET') return response(eventos.has(chave) ? 200 : 404, eventos.get(chave) || {});
        if (id === falhar || (method === 'POST' && JSON.parse(options.body).id === falhar)) return response(503, {});
        const body = JSON.parse(options.body);
        if (method === 'PATCH') assert.equal(options.headers['If-Match'], eventos.get(chave).etag);
        eventos.set(chave, { ...eventos.get(chave), ...body, etag: 'confirmado' });
        return response(200, eventos.get(chave));
    };
    return { eventos, calls, fetchImpl, maximo: () => maximo, falhar: id => { falhar = id; } };
}
const sincronizar = (a, p, extra = {}) => sincronizarAgendaGrupo({ token: 'teste', calendarId: 'agenda-a',
    programacoes: [p], config, grupoId, fetchImpl: a.fetchImpl, ...extra });
const registrar = (p, r) => aplicarResultadoAgenda(p, r, '2026-11-22T12:00:00Z');

test('Agenda: nove eventos usam até três requisições simultâneas e repetição confirmada usa zero', async () => {
    const a = agenda(), p = programa();
    const primeiro = await sincronizar(a, p);
    assert.equal(primeiro.quantidade, 9);
    assert.equal(a.maximo(), 3);
    const salvo = registrar(p, primeiro);
    a.calls.length = 0;
    const segundo = await sincronizar(a, salvo);
    assert.equal(segundo.sucesso, true);
    assert.equal(segundo.quantidade, 0);
    assert.equal(segundo.semAlteracoes, 9);
    assert.deepEqual(a.calls, []);
    assert.equal(registrar(salvo, segundo), salvo, 'não renova documento nem timestamp sem alteração');
});

test('Agenda: substituição altera somente um evento e uma programação', async () => {
    const a = agenda(), p = programa();
    const salvo = registrar(p, await sincronizar(a, p));
    const outro = { ...salvo, presidente: { id: 'novo', nome: 'Novo presidente' }, agendaPendenteSync: true };
    a.calls.length = 0;
    const r = await sincronizar(a, outro);
    assert.equal(r.quantidade, 1); assert.equal(r.semAlteracoes, 8);
    assert.deepEqual(a.calls.map(c => c.method), ['GET', 'PATCH']);
    assert.equal(registrar(outro, r).agendaPendenteSync, false);
    assert.equal(aplicarResultadoAgenda({ id: 'outra-semana' }, r, 'agora').id, 'outra-semana');
});

test('Agenda: conferência completa corrige edição externa sem regravar eventos iguais', async () => {
    const a = agenda(), p = programa();
    const salvo = registrar(p, await sincronizar(a, p));
    const [key, event] = [...a.eventos][0];
    a.eventos.set(key, { ...event, summary: 'Editado diretamente no Google' });
    a.calls.length = 0;
    const r = await sincronizar(a, salvo, { conferirTudo: true });
    assert.equal(r.quantidade, 1);
    assert.equal(a.calls.filter(c => c.method === 'GET').length, 9);
    assert.equal(a.calls.filter(c => c.method === 'PATCH').length, 1);
});

test('Agenda: falha parcial conserva sucessos e nova tentativa processa só o evento que faltou', async () => {
    const a = agenda(), p = programa();
    const inicial = await sincronizar(a, p);
    const salvo = registrar(p, inicial);
    const mudou = { ...salvo, presidente: { id: 'novo', nome: 'Novo' }, partes: salvo.partes.map((v, i) => i === 1 ? { ...v, titulo: 'Novo tema' } : v), agendaPendenteSync: true };
    a.falhar(inicial.resultados[0].id);
    const parcial = await sincronizar(a, mudou);
    assert.equal(parcial.sucesso, false);
    assert.equal(parcial.quantidade, 1);
    assert.deepEqual(parcial.programacaoIdsSincronizadas, []);
    const pendente = registrar(mudou, parcial);
    assert.equal(pendente.agendaPendenteSync, true);
    a.falhar(''); a.calls.length = 0;
    const retry = await sincronizar(a, pendente);
    assert.equal(retry.sucesso, true); assert.equal(retry.quantidade, 1);
    assert.deepEqual(a.calls.map(c => c.method), ['GET', 'PATCH']);
});

test('Agenda: checkpoint de outra agenda nunca dispensa envio ao novo destino', async () => {
    const a = agenda(), evento = { id: 'evento', programacaoId: 'p', summary: 'Exemplo',
        start: { dateTime: '2026-11-22T12:00:00Z' }, end: { dateTime: '2026-11-22T13:00:00Z' } };
    const executar = (calendarId, p) => sincronizarEventosAgenda({ eventos: [evento], programacoes: [p], calendarId,
        cliente: criarClienteAgenda({ token: 'teste', calendarId, fetchImpl: a.fetchImpl }) });
    const salvo = registrar({ id: 'p' }, await executar('a', { id: 'p' }));
    a.calls.length = 0;
    const r = await executar('b', salvo);
    assert.equal(r.quantidade, 1);
    assert.deepEqual(a.calls.map(c => c.method), ['GET', 'POST']);
    assert.equal(r.estadosPorProgramacao.p.calendarId, 'b');
});

test('Agenda: comparação ignora respostas, ordem dos convidados e offsets; remover e-mail envia lista vazia', () => {
    const esperado = { summary: 'Parte', start: { dateTime: '2026-11-22T12:00:00Z', timeZone: 'America/Sao_Paulo' },
        end: { dateTime: '2026-11-22T13:00:00Z', timeZone: 'America/Sao_Paulo' }, attendees: [{ email: 'a@teste' }, { email: 'b@teste' }] };
    const remoto = { ...esperado, start: { ...esperado.start, dateTime: '2026-11-22T09:00:00-03:00' },
        attendees: [{ email: 'b@teste', responseStatus: 'accepted' }, { email: 'a@teste', responseStatus: 'declined' }] };
    assert.equal(eventoAtualizado(esperado, remoto), true);
    assert.equal(eventoAtualizado({ ...esperado, attendees: [] }, remoto), false);
});

function banco() {
    const p = { ...programa(), historicoPendenteSync: true };
    const pessoa = { id: 'aluno', nome: 'Pessoa', privado: 'preservar', historico: [{ data: '2026-11-01' }] };
    const estado = { configuracoes: config, alunos: [pessoa], historico_reunioes: [p] };
    const documentos = new Map([['users/owner/configuracoes/geral', config], ['users/owner/programacao/teste', p], ['users/owner/alunos/aluno', pessoa]]);
    let transacoes = 0;
    const escritas = [];
    const sdk = { doc: (_db, path) => ({ path }), increment: v => v,
        runTransaction: async (_db, executar) => {
            transacoes++;
            const pendentes = [];
            const result = await executar({ get: async ref => ({ id: ref.path.split('/').at(-1), exists: () => documentos.has(ref.path), data: () => structuredClone(documentos.get(ref.path)) }),
                update: (ref, patch) => pendentes.push({ path: ref.path, patch }) });
            for (const op of pendentes) { escritas.push(op); documentos.set(op.path, { ...documentos.get(op.path), ...op.patch }); }
            return result;
        } };
    const adapter = createRemoteGroupAdapter({ db: {}, sdk, getOwnerUid: () => 'owner', getEstado: () => estado });
    return { adapter, estado, documentos, escritas, transacoes: () => transacoes };
}
const escopo = { grupoId, programacaoIds: ['teste'] };

test('Histórico: grava só a pessoa alterada junto do marcador na mesma transação; repetir não acessa banco', async () => {
    const b = banco();
    const input = [{ ...b.estado.alunos[0], historico: [{ data: '2026-11-05' }] }];
    const r = await b.adapter.salvarHistoricos(input, escopo);
    assert.equal(b.transacoes(), 1);
    assert.equal(r.alunosAlterados, 1);
    assert.equal(b.escritas.length, 3);
    assert.equal(b.documentos.get('users/owner/alunos/aluno').privado, 'preservar');
    b.estado.alunos = input;
    b.estado.historico_reunioes = [{ ...b.estado.historico_reunioes[0], ...r.programacoes[0].alteracoes }];
    await b.adapter.salvarHistoricos(input, escopo);
    assert.equal(b.transacoes(), 1);
    assert.equal(b.escritas.length, 3);
});

test('Histórico: ordem diferente não regrava, mas remoção e duplicatas são alterações', async () => {
    assert.equal(historicosIguais([{ a: 1 }, { b: 2 }], [{ b: 2 }, { a: 1 }]), true);
    assert.equal(historicosIguais([{ a: 1 }, { a: 1 }], [{ a: 1 }]), false);
    const b = banco();
    b.estado.alunos[0].historico.push({ data: '2026-10-01' });
    b.estado.historico_reunioes[0].historicoGravadoEm = 'antes';
    b.estado.historico_reunioes[0].historicoPendenteSync = false;
    await b.adapter.salvarHistoricos([{ ...b.estado.alunos[0], historico: [...b.estado.alunos[0].historico].reverse() }], escopo);
    assert.equal(b.transacoes(), 0);
});

test('Histórico: edição concorrente impede históricos e marcadores de serem gravados parcialmente', async () => {
    for (const campo of ['alunos/aluno', 'programacao/teste', 'configuracoes/geral']) {
        const b = banco(), path = `users/owner/${campo}`;
        const atual = b.documentos.get(path);
        b.documentos.set(path, campo.startsWith('alunos') ? { ...atual, historico: [] }
            : campo.startsWith('programacao') ? { ...atual, outro: true } : { ...atual, grupos: {} });
        await assert.rejects(b.adapter.salvarHistoricos([{ ...b.estado.alunos[0], historico: [] }], escopo), /mudou/);
        assert.deepEqual(b.escritas, []);
    }
});

test('Programação: conteúdo alterado marca agenda e histórico; metadados de sincronização não recriam pendência', () => {
    const p = programa();
    const args = { anteriores: [p], config, grupoId, alunos: [] };
    const [mudou] = prepararEdicaoClassica({ ...args, proximas: [{ ...p, partes: p.partes.map((v, i) => i === 0 ? { ...v, titulo: 'Novo tema' } : v) }] });
    assert.equal(mudou.agendaPendenteSync, true); assert.equal(mudou.historicoPendenteSync, true);
    const [metadata] = prepararEdicaoClassica({ ...args, proximas: [{ ...p, agendaSincronizadaEm: 'agora', agendaPendenteSync: false }] });
    assert.equal(metadata.agendaPendenteSync, false); assert.equal(metadata.historicoPendenteSync, undefined);
});

test('Designação: preserva identidade, contatos e campos extras sem copiar histórico crescente', () => {
    const aluno = { id: 'p1', nome: 'Pessoa', email: 'pessoa@teste', telefone: '123', extra: 'preservar',
        historico: Array.from({ length: 1000 }, () => ({ data: '2026-11-22', parte: 'discurso' })) };
    const designada = pessoaParaDesignacao(aluno);
    assert.equal(designada.historico, undefined);
    assert.equal(aluno.historico.length, 1000);
    assert.deepEqual(designada, { id: 'p1', nome: 'Pessoa', email: 'pessoa@teste', telefone: '123', extra: 'preservar' });
    assert.ok(JSON.stringify(designada).length < JSON.stringify(aluno).length / 100);
});

test('Programação: gravação de um marcador não reenvia conteúdo nem alunos da semana', async () => {
    const b = banco(), anterior = b.estado.historico_reunioes[0];
    await b.adapter.salvarLote({ grupoId, anteriores: [anterior], excluirIds: [],
        upserts: [{ ...anterior, agendaSincronizadaEm: 'agora' }] });
    assert.deepEqual(b.escritas[0], { path: 'users/owner/programacao/teste', patch: { agendaSincronizadaEm: 'agora' } });
    assert.equal(b.documentos.get('users/owner/programacao/teste').partes.length, 8);
});
