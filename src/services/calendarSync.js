import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

// 1. Função para Autenticar e pegar os Calendários do usuário
export const iniciarSincronizacao = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    provider.addScope('https://www.googleapis.com/auth/calendar.readonly'); // Necessário para ler a lista de agendas
    //provider.setCustomParameters({ prompt: 'consent' });

    // 🔥 O SEGREDO ESTÁ AQUI: Diz pro Google usar a mesma conta que já está logada no Firebase
    if (auth.currentUser && auth.currentUser.email) {
        provider.setCustomParameters({ login_hint: auth.currentUser.email });
    }

    try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential.accessToken;

        if (!token) throw new Error("Não foi possível obter o token de acesso.");

        // Busca as agendas disponíveis na conta do Google logada
        const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (!data.items) throw new Error("Nenhum calendário encontrado na sua conta.");

        // Retorna o token e a lista limpa de calendários para a interface montar o select
        return {
            sucesso: true,
            token,
            calendarios: data.items.map(cal => ({
                id: cal.id,
                nome: cal.summaryOverride || cal.summary,
                principal: cal.primary || false
            }))
        };

    } catch (error) {
        console.error("Erro ao conectar com Google Agenda:", error);
        return { sucesso: false, erro: error.message };
    }
};

// 2. Função que pega a escolha do usuário e envia os eventos
export const enviarEventosParaAgenda = async (token, calendarId, reunioes, configuracoes) => {
    try {
        let eventosCriados = 0;
        const horarioPadrao = configuracoes?.horario || "19:30";

        for (const reuniao of reunioes) {
            // MÁGICA 1: Agora usamos a dataExata (Quarta, Quinta) calculada lá na interface!
            if (!reuniao.dataExata || !reuniao.partes) continue;

            const [hora, minuto] = horarioPadrao.split(':');
            let dataHoraAtual = new Date(`${reuniao.dataExata}T${hora}:${minuto}:00`);

            for (const parte of reuniao.partes) {
                const duracao = parseInt(parte.tempo || "5", 10);
                const dataHoraFim = new Date(dataHoraAtual.getTime() + (duracao * 60000));

                if (!parte.estudante && !parte.oracao && !parte.leitor && !parte.dirigente) {
                    dataHoraAtual = dataHoraFim;
                    continue;
                }

                let pessoa = parte.estudante?.nome || parte.oracao?.nome || parte.leitor?.nome || parte.dirigente?.nome || "Designado";
                let ajudanteStr = parte.ajudante?.nome ? ` (com ${parte.ajudante.nome})` : '';

                const eventoGoogle = {
                    summary: `[RVM] ${parte.titulo} - ${pessoa}${ajudanteStr}`,
                    description: `${parte.descricao || ''}\n\nGerado pelo Gerenciador RVM.`,
                    start: {
                        dateTime: dataHoraAtual.toISOString(),
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    },
                    end: {
                        dateTime: dataHoraFim.toISOString(),
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    },
                    colorId: "9" // Cor Azul Blueberry
                };

                // Envia para o calendário específico que o usuário escolheu
                await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(eventoGoogle)
                });

                eventosCriados++;
                dataHoraAtual = dataHoraFim;
            }
        }

        return { sucesso: true, quantidade: eventosCriados };

    } catch (error) {
        console.error("Erro ao enviar eventos:", error);
        return { sucesso: false, erro: error.message };
    }
};