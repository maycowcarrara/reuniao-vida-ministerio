// 1. Função para Autenticar e pegar os Calendários do usuário
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export const iniciarSincronizacao = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    provider.addScope('https://www.googleapis.com/auth/calendar.readonly');

    if (auth.currentUser && auth.currentUser.email) {
        provider.setCustomParameters({ login_hint: auth.currentUser.email });
    }

    try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential.accessToken;

        if (!token) throw new Error("Não foi possível obter o token de acesso.");

        const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (!data.items) throw new Error("Nenhum calendário encontrado na sua conta.");

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

// 2. Função que recebe a escolha do utilizador e envia/atualiza os eventos
export const enviarEventosParaAgenda = async (token, calendarId, reunioes, configuracoes) => {
    try {
        let eventosProcessados = 0;
        const horarioPadrao = configuracoes?.horario || "19:30";

        // 🔥 FUNÇÃO INTELIGENTE DE ENVIO (Cria ou Atualiza)
        const enviarParaGoogle = async (evento) => {
            // Tenta CRIAR (POST) - Alterado sendUpdates para 'none'
            let res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(evento)
            });

            // Se retornar 409 (Conflict), significa que o evento já existe! Então vamos ATUALIZAR (PUT)
            if (res.status === 409) {
                // Alterado sendUpdates para 'none'
                res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${evento.id}?sendUpdates=none`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(evento)
                });
            }

            if (res.ok) eventosProcessados++;
        };

        for (const reuniao of reunioes) {
            if (!reuniao.dataExata || !reuniao.partes) continue;

            // Cria uma base para o ID Único (Google exige letras minúsculas a-v e números)
            const baseIdUnico = `rvm${reuniao.dataExata.replace(/-/g, '')}`;

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

            // 2. Processar todas as partes
            reuniao.partes.forEach((parte, index) => {
                let duracao = parseInt(parte.tempo || "5", 10);

                const tituloLower = (parte.titulo || '').toLowerCase();
                const secaoLower = (parte.secao || '').toLowerCase();

                const ehLeitura = tituloLower.includes('leitura da bíblia') || tituloLower.includes('leitura da biblia') || tituloLower.includes('lectura de la biblia');
                const ehMinisterio = secaoLower === 'ministerio';

                if (ehLeitura || ehMinisterio) duracao += 1;

                const start = new Date(dataHoraAtual);
                const end = new Date(start.getTime() + (duracao * 60000));
                dataHoraAtual = end;

                let pessoa = parte.estudante?.nome || parte.oracao?.nome || parte.leitor?.nome || parte.dirigente?.nome || "";
                let ajudanteStr = parte.ajudante?.nome ? ` (com ${parte.ajudante.nome})` : '';
                let nomesExibicao = pessoa ? ` - ${pessoa}${ajudanteStr}` : '';

                const tipo = (parte.tipo || '').toLowerCase();
                const tituloOriginal = (parte.titulo || '');
                const ehOracao = tipo.includes('oracao') || tipo.includes('oração');

                let tituloExibicao = tituloOriginal;
                if (ehOracao) {
                    if (tituloLower.includes('inicial') || tituloLower.includes('inicio') || tituloLower.includes('abertura') || index <= 1) {
                        tituloExibicao = 'Oração Inicial';
                    } else {
                        tituloExibicao = 'Oração Final';
                    }
                }

                const horaFormatada = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const tempoOriginal = parseInt(parte.tempo || "5", 10);
                const tempoVisual = (ehLeitura || ehMinisterio) ? `${tempoOriginal}m + 1m` : `${duracao}m`;

                programacaoLinhas.push({
                    id: `parte${index}`,
                    texto: `🕒 ${horaFormatada} (${tempoVisual}) | ${tituloExibicao}${nomesExibicao}`
                });

                partesProcessadas.push({
                    parteOriginal: parte, start, end, tituloExibicao, pessoa, ajudanteStr,
                    id: `parte${index}`, vazia: !pessoa
                });
            });

            const dataHoraFimReuniao = new Date(dataHoraAtual);

            const gerarDescricaoHTML = (idDestacado, detalhesExtra) => {
                let html = `<h3>📋 Programação da Reunião:</h3><br>`;
                programacaoLinhas.forEach(linha => {
                    if (linha.id === idDestacado) html += `<b>👉 ${linha.texto} 👈</b><br>`;
                    else html += `${linha.texto}<br>`;
                });
                if (detalhesExtra) html += `<br><b>📝 Detalhes da sua parte:</b><br>${detalhesExtra.replace(/\n/g, '<br>')}<br>`;
                html += `<br><i>🤖 Gerado automaticamente pelo Gerenciador RVM.</i>`;
                return html;
            };

            const requestsParaEnviar = [];

            // 3. Criar evento do PRESIDENTE (Início a Fim da Reunião)
            if (presidente?.nome) {
                const convidadosPres = [];
                if (presidente.email) convidadosPres.push({ email: presidente.email });

                const eventoPres = {
                    id: `${baseIdUnico}presidente`, // 🔥 ID ÚNICO
                    summary: `[RVM] Presidente da Reunião - ${presidente.nome}`,
                    description: gerarDescricaoHTML('presidente', 'Você é o presidente da reunião desta semana.'),
                    start: { dateTime: dataHoraInicioReuniao.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: dataHoraFimReuniao.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    colorId: "9",
                    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 2880 }, { method: 'popup', minutes: 120 }] }
                };
                if (convidadosPres.length > 0) eventoPres.attendees = convidadosPres;
                requestsParaEnviar.push(eventoPres);
            }

            // 4. Criar eventos Individuais
            for (const p of partesProcessadas) {
                if (p.vazia) continue;

                const convidados = [];
                const addConv = (aluno) => {
                    if (aluno?.email && !convidados.find(c => c.email === aluno.email)) convidados.push({ email: aluno.email });
                };

                addConv(p.parteOriginal.estudante);
                addConv(p.parteOriginal.ajudante);
                addConv(p.parteOriginal.oracao);
                addConv(p.parteOriginal.leitor);
                addConv(p.parteOriginal.dirigente);

                let cor = "9";
                const secao = (p.parteOriginal.secao || '').toLowerCase();
                if (secao === 'tesouros') cor = "8";
                else if (secao === 'ministerio') cor = "6";
                else if (secao === 'vida' || (p.tituloExibicao).toLowerCase().includes('estudo')) cor = "11";

                const eventoParte = {
                    id: `${baseIdUnico}${p.id}`, // 🔥 ID ÚNICO (ex: rvm20260302parte3)
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

            // 5. Enviar / Atualizar um por um
            for (const evt of requestsParaEnviar) {
                await enviarParaGoogle(evt);
            }
        }

        return { sucesso: true, quantidade: eventosProcessados };

    } catch (error) {
        console.error("Erro ao enviar eventos:", error);
        return { sucesso: false, erro: error.message };
    }
};