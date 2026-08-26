import { inferMeetingSection } from './meetingSections.js';
import {
    getMeetingPartTitleNormalized,
    getMeetingPartTypeNormalized,
    isBibleStudyPart,
    isPrayerPart,
} from './meetingParts.js';

export const ASSIGNMENT_CAPABILITIES = [
    {
        key: 'presidente_rvm',
        group: 'rvm',
        labels: { pt: 'Presidente da Reunião Vida e Ministério', es: 'Presidente de la Reunión Vida y Ministerio' },
        requiredGender: 'M',
    },
    {
        key: 'discurso_inicial',
        group: 'rvm',
        labels: { pt: 'Discurso inicial de Tesouros', es: 'Discurso inicial de Tesoros' },
        requiredGender: 'M',
    },
    {
        key: 'joias_espirituais',
        group: 'rvm',
        labels: { pt: 'Joias Espirituais', es: 'Perlas Escondidas' },
        requiredGender: 'M',
    },
    {
        key: 'leitura_biblia',
        group: 'rvm',
        labels: { pt: 'Leitura da Bíblia', es: 'Lectura de la Biblia' },
        requiredGender: 'M',
    },
    {
        key: 'ministerio',
        group: 'rvm',
        labels: { pt: 'Partes do Ministério', es: 'Partes del Ministerio' },
        requiredGender: 'todos',
    },
    {
        key: 'discurso',
        group: 'rvm',
        labels: { pt: 'Discurso no Ministério', es: 'Discurso en el Ministerio' },
        requiredGender: 'M',
    },
    {
        key: 'vida_crista',
        group: 'rvm',
        labels: { pt: 'Partes de Nossa Vida Cristã', es: 'Partes de Nuestra Vida Cristiana' },
        requiredGender: 'todos',
    },
    {
        key: 'estudo_biblico_congregacao',
        group: 'rvm',
        labels: { pt: 'Dirigente do Estudo Bíblico de Congregação', es: 'Director del Estudio Bíblico de la Congregación' },
        requiredGender: 'M',
    },
    {
        key: 'leitor_ebc',
        group: 'rvm',
        labels: { pt: 'Leitor do Estudo Bíblico de Congregação', es: 'Lector del Estudio Bíblico de la Congregación' },
        requiredGender: 'M',
    },
    {
        key: 'oracao',
        group: 'rvm',
        labels: { pt: 'Oração inicial e final', es: 'Oración inicial y final' },
        requiredGender: 'M',
    },
    {
        key: 'presidente_fds',
        group: 'fds',
        labels: { pt: 'Presidente da reunião de fim de semana', es: 'Presidente de la reunión de fin de semana' },
        requiredGender: 'M',
    },
    {
        key: 'dirigente_sentinela',
        group: 'fds',
        labels: { pt: 'Dirigente do Estudo de A Sentinela', es: 'Conductor del Estudio de La Atalaya' },
        requiredGender: 'M',
    },
    {
        key: 'leitor_sentinela',
        group: 'fds',
        labels: { pt: 'Leitor de A Sentinela', es: 'Lector de La Atalaya' },
        requiredGender: 'M',
    },
    {
        key: 'indicador_entrada',
        group: 'apoio',
        labels: { pt: 'Indicador da entrada', es: 'Acomodador de entrada' },
        requiredGender: 'todos',
    },
    {
        key: 'indicador_auditorio',
        group: 'apoio',
        labels: { pt: 'Indicador do auditório', es: 'Acomodador del auditorio' },
        requiredGender: 'todos',
    },
    {
        key: 'microfones_volantes',
        group: 'apoio',
        labels: { pt: 'Microfones volantes', es: 'Micrófonos' },
        requiredGender: 'todos',
    },
    {
        key: 'audio_video',
        group: 'apoio',
        labels: { pt: 'Áudio e vídeo', es: 'Audio y video' },
        requiredGender: 'todos',
    },
];

export const ASSIGNMENT_CAPABILITY_GROUPS = [
    { key: 'rvm', labels: { pt: 'Reunião Vida e Ministério', es: 'Reunión Vida y Ministerio' } },
    { key: 'fds', labels: { pt: 'Reunião de fim de semana', es: 'Reunión de fin de semana' } },
    { key: 'apoio', labels: { pt: 'Apoio', es: 'Apoyo' } },
];

const CAPABILITY_BY_KEY = ASSIGNMENT_CAPABILITIES.reduce((acc, item) => {
    acc[item.key] = item;
    return acc;
}, {});

const VALID_CAPABILITY_KEYS = new Set(ASSIGNMENT_CAPABILITIES.map((item) => item.key));

const UNIQUE = (items) => Array.from(new Set(items.filter((item) => VALID_CAPABILITY_KEYS.has(item))));

const LEGACY_BY_TIPO = {
    anciao: [
        'presidente_rvm',
        'discurso_inicial',
        'joias_espirituais',
        'leitura_biblia',
        'ministerio',
        'discurso',
        'vida_crista',
        'estudo_biblico_congregacao',
        'leitor_ebc',
        'oracao',
        'presidente_fds',
        'dirigente_sentinela',
        'leitor_sentinela',
        'indicador_entrada',
        'indicador_auditorio',
        'microfones_volantes',
        'audio_video',
    ],
    servo: [
        'discurso_inicial',
        'joias_espirituais',
        'leitura_biblia',
        'ministerio',
        'discurso',
        'vida_crista',
        'leitor_ebc',
        'oracao',
        'dirigente_sentinela',
        'leitor_sentinela',
        'indicador_entrada',
        'indicador_auditorio',
        'microfones_volantes',
        'audio_video',
    ],
    irmao_hab: [
        'leitura_biblia',
        'ministerio',
        'discurso',
        'leitor_ebc',
        'oracao',
    ],
    irmao: [
        'leitura_biblia',
        'ministerio',
    ],
    irma_exp: ['ministerio'],
    irma: ['ministerio'],
    irma_lim: ['ministerio'],
    desab: [],
};

const CAPABILITY_TO_SUGGEST_LABEL = {
    presidente_rvm: 'presidente',
    discurso_inicial: 'tesouros',
    joias_espirituais: 'joias',
    leitura_biblia: 'leitura',
    ministerio: 'ministerio',
    discurso: 'discurso',
    vida_crista: 'vida',
    estudo_biblico_congregacao: 'estudobiblico',
    leitor_ebc: 'leitor',
    oracao: 'oracao',
};

const normalize = (value = '') =>
    value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

export const getAssignmentCapability = (key) => CAPABILITY_BY_KEY[key] || null;

export const getAssignmentCapabilityLabel = (key, lang = 'pt') => {
    const capability = getAssignmentCapability(key);
    return capability?.labels?.[lang] || capability?.labels?.pt || key || '';
};

export const getAssignmentCapabilitiesByGroup = () =>
    ASSIGNMENT_CAPABILITY_GROUPS.map((group) => ({
        ...group,
        capabilities: ASSIGNMENT_CAPABILITIES.filter((capability) => capability.group === group.key),
    }));

export const normalizeAssignmentCapabilities = (capabilities = []) =>
    UNIQUE(Array.isArray(capabilities) ? capabilities : []);

export const getLegacyCapabilitiesForTipo = (tipo = 'irma') => {
    const key = normalize(tipo);
    return UNIQUE(LEGACY_BY_TIPO[key] || LEGACY_BY_TIPO.irma || []);
};

export const getAlunoCapabilities = (aluno = {}) => {
    if (Array.isArray(aluno?.partesHabilitadas)) {
        return normalizeAssignmentCapabilities(aluno.partesHabilitadas);
    }

    return getLegacyCapabilitiesForTipo(aluno?.tipo);
};

const hasAny = (text, terms) => terms.some((term) => text.includes(term));

export const getAssignmentCapabilityForSlot = ({ parte = null, slotKey = '' } = {}) => {
    const slot = normalize(slotKey);
    if (slot === 'presidente') return 'presidente_rvm';
    if (slot === 'oracao') return 'oracao';

    if (isBibleStudyPart(parte)) {
        if (slot === 'leitor') return 'leitor_ebc';
        if (slot === 'dirigente' || slot === 'estudante') return 'estudo_biblico_congregacao';
    }

    if (slot === 'dirigente') return 'estudo_biblico_congregacao';
    if (slot === 'leitor') return 'leitor_ebc';

    if (isPrayerPart(parte)) return 'oracao';

    const title = getMeetingPartTitleNormalized(parte);
    const type = getMeetingPartTypeNormalized(parte);
    const combined = `${type} ${title}`.trim();
    const secao = inferMeetingSection({ secao: parte?.secao, text: parte?.titulo, type: parte?.tipo ?? parte?.type });

    if (secao === 'tesouros') {
        if (hasAny(combined, ['leitura da biblia', 'lectura de la biblia'])) return 'leitura_biblia';
        if (hasAny(combined, ['joias espirituais', 'joyas espirituales', 'perlas escondidas', 'perlas'])) return 'joias_espirituais';
        return 'discurso_inicial';
    }

    if (secao === 'ministerio') {
        if (hasAny(combined, ['discurso'])) return 'discurso';
        return 'ministerio';
    }

    if (secao === 'vida') return 'vida_crista';

    return null;
};

export const getAssignmentContextForSlot = ({ parte = null, slotKey = '', cargosMap = {}, assignedStudent = null } = {}) => {
    const capabilityKey = getAssignmentCapabilityForSlot({ parte, slotKey });
    const capability = getAssignmentCapability(capabilityKey);
    let gender = capability?.requiredGender || 'todos';

    if (normalize(slotKey) === 'ajudante' && assignedStudent?.tipo && cargosMap?.[assignedStudent.tipo]?.gen) {
        gender = cargosMap[assignedStudent.tipo].gen;
    }

    return {
        capabilityKey,
        capability,
        gender,
        labelKey: normalize(slotKey) === 'ajudante' ? 'ajudante' : (CAPABILITY_TO_SUGGEST_LABEL[capabilityKey] || capabilityKey || 'qualquer'),
        isAjudante: normalize(slotKey) === 'ajudante',
    };
};

export const isAlunoEligibleForAssignment = ({ aluno, parte = null, slotKey = '', cargosMap = {}, assignedStudent = null, lang = 'pt' } = {}) => {
    if (!aluno) {
        return { eligible: false, reason: lang === 'es' ? 'Ningún estudiante seleccionado.' : 'Nenhum aluno selecionado.' };
    }

    if (aluno?.tipo === 'desab') {
        return { eligible: false, reason: lang === 'es' ? 'Estudiante deshabilitado.' : 'Aluno desabilitado.' };
    }

    const ctx = getAssignmentContextForSlot({ parte, slotKey, cargosMap, assignedStudent });
    if (!ctx.capabilityKey) {
        return { eligible: true, reason: '', capabilityKey: null, context: ctx };
    }

    if (ctx.capabilityKey === 'ministerio' && normalize(slotKey) !== 'ajudante' && aluno?.tipo === 'irma_lim') {
        return {
            eligible: false,
            reason: lang === 'es'
                ? 'Hermana limitada solo puede ser ayudante en esta asignación.'
                : 'Irmã limitada só pode ser ajudante nesta designação.',
            capabilityKey: ctx.capabilityKey,
            context: ctx,
        };
    }

    const cargoInfo = cargosMap?.[aluno.tipo];
    const alunoGender = cargoInfo?.gen || 'M';

    if (ctx.gender !== 'todos' && alunoGender !== ctx.gender) {
        return {
            eligible: false,
            reason: lang === 'es' ? 'Género incompatible con esta asignación.' : 'Gênero incompatível com esta designação.',
            capabilityKey: ctx.capabilityKey,
            context: ctx,
        };
    }

    const capabilities = getAlunoCapabilities(aluno);
    if (!capabilities.includes(ctx.capabilityKey)) {
        return {
            eligible: false,
            reason: lang === 'es'
                ? `No tiene habilitada la parte: ${getAssignmentCapabilityLabel(ctx.capabilityKey, lang)}.`
                : `Não tem habilitação para: ${getAssignmentCapabilityLabel(ctx.capabilityKey, lang)}.`,
            capabilityKey: ctx.capabilityKey,
            context: ctx,
        };
    }

    return { eligible: true, reason: '', capabilityKey: ctx.capabilityKey, context: ctx };
};
