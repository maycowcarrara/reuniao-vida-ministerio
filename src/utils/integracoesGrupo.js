import { assignmentIdentity, buildAssignmentKey, buildLegacyAssignmentKey, calendarEventId, identityFromDesignacao, sameAssignment } from './assignmentIdentity.js';
import { selecionarDesignacoes } from './designacoesPorGrupo.js';
import { getGrupoEfetivoId, getGrupoLegadoId, getGrupoProgramacao, isProgramacaoV2 } from './gruposProgramacao.js';
import { ASSIGNMENT_CAPABILITIES, getAssignmentCapabilityForSlot } from './assignmentEligibility.js';
import { getMeetingDateISOFromSemana } from './revisarEnviar/dates.js';
import { isBibleStudyPart, isPrayerPart } from './meetingParts.js';
import { textosCelebracao } from './celebracao.js';

const legacySlot = item => {
    const path = item.path;
    if (item.celebracao) return `celebracao_${path.at(-2)}_${path.at(-1)}`;
    if (item.apoio) return `${item.tipoReuniao === 'fimDeSemana' ? 'fds' : 'meio'}_${path.at(-2)}_${path.at(-1)}`;
    if (item.tipoReuniao === 'fimDeSemana') return ({ presidente_fds: 'fds_presidente', oracao_fds: 'fds_oracao_final', dirigente_sentinela: 'fds_dirigente_sentinela', leitor_sentinela: 'fds_leitor_sentinela' })[item.slotKey];
    return item.parte ? item.parte.id : 'presidente';
};
const legacyRole = item => item.slotKey === 'estudante' && isPrayerPart(item.parte) ? 'oracao'
    : item.slotKey === 'estudante' && isBibleStudyPart(item.parte) ? 'dirigente'
        : ({ estudante: 'resp', ajudante: 'ajud' })[item.slotKey] || item.slotKey;
const legacyDate = (item, config) => {
    const p = item.programacao;
    const explicit = item.tipoReuniao === 'fimDeSemana' ? p.fimDeSemana?.data : p.meioSemana?.data || p.dataReuniao || p.dataExata;
    if (explicit) return explicit;
    const group = getGrupoProgramacao(item.grupoId, config);
    return getMeetingDateISOFromSemana({ semanaStr: p.semana, isoFallback: p.dataInicio || p.data,
        config: { ...config, dia_reuniao: group.meioSemana.dia },
        overrideDia: item.tipoReuniao === 'fimDeSemana' ? group.fimDeSemana.dia : item.reuniao.eventoEspecial?.tipo === 'visita' ? 'tuesday' : null }) || item.reuniao.data;
};
export const legacyKeyFromDesignacao = (item, config = {}) => buildLegacyAssignmentKey({ dataISO: legacyDate(item, config),
    semana: item.programacao.semana, parteId: legacySlot(item), pessoaId: item.pessoa.id, role: legacyRole(item) });

export function criarFilaGrupo({ programacoes, config, grupoId, confirmacoes = [] }) {
    const grupo = getGrupoProgramacao(grupoId, config);
    if (!grupo?.ativo) return [];
    return selecionarDesignacoes({ programacoes: programacoes.filter(p => getGrupoEfetivoId(p, config) === grupoId), config }).map(item => {
        const capability = getAssignmentCapabilityForSlot({ parte: item.parte, slotKey: item.slotKey });
        const tituloBase = item.parte?.titulo || ASSIGNMENT_CAPABILITIES.find(c => c.key === capability)?.labels[grupo.idioma] || (grupo.idioma === 'es' ? 'Asignación' : 'Designação');
        const titulo = item.celebracao ? `${textosCelebracao(grupo.idioma).titulo} — ${tituloBase}` : tituloBase;
        const identity = identityFromDesignacao(item);
        const key = buildAssignmentKey(identity);
        const legacyKey = grupoId === getGrupoLegadoId(config) ? legacyKeyFromDesignacao(item, config) : null;
        const matches = confirmacoes.filter(c => c.identityVersion === 2 ? sameAssignment(c, identity)
            : !!legacyKey && c.assignmentKey === legacyKey && (!c.grupoId || c.grupoId === getGrupoLegadoId(config)));
        if (matches.length > 1) throw new Error('Conflito de identidade: múltiplas confirmações para o destino.');
        const existente = matches[0];
        // Reutilizar vínculo exato, token, status, lembretes e checks do v1.
        const confirmation = existente ? { ...existente } : { ...identity, assignmentKey: key, lang: grupo.idioma,
            semana: item.programacao.semana || '', dataISO: item.reuniao.data, pessoaNome: item.pessoa.nome,
            role: identity.papel, congregacaoNome: grupo.nome, tituloParte: titulo,
            status: 'pendente', weekReminderStatus: 'nao_enviado', responseHistory: [], weekReminderHistory: [], sentChannels: {} };
        return { ...identity, assignmentKey: confirmation.assignmentKey, confirmation, item, titulo,
            lang: grupo.idioma, grupoNome: grupo.nome,
            preview: grupo.idioma === 'es'
                ? `${grupo.nome}: ${item.pessoa.nome}, tu asignación: ${titulo}. ${item.reuniao.data} ${item.reuniao.horario}`
                : `${grupo.nome}: ${item.pessoa.nome}, sua designação: ${titulo}. ${item.reuniao.data} ${item.reuniao.horario}` };
    });
}

export function resolverConfirmacaoGrupo({ confirmacao, programacoes, config, collectLegacyKeys = null }) {
    const unavailable = reason => ({ isUnavailable: true, unavailableReason: reason });
    if (!confirmacao?.ownerUid || !confirmacao.assignmentKey) return unavailable('missing_reference');
    if (confirmacao.identityVersion !== undefined && ![1, 2].includes(confirmacao.identityVersion)) return unavailable('identity_version');
    const legado = getGrupoLegadoId(config);
    if (confirmacao.identityVersion === 2) {
        let identity;
        try { identity = assignmentIdentity(confirmacao); } catch { return unavailable('identity_invalid'); }
        if (buildAssignmentKey(identity) !== confirmacao.assignmentKey) return unavailable('identity_conflict');
        const programs = programacoes.filter(p => String(p.id) === identity.programacaoId && getGrupoEfetivoId(p, config) === identity.grupoId);
        if (programs.length !== 1) return unavailable('week_removed');
        const matches = selecionarDesignacoes({ programacoes: programs, config }).filter(item => sameAssignment(identityFromDesignacao(item), identity));
        return matches.length === 1 ? { isUnavailable: false, unavailableReason: '' } : unavailable('assignment_changed');
    }
    if (confirmacao.grupoId && confirmacao.grupoId !== legado) return unavailable('legacy_group');
    const weeks = programacoes.filter(p => getGrupoEfetivoId(p, config) === legado && String(p.semana || '').trim() === String(confirmacao.semana || '').trim());
    // O coletor legado preserva inclusive fallbacks antigos de pessoa/parte.
    const found = collectLegacyKeys ? weeks.some(p => collectLegacyKeys(p, config).has(confirmacao.assignmentKey))
        : selecionarDesignacoes({ programacoes: weeks, config }).some(item => legacyKeyFromDesignacao(item, config) === confirmacao.assignmentKey);
    return found ? { isUnavailable: false, unavailableReason: '' } : unavailable('assignment_changed');
}

export const getCalendarPreferenceKey = (ownerUid, grupoId) => `rvm_calendar:v2:${ownerUid}:${grupoId}`;
export const lerAgendaGrupo = (storage, ownerUid, grupoId, config) => {
    if (!ownerUid || !grupoId) return '';
    try { return storage?.getItem(getCalendarPreferenceKey(ownerUid, grupoId)) || (grupoId === getGrupoLegadoId(config) ? storage?.getItem('rvm_saved_calendar_id') : '') || ''; }
    catch { return ''; }
};
export const salvarAgendaGrupo = (storage, ownerUid, grupoId, calendarId) => {
    if (!ownerUid || !grupoId || !calendarId) return;
    try { storage?.setItem(getCalendarPreferenceKey(ownerUid, grupoId), calendarId); } catch { /* Opcional. */ }
};

const agendaTimes = item => {
    const { data, horario } = item.reuniao;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) throw new Error('Defina data e horário antes de sincronizar.');
    let inicio = new Date(`${data}T${horario}:00`);
    const tempoParte = p => Math.max(1, parseInt(p.tempo, 10) || 5) + (/leitura|lectura/i.test(p.titulo || '') || p.secao === 'ministerio' ? 1 : 0);
    const partes = item.programacao.partes || [];
    let duracao = item.celebracao ? 60 : Number(item.reuniao.duracaoMinutos) || (item.tipoReuniao === 'fimDeSemana' ? 105 : partes.reduce((total, p) => total + tempoParte(p), 0) || 5);
    if (item.tipoReuniao === 'meioSemana' && item.parte) {
        const index = partes.findIndex(p => String(p.id) === String(item.parte.id));
        inicio = new Date(inicio.getTime() + partes.slice(0, index).reduce((total, p) => total + tempoParte(p), 0) * 60000);
        duracao = tempoParte(item.parte);
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return { start: { dateTime: inicio.toISOString(), timeZone }, end: { dateTime: new Date(inicio.getTime() + duracao * 60000).toISOString(), timeZone } };
};

export async function planejarAgendaGrupo({ programacoes, config, grupoId, vinculos = [], alunos = [] }) {
    const slots = new Map();
    for (const row of criarFilaGrupo({ programacoes, config, grupoId })) {
        const slotKey = JSON.stringify([grupoId, row.programacaoId, row.tipoReuniao, row.slotId]);
        if (slots.has(slotKey)) throw new Error('Conflito de slots na agenda.');
        const antigos = vinculos.filter(v => v.grupoId === grupoId && v.programacaoId === row.programacaoId && v.tipoReuniao === row.tipoReuniao && v.slotId === row.slotId);
        if (antigos.length > 1) throw new Error('Conflito de vínculos da agenda.');
        // Vínculos inventariados legados são explícitos, nunca deduzidos por título/data.
        if (antigos[0]?.identityVersion !== 2 && antigos.length && grupoId !== getGrupoLegadoId(config)) throw new Error('Vínculo legado fora do grupo legado.');
        const marcador = row.item.programacao.identidadeLegada;
        if (!row.item.celebracao && !antigos.length && isProgramacaoV2(row.item.programacao) && !marcador && row.item.programacao.agendaSincronizadaEm && grupoId === getGrupoLegadoId(config)) {
            throw new Error('Programação já sincronizada exige inventário dos vínculos antigos.');
        }
        let legacyId = '';
        const origemLegada = !isProgramacaoV2(row.item.programacao) || marcador?.versao === 1;
        const parteLegada = !marcador || !row.item.parte || !!marcador.partes?.[String(row.item.parte.id)];
        const tipoLegado = !marcador || row.tipoReuniao !== 'fimDeSemana' || !!marcador.dataFimDeSemana;
        if (!row.item.celebracao && origemLegada && parteLegada && tipoLegado && grupoId === getGrupoLegadoId(config)) {
            const fds = row.tipoReuniao === 'fimDeSemana';
            const suffix = { presidente_fds: 'presidentefds', oracao_fds: 'oracaofds', dirigente_sentinela: 'dirigentesentinela', leitor_sentinela: 'leitorsentinela' };
            const apoio = { videoZoomSom: 'av', indicadoresEntrada: 'entrada', indicadoresAuditorio: 'auditorio', microfonesVolantes: 'microfones' };
            const tail = row.item.apoio ? `apoio${fds ? 'fds' : 'meio'}${apoio[row.item.path.at(-2)]}${row.item.path.at(-1)}`
                : fds ? suffix[row.item.slotKey] : row.item.parte ? marcador?.partes?.[String(row.item.parte.id)] || `parte${row.item.programacao.partes.findIndex(p => String(p.id) === String(row.item.parte.id))}` : 'presidente';
            const dataId = (fds ? marcador?.dataFimDeSemana : marcador?.dataMeioSemana) || row.item.reuniao.data;
            legacyId = `rvm${fds ? 'fds' : ''}${dataId.replaceAll('-', '')}${tail}`;
        }
        const id = antigos[0]?.eventId || legacyId || await calendarEventId(row);
        if (!/^[a-v0-9]{5,1024}$/.test(id)) throw new Error('ID de evento inválido.');
        const scope = legacyId && row.item.parte ? JSON.stringify([1, grupoId, row.programacaoId, row.tipoReuniao, 'parte', String(row.item.parte.id)])
            : JSON.stringify([2, grupoId, row.programacaoId, row.tipoReuniao, row.slotId]);
        const pessoa = alunos.find(a => String(a.id) === String(row.pessoaId)) || row.item.pessoa;
        slots.set(slotKey, { id, identity: assignmentIdentity(row), summary: `[${row.grupoNome}] ${row.titulo} — ${row.item.pessoa.nome}`,
            description: row.preview, reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 2880 }, { method: 'popup', minutes: 120 }] },
            ...agendaTimes(row.item),
            ...(pessoa.email?.trim() ? { attendees: [{ email: pessoa.email.trim() }] } : {}),
            ...(legacyId ? { legacyReference: { eventId: legacyId, grupoId, programacaoId: row.programacaoId,
                dataOriginal: (row.tipoReuniao === 'fimDeSemana' ? marcador?.dataFimDeSemana : marcador?.dataMeioSemana) || row.item.reuniao.data } } : {}),
            data: row.item.reuniao.data, horario: row.item.reuniao.horario, lang: row.lang,
            extendedProperties: { private: { rvmIdentity: scope } } });
    }
    // Legado tinha um evento por parte, incluindo os diferentes papéis. Não
    // criar outro evento para estudante/ajudante/leitor ao introduzir identidade.
    const porId = new Map();
    for (const evento of slots.values()) {
        const anterior = porId.get(evento.id);
        if (anterior) evento.attendees = [...new Map([...(anterior.attendees || []), ...(evento.attendees || [])].map(a => [a.email,a])).values()];
        porId.set(evento.id, evento);
    }
    return [...porId.values()];
}

// Adaptador local recebe somente alvos exatos. Falha parcial conserva eventos
// anteriores e retorna resultados individuais; nunca consulta/exclui por datas.
export async function sincronizarAgendaSimulada({ eventos, adapter, calendarId }) {
    const resultados = [];
    for (const evento of eventos) {
        try {
            const atual = await adapter.get(calendarId, evento.id);
            const scope = evento.extendedProperties.private.rvmIdentity;
            if (atual && atual.extendedProperties?.private?.rvmIdentity !== scope) throw new Error('Conflito de identidade no evento existente.');
            const result = await adapter.put(calendarId, evento.id, evento);
            resultados.push({ id: evento.id, ok: true, result });
        } catch (error) { resultados.push({ id: evento.id, ok: false, erro: error.message }); }
    }
    return { sucesso: resultados.every(item => item.ok), resultados };
}
export async function removerEventoSimulado({ evento, adapter, calendarId }) {
    const atual = await adapter.get(calendarId, evento.id);
    if (!atual) return;
    if (atual.extendedProperties?.private?.rvmIdentity !== evento.extendedProperties.private.rvmIdentity) throw new Error('Destino da remoção não confere.');
    await adapter.delete(calendarId, evento.id);
}

export const destinoNotificacao = (alerta, config) => ({ grupoId: alerta.grupoId || alerta.meta?.grupoId || getGrupoLegadoId(config),
    programacaoId: alerta.programacaoId || alerta.meta?.programacaoId || '', tipoReuniao: alerta.tipoReuniao || alerta.meta?.tipoReuniao || '' });
