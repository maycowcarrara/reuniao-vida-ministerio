import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export const sincronizarAgendaGoogle = async (reunioes, configuracoes) => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    
    // Pede permissão específica para ler/escrever na Agenda do Google
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    // Força a tela de consentimento para garantir que pegaremos o token fresco
    provider.setCustomParameters({ prompt: 'consent' });

    try {
        // 1. Autenticação e resgate do Token
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential.accessToken;

        if (!token) throw new Error("Não foi possível obter o token de acesso da Google.");

        let eventosCriados = 0;
        const horarioPadrao = configuracoes?.horario || "19:30";

        // 2. Loop pelas semanas
        for (const reuniao of reunioes) {
            if (!reuniao.dataReuniao || !reuniao.partes) continue;

            // Transforma "2026-03-02" e "19:30" em uma Data JavaScript real
            const [hora, minuto] = horarioPadrao.split(':');
            let dataHoraAtual = new Date(`${reuniao.dataReuniao}T${hora}:${minuto}:00`);

            // 3. Loop pelas partes daquela semana
            for (const parte of reuniao.partes) {
                const duracao = parseInt(parte.tempo || "5", 10);
                const dataHoraFim = new Date(dataHoraAtual.getTime() + (duracao * 60000));

                // Se não tem ninguém designado, apenas avança o relógio e pula para a próxima parte (ex: cântico)
                if (!parte.estudante && !parte.oracao && !parte.leitor && !parte.dirigente) {
                    dataHoraAtual = dataHoraFim;
                    continue;
                }

                // Extrai quem vai fazer a parte
                let pessoa = parte.estudante?.nome || parte.oracao?.nome || parte.leitor?.nome || parte.dirigente?.nome || "Designado";
                let ajudanteStr = parte.ajudante?.nome ? ` (com ${parte.ajudante.nome})` : '';

                // Monta o Evento no padrão que o Google Agenda exige
                const eventoGoogle = {
                    summary: `[RVM] ${parte.titulo} - ${pessoa}${ajudanteStr}`,
                    description: `${parte.descricao || ''}\n\nGerado pelo Gerenciador RVM.`,
                    start: {
                        dateTime: dataHoraAtual.toISOString(),
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Pega o fuso horário local
                    },
                    end: {
                        dateTime: dataHoraFim.toISOString(),
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    },
                    colorId: "9" // Azul (para destacar na agenda)
                };

                // Envia para a API do Google Calendar
                await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(eventoGoogle)
                });

                eventosCriados++;
                // Avança o relógio para que a próxima parte comece exatamente quando essa terminar
                dataHoraAtual = dataHoraFim; 
            }
        }

        return { sucesso: true, quantidade: eventosCriados };

    } catch (error) {
        console.error("Erro ao sincronizar com Google Agenda:", error);
        return { sucesso: false, erro: error.message };
    }
};