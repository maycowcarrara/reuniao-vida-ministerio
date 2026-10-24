import { planejarAgendaGrupo } from '../utils/integracoesGrupo.js';

const bodyEvento = event => Object.fromEntries(['id','summary','description','start','end','attendees','extendedProperties','reminders'].filter(k => event[k] !== undefined).map(k=>[k,event[k]]));
export function validarEventoExistente(evento, atual, grupoLegadoId) {
    if (!atual) return;
    const esperado = evento.extendedProperties.private.rvmIdentity;
    if (atual.extendedProperties?.private?.rvmIdentity === esperado) return;
    const legado = evento.legacyReference;
    if (legado && legado.grupoId === grupoLegadoId && legado.eventId === atual.id
        && !atual.extendedProperties?.private?.rvmIdentity && /^\[RVM\]/.test(atual.summary || '')
        && String(atual.start?.dateTime || atual.start?.date || '').slice(0,10) === legado.dataOriginal) return;
    throw new Error('Evento existente não corresponde à identidade do destino; revisão necessária.');
}
export async function sincronizarAgendaGrupo({ token, calendarId, programacoes, config, grupoId, alunos, fetchImpl = fetch }) {
    if (!token || !calendarId) throw new Error('Escolha a agenda e autorize a conta Google.');
    const eventos = await planejarAgendaGrupo({ programacoes, config, grupoId, alunos });
    const resultados = [];
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const request = async (url, options={}) => {
        const response = await fetchImpl(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
        const data = await response.json().catch(()=>null);
        if (!response.ok && response.status!==404 && response.status!==409) throw new Error(`Google Agenda (${response.status}): ${data?.error?.message || 'operação recusada'}`);
        return {status:response.status,data};
    };
    for (const evento of eventos) {
        try {
            let atual = await request(`${base}/${evento.id}`);
            validarEventoExistente(evento, atual.status===404 ? null : atual.data, config.grupoLegadoId);
            let resposta;
            if (atual.status===404) {
                resposta = await request(`${base}?sendUpdates=none`,{method:'POST',body:JSON.stringify(bodyEvento(evento))});
                if (resposta.status===409) atual = await request(`${base}/${evento.id}`);
            }
            if (atual.status!==404) {
                validarEventoExistente(evento,atual.data,config.grupoLegadoId);
                if (!atual.data?.etag) throw new Error('Evento sem ETag; atualização recusada.');
                const response = await fetchImpl(`${base}/${evento.id}?sendUpdates=none`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','If-Match':atual.data.etag},body:JSON.stringify({ ...bodyEvento(evento), extendedProperties: { ...atual.data.extendedProperties, private: { ...atual.data.extendedProperties?.private, ...evento.extendedProperties.private } } })});
                if (!response.ok) throw new Error(`Atualização do evento recusada (${response.status}); destino preservado.`);
                resposta = {status:response.status};
            }
            if (!resposta || resposta.status>=400) throw new Error('Não foi possível sincronizar este evento.');
            resultados.push({id:evento.id,ok:true});
        } catch(error) {resultados.push({id:evento.id,ok:false,erro:error.message});}
    }
    return {sucesso:resultados.every(r=>r.ok),resultados};
}
