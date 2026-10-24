import { criarFilaGrupo, resolverConfirmacaoGrupo, sincronizarAgendaSimulada } from '../utils/integracoesGrupo.js';

export function createIntegracoesLocais({ getEstado, ownerUid = 'ensaio-local-e2', initialConfirmacoes = [], now = () => new Date().toISOString() }) {
    const records = new Map(initialConfirmacoes.map(c => [c.assignmentKey, structuredClone(c)]));
    const notifications = [];
    const events = new Map();
    const listeners = new Set();
    let sequence = 0;
    const emit = () => listeners.forEach(fn => fn());
    const estado = () => { const d = getEstado(); return { programacoes: d.historico_reunioes, config: d.configuracoes }; };
    const get = token => {
        const c = [...records.values()].find(item => item.token === token);
        return c ? { ...structuredClone(c), ...resolverConfirmacaoGrupo({ confirmacao: c, ...estado() }) } : null;
    };
    const ensure = data => {
        const rows = criarFilaGrupo({ ...estado(), grupoId: data.grupoId, confirmacoes: [...records.values()] });
        const row = rows.find(item => item.assignmentKey === data.assignmentKey);
        if (!row) throw new Error('Destino de confirmação indisponível.');
        const existing = records.get(row.assignmentKey);
        if (existing) return get(existing.token);
        let token;
        do { token = `fixture-token-${++sequence}`; } while ([...records.values()].some(item => item.token === token));
        const confirmation = { ...row.confirmation, ownerUid, token };
        records.set(row.assignmentKey, confirmation); emit();
        return get(confirmation.token);
    };
    const update = (token, mode, value) => {
        const current = get(token);
        if (!current || current.isUnavailable) throw new Error('Designação indisponível.');
        if (!(mode === 'week' ? ['confirmado', 'imprevisto'] : ['confirmado', 'nao_pode']).includes(value)) throw new Error('Resposta inválida.');
        const c = records.get(current.assignmentKey);
        const field = mode === 'week' ? 'weekReminderStatus' : 'status';
        const history = mode === 'week' ? 'weekReminderHistory' : 'responseHistory';
        const previous = c[field];
        const changedAtIso = now();
        if (value !== previous) {
            c[field] = value;
            c[history] = [...(c[history] || []), { previousStatus: previous, status: value, respondedAt: changedAtIso }];
            const metadata = { grupoId: current.grupoId || rowGrupoLegado(), programacaoId: current.programacaoId || '', tipoReuniao: current.tipoReuniao || '' };
            notifications.push({ id: `alerta-local-${++sequence}`, ownerUid, token, assignmentKey: c.assignmentKey, ...metadata,
                title: current.lang === 'es' ? 'Respuesta de asignación' : 'Resposta de designação', description: `${current.pessoaNome}: ${value}`,
                status: value, previousStatus: previous, createdAtIso: changedAtIso, readAtIso: null });
        }
        emit(); return get(token);
    };
    const rowGrupoLegado = () => estado().config.grupoLegadoId || 'grupo-portugues';
    const channel = (key, name) => {
        const c = records.get(key); if (!c || get(c.token)?.isUnavailable) throw new Error('Designação indisponível.');
        if (!['wa', 'mail', 'waReminder'].includes(name)) throw new Error('Canal inválido.');
        c.sentChannels = { ...c.sentChannels, [name]: now() };
        if (name === 'waReminder') { c.weekReminderStatus = c.weekReminderStatus === 'nao_enviado' ? 'pendente' : c.weekReminderStatus; c.lastReminderSentAtIso = now(); }
        emit();
    };
    const adapter = {
        get: async (calendarId, id) => structuredClone(events.get(`${calendarId}/${id}`)),
        put: async (calendarId, id, event) => { events.set(`${calendarId}/${id}`, structuredClone(event)); emit(); return { local: true }; },
        delete: async (calendarId, id) => { events.delete(`${calendarId}/${id}`); emit(); },
    };
    return { get, ensure, update, channel, adapter,
        send: async ({ data, channel: name, transport }) => {
            const c = ensure(data);
            const result = await transport(structuredClone(c));
            if (result?.sucesso !== true) throw new Error(result?.erro || 'Falha simulada de envio.');
            channel(c.assignmentKey, name);
            return get(c.token);
        },
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        snapshot: () => ({ confirmacoes: structuredClone([...records.values()]), notificacoes: structuredClone(notifications), eventos: structuredClone([...events.values()]) }),
        syncCalendar: pedido => sincronizarAgendaSimulada({ ...pedido, adapter }),
        markRead: id => { const n = notifications.find(item => item.id === id); if (n) n.readAtIso = now(); emit(); },
        markAllRead: () => { notifications.forEach(n => { n.readAtIso ||= now(); }); emit(); },
        deleteNotification: id => { const index = notifications.findIndex(n => n.id === id); if (index !== -1) notifications.splice(index, 1); emit(); },
        deleteRead: () => { for (let i = notifications.length - 1; i >= 0; i--) if (notifications[i].readAtIso) notifications.splice(i, 1); emit(); },
    };
}

let contexto = { configuracoes: {}, historico_reunioes: [] };
export const atualizarContextoIntegracoesLocal = dados => { contexto = dados; };
export const integracoesLocais = /* @__PURE__ */ createIntegracoesLocais({ getEstado: () => contexto });
