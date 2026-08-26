export const FIM_DE_SEMANA_SLOT_CAPABILITY = {
    presidente_fds: 'presidente_fds',
    dirigente_sentinela: 'dirigente_sentinela',
    leitor_sentinela: 'leitor_sentinela',
    indicador_entrada: 'indicador_entrada',
    indicador_auditorio: 'indicador_auditorio',
    microfones_volantes: 'microfones_volantes',
    audio_video: 'audio_video',
};

export const FIM_DE_SEMANA_RESPONSABILIDADES = [
    {
        storageKey: 'videoZoomSom',
        slotKey: 'audio_video',
        labels: { pt: 'Video, Zoom e som', es: 'Video, Zoom y sonido' },
    },
    {
        storageKey: 'indicadoresEntrada',
        slotKey: 'indicador_entrada',
        labels: { pt: 'Indicadores da entrada', es: 'Acomodadores de entrada' },
    },
    {
        storageKey: 'indicadoresAuditorio',
        slotKey: 'indicador_auditorio',
        labels: { pt: 'Indicadores do auditorio', es: 'Acomodadores del auditorio' },
    },
    {
        storageKey: 'microfonesVolantes',
        slotKey: 'microfones_volantes',
        labels: { pt: 'Microfones volantes', es: 'Microfonos' },
    },
];

export const MEIO_SEMANA_RESPONSABILIDADES = [
    {
        storageKey: 'videoZoomSom',
        slotKey: 'audio_video',
        labels: { pt: 'Video, Zoom e som', es: 'Video, Zoom y sonido' },
    },
    {
        storageKey: 'indicadoresEntrada',
        slotKey: 'indicador_entrada',
        labels: { pt: 'Indicadores da entrada', es: 'Acomodadores de entrada' },
    },
    {
        storageKey: 'indicadoresAuditorio',
        slotKey: 'indicador_auditorio',
        labels: { pt: 'Indicadores do auditorio', es: 'Acomodadores del auditorio' },
    },
    {
        storageKey: 'microfonesVolantes',
        slotKey: 'microfones_volantes',
        labels: { pt: 'Microfones volantes', es: 'Microfonos' },
    },
];

export const createResponsabilidadesDefault = () => ({
    videoZoomSom: [],
    indicadoresEntrada: [],
    indicadoresAuditorio: [],
    microfonesVolantes: [],
});

export const normalizeResponsabilidades = (responsabilidades = null, defs = MEIO_SEMANA_RESPONSABILIDADES) => {
    const base = defs.reduce((acc, { storageKey }) => {
        acc[storageKey] = [];
        return acc;
    }, {});
    const src = responsabilidades || {};
    return defs.reduce((acc, { storageKey }) => {
        acc[storageKey] = Array.isArray(src[storageKey]) ? src[storageKey] : [];
        return acc;
    }, base);
};

export const hasResponsabilidadesData = (responsabilidades = null, defs = MEIO_SEMANA_RESPONSABILIDADES) => {
    const normalized = normalizeResponsabilidades(responsabilidades, defs);
    return defs.some(({ storageKey }) => (normalized[storageKey] || []).some(hasPessoa));
};

export const createFimDeSemanaDefault = () => ({
    ativo: false,
    data: '',
    horario: '',
    presidente: null,
    oracaoFinal: null,
    reuniaoPublica: {
        temaDiscurso: '',
        oradorNomeManual: '',
        congregacaoOrador: '',
    },
    estudoSentinela: {
        dirigente: null,
        leitor: null,
    },
    visitaSuperintendente: {
        discursoFinal: '',
    },
    responsabilidades: {
        videoZoomSom: [],
        indicadoresEntrada: [],
        indicadoresAuditorio: [],
        microfonesVolantes: [],
    },
});

export const normalizeFimDeSemana = (fimDeSemana = null) => {
    const base = createFimDeSemanaDefault();
    const src = fimDeSemana || {};
    const responsabilidades = src.responsabilidades || {};
    const { orador: _oradorLegado, ...reuniaoPublicaSrc } = src.reuniaoPublica || {};
    const { temaOuArtigo: _temaOuArtigoLegado, ...estudoSentinelaSrc } = src.estudoSentinela || {};
    const visitaSuperintendenteSrc = src.visitaSuperintendente || {};

    return {
        ...base,
        ...src,
        ativo: !!src.ativo,
        data: (src.data || '').toString(),
        horario: (src.horario || '').toString(),
        presidente: src.presidente || null,
        oracaoFinal: src.oracaoFinal || null,
        reuniaoPublica: {
            ...base.reuniaoPublica,
            ...reuniaoPublicaSrc,
            temaDiscurso: (src.reuniaoPublica?.temaDiscurso || '').toString(),
            oradorNomeManual: (src.reuniaoPublica?.oradorNomeManual || '').toString(),
            congregacaoOrador: (src.reuniaoPublica?.congregacaoOrador || '').toString(),
        },
        estudoSentinela: {
            ...base.estudoSentinela,
            ...estudoSentinelaSrc,
            dirigente: src.estudoSentinela?.dirigente || null,
            leitor: src.estudoSentinela?.leitor || null,
        },
        visitaSuperintendente: {
            ...base.visitaSuperintendente,
            ...visitaSuperintendenteSrc,
            discursoFinal: (src.visitaSuperintendente?.discursoFinal || '').toString(),
        },
        responsabilidades: {
            ...normalizeResponsabilidades(responsabilidades, FIM_DE_SEMANA_RESPONSABILIDADES),
        },
    };
};

const hasPessoa = (pessoa) => !!(pessoa?.id || pessoa?.nome);

export const hasFimDeSemanaData = (fimDeSemana = null) => {
    const fds = normalizeFimDeSemana(fimDeSemana);
    if (fds.ativo || fds.data || fds.horario || hasPessoa(fds.presidente) || hasPessoa(fds.oracaoFinal)) return true;
    if (fds.reuniaoPublica.temaDiscurso || fds.reuniaoPublica.oradorNomeManual || fds.reuniaoPublica.congregacaoOrador) return true;
    if (hasPessoa(fds.estudoSentinela.dirigente) || hasPessoa(fds.estudoSentinela.leitor)) return true;
    if (fds.visitaSuperintendente.discursoFinal) return true;
    return FIM_DE_SEMANA_RESPONSABILIDADES.some(({ storageKey }) =>
        (fds.responsabilidades[storageKey] || []).some(hasPessoa)
    );
};

export const getFimDeSemanaSlotLabel = (slotKey, lang = 'pt') => {
    const labels = {
        presidente_fds: { pt: 'Presidente', es: 'Presidente' },
        oracao_fds: { pt: 'Oracao final', es: 'Oracion final' },
        dirigente_sentinela: { pt: 'Dirigente da Sentinela', es: 'Conductor de La Atalaya' },
        leitor_sentinela: { pt: 'Leitor da Sentinela', es: 'Lector de La Atalaya' },
        indicador_entrada: { pt: 'Indicador da entrada', es: 'Acomodador de entrada' },
        indicador_auditorio: { pt: 'Indicador do auditorio', es: 'Acomodador del auditorio' },
        microfones_volantes: { pt: 'Microfones volantes', es: 'Microfonos' },
        audio_video: { pt: 'Audio e video', es: 'Audio y video' },
    };
    return labels[slotKey]?.[lang] || labels[slotKey]?.pt || slotKey;
};

export const getFimDeSemanaAssignedPeople = (semana = null) => {
    const fds = normalizeFimDeSemana(semana?.fimDeSemana);
    if (!fds.ativo) return [];
    const assigned = [];
    const add = (pessoa, slotKey, label, extra = {}) => {
        if (!hasPessoa(pessoa)) return;
        assigned.push({
            pessoa,
            slotKey,
            label,
            data: fds.data || semana?.dataReuniao || semana?.dataExata || semana?.dataInicio || semana?.data || '',
            context: { fds: true, ...extra },
        });
    };

    add(fds.presidente, 'presidente_fds', 'Presidente');
    add(fds.estudoSentinela.dirigente, 'dirigente_sentinela', 'Dirigente da Sentinela');
    add(fds.estudoSentinela.leitor, 'leitor_sentinela', 'Leitor da Sentinela');
    add(fds.oracaoFinal, 'oracao_fds', 'Oracao final');

    FIM_DE_SEMANA_RESPONSABILIDADES.forEach(({ storageKey, slotKey, labels }) => {
        (fds.responsabilidades[storageKey] || []).forEach((pessoa, itemIndex) => {
            add(pessoa, slotKey, labels.pt, { responsabilidadeKey: storageKey, itemIndex, responsabilidade: true });
        });
    });

    return assigned;
};

export const getMeioSemanaAssignedPeople = (semana = null) => {
    const responsabilidades = normalizeResponsabilidades(semana?.responsabilidades, MEIO_SEMANA_RESPONSABILIDADES);
    const assigned = [];
    MEIO_SEMANA_RESPONSABILIDADES.forEach(({ storageKey, slotKey, labels }) => {
        (responsabilidades[storageKey] || []).forEach((pessoa, itemIndex) => {
            if (!hasPessoa(pessoa)) return;
            assigned.push({
                pessoa,
                slotKey,
                label: labels.pt,
                data: semana?.dataReuniao || semana?.dataExata || semana?.dataInicio || semana?.data || '',
                context: { meioSemana: true, responsabilidadeKey: storageKey, itemIndex, responsabilidade: true },
            });
        });
    });
    return assigned;
};
