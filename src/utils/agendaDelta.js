import { dadosIguais } from './compararDados.js';

// Limita a concorrência sem inserir pausas artificiais entre requisições.
export async function mapLimit(items, executar, limite = 3) {
    const resultados = new Array(items.length);
    let indice = 0;
    await Promise.all(Array.from({ length: Math.min(limite, items.length) }, async () => {
        while (indice < items.length) {
            const atual = indice++;
            resultados[atual] = await executar(items[atual], atual);
        }
    }));
    return resultados;
}

export const bodyEvento = evento => ({ ...Object.fromEntries(
    ['id', 'summary', 'description', 'start', 'end', 'extendedProperties', 'reminders', 'colorId']
        .filter(key => evento[key] !== undefined).map(key => [key, evento[key]])),
    // A remoção do último e-mail também é uma alteração explícita.
    attendees: evento.attendees || [],
});

const ordenarObjeto = value => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

export async function assinaturaEvento(evento) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(ordenarObjeto(bodyEvento(evento))));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

const tempo = value => value?.dateTime
    ? { dateTime: new Date(value.dateTime).toISOString(), timeZone: value.timeZone || '' }
    : { date: value?.date || '' };
const convidados = values => (values || []).map(v => v.email?.trim().toLowerCase() || '').sort();
const lembretes = value => ({ useDefault: value?.useDefault ?? true,
    overrides: (value?.overrides || []).map(v => `${v.method}:${v.minutes}`).sort() });

// Ignora ETag, respostas dos convidados e metadados acrescentados pelo Google.
export function eventoAtualizado(evento, atual) {
    if (!atual || atual.status === 'cancelled') return false;
    const esperado = bodyEvento(evento);
    for (const key of ['summary', 'description', 'colorId']) {
        if (esperado[key] !== undefined && esperado[key] !== atual[key]) return false;
    }
    if (!dadosIguais(tempo(esperado.start), tempo(atual.start)) || !dadosIguais(tempo(esperado.end), tempo(atual.end))) return false;
    if (!dadosIguais(convidados(esperado.attendees), convidados(atual.attendees))) return false;
    if (!dadosIguais(lembretes(esperado.reminders), lembretes(atual.reminders))) return false;
    return Object.entries(esperado.extendedProperties?.private || {}).every(([key, value]) => atual.extendedProperties?.private?.[key] === value);
}

export const estadoAgenda = (programacao, calendarId) => programacao?.agendaSyncEstado?.versao === 1
    && programacao.agendaSyncEstado.calendarId === calendarId ? programacao.agendaSyncEstado : null;
export const assinaturaConfirmada = (programacao, calendarId, eventId) =>
    estadoAgenda(programacao, calendarId)?.eventos?.find(e => e.id === eventId)?.assinatura;

// Não renova timestamps ou documentos quando nada mudou desde o último envio.
export function aplicarResultadoAgenda(programacao, resultado, agoraIso) {
    const estado = resultado.estadosPorProgramacao?.[String(programacao.id)];
    if (!estado) return programacao;
    const concluida = resultado.programacaoIdsSincronizadas.includes(String(programacao.id));
    const mudouEstado = !dadosIguais(estado, programacao.agendaSyncEstado);
    const pendente = programacao.agendaPendenteSync || programacao.needsCalendarSync;
    const escritaRemota = resultado.resultados.some(r => r.programacaoId === String(programacao.id) && r.ok && r.alterado);
    if (!mudouEstado && !pendente && !escritaRemota && programacao.agendaSincronizadaEm) return programacao;
    if (!concluida) return mudouEstado ? { ...programacao, agendaSyncEstado: estado } : programacao;
    return { ...programacao, agendaSyncEstado: estado, agendaSincronizadaEm: agoraIso,
        agendaPendenteSync: false, needsCalendarSync: false, agendaPendenteMotivo: '', agendaPendenteDesde: null };
}
