import { getGrupoEfetivoId, getGrupoProgramacao, isProgramacaoV2 } from './gruposProgramacao.js';
import { createProgramacaoId, getProgramacaoWeekStartISO } from './programacoes.js';
import { createFimDeSemanaDefault, hasFimDeSemanaData } from './fimDeSemana.js';
import { normalizeOcorrenciaReuniao, TIPOS_REUNIAO } from './ocorrenciasReuniao.js';

const DIAS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const validarDataReuniao = data => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') || !Number.isFinite(new Date(`${data}T12:00:00Z`).getTime())
        || new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) !== data) throw new Error('Data ISO inválida.');
    return data;
};
export const validarHorarioReuniao = horario => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario || '')) throw new Error('Informe horário válido (HH:mm).');
    return horario;
};
const semanaDe = data => getProgramacaoWeekStartISO({ dataInicio: validarDataReuniao(data) });
const validarTipo = (config, grupoId, tipo) => {
    const grupo = getGrupoProgramacao(grupoId, config);
    if (!TIPOS_REUNIAO.includes(tipo) || !grupo?.ativo || !grupo[tipo]?.habilitada) {
        throw new Error('Tipo de reunião desabilitado ou grupo inativo.');
    }
    return grupo;
};
const localizar = (programacoes, config, grupoId, semana) => {
    const candidatas = programacoes.filter(item => {
        if (getGrupoEfetivoId(item, config) !== grupoId) return false;
        try { return getProgramacaoWeekStartISO(item) === semana; } catch { return false; }
    });
    if (candidatas.length > 1) throw new Error('Conflito: mais de uma programação no grupo/semana.');
    return candidatas[0];
};
export const temOcorrencia = (programacao, tipo) => {
    if (!programacao) return false;
    const bloco = programacao[tipo];
    if (bloco?.data || bloco?.cancelada || bloco?.ativo) return true;
    if (tipo === 'fimDeSemana') return hasFimDeSemanaData(bloco);
    return !isProgramacaoV2(programacao) || !!programacao.partes?.length;
};
const eventoDaSemana = (grupo, semana) => grupo.eventosAnuais.find(ev => ev.dataInicio === semana);
const bloqueante = evento => /assembleia|congresso/i.test(evento?.tipo || '');
const programacaoBloqueada = atual => [atual?.evento, atual?.tipo].some(tipo => bloqueante({ tipo }));
const baseNova = (grupoId, semana) => ({
    grupoId, versaoProgramacao: 2, dataInicio: semana, semana,
    meioSemana: { ativo: false, data: '', horario: '' }, partes: [],
    publicadaNoQuadro: false,
});
const operacaoBloco = (atual, grupoId, semana, tipo, bloco, extra = {}) => atual
    ? { tipo: 'patch', programacaoId: createProgramacaoId(atual), alteracoes: { ...extra, [tipo]: bloco } }
    : { tipo: 'upsert', programacao: { ...baseNova(grupoId, semana), ...extra, [tipo]: bloco } };

// Não grava. A mesma preparação é repetida dentro do controller na confirmação.
export const prepararAgendamento = ({ programacoes = [], config, grupoId, tipo, data, horario }) => {
    const grupo = validarTipo(config, grupoId, tipo);
    validarHorarioReuniao(horario);
    const semana = semanaDe(data);
    const atual = localizar(programacoes, config, grupoId, semana);
    const evento = eventoDaSemana(grupo, semana);
    const ocorrencia = atual && normalizeOcorrenciaReuniao(atual, tipo, config);
    let status = 'criar';
    if (atual?.cancelada || ocorrencia?.cancelada) status = 'cancelada';
    else if (atual?.arquivada) status = 'arquivada';
    else if (temOcorrencia(atual, tipo)) status = ocorrencia.data === data ? 'existente' : 'conflito';
    else if (bloqueante(evento) || programacaoBloqueada(atual)) status = 'evento';
    const bloco = { ...(tipo === 'fimDeSemana' ? createFimDeSemanaDefault() : {}),
        ativo: false, publicadaNoQuadro: false, data, horario, ...(evento ? { eventoEspecial: { ...evento } } : {}) };
    return { data, horario, semana, status, evento,
        operacoes: status === 'criar' ? [operacaoBloco(atual, grupoId, semana, tipo, bloco)] : [] };
};

export const prepararGeracaoReunioes = ({ programacoes = [], config, grupoId, tipo, inicio, fim }) => {
    const grupo = validarTipo(config, grupoId, tipo);
    validarDataReuniao(inicio); validarDataReuniao(fim);
    if (inicio > fim) throw new Error('Intervalo invertido.');
    const padrao = grupo[tipo];
    if (padrao.frequencia !== 'semanal') throw new Error('Escolha datas explícitas para esta frequência.');
    const dia = DIAS.indexOf(padrao.dia);
    if (dia < 0) throw new Error('Defina o dia semanal.');
    validarHorarioReuniao(padrao.horario);
    const cursor = new Date(`${inicio}T12:00:00Z`);
    const duracao = (new Date(`${fim}T12:00:00Z`) - cursor) / 86400000;
    if (duracao > 366) throw new Error('Escolha um intervalo finito de até 367 dias por lote.');
    const previa = [];
    for (; cursor.toISOString().slice(0, 10) <= fim; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        if (cursor.getUTCDay() !== dia) continue;
        previa.push(prepararAgendamento({ programacoes, config, grupoId, tipo,
            data: cursor.toISOString().slice(0, 10), horario: padrao.horario }));
    }
    return { previa, operacoes: previa.flatMap(item => item.operacoes) };
};

// Importação é allowlist de conteúdo, nunca spread do documento recebido.
// Partes já designadas não podem ser descartadas por uma reimportação.
export const prepararImportacaoMeioSemana = ({ programacoes = [], config, grupoId, dados, data, horario }) => {
    const grupo = validarTipo(config, grupoId, 'meioSemana');
    const semana = semanaDe(data);
    validarHorarioReuniao(horario);
    if (dados?.grupoId && dados.grupoId !== grupoId) throw new Error('Importação aponta para outro grupo.');
    if (dados?.dataInicio && semanaDe(dados.dataInicio) !== semana) throw new Error('Data fora da semana importada.');
    if (!Array.isArray(dados?.partes) || !dados.partes.length) throw new Error('Importação sem conteúdo.');
    const atual = localizar(programacoes, config, grupoId, semana);
    if (dados.id && dados.id !== atual?.id) throw new Error('ID de importação não corresponde ao destino.');
    const ocorrencia = atual && normalizeOcorrenciaReuniao(atual, 'meioSemana', config);
    if (atual?.cancelada || atual?.arquivada || ocorrencia?.cancelada) throw new Error('Ocorrência cancelada/arquivada preservada.');
    const evento = eventoDaSemana(grupo, semana);
    if (bloqueante(evento) || programacaoBloqueada(atual)) throw new Error('Evento impeditivo neste grupo/semana.');
    if (temOcorrencia(atual, 'meioSemana') && ocorrencia.data !== data) throw new Error('Conflito: segunda reunião do mesmo tipo no grupo/semana.');
    // Reimportar conteúdo idêntico é no-op; conteúdo diferente exige revisão
    // explícita em etapa posterior para não perder designações por IDs de parser.
    if (atual?.partes?.length) {
        if (JSON.stringify(atual.partes) === JSON.stringify(dados.partes)) return { operacoes: [] };
        throw new Error('Já existe conteúdo de meio de semana; substituição exige revisão explícita.');
    }
    const bloco = { ativo: temOcorrencia(atual, 'meioSemana') ? ocorrencia.ativo : false,
        ...(!temOcorrencia(atual, 'meioSemana') ? { publicadaNoQuadro: false } : {}),
        data: temOcorrencia(atual, 'meioSemana') ? ocorrencia.data : data,
        horario: atual?.meioSemana?.horario || horario, ...(evento ? { eventoEspecial: { ...evento } } : {}) };
    return { operacoes: [operacaoBloco(atual, grupoId, semana, 'meioSemana', bloco,
        { partes: dados.partes, ...(!atual ? { semana: dados.semana || semana } : {}) })] };
};

export const prepararEstadoOcorrencia = ({ programacoes = [], config, grupoId, programacaoId, tipo, cancelar = false }) => {
    validarTipo(config, grupoId, tipo);
    const atual = programacoes.find(item => createProgramacaoId(item) === programacaoId && getGrupoEfetivoId(item, config) === grupoId);
    if (!temOcorrencia(atual, tipo)) throw new Error('Ocorrência não encontrada.');
    const ocorrencia = normalizeOcorrenciaReuniao(atual, tipo, config);
    if (atual.arquivada || ocorrencia.cancelada) throw new Error('Ocorrência cancelada/arquivada preservada.');
    if (!cancelar) { validarDataReuniao(ocorrencia.data); validarHorarioReuniao(ocorrencia.horario); }
    const evento = eventoDaSemana(getGrupoProgramacao(grupoId, config), semanaDe(ocorrencia.data));
    if (!cancelar && (bloqueante(evento) || programacaoBloqueada(atual))) throw new Error('Evento impeditivo neste grupo/semana.');
    return { operacoes: [{ tipo: 'patch', programacaoId,
        alteracoes: { [tipo]: { ativo: !cancelar, ...(cancelar ? { cancelada: true } : {}) } } }] };
};

export const prepararEdicaoDiscurso = ({ programacoes = [], config, grupoId, programacaoId, valores }) => {
    validarTipo(config, grupoId, 'fimDeSemana');
    const atual = programacoes.find(item => createProgramacaoId(item) === programacaoId && getGrupoEfetivoId(item, config) === grupoId);
    if (!temOcorrencia(atual, 'fimDeSemana') || atual.cancelada || atual.arquivada || atual.fimDeSemana?.cancelada) throw new Error('Ocorrência indisponível.');
    const reuniaoPublica = Object.fromEntries(['temaDiscurso', 'oradorNomeManual', 'congregacaoOrador'].map(key => [key, String(valores[key] || '')]));
    return { operacoes: [{ tipo: 'patch', programacaoId, alteracoes: { fimDeSemana: { reuniaoPublica } } }] };
};
