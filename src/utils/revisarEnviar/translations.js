import { normalizeLanguage } from '../../config/appConfig';
import { getSectionMessages } from '../../i18n';

export const TRANSLATIONS = {
    pt: getSectionMessages('revisarenviar', 'pt'),
    es: getSectionMessages('revisarenviar', 'es'),
};

export const normalizarIdioma = normalizeLanguage;

export const getI18n = (config) => {
    const lang = normalizarIdioma(config?.idioma);
    const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;
    return { lang, t };
};
