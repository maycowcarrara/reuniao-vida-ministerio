import { planejarAgendaGrupo } from '../utils/integracoesGrupo.js';
import { getGrupoLegadoId, isProgramacaoV2 } from '../utils/gruposProgramacao.js';

import { assinaturaConfirmada, mapLimit } from '../utils/agendaDelta.js';
import { criarClienteAgenda, sincronizarEventosAgenda } from './agendaEventos.js';
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
export async function sincronizarAgendaGrupo({ token, calendarId, programacoes, config, grupoId, alunos, fetchImpl = fetch, conferirTudo = false }) {
    if (!token || !calendarId) throw new Error('Escolha a agenda e autorize a conta Google.');
    const cliente = criarClienteAgenda({ token, calendarId, fetchImpl });
    const { base, request } = cliente;
    const porId = new Map(programacoes.map(p => [String(p.id), p]));
    // Semanas nativas v2 também recebem agendaSincronizadaEm. Esse marcador
    // sozinho não prova origem legada: recupere os vínculos pelos IDs estáveis
    // e pela identidade privada, antes de permitir qualquer gravação.
    const semInventario = new Set(programacoes.filter(p => isProgramacaoV2(p)
        && !p.identidadeLegada && p.agendaSincronizadaEm && grupoId === getGrupoLegadoId(config))
        .map(p => String(p.id)));
    const consultados = new Map();
    const vinculos = [];
    if (semInventario.size) {
        const propostas = await planejarAgendaGrupo({ config, grupoId, alunos,
            programacoes: programacoes.map(p => semInventario.has(String(p.id)) ? { ...p, agendaSincronizadaEm: null } : p) });
        const verificadas = new Set();
        const inventario = propostas.filter(e => semInventario.has(e.identity.programacaoId));
        await mapLimit(inventario, async evento => {
            const id = evento.identity.programacaoId;
            // O checkpoint só é salvo após sucesso verificado no destino exato.
            const conhecido = assinaturaConfirmada(porId.get(id), calendarId, evento.id);
            if (conhecido) verificadas.add(id);
            else {
                const atual = await request(`${base}/${evento.id}`);
                consultados.set(evento.id, atual);
                if (atual.status !== 404) {
                    validarEventoExistente(evento, atual.data, getGrupoLegadoId(config));
                    if (!atual.data || atual.data.id !== evento.id) throw new Error('Não foi possível verificar o vínculo do evento na agenda.');
                    verificadas.add(id);
                }
            }
        });
        vinculos.push(...inventario.map(evento => ({ ...evento.identity, eventId: evento.id })));
        for (const id of new Set(propostas.filter(e => semInventario.has(e.identity.programacaoId)).map(e => e.identity.programacaoId))) {
            if (!verificadas.has(id)) throw new Error('Não foi possível localizar os eventos já sincronizados desta semana. Escolha a mesma agenda usada anteriormente e tente novamente.');
        }
    }
    const eventos = await planejarAgendaGrupo({ programacoes, config, grupoId, alunos, vinculos });
    return sincronizarEventosAgenda({ eventos, programacoes, calendarId, cliente, consultados, conferirTudo,
        validar: (evento, atual) => validarEventoExistente(evento, atual, getGrupoLegadoId(config)) });
}
