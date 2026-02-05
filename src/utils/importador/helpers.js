export const normalizar = (s) =>
    (s || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

export const isLikelyUrl = (v) => /^https?:\/\/\S+/i.test((v || '').trim());

export const isLikelyHtml = (v) => /^\s*<!doctype html|^\s*<html[\s>]/i.test((v || '').trim());

export const formatHm = (mins) => {
    const m = Math.max(0, parseInt(mins, 10) || 0);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}:${String(mm).padStart(2, '0')}`;
};

// --- SEU WORKER EXCLUSIVO ---
// Substitua pela URL que você copiou do Cloudflare
const MY_WORKER_URL = "https://proxy-jw-congregacao.maycowcarrara.workers.dev/";

export const fetchHtmlViaProxy = async (targetUrl, { signal } = {}) => {
    try {
        const urlFinal = `${MY_WORKER_URL}?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(urlFinal, { signal });

        if (!response.ok) throw new Error(`Worker status: ${response.status}`);

        const text = await response.text();
        if (!text || text.length < 100) throw new Error('Worker retornou vazio');

        return { ok: true, status: 200, text };

    } catch (err) {
        console.error("Erro no Worker:", err);
        // Fallback final: Tenta corsproxy.io se o seu worker falhar (raro)
        try {
            const fallback = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            const res2 = await fetch(fallback, { signal });
            if (!res2.ok) throw new Error('Fallback failed');
            const txt2 = await res2.text();
            return { ok: true, status: 200, text: txt2 };
        } catch (e) {
            return { ok: false, status: 0, text: null };
        }
    }
};

export const proxyUrl = (u) => `${MY_WORKER_URL}?url=${encodeURIComponent(u)}`;