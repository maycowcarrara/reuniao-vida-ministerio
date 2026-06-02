const normalizeMeetingPartText = (value = '') =>
    value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

export const getMeetingPartTypeNormalized = (part) =>
    normalizeMeetingPartText(part?.tipo ?? part?.type ?? '');

export const getMeetingPartTitleNormalized = (part) =>
    normalizeMeetingPartText(part?.titulo ?? '');

const hasPrayerTitlePattern = (title = '') =>
    title.includes('e oracao') || title.includes('y oracion');

export const isPrayerPart = (part) => {
    const type = getMeetingPartTypeNormalized(part);
    if (type.includes('oracao') || type.includes('oracion')) return true;

    const title = getMeetingPartTitleNormalized(part);
    return hasPrayerTitlePattern(title);
};

export const isBibleStudyPart = (part) => {
    const type = getMeetingPartTypeNormalized(part);
    const title = getMeetingPartTitleNormalized(part);

    return (
        type.includes('estudo') ||
        type.includes('estudio') ||
        title.includes('estudo biblico de congregacao') ||
        title.includes('estudio biblico de la congregacion') ||
        title.includes('estudo biblico') ||
        title.includes('estudio biblico')
    );
};

export const isSongOnlyPart = (part) => {
    const type = getMeetingPartTypeNormalized(part);
    return type === 'cantico' || type === 'cancion';
};

export const getPrayerPartPosition = (part) => {
    if (!isPrayerPart(part)) return null;

    const raw = `${getMeetingPartTypeNormalized(part)} ${getMeetingPartTitleNormalized(part)}`.trim();

    if (raw.includes('inicial') || raw.includes('inicio') || raw.includes('abertura')) return 'inicio';
    if (raw.includes('final') || raw.includes('encerr') || raw.includes('encerramento')) return 'final';
    return null;
};
