// 🔒 Puxando as chaves de forma segura do arquivo .env
const normalizeEnvValue = (value) => String(value ?? '').trim();

const EMAIL_SERVICE_URL = normalizeEnvValue(import.meta.env.VITE_EMAIL_SERVICE_URL);
const EMAILJS_SERVICE_ID = normalizeEnvValue(import.meta.env.VITE_EMAILJS_SERVICE_ID);
const EMAILJS_TEMPLATE_ID = normalizeEnvValue(import.meta.env.VITE_EMAILJS_TEMPLATE_ID);
const EMAILJS_PUBLIC_KEY = normalizeEnvValue(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);

export const getEmailProvider = () => {
    if (EMAIL_SERVICE_URL) {
        return 'brevo_worker';
    }
    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
        return 'emailjs';
    }
    return 'none';
};

export const getEmailJsMissingConfig = () => {
    const provider = getEmailProvider();
    if (provider !== 'none') {
        return [];
    }

    const missing = [];
    if (!EMAIL_SERVICE_URL && !EMAILJS_SERVICE_ID) {
        missing.push('VITE_EMAIL_SERVICE_URL (Brevo) ou chaves EmailJS');
    } else if (!EMAIL_SERVICE_URL) {
        if (!EMAILJS_SERVICE_ID) missing.push('VITE_EMAILJS_SERVICE_ID');
        if (!EMAILJS_TEMPLATE_ID) missing.push('VITE_EMAILJS_TEMPLATE_ID');
        if (!EMAILJS_PUBLIC_KEY) missing.push('VITE_EMAILJS_PUBLIC_KEY');
    }

    return missing;
};

export const isEmailJsConfigured = () => getEmailJsMissingConfig().length === 0;

let emailJsModulePromise;
const loadEmailJs = async () => {
    if (!emailJsModulePromise) {
        emailJsModulePromise = import('@emailjs/browser');
    }
    return emailJsModulePromise;
};

export const enviarEmailAutomatico = async (payload) => {
    // Validação de segurança: se não tem e-mail, não tenta enviar
    if (!payload?.email_destino) {
        throw new Error("Aluno não possui e-mail cadastrado.");
    }

    const provider = getEmailProvider();
    if (provider === 'none') {
        const missingConfig = getEmailJsMissingConfig();
        throw new Error(`Configuração de e-mail ausente: ${missingConfig.join(', ')}`);
    }

    // Mapeamento das variáveis para envio
    const templateParams = {
        Nome: payload.Nome || "—",
        Ajudante: payload.Ajudante || "—",
        Data: payload.Data || "—",
        Desig: payload.Desig || "—",
        Sala: payload.Sala || "Principal",
        Link: payload.Link || payload.LinkConfirmacao || "",
        LinkConfirmacao: payload.LinkConfirmacao || payload.Link || "",
        LinkConfirmar: payload.LinkConfirmar || "",
        LinkRecusar: payload.LinkRecusar || "",
        LinkAgenda: payload.LinkAgenda || "",
        email_destino: payload.email_destino
    };

    if (provider === 'brevo_worker') {
        try {
            const resposta = await fetch(EMAIL_SERVICE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(templateParams)
            });

            if (!resposta.ok) {
                const errData = await resposta.json().catch(() => ({}));
                throw new Error(errData?.error || `Falha no envio de e-mail (${resposta.status})`);
            }

            const data = await resposta.json().catch(() => ({}));
            return data?.ok !== false;
        } catch (erro) {
            console.error("Erro ao enviar e-mail via Brevo Worker:", erro);
            throw erro;
        }
    }

    // Envio legado via EmailJS
    try {
        const emailjs = await loadEmailJs();
        const resposta = await emailjs.default.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams,
            EMAILJS_PUBLIC_KEY
        );
        return resposta.status === 200;
    } catch (erro) {
        console.error("Erro ao enviar e-mail via EmailJS:", erro);
        throw erro;
    }
};
