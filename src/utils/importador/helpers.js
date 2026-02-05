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

// --- ESTRATÉGIA DE PROXY OTIMIZADA ---

export const fetchHtmlViaProxy = async (targetUrl, { signal } = {}) => {
    const encoded = encodeURIComponent(targetUrl);
    // Adiciona timestamp para evitar cache do proxy
    const stamp = Date.now();

    // TENTATIVA 1: AllOrigins em modo RAW (Mais rápido que JSON)
    try {
        // disableCache=true e timestamp forçam uma nova requisição
        const proxyUrl = `https://api.allorigins.win/raw?url=${encoded}&disableCache=true&_=${stamp}`;
        const response = await fetch(proxyUrl, { signal });

        if (!response.ok) throw new Error(`AllOrigins Raw status: ${response.status}`);

        const text = await response.text();
        if (!text || text.length < 100) throw new Error('AllOrigins returned empty content');

        return { ok: true, status: 200, text };

    } catch (err1) {
        console.warn("AllOrigins Raw falhou, tentando ThingProxy...", err1);

        // TENTATIVA 2: ThingProxy (Livre e robusto)
        try {
            const proxyUrl2 = `https://thingproxy.freeboard.io/fetch/${targetUrl}`;
            const response2 = await fetch(proxyUrl2, { signal });

            if (!response2.ok) throw new Error(`ThingProxy status: ${response2.status}`);

            const text = await response2.text();
            return { ok: true, status: 200, text };

        } catch (err2) {
            console.warn("ThingProxy falhou, tentando CorsProxy...", err2);

            // TENTATIVA 3: CorsProxy.io
            try {
                const proxyUrl3 = `https://corsproxy.io/?${encoded}`;
                const response3 = await fetch(proxyUrl3, { signal });

                if (!response3.ok) throw new Error(`CorsProxy status: ${response3.status}`);

                const text = await response3.text();
                return { ok: true, status: 200, text };

            } catch (err3) {
                console.error("CRÍTICO: Todos os proxies falharam.", err3);
                // Retorna erro para a UI tratar
                return { ok: false, status: 0, text: null };
            }
        }
    }
};

// Export simples para compatibilidade
export const proxyUrl = (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;