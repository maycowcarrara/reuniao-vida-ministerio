import { normalizeLanguage } from '../../config/appConfig';
import { getSectionMessages } from '../../i18n';

export const TRANSLATIONS = {
    pt: getSectionMessages('importador', 'pt'),
    es: getSectionMessages('importador', 'es'),
};

export const IMPORTADOR_CATALOG_CONFIG = {
    pt: {
        languagePath: 'pt',
        catalogBase: 'jw-apostila-do-mes',
        weekLinkMatcher: (hrefLower) => hrefLower.includes('programa') || hrefLower.includes('programa%c3%a7'),
    },
    es: {
        languagePath: 'es',
        catalogBase: 'guia-actividades-reunion-testigos-jehova',
        weekLinkMatcher: (hrefLower) =>
            hrefLower.includes('vida-y-ministerio-cristianos') ||
            hrefLower.includes('guia-actividades-reunion-testigos-jehova'),
    },
};

export const getImportadorCatalogConfig = (lang) => {
    const normalized = normalizeLanguage(lang);
    return IMPORTADOR_CATALOG_CONFIG[normalized] || IMPORTADOR_CATALOG_CONFIG.pt;
};

export const SECAO_UI = {
    tesouros: {
        chip: 'bg-slate-100 text-slate-900 border-slate-200',
        wrap: 'border-slate-200 bg-slate-50/60',
        left: 'border-l-slate-500',
        focus: 'focus:ring-slate-200 focus:border-slate-300',
    },
    ministerio: {
        chip: 'bg-amber-100 text-amber-900 border-amber-200',
        wrap: 'border-amber-200 bg-amber-50/40',
        left: 'border-l-amber-400',
        focus: 'focus:ring-amber-200 focus:border-amber-300',
    },
    vida: {
        chip: 'bg-rose-100 text-rose-900 border-rose-200',
        wrap: 'border-rose-200 bg-rose-50/40',
        left: 'border-l-rose-400',
        focus: 'focus:ring-rose-200 focus:border-rose-300',
    },
    na: {
        chip: 'bg-gray-100 text-gray-700 border-gray-200',
        wrap: 'border-gray-200 bg-gray-50/70',
        left: 'border-l-gray-300',
        focus: 'focus:ring-gray-200 focus:border-gray-300',
    },
};
