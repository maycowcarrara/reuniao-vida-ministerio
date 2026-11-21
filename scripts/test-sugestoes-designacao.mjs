import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcularRecenciaDesignacao, getDataDesignacao } from '../src/utils/sugestoesDesignacao.js';

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
