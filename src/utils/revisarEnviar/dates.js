// src/utils/revisarEnviar/dates.js
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

const weekdayToIndex = (diaSemana) => {
    const d = normalizarTxt(diaSemana);

    // pt
    if (d === 'domingo') return 0;
    if (d === 'segunda' || d === 'segunda-feira') return 1;
    if (d === 'terca' || d === 'terça' || d === 'terca-feira' || d === 'terça-feira') return 2;
    if (d === 'quarta' || d === 'quarta-feira') return 3;
    if (d === 'quinta' || d === 'quinta-feira') return 4;
    if (d === 'sexta' || d === 'sexta-feira') return 5;
    if (d === 'sabado' || d === 'sábado' || d === 'sabado-feira' || d === 'sábado-feira') return 6;

    // es
    if (d === 'lunes') return 1;
    if (d === 'martes') return 2;
    if (d === 'miercoles' || d === 'miércoles') return 3;
    if (d === 'jueves') return 4;
    if (d === 'viernes') return 5;

    return null;
};

const parseSemanaRange = (semanaStr) => {
    const raw = (semanaStr ?? '').toString().trim();
    if (!raw) return null;

    // pega só antes do " - " (geralmente depois vem a leitura)
    const onlyWeek = raw.split(' - ')[0].trim().replace(/[–—]/g, '-');

    // 30 de maio-5 de junho
    let m = /^(\d{1,2})\s*(?:de|del)\s*([A-Za-zÀ-ÿ]+)\s*-\s*(\d{1,2})\s*(?:de|del)\s*([A-Za-zÀ-ÿ]+)$/i.exec(onlyWeek);
    if (m) {
        return {
            startDay: Number(m[1]),
            startMonthName: m[2],
            endDay: Number(m[3]),
            endMonthName: m[4],
        };
    }

    // 4-10 de maio
    m = /^(\d{1,2})\s*-\s*(\d{1,2})\s*(?:de|del)\s*([A-Za-zÀ-ÿ]+)$/i.exec(onlyWeek);
    if (m) {
        return {
            startDay: Number(m[1]),
            startMonthName: m[3],
            endDay: Number(m[2]),
            endMonthName: m[3],
        };
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

export const getMeetingDateISOFromSemana = ({ semanaStr, config, isoFallback }) => {
    const range = parseSemanaRange(semanaStr);

    const weekdayIdx = weekdayToIndex(
        config?.dia_reuniao ??
        config?.diaReuniao ??
        config?.diaSemana ??
        config?.dia_semana ??
        config?.dia ??
        ''
    );

    // tenta inferir ano do fallback (se existir), senão ano atual
    let year = new Date().getFullYear();
    if (isoFallback && /^\d{4}-\d{2}-\d{2}$/.test(isoFallback)) {
        year = Number(isoFallback.slice(0, 4));
    } else if (Number(config?.anoProgramacao)) {
        year = Number(config.anoProgramacao);
    } else if (Number(config?.ano)) {
        year = Number(config.ano);
    }

    if (!range || weekdayIdx == null) {
        return isoFallback || null;
    }

    const mStart = monthIndexFromName(range.startMonthName);
    const mEnd = monthIndexFromName(range.endMonthName);
    if (mStart == null || mEnd == null) {
        return isoFallback || null;
    }

    const start = new Date(year, mStart, range.startDay);
    let end = new Date(year, mEnd, range.endDay);

    // se cruzar ano (ex.: dezembro -> janeiro)
    if (end.getTime() < start.getTime()) {
        end = new Date(year + 1, mEnd, range.endDay);
    }

    let cur = new Date(start);
    let found = null;
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
    return data.toLocaleDateString(lang === 'es' ? 'es-ES' : 'pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};
