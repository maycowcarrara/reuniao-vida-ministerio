const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateEmailHtml(params) {
  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const nome = escapeHtml(params.Nome || '—');
  const ajudante = escapeHtml(params.Ajudante || '—');
  const data = escapeHtml(params.Data || '—');
  const desig = escapeHtml(params.Desig || '—');
  const sala = escapeHtml(params.Sala || 'Principal');
  const linkConfirmar = params.LinkConfirmar ? escapeHtml(params.LinkConfirmar) : '';
  const linkRecusar = params.LinkRecusar ? escapeHtml(params.LinkRecusar) : '';
  const linkAgenda = params.LinkAgenda ? escapeHtml(params.LinkAgenda) : '';
  const linkConfirmacao = params.LinkConfirmacao || params.Link ? escapeHtml(params.LinkConfirmacao || params.Link) : '';

  const botoesAcao = (linkConfirmar || linkRecusar)
    ? `<div style="text-align: center; margin-bottom: 12px;">
        ${linkConfirmar ? `<a href="${linkConfirmar}" target="_blank" style="background-color: #15803d; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-family: ${fontStack}; font-size: 14px; font-weight: 700; display: inline-block; margin: 4px 6px; box-shadow: 0 2px 4px rgba(21, 128, 61, 0.25);">✅ Aceitar designação</a>` : ''}
        ${linkRecusar ? `<a href="${linkRecusar}" target="_blank" style="background-color: #b91c1c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-family: ${fontStack}; font-size: 14px; font-weight: 700; display: inline-block; margin: 4px 6px; box-shadow: 0 2px 4px rgba(185, 28, 28, 0.25);">❌ Não poderei cumprir</a>` : ''}
      </div>`
    : '';

  const botaoAgenda = linkAgenda
    ? `<div style="text-align: center; margin-bottom: 12px;">
        <a href="${linkAgenda}" target="_blank" style="background-color: #f8fafc; color: #1e3a8a; border: 1.5px solid #cbd5e1; padding: 10px 22px; text-decoration: none; border-radius: 8px; font-family: ${fontStack}; font-size: 13.5px; font-weight: 600; display: inline-block;">📅 Salvar na Agenda Google</a>
      </div>`
    : '';

  const linkDetalhes = linkConfirmacao
    ? `<div style="text-align: center; margin-top: 10px;">
        <a href="${linkConfirmacao}" target="_blank" style="font-family: ${fontStack}; font-size: 13px; color: #64748b; text-decoration: underline;">
          🔗 Ver detalhes e programação completa
        </a>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Designação para a Reunião</title>
  <style>
    body, table, td, p, a, div { font-family: ${fontStack} !important; }
  </style>
</head>
<body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: ${fontStack}; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; padding: 24px 20px; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); font-family: ${fontStack};">
    
    <!-- QUADRO DA DESIGNAÇÃO (S-89 MODERNIZADO) -->
    <div style="border: 2px solid #334155; border-radius: 10px; overflow: hidden; background-color: #ffffff; font-family: ${fontStack};">
      
      <!-- Cabeçalho S-89 -->
      <div style="text-align: center; padding: 16px 14px; background-color: #f8fafc; border-bottom: 2px solid #334155; font-family: ${fontStack};">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.2px; color: #475569; text-transform: uppercase; font-family: ${fontStack};">
          DESIGNAÇÃO PARA A REUNIÃO
        </div>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; letter-spacing: -0.2px; font-family: ${fontStack};">
          NOSSA VIDA E MINISTÉRIO CRISTÃO
        </div>
      </div>

      <!-- Dados da Designação -->
      <div style="padding: 16px 18px; font-family: ${fontStack};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 15px; border-collapse: collapse; font-family: ${fontStack};">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; width: 130px; vertical-align: top; font-family: ${fontStack};">
              Nome:
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 700; font-size: 16px; font-family: ${fontStack};">
              ${nome}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; vertical-align: top; font-family: ${fontStack};">
              Ajudante:
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 600; font-family: ${fontStack};">
              ${ajudante}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; vertical-align: top; font-family: ${fontStack};">
              Data:
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 700; font-family: ${fontStack};">
              ${data}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; vertical-align: top; font-family: ${fontStack};">
              Número da parte:
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #1e40af; font-weight: 700; font-style: italic; font-family: ${fontStack};">
              ${desig}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 14px; vertical-align: top; font-family: ${fontStack};">
              Sala:
            </td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 700; font-style: italic; font-family: ${fontStack};">
              ${sala}
            </td>
          </tr>
        </table>

        <!-- Observação para o estudante -->
        <div style="margin-top: 16px; padding: 12px 14px; background-color: #f8fafc; border-left: 3.5px solid #2563eb; border-radius: 6px; font-size: 13.5px; line-height: 1.5; color: #334155; font-family: ${fontStack};">
          <strong style="color: #0f172a; font-style: italic; font-family: ${fontStack};">Observação para o estudante:</strong>
          a lição e a fonte de matéria para a sua designação estão na
          <em><a href="https://wol.jw.org/pt/wol/library/r5/lp-t/todas-as-publica%C3%A7%C3%B5es/apostilas" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: underline; font-family: ${fontStack};">Apostila da Reunião Vida e Ministério</a></em>.
          Veja as instruções para a parte nas
          <i><a href="https://www.jw.org/finder?srcid=jwlshare&amp;wtlocale=T&amp;prefer=lang&amp;pub=S-38" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: underline; font-family: ${fontStack};">Instruções para a Reunião (S-38)</a></i>.
        </div>
      </div>
    </div>

    <!-- BOTÕES DE AÇÃO (FICAM EMBAIXO DA DESIGNAÇÃO) -->
    <div style="margin-top: 24px; text-align: center; font-family: ${fontStack};">
      ${botoesAcao}
      ${botaoAgenda}
      ${linkDetalhes}
    </div>

    <!-- RODAPÉ -->
    <p style="text-align: center; font-size: 12px; color: #94a3b8; margin: 24px 0 0 0; line-height: 1.5; font-family: ${fontStack};">
      Mensagem automática. Dúvidas entre em contato com o sup. da Reunião Vida e Ministério.
    </p>

  </div>
</body>
</html>`;
}

async function handleSendEmail(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Metodo nao permitido para envio de e-mail. Use POST.' });
  }

  const apiKey = String(env?.BREVO_API_KEY || '').trim();
  if (!apiKey) {
    return jsonResponse(500, {
      ok: false,
      error: 'Configuração do Brevo ausente: defina o secret BREVO_API_KEY no Cloudflare Worker.',
    });
  }

  if (apiKey.startsWith('xsmtpsib-')) {
    return jsonResponse(400, {
      ok: false,
      error: 'A chave configurada (iniciada com xsmtpsib-) é uma chave SMTP, não uma chave de API REST. No Brevo, acesse SMTP & API > aba "API Keys" (não a aba SMTP) e gere uma chave de API (que começa com xkeysib-).',
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, error: 'Corpo da requisição inválido (esperado JSON).' });
  }

  const recipientEmail = String(body?.email_destino || body?.to || '').trim();
  if (!recipientEmail) {
    return jsonResponse(400, { ok: false, error: 'E-mail do destinatário (email_destino) não informado.' });
  }

  const senderEmail = String(env?.BREVO_SENDER_EMAIL || body?.sender_email || '').trim();
  if (!senderEmail) {
    return jsonResponse(500, {
      ok: false,
      error: 'E-mail do remetente ausente: defina a variável BREVO_SENDER_EMAIL no Cloudflare Worker.',
    });
  }

  const senderName = String(env?.BREVO_SENDER_NAME || body?.sender_name || 'Reunião Vida e Ministério').trim();

  const params = {
    Nome: String(body?.Nome || '—').trim(),
    Ajudante: String(body?.Ajudante || '—').trim(),
    Data: String(body?.Data || '—').trim(),
    Desig: String(body?.Desig || '—').trim(),
    Sala: String(body?.Sala || 'Principal').trim(),
    Link: String(body?.Link || body?.LinkConfirmacao || '').trim(),
    LinkConfirmacao: String(body?.LinkConfirmacao || body?.Link || '').trim(),
    LinkConfirmar: String(body?.LinkConfirmar || '').trim(),
    LinkRecusar: String(body?.LinkRecusar || '').trim(),
    LinkAgenda: String(body?.LinkAgenda || '').trim(),
  };

  const recipientName = params.Nome && params.Nome !== '—' ? params.Nome : undefined;

  let brevoPayload;
  const templateId = env?.BREVO_TEMPLATE_ID ? Number(env.BREVO_TEMPLATE_ID) : (body?.templateId ? Number(body.templateId) : null);

  if (templateId && !Number.isNaN(templateId)) {
    brevoPayload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: recipientEmail, ...(recipientName ? { name: recipientName } : {}) }],
      templateId,
      params,
    };
  } else {
    brevoPayload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: recipientEmail, ...(recipientName ? { name: recipientName } : {}) }],
      subject: String(body?.subject || '').trim() || `Designação: Reunião Vida e Ministério - ${params.Data}`,
      htmlContent: generateEmailHtml(params),
      params,
    };
  }

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(brevoPayload),
    });

    const resJson = await brevoResponse.json().catch(() => ({}));

    if (!brevoResponse.ok) {
      const errorMsg = resJson?.message || `Brevo retornou status ${brevoResponse.status}`;
      return jsonResponse(brevoResponse.status, {
        ok: false,
        error: errorMsg,
        details: resJson,
      });
    }

    return jsonResponse(200, {
      ok: true,
      messageId: resJson?.messageId || null,
    });
  } catch (error) {
    return jsonResponse(502, {
      ok: false,
      error: 'Erro de comunicação ao enviar e-mail pelo Brevo: ' + (error instanceof Error ? error.message : String(error)),
    });
  }
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
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === '/send-email' || requestUrl.pathname === '/api/send-email') {
      return handleSendEmail(request, env);
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
