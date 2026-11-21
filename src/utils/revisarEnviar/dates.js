// src/utils/revisarEnviar/dates.js
import { getLanguageMeta, getWeekdayJsDay } from '../../config/appConfig.js';
import { getDataSemanalVigente, getPadraoReuniao } from '../../config/meetingSchedule.js';

const normalizarTxt = (s) =>
    (s ?? '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const MONTH_IDX = {
    // pt
    janeiro: 0,
    fevereiro: 1,
    marco: 2,
    março: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11,
    // es
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril_es: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto_es: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
};

const monthIndexFromName = (name) => {
    const k = normalizarTxt(name);
    if (MONTH_IDX[k] != null) return MONTH_IDX[k];
    if (k === 'abril') return 3;
    if (k === 'agosto') return 7;
    return null;
};

export const parseSemanaRange = (semanaStr) => {
    const raw = (semanaStr ?? '').toString().replace(/\u00a0/g, ' ').trim();
    if (!raw) return null;

    // Normalização inicial: remove traços longos
    const normalized = raw.replace(/[–—]/g, '-');

    // Tenta com o split antes do " - " (leitura), com 2 blocos (se o próprio range tiver " - "), e a string inteira
    const candidates = [
        normalized.split(' - ')[0].trim(),
        normalized.split(' - ').slice(0, 2).join(' - ').trim(),
        normalized
    ];

    for (const cand of candidates) {
        const cleaned = cand
            // remove ordinais como 1.°, 1.º, 1º, 1°, 1. antes de separadores ou "de"
            .replace(/(\d{1,2})\s*\.?\s*[\u00b0\u00ba\u00aa](?!\w)/gi, '$1')
            .replace(/(\d{1,2})\s*\.(?=\s*(?:de|del|-|a\b|al\b|\d))/gi, '$1')
            .replace(/(\d{1,2})(?:er|ero)\b/gi, '$1')
            .trim();

        // 1. Dois meses diferentes (mesmo ano ou cruzando ano):
        //    "26 de outubro-1 de novembro", "30 de noviembre a 6 de diciembre",
        //    "28 de dezembro de 2026-3 de janeiro de 2027", "28 de dezembro-3 de janeiro de 2027"
        let m = /(?:^|[^\d])(\d{1,2})\s*(?:de|del)\s*([A-Za-zÀ-ÿ]+)(?:\s+(?:de|del)\s+(20\d{2})|\s+(20\d{2}))?\s*(?:-|\s+(?:a|al)\s+)\s*(\d{1,2})\s*(?:de|del)\s*([A-Za-zÀ-ÿ]+)(?:\s+(?:de|del)\s+(20\d{2})|\s+(20\d{2}))?/i.exec(cleaned);
        if (m) {
            const mStart = monthIndexFromName(m[2]);
            const mEnd = monthIndexFromName(m[6]);
            if (mStart != null && mEnd != null) {
                const startYear = m[3] || m[4] ? Number(m[3] || m[4]) : null;
                const endYear = m[7] || m[8] ? Number(m[7] || m[8]) : null;
                return {
                    startDay: Number(m[1]),
                    startMonthName: m[2],
                    startYear,
                    endDay: Number(m[5]),
                    endMonthName: m[6],
                    endYear,
                };
            }
        }

        // 2. Mesmo mês: "4-10 de maio", "4 a 10 de maio", "1 al 7 de noviembre", "4-10 de janeiro de 2027"
        //    (?:^|[^\d]) impede falso positivo com final de ano como "2026-3 de janeiro".
        m = /(?:^|[^\d])(\d{1,2})\s*(?:-|\s+(?:a|al)\s+)\s*(\d{1,2})\s*(?:de|del)\s*([A-Za-zÀ-ÿ]+)(?:\s+(?:de|del)\s+(20\d{2})|\s+(20\d{2}))?/i.exec(cleaned);
        if (m) {
            const mEnd = monthIndexFromName(m[3]);
            if (mEnd != null) {
                const explicitYear = m[4] || m[5] ? Number(m[4] || m[5]) : null;
                return {
                    startDay: Number(m[1]),
                    startMonthName: m[3],
                    startYear: explicitYear,
                    endDay: Number(m[2]),
                    endMonthName: m[3],
                    endYear: explicitYear,
                };
            }
        }
    }

    return null;
};

const formatISODateOnly = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const addDays = (dateObj, days) => {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + days);
    return d;
};

const isValidYMDParts = (year, month, day) => (
    Number.isInteger(year)
    && Number.isInteger(month)
    && Number.isInteger(day)
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= 31
);

const buildISOFromParts = (year, month, day) => {
    if (!isValidYMDParts(year, month, day)) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const parseFlexibleDateToISO = (value) => {
    const raw = (value ?? '').toString().trim();
    if (!raw) return null;

    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        return buildISOFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
        return buildISOFromParts(Number(match[3]), Number(match[2]), Number(match[1]));
    }

    match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
        return buildISOFromParts(Number(match[3]), Number(match[2]), Number(match[1]));
    }

    return null;
};

const resolveStartYearForRange = ({ range, mStart, mEnd, isoFallback, config, textSources = [] }) => {
    const crossesYear = mEnd < mStart;

    if (Number.isInteger(range?.startYear)) {
        return range.startYear;
    }

    if (Number.isInteger(range?.endYear)) {
        return crossesYear ? range.endYear - 1 : range.endYear;
    }

    const fallbackISO = parseFlexibleDateToISO(isoFallback);
    if (fallbackISO) {
        const fbYear = Number(fallbackISO.slice(0, 4));
        const fbMonth = Number(fallbackISO.slice(5, 7)) - 1;
        if (crossesYear && fbMonth === mEnd) {
            return fbYear - 1;
        }
        return fbYear;
    }

    for (const source of textSources) {
        const text = (source ?? '').toString();
        if (!text) continue;

        if (crossesYear) {
            const parsedSource = parseSemanaRange(text);
            if (parsedSource) {
                const srcStart = monthIndexFromName(parsedSource.startMonthName);
                const srcEnd = monthIndexFromName(parsedSource.endMonthName);
                if (srcStart != null && srcEnd != null && srcEnd < srcStart) {
                    if (Number.isInteger(parsedSource.startYear)) return parsedSource.startYear;
                    if (Number.isInteger(parsedSource.endYear)) return parsedSource.endYear - 1;
                }
            }
        }

        const years = Array.from(text.matchAll(/\b(20\d{2})\b/g), (match) => Number(match[1]));
        if (years.length > 0) {
            if (crossesYear) {
                const pairStart = years.find((y) => years.includes(y + 1));
                if (pairStart != null) return pairStart;
            }
            return years[0];
        }
    }

    if (Number(config?.anoProgramacao)) return Number(config.anoProgramacao);
    if (Number(config?.ano)) return Number(config.ano);

    const now = new Date();
    if (crossesYear && now.getMonth() === mEnd) {
        return now.getFullYear() - 1;
    }
    return now.getFullYear();
};

const getWeekRangeDatesFromSemana = ({ semanaStr, config, isoFallback, textSources = [] }) => {
    const range = parseSemanaRange(semanaStr);
    if (!range) return null;

    const mStart = monthIndexFromName(range.startMonthName);
    const mEnd = monthIndexFromName(range.endMonthName);
    if (mStart == null || mEnd == null) return null;

    const crossesYear = mEnd < mStart;
    const startYear = resolveStartYearForRange({
        range,
        mStart,
        mEnd,
        isoFallback,
        config,
        textSources,
    });
    let endYear = Number.isInteger(range.endYear)
        ? range.endYear
        : (crossesYear ? startYear + 1 : startYear);
    if (crossesYear && endYear <= startYear) {
        endYear = startYear + 1;
    }

    const start = new Date(startYear, mStart, range.startDay);
    let end = new Date(endYear, mEnd, range.endDay);

    // Garantia adicional caso o fim caia antes do início (ex.: dezembro -> janeiro)
    if (end.getTime() < start.getTime()) {
        end = new Date(startYear + 1, mEnd, range.endDay);
    }

    return { start, end };
};

export const getWeekStartISOFromSemana = ({ semanaStr, config, isoFallback, textSources = [] }) => {
    const rangeDates = getWeekRangeDatesFromSemana({ semanaStr, config, isoFallback, textSources });
    if (!rangeDates) return isoFallback || null;
    return formatISODateOnly(rangeDates.start);
};

export const getMeetingDateISOFromSemana = ({ semanaStr, config, isoFallback, overrideDia = null, tipoReuniao = 'meioSemana', textSources = [] }) => {
    // Se houver um overrideDia (ex: 'Terça-feira' para visita), usa ele.
    // Senão, tenta a configuração. Se não tiver configuração, string vazia.
    const diaAlvo = overrideDia || config?.dia_reuniao || config?.diaReuniao || config?.diaSemana || '';
    const weekdayIdx = getWeekdayJsDay(diaAlvo);
    const rangeDates = getWeekRangeDatesFromSemana({ semanaStr, config, isoFallback, textSources });

    if (!rangeDates && !overrideDia && parseFlexibleDateToISO(isoFallback)) {
        return getDataSemanalVigente(isoFallback, getPadraoReuniao(config, tipoReuniao)) || isoFallback;
    }
    if (!rangeDates || weekdayIdx == null) {
        return isoFallback || null;
    }

    const { start, end } = rangeDates;
    if (!overrideDia) return getDataSemanalVigente(formatISODateOnly(start), getPadraoReuniao(config, tipoReuniao)) || isoFallback || null;
    let cur = new Date(start);
    let found = null;

    // Procura o dia da semana específico dentro do range da semana
    while (cur.getTime() <= end.getTime()) {
        if (cur.getDay() === weekdayIdx) {
            found = new Date(cur);
            break;
        }
        cur = addDays(cur, 1);
    }

    const meetingDate = found ?? start;
    return formatISODateOnly(meetingDate);
};

export const formatarDataFolha = (dataStr, lang) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia);
    return data.toLocaleDateString(getLanguageMeta(lang).locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};

const getStoredDateISOFromSemana = (sem, orderedFields = []) => {
    for (const field of orderedFields) {
        const value = field.includes('.')
            ? field.split('.').reduce((acc, part) => acc?.[part], sem)
            : sem?.[field];
        const iso = parseFlexibleDateToISO(value);
        if (iso) return iso;
    }
    return null;
};

export const getCanonicalWeekStartISO = ({ sem, config }) => {
    if (!sem) return null;

    const storedStartISO = getStoredDateISOFromSemana(sem, [
        'dataInicio',
        'dataExata',
        'dataReuniao',
        'data',
        'meioSemana.data',
        'fimDeSemana.data',
    ]);

    const parsedFromLabel = getWeekStartISOFromSemana({
        semanaStr: sem?.semana,
        config,
        isoFallback: storedStartISO,
        textSources: [sem?.semana],
    });

    return parsedFromLabel || storedStartISO;
};

export const getCanonicalMeetingDateISO = ({ sem, config, overrideDia = null, tipoReuniao = 'meioSemana' }) => {
    if (!sem) return null;

    const storedYearRefISO = getStoredDateISOFromSemana(sem, [
        'dataInicio',
        'dataReuniao',
        'dataExata',
        'data',
        'meioSemana.data',
        'fimDeSemana.data',
    ]);

    const parsedFromLabel = getMeetingDateISOFromSemana({
        semanaStr: sem?.semana,
        config,
        isoFallback: storedYearRefISO,
        overrideDia,
        tipoReuniao,
        textSources: [sem?.semana],
    });

    return parsedFromLabel || getStoredDateISOFromSemana(sem, [
        'dataReuniao',
        'dataExata',
        'dataInicio',
        'data',
        'meioSemana.data',
        'fimDeSemana.data',
    ]);
};

export const getSemanaSortTimestamp = (sem, config) => {
    if (!sem) return 0;

    const weekStartISO = getCanonicalWeekStartISO({ sem, config });

    if (!weekStartISO) return 0;

    const [ano, mes, dia] = weekStartISO.split('-').map(Number);
    if (!isValidYMDParts(ano, mes, dia)) return 0;

    return new Date(ano, mes - 1, dia, 12, 0, 0).getTime();
};
