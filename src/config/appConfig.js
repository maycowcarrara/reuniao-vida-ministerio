export const DEFAULT_LANGUAGE = 'pt';
export const LANGUAGE_CHANGE_EVENT = 'app-language-change';
export const DEFAULT_MEETING_DAY = 'monday';

export const LANGUAGE_META = {
    pt: {
        code: 'pt',
        locale: 'pt-BR',
        htmlLang: 'pt-BR',
    },
    es: {
        code: 'es',
        locale: 'es-ES',
        htmlLang: 'es',
    },
};

export const WEEKDAY_ORDER = Object.freeze([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
]);

const WEEKDAY_META = {
    monday: {
        key: 'monday',
        jsDay: 1,
        offsetFromMonday: 0,
        labels: { pt: 'Segunda-feira', es: 'Lunes' },
        aliases: ['monday', 'segunda', 'segunda-feira', 'lunes'],
    },
    tuesday: {
        key: 'tuesday',
        jsDay: 2,
        offsetFromMonday: 1,
        labels: { pt: 'Terça-feira', es: 'Martes' },
        aliases: ['tuesday', 'terca', 'terça', 'terca-feira', 'terça-feira', 'martes'],
    },
    wednesday: {
        key: 'wednesday',
        jsDay: 3,
        offsetFromMonday: 2,
        labels: { pt: 'Quarta-feira', es: 'Miércoles' },
        aliases: ['wednesday', 'quarta', 'quarta-feira', 'miercoles', 'miércoles'],
    },
    thursday: {
        key: 'thursday',
        jsDay: 4,
        offsetFromMonday: 3,
        labels: { pt: 'Quinta-feira', es: 'Jueves' },
        aliases: ['thursday', 'quinta', 'quinta-feira', 'jueves'],
    },
    friday: {
        key: 'friday',
        jsDay: 5,
        offsetFromMonday: 4,
        labels: { pt: 'Sexta-feira', es: 'Viernes' },
        aliases: ['friday', 'sexta', 'sexta-feira', 'viernes'],
    },
    saturday: {
        key: 'saturday',
        jsDay: 6,
        offsetFromMonday: 5,
        labels: { pt: 'Sábado', es: 'Sábado' },
        aliases: ['saturday', 'sabado', 'sábado'],
    },
    sunday: {
        key: 'sunday',
        jsDay: 0,
        offsetFromMonday: 6,
        labels: { pt: 'Domingo', es: 'Domingo' },
        aliases: ['sunday', 'domingo'],
    },
};

export const DEFAULT_CONFIG = Object.freeze({
    idioma: DEFAULT_LANGUAGE,
    nome_cong: '',
    dia_reuniao: DEFAULT_MEETING_DAY,
    horario: '19:30',
    eventosAnuais: [],
});

export const normalizeLanguage = (idioma) => {
    const value = (idioma || '').toString().trim().toLowerCase();
    if (value.startsWith('es')) return 'es';
    if (value.startsWith('pt')) return 'pt';
    return DEFAULT_LANGUAGE;
};

export const getLanguageMeta = (idioma) => {
    const lang = normalizeLanguage(idioma);
    return LANGUAGE_META[lang] || LANGUAGE_META[DEFAULT_LANGUAGE];
};

export const normalizeMeetingDay = (day) => {
    const value = (day || '').toString().trim().toLowerCase();
    if (!value) return DEFAULT_MEETING_DAY;

    const match = WEEKDAY_ORDER.find((key) => {
        const meta = WEEKDAY_META[key];
        return meta.aliases.includes(value);
    });

    return match || DEFAULT_MEETING_DAY;
};

export const getWeekdayMeta = (day) => {
    const key = normalizeMeetingDay(day);
    return WEEKDAY_META[key] || WEEKDAY_META[DEFAULT_MEETING_DAY];
};

export const getWeekdayLabel = (day, idioma = DEFAULT_LANGUAGE) => {
    const lang = normalizeLanguage(idioma);
    return getWeekdayMeta(day).labels[lang] || getWeekdayMeta(day).labels[DEFAULT_LANGUAGE];
};

export const getWeekdayOptions = (idioma = DEFAULT_LANGUAGE) => {
    const lang = normalizeLanguage(idioma);
    return WEEKDAY_ORDER.map((key) => ({
        value: key,
        label: WEEKDAY_META[key].labels[lang] || WEEKDAY_META[key].labels[DEFAULT_LANGUAGE],
    }));
};

export const getWeekdayJsDay = (day) => getWeekdayMeta(day).jsDay;

export const getWeekdayOffsetFromMonday = (day) => getWeekdayMeta(day).offsetFromMonday;

export const normalizeSystemConfig = (config = {}) => ({
    ...DEFAULT_CONFIG,
    ...(config || {}),
    idioma: normalizeLanguage(config?.idioma),
    dia_reuniao: normalizeMeetingDay(config?.dia_reuniao || config?.diaReuniao || config?.diaSemana),
    eventosAnuais: Array.isArray(config?.eventosAnuais) ? config.eventosAnuais : DEFAULT_CONFIG.eventosAnuais,
});

export const getDocumentLanguage = () => {
    if (typeof document !== 'undefined') {
        const htmlLang = document.documentElement?.dataset?.lang || document.documentElement?.lang;
        if (htmlLang) return normalizeLanguage(htmlLang);
    }

    if (typeof window !== 'undefined') {
        try {
            const storedLang = window.localStorage.getItem('app_lang');
            if (storedLang) return normalizeLanguage(storedLang);
        } catch {
            return DEFAULT_LANGUAGE;
        }
    }

    return DEFAULT_LANGUAGE;
};

export const syncDocumentLanguage = (idioma) => {
    const meta = getLanguageMeta(idioma);

    if (typeof document !== 'undefined') {
        document.documentElement.lang = meta.htmlLang;
        document.documentElement.dataset.lang = meta.code;
    }

    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem('app_lang', meta.code);
            window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { lang: meta.code } }));
        } catch {
            return meta.code;
        }
    }

    return meta.code;
};
