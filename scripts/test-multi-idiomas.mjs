import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    GRUPO_PORTUGUES_ID as PT, GRUPO_ESPANHOL_ID as ES,
    normalizeGruposProgramacao, getGrupoEfetivoId, getGruposParticipantes,
    normalizeParticipacaoAluno, createParticipacaoAlunoDefault, participaDoGrupo,
} from '../src/utils/gruposProgramacao.js';
import { getReunioesAtivas, isReuniaoAtiva, normalizeOcorrenciaReuniao } from '../src/utils/ocorrenciasReuniao.js';
import {
    createProgramacaoId, ensureUniqueProgramacaoIds, reconcileProgramacaoIds,
    findMatchingProgramacaoId, findMatchingProgramacaoIndex, getProgramacaoIdentitySignature,
    getProgramacaoWeekStartISO,
} from '../src/utils/programacoes.js';
import { getAlunoCapabilities, isAlunoEligibleForAssignment } from '../src/utils/assignmentEligibility.js';

const freezeDeep = value => {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freezeDeep);
        Object.freeze(value);
    }
    return value;
};
const legacyConfig = freezeDeep({
    nome_cong: 'Congregação atual', idioma: 'pt', dia_reuniao: 'Quinta-feira', horario: '20:00',
    dia_reuniao_fds: 'Domingo', horario_fds: '09:00',
    eventosAnuais: [{ dataInicio: '2026-11-02', tipo: 'visita' }], desconhecido: { manter: true },
});
const legacy = freezeDeep({
    id: 'documento-antigo', semana: '2-8 de novembro', dataInicio: '2026-11-02',
    dataReuniao: '2026-11-05', partes: [],
    fimDeSemana: { ativo: true, data: '2026-11-08', horario: '10:30', presidente: { id: 'pessoa-001' } },
    vinculos: { assignmentKey: 'chave-v1', token: 'token-fixture', calendarEventId: 'evento-v1' },
});
const weekendES = freezeDeep({
    versaoProgramacao: 2, grupoId: ES, dataInicio: '2026-11-02', semana: legacy.semana,
    meioSemana: { ativo: false }, partes: [],
    fimDeSemana: { ativo: true, data: '2026-11-08', horario: '09:30' },
    publicadaNoQuadro: false,
});

test('projeção pura/idempotente preserva configuração real, desconhecidos e eventos somente no legado', () => {
    const snapshot = JSON.stringify(legacyConfig);
    const config = normalizeGruposProgramacao(legacyConfig);
    assert.equal(JSON.stringify(legacyConfig), snapshot);
    assert.deepEqual(normalizeGruposProgramacao(freezeDeep(config)), config);
    assert.equal(config.grupos[PT].nome, 'Congregação atual');
    assert.deepEqual(config.grupos[PT].meioSemana, { habilitada: true, frequencia: 'semanal', dia: 'thursday', horario: '20:00' });
    assert.deepEqual(config.grupos[PT].fimDeSemana, { habilitada: true, frequencia: 'semanal', dia: 'sunday', horario: '09:00' });
    assert.deepEqual(config.grupos[PT].eventosAnuais, legacyConfig.eventosAnuais);
    assert.deepEqual(config.grupos[ES].eventosAnuais, []);
    assert.deepEqual(config.desconhecido, { manter: true });
    assert.equal(config.dia_reuniao, 'thursday');
    assert.equal(config.horario, '20:00');
});

test('espanhol inicia sem horários/dias inventados e com identificação requerida', () => {
    const es = normalizeGruposProgramacao().grupos[ES];
    assert.equal(es.nome, 'Pré-grupo / Grupo de espanhol');
    assert.equal(es.identificacao, 'Pré-grupo / Grupo');
    assert.deepEqual(es.meioSemana, { habilitada: false, frequencia: 'semanal', dia: null, horario: '' });
    assert.deepEqual(es.fimDeSemana, { habilitada: true, frequencia: 'datas', dia: null, horario: '' });
});

test('identificação não restringe frequência nem habilitação de tipos em espanhol', () => {
    const config = normalizeGruposProgramacao({ ...legacyConfig, grupos: {
        [ES]: { meioSemana: { habilitada: true, dia: 'martes', horario: '19:00' }, fimDeSemana: { frequencia: 'semanal' } },
    } });
    assert.equal(config.grupos[ES].identificacao, 'Pré-grupo / Grupo');
    assert.equal(config.grupos[ES].meioSemana.dia, 'tuesday');
    assert.equal(config.grupos[ES].fimDeSemana.frequencia, 'semanal');
    assert.equal(isReuniaoAtiva({ ...weekendES, meioSemana: { ativo: true } }, 'meioSemana', config), true);
});

test('mudar principal não reatribui registros, participação nem eventos antigos', () => {
    const config = normalizeGruposProgramacao({ ...legacyConfig, grupoPrincipalId: ES });
    assert.equal(config.grupoLegadoId, PT);
    assert.equal(getGrupoEfetivoId(legacy, config), PT);
    assert.deepEqual(getGruposParticipantes({ id: 'pessoa-001' }, config), [PT]);
    assert.deepEqual(config.grupos[ES].eventosAnuais, []);
    assert.equal(getGrupoEfetivoId({ grupoId: ES }, config), ES);
});

test('grupo legado explicitamente fixado é independente do principal', () => {
    const config = normalizeGruposProgramacao({ ...legacyConfig, grupoLegadoId: ES, grupoPrincipalId: PT });
    assert.equal(getGrupoEfetivoId({}, config), ES);
    assert.deepEqual(getGruposParticipantes({}, config), [ES]);
    assert.deepEqual(config.grupos[ES].eventosAnuais, legacyConfig.eventosAnuais);
    assert.deepEqual(config.grupos[PT].eventosAnuais, []);
});

test('instalação legada em espanhol ambígua exige definição; não reclassifica em silêncio', () => {
    assert.throws(() => normalizeGruposProgramacao({ idioma: 'es' }), /grupoLegadoId/);
    assert.throws(() => normalizeGruposProgramacao({ grupoLegadoId: 'inexistente' }), /configuração/);
});

test('alunos antigos e padrão de novos cadastros são PT, nunca ES por idioma/principal', () => {
    const config = { grupoPrincipalId: ES, idioma: 'es', grupoLegadoId: PT };
    assert.deepEqual(getGruposParticipantes({}, config), [PT]);
    assert.deepEqual(createParticipacaoAlunoDefault(), [PT]);
    const first = createParticipacaoAlunoDefault();
    first.push(ES);
    assert.deepEqual(createParticipacaoAlunoDefault(), [PT]);
});

test('participação vazia e escolhas duplas sobrevivem salvar/reler sem tocar habilitações ou dados', () => {
    for (const grupos of [[], [PT], [ES], [PT, ES]]) {
        const aluno = freezeDeep({ id: '001', gruposParticipantes: grupos, tipo: 'servo',
            partesHabilitadas: ['o_que_voce_diria'], familia: 'A', telefone: 'fixture', historico: [{ key: 'v1' }] });
        const normalized = normalizeParticipacaoAluno(aluno);
        assert.deepEqual(JSON.parse(JSON.stringify(normalized)), aluno);
        assert.equal(participaDoGrupo(normalized, PT), grupos.includes(PT));
        assert.equal(participaDoGrupo(normalized, ES), grupos.includes(ES));
        assert.deepEqual(getAlunoCapabilities(normalized), getAlunoCapabilities(aluno));
    }
    assert.deepEqual(getGruposParticipantes({ gruposParticipantes: null }), []);
    assert.deepEqual(getGruposParticipantes({ gruposParticipantes: [PT, PT, null, ''] }), [PT]);
});

test('participação simultânea não amplia habilitações de O que você diria?', () => {
    const aluno = { tipo: 'servo', gruposParticipantes: [PT, ES], partesHabilitadas: ['ministerio'] };
    for (const grupo of [PT, ES]) {
        assert.equal(participaDoGrupo(aluno, grupo), true);
        assert.equal(isAlunoEligibleForAssignment({ aluno, parte: { titulo: 'O que você diria?' }, slotKey: 'estudante' }).eligible, false);
    }
});

test('legado sem indicador de meio de semana mantém reuniões, IDs e vínculos intactos', () => {
    const snapshot = JSON.stringify(legacy);
    assert.equal(isReuniaoAtiva(legacy, 'meioSemana', legacyConfig), true);
    assert.deepEqual(getReunioesAtivas(legacy, legacyConfig).map(r => r.tipoReuniao), ['meioSemana', 'fimDeSemana']);
    assert.equal(getReunioesAtivas(legacy, legacyConfig, { apenasPublicas: true }).length, 2);
    assert.equal(createProgramacaoId(legacy), 'documento-antigo');
    assert.deepEqual(reconcileProgramacaoIds([legacy], [legacy]), [legacy]);
    assert.equal(JSON.stringify(legacy), snapshot);
    assert.equal(isReuniaoAtiva({ ...legacy, fimDeSemana: undefined }, 'fimDeSemana'), false);
});

test('fim de semana isolado funciona no domínio sem importação e não cria meio de semana fantasma', () => {
    const semApostila = { ...weekendES };
    delete semApostila.partes;
    assert.deepEqual(getReunioesAtivas(semApostila).map(r => r.tipoReuniao), ['fimDeSemana']);
    assert.equal(isReuniaoAtiva({ ...weekendES, meioSemana: undefined }, 'meioSemana'), false);
    assert.equal(getReunioesAtivas(semApostila, {}, { apenasPublicas: true }).length, 0);
    assert.equal(getReunioesAtivas({ ...semApostila, publicadaNoQuadro: true }, {}, { apenasPublicas: true }).length, 1);
    assert.equal(getReunioesAtivas({ ...semApostila, publicadaNoQuadro: undefined }, {}, { apenasPublicas: true }).length, 0);
});

test('meio de semana importado mas desabilitado permanece intacto e inoperante', () => {
    const imported = freezeDeep({ ...weekendES, meioSemana: { ativo: true }, partes: [{ id: 'parte1', estudante: { id: '001' } }] });
    const snapshot = JSON.stringify(imported);
    assert.equal(isReuniaoAtiva(imported, 'meioSemana'), false);
    assert.equal(getReunioesAtivas(imported).length, 1);
    assert.equal(JSON.stringify(imported), snapshot);
});

test('grupo inativo, tipo desabilitado e cancelamento tornam ocorrência inoperante', () => {
    for (const programacao of [
        { ...weekendES, cancelada: true },
        { ...weekendES, fimDeSemana: { ...weekendES.fimDeSemana, cancelada: true } },
        { ...weekendES, fimDeSemana: { ativo: false } },
    ]) assert.equal(getReunioesAtivas(programacao).length, 0);
    for (const es of [{ ativo: false }, { fimDeSemana: { habilitada: false } }]) {
        assert.equal(getReunioesAtivas(weekendES, { grupos: { [ES]: es } }).length, 0);
    }
    assert.equal(getReunioesAtivas({ ...weekendES, grupoId: 'desconhecido' }).length, 0);
    assert.equal(getReunioesAtivas(null).length, 0);
});

test('arquivamento e rascunho retiram publicidade sem apagar dados ou histórico operacional', () => {
    for (const p of [{ ...legacy, arquivada: true }, { ...legacy, publicadaNoQuadro: false }]) {
        assert.equal(getReunioesAtivas(p, {}, { apenasPublicas: true }).length, 0);
        assert.equal(getReunioesAtivas(p).length, 2);
    }
});

test('ocorrência explícita vence padrão e evento especial sem partes continua ativo', () => {
    const occurrence = normalizeOcorrenciaReuniao(legacy, 'fimDeSemana', legacyConfig);
    assert.equal(occurrence.horario, '10:30');
    assert.equal(occurrence.data, '2026-11-08');
    const config = { grupos: { [ES]: { meioSemana: { habilitada: true, horario: '19:00' } } } };
    const especial = { ...weekendES, evento: 'visita', meioSemana: { ativo: true, data: '2026-11-03', horario: '20:15' } };
    assert.equal(isReuniaoAtiva(especial, 'meioSemana', config), true);
    assert.equal(normalizeOcorrenciaReuniao(especial, 'meioSemana', config).horario, '20:15');
    assert.throws(() => normalizeOcorrenciaReuniao(legacy, 'outro'), /Tipo/);
});

test('IDs legados sem grupo continuam com formato/hash anteriores à E1', () => {
    assert.equal(createProgramacaoId({ dataInicio: '2026-11-02' }), 'semana-2026-11-02');
    assert.equal(getProgramacaoIdentitySignature({ semana: 'Semana sem data', partes: [] }), 'yk0nqg');
    assert.equal(createProgramacaoId({ semana: 'Semana sem data', partes: [] }), 'semana-hash-yk0nqg');
});

test('mesma semana/título PT e ES têm IDs determinísticos distintos; título/idioma não são identidade', () => {
    const pt = { ...weekendES, grupoId: PT };
    assert.equal(createProgramacaoId(pt), 'prog-grupo-portugues-2026-11-02');
    assert.equal(createProgramacaoId(weekendES), 'prog-grupo-espanhol-2026-11-02');
    assert.notEqual(getProgramacaoIdentitySignature(pt), getProgramacaoIdentitySignature(weekendES));
    assert.equal(createProgramacaoId({ ...weekendES, semana: 'Título traduzido', idioma: 'pt' }), createProgramacaoId(weekendES));
    assert.equal(createProgramacaoId({ ...weekendES, dataInicio: '2026-11-08' }), createProgramacaoId(weekendES));
    assert.equal(createProgramacaoId({ grupoId: ES, fimDeSemana: { data: '2026-11-08' } }), createProgramacaoId(weekendES));
    assert.equal(getProgramacaoWeekStartISO({ dataInicio: '2027-01-03' }), '2026-12-28');
    assert.equal(createProgramacaoId({ ...weekendES, grupoId: 'grupo/es' }).includes('/'), false);
});

test('v2 sem data válida falha sem usar rótulo traduzido nem identidade aleatória', () => {
    for (const dataInicio of ['', '2026-02-30', '2026-13-01', '02/11/2026']) {
        assert.throws(() => createProgramacaoId({ grupoId: ES, dataInicio, semana: '2-8 novembro' }), /data ISO/);
    }
});

test('reconciliação por data, assinatura e título nunca adota ID de outro grupo', () => {
    for (const registro of [
        { dataInicio: '2026-11-02', semana: legacy.semana },
        { partes: [{ id: 'a', titulo: 'Título' }] },
        { semana: 'Mesmo título', partes: [{ id: 'a' }] },
    ]) {
        const existente = { ...registro, id: 'es-existente', grupoId: ES };
        assert.equal(findMatchingProgramacaoIndex(registro, [existente]), -1);
        assert.notEqual(findMatchingProgramacaoId(registro, [existente]), 'es-existente');
    }
    const existenteES = { ...weekendES, id: 'id-es-antigo' };
    assert.equal(findMatchingProgramacaoId(weekendES, [legacy, existenteES]), 'id-es-antigo');
    assert.equal(findMatchingProgramacaoId({ ...legacy, id: undefined }, [existenteES, legacy]), legacy.id);
    assert.equal(findMatchingProgramacaoId({ ...legacy, id: undefined }, [legacy], { grupoPrincipalId: ES }), legacy.id);
});

test('conflito por ID explícito de outro grupo é recusado, preservando documentos e vínculos', () => {
    const adulterado = { ...weekendES, id: legacy.id };
    assert.throws(() => findMatchingProgramacaoId(adulterado, [legacy]), /outro grupo/);
    assert.throws(() => findMatchingProgramacaoIndex(adulterado, [legacy]), /outro grupo/);
    assert.throws(() => reconcileProgramacaoIds([adulterado], [legacy]), /outro grupo/);
    assert.equal(createProgramacaoId(legacy), legacy.id);
    assert.equal(legacy.vinculos.assignmentKey, 'chave-v1');
});

test('duplicatas explícitas/v2 geram conflito sem renomear IDs ou vínculos silenciosamente', () => {
    assert.throws(() => ensureUniqueProgramacaoIds([legacy, legacy]), /duplicado/);
    assert.throws(() => ensureUniqueProgramacaoIds([weekendES, weekendES]), /duplicado/);
    assert.throws(() => reconcileProgramacaoIds([weekendES, weekendES]), /duplicado/);
    const result = ensureUniqueProgramacaoIds([legacy, weekendES]);
    assert.equal(result[0].id, legacy.id);
    assert.deepEqual(result[0].vinculos, legacy.vinculos);
    assert.equal(result[1].id, 'prog-grupo-espanhol-2026-11-02');
});
