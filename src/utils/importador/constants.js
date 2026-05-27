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
        chip: 'jw-sec-chip-soft-tesouros',
        wrap: 'jw-sec-surface-tesouros',
        left: 'jw-sec-left-tesouros',
        focus: 'jw-sec-focus-tesouros',
    },
    ministerio: {
        chip: 'jw-sec-chip-soft-ministerio',
        wrap: 'jw-sec-surface-ministerio',
        left: 'jw-sec-left-ministerio',
        focus: 'jw-sec-focus-ministerio',
    },
    vida: {
        chip: 'jw-sec-chip-soft-vida',
        wrap: 'jw-sec-surface-vida',
        left: 'jw-sec-left-vida',
        focus: 'jw-sec-focus-vida',
    },
    na: {
        chip: 'bg-gray-100 text-gray-700 border-gray-200',
        wrap: 'border-gray-200 bg-gray-50/70',
        left: 'border-l-gray-300',
        focus: 'focus:ring-gray-200 focus:border-gray-300',
    },
};
