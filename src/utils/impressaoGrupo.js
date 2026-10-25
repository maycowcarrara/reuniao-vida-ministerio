import { normalizeOcorrenciaReuniao } from './ocorrenciasReuniao.js';
import { getCelebracao } from './celebracao.js';
export const somenteFimDeSemana = (programa, config) => !normalizeOcorrenciaReuniao(programa, 'meioSemana', config).operacional
    && normalizeOcorrenciaReuniao(programa, 'fimDeSemana', config).operacional;
export const paginarImpressao = (programas, quantidade, config) => {
    const paginas = [];
    let lote = [];
    const flush = () => { if (lote.length) paginas.push(lote); lote = []; };
    for (const programa of programas) {
        if (getCelebracao(programa, config) || somenteFimDeSemana(programa, config)) { flush(); paginas.push([programa]); }
        else { lote.push(programa); if (lote.length === quantidade) flush(); }
    }
    flush();
    return paginas;
};
