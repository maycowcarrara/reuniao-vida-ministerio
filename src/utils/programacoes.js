import { getGrupoEfetivoId, isProgramacaoV2 } from './gruposProgramacao.js';

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

// Calendário puro em UTC evita diferenças de fuso/DST na identidade da semana.
export const getProgramacaoWeekStartISO = (programacao) => {
    const iso = getProgramacaoReferenceDateISO(programacao) || String(programacao?.fimDeSemana?.data || '');
    if (!ID_DATE_RE.test(iso)) throw new Error('Programação v2 exige data ISO válida.');
    const date = new Date(`${iso}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
        throw new Error('Programação v2 exige data ISO válida.');
    }
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
};

const assertGrupoDoId = (programacao, existingProgramacoes, config) => {
    const id = String(programacao?.id || '').trim();
    const existente = id && existingProgramacoes.find(item => String(item?.id || '').trim() === id);
    if (existente && getGrupoEfetivoId(existente, config) !== getGrupoEfetivoId(programacao, config)) {
        throw new Error('ID de programação já pertence a outro grupo.');
    }
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

export const getProgramacaoIdentitySignature = (programacao, config = {}) => {
    const signaturePayload = {
        ...(isProgramacaoV2(programacao) ? { grupoId: getGrupoEfetivoId(programacao, config) } : {}),
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

export const createProgramacaoId = (programacao, { forceRandom = false, config = {} } = {}) => {
    const explicitId = String(programacao?.id || '').trim();
    if (explicitId && !forceRandom) return explicitId;

    if (!forceRandom) {
        if (isProgramacaoV2(programacao)) {
            return `prog-${encodeURIComponent(getGrupoEfetivoId(programacao, config))}-${getProgramacaoWeekStartISO(programacao)}`;
        }
        const referenceDate = getProgramacaoReferenceDateISO(programacao);
        if (referenceDate) return `semana-${referenceDate}`;

        const signature = getProgramacaoIdentitySignature(programacao);
        if (signature) return `semana-hash-${signature}`;
    }

    return `semana-${randomSuffix()}`;
};

// Único comparador para importação/reconciliação. Nunca compara datas, assinaturas
// ou títulos fora do grupo efetivo, mesmo quando o principal muda.
export const findMatchingProgramacaoIndex = (programacao, existingProgramacoes = [], config = {}) => {
    assertGrupoDoId(programacao, existingProgramacoes, config);
    const grupoId = getGrupoEfetivoId(programacao, config);
    const explicitId = String(programacao?.id || '').trim();
    const byId = explicitId ? existingProgramacoes.findIndex(item => String(item?.id || '').trim() === explicitId) : -1;
    if (byId !== -1) return byId;
    const candidatos = existingProgramacoes
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item && getGrupoEfetivoId(item, config) === grupoId);
    if (isProgramacaoV2(programacao)) {
        const semana = getProgramacaoWeekStartISO(programacao);
        return candidatos.find(({ item }) => {
            try { return getProgramacaoWeekStartISO(item) === semana; }
            catch { return false; }
        })?.index ?? -1;
    }
    const referenceDate = getProgramacaoReferenceDateISO(programacao);
    const signature = getProgramacaoIdentitySignature(programacao, config);
    const titleKey = getLegacyProgramacaoTitleKey(programacao);
    return candidatos.find(({ item }) => referenceDate && getProgramacaoReferenceDateISO(item) === referenceDate)?.index
        ?? candidatos.find(({ item }) => getProgramacaoIdentitySignature(item, config) === signature)?.index
        ?? candidatos.find(({ item }) => titleKey && getLegacyProgramacaoTitleKey(item) === titleKey)?.index
        ?? -1;
};

export const findMatchingProgramacaoId = (programacao, existingProgramacoes = [], config = {}) => {
    assertGrupoDoId(programacao, existingProgramacoes, config);
    const explicitId = String(programacao?.id || '').trim();
    if (explicitId) return explicitId;
    const index = findMatchingProgramacaoIndex(programacao, existingProgramacoes, config);
    return createProgramacaoId(index === -1 ? programacao : existingProgramacoes[index], { config });
};

export const ensureUniqueProgramacaoIds = (programacoes = [], config = {}) => {
    const usedIds = new Set();

    return (programacoes || []).map((programacao) => {
        if (!programacao) return programacao;

        let id = createProgramacaoId(programacao, { config });
        if (usedIds.has(id) && (programacao.id || isProgramacaoV2(programacao))) {
            throw new Error('ID de programação duplicado; resolver conflito sem renomear vínculos.');
        }
        while (!id || usedIds.has(id)) {
            id = createProgramacaoId(programacao, { forceRandom: true });
        }

        usedIds.add(id);
        return { ...programacao, id };
    });
};

export const reconcileProgramacaoIds = (programacoes = [], existingProgramacoes = [], config = {}) => {
    const usedIds = new Set();

    return (programacoes || []).map((programacao) => {
        if (!programacao) return programacao;

        let id = findMatchingProgramacaoId(programacao, existingProgramacoes, config);
        if (usedIds.has(id) && (programacao.id || isProgramacaoV2(programacao))) {
            throw new Error('ID de programação duplicado; resolver conflito sem renomear vínculos.');
        }
        while (!id || usedIds.has(id)) {
            id = createProgramacaoId(programacao, { forceRandom: true });
        }

        usedIds.add(id);
        return { ...programacao, id };
    });
};
