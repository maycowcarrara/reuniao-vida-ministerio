// src/utils/revisarEnviar/historico.js
import { historyAssignmentKey } from '../assignmentIdentity.js';

export const isLegacyHistoricoEntry = (entry) => Boolean(
    entry &&
    entry.identityVersion !== 2 &&
    !entry.grupoId &&
    !entry.programacaoId &&
    !entry.tipoReuniao &&
    !entry.slotId
);

const normStr = (value) => (value ?? '').toString().trim();

const sameHistoricoPayload = (a, b) =>
    (a?.data ?? '') === (b?.data ?? '') &&
    (a?.parte ?? '') === (b?.parte ?? '') &&
    normStr(a?.ajudante) === normStr(b?.ajudante);

export const deduplicarHistorico = (historico = [], { alunoId = '', grupoLegadoId = '' } = {}) => {
    if (!Array.isArray(historico) || historico.length <= 1) return Array.isArray(historico) ? [...historico] : [];

    const identidade = (h) => historyAssignmentKey(h, alunoId);
    const v2PorChave = new Map();
    const v2LegadoPayloads = new Set();

    historico.forEach((entry, index) => {
        if (!entry) return;
        const key = identidade(entry);
        if (!key) return;
        v2PorChave.set(key, index);
        if (grupoLegadoId && (entry.grupoId || grupoLegadoId) === grupoLegadoId) {
            v2LegadoPayloads.add(`${entry.data ?? ''}|${entry.parte ?? ''}|${normStr(entry.ajudante)}`);
        }
    });

    const legadosVistos = new Set();
    const resultado = [];

    historico.forEach((entry, index) => {
        if (!entry) return;
        const key = identidade(entry);
        if (key) {
            if (v2PorChave.get(key) === index) resultado.push(entry);
            return;
        }
        const payloadKey = `${entry.data ?? ''}|${entry.parte ?? ''}|${normStr(entry.ajudante)}`;
        if (grupoLegadoId && isLegacyHistoricoEntry(entry) && v2LegadoPayloads.has(payloadKey)) return;
        if (legadosVistos.has(payloadKey)) return;
        legadosVistos.add(payloadKey);
        resultado.push(entry);
    });

    return resultado;
};

export const addHistorico = (listaAlunos, alunoId, entry, { grupoLegadoId = '' } = {}) => {
    if (alunoId === undefined || alunoId === null || String(alunoId) === '') return listaAlunos;
    const idx = listaAlunos.findIndex(a => a?.id != null && String(a.id) === String(alunoId));
    if (idx < 0) return listaAlunos;

    const alvo = listaAlunos[idx];
    const hist = Array.isArray(alvo.historico) ? [...alvo.historico] : [];
    const ajud = (entry.ajudante ?? '').toString();
    const novoRegistro = { ...entry, ajudante: ajud };

    const identidade = h => historyAssignmentKey(h, alunoId);
    const novaIdentidade = identidade(novoRegistro);

    if (novaIdentidade) {
        const idxMesmaIdentidade = hist.findIndex(h => identidade(h) === novaIdentidade);
        if (idxMesmaIdentidade >= 0) {
            if (sameHistoricoPayload(hist[idxMesmaIdentidade], novoRegistro)) return listaAlunos;
            hist[idxMesmaIdentidade] = novoRegistro;
            const novaLista = [...listaAlunos];
            novaLista[idx] = { ...alvo, historico: hist };
            return novaLista;
        }

        if (grupoLegadoId && novoRegistro.grupoId === grupoLegadoId) {
            const idxLegadoEquivalente = hist.findIndex(h => isLegacyHistoricoEntry(h) && sameHistoricoPayload(h, novoRegistro));
            if (idxLegadoEquivalente >= 0) {
                hist[idxLegadoEquivalente] = novoRegistro;
                const novaLista = [...listaAlunos];
                novaLista[idx] = { ...alvo, historico: hist };
                return novaLista;
            }
        }
    } else {
        const jaExiste = hist.some(h => identidade(h) === '' && sameHistoricoPayload(h, novoRegistro));
        if (jaExiste) return listaAlunos;
    }

    hist.push(novoRegistro);

    const novaLista = [...listaAlunos];
    novaLista[idx] = { ...alvo, historico: hist };
    return novaLista;
};

export const tipoOracaoToDb = (tipo) =>
    (tipo ?? '').toString().trim().toLowerCase().replaceAll('_', '');
