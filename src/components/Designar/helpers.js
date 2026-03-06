export const SECOES_ORDEM = ['tesouros', 'ministerio', 'vida'];

export const SECOES_META = {
    tesouros: {
        titulo: 'TESOUROS DA PALAVRA DE DEUS',
        header: 'bg-teal-700 text-white',
        pill: 'bg-white/20 text-white',
        border: 'border-teal-200'
    },
    ministerio: {
        titulo: 'FAÇA SEU MELHOR NO MINISTÉRIO',
        header: 'bg-yellow-600 text-white',
        pill: 'bg-white/20 text-white',
        border: 'border-yellow-200'
    },
    vida: {
        titulo: 'NOSSA VIDA CRISTÃ',
        header: 'bg-red-700 text-white',
        pill: 'bg-white/20 text-white',
        border: 'border-red-200'
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
    if (!sem) return false;

    // 1. Pela flag na própria semana
    const ev = (sem.evento || '').toLowerCase();
    if (ev.includes('assembleia') || ev.includes('congresso')) return true;

    // 2. Cruza com o Dashboard extraindo APENAS DIA E MÊS para não dar erro de ano
    if (config?.eventosAnuais && Array.isArray(config.eventosAnuais)) {
        // Pega o MM-DD das datas da semana
        const datesToCheck = [sem.dataInicio, sem.dataExata, sem.dataReuniao].filter(Boolean);
        const mmddList = datesToCheck.map(d => d.length >= 5 ? d.slice(-5) : d);

        // Extrai o MM-DD do título da semana (ex: "13-19 de abril")
        let titleMmDd = null;
        if (sem.semana) {
            const str = sem.semana.toLowerCase();
            const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            let mesIndex = -1;
            for (let i = 0; i < meses.length; i++) {
                if (str.includes(meses[i])) { mesIndex = i % 12; break; }
            }
            const matchDia = str.match(/^(\d{1,2})/);
            if (mesIndex !== -1 && matchDia) {
                const mm = String((mesIndex % 12) + 1).padStart(2, '0');
                const dd = String(parseInt(matchDia[1], 10)).padStart(2, '0');
                titleMmDd = `${mm}-${dd}`;
            }
        }

        // Procura se tem algum evento no Dashboard batendo APENAS o MM-DD
        const configEv = config.eventosAnuais.find(e => {
            if (!e.dataInicio) return false;
            const eventMmDd = e.dataInicio.slice(-5);
            return mmddList.includes(eventMmDd) || (titleMmDd && titleMmDd === eventMmDd);
        });

        if (configEv && (configEv.tipo.includes('assembleia') || configEv.tipo.includes('congresso'))) {
            return true;
        }
    }
    return false;
};