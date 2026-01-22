// src/utils/revisarEnviar/historico.js
export const addHistorico = (listaAlunos, alunoId, entry) => {
    const idx = listaAlunos.findIndex(a => Number(a?.id) === Number(alunoId));
    if (idx < 0) return listaAlunos;

    const alvo = listaAlunos[idx];
    const hist = Array.isArray(alvo.historico) ? [...alvo.historico] : [];
    const ajud = (entry.ajudante ?? '').toString();

    const jaExiste = hist.some(h =>
        (h?.data ?? '') === entry.data &&
        (h?.parte ?? '') === entry.parte &&
        ((h?.ajudante ?? '').toString() === ajud)
    );
    if (jaExiste) return listaAlunos;

    hist.push({ data: entry.data, parte: entry.parte, ajudante: ajud });

    const novaLista = [...listaAlunos];
    novaLista[idx] = { ...alvo, historico: hist };
    return novaLista;
};

export const tipoOracaoToDb = (tipo) =>
    (tipo ?? '').toString().trim().toLowerCase().replaceAll('_', '');
