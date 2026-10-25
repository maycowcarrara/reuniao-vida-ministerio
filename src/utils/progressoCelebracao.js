import { getCelebracao, progressoCelebracao } from './celebracao.js';
import { normalizeOcorrenciaReuniao } from './ocorrenciasReuniao.js';
import { listarSlotsReuniao } from './designacoesPorGrupo.js';
import { MEIO_SEMANA_RESPONSABILIDADES } from './fimDeSemana.js';

// Um irmão por função de apoio; não conta campos da reunião substituída.
export function progressoSemanaCelebracao(programa, config) {
    const c = getCelebracao(programa, config);
    if (!c) return null;
    const total = progressoCelebracao(programa, config);
    const tipo = c.tipoReuniao === 'meioSemana' ? 'fimDeSemana' : 'meioSemana';
    if (normalizeOcorrenciaReuniao(programa, tipo, config).operacional) {
        const add = value => { total.total++; if (typeof value === 'string' ? value.trim() : value?.id || value?.nome) total.preenchidas++; };
        if (tipo === 'meioSemana') {
            listarSlotsReuniao(programa, tipo, { config }).filter(s => !s.apoio && s.slotKey !== 'ajudante').forEach(s => add(s.pessoa));
        } else {
            const fds = programa.fimDeSemana || {};
            [fds.presidente, fds.estudoSentinela?.leitor, fds.reuniaoPublica?.temaDiscurso || '', fds.reuniaoPublica?.oradorNomeManual || '', fds.reuniaoPublica?.congregacaoOrador || ''].forEach(add);
        }
        const apoios = tipo === 'meioSemana' ? programa.responsabilidades : programa.fimDeSemana?.responsabilidades;
        MEIO_SEMANA_RESPONSABILIDADES.forEach(({ storageKey }) => add(apoios?.[storageKey]?.find(p => p?.id || p?.nome)));
    }
    total.percentual = Math.round(total.preenchidas / total.total * 100);
    return total;
}
