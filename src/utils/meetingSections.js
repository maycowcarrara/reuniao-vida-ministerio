const SECTION_ICONS = {
    tesouros: '\u{1F48E}',
    ministerio: '\u{1F33E}',
    vida: '\u{1F411}',
};

const normalizeMeetingText = (value = '') =>
    value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

export const normalizeMeetingSection = (secao = '') => {
    const value = normalizeMeetingText(secao);
    if (value.includes('tesou')) return 'tesouros';
    if (value.includes('minist')) return 'ministerio';
    if (value.includes('vida')) return 'vida';
    return '';
};

export const inferMeetingSection = ({ secao = '', text = '', type = '' } = {}) => {
    const explicitSection = normalizeMeetingSection(secao);
    if (explicitSection) return explicitSection;

    const combined = `${normalizeMeetingText(type)} ${normalizeMeetingText(text)}`.trim();
    if (!combined) return '';

    if (
        /^\s*[123]\.\s/.test(combined) ||
        combined.includes('joias espirituais') ||
        combined.includes('joyas espirituales') ||
        combined.includes('leitura da biblia') ||
        combined.includes('lectura de la biblia') ||
        combined.includes('tesouros da palavra') ||
        combined.includes('tesoros de la palabra')
    ) {
        return 'tesouros';
    }

    if (
        combined.includes('estudo biblico de congregacao') ||
        combined.includes('estudio biblico de la congregacion') ||
        combined.includes('nossa vida crista') ||
        combined.includes('nuestra vida cristiana') ||
        combined.includes('necessidades locais') ||
        combined.includes('necesidades locales')
    ) {
        return 'vida';
    }

    if (
        combined.includes('faca seu melhor no ministerio') ||
        combined.includes('seamos mejores maestros') ||
        combined.includes('sea mejor maestro') ||
        combined.includes('iniciando conversas') ||
        combined.includes('inicie conversaciones') ||
        combined.includes('cultivando o interesse') ||
        combined.includes('haga revisitas') ||
        combined.includes('fazendo discipulos') ||
        combined.includes('haga discipulos')
    ) {
        return 'ministerio';
    }

    return '';
};

export const getMeetingSectionIcon = (secao = '', text = '', type = '') => {
    const normalized = inferMeetingSection({ secao, text, type });
    return SECTION_ICONS[normalized] || '';
};

export const getMeetingSectionLabel = (secao = '', lang = 'pt', text = '', type = '') => {
    const normalized = inferMeetingSection({ secao, text, type });
    if (normalized === 'tesouros') return lang === 'es' ? 'Tesoros' : 'Tesouros';
    if (normalized === 'ministerio') return lang === 'es' ? 'Ministerio' : 'Ministério';
    if (normalized === 'vida') return lang === 'es' ? 'Nuestra Vida' : 'Nossa Vida';
    return '';
};

export const getMeetingSectionTag = (secao = '', lang = 'pt', text = '', type = '') => {
    const icon = getMeetingSectionIcon(secao, text, type);
    const label = getMeetingSectionLabel(secao, lang, text, type);
    if (icon && label) return `${icon} ${label}`;
    return icon || label;
};

const prependMeetingSectionPrefix = (text = '', prefix = '') => {
    const value = (text || '').toString().trim();
    const safePrefix = (prefix || '').toString().trim();
    if (!safePrefix || !value) return value;
    return `${safePrefix} - ${value}`;
};

export const prependMeetingSectionTag = (text = '', secao = '', lang = 'pt') =>
    prependMeetingSectionPrefix(text, getMeetingSectionTag(secao, lang, text));

export const prependMeetingSectionLabel = (text = '', secao = '', lang = 'pt') =>
    prependMeetingSectionPrefix(text, getMeetingSectionLabel(secao, lang, text));

export const prependMeetingSectionIcon = (text = '', secao = '') => {
    const icon = getMeetingSectionIcon(secao, text);
    const value = (text || '').toString().trim();
    if (!icon || !value) return value;
    return `${icon} ${value}`;
};
