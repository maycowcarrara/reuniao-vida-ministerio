const dateOnly = now => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Uma resposta repetida não cria histórico ou alerta duplicado. O chamador
// fornece o estado atual lido dentro da mesma transação que grava os espelhos.
export function prepararRespostaConfirmacao(current, { mode, status, source = 'public_link', actorType = 'public', nowISO = new Date().toISOString(), todayISO = dateOnly(nowISO), requestId = crypto.randomUUID(), timestamp }) {
    if (!['primary', 'week'].includes(mode)) throw new Error('Tipo de resposta inválido.');
    const week = mode === 'week';
    if (!(week ? ['confirmado', 'imprevisto'] : ['confirmado', 'nao_pode']).includes(status)) throw new Error('Status de resposta inválido.');
    const previousStatus = current[week ? 'weekReminderStatus' : 'status'] || (week ? 'nao_enviado' : 'pendente');
    if (previousStatus === status) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(current.dataISO || '') && current.dataISO < todayISO && (week ? ['confirmado', 'imprevisto'] : ['confirmado', 'nao_pode']).includes(previousStatus)) {
        const error = new Error('Não é possível alterar a resposta de uma designação após a data da reunião.'); error.code = 'past_event_change_locked'; throw error;
    }
    const entry = { previousStatus, status, responseCode: week ? status === 'confirmado' ? 'c' : 'i' : status === 'confirmado' ? 'a' : 'n', source, actorType, respondedAt: nowISO };
    const key = `${nowISO}|${status}|${requestId}`;
    if (week) return { weekReminderStatus: status, weekReminderPreviousStatus: previousStatus,
        weekReminderHistory: [...(current.weekReminderHistory || []), entry], lastWeekReminderSource: source, lastWeekReminderActorType: actorType,
        weekReminderRespondedAt: timestamp(), weekReminderRespondedAtIso: nowISO,
        lastWeekReminderChangeAtIso: nowISO, lastWeekReminderChangeFrom: previousStatus, lastWeekReminderChangeTo: status, lastWeekReminderChangeKey: key,
        weekReminderAlertPending: true, weekReminderAlertSeenAt: null, updatedAt: timestamp() };
    return { status, previousStatus, responseHistory: [...(current.responseHistory || []), entry], lastResponseSource: source, lastResponseActorType: actorType,
        updatedAt: timestamp(), lastResponseAt: timestamp(), lastResponseAtIso: nowISO,
        confirmedAt: status === 'confirmado' ? timestamp() : null, declinedAt: status === 'nao_pode' ? timestamp() : null,
        lastStatusChangeAtIso: nowISO, lastStatusChangeFrom: previousStatus, lastStatusChangeTo: status, lastStatusChangeKey: key,
        alertPending: true, alertSeenAt: null };
}
