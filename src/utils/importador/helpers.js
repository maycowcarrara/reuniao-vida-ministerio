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

const DEFAULT_PROXY_TIMEOUT_MS = 12000;
const HTML_CACHE_PREFIX = 'importador:html:';

const envProxyUrl = (import.meta.env.VITE_JW_PROXY_URL || '').trim();
const envFallbackList = (import.meta.env.VITE_JW_PROXY_FALLBACKS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const DEFAULT_FETCH_SOURCES = [
    { template: envProxyUrl, contentKind: 'html' },
    ...envFallbackList.map((template) => ({
        template,
        contentKind: template.includes('r.jina.ai') ? 'text' : 'html'
    })),
    { template: 'https://proxy-jw-congregacao.maycowcarrara.workers.dev/', contentKind: 'html' },
    { template: 'https://corsproxy.io/?{url}', contentKind: 'html' },
    { template: 'https://api.allorigins.win/raw?url={url}', contentKind: 'html' },
    { template: 'https://r.jina.ai/http://{targetHostPath}', contentKind: 'text' },
].filter((item) => item.template);

const getCacheKey = (targetUrl) => `${HTML_CACHE_PREFIX}${encodeURIComponent(targetUrl)}`;

const readCachedHtml = (targetUrl) => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = window.localStorage.getItem(getCacheKey(targetUrl));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.text !== 'string' || !parsed.text.trim()) return null;
        return parsed;
    } catch {
        return null;
    }
};

const writeCachedHtml = (targetUrl, text, source, contentKind) => {
    if (typeof window === 'undefined' || !window.localStorage || !text) return;
    try {
        window.localStorage.setItem(getCacheKey(targetUrl), JSON.stringify({
            url: targetUrl,
            text,
            source,
            contentKind,
            updatedAt: Date.now(),
        }));
    } catch {
        // Ignore storage failures and keep the import flow working.
    }
};

const buildProxyUrl = (template, targetUrl) => {
    const encodedUrl = encodeURIComponent(targetUrl);
    const withoutProtocol = targetUrl.replace(/^https?:\/\//i, '');
    if (template.includes('{targetHostPath}')) return template.replace('{targetHostPath}', withoutProtocol);
    if (template.includes('{url}')) return template.replace('{url}', encodedUrl);
    if (/[?&]url=$/i.test(template)) return `${template}${encodedUrl}`;
    if (template.includes('?')) return `${template}&url=${encodedUrl}`;
    return `${template}?url=${encodedUrl}`;
};

const getProxyLabel = (template, index) => {
    try {
        return new URL(buildProxyUrl(template, 'https://www.jw.org')).host;
    } catch {
        return `proxy-${index + 1}`;
    }
};

const buildProxyCandidates = (targetUrl) => {
    const seen = new Set();
    return DEFAULT_FETCH_SOURCES.reduce((acc, source, index) => {
        const requestUrl = buildProxyUrl(source.template, targetUrl);
        if (seen.has(requestUrl)) return acc;
        seen.add(requestUrl);
        acc.push({
            label: getProxyLabel(source.template, index),
            requestUrl,
            contentKind: source.contentKind,
        });
        return acc;
    }, []);
};

const isValidHtmlPayload = (text) => {
    const sample = (text || '').trim();
    if (sample.length < 80) return false;
    const head = sample.slice(0, 2500).toLowerCase();
    return (
        head.includes('<html') ||
        head.includes('<!doctype html') ||
        head.includes('<body') ||
        head.includes('<article') ||
        head.includes('jw.org')
    );
};

const isValidTextPayload = (text) => {
    const sample = (text || '').trim();
    if (sample.length < 80) return false;
    const head = sample.slice(0, 4000).toLowerCase();
    return (
        head.includes('markdown content:') ||
        head.includes('programação da reunião vida e ministério') ||
        head.includes('apostila da reunião vida e ministério') ||
        head.includes('guía de actividades') ||
        head.includes('nuestra vida cristiana')
    );
};

const fetchWithTimeout = async (requestUrl, { signal, timeoutMs }) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    const abortFromParent = () => controller.abort(signal?.reason || new Error('aborted'));

    if (signal) signal.addEventListener('abort', abortFromParent, { once: true });

    try {
        return await fetch(requestUrl, {
            signal: controller.signal,
            headers: {
                Accept: 'text/html,application/xhtml+xml'
            }
        });
    } finally {
        window.clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', abortFromParent);
    }
};

export const fetchHtmlViaProxy = async (targetUrl, { signal } = {}) => {
    const attempts = [];
    const cached = readCachedHtml(targetUrl);

    for (const candidate of buildProxyCandidates(targetUrl)) {
        try {
            const response = await fetchWithTimeout(candidate.requestUrl, {
                signal,
                timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
            });

            if (!response.ok) throw new Error(`status ${response.status}`);

            const text = await response.text();
            const payloadOk = candidate.contentKind === 'html'
                ? isValidHtmlPayload(text)
                : isValidTextPayload(text);
            if (!payloadOk) throw new Error('payload inválido');

            writeCachedHtml(targetUrl, text, candidate.label, candidate.contentKind);
            return {
                ok: true,
                status: response.status,
                text,
                contentKind: candidate.contentKind,
                source: candidate.label,
                stale: false,
                attempts,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'erro desconhecido';
            attempts.push({ source: candidate.label, message });
            console.warn(`Falha ao buscar ${targetUrl} via ${candidate.label}:`, err);
        }
    }

    if (cached?.text) {
        return {
            ok: true,
            status: 200,
            text: cached.text,
            contentKind: cached.contentKind || 'html',
            source: cached.source || 'cache',
            stale: true,
            cachedAt: cached.updatedAt || null,
            attempts,
        };
    }

    return {
        ok: false,
        status: 0,
        text: null,
        contentKind: null,
        stale: false,
        attempts,
    };
};

export const proxyUrl = (u) => buildProxyCandidates(u)[0]?.requestUrl || '';
