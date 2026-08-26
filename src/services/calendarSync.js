// 1. Função para Autenticar e pegar os Calendários do utilizador
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { normalizeLanguage, normalizeSystemConfig } from '../config/appConfig';
import { getSectionMessages } from '../i18n';
import { getMeetingSectionTag } from '../utils/meetingSections';
import { isPrayerPart } from '../utils/meetingParts';
import { getMeetingDateISOFromSemana } from '../utils/revisarEnviar/dates';
import {
    FIM_DE_SEMANA_RESPONSABILIDADES,
    MEIO_SEMANA_RESPONSABILIDADES,
    hasFimDeSemanaData,
    normalizeFimDeSemana,
    normalizeResponsabilidades
} from '../utils/fimDeSemana';

const DEFAULT_WEEKEND_MEETING_DURATION_MINUTES = 105;
const REMINDERS = { useDefault: false, overrides: [{ method: 'popup', minutes: 2880 }, { method: 'popup', minutes: 120 }] };
const RESPONSABILIDADE_ID_SUFFIX = {
    videoZoomSom: 'av',
    indicadoresEntrada: 'entrada',
    indicadoresAuditorio: 'auditorio',
    microfonesVolantes: 'microfones',
};

const getPessoaNome = (pessoa) => (pessoa?.nome || pessoa?.id || '').toString().trim();

const getPessoaEmail = (pessoa) => (pessoa?.email || '').toString().trim();

const getResponsabilidadeLabel = (def, textos, lang) =>
    textos?.[def.storageKey] || def?.labels?.[lang] || def?.labels?.pt || def?.storageKey || '';

const buildAttendees = (...pessoas) => {
    const emails = new Set();
    pessoas.forEach((pessoa) => {
        const email = getPessoaEmail(pessoa);
        if (email) emails.add(email);
    });
    return Array.from(emails).map((email) => ({ email }));
};

const parseTimeParts = (timeValue, fallback = '19:30') => {
    const value = (timeValue || fallback || '19:30').toString().trim();
    const amPm = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (amPm) {
        let hour = parseInt(amPm[1], 10);
        const minute = parseInt(amPm[2], 10);
        const suffix = amPm[3].toUpperCase();
        if (suffix === 'PM' && hour < 12) hour += 12;
        if (suffix === 'AM' && hour === 12) hour = 0;
        return {
            hour: String(Math.max(0, Math.min(23, hour))).padStart(2, '0'),
            minute: String(Math.max(0, Math.min(59, minute))).padStart(2, '0'),
        };
    }

    const [rawHour, rawMinute = '0'] = value.split(':');
    const hour = parseInt(rawHour, 10);
    const minute = parseInt(rawMinute, 10);
    return {
        hour: String(Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 19).padStart(2, '0'),
        minute: String(Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 30).padStart(2, '0'),
    };
};

const buildLocalDateTime = (dateISO, timeValue, fallback) => {
    const { hour, minute } = parseTimeParts(timeValue, fallback);
    return new Date(`${dateISO}T${hour}:${minute}:00`);
};

const getWeekendDateForWeek = (reuniao, config) => {
    const fallbackStr = reuniao?.fimDeSemana?.data || reuniao?.dataInicio || reuniao?.dataExata || reuniao?.dataReuniao || reuniao?.data || '';
    return getMeetingDateISOFromSemana({
        semanaStr: reuniao?.semana,
        config,
        isoFallback: fallbackStr,
        overrideDia: config?.dia_reuniao_fds || config?.diaReuniaoFds || 'saturday',
        textSources: [reuniao?.semana]
    }) || fallbackStr || '';
};

const getGoogleCalendarErrorMessage = (response, data) => {
    const googleError = data?.error;
    const firstError = Array.isArray(googleError?.errors) ? googleError.errors[0] : null;
    const reason = firstError?.reason || googleError?.status || '';
    const message = googleError?.message || '';
    const reasonLower = reason.toString().toLowerCase();
    const messageLower = message.toString().toLowerCase();

    if (
        reasonLower.includes('accessnotconfigured') ||
        messageLower.includes('has not been used') ||
        messageLower.includes('is disabled')
    ) {
        return 'A API Google Calendar nao esta ativada no projeto Google/Firebase usado pelo app. Ative a Google Calendar API no projeto novo e tente novamente.';
    }

    if (
        reasonLower.includes('insufficient') ||
        reasonLower.includes('access_token_scope_insufficient') ||
        messageLower.includes('insufficient')
    ) {
        return 'A permissao concedida ao app nao inclui acesso ao Google Agenda. Revogue o acesso do app na sua Conta Google e autorize novamente.';
    }

    if (response.status === 401) {
        return 'O Google nao aceitou a autorizacao atual. Entre novamente com a conta Google e autorize o acesso ao Agenda.';
    }

    if (message) {
        return `Google Agenda recusou a consulta (${response.status}): ${message}`;
    }

    return `Google Agenda recusou a consulta (${response.status}).`;
};

const readGoogleJson = async (response) => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

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

        if (!token) throw new Error(getSectionMessages('calendarSync', 'pt').tokenErro);

        const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await readGoogleJson(response);

        if (!response.ok) {
            throw new Error(getGoogleCalendarErrorMessage(response, data));
        }

        if (!Array.isArray(data?.items) || data.items.length === 0) {
            throw new Error(getSectionMessages('calendarSync', 'pt').nenhumCalendario);
        }

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
        const config = normalizeSystemConfig(configuracoes || {});
        const horarioPadrao = config?.horario || "19:30";
        const horarioFimDeSemanaPadrao = config?.horario_fds || config?.horarioFimDeSemana || "18:00";

        // 🔥 Detecta o idioma para as tags e textos dinâmicos
        const lang = normalizeLanguage(config?.idioma);
        const textos = getSectionMessages('calendarSync', lang);

        // 🔥 FUNÇÃO INTELIGENTE DE ENVIO (Cria ou Atualiza)
        const enviarParaGoogle = async (evento) => {
            let res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(evento)
            });

            // Se retornar 409 (Conflict), significa que o evento já existe! Então vamos ATUALIZAR (PUT)
            if (res.status === 409) {
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

            let dataHoraAtual = buildLocalDateTime(reuniao.dataExata, horarioPadrao, '19:30');
            const dataHoraInicioReuniao = new Date(dataHoraAtual);

            const partesProcessadas = [];
            const programacaoLinhas = [];
            const apoiosMeioSemana = [];

            // 1. O Presidente da Reunião
            const presidente = reuniao.presidente;
            if (presidente?.nome) {
                programacaoLinhas.push({
                    id: 'presidente',
                    texto: `👔 ${textos.presidente}: ${presidente.nome}`
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

                // Prioriza o Dirigente e ajusta o Leitor corretamente
                let pessoa = "";
                let ajudanteStr = "";

                if (parte.dirigente?.nome) {
                    pessoa = parte.dirigente.nome;
                    if (parte.leitor?.nome) {
                        ajudanteStr = ` (${textos.leitor} ${parte.leitor.nome})`;
                    }
                } else if (parte.estudante?.nome) {
                    pessoa = parte.estudante.nome;
                    if (parte.ajudante?.nome) {
                        ajudanteStr = ` (${textos.com} ${parte.ajudante.nome})`;
                    }
                } else if (parte.oracao?.nome) {
                    pessoa = parte.oracao.nome;
                } else if (parte.leitor?.nome) {
                    pessoa = parte.leitor.nome;
                }

                let nomesExibicao = pessoa ? ` - ${pessoa}${ajudanteStr}` : '';

                const tituloOriginal = (parte.titulo || '');
                const ehOracao = isPrayerPart(parte);

                let tituloExibicao = tituloOriginal;
                if (ehOracao) {
                    if (tituloLower.includes('inicial') || tituloLower.includes('inicio') || tituloLower.includes('abertura') || index <= 1) {
                        tituloExibicao = textos.oracaoInicial;
                    } else {
                        tituloExibicao = textos.oracaoFinal;
                    }
                }

                const secaoTag = getMeetingSectionTag(parte.secao, lang);
                const tituloExibicaoComIcone = secaoTag ? `${secaoTag} - ${tituloExibicao}` : tituloExibicao;
                const horaFormatada = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const tempoOriginal = parseInt(parte.tempo || "5", 10);
                const tempoVisual = (ehLeitura || ehMinisterio) ? `${tempoOriginal}m + 1m` : `${duracao}m`;

                programacaoLinhas.push({
                    id: `parte${index}`,
                    texto: `🕒 ${horaFormatada} (${tempoVisual}) | ${tituloExibicaoComIcone}${nomesExibicao}`
                });

                partesProcessadas.push({
                    parteOriginal: parte, start, end, tituloExibicaoComIcone, pessoa, ajudanteStr,
                    id: `parte${index}`, vazia: !pessoa
                });
            });

            const dataHoraFimReuniao = new Date(dataHoraAtual);

            const responsabilidadesMeioSemana = normalizeResponsabilidades(reuniao?.responsabilidades, MEIO_SEMANA_RESPONSABILIDADES);
            MEIO_SEMANA_RESPONSABILIDADES.forEach((def) => {
                const titulo = getResponsabilidadeLabel(def, textos, lang);
                const suffix = RESPONSABILIDADE_ID_SUFFIX[def.storageKey] || def.storageKey.toLowerCase();
                (responsabilidadesMeioSemana[def.storageKey] || []).forEach((pessoa, itemIndex) => {
                    const nome = getPessoaNome(pessoa);
                    if (!nome) return;

                    const id = `apoiomeio${suffix}${itemIndex}`;
                    programacaoLinhas.push({
                        id,
                        texto: `🧰 ${textos.apoioMeioSemana}: ${titulo} - ${nome}`
                    });
                    apoiosMeioSemana.push({ id, titulo, pessoa });
                });
            });

            const gerarDescricaoHTML = (idDestacado, detalhesExtra) => {
                let html = `<h3>📋 ${textos.progReuniao}:</h3><br>`;
                programacaoLinhas.forEach(linha => {
                    if (linha.id === idDestacado) html += `<b>👉 ${linha.texto} 👈</b><br>`;
                    else html += `${linha.texto}<br>`;
                });
                if (detalhesExtra) html += `<br><b>📝 ${textos.detalhesParte}:</b><br>${detalhesExtra.replace(/\n/g, '<br>')}<br>`;
                html += `<br><i>🤖 ${textos.geradoAuto}.</i>`;
                return html;
            };

            const requestsParaEnviar = [];

            // 3. Criar evento do PRESIDENTE
            if (presidente?.nome) {
                const convidadosPres = [];
                // 🔥 SEGURANÇA: .trim() remove espaços em branco antes ou depois do e-mail
                const emailPresLimpo = (presidente.email || "").trim();

                if (emailPresLimpo) {
                    convidadosPres.push({ email: emailPresLimpo });
                }

                const eventoPres = {
                    id: `${baseIdUnico}presidente`,
                    summary: `[RVM] ${textos.presidenteReuniao} - ${presidente.nome}`,
                    description: gerarDescricaoHTML('presidente', textos.descPresidente),
                    start: { dateTime: dataHoraInicioReuniao.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: dataHoraFimReuniao.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    colorId: "9",
                    reminders: REMINDERS
                };
                if (convidadosPres.length > 0) eventoPres.attendees = convidadosPres;
                requestsParaEnviar.push(eventoPres);
            }

            // 4. Criar eventos Individuais
            for (const p of partesProcessadas) {
                if (p.vazia) continue;

                const convidados = [];
                const addConv = (aluno) => {
                    // 🔥 SEGURANÇA: .trim() para evitar o erro 400 Bad Request do Google!
                    const emailLimpo = (aluno?.email || "").trim();
                    if (emailLimpo && !convidados.find(c => c.email === emailLimpo)) {
                        convidados.push({ email: emailLimpo });
                    }
                };

                addConv(p.parteOriginal.estudante);
                addConv(p.parteOriginal.ajudante);
                addConv(p.parteOriginal.oracao);
                addConv(p.parteOriginal.leitor);
                addConv(p.parteOriginal.dirigente);

                let cor = "9";
                const secao = (p.parteOriginal.secao || '').toLowerCase();
                const tituloEventoLower = (p.tituloExibicaoComIcone || '').toLowerCase();
                if (secao === 'tesouros') cor = "7";
                else if (secao === 'ministerio') cor = "5";
                else if (secao === 'vida' || tituloEventoLower.includes('estudo') || tituloEventoLower.includes('estudio')) cor = "11";

                const eventoParte = {
                    id: `${baseIdUnico}${p.id}`,
                    summary: `[RVM] ${p.tituloExibicaoComIcone} - ${p.pessoa}${p.ajudanteStr}`,
                    description: gerarDescricaoHTML(p.id, p.parteOriginal.descricao),
                    start: { dateTime: p.start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: p.end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    colorId: cor,
                    reminders: REMINDERS
                };
                if (convidados.length > 0) eventoParte.attendees = convidados;
                requestsParaEnviar.push(eventoParte);
            }

            for (const apoio of apoiosMeioSemana) {
                const nome = getPessoaNome(apoio.pessoa);
                const attendees = buildAttendees(apoio.pessoa);
                const eventoApoio = {
                    id: `${baseIdUnico}${apoio.id}`,
                    summary: `[RVM] ${textos.apoioMeioSemana} - ${apoio.titulo} - ${nome}`,
                    description: gerarDescricaoHTML(apoio.id, textos.descApoioReuniaoCompleta),
                    start: { dateTime: dataHoraInicioReuniao.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: dataHoraFimReuniao.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    colorId: "8",
                    reminders: REMINDERS
                };
                if (attendees.length > 0) eventoApoio.attendees = attendees;
                requestsParaEnviar.push(eventoApoio);
            }

            const fds = normalizeFimDeSemana(reuniao?.fimDeSemana);
            if (fds.ativo && hasFimDeSemanaData(reuniao?.fimDeSemana)) {
                const dataFimDeSemana = getWeekendDateForWeek(reuniao, config);
                if (dataFimDeSemana) {
                    const horarioFimDeSemana = horarioFimDeSemanaPadrao || fds.horario || "18:00";
                    const inicioFimDeSemana = buildLocalDateTime(dataFimDeSemana, horarioFimDeSemana, '18:00');
                    const fimFimDeSemana = new Date(inicioFimDeSemana.getTime() + (DEFAULT_WEEKEND_MEETING_DURATION_MINUTES * 60000));
                    const baseIdFimDeSemana = `rvmfds${dataFimDeSemana.replace(/-/g, '')}`;
                    const linhasFimDeSemana = [];
                    const eventosFimDeSemana = [];

                    const addLinhaFimDeSemana = (id, texto) => {
                        if (!texto) return;
                        linhasFimDeSemana.push({ id, texto });
                    };

                    const addEventoFimDeSemana = (id, titulo, pessoa, detalhesExtra = textos.descFimDeSemana) => {
                        const nome = getPessoaNome(pessoa);
                        if (!nome) return;

                        addLinhaFimDeSemana(id, `🗓️ ${titulo} - ${nome}`);
                        eventosFimDeSemana.push({ id, titulo, pessoa, detalhesExtra });
                    };

                    const temaDiscurso = (fds.reuniaoPublica?.temaDiscurso || '').trim();
                    const oradorManual = (fds.reuniaoPublica?.oradorNomeManual || '').trim();
                    const congregacaoOrador = (fds.reuniaoPublica?.congregacaoOrador || '').trim();
                    const oradorComCongregacao = congregacaoOrador ? `${oradorManual} (${congregacaoOrador})` : oradorManual;
                    if (temaDiscurso || oradorManual) {
                        addLinhaFimDeSemana(
                            'fdspublica',
                            `🎤 ${textos.reuniaoPublica}: ${[temaDiscurso, oradorComCongregacao].filter(Boolean).join(' - ')}`
                        );
                    }

                    addEventoFimDeSemana('presidentefds', textos.presidenteFimDeSemana, fds.presidente);
                    addEventoFimDeSemana('dirigentesentinela', `${textos.dirigenteSentinela} - ${textos.estudoSentinela}`, fds.estudoSentinela?.dirigente);
                    addEventoFimDeSemana('leitorsentinela', `${textos.leitorSentinela} - ${textos.estudoSentinela}`, fds.estudoSentinela?.leitor);

                    const discursoFinalVisita = (fds.visitaSuperintendente?.discursoFinal || '').trim();
                    if (discursoFinalVisita) {
                        addLinhaFimDeSemana('fdsdiscursovisita', `🎙️ ${textos.discursoFinalVisita}: ${discursoFinalVisita}`);
                    }

                    FIM_DE_SEMANA_RESPONSABILIDADES.forEach((def) => {
                        const titulo = getResponsabilidadeLabel(def, textos, lang);
                        const suffix = RESPONSABILIDADE_ID_SUFFIX[def.storageKey] || def.storageKey.toLowerCase();
                        (fds.responsabilidades?.[def.storageKey] || []).forEach((pessoa, itemIndex) => {
                            addEventoFimDeSemana(`apoiofds${suffix}${itemIndex}`, `${textos.apoioFimDeSemana} - ${titulo}`, pessoa, textos.descApoioReuniaoCompleta);
                        });
                    });

                    addEventoFimDeSemana('oracaofds', textos.oracaoFinal, fds.oracaoFinal);

                    const gerarDescricaoFimDeSemanaHTML = (idDestacado, detalhesExtra) => {
                        let html = `<h3>📋 ${textos.reuniaoFimDeSemana}:</h3><br>`;
                        linhasFimDeSemana.forEach(linha => {
                            if (linha.id === idDestacado) html += `<b>👉 ${linha.texto} 👈</b><br>`;
                            else html += `${linha.texto}<br>`;
                        });
                        if (detalhesExtra) html += `<br><b>📝 ${textos.detalhesParte}:</b><br>${detalhesExtra.replace(/\n/g, '<br>')}<br>`;
                        html += `<br><i>🤖 ${textos.geradoAuto}.</i>`;
                        return html;
                    };

                    for (const evento of eventosFimDeSemana) {
                        const nome = getPessoaNome(evento.pessoa);
                        const attendees = buildAttendees(evento.pessoa);
                        const eventoAgenda = {
                            id: `${baseIdFimDeSemana}${evento.id}`,
                            summary: `[RVM] ${textos.reuniaoFimDeSemana} - ${evento.titulo} - ${nome}`,
                            description: gerarDescricaoFimDeSemanaHTML(evento.id, evento.detalhesExtra),
                            start: { dateTime: inicioFimDeSemana.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                            end: { dateTime: fimFimDeSemana.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                            colorId: "10",
                            reminders: REMINDERS
                        };
                        if (attendees.length > 0) eventoAgenda.attendees = attendees;
                        requestsParaEnviar.push(eventoAgenda);
                    }
                }
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
