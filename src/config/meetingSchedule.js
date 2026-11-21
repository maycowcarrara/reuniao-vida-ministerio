import { normalizeMeetingDay } from './appConfig.js';

// Dias por vigencia. Datas civis em ISO evitam conversoes de fuso horario.
const DIAS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const hojeReunioesISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export const isDataAgendaValida = data => /^\d{4}-\d{2}-\d{2}$/.test(data || '')
    && Number.isFinite(new Date(`${data}T12:00:00Z`).getTime())
    && new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) === data;

const historicoOrdenado = padrao => [...(padrao.historicoDias || [])].sort((a, b) => a.data.localeCompare(b.data));
export const getDiaReuniaoVigente = (padrao, data) => {
    const historico = historicoOrdenado(padrao);
    let dia = padrao.dia;
    for (const troca of historico.reverse()) {
        if (data >= troca.data) break;
        dia = troca.diaAnterior;
    }
    if (padrao.proximaTroca?.data <= data) dia = padrao.proximaTroca.dia;
    return dia ? normalizeMeetingDay(dia) : null;
};

export const getDataSemanalVigente = (semana, padrao) => {
    if (!isDataAgendaValida(semana)) return null;
    const cursor = new Date(`${semana}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
    for (let i = 0; i < 7; i++, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const data = cursor.toISOString().slice(0, 10);
        if (DIAS[cursor.getUTCDay()] === getDiaReuniaoVigente(padrao, data)) return data;
    }
    return null;
};

export const validarProximaTroca = padrao => {
    const troca = padrao.proximaTroca;
    if (!troca) return;
    if (!isDataAgendaValida(troca.data) || !DIAS.includes(troca.dia)) throw new Error('trocaDiaInvalida');
    const ultima = historicoOrdenado(padrao).at(-1);
    if (ultima && troca.data <= ultima.data) throw new Error('trocaDiaAnterior');
    // Uma troca no meio da semana nao pode criar duas reunioes nem eliminar a unica.
    const cursor = new Date(`${troca.data}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
    let ocorrencias = 0;
    for (let i = 0; i < 7; i++, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const data = cursor.toISOString().slice(0, 10);
        if (DIAS[cursor.getUTCDay()] === getDiaReuniaoVigente(padrao, data)) ocorrencias++;
    }
    if (ocorrencias !== 1) throw new Error('trocaDiaSemanaAmbigua');
};

export const promoverDiaReuniao = (padrao, hoje = hojeReunioesISO()) => {
    if (!padrao?.proximaTroca || padrao.proximaTroca.data > hoje) return padrao;
    validarProximaTroca(padrao);
    const troca = padrao.proximaTroca;
    return { ...padrao, dia: troca.dia, proximaTroca: null,
        historicoDias: [...(padrao.historicoDias || []), { ...troca, diaAnterior: padrao.dia }] };
};

export const getPadraoReuniao = (config = {}, tipo = 'meioSemana', grupoId = config.grupoSelecionadoId) => {
    if (grupoId && config.grupos?.[grupoId]?.[tipo]) return config.grupos[grupoId][tipo];
    return { ...config.planejamentoReunioes?.[tipo],
        dia: tipo === 'fimDeSemana' ? config.dia_reuniao_fds || config.diaReuniaoFds || 'saturday'
            : config.dia_reuniao || config.diaReuniao || config.diaSemana || 'monday' };
};

export const promoverTrocasConfiguracao = (config, hoje = hojeReunioesISO()) => {
    const next = { ...config };
    if (config.grupos) next.grupos = Object.fromEntries(Object.entries(config.grupos).map(([id, grupo]) => [id,
        { ...grupo, meioSemana: promoverDiaReuniao(grupo.meioSemana, hoje), fimDeSemana: promoverDiaReuniao(grupo.fimDeSemana, hoje) }]));
    if (config.planejamentoReunioes) {
        next.planejamentoReunioes = { ...config.planejamentoReunioes };
        for (const tipo of ['meioSemana', 'fimDeSemana']) {
            const padrao = promoverDiaReuniao(getPadraoReuniao(config, tipo, null), hoje);
            const { dia, ...plano } = padrao;
            next.planejamentoReunioes[tipo] = plano;
            next[tipo === 'meioSemana' ? 'dia_reuniao' : 'dia_reuniao_fds'] = dia;
        }
    }
    const legado = next.grupos?.[next.grupoLegadoId || 'grupo-portugues'];
    if (legado) {
        next.dia_reuniao = legado.meioSemana.dia;
        next.dia_reuniao_fds = legado.fimDeSemana.dia;
        next.planejamentoReunioes = Object.fromEntries(['meioSemana', 'fimDeSemana'].map(tipo => [tipo, {
            proximaTroca: legado[tipo].proximaTroca || null, historicoDias: legado[tipo].historicoDias || [],
        }]));
    }
    return next;
};
