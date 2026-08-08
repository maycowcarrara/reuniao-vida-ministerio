const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const ALLOWED_HOSTS = new Set(['jw.org']);

function isAllowedHost(hostname) {
  const normalized = String(hostname || '').toLowerCase();
  return ALLOWED_HOSTS.has(normalized) || normalized.endsWith('.jw.org');
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function resolveTargetUrl(requestUrl) {
  const url = new URL(requestUrl);
  const target = url.searchParams.get('url');

  if (!target) {
    throw new Error('Parametro url ausente.');
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error('Parametro url invalido.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Apenas URLs HTTPS sao permitidas.');
  }

  if (!isAllowedHost(parsed.hostname)) {
    throw new Error('Dominio nao permitido.');
  }

  parsed.hash = '';
  return parsed;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (!['GET', 'HEAD', 'POST'].includes(request.method)) {
      return jsonResponse(405, { ok: false, error: 'Metodo nao permitido.' });
    }

    let targetUrl;
    try {
      targetUrl = resolveTargetUrl(request.url);
    } catch (error) {
      return jsonResponse(400, { ok: false, error: error.message });
    }

    try {
      const headers = new Headers();
      headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
      headers.set('Accept-Language', 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7');
      headers.set('Referer', 'https://www.jw.org/');
      headers.set('Upgrade-Insecure-Requests', '1');
      headers.set('Sec-Ch-Ua', '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"');
      headers.set('Sec-Ch-Ua-Mobile', '?0');
      headers.set('Sec-Ch-Ua-Platform', '"Windows"');
      headers.set('Sec-Fetch-Dest', 'document');
      headers.set('Sec-Fetch-Mode', 'navigate');
      headers.set('Sec-Fetch-Site', 'none');
      headers.set('Sec-Fetch-User', '?1');

      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
      });

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=900',
          ...CORS_HEADERS,
        },
      });
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Falha ao buscar JW via proxy.',
        targetHost: targetUrl.hostname,
        error: error instanceof Error ? error.message : String(error),
      }));

      return jsonResponse(502, {
        ok: false,
        error: 'Nao foi possivel buscar a pagina no momento.',
      });
    }
  },
};
