// src/utils/revisarEnviar/links.js
export const buildWhatsappHref = (telefone, msg) => {
    const raw = (telefone ?? '').toString();
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const waNumber = (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
    return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
};

export const buildMailtoHref = (email, subject, body) => {
    const e = (email ?? '').toString().trim();
    if (!e) return null;
    const s = encodeURIComponent(subject || '');
    const b = encodeURIComponent(body || '');
    return `mailto:${encodeURIComponent(e)}?subject=${s}&body=${b}`;
};

const pad2 = (n) => String(n).padStart(2, '0');

const toGCalUtc = (dateObj) => {
    // YYYYMMDDTHHMMSSZ
    return [
        dateObj.getUTCFullYear(),
        pad2(dateObj.getUTCMonth() + 1),
        pad2(dateObj.getUTCDate()),
        'T',
        pad2(dateObj.getUTCHours()),
        pad2(dateObj.getUTCMinutes()),
        '00Z',
    ].join('');
};

export const parseHorario = (h) => {
    const s = (h ?? '').toString().trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return { hh: 19, mm: 30 };
    const hh = Math.max(0, Math.min(23, Number(m[1])));
    const mm = Math.max(0, Math.min(59, Number(m[2])));
    return { hh, mm };
};

export const buildAgendaLink = ({ config, semana, dataISO, tituloParte, responsavelNome, ajudanteNome }) => {
    if (!dataISO) return null;

    const duracaoMin = 105; // padrão: 1h45 (ajuste se quiser)
    const horarioCfg = config?.horarioReuniao ?? config?.horario ?? '19:30';
    const { hh, mm } = parseHorario(horarioCfg);

    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const start = new Date(ano, mes - 1, dia, hh, mm, 0);
    const end = new Date(start.getTime() + duracaoMin * 60000);

    const text = `Designação para a Reunião - ${tituloParte || semana || ''}`.trim();

    const detailsLines = [
        `Semana: ${semana || ''}`.trim(),
        '',
        `Responsável: ${responsavelNome || ''}`.trim(),
        ajudanteNome ? `Ajudante: ${ajudanteNome}` : null,
        tituloParte ? `Parte: ${tituloParte}` : null,
    ].filter(Boolean);

    const url =
        'https://calendar.google.com/calendar/render' +
        `?action=TEMPLATE` +
        `&text=${encodeURIComponent(text)}` +
        `&dates=${encodeURIComponent(`${toGCalUtc(start)}/${toGCalUtc(end)}`)}` +
        `&details=${encodeURIComponent(detailsLines.join('\n'))}` +
        `&trp=true`;

    return url;
};
