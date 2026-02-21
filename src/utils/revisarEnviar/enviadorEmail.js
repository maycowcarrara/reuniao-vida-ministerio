import emailjs from '@emailjs/browser';

// ⚠️ Substitua por suas chaves do painel do EmailJS
const EMAILJS_SERVICE_ID = 'service_4d8dhmn';
const EMAILJS_TEMPLATE_ID = 'template_5pwkzpm';
const EMAILJS_PUBLIC_KEY = 'phZazVled2m73w2RW';

export const enviarEmailAutomatico = async (payload) => {
    // Validação de segurança: se não tem e-mail, não tenta enviar
    if (!payload?.email_destino) {
        throw new Error("Aluno não possui e-mail cadastrado.");
    }

    // Mapeamento EXATO das variáveis que estão no seu HTML ({{Nome}}, {{Data}}, etc)
    const templateParams = {
        Nome: payload.Nome || "—",
        Ajudante: payload.Ajudante || "—",
        Data: payload.Data || "—",
        Desig: payload.Desig || "—",
        Sala: payload.Sala || "Principal",
        Link: payload.Link || "",
        email_destino: payload.email_destino
    };

    try {
        const resposta = await emailjs.send(
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