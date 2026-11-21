import { getAssignmentCapabilityForSlot } from './assignmentEligibility.js';
import { getFimDeSemanaAssignedPeople, getMeioSemanaAssignedPeople } from './fimDeSemana.js';
import { getMeetingDateISOFromSemana, parseFlexibleDateToISO } from './revisarEnviar/dates.js';

const dataValida = value => {
    const iso = parseFlexibleDateToISO(value);
    if (!iso) return null;
    const date = new Date(`${iso}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
};

export function getDataDesignacao(semana, tipo = 'meioSemana', config = {}) {
    // As programacoes novas possuem datas por reuniao, mesmo antes do historico.
    for (const value of [semana?.[tipo]?.data, ...(tipo === 'meioSemana' ? [semana?.dataReuniao, semana?.dataExata] : [])]) {
        const iso = dataValida(value);
        if (iso) return iso;
    }
    const fallback = [semana?.dataInicio, semana?.dataReuniao, semana?.dataExata, semana?.data].map(dataValida).find(Boolean);
    const grupo = config.grupos?.[semana?.grupoId || config.grupoLegadoId];
    const dia = grupo?.[tipo]?.dia || (tipo === 'fimDeSemana' ? config.dia_reuniao_fds : config.dia_reuniao);
    return dataValida(getMeetingDateISOFromSemana({
        semanaStr: semana?.semana, isoFallback: fallback, config,
        overrideDia: semana?.evento === 'visita' && tipo === 'meioSemana' ? 'tuesday' : dia,
        textSources: [semana?.semana],
    }));
}

export function calcularRecenciaDesignacao({ alunoId, historico = [], contexto, config = {}, hoje = new Date() }) {
    let ultimaData = null;
    const mesmaPessoa = pessoa => pessoa?.id != null && String(pessoa.id) === String(alunoId);
    const registrar = (semana, tipo) => {
        const data = getDataDesignacao(semana, tipo, config);
        if (data && (!ultimaData || data > ultimaData)) ultimaData = data;
    };

    for (const semana of historico) {
        if (getMeioSemanaAssignedPeople(semana).some(item => mesmaPessoa(item.pessoa) && item.slotKey === contexto.capabilityKey)) {
            registrar(semana, 'meioSemana');
        }
        if (getFimDeSemanaAssignedPeople(semana).some(item => mesmaPessoa(item.pessoa)
            && item.slotKey === (contexto.slotKey === 'oracao_fds' ? 'oracao_fds' : contexto.capabilityKey))) {
            registrar(semana, 'fimDeSemana');
        }
        if (contexto.capabilityKey === 'presidente_rvm' && mesmaPessoa(semana.presidente)) registrar(semana, 'meioSemana');
        if ((semana.partes || []).some(parte => ['estudante', 'ajudante', 'oracao', 'dirigente', 'leitor'].some(slotKey =>
            mesmaPessoa(parte[slotKey]) && getAssignmentCapabilityForSlot({ parte, slotKey }) === contexto.capabilityKey))) {
            registrar(semana, 'meioSemana');
        }
    }

    // Datas ausentes ou invalidas nao entram no calculo nem impedem buscar outra semana.
    const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
    return { ultimaData, diasSemFazer: ultimaData
        ? Math.round((hojeUTC - Date.parse(`${ultimaData}T12:00:00Z`)) / 86400000)
        : 9999 };
}
