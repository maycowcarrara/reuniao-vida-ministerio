import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GRUPO_PORTUGUES_ID as PT, GRUPO_ESPANHOL_ID as ES } from '../src/utils/gruposProgramacao.js';
import { createDadosEnsaioGrupos } from '../src/data/ensaioGrupos.js';
import { createFimDeSemanaDefault } from '../src/utils/fimDeSemana.js';
import { listarSlotsReuniao, selecionarDesignacoes, avaliarElegibilidadeGrupo, avaliarConflitosGrupo, prepararAtribuicaoGrupo,
    classificarCandidatosGrupo, reconstruirHistoricoGrupo, prepararEventoGrupo } from '../src/utils/designacoesPorGrupo.js';
import { aplicarOperacoesProgramacao, createProgramacoesController } from '../src/utils/programacoesPorGrupo.js';
import { normalizeOcorrenciaReuniao } from '../src/utils/ocorrenciasReuniao.js';
import { addHistorico } from '../src/utils/revisarEnviar/historico.js';

const config = createDadosEnsaioGrupos().configuracoes;
const cargosMap = { servo: { gen: 'M' }, anciao: { gen: 'M' }, irma: { gen: 'F' }, irma_lim: { gen: 'F' }, desab: { gen: 'M' } };
const pessoa = (id = 'pessoa-a', extra = {}) => ({ id, nome: id, tipo: 'anciao', partesHabilitadas: ['presidente_fds', 'dirigente_sentinela', 'leitor_sentinela', 'oracao', 'audio_video', 'ministerio', 'presidente_rvm', 'o_que_voce_diria'], gruposParticipantes: [PT, ES], ...extra });
const programa = (grupoId = ES, extra = {}) => ({ id: `${grupoId}-fixture`, grupoId, versaoProgramacao: 2,
    dataInicio: '2026-11-02', semana: 'Semana fictícia', partes: [], meioSemana: { ativo: false }, publicadaNoQuadro: false,
    fimDeSemana: { ...createFimDeSemanaDefault(), ativo: true, data: '2026-11-08', horario: '10:00' }, ...extra });
const slot = (p, tipo = 'fimDeSemana', key = 'presidente_fds') => listarSlotsReuniao(p, tipo).find(item => item.slotKey === key);
const contexto = (p = programa(), alunos = [pessoa()], programacoes = [p]) => ({ config, grupoId: p.grupoId || PT, programacoes, alunos, cargosMap });
const atribuir = (ctx = contexto(), extra = {}) => prepararAtribuicaoGrupo({ ...ctx, programacaoId: ctx.programacoes[0].id,
    tipo: 'fimDeSemana', slotId: slot(ctx.programacoes[0]).slotId, alunoId: ctx.alunos[0]?.id, ...extra });
const aplicar = (ctx, resultado) => aplicarOperacoesProgramacao({ ...ctx, operacoes: resultado.operacoes });
const avaliar = (aluno, p = programa(), tipo = 'fimDeSemana', s = slot(p)) => avaliarElegibilidadeGrupo({ aluno, programacao: p, tipo, slot: s, grupoId: p.grupoId || PT, config, cargosMap });
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

test('E4: ausência legada participa PT, nunca ES; vazio explícito e habilitação insuficiente falham fechados', () => {
    const legado = pessoa('legado'); delete legado.gruposParticipantes;
    assert.equal(avaliar(legado).eligible, false);
    assert.equal(avaliar(legado, programa(PT)).eligible, true);
    assert.equal(avaliar(pessoa('vazio', { gruposParticipantes: [] })).eligible, false);
    assert.equal(avaliar(pessoa('sem-habilitacao', { partesHabilitadas: [] })).eligible, false);
    assert.equal(avaliar(pessoa('desab', { tipo: 'desab' })).eligible, false);
});
test('E4: participação simultânea não amplia habilitação, gênero ou restrição de O que você diria', () => {
    const cfg = structuredClone(config); cfg.grupos[ES].meioSemana.habilitada = true;
    const p = programa(ES, { meioSemana: { ativo: true, data: '2026-11-04', horario: '19:30' }, partes: [{ id: 'p-what', secao: 'ministerio', titulo: '6. ¿Qué dirías?' }] });
    const s = slot(p, 'meioSemana', 'estudante');
    const check = aluno => avaliarElegibilidadeGrupo({ aluno, programacao: p, tipo: 'meioSemana', slot: s, grupoId: ES, config: cfg, cargosMap });
    assert.equal(check(pessoa()).eligible, true);
    assert.equal(check(pessoa('irma', { tipo: 'irma' })).eligible, false);
    assert.equal(check(pessoa('sem-explicita', { partesHabilitadas: undefined })).eligible, false);
    assert.equal(listarSlotsReuniao(p, 'meioSemana').some(item => item.slotKey === 'ajudante'), false);
});
test('E4: disponibilidade usa data exata da ocorrência, sem bloquear a semana inteira', () => {
    const aluno = pessoa('ausente', { datasIndisponiveis: [{ inicio: '2026-11-02', fim: '2026-11-04' }] });
    assert.equal(avaliar(aluno).eligible, true);
    aluno.datasIndisponiveis.push({ inicio: '2026-11-08', fim: '2026-11-08' });
    assert.equal(avaliar(aluno).eligible, false);
});
test('E4: gênero da dupla usa cadastro atual mesmo quando a designação guarda apenas ID/nome', () => {
    const estudante = pessoa('irma', { tipo: 'irma' }); const ajudante = pessoa('homem');
    const p = programa(PT, { meioSemana: { ativo: true, data: '2026-11-04', horario: '19:30' },
        partes: [{ id: 'dialogo', titulo: 'Conversa', secao: 'ministerio', estudante: { id: estudante.id, nome: estudante.nome } }] });
    const ctx = contexto(p, [estudante, ajudante]);
    const pedido = { tipo: 'meioSemana', slotId: slot(p, 'meioSemana', 'ajudante').slotId, alunoId: ajudante.id };
    assert.throws(() => atribuir(ctx, pedido), /Gênero incompatível/);
    p.partes[0].ajudante = { id: ajudante.id, nome: ajudante.nome };
    assert.throws(() => atribuir(ctx, { tipo: 'meioSemana', slotId: slot(p, 'meioSemana', 'estudante').slotId, alunoId: estudante.id }), /Gênero incompatível/);
});
test('E4: cancelada, rascunho, tipo desabilitado, grupo inativo e arquivada recusam atribuição', () => {
    for (const extra of [{ cancelada: true }, { arquivada: true }, { fimDeSemana: { ...programa().fimDeSemana, ativo: false } }]) assert.throws(() => atribuir(contexto(programa(ES, extra))), /indisponível/);
    for (const extra of [{ ativo: false }, { fimDeSemana: { habilitada: false } }]) {
        const cfg = structuredClone(config); Object.assign(cfg.grupos[ES], extra);
        assert.throws(() => atribuir({ ...contexto(), config: cfg }), /indisponível/);
    }
});
test('E4: atribuir, substituir e remover preservam PT, slots, publicação, tokens e metadados desconhecidos', () => {
    const p = programa(ES, { token: 'token-legado', assignmentKey: 'v1-legada', publicadaNoQuadro: true, extra: { preservar: 9 } });
    const pt = programa(PT);
    const ctx = contexto(p, [pessoa(), pessoa('pessoa-b')], [p, pt]); freeze(ctx);
    const lista = aplicar(ctx, atribuir(ctx));
    assert.deepEqual(lista[1], pt);
    assert.equal(lista[0].token, p.token);
    assert.equal(lista[0].assignmentKey, p.assignmentKey);
    assert.deepEqual(lista[0].extra, p.extra);
    assert.equal(lista[0].publicadaNoQuadro, true);
    const ctx2 = { ...ctx, programacoes: lista };
    const trocada = aplicar(ctx2, atribuir(ctx2, { alunoId: 'pessoa-b' }));
    assert.equal(trocada[0].substituicoes[0].grupoId, ES);
    assert.equal(trocada[0].substituicoes[0].de.id, 'pessoa-a');
    const removida = aplicar({ ...ctx, programacoes: trocada }, atribuir({ ...ctx, programacoes: trocada }, { alunoId: null }));
    assert.equal(removida[0].fimDeSemana.presidente, null);
    assert.equal(removida[0].fimDeSemana.horario, '10:00');
    assert.equal(p.fimDeSemana.presidente, null);
});
test('E4: leitura de designação não participante preserva valor; remoção explícita permitida e nova atribuição recusada', () => {
    const aluno = pessoa('saiu', { gruposParticipantes: [] });
    const p = programa(); p.fimDeSemana.presidente = { id: aluno.id, nome: aluno.nome };
    assert.equal(listarSlotsReuniao(p, 'fimDeSemana')[0].pessoa.id, aluno.id);
    assert.equal(avaliar(aluno, p).eligible, false);
    assert.throws(() => atribuir(contexto(p, [aluno])), /não participa/);
    assert.equal(aplicar(contexto(p, [aluno]), atribuir(contexto(p, [aluno]), { alunoId: null }))[0].fimDeSemana.presidente, null);
});
test('E4: atribuição por ID/slot rejeita alvo cruzado, slot inventado, seleção obsoleta e pessoa inexistente', () => {
    const ctx = contexto();
    for (const extra of [{ grupoId: PT }, { slotId: 'orador' }, { pessoaAnteriorId: 'mudou' }, { alunoId: 'inexistente' }]) assert.throws(() => atribuir(ctx, extra));
});
test('E4: identidade de parte resiste à reordenação e não atribui na posição antiga', () => {
    const p = programa(PT, { meioSemana: { ativo: true, data: '2026-11-04', horario: '19:30' }, partes: [
        { id: 'parte-a', titulo: '4. Conversa', secao: 'ministerio' }, { id: 'parte-b', titulo: '5. Conversa', secao: 'ministerio' }] });
    const s = slot(p, 'meioSemana', 'estudante');
    const mudou = { ...p, partes: [...p.partes].reverse() };
    const ctx = contexto(mudou);
    const lista = aplicar(ctx, atribuir(ctx, { tipo: 'meioSemana', slotId: s.slotId }));
    assert.equal(lista[0].partes[1].estudante.id, ctx.alunos[0].id);
    assert.equal(lista[0].partes[0].estudante, undefined);
});
test('E4: dois grupos na semana geram aviso confirmável, sem bloqueio automático por semana', () => {
    const p = programa(); const pt = programa(PT); pt.fimDeSemana.presidente = pessoa(); pt.fimDeSemana.data = '2026-11-07';
    const ctx = contexto(p, [pessoa()], [p, pt]);
    assert.throws(() => atribuir(ctx), /confirme/);
    assert.equal(atribuir(ctx, { confirmarAvisos: true }).operacoes.length, 1);
});
test('E4: sem duração declara possível conflito, com duração sobreposta recusa inclusive confirmado', () => {
    const p = programa(); const pt = programa(PT); pt.fimDeSemana.presidente = pessoa();
    let ctx = contexto(p, [pessoa()], [p, pt]);
    const check = () => avaliarConflitosGrupo({ ...ctx, programacao: p, tipo: 'fimDeSemana', slotId: slot(p).slotId, alunoId: 'pessoa-a' });
    assert.equal(check()[0].nivel, 'possivel');
    p.fimDeSemana.duracaoMinutos = 90; pt.fimDeSemana.duracaoMinutos = 120;
    assert.equal(check()[0].nivel, 'bloqueio');
    assert.throws(() => atribuir(ctx, { confirmarAvisos: true }), /sobreposição/);
    pt.fimDeSemana.horario = '13:00';
    assert.equal(check()[0].nivel, 'aviso');
});
test('E4: sobreposição que atravessa domingo/segunda não é omitida pela mudança de semana', () => {
    const p = programa(); p.fimDeSemana.horario = '23:30'; p.fimDeSemana.duracaoMinutos = 90;
    const pt = programa(PT, { dataInicio: '2026-11-09' }); pt.fimDeSemana = { ...pt.fimDeSemana, data: '2026-11-09', horario: '00:15', duracaoMinutos: 60, presidente: pessoa() };
    const ctx = contexto(p, [pessoa()], [p, pt]);
    assert.throws(() => atribuir(ctx, { confirmarAvisos: true }), /sobreposição/);
});
test('E4: incompatibilidade principal FDS mantém exceção explícita confirmada, conforme regra existente', () => {
    const p = programa(); p.fimDeSemana.oracaoFinal = pessoa();
    const ctx = contexto(p);
    assert.throws(() => atribuir(ctx), /confirme/);
    assert.equal(atribuir(ctx, { confirmarAvisos: true }).operacoes.length, 1);
});
test('E4: sugestões filtram participação, habilitação, gênero e indisponibilidade com carga de todos os grupos', () => {
    const p = programa(); const pt = programa(PT); pt.fimDeSemana.presidente = pessoa();
    const alunos = [pessoa(), pessoa('livre'), pessoa('fora', { gruposParticipantes: [PT] }), pessoa('sem-hab', { partesHabilitadas: [] }),
        pessoa('indisponivel', { datasIndisponiveis: [{ inicio: '2026-11-08', fim: '2026-11-08' }] })];
    const lista = classificarCandidatosGrupo({ ...contexto(p, alunos, [p, pt]), programacao: p, tipo: 'fimDeSemana', slot: slot(p) });
    assert.deepEqual(lista.map(item => item.aluno.id), ['livre', 'pessoa-a']);
    assert.equal(lista[1].cargaSemana, 1);
    assert.equal(lista[1].cargaTotal, 1);
});
test('E4: rodízio consulta grupo/função e reunião arquivada; carga da família é compartilhada', () => {
    const p = programa(); const anterior = programa(ES, { id: 'anterior', arquivada: true, dataInicio: '2026-10-26' });
    anterior.fimDeSemana = { ...anterior.fimDeSemana, data: '2026-11-01', presidente: pessoa() };
    const pt = programa(PT); pt.fimDeSemana.presidente = pessoa('familiar');
    const alunos = [pessoa('pessoa-a', { familia: 'Família' }), pessoa('familiar', { familia: 'família' })];
    const lista = classificarCandidatosGrupo({ ...contexto(p, alunos, [p, anterior, pt]), programacao: p, tipo: 'fimDeSemana', slot: slot(p) });
    const alvo = lista.find(item => item.aluno.id === 'pessoa-a');
    assert.equal(alvo.ultimaData, '2026-11-01');
    assert.equal(alvo.familiaOcupada, true);
});
test('E4: evento ES não bloqueia nem move PT; remover evento restaura operação sem apagar designações', () => {
    const p = programa(); p.fimDeSemana.presidente = pessoa(); const pt = programa(PT);
    const cfg = prepararEventoGrupo({ config, grupoId: ES, data: '2026-11-08', tipo: 'assembleia' });
    assert.deepEqual(cfg.grupos[PT], config.grupos[PT]);
    assert.equal(cfg.grupoLegadoId, config.grupoLegadoId);
    assert.equal(normalizeOcorrenciaReuniao(p, 'fimDeSemana', cfg).operacional, false);
    assert.equal(normalizeOcorrenciaReuniao(pt, 'fimDeSemana', cfg).operacional, true);
    const normal = prepararEventoGrupo({ config: cfg, grupoId: ES, data: '2026-11-08', tipo: 'normal' });
    assert.equal(normalizeOcorrenciaReuniao(p, 'fimDeSemana', normal).operacional, true);
    assert.equal(p.fimDeSemana.presidente.id, 'pessoa-a');
    assert.equal(p.fimDeSemana.horario, '10:00');
    assert.throws(() => prepararEventoGrupo({ config, grupoId: ES, data: '2026-02-30', tipo: 'visita' }));
});
test('E4: addHistorico preserva metadados e IDs string diferentes, sem coerção numérica', () => {
    const alunos = [pessoa('01'), pessoa('1'), pessoa('doc-a'), pessoa('doc-b')];
    const entry = { data: '2026-11-08', parte: 'presidente_fds', grupoId: ES, programacaoId: 'p-es', tipoReuniao: 'fimDeSemana', slotId: 'presidente', papel: 'presidente_fds', tokenPrivado: 'preservar' };
    const next = addHistorico(alunos, 'doc-b', entry);
    assert.equal(next[0].historico, undefined); assert.equal(next[2].historico, undefined);
    assert.equal(next[3].historico[0].tokenPrivado, 'preservar');
    assert.equal(addHistorico(next, 'doc-b', entry)[3].historico.length, 1);
    const pt = addHistorico(next, 'doc-b', { ...entry, grupoId: PT, programacaoId: 'p-pt' });
    assert.equal(pt[3].historico.length, 2);
    assert.equal(addHistorico(alunos, '1', entry)[0].historico, undefined);
});
test('E4: reconstruir ES preserva histórico PT/legado/desconhecidos e é idempotente', () => {
    const p = programa(); p.fimDeSemana.presidente = pessoa();
    const ptEntry = { grupoId: PT, programacaoId: 'pt-fixture', tipoReuniao: 'fimDeSemana', data: '2026-11-08', parte: 'presidente_fds' };
    const antigo = { data: '2026-11-08', parte: 'presidente_fds', unknown: 42 };
    const alunos = [pessoa('pessoa-a', { historico: [ptEntry, antigo] })]; freeze(alunos);
    const pedido = { ...contexto(p, alunos), programacaoIds: [p.id], tipos: ['fimDeSemana'] };
    const result = reconstruirHistoricoGrupo(pedido);
    assert.deepEqual(result[0].historico.slice(0, 2), [ptEntry, antigo]);
    assert.equal(result[0].historico[2].grupoId, ES);
    assert.equal(result[0].historico[2].programacaoId, p.id);
    assert.deepEqual(reconstruirHistoricoGrupo({ ...pedido, alunos: result }), result);
    assert.deepEqual(result[0].partesHabilitadas, alunos[0].partesHabilitadas);
});
test('E4: apoios múltiplos, ajudante, EBC e O que você diria têm slots e histórico próprios', () => {
    const cfg = structuredClone(config); cfg.grupos[ES].meioSemana.habilitada = true;
    const p = programa(ES, { meioSemana: { ativo: true, data: '2026-11-04', horario: '19:30' },
        partes: [{ id: 'what', titulo: '¿Qué dirías?', secao: 'ministerio', estudante: pessoa() },
            { id: 'estudo', titulo: 'Estudo bíblico', tipo: 'estudo', dirigente: pessoa('dirigente'), leitor: pessoa('leitor') },
            { id: 'dupla', titulo: 'Conversa', secao: 'ministerio', estudante: pessoa('estudante'), ajudante: pessoa('ajudante') }],
        responsabilidades: { videoZoomSom: [pessoa('apoio-a'), pessoa('apoio-b')] } });
    const alunos = ['pessoa-a', 'dirigente', 'leitor', 'estudante', 'ajudante', 'apoio-a', 'apoio-b'].map(id => pessoa(id));
    const lista = reconstruirHistoricoGrupo({ config: cfg, grupoId: ES, programacoes: [p], alunos, programacaoIds: [p.id], tipos: ['meioSemana'] });
    assert.equal(lista[0].historico[0].parte, 'o_que_voce_diria');
    assert.equal(lista[1].historico[0].parte, 'estudobiblico');
    assert.equal(lista[2].historico[0].parte, 'leitor');
    assert.equal(lista[4].historico[0].parte, 'ajudante');
    assert.notEqual(lista[5].historico[0].slotId, lista[6].historico[0].slotId);
    assert.equal(lista[5].historico[0].tipoReuniao, 'meioSemana');
});
test('E4: limpeza só por grupo/programação/tipo; dados de canceladas/desabilitadas e outros tipos preservados', () => {
    const p = programa();
    const entry = { grupoId: ES, programacaoId: p.id, tipoReuniao: 'meioSemana', data: '2026-11-04', parte: 'presidente' };
    const fds = { ...entry, tipoReuniao: 'fimDeSemana', parte: 'presidente_fds' };
    const aluno = pessoa('pessoa-a', { historico: [entry, fds] });
    const pedido = { ...contexto(p, [aluno]), programacaoIds: [p.id], tipos: ['fimDeSemana'] };
    assert.deepEqual(reconstruirHistoricoGrupo(pedido)[0].historico, [entry]);
    const cancelada = { ...p, cancelada: true };
    assert.deepEqual(reconstruirHistoricoGrupo({ ...pedido, programacoes: [cancelada] })[0].historico, [entry, fds]);
    assert.throws(() => reconstruirHistoricoGrupo({ ...pedido, grupoId: PT }), /fora do grupo/);
    assert.throws(() => reconstruirHistoricoGrupo({ ...pedido, tipos: [] }));
});
test('E4: controller revalida pessoa atual no momento da gravação, sem aceitar participação obsoleta', async () => {
    const p = programa(); let estado = { configuracoes: config, historico_reunioes: [p], alunos: [pessoa()] }; let gravacoes = 0;
    const controller = createProgramacoesController({ getEstado: () => estado, salvarLote: async () => { gravacoes++; }, publicar: () => { throw new Error('Não publicar'); } });
    const pedido = { grupoId: ES, preparar: ctx => atribuir(ctx) };
    estado = { ...estado, alunos: [pessoa('pessoa-a', { gruposParticipantes: [PT] })] };
    await assert.rejects(controller.executar(pedido), /não participa/);
    assert.equal(gravacoes, 0);
});

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(() => vite.close());
test('E4: SSR PT/ES apresenta vazio ES sem candidatos e designação existente não participante com aviso', async () => {
    const { default: Componente } = await vite.ssrLoadModule('/src/components/Designar/DesignacoesGrupo.jsx');
    const { I18nProvider } = await vite.ssrLoadModule('/src/i18n/index.js');
    const p = programa(); p.fimDeSemana.presidente = { id: 'pessoa-a', nome: 'Pessoa fora' };
    for (const lang of ['pt', 'es']) {
        const html = renderToStaticMarkup(createElement(I18nProvider, { lang }, createElement(Componente, {
            ...contexto(p, [pessoa('pessoa-a', { gruposParticipantes: [PT] })]), onExecutar: () => {}, onCadastro: () => {},
        })));
        assert.match(html, lang === 'es' ? /Ninguna persona participa/ : /Nenhuma pessoa participa/);
        assert.match(html, /Pessoa fora/);
        assert.match(html, lang === 'es' ? /Asignación conservada/ : /Designação preservada/);
        assert.doesNotMatch(html, /Publicar|Enviar|OAuth/);
    }
});
