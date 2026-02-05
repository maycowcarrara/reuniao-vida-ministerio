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

// --- ESTRATÉGIA ROBUSTA DE PROXY (3 CAMADAS) ---

export const fetchHtmlViaProxy = async (targetUrl, { signal } = {}) => {
    
    // TENTATIVA 1: AllOrigins (Retorna JSON)
    // Geralmente o mais seguro contra CORS, mas às vezes dá Timeout (408).
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl, { signal });
        
        if (!response.ok) throw new Error(`AllOrigins status: ${response.status}`);
        
        const data = await response.json();
        if (!data.contents) throw new Error('AllOrigins returned empty contents');
        
        return { ok: true, status: 200, text: data.contents };

    } catch (err1) {
        console.warn("AllOrigins falhou, tentando CodeTabs...", err1);

        // TENTATIVA 2: CodeTabs (Retorna Texto Puro)
        // Muito robusto, costuma funcionar quando AllOrigins cai.
        try {
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
            const response2 = await fetch(proxyUrl2, { signal });
            
            if (!response2.ok) throw new Error(`CodeTabs status: ${response2.status}`);
            
            const text = await response2.text();
            if (!text || text.length < 50) throw new Error('CodeTabs returned empty/short text');

            return { ok: true, status: 200, text };

        } catch (err2) {
            console.warn("CodeTabs falhou, tentando CorsProxy...", err2);

            // TENTATIVA 3: CorsProxy.io (Retorna Texto Puro)
            // Último recurso, pois costuma bloquear domínios .web.app frequentemente.
            try {
                const proxyUrl3 = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
                const response3 = await fetch(proxyUrl3, { signal });
                
                if (!response3.ok) throw new Error(`CorsProxy status: ${response3.status}`);
                
                const text = await response3.text();
                return { ok: true, status: 200, text };

            } catch (err3) {
                console.error("CRÍTICO: Todos os proxies falharam.", err3);
                return { ok: false, status: 0, text: null };
            }
        }
    }
};

// Mantemos o export do proxyUrl simples caso seja usado em outro lugar, 
// mas apontando para o CodeTabs que é mais permissivo hoje.
export const proxyUrl = (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`;