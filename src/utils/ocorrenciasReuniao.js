import { getGrupoEfetivoId, getGrupoProgramacao, isProgramacaoV2 } from './gruposProgramacao.js';
import { getProgramacaoWeekStartISO } from './programacoes.js';

export const TIPOS_REUNIAO = Object.freeze(['meioSemana', 'fimDeSemana']);

export const normalizeOcorrenciaReuniao = (programacao, tipo, config = {}) => {
    if (!TIPOS_REUNIAO.includes(tipo)) throw new Error('Tipo de reunião inválido.');
    const bloco = programacao?.[tipo] || {};
    const grupoId = getGrupoEfetivoId(programacao, config);
    const grupo = getGrupoProgramacao(grupoId, config);
    const legadoMeioSemana = tipo === 'meioSemana' && !isProgramacaoV2(programacao);
    const ativo = bloco.ativo === undefined ? legadoMeioSemana : bloco.ativo === true;
    const cancelada = programacao?.cancelada === true || bloco.cancelada === true;
    let eventoEspecial;
    try { eventoEspecial = grupo?.eventosAnuais.find(evento => evento.dataInicio === getProgramacaoWeekStartISO(programacao)); }
    catch { /* Legado sem data conserva o comportamento anterior. */ }
    const bloqueadaPorEvento = [eventoEspecial?.tipo, programacao?.evento, programacao?.tipo].some(evento => /assembleia|congresso/i.test(evento || ''));
    const operacional = !!programacao && grupo?.ativo === true && grupo[tipo]?.habilitada === true && ativo && !cancelada && !bloqueadaPorEvento;
    const agregadoPublicado = isProgramacaoV2(programacao)
        ? programacao?.publicadaNoQuadro === true
        : programacao?.publicadaNoQuadro !== false;
    // E3: acrescentar um tipo à semana publicada não publica a nova ocorrência.
    // Ausência do campo continua herdando o contrato anterior/legado.
    const publicada = agregadoPublicado && bloco.publicadaNoQuadro !== false;
    return {
        ...bloco, grupoId, tipoReuniao: tipo, ativo, cancelada, publicada, eventoEspecial, bloqueadaPorEvento,
        data: bloco.data || (tipo === 'meioSemana'
            ? programacao?.dataReuniao || programacao?.dataExata || programacao?.dataInicio || programacao?.data || ''
            : ''),
        horario: bloco.horario || grupo?.[tipo]?.horario || '',
        operacional,
        publica: operacional && publicada && !programacao?.arquivada,
    };
};

export const isReuniaoAtiva = (programacao, tipo, config = {}) =>
    normalizeOcorrenciaReuniao(programacao, tipo, config).operacional;

export const getReunioesAtivas = (programacao, config = {}, { apenasPublicas = false } = {}) =>
    TIPOS_REUNIAO.map(tipo => normalizeOcorrenciaReuniao(programacao, tipo, config))
        .filter(reuniao => apenasPublicas ? reuniao.publica : reuniao.operacional);
