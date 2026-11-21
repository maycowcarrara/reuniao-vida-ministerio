import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    calcularOcupacaoReuniao,
    calcularRecenciaDesignacao,
    getDataDesignacao,
    getTipoReuniaoSlot,
} from '../src/utils/sugestoesDesignacao.js';

const pessoa = { id: 'irmao', nome: 'Irmao' };
const parte = { id: 'ebc', titulo: 'Estudo biblico de congregacao', leitor: pessoa };
const contexto = { capabilityKey: 'leitor_ebc', slotKey: 'leitor' };
const hoje = new Date(2026, 10, 21, 23, 30);
const calcular = (historico, extra = {}) => calcularRecenciaDesignacao({ alunoId: pessoa.id, historico, contexto, hoje, ...extra });

test('Sugestao considera designacao futura em outra semana sem gravar historico', () => {
    const historico = [{ id: 'rascunho', publicadaNoQuadro: false, meioSemana: { ativo: true, data: '2026-12-10' }, partes: [parte] }];
    const antes = structuredClone(historico);
    assert.deepEqual(calcular(historico), { ultimaData: '2026-12-10', diasSemFazer: -19 });
    assert.deepEqual(historico, antes);
});

test('Sugestao escolhe a data mais recente independentemente da ordem das semanas', () => {
    const semanas = ['2026-11-05', '2026-12-17', '2026-11-19'].map(data => ({ meioSemana: { data }, partes: [parte] }));
    for (const historico of [semanas, [...semanas].reverse()]) {
        assert.deepEqual(calcular(historico), { ultimaData: '2026-12-17', diasSemFazer: -26 });
    }
});

test('Sugestao conserva datas antigas e separa capacidades e pessoas', () => {
    const historico = [
        { dataReuniao: '2026-11-19', partes: [parte] },
        { meioSemana: { data: '2026-12-17' }, partes: [{ ...parte, leitor: null, dirigente: pessoa }] },
        { meioSemana: { data: '2026-12-24' }, partes: [{ ...parte, leitor: { id: 'outro' } }] },
    ];
    assert.deepEqual(calcular(historico), { ultimaData: '2026-11-19', diasSemFazer: 2 });
});

test('Sugestao ignora datas invalidas e continua buscando designacao valida', () => {
    const invalidas = [undefined, '', 'invalida', '2026-02-30'].map(data => ({ meioSemana: { data }, partes: [parte] }));
    assert.deepEqual(calcular(invalidas), { ultimaData: null, diasSemFazer: 9999 });
    assert.deepEqual(calcular([{ dataReuniao: '2026-10-29', partes: [parte] }, ...invalidas]), { ultimaData: '2026-10-29', diasSemFazer: 23 });
});

test('Sugestao resolve semana importada usando o dia configurado e conserva ano', () => {
    const semana = { semana: '7-13 de dezembro', dataInicio: '2026-12-07', partes: [parte] };
    assert.deepEqual(calcular([semana], { config: { dia_reuniao: 'thursday' } }), { ultimaData: '2026-12-10', diasSemFazer: -19 });
    assert.equal(getDataDesignacao({ meioSemana: { data: '10/12/2026' }, dataReuniao: '2026-12-07' }), '2026-12-10');
});

test('Sugestao usa datas proprias para apoio, presidente e fim de semana', () => {
    const semana = { meioSemana: { data: '2026-12-10' }, presidente: pessoa, responsabilidades: { videoZoomSom: [pessoa] },
        fimDeSemana: { ativo: true, data: '2026-12-13', estudoSentinela: { leitor: pessoa }, oracaoFinal: pessoa } };
    for (const [capabilityKey, slotKey, data] of [
        ['presidente_rvm', 'presidente', '2026-12-10'],
        ['audio_video', 'audio_video', '2026-12-10'],
        ['leitor_sentinela', 'leitor_sentinela', '2026-12-13'],
        ['oracao', 'oracao_fds', '2026-12-13'],
    ]) assert.equal(calcular([semana], { contexto: { capabilityKey, slotKey } }).ultimaData, data);
});

test('Sugestao calcula dias de calendario sem depender da hora ou horario de verao', () => {
    const historico = [{ meioSemana: { data: '2026-11-21' }, partes: [parte] }];
    for (const hora of [0, 12, 23]) assert.equal(calcular(historico, { hoje: new Date(2026, 10, 21, hora) }).diasSemFazer, 0);
});

test('Ocupacao separa estritamente reuniao de meio de semana e fim de semana', () => {
    const jean = { id: '55', nome: 'Jean Cova', familia: 'Cova' };
    const parenteJean = { id: '56', nome: 'Parente Jean', familia: 'Cova' };
    const marco = { id: '7', nome: 'Marco Ress', familia: 'Ress' };
    const nelson = { id: '13', nome: 'Nelson Salca', familia: 'Salca' };
    const semana = {
        meioSemana: { ativo: true, data: '2026-12-10' },
        presidente: marco,
        partes: [
            { id: 'p-oracao-ini', tipo: 'oracao_inicial', titulo: 'Cantico e oracao inicial', oracao: marco },
            { id: 'p-ebc', tipo: 'estudo', titulo: 'Estudo biblico de congregacao', dirigente: marco, leitor: null },
        ],
        responsabilidades: { videoZoomSom: [jean] },
        fimDeSemana: {
            ativo: true,
            data: '2026-12-13',
            presidente: nelson,
            oracaoFinal: null,
            estudoSentinela: { dirigente: null, leitor: null },
            responsabilidades: { videoZoomSom: [], indicadoresEntrada: [], indicadoresAuditorio: [], microfonesVolantes: [] },
        },
    };
    const alunos = [jean, parenteJean, marco, nelson];

    assert.equal(getTipoReuniaoSlot({ key: 'oracao_fds', fds: true }), 'fimDeSemana');
    assert.equal(getTipoReuniaoSlot({ key: 'oracao_fds' }), 'fimDeSemana');
    assert.equal(getTipoReuniaoSlot({ key: 'audio_video', fds: true }), 'fimDeSemana');
    assert.equal(getTipoReuniaoSlot({ key: 'audio_video', meioSemana: true }), 'meioSemana');
    assert.equal(getTipoReuniaoSlot({ key: 'oracao', parteId: 'p-oracao-ini' }), 'meioSemana');

    // Designando fim de semana: quem esta no meio de semana (Jean, Marco) fica LIVRE
    const ocupFds = calcularOcupacaoReuniao({
        semana,
        targetSlot: { key: 'oracao_fds', fds: true },
        alunos,
    });
    assert.equal(ocupFds.tipoReuniao, 'fimDeSemana');
    assert.equal(ocupFds.isAlunoOcupado(jean), false);
    assert.equal(ocupFds.isAlunoOcupado(marco), false);
    assert.equal(ocupFds.isFamiliaOcupada(parenteJean), false);
    assert.equal(ocupFds.isAlunoOcupado(nelson), true);
    assert.deepEqual(ocupFds.getPartesOcupadas(nelson), ['Presidente']);
    // O proprio designado nao deve ser marcado como familiaOcupada por si mesmo
    assert.equal(ocupFds.isFamiliaOcupada(nelson), false);

    // Designando meio de semana: quem esta so no fim de semana (Nelson) fica LIVRE
    const ocupMeio = calcularOcupacaoReuniao({
        semana,
        targetSlot: { key: 'leitor', parteId: 'p-ebc' },
        alunos,
    });
    assert.equal(ocupMeio.tipoReuniao, 'meioSemana');
    assert.equal(ocupMeio.isAlunoOcupado(nelson), false);
    assert.equal(ocupMeio.isAlunoOcupado(jean), true);
    assert.deepEqual(ocupMeio.getPartesOcupadas(jean), ['Vídeo, Zoom e som']);
    assert.equal(ocupMeio.isFamiliaOcupada(parenteJean), true);
    assert.equal(ocupMeio.isFamiliaOcupada(jean), false);
});

test('Ocupacao ignora campos ocultos/residuais de partes e exclui o proprio slot alvo', () => {
    const jean = { id: '55', nome: 'Jean Cova' };
    const bruno = { id: '35', nome: 'Bruno Rosa' };
    const semana = {
        meioSemana: { ativo: true, data: '2026-12-10' },
        partes: [
            { id: 'c1', secao: 'vida', tipo: 'cantico', titulo: 'Cantico 10', estudante: jean },
            { id: 'o1', secao: 'tesouros', tipo: 'oracao_inicial', titulo: 'Cantico e oracao inicial', oracao: bruno, estudante: jean },
            { id: 'q1', secao: 'ministerio', tipo: 'parte', titulo: '6. O que voce diria?', estudante: bruno, ajudante: jean },
            { id: 'e1', secao: 'vida', tipo: 'estudo', titulo: 'Estudo biblico de congregacao', dirigente: bruno, leitor: null, estudante: jean },
        ],
        fimDeSemana: { ativo: false, presidente: jean },
    };

    const ocup = calcularOcupacaoReuniao({
        semana,
        targetSlot: { key: 'leitor', parteId: 'e1' },
        alunos: [jean, bruno],
    });
    assert.equal(ocup.isAlunoOcupado(jean), false);
    assert.equal(ocup.isAlunoOcupado(bruno), true);

    // Excluir o proprio slot alvo: se Bruno esta apenas em o1.oracao, abrir sugestao em o1.oracao nao o marca como ocupado
    const semanaUnica = {
        meioSemana: { ativo: true, data: '2026-12-10' },
        partes: [{ id: 'o1', tipo: 'oracao_inicial', titulo: 'Oracao inicial', oracao: { id: 35, nome: 'Bruno Rosa' } }],
    };
    const ocupMesmoSlot = calcularOcupacaoReuniao({
        semana: semanaUnica,
        targetSlot: { key: 'oracao', parteId: 'o1' },
        alunos: [bruno],
    });
    assert.equal(ocupMesmoSlot.isAlunoOcupado(bruno), false);

    // Em outro slot da mesma reuniao, id numerico 35 coincide com string '35'
    const ocupOutroSlot = calcularOcupacaoReuniao({
        semana: semanaUnica,
        targetSlot: { key: 'presidente' },
        alunos: [bruno],
    });
    assert.equal(ocupOutroSlot.isAlunoOcupado(bruno), true);
});

test('Ocupacao isola celebracao na reuniao substituida sem contaminar a outra reuniao', () => {
    const jean = { id: '55', nome: 'Jean Cova' };
    const config = {
        grupoLegadoId: 'grupo-pt',
        grupoSelecionadoId: 'grupo-pt',
        grupos: {
            'grupo-pt': {
                id: 'grupo-pt',
                ativo: true,
                idioma: 'pt',
                meioSemana: { habilitada: true, frequencia: 'semanal', dia: 'thursday', horario: '19:45' },
                fimDeSemana: { habilitada: true, frequencia: 'semanal', dia: 'sunday', horario: '18:30' },
                eventosAnuais: [{ dataInicio: '2026-03-30', dataInput: '2026-04-02', tipo: 'celebracao' }],
            },
        },
    };
    const semana = {
        id: 'prog-celebracao',
        grupoId: 'grupo-pt',
        dataInicio: '2026-03-30',
        meioSemana: { ativo: true, data: '2026-04-02' },
        fimDeSemana: { ativo: true, data: '2026-04-05', presidente: null, estudoSentinela: { dirigente: null, leitor: null }, responsabilidades: {} },
        celebracao: { ativo: true, horario: '19:30', oradorNomeManual: 'Orador', responsabilidades: { videoZoomSom: [jean] } },
    };

    const ocupFds = calcularOcupacaoReuniao({ semana, tipoReuniao: 'fimDeSemana', alunos: [jean], config });
    const ocupMeio = calcularOcupacaoReuniao({ semana, tipoReuniao: 'meioSemana', alunos: [jean], config });
    assert.equal(ocupFds.isAlunoOcupado(jean), false);
    assert.equal(ocupMeio.isAlunoOcupado(jean), true);
});
