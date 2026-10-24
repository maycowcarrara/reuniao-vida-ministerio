// src/utils/revisarEnviar/historico.js
import { historyAssignmentKey } from '../assignmentIdentity.js';
export const addHistorico = (listaAlunos, alunoId, entry) => {
    if (alunoId === undefined || alunoId === null || String(alunoId) === '') return listaAlunos;
    const idx = listaAlunos.findIndex(a => a?.id != null && String(a.id) === String(alunoId));
    if (idx < 0) return listaAlunos;

    const alvo = listaAlunos[idx];
    const hist = Array.isArray(alvo.historico) ? [...alvo.historico] : [];
    const ajud = (entry.ajudante ?? '').toString();

    const identidade = h => historyAssignmentKey(h, alunoId);
    const jaExiste = hist.some(h => identidade(h) === identidade(entry) &&
        (h?.data ?? '') === entry.data &&
        (h?.parte ?? '') === entry.parte &&
        ((h?.ajudante ?? '').toString() === ajud)
    );
    if (jaExiste) return listaAlunos;

    hist.push({ ...entry, ajudante: ajud });

    const novaLista = [...listaAlunos];
    novaLista[idx] = { ...alvo, historico: hist };
    return novaLista;
};

export const tipoOracaoToDb = (tipo) =>
    (tipo ?? '').toString().trim().toLowerCase().replaceAll('_', '');
