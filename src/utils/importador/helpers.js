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

// --- NOVA LÓGICA DE PROXY ---

export const fetchHtmlViaProxy = async (targetUrl, { signal } = {}) => {
    // 1. Tenta ALLORIGINS (Retorna JSON com campo 'contents') - Geralmente mais estável
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl, { signal });
        
        if (!response.ok) throw new Error(`AllOrigins status: ${response.status}`);
        
        const data = await response.json();
        if (!data.contents) throw new Error('AllOrigins returned empty contents');
        
        return { ok: true, status: 200, text: data.contents };

    } catch (err1) {
        console.warn("AllOrigins falhou, tentando fallback (corsproxy)...", err1);

        // 2. Fallback: CORSPROXY.IO (Retorna raw HTML)
        try {
            const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            const response2 = await fetch(proxyUrl2, { signal });
            
            if (!response2.ok) throw new Error(`CorsProxy status: ${response2.status}`);
            
            const text = await response2.text();
            return { ok: true, status: 200, text };

        } catch (err2) {
            console.error("Todos os proxies falharam.", err2);
            return { ok: false, status: 0, text: null };
        }
    }
};