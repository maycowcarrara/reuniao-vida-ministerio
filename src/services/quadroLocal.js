// Somente memória da sessão DEV; nunca um espelho em localStorage de dados privados.
let quadro = null;
const listeners = new Set();
export const lerQuadroLocal = () => quadro;
export const assinarQuadroLocal = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const publicarQuadroLocal = payload => {
    quadro = structuredClone(payload);
    listeners.forEach(listener => listener());
    return { local: true };
};
