import test from 'node:test';
import assert from 'node:assert/strict';
import { reconstruirHistoricoGrupo } from '../src/utils/designacoesPorGrupo.js';
import { addHistorico, deduplicarHistorico } from '../src/utils/revisarEnviar/historico.js';
import { normalizeGruposProgramacao } from '../src/utils/gruposProgramacao.js';

const PT = 'grupo-portugues';
const ES = 'grupo-espanhol';

const config = normalizeGruposProgramacao({
    versaoProgramacao: 2,
    grupoLegadoId: PT,
    grupos: {
        [PT]: {
            id: PT,
            nome: 'Português',
            idioma: 'pt',
            ativo: true,
            principal: true,
            meioSemana: { habilitada: true, dia: 'quinta-feira', horario: '19:30' },
            fimDeSemana: { habilitada: true, dia: 'domingo', horario: '09:30' },
            eventosAnuais: [],
        },
        [ES]: {
            id: ES,
            nome: 'Espanhol',
            idioma: 'es',
            ativo: true,
            principal: false,
            meioSemana: { habilitada: false, dia: 'quarta-feira', horario: '19:30' },
            fimDeSemana: { habilitada: true, dia: 'domingo', horario: '10:00' },
            eventosAnuais: [],
        },
    },
});

const pessoa = (id, nome, historico = [], grupos = [PT]) => ({
    id,
    nome,
    tipo: 'irma',
    gruposParticipantes: grupos,
    historico,
});

const semanaPT = (overrides = {}) => ({
    id: 'semana-2026-11-16',
    grupoId: PT,
    versaoProgramacao: 2,
    semana: '16-22 de novembro',
    dataInicio: '2026-11-16',
    meioSemana: { ativo: true, data: '2026-11-19', horario: '19:30' },
    fimDeSemana: { ativo: true, data: '2026-11-22', horario: '09:30', presidente: { id: '1', nome: 'Maycow' }, estudoSentinela: {}, responsabilidades: {} },
    presidente: { id: '1', nome: 'Maycow' },
    partes: [
        {
            id: 'parte-min',
            secao: 'ministerio',
            titulo: '4. Iniciando conversas',
            estudante: { id: '10', nome: 'Márcia Salça da Cruz' },
            ajudante: { id: '2', nome: 'Michele Carrara' },
        },
        {
            id: 'parte-oqd',
            secao: 'ministerio',
            titulo: '6. O que você diria?',
            estudante: { id: '1', nome: 'Maycow' },
        },
    ],
    responsabilidades: {},
    ...overrides,
});

test('reconstruirHistoricoGrupo (grupo legado): substitui legado v1 por v2 sem duplicar, limpa substituidos e preserva outras semanas/grupos', () => {
    const p = semanaPT();
    const esEntryMesmaData = {
        identityVersion: 2,
        grupoId: ES,
        programacaoId: 'prog-es-2026-11-16',
        tipoReuniao: 'fimDeSemana',
        slotId: '["fimDeSemana","presidente"]',
        pessoaId: '1',
        papel: 'presidente_fds',
        data: '2026-11-22',
        parte: 'presidente_fds',
        ajudante: '',
    };
    const alunos = [
        pessoa('1', 'Maycow', [
            { data: '2026-11-19', parte: 'presidente', ajudante: '' },
            { data: '2026-11-19', parte: 'ministerio', ajudante: '' }, // virou o_que_voce_diria
            { data: '2026-11-22', parte: 'presidente_fds', ajudante: '' },
            { data: '2026-10-08', parte: 'presidente', ajudante: '' }, // outra semana -> preservar
            esEntryMesmaData, // outro grupo na mesma data -> preservar
        ], [PT, ES]),
        pessoa('2', 'Michele Carrara', [
            { data: '2026-11-19', parte: 'ajudante', ajudante: 'Márcia Salça da Cruz' },
            { data: '2026-09-24', parte: 'ministerio', ajudante: 'Anna Clara Gomes' },
        ]),
        pessoa('10', 'Márcia Salça da Cruz', [
            { data: '2026-11-19', parte: 'ministerio', ajudante: 'Ajudante Antiga' }, // dupla mudou
        ]),
        pessoa('99', 'Substituída', [
            { data: '2026-11-19', parte: 'ajudante', ajudante: 'Márcia Salça da Cruz' }, // removida da semana
            { data: '2026-10-15', parte: 'ajudante', ajudante: 'Outra' }, // outra semana -> preservar
        ]),
    ];

    const res = reconstruirHistoricoGrupo({
        alunos,
        programacoes: [p],
        config,
        grupoId: PT,
        programacaoIds: [p.id],
        tipos: ['meioSemana', 'fimDeSemana'],
    });

    // Michele: exatamente 2 registros (1 antigo de 24/09 + 1 v2 de 19/11, sem duplicar)
    assert.equal(res[1].historico.length, 2);
    assert.equal(res[1].historico.filter(h => h.data === '2026-11-19').length, 1);
    assert.equal(res[1].historico.find(h => h.data === '2026-11-19').identityVersion, 2);

    // Márcia: registro legado antigo com Ajudante Antiga foi substituído pelo atual com Michele
    assert.equal(res[2].historico.length, 1);
    assert.equal(res[2].historico[0].ajudante, 'Michele Carrara');
    assert.equal(res[2].historico[0].identityVersion, 2);

    // Substituída: registro de 19/11 removido, registro de 15/10 preservado
    assert.deepEqual(res[3].historico, [{ data: '2026-10-15', parte: 'ajudante', ajudante: 'Outra' }]);

    // Maycow: preservou 08/10 e ES 22/11; substituiu 19/11 (presidente + o_que_voce_diria) e PT 22/11 (presidente_fds) sem duplicar
    const maycow = res[0].historico;
    assert.equal(maycow.filter(h => h.data === '2026-10-08').length, 1);
    assert.equal(maycow.filter(h => h.grupoId === ES && h.data === '2026-11-22').length, 1);
    assert.equal(maycow.filter(h => h.grupoId === PT && h.data === '2026-11-22').length, 1);
    assert.equal(maycow.filter(h => h.data === '2026-11-19').length, 2);
    assert.deepEqual(maycow.filter(h => h.data === '2026-11-19').map(h => h.parte).sort(), ['o_que_voce_diria', 'presidente']);

    // Idempotência
    const res2 = reconstruirHistoricoGrupo({
        alunos: res,
        programacoes: [p],
        config,
        grupoId: PT,
        programacaoIds: [p.id],
        tipos: ['meioSemana', 'fimDeSemana'],
    });
    assert.deepEqual(res2, res);
});

test('reconstruirHistoricoGrupo (grupo legado): sincronizar somente meioSemana preserva legado de fimDeSemana e trata troca de dia na mesma semana', () => {
    // Suponha que havia legado na quinta (2026-11-19) e domingo (2026-11-22), e visita mudou meioSemana para terça (2026-11-17)
    const p = semanaPT({
        meioSemana: { ativo: true, data: '2026-11-17', horario: '19:30' },
    });
    const alunos = [
        pessoa('1', 'Maycow', [
            { data: '2026-11-19', parte: 'presidente', ajudante: '' }, // meioSemana antiga na quinta
            { data: '2026-11-22', parte: 'presidente_fds', ajudante: '' }, // fimDeSemana no domingo
            { data: '2026-11-22', parte: 'audio_video', ajudante: '' }, // apoio fimDeSemana no domingo
        ]),
    ];

    const res = reconstruirHistoricoGrupo({
        alunos,
        programacoes: [p],
        config,
        grupoId: PT,
        programacaoIds: [p.id],
        tipos: ['meioSemana'],
    });

    const hist = res[0].historico;
    // Legado da quinta (19/11) foi removido e substituído por v2 na terça (17/11)
    assert.equal(hist.filter(h => h.data === '2026-11-19').length, 0);
    assert.equal(hist.filter(h => h.data === '2026-11-17' && h.parte === 'presidente').length, 1);
    // Legados do domingo (fimDeSemana) foram preservados intactos
    assert.equal(hist.filter(h => h.data === '2026-11-22').length, 2);
});

test('reconstruirHistoricoGrupo: semana reimportada com novo programacaoId na mesma data e grupo nao duplica v2', () => {
    const pNova = semanaPT({ id: 'prog-grupo-portugues-2026-11-16' });
    const alunos = [
        pessoa('2', 'Michele Carrara', [
            {
                identityVersion: 2,
                grupoId: PT,
                programacaoId: 'semana-2026-11-16', // ID antigo antes de excluir e reimportar
                tipoReuniao: 'meioSemana',
                slotId: '["parte","parte-min","ajudante"]',
                pessoaId: '2',
                papel: 'ajudante',
                data: '2026-11-19',
                parte: 'ajudante',
                ajudante: 'Márcia Salça da Cruz',
            },
        ]),
    ];

    const res = reconstruirHistoricoGrupo({
        alunos,
        programacoes: [pNova],
        config,
        grupoId: PT,
        programacaoIds: [pNova.id],
        tipos: ['meioSemana'],
    });

    assert.equal(res[0].historico.length, 1);
    assert.equal(res[0].historico[0].programacaoId, 'prog-grupo-portugues-2026-11-16');
});

test('addHistorico: atualiza mesmo assignmentKey sem duplicar e promove legado apenas do grupo legado', () => {
    const baseV2 = {
        identityVersion: 2,
        grupoId: PT,
        programacaoId: 'semana-2026-11-16',
        tipoReuniao: 'meioSemana',
        slotId: '["parte","p1","estudante"]',
        pessoaId: '10',
        papel: 'estudante',
        data: '2026-11-19',
        parte: 'ministerio',
        ajudante: 'Alzira',
    };

    // Mesmo assignmentKey com ajudante alterado -> substitui em vez de duplicar
    let lista = [pessoa('10', 'Gilvane', [baseV2])];
    lista = addHistorico(lista, '10', { ...baseV2, ajudante: 'Marina' }, { grupoLegadoId: PT });
    assert.equal(lista[0].historico.length, 1);
    assert.equal(lista[0].historico[0].ajudante, 'Marina');

    // Legado equivalente no grupo legado -> promove in-place
    let listaLegado = [pessoa('2', 'Michele', [{ data: '2026-11-19', parte: 'ajudante', ajudante: 'Márcia' }])];
    const v2Michele = { ...baseV2, pessoaId: '2', slotId: '["parte","p1","ajudante"]', papel: 'ajudante', parte: 'ajudante', ajudante: 'Márcia' };
    listaLegado = addHistorico(listaLegado, '2', v2Michele, { grupoLegadoId: PT });
    assert.equal(listaLegado[0].historico.length, 1);
    assert.equal(listaLegado[0].historico[0].identityVersion, 2);

    // Grupo ES nao sobrescreve legado do grupo PT
    let listaES = [pessoa('2', 'Michele', [{ data: '2026-11-19', parte: 'ajudante', ajudante: 'Márcia' }], [PT, ES])];
    listaES = addHistorico(listaES, '2', { ...v2Michele, grupoId: ES, programacaoId: 'prog-es-1' }, { grupoLegadoId: PT });
    assert.equal(listaES[0].historico.length, 2);
});

test('deduplicarHistorico: remove duplicatas v1+v2, v1+v1 e v2+v2 preservando slots distintos e grupos distintos', () => {
    const v2Pt = {
        identityVersion: 2,
        grupoId: PT,
        programacaoId: 'semana-2026-11-16',
        tipoReuniao: 'meioSemana',
        slotId: '["parte","p1","ajudante"]',
        pessoaId: '2',
        papel: 'ajudante',
        data: '2026-11-19',
        parte: 'ajudante',
        ajudante: 'Márcia',
    };
    const v2Es = { ...v2Pt, grupoId: ES, programacaoId: 'prog-es-1' };
    const historico = [
        { data: '2026-11-19', parte: 'ajudante', ajudante: 'Márcia' }, // dup do v2Pt
        { data: '2026-09-10', parte: 'ministerio', ajudante: 'Melanie' },
        { data: '2026-09-10', parte: 'ministerio', ajudante: 'Melanie' }, // dup v1+v1
        v2Pt,
        { ...v2Pt }, // dup v2+v2
        v2Es, // outro grupo -> manter
    ];

    const limpo = deduplicarHistorico(historico, { alunoId: '2', grupoLegadoId: PT });
    assert.equal(limpo.length, 3);
    assert.equal(limpo.filter(h => h.data === '2026-09-10').length, 1);
    assert.equal(limpo.filter(h => h.data === '2026-11-19' && h.grupoId === PT).length, 1);
    assert.equal(limpo.filter(h => h.data === '2026-11-19' && h.grupoId === ES).length, 1);
});
