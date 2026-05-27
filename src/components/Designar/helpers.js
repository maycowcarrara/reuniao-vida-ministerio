import { isSemanaBloqueadaPorEvento } from '../../utils/eventos';

export const SECOES_ORDEM = ['tesouros', 'ministerio', 'vida'];

export const SECOES_META = {
    tesouros: {
        titulo: 'TESOUROS DA PALAVRA DE DEUS',
        header: 'jw-sec-bg-tesouros text-white',
        pill: 'bg-white/20 text-white',
        border: 'jw-sec-border-tesouros',
        actionButton: 'jw-sec-action-tesouros'
    },
    ministerio: {
        titulo: 'FAÇA SEU MELHOR NO MINISTÉRIO',
        header: 'jw-sec-bg-ministerio text-white',
        pill: 'bg-white/20 text-white',
        border: 'jw-sec-border-ministerio',
        actionButton: 'jw-sec-action-ministerio'
    },
    vida: {
        titulo: 'NOSSA VIDA CRISTÃ',
        header: 'jw-sec-bg-vida text-white',
        pill: 'bg-white/20 text-white',
        border: 'jw-sec-border-vida',
        actionButton: 'jw-sec-action-vida'
    }
};

export const normalizar = (texto) =>
    texto ? texto.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

export const normalizarSecao = (secao) => {
    const s = (secao ?? '').toString().toLowerCase();
    if (s.includes('tesou')) return 'tesouros';
    if (s.includes('minist')) return 'ministerio';
    return 'vida';
};

export const tipoLower = (parte) => (parte?.tipo ?? parte?.type ?? '').toString().toLowerCase();

export const isAbertura = (parte) => {
    const raw = `${tipoLower(parte)} ${(parte?.titulo ?? '').toString().toLowerCase()}`.trim();
    return raw.includes('oracao') && (raw.includes('inicial') || raw.includes('inicio') || raw.includes('abertura'));
};

export const isEncerramento = (parte) => {
    const raw = `${tipoLower(parte)} ${(parte?.titulo ?? '').toString().toLowerCase()}`.trim();
    return raw.includes('oracao') && (raw.includes('final') || raw.includes('encerr'));
};

export const isLinhaInicialFinal = (parte) => isAbertura(parte) || isEncerramento(parte);

export const isEstudoBiblicoCongregacao = (parte) => {
    const tipo = tipoLower(parte);
    if (tipo.includes('estudo')) return true;
    const tituloN = normalizar(parte?.titulo ?? '');
    return tituloN.includes('estudo biblico de congregacao') || tituloN.includes('estudio biblico de la congregacion');
};

// Nova regra para o Cântico de "Nossa Vida Cristã"
export const isCanticoIntermediario = (parte) => {
    return normalizarSecao(parte?.secao) === 'vida' && tipoLower(parte) === 'cantico';
};

// Verifica se a semana é uma assembleia/congresso com base na configuração do Dashboard
export const isSemanaAssembleia = (sem, config) => {
    return isSemanaBloqueadaPorEvento(sem, config);
};
