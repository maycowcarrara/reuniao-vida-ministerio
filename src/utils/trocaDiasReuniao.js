import { getDataSemanalVigente, getPadraoReuniao, hojeReunioesISO } from '../config/meetingSchedule.js';
import { getGrupoEfetivoId, isProgramacaoV2 } from './gruposProgramacao.js';
import { getCanonicalWeekStartISO } from './revisarEnviar/dates.js';
import { getEventoDaProgramacao } from './celebracao.js';

// Somente datas geradas pelo padrao anterior acompanham a troca. Excecoes manuais,
// eventos, cancelamentos, arquivos e reunioes passadas conservam a data gravada.
export function atualizarProgramacoesPorTroca({ programacoes = [], configAntes, configDepois, hoje = hojeReunioesISO() }) {
    return programacoes.map(programa => {
        if (programa.arquivada || programa.cancelada) return programa;
        const grupoId = getGrupoEfetivoId(programa, configAntes);
        const semana = getCanonicalWeekStartISO({ sem: programa, config: configAntes });
        if (!semana) return programa;
        const evento = getEventoDaProgramacao(programa, configAntes);
        let next = programa;
        for (const tipo of ['meioSemana', 'fimDeSemana']) {
            if (programa[tipo]?.cancelada || (tipo === 'fimDeSemana' && !programa.fimDeSemana?.ativo && !programa.fimDeSemana?.data)) continue;
            if (evento && evento.tipo !== 'normal' && (tipo === 'meioSemana' || /congresso|assembleia|celebracao/.test(evento.tipo))) continue;
            const anterior = getDataSemanalVigente(semana, getPadraoReuniao(configAntes, tipo, grupoId));
            const nova = getDataSemanalVigente(semana, getPadraoReuniao(configDepois, tipo, grupoId));
            const gravada = programa[tipo]?.data || (tipo === 'meioSemana' ? programa.dataReuniao || programa.dataExata : '');
            if (!anterior || !nova || anterior === nova || anterior < hoje || nova < hoje || (gravada && gravada !== anterior)) continue;
            next = { ...next, [tipo]: { ...next[tipo], data: nova } };
            if (tipo === 'meioSemana') {
                for (const campo of ['dataReuniao', 'dataExata']) if (!programa[campo] || programa[campo] === anterior) next[campo] = nova;
            }
        }
        const publicada = isProgramacaoV2(programa) ? programa.publicadaNoQuadro === true : programa.publicadaNoQuadro !== false;
        if (next === programa || !publicada) return next;
        return { ...next, agendaPendenteSync: true, needsCalendarSync: true, historicoPendenteSync: true,
            agendaPendenteMotivo: 'mudanca_datas_reunioes', historicoPendenteMotivo: 'mudanca_datas_reunioes',
            agendaPendenteDesde: new Date().toISOString(), historicoPendenteDesde: new Date().toISOString() };
    });
}
