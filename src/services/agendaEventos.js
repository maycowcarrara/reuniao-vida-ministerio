import { assinaturaConfirmada, assinaturaEvento, bodyEvento, eventoAtualizado, mapLimit } from '../utils/agendaDelta.js';

export function criarClienteAgenda({ token, calendarId, fetchImpl = fetch }) {
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const request = async (url, options = {}) => {
        const response = await fetchImpl(url, { ...options, headers: {
            Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers,
        } });
        const data = await response.json().catch(() => null);
        if (!response.ok && ![404, 409].includes(response.status)) throw new Error(`Google Agenda (${response.status}): ${data?.error?.message || 'operação recusada'}`);
        return { status: response.status, data };
    };
    return { base, request };
}

export async function sincronizarEventosAgenda({ eventos, programacoes, calendarId, cliente, validar = () => {}, consultados = new Map(), conferirTudo = false }) {
    const porId = new Map(programacoes.map(p => [String(p.id), p]));
    const { base, request } = cliente;
    const resultados = await mapLimit(eventos, async evento => {
        const programacaoId = String(evento.identity?.programacaoId || evento.programacaoId);
        try {
            const assinatura = await assinaturaEvento(evento);
            const confirmado = assinaturaConfirmada(porId.get(programacaoId), calendarId, evento.id);
            if (!conferirTudo && confirmado === assinatura) return { id: evento.id, programacaoId, ok: true, alterado: false, assinatura };
            let atual = consultados.get(evento.id) || await request(`${base}/${evento.id}`);
            validar(evento, atual.status === 404 ? null : atual.data);
            let resposta;
            if (atual.status === 404) {
                resposta = await request(`${base}?sendUpdates=none`, { method: 'POST', body: JSON.stringify(bodyEvento(evento)) });
                if (resposta.status === 409) atual = await request(`${base}/${evento.id}`);
            }
            if (atual.status !== 404) {
                validar(evento, atual.data);
                if (eventoAtualizado(evento, atual.data)) return { id: evento.id, programacaoId, ok: true, alterado: false, assinatura };
                if (!atual.data?.etag) throw new Error('Evento sem ETag; atualização recusada.');
                const body = bodyEvento(evento);
                if (body.extendedProperties) body.extendedProperties = { ...atual.data.extendedProperties,
                    private: { ...atual.data.extendedProperties?.private, ...body.extendedProperties.private } };
                resposta = await request(`${base}/${evento.id}?sendUpdates=none`, { method: 'PATCH',
                    headers: { 'If-Match': atual.data.etag }, body: JSON.stringify(body) });
            }
            if (!resposta || resposta.status >= 400) throw new Error('Não foi possível sincronizar este evento.');
            return { id: evento.id, programacaoId, ok: true, alterado: true, assinatura };
        } catch (error) { return { id: evento.id, programacaoId, ok: false, erro: error.message }; }
    });
    const estadosPorProgramacao = {};
    for (const resultado of resultados) {
        const id = resultado.programacaoId;
        const estado = estadosPorProgramacao[id] ||= { versao: 1, calendarId, eventos: [] };
        const assinatura = resultado.ok ? resultado.assinatura : assinaturaConfirmada(porId.get(id), calendarId, resultado.id);
        if (assinatura) estado.eventos.push({ id: resultado.id, assinatura });
    }
    const programacaoIdsSincronizadas = Object.keys(estadosPorProgramacao).filter(id => resultados.filter(r => r.programacaoId === id).every(r => r.ok));
    return { sucesso: resultados.every(r => r.ok), resultados, estadosPorProgramacao, programacaoIdsSincronizadas,
        quantidade: resultados.filter(r => r.ok && r.alterado).length,
        semAlteracoes: resultados.filter(r => r.ok && !r.alterado).length,
        erro: resultados.filter(r => !r.ok).map(r => r.erro).join('; ') };
}
