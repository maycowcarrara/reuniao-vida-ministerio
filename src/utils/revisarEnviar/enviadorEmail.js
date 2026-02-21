import emailjs from '@emailjs/browser';

// ⚠️ Substitua por suas chaves do painel do EmailJS
const EMAILJS_SERVICE_ID = 'service_4d8dhmn';
const EMAILJS_TEMPLATE_ID = 'template_5pwkzpm';
const EMAILJS_PUBLIC_KEY = 'phZazVled2m73w2RW';

export const enviarEmailAutomatico = async (designacao) => {
    // Validação básica
    if (!designacao?.aluno?.email) {
        throw new Error("Aluno não possui e-mail cadastrado.");
    }

    // Prepara o texto do ajudante, se houver
    let textoAjudante = '';
    if (designacao.ajudante) {
        textoAjudante = `Ajudante: ${designacao.ajudante.nome}`;
    }

    // Variáveis que vão substituir os {{}} lá no template do EmailJS
    const templateParams = {
        nome_aluno: designacao.aluno.nome,
        email_destino: designacao.aluno.email, // O EmailJS precisa saber pra quem mandar
        data_reuniao: designacao.dataReuniaoFormatada, // Ex: 15/08/2024
        nome_parte: designacao.parteTitulo, // Ex: Leitura da Bíblia
        sala: designacao.sala || "Principal",
        texto_ajudante: textoAjudante
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