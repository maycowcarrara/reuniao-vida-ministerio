const ID_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MANUAL_PART_ID_RE = /^manual-\d+-/;

const randomSuffix = () => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getProgramacaoReferenceDateISO = (programacao) => {
    const keys = ['dataInicio', 'dataReuniao', 'dataExata', 'data'];

    for (const key of keys) {
        const value = String(programacao?.[key] || '').trim();
        if (ID_DATE_RE.test(value)) return value;
    }

    return '';
};

const normalizeTitle = (value = '') => value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const stableStringify = (value) => {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        const entries = Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
        return `{${entries.join(',')}}`;
    }

    return JSON.stringify(value);
};

const hashString = (value = '') => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

export const getLegacyProgramacaoTitleKey = (programacao) => normalizeTitle(programacao?.semana);

export const getProgramacaoIdentitySignature = (programacao) => {
    const signaturePayload = {
        data: getProgramacaoReferenceDateISO(programacao),
        evento: String(programacao?.evento || programacao?.tipo || '').trim(),
        dataEventoEspecial: String(programacao?.dataEventoEspecial || '').trim(),
        partes: (Array.isArray(programacao?.partes) ? programacao.partes : []).map((parte) => ({
            id: MANUAL_PART_ID_RE.test(String(parte?.id || '')) ? '' : String(parte?.id || '').trim(),
            tipo: String(parte?.tipo || parte?.type || '').trim(),
            secao: String(parte?.secao || '').trim(),
            titulo: String(parte?.titulo || '').trim(),
            descricao: String(parte?.descricao || '').trim(),
            tempo: String(parte?.tempo || '').trim(),
            sala: String(parte?.sala || '').trim()
        }))
    };

    return hashString(stableStringify(signaturePayload));
};

export const createProgramacaoId = (programacao, { forceRandom = false } = {}) => {
    const explicitId = String(programacao?.id || '').trim();
    if (explicitId && !forceRandom) return explicitId;

    if (!forceRandom) {
        const referenceDate = getProgramacaoReferenceDateISO(programacao);
        if (referenceDate) return `semana-${referenceDate}`;

        const signature = getProgramacaoIdentitySignature(programacao);
        if (signature) return `semana-hash-${signature}`;
    }

    return `semana-${randomSuffix()}`;
};

export const findMatchingProgramacaoId = (programacao, existingProgramacoes = []) => {
    const explicitId = String(programacao?.id || '').trim();
    if (explicitId) return explicitId;

    const referenceDate = getProgramacaoReferenceDateISO(programacao);
    if (referenceDate) {
        const byDate = (existingProgramacoes || []).find((item) => getProgramacaoReferenceDateISO(item) === referenceDate);
        if (byDate) return createProgramacaoId(byDate);
    }

    const signature = getProgramacaoIdentitySignature(programacao);
    if (signature) {
        const bySignature = (existingProgramacoes || []).find((item) => getProgramacaoIdentitySignature(item) === signature);
        if (bySignature) return createProgramacaoId(bySignature);
    }

    const legacyTitleKey = getLegacyProgramacaoTitleKey(programacao);
    if (legacyTitleKey) {
        const byTitle = (existingProgramacoes || []).find((item) => getLegacyProgramacaoTitleKey(item) === legacyTitleKey);
        if (byTitle) return createProgramacaoId(byTitle);
    }

    return createProgramacaoId(programacao);
};

export const ensureUniqueProgramacaoIds = (programacoes = []) => {
    const usedIds = new Set();

    return (programacoes || []).map((programacao) => {
        if (!programacao) return programacao;

        let id = createProgramacaoId(programacao);
        while (!id || usedIds.has(id)) {
            id = createProgramacaoId(programacao, { forceRandom: true });
        }

        usedIds.add(id);
        return { ...programacao, id };
    });
};

export const reconcileProgramacaoIds = (programacoes = [], existingProgramacoes = []) => {
    const usedIds = new Set();

    return (programacoes || []).map((programacao) => {
        if (!programacao) return programacao;

        let id = findMatchingProgramacaoId(programacao, existingProgramacoes);
        while (!id || usedIds.has(id)) {
            id = createProgramacaoId(programacao, { forceRandom: true });
        }

        usedIds.add(id);
        return { ...programacao, id };
    });
};
