import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Brevo Worker: recusa requisições GET ou sem método POST na rota de e-mail', async () => {
    const { default: worker } = await import('../workers/jw-proxy/src/index.js');
    const res = await worker.fetch(new Request('https://proxy.local/api/send-email', { method: 'GET' }), {});
    assert.equal(res.status, 405);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /Metodo nao permitido/i);
});

test('Brevo Worker: retorna 500 quando BREVO_API_KEY não está configurada', async () => {
    const { default: worker } = await import('../workers/jw-proxy/src/index.js');
    const res = await worker.fetch(new Request('https://proxy.local/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_destino: 'irmao@teste.com' })
    }), {});
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.match(body.error, /BREVO_API_KEY/i);
});

test('Brevo Worker: recusa chave SMTP (xsmtpsib-) e orienta a usar chave REST (xkeysib-)', async () => {
    const { default: worker } = await import('../workers/jw-proxy/src/index.js');
    const res = await worker.fetch(new Request('https://proxy.local/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_destino: 'irmao@teste.com' })
    }), { BREVO_API_KEY: 'xsmtpsib-invalid-smtp-key' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /chave SMTP/i);
});

test('Brevo Worker: retorna 400 quando email_destino está ausente', async () => {
    const { default: worker } = await import('../workers/jw-proxy/src/index.js');
    const res = await worker.fetch(new Request('https://proxy.local/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Nome: 'Irmão Teste' })
    }), { BREVO_API_KEY: 'xkeysib-teste' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /email_destino/i);
});

test('Brevo Worker: retorna 500 quando BREVO_SENDER_EMAIL está ausente', async () => {
    const { default: worker } = await import('../workers/jw-proxy/src/index.js');
    const res = await worker.fetch(new Request('https://proxy.local/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_destino: 'irmao@teste.com', Nome: 'Irmão Teste' })
    }), { BREVO_API_KEY: 'xkeysib-teste' });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.match(body.error, /BREVO_SENDER_EMAIL/i);
});

test('Brevo Worker: envia com HTML embutido e cabeçalhos corretos quando templateId não é configurado', async () => {
    const { default: worker } = await import('../workers/jw-proxy/src/index.js');
    const originalFetch = globalThis.fetch;
    const chamadas = [];

    globalThis.fetch = async (url, options) => {
        chamadas.push({ url: String(url), options });
        return new Response(JSON.stringify({ messageId: 'msg-brevo-123' }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    };

    try {
        const res = await worker.fetch(new Request('https://proxy.local/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email_destino: 'irmao@teste.com',
                Nome: 'Irmão Teste',
                Desig: 'Leitura da Bíblia',
                Data: '15/11/2026',
                Sala: 'Principal',
                LinkConfirmar: 'https://app.local/confirmar',
                LinkRecusar: 'https://app.local/recusar'
            })
        }), {
            BREVO_API_KEY: 'xkeysib-secret-key-123',
            BREVO_SENDER_EMAIL: 'remetente@congregacao.com',
            BREVO_SENDER_NAME: 'Congregação Teste'
        });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.ok, true);
        assert.equal(body.messageId, 'msg-brevo-123');

        assert.equal(chamadas.length, 1);
        assert.equal(chamadas[0].url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(chamadas[0].options.headers['api-key'], 'xkeysib-secret-key-123');

        const payloadEnviado = JSON.parse(chamadas[0].options.body);
        assert.equal(payloadEnviado.sender.email, 'remetente@congregacao.com');
        assert.equal(payloadEnviado.sender.name, 'Congregação Teste');
        assert.equal(payloadEnviado.to[0].email, 'irmao@teste.com');
        assert.equal(payloadEnviado.to[0].name, 'Irmão Teste');
        assert.match(payloadEnviado.htmlContent, /Leitura da B&iacute;blia|Leitura da Bíblia/);
        assert.match(payloadEnviado.htmlContent, /Aceitar designa/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Brevo Worker: envia com templateId quando configurado no ambiente', async () => {
    const { default: worker } = await import('../workers/jw-proxy/src/index.js');
    const originalFetch = globalThis.fetch;
    const chamadas = [];

    globalThis.fetch = async (url, options) => {
        chamadas.push({ url: String(url), options });
        return new Response(JSON.stringify({ messageId: 'msg-brevo-template-999' }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    };

    try {
        const res = await worker.fetch(new Request('https://proxy.local/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email_destino: 'aluno@teste.com',
                Nome: 'Estudante',
                Data: '22/11/2026'
            })
        }), {
            BREVO_API_KEY: 'xkeysib-key',
            BREVO_SENDER_EMAIL: 'remetente@congregacao.com',
            BREVO_TEMPLATE_ID: '42'
        });

        assert.equal(res.status, 200);
        assert.equal(chamadas.length, 1);
        const payloadEnviado = JSON.parse(chamadas[0].options.body);
        assert.equal(payloadEnviado.templateId, 42);
        assert.equal(payloadEnviado.params.Nome, 'Estudante');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Frontend Enviador: valida presença de email_destino', async () => {
    const { createServer } = await import('vite');
    const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    try {
        const { enviarEmailAutomatico } = await server.ssrLoadModule('/src/utils/revisarEnviar/enviadorEmail.js');
        await assert.rejects(enviarEmailAutomatico({}), /Aluno não possui e-mail cadastrado/);
    } finally {
        await server.close();
    }
});
