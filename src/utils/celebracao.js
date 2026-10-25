import { getGrupoEfetivoId, getGrupoProgramacao } from './gruposProgramacao.js';
import { getProgramacaoWeekStartISO } from './programacoes.js';
import { createResponsabilidadesDefault, normalizeResponsabilidades } from './fimDeSemana.js';

export const CELEBRACAO_TEXTOS = {
    pt: { titulo: 'Celebração da morte de Jesus Cristo', discurso: 'Discurso da celebração', orador: 'Orador (nome livre)',
        horario: 'Horário da celebração', salvar: 'Salvar', apoio: 'Apoio da celebração', designar: 'Designar', remover: 'Remover',
        escolher: 'Escolha um irmão habilitado', ajuda: 'Selecione o dia exato. De segunda a sexta, substitui o meio de semana; sábado ou domingo, substitui o fim de semana.',
        bloqueio: 'A celebração substitui a reunião de meio de semana nesta semana. A importação foi bloqueada.',
        salvo: 'Celebração salva.', avisos: 'Revise os avisos de carga antes de confirmar.', confirmar: 'Confirmar designação',
        agenda: 'Designações anteriores já enviadas à agenda precisam de revisão; não são apagadas automaticamente.' },
    es: { titulo: 'Conmemoración de la muerte de Jesucristo', discurso: 'Discurso de la Conmemoración', orador: 'Orador (nombre libre)',
        horario: 'Horario de la Conmemoración', salvar: 'Guardar', apoio: 'Apoyo de la Conmemoración', designar: 'Asignar', remover: 'Quitar',
        escolher: 'Elige un hermano habilitado', ajuda: 'Selecciona el día exacto. De lunes a viernes, sustituye la reunión de entre semana; sábado o domingo, la de fin de semana.',
        bloqueio: 'La Conmemoración sustituye la reunión de entre semana. Se ha bloqueado la importación.',
        salvo: 'Conmemoración guardada.', avisos: 'Revisa los avisos de carga antes de confirmar.', confirmar: 'Confirmar asignación',
        agenda: 'Las asignaciones ya enviadas al calendario requieren revisión; no se eliminan automáticamente.' },
};
export const textosCelebracao = lang => CELEBRACAO_TEXTOS[lang] || CELEBRACAO_TEXTOS.pt;
export const tipoReuniaoCelebracao = data => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return null;
    const date = new Date(`${data}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data) return null;
    return [0, 6].includes(date.getUTCDay()) ? 'fimDeSemana' : 'meioSemana';
};
export const eventoSubstituiReuniao = (evento, tipo) => /assembleia|congresso/i.test(evento?.tipo || '')
    || (evento?.tipo === 'celebracao' && tipoReuniaoCelebracao(evento.dataInput) === tipo);

export function getEventoDaProgramacao(programacao, config = {}) {
    let semana;
    try { semana = getProgramacaoWeekStartISO(programacao); } catch { return null; }
    const grupo = getGrupoProgramacao(getGrupoEfetivoId(programacao, config), config);
    const atual = grupo?.eventosAnuais?.find(evento => evento.dataInicio === semana);
    // Em v2, a configuração é a fonte atual: remover o evento não reativa flags antigas.
    if (atual || config.grupos) return atual || null;
    return programacao.evento && programacao.evento !== 'normal'
        ? { tipo: programacao.evento, dataInput: programacao.dataEventoEspecial, dataInicio: semana } : null;
}
export function getCelebracao(programacao, config = {}) {
    const evento = getEventoDaProgramacao(programacao, config);
    const tipo = evento?.tipo === 'celebracao' ? tipoReuniaoCelebracao(evento.dataInput) : null;
    if (!tipo) return null;
    const src = programacao?.celebracao || {};
    return { ...src, ativo: src.ativo !== false, data: evento.dataInput, tipoReuniao: tipo,
        horario: String(src.horario || ''), oradorNomeManual: String(src.oradorNomeManual || ''),
        responsabilidades: normalizeResponsabilidades(src.responsabilidades) };
}
export const createCelebracaoDefault = () => ({ ativo: true, horario: '', oradorNomeManual: '', responsabilidades: createResponsabilidadesDefault() });

// IDs de slot independentes dos da reunião normal, mesmo se data/pessoa coincidirem.
export const slotsCelebracao = (programacao, incluirVagos = true, data = programacao?.dataEventoEspecial || '') => Object.entries(createResponsabilidadesDefault()).flatMap(([key]) => {
    const pessoas = programacao?.celebracao?.responsabilidades?.[key] || [];
    const capability = { videoZoomSom: 'audio_video', indicadoresEntrada: 'indicador_entrada', indicadoresAuditorio: 'indicador_auditorio', microfonesVolantes: 'microfones_volantes' }[key];
    return Array.from({ length: pessoas.length + (incluirVagos ? 1 : 0) }, (_, index) => {
        const path = ['celebracao', 'responsabilidades', key, index];
        return { slotId: JSON.stringify(['celebracao', data, key, index]), path, slotKey: capability, parte: null, pessoa: pessoas[index], apoio: true, celebracao: true };
    }).filter(slot => incluirVagos || slot.pessoa?.id != null);
});

export function progressoCelebracao(programacao, config) {
    const c = getCelebracao(programacao, config);
    if (!c) return null;
    const preenchidas = Number(!!c.oradorNomeManual.trim()) + Number(!!c.horario)
        + Object.values(c.responsabilidades).filter(pessoas => pessoas.some(p => p?.id || p?.nome)).length;
    return { total: 6, preenchidas, percentual: Math.round(preenchidas / 6 * 100) };
}
