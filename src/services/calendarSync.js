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

// 2. Função que recebe a escolha do utilizador e envia os eventos
export const enviarEventosParaAgenda = async (token, calendarId, reunioes, configuracoes) => {
    try {
        let eventosCriados = 0;
        const horarioPadrao = configuracoes?.horario || "19:30";

        for (const reuniao of reunioes) {
            if (!reuniao.dataExata || !reuniao.partes) continue;

            const [hora, minuto] = horarioPadrao.split(':');
            let dataHoraAtual = new Date(`${reuniao.dataExata}T${hora}:${minuto}:00`);
            const dataHoraInicioReuniao = new Date(dataHoraAtual);

            const partesProcessadas = [];
            const programacaoLinhas = [];

            // 1. O Presidente da Reunião
            const presidente = reuniao.presidente;
            if (presidente?.nome) {
                programacaoLinhas.push({
                    id: 'presidente',
                    texto: `👔 Presidente: ${presidente.nome}`
                });
            }

            // 2. Processar todas as partes para calcular horários e montar a lista da programação
            reuniao.partes.forEach((parte, index) => {
                const duracao = parseInt(parte.tempo || "5", 10);
                const start = new Date(dataHoraAtual);
                const end = new Date(start.getTime() + (duracao * 60000));
                dataHoraAtual = end;

                let pessoa = parte.estudante?.nome || parte.oracao?.nome || parte.leitor?.nome || parte.dirigente?.nome || "";
                let ajudanteStr = parte.ajudante?.nome ? ` (com ${parte.ajudante.nome})` : '';
                let nomesExibicao = pessoa ? ` - ${pessoa}${ajudanteStr}` : '';

                // Ajuste de Nomes (Oração Inicial e Final)
                const tipo = (parte.tipo || '').toLowerCase();
                const tituloOriginal = (parte.titulo || '');
                const tituloLower = tituloOriginal.toLowerCase();
                const ehOracao = tipo.includes('oracao') || tipo.includes('oração');
                
                let tituloExibicao = tituloOriginal;
                if (ehOracao) {
                    // Se estiver no começo da reunião (pelo nome ou sendo uma das 2 primeiras partes)
                    if (tituloLower.includes('inicial') || tituloLower.includes('inicio') || tituloLower.includes('abertura') || index <= 1) {
                        tituloExibicao = 'Oração Inicial';
                    } else {
                        tituloExibicao = 'Oração Final'; // Garante o nome correto no título!
                    }
                }

                // Formatar hora para exibir na lista (ex: "19:30")
                const horaFormatada = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                programacaoLinhas.push({
                    id: `parte_${index}`,
                    texto: `🕒 ${horaFormatada} | ${tituloExibicao}${nomesExibicao}`
                });

                partesProcessadas.push({
                    parteOriginal: parte,
                    start,
                    end,
                    tituloExibicao,
                    pessoa,
                    ajudanteStr,
                    id: `parte_${index}`,
                    vazia: !pessoa
                });
            });

            const dataHoraFimReuniao = new Date(dataHoraAtual); // Fim de tudo

            // Função auxiliar para gerar a descrição em HTML com a linha certa destacada
            const gerarDescricaoHTML = (idDestacado, detalhesExtra) => {
                let html = `<h3>📋 Programação da Reunião:</h3><br>`;
                
                programacaoLinhas.forEach(linha => {
                    if (linha.id === idDestacado) {
                        html += `<b>👉 ${linha.texto} 👈</b><br>`; // Destaca em negrito
                    } else {
                        html += `${linha.texto}<br>`;
                    }
                });

                if (detalhesExtra) {
                    html += `<br><b>📝 Detalhes da sua parte:</b><br>${detalhesExtra.replace(/\n/g, '<br>')}<br>`;
                }
                html += `<br><i>🤖 Gerado automaticamente pelo Gerenciador RVM.</i>`;
                return html;
            };

            const requestsParaEnviar = [];

            // 3. Criar evento ÚNICO para o PRESIDENTE (Cobre o tempo total da reunião)
            if (presidente?.nome) {
                const convidadosPres = [];
                if (presidente.email) convidadosPres.push({ email: presidente.email });

                const eventoPres = {
                    summary: `[RVM] Presidente da Reunião - ${presidente.nome}`,
                    description: gerarDescricaoHTML('presidente', 'Você é o presidente da reunião desta semana.'),
                    start: { dateTime: dataHoraInicioReuniao.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: dataHoraFimReuniao.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    colorId: "9", // Azul
                    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 2880 }, { method: 'popup', minutes: 120 }] }
                };
                if (convidadosPres.length > 0) eventoPres.attendees = convidadosPres;
                requestsParaEnviar.push(eventoPres);
            }

            // 4. Criar eventos Individuais para cada PARTE (incluindo as orações bem nomeadas)
            for (const p of partesProcessadas) {
                if (p.vazia) continue; // Pula caso não tenha ninguém designado (ex: Cântico)

                const convidados = [];
                const addConv = (aluno) => { 
                    if (aluno?.email && !convidados.find(c => c.email === aluno.email)) {
                        convidados.push({ email: aluno.email }); 
                    }
                };
                
                addConv(p.parteOriginal.estudante);
                addConv(p.parteOriginal.ajudante);
                addConv(p.parteOriginal.oracao);
                addConv(p.parteOriginal.leitor);
                addConv(p.parteOriginal.dirigente);

                // Define a cor
                let cor = "9"; 
                const secao = (p.parteOriginal.secao || '').toLowerCase();
                if (secao === 'tesouros') cor = "8";
                else if (secao === 'ministerio') cor = "6";
                else if (secao === 'vida' || (p.tituloExibicao).toLowerCase().includes('estudo')) cor = "11";

                const eventoParte = {
                    summary: `[RVM] ${p.tituloExibicao} - ${p.pessoa}${p.ajudanteStr}`,
                    description: gerarDescricaoHTML(p.id, p.parteOriginal.descricao),
                    start: { dateTime: p.start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: p.end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    colorId: cor,
                    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 2880 }, { method: 'popup', minutes: 120 }] }
                };
                if (convidados.length > 0) eventoParte.attendees = convidados;
                requestsParaEnviar.push(eventoParte);
            }

            // 5. Disparar todos os eventos para o Google!
            for (const evt of requestsParaEnviar) {
                await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(evt)
                });
                eventosCriados++;
            }
        }

        return { sucesso: true, quantidade: eventosCriados };

    } catch (error) {
        console.error("Erro ao enviar eventos:", error);
        return { sucesso: false, erro: error.message };
    }
};