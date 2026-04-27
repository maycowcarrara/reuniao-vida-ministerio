import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, CheckCircle2, Mail, MessageCircle, Tent, UsersRound, Loader2, Send, SlidersHorizontal, XCircle } from 'lucide-react';

import { formatarDataFolha } from '../../utils/revisarEnviar/dates';
import { montarMensagemDesignacao, montarMensagemLembreteSemana } from '../../utils/revisarEnviar/messages';
import { enviarEmailAutomatico, getEmailJsMissingConfig } from '../../utils/revisarEnviar/enviadorEmail';
import { buildAgendaLink } from '../../utils/revisarEnviar/links';
import { toast } from '../../utils/toast';
import { getTipoEventoSemana } from '../../utils/eventos';
import { formatText } from '../../i18n';
import {
    ensurePublicConfirmation,
    registerNotificationChannelByAssignment,
    registerConfirmationReminder,
    respondToConfirmationByAssignment,
    respondToWeekReminderByAssignment
} from '../../services/confirmacoesPublicas';

const SECAO_UI = {
    tesouros: { chip: 'bg-slate-600', wrap: 'border-slate-200 bg-slate-50', text: 'text-slate-900' },
    ministerio: { chip: 'bg-yellow-600', wrap: 'border-amber-200 bg-amber-50', text: 'text-amber-950' },
    vida: { chip: 'bg-red-700', wrap: 'border-rose-200 bg-rose-50', text: 'text-rose-950' },
};

const RevisarEnviarNotificarTab = ({
    semanasParaNotificar,
    config,
    confirmacoes = [],
    lang,
    t,
    getDataReuniaoISO,

    // detecção de tipos (mantém a mesma regra do pai)
    isOracao,
    isEstudo,
    getOracaoPos,

    // runtime notificações (estado + ações)
    enviarZap,
    buildMsgKey,
    markSent,
    isSent,
}) => {
    // --- ESTADOS DO ENVIO DE E-MAIL AUTOMÁTICO ---
    const [enviandoGlobal, setEnviandoGlobal] = useState(false);
    const [progresso, setProgresso] = useState({ total: 0, enviados: 0, erros: 0 });
    const [enviandoInd, setEnviandoInd] = useState({});
    const [manualBusy, setManualBusy] = useState({});
    const [activeActionMenu, setActiveActionMenu] = useState(null);
    const emailJsMissingConfig = getEmailJsMissingConfig();
    const emailJsReady = emailJsMissingConfig.length === 0;
    const emailJsConfigMessage = formatText(t.emailJsConfigMissingTpl, {
        vars: emailJsMissingConfig.join(', ')
    });
    const roleLabels = {
        presidente: t.presidente || 'Presidente',
        oracao: t.oracao || 'Oração',
        dirigente: t.dirigente || 'Dirigente',
        leitor: t.leitor || 'Leitor',
        estudante: t.estudante || 'Estudante',
        ajudante: t.ajudante || 'Ajudante'
    };

    const confirmacoesMap = useMemo(() => {
        return (confirmacoes || []).reduce((acc, item) => {
            const key = String(item?.assignmentKey || '').trim();
            if (key) acc[key] = item;
            return acc;
        }, {});
    }, [confirmacoes]);

    const getStatusLabel = (status) => {
        if (status === 'confirmado') return t.statusConfirmado;
        if (status === 'nao_pode') return t.statusNaoPode;
        return t.statusPendente;
    };

    const anexarLinkConfirmacao = (mensagemBase, link, status = 'pendente') => {
        if (!link) return mensagemBase;

        const footer = ['confirmado', 'nao_pode'].includes(status)
            ? formatText(t.msgRespostaJaRegistrada, {
                link,
                status: getStatusLabel(status)
            })
            : formatText(t.msgConfirmar, { link });

        return [mensagemBase, footer].filter(Boolean).join('\n\n');
    };

    const prepararConfirmacao = async (confirmationData) => {
        if (!confirmationData) return { link: '', status: 'pendente' };
        return ensurePublicConfirmation(confirmationData);
    };

    const montarPayloadEmail = async (payloadBase, confirmationData) => {
        const confirmacao = await prepararConfirmacao(confirmationData);
        return {
            ...payloadBase,
            Link: confirmacao.link,
            LinkConfirmacao: confirmacao.link,
            LinkConfirmar: confirmacao.acceptLink,
            LinkRecusar: confirmacao.declineLink,
            LinkAgenda: confirmationData?.agendaLink || payloadBase?.LinkAgenda || ''
        };
    };

    const handleEnviarWhatsapp = async (pessoa, msg, msgKey, confirmationData) => {
        try {
            const confirmacao = await prepararConfirmacao(confirmationData);
            enviarZap(pessoa, anexarLinkConfirmacao(msg, confirmacao.link, confirmacao.status));
            markSent(msgKey, 'wa');
            await registerNotificationChannelByAssignment(confirmationData?.assignmentKey, 'wa');
        } catch (error) {
            console.error('Falha ao preparar confirmação para WhatsApp:', error);
            toast.error(error, t.reminderError);
        }
    };

    const handleEnviarLembrete = async (pessoa, msgKey, confirmationData) => {
        try {
            const confirmacao = await prepararConfirmacao(confirmationData);
            const msg = montarMensagemLembreteSemana({
                t,
                config,
                dataISO: confirmationData?.dataISO,
                responsavelNome: pessoa?.nome,
                tituloParte: confirmationData?.tituloParte,
                isVisita: confirmationData?.isVisita,
                linkConfirmacao: confirmacao.weekLink
            });

            enviarZap(pessoa, msg);
            markSent(msgKey, 'waReminder');
            await registerConfirmationReminder(confirmationData?.assignmentKey);
            toast.success(t.reminderSent);
        } catch (error) {
            console.error('Falha ao enviar lembrete:', error);
            toast.error(error, t.reminderError);
        }
    };

    const getStatusUi = (assignmentKey) => {
        const current = confirmacoesMap[String(assignmentKey || '').trim()];
        const status = current?.status || 'pendente';

        if (status === 'confirmado') {
            return {
                label: t.statusConfirmado,
                chip: 'bg-emerald-100 text-emerald-800 border-emerald-200'
            };
        }

        if (status === 'nao_pode') {
            return {
                label: t.statusNaoPode,
                chip: 'bg-rose-100 text-rose-800 border-rose-200'
            };
        }

        return {
            label: t.statusPendente,
            chip: 'bg-amber-100 text-amber-800 border-amber-200'
        };
    };

    const getWeekStatusUi = (assignmentKey) => {
        const current = confirmacoesMap[String(assignmentKey || '').trim()];
        const status = current?.weekReminderStatus || 'nao_enviado';

        if (status === 'confirmado') {
            return {
                label: t.statusSemanaConfirmada,
                chip: 'bg-emerald-100 text-emerald-800 border-emerald-200'
            };
        }

        if (status === 'imprevisto') {
            return {
                label: t.statusSemanaImprevisto,
                chip: 'bg-rose-100 text-rose-800 border-rose-200'
            };
        }

        if (status === 'pendente') {
            return {
                label: t.statusSemanaPendente,
                chip: 'bg-amber-100 text-amber-800 border-amber-200'
            };
        }

        return {
            label: t.statusSemanaNaoEnviada,
            chip: 'bg-slate-100 text-slate-700 border-slate-200'
        };
    };

    const hasSentChannel = (assignmentKey, channel) => {
        const current = confirmacoesMap[String(assignmentKey || '').trim()];
        return Boolean(current?.sentChannels?.[channel]);
    };

    const addPessoaRevisao = (acc, pessoa, role, parteLabel, semanaLabel) => {
        if (!pessoa?.nome && !pessoa?.id) {
            acc.semDesignado.push(`${semanaLabel}: ${parteLabel}`);
            return;
        }

        const pessoaKey = pessoa.id || pessoa.nome;
        acc.pessoasSemana.set(pessoaKey, [...(acc.pessoasSemana.get(pessoaKey) || []), parteLabel]);

        if (!pessoa.telefone && !pessoa.email) {
            acc.semContato.push(`${pessoa.nome} (${role})`);
        }
    };

    const handleManualStatus = async (confirmationData, status) => {
        const assignmentKey = String(confirmationData?.assignmentKey || '').trim();
        if (!assignmentKey) return;

        try {
            setManualBusy((prev) => ({ ...prev, [assignmentKey]: status }));
            await prepararConfirmacao(confirmationData);
            await respondToConfirmationByAssignment(assignmentKey, status, {
                source: 'manual_admin',
                actorType: 'admin'
            });
            toast.success(status === 'confirmado' ? t.manualConfirmado : t.manualNaoPode);
        } catch (error) {
            toast.error(error, t.manualErro);
        } finally {
            setManualBusy((prev) => ({ ...prev, [assignmentKey]: null }));
        }
    };

    const handleManualWeekStatus = async (confirmationData, status) => {
        const assignmentKey = String(confirmationData?.assignmentKey || '').trim();
        if (!assignmentKey) return;

        try {
            setManualBusy((prev) => ({ ...prev, [`week:${assignmentKey}`]: status }));
            await prepararConfirmacao(confirmationData);
            await respondToWeekReminderByAssignment(assignmentKey, status, {
                source: 'manual_admin',
                actorType: 'admin'
            });
            toast.success(status === 'confirmado' ? t.manualSemanaConfirmada : t.manualSemanaImprevisto);
        } catch (error) {
            toast.error(error, t.manualErro);
        } finally {
            setManualBusy((prev) => ({ ...prev, [`week:${assignmentKey}`]: null }));
        }
    };

    // --- COLETOR DE E-MAILS PARA O DISPARO GLOBAL ---
    const coletarTodasDesignacoes = () => {
        const lista = [];

        semanasParaNotificar.forEach(sem => {
            const tipoEvento = getTipoEventoSemana(sem, config);
            if (tipoEvento !== 'normal' && tipoEvento !== 'visita') return;

            const dataISO = getDataReuniaoISO(sem);
            const dataReuniaoFormatada = formatarDataFolha(dataISO, lang);

            const addToList = (pessoa, titulo, role, ajudante = null, parteId, salaOverride = null) => {
                if (pessoa?.email) {
                    const msgKey = buildMsgKey({
                        dataISO,
                        semana: sem.semana,
                        parteId: parteId || titulo,
                        pessoaId: pessoa.id || pessoa.nome,
                        role
                    });

                    const agendaLink = buildAgendaLink({
                        config,
                        semana: sem.semana,
                        dataISO,
                        tituloParte: titulo,
                        responsavelNome: pessoa.nome,
                        ajudanteNome: ajudante?.nome
                    });

                    const confirmationData = {
                        assignmentKey: msgKey,
                        lang,
                        semana: sem.semana,
                        dataISO,
                        tituloParte: titulo,
                        pessoaNome: pessoa.nome,
                        role,
                        congregacaoNome: config?.nome_cong,
                        agendaLink,
                        sala: salaOverride || 'Principal'
                    };

                    // Só adiciona na fila se ainda não foi enviado!
                    if (!isSent(msgKey, 'mail')) {
                        lista.push({
                            msgKey,
                            confirmationData,
                            payload: {
                                Nome: pessoa.nome,
                                Ajudante: ajudante?.nome || "—",
                                Data: dataReuniaoFormatada,
                                Desig: titulo,
                                Sala: salaOverride || 'Principal',
                                Link: agendaLink,
                                LinkAgenda: agendaLink,
                                email_destino: pessoa.email
                            }
                        });
                    }
                }
            };

            if (sem.presidente) {
                addToList(
                    sem.presidente,
                    t.presidente,
                    'presidente',
                    null,
                    'presidente'
                );
            }

            const partes = Array.isArray(sem?.partes) ? sem.partes : [];

            // Pré-processamento para orações (Saber quem é quem)
            const oracoes = partes.filter(isOracao);
            const primeira = partes[0];
            const ultima = partes[partes.length - 1];

            const oracaoInicial =
                oracoes.find((p) => getOracaoPos(p) === 'inicio') ||
                (primeira && isOracao(primeira) ? primeira : null);

            const oracaoFinal =
                oracoes.find((p) => getOracaoPos(p) === 'final') ||
                (ultima && isOracao(ultima) ? ultima : null);

            partes.forEach(p => {
                if (isOracao(p)) {
                    const pOracao = p.oracao || p.estudante;

                    // --- MÁGICA AQUI: Forçando o nome da oração no envio global ---
                    let tituloOracao = t.oracao;
                    if (p === oracaoInicial) tituloOracao = `${t.oracao} (inicial)`;
                    else if (p === oracaoFinal) tituloOracao = `${t.oracao} (final)`;

                    if (pOracao) {
                        addToList(
                            pOracao,
                            tituloOracao,
                            'oracao',
                            null,
                            p.id
                        );
                    }

                } else if (isEstudo(p)) {
                    const dir = p.dirigente || p.estudante;
                    const lei = p.leitor || sem.leitor;
                    if (dir) {
                        addToList(
                            dir,
                            `${t.dirigente} - ${p.titulo || 'Estudo'}`,
                            'dirigente',
                            null,
                            p.id
                        );
                    }
                    if (lei) {
                        addToList(
                            lei,
                            `${t.leitor} - ${p.titulo || 'Estudo'}`,
                            'leitor',
                            null,
                            p.id
                        );
                    }
                } else if (p.estudante) {
                    addToList(
                        p.estudante,
                        p.titulo || 'Parte',
                        'resp',
                        p.ajudante,
                        p.id,
                        p.sala
                    );
                    if (p.ajudante) {
                        addToList(
                            p.ajudante,
                            `${t.ajudante} - ${p.titulo}`,
                            'ajud',
                            null,
                            p.id,
                            p.sala
                        );
                    }
                }
            });
        });
        return lista;
    };

    const montarChecklistRevisao = () => {
        const base = {
            semanas: 0,
            semDesignado: [],
            duplicados: [],
            semContato: [],
            confirmacoesPendentes: 0,
            emailsNaFila: coletarTodasDesignacoes().length,
            pessoasSemana: new Map(),
            substituicoes: 0,
            agendaPendente: 0,
            historicoPendente: 0
        };

        semanasParaNotificar.forEach((sem) => {
            const tipoEvento = getTipoEventoSemana(sem, config);
            if (tipoEvento !== 'normal' && tipoEvento !== 'visita') return;

            base.semanas += 1;
            base.pessoasSemana = new Map();
            const semanaLabel = sem?.semana || 'Semana';
            const substituicoesSemana = Array.isArray(sem?.substituicoes) ? sem.substituicoes.filter((item) => !item?.canceladaEm) : [];
            base.substituicoes += substituicoesSemana.length;
            if (sem?.agendaPendenteSync || sem?.needsCalendarSync) {
                base.agendaPendente += 1;
            }
            if (sem?.historicoPendenteSync) {
                base.historicoPendente += 1;
            }

            addPessoaRevisao(base, sem?.presidente, roleLabels.presidente, roleLabels.presidente, semanaLabel);

            const partes = Array.isArray(sem?.partes) ? sem.partes : [];
            partes.forEach((parte) => {
                const titulo = parte?.titulo || 'Parte';
                if (isOracao(parte)) {
                    addPessoaRevisao(base, parte?.oracao || parte?.estudante, roleLabels.oracao, titulo, semanaLabel);
                    return;
                }

                if (isEstudo(parte)) {
                    addPessoaRevisao(base, parte?.dirigente || parte?.estudante, roleLabels.dirigente, `${roleLabels.dirigente} - ${titulo}`, semanaLabel);
                    addPessoaRevisao(base, parte?.leitor || sem?.leitor, roleLabels.leitor, `${roleLabels.leitor} - ${titulo}`, semanaLabel);
                    return;
                }

                addPessoaRevisao(base, parte?.estudante, roleLabels.estudante, titulo, semanaLabel);
                if (parte?.ajudante) {
                    addPessoaRevisao(base, parte.ajudante, roleLabels.ajudante, `${roleLabels.ajudante} - ${titulo}`, semanaLabel);
                }
            });

            Array.from(base.pessoasSemana.entries()).forEach(([pessoa, partesPessoa]) => {
                if (partesPessoa.length > 1) {
                    base.duplicados.push(`${pessoa}: ${partesPessoa.join(', ')}`);
                }
            });
        });

        base.confirmacoesPendentes = (confirmacoes || []).filter((item) => (item?.status || 'pendente') === 'pendente').length;
        base.semContato = [...new Set(base.semContato)];
        const criticos = base.semDesignado.length + base.duplicados.length;

        return {
            ...base,
            criticos,
            ok: criticos === 0
        };
    };

    const checklistRevisao = montarChecklistRevisao();

    const handleDispararEmails = async () => {
        if (!emailJsReady) {
            toast.error(new Error(emailJsConfigMessage), t.emailJsConfigTitle);
            return;
        }

        const fila = coletarTodasDesignacoes();

        if (fila.length === 0) {
            toast.info(t.emailBatchEmpty);
            return;
        }

        if (checklistRevisao.criticos > 0 && !window.confirm(`Há ${checklistRevisao.criticos} pendência(s) importante(s) na revisão final. Deseja enviar mesmo assim?`)) {
            return;
        }

        if (!window.confirm(formatText(t.emailBatchConfirmTpl, { count: fila.length }))) {
            return;
        }

        setEnviandoGlobal(true);
        setProgresso({ total: fila.length, enviados: 0, erros: 0 });

        let contEnviados = 0;
        let contErros = 0;

        for (const item of fila) {
            try {
                const payload = await montarPayloadEmail(item.payload, item.confirmationData);
                await enviarEmailAutomatico(payload);
                markSent(item.msgKey, 'mail');
                await registerNotificationChannelByAssignment(item.confirmationData?.assignmentKey, 'mail');
                contEnviados++;
            } catch (error) {
                console.error("Erro no envio:", error);
                contErros++;
            }

            setProgresso(prev => ({ ...prev, enviados: contEnviados, erros: contErros }));
            // Delay de 500ms para evitar estourar limites da API
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        setEnviandoGlobal(false);
        toast.success(formatText(t.emailBatchDoneTpl, { sent: contEnviados, errors: contErros }));
    };

    const handleEnviarIndividual = async (msgKey, payload) => {
        if (!emailJsReady) {
            toast.error(new Error(emailJsConfigMessage), t.emailJsConfigTitle);
            return;
        }

        setEnviandoInd(prev => ({ ...prev, [msgKey]: true }));
        try {
            const enrichedPayload = await montarPayloadEmail(payload.emailPayload, payload.confirmationData);
            await enviarEmailAutomatico(enrichedPayload);
            markSent(msgKey, 'mail');
            await registerNotificationChannelByAssignment(payload.confirmationData?.assignmentKey, 'mail');
        } catch (error) {
            console.error("Falha ao enviar e-mail individual:", error);
            toast.error(error, t.emailSendError);
        } finally {
            setEnviandoInd(prev => ({ ...prev, [msgKey]: false }));
        }
    };

    const renderButtons = ({ pessoa, msg, msgKey, compact = false, emailPayload, confirmationData }) => {
        const assignmentKey = String(confirmationData?.assignmentKey || '').trim();
        const waSent = isSent(msgKey, 'wa') || hasSentChannel(assignmentKey, 'wa');
        const mailSent = isSent(msgKey, 'mail') || hasSentChannel(assignmentKey, 'mail');
        const reminderSent = isSent(msgKey, 'waReminder') || hasSentChannel(assignmentKey, 'waReminder');
        const hasEmail = !!pessoa?.email;
        const isSending = enviandoInd[msgKey];
        const emailDisabled = !hasEmail || !emailJsReady || isSending || enviandoGlobal;
        const manualState = manualBusy[assignmentKey];
        const manualWeekState = manualBusy[`week:${assignmentKey}`];
        const menuOpen = activeActionMenu === assignmentKey;

        const handleAction = async (callback) => {
            setActiveActionMenu(null);
            await callback();
        };

        return (
            <div className="relative shrink-0">
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveActionMenu(null);
                            handleEnviarWhatsapp(pessoa, msg, msgKey, confirmationData);
                        }}
                        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${waSent
                            ? 'border-slate-200 bg-slate-100 text-slate-500'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                        title={t.btnEnviar}
                    >
                        <MessageCircle size={compact ? 15 : 17} />
                        {waSent && (
                            <CheckCircle
                                size={12}
                                className="absolute -top-1 -right-1 rounded-full bg-white text-emerald-700"
                            />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setActiveActionMenu(null);
                            handleEnviarLembrete(pessoa, msgKey, confirmationData);
                        }}
                        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${reminderSent
                            ? 'border-slate-200 bg-slate-100 text-slate-500'
                            : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                        title={t.btnEnviarLembrete}
                    >
                        <Send size={compact ? 15 : 17} />
                        {reminderSent && (
                            <CheckCircle
                                size={12}
                                className="absolute -top-1 -right-1 rounded-full bg-white text-amber-700"
                            />
                        )}
                    </button>

                    <button
                        type="button"
                        disabled={emailDisabled}
                        onClick={() => {
                            setActiveActionMenu(null);
                            handleEnviarIndividual(msgKey, { emailPayload, confirmationData });
                        }}
                        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${emailDisabled
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                            : mailSent
                                ? 'border-slate-200 bg-slate-100 text-slate-500'
                                : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            }`}
                        title={!hasEmail ? t.noStudentEmailTitle : !emailJsReady ? emailJsConfigMessage : t.btnEnviarEmail}
                    >
                        {isSending ? (
                            <Loader2 size={compact ? 15 : 17} className="animate-spin text-indigo-500" />
                        ) : (
                            <Mail size={compact ? 15 : 17} />
                        )}

                        {mailSent && !isSending && (
                            <CheckCircle
                                size={12}
                                className="absolute -top-1 -right-1 rounded-full bg-white text-indigo-700"
                            />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveActionMenu((prev) => prev === assignmentKey ? null : assignmentKey)}
                        className={`inline-flex h-9 items-center justify-center gap-1 rounded-xl border ${compact ? 'w-9 px-0' : 'px-2.5'} text-[10px] font-black transition ${menuOpen
                            ? 'border-slate-300 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        title={t.acoesRapidas}
                    >
                        <SlidersHorizontal size={14} />
                        {!compact && <span>{t.acoesRapidas}</span>}
                    </button>
                </div>

                {menuOpen && (
                    <div className="absolute right-0 top-11 z-20 w-[18rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/70">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => handleAction(() => handleManualStatus(confirmationData, 'confirmado'))}
                                disabled={!!manualState}
                                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-[11px] font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                                title={t.btnManualConfirmar}
                            >
                                {manualState === 'confirmado' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                {t.btnManualConfirmar}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleAction(() => handleManualStatus(confirmationData, 'nao_pode'))}
                                disabled={!!manualState}
                                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-[11px] font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                                title={t.btnManualRecusar}
                            >
                                {manualState === 'nao_pode' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                {t.btnManualRecusar}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleAction(() => handleManualWeekStatus(confirmationData, 'confirmado'))}
                                disabled={!!manualWeekState}
                                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-[11px] font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                                title={t.btnManualSemanaConfirmar}
                            >
                                {manualWeekState === 'confirmado' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                {t.btnManualSemanaConfirmar}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleAction(() => handleManualWeekStatus(confirmationData, 'imprevisto'))}
                                disabled={!!manualWeekState}
                                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-[11px] font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                                title={t.btnManualSemanaImprevisto}
                            >
                                {manualWeekState === 'imprevisto' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                {t.btnManualSemanaImprevisto}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderCardPessoa = ({ tituloTopo, pessoa, msg, msgKey, compact = false, emailPayload, confirmationData, cardKey }) => {
        const statusUi = getStatusUi(confirmationData?.assignmentKey);
        const weekStatusUi = getWeekStatusUi(confirmationData?.assignmentKey);

        if (compact) {
            return (
                <div key={cardKey} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 truncate">{tituloTopo}</p>
                        <p className="mt-1 text-[15px] font-black text-slate-900 truncate">{pessoa?.nome}</p>

                        {!pessoa?.email && (
                            <p className="mt-1 text-[10px] italic text-rose-400 truncate">{t.noStudentEmail}</p>
                        )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black ${statusUi.chip}`}>
                            {t.statusDesignacao}: {statusUi.label}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black ${weekStatusUi.chip}`}>
                            {t.statusSemana}: {weekStatusUi.label}
                        </span>
                    </div>

                    <div className="mt-3">
                        {renderButtons({ pessoa, msg, msgKey, compact, emailPayload, confirmationData })}
                    </div>
                </div>
            );
        }

        return (
            <div key={cardKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 pr-0 lg:pr-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 truncate">{tituloTopo}</p>
                        <p className="mt-1 text-base font-black text-slate-900 truncate">{pessoa?.nome}</p>

                        {!pessoa?.email && (
                            <p className="mt-1 text-[10px] italic text-rose-400 truncate">{t.noStudentEmail}</p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${statusUi.chip}`}>
                                {t.statusDesignacao}: {statusUi.label}
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${weekStatusUi.chip}`}>
                                {t.statusSemana}: {weekStatusUi.label}
                            </span>
                        </div>
                    </div>

                    {renderButtons({ pessoa, msg, msgKey, compact, emailPayload, confirmationData })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 bg-white p-6 rounded-2xl border max-w-5xl mx-auto w-full overflow-y-auto no-print">
            <div className="mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <MessageCircle className="text-green-600" /> {t.notificarTitulo}
                </h3>
                <p className="text-sm text-gray-500">{t.notificarAviso}</p>
            </div>

            <div className={`mb-4 rounded-2xl border p-4 ${checklistRevisao.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h4 className={`flex items-center gap-2 font-black ${checklistRevisao.ok ? 'text-emerald-800' : 'text-amber-800'}`}>
                            {checklistRevisao.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                            Revisão final
                        </h4>
                        <p className="mt-1 text-xs font-medium text-slate-600">
                            {checklistRevisao.semanas} semana(s), {checklistRevisao.emailsNaFila} e-mail(s) na fila, {checklistRevisao.confirmacoesPendentes} confirmação(ões) pendente(s).
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 xl:grid-cols-7">
                        <div className="rounded-xl bg-white/80 px-3 py-2">
                            <p className="text-lg font-black text-slate-900">{checklistRevisao.semDesignado.length}</p>
                            <p className="text-[9px] font-black uppercase text-slate-500">sem designado</p>
                        </div>
                        <div className="rounded-xl bg-white/80 px-3 py-2">
                            <p className="text-lg font-black text-slate-900">{checklistRevisao.duplicados.length}</p>
                            <p className="text-[9px] font-black uppercase text-slate-500">duplicados</p>
                        </div>
                        <div className="rounded-xl bg-white/80 px-3 py-2">
                            <p className="text-lg font-black text-slate-900">{checklistRevisao.semContato.length}</p>
                            <p className="text-[9px] font-black uppercase text-slate-500">sem contato</p>
                        </div>
                        <div className="rounded-xl bg-white/80 px-3 py-2">
                            <p className="text-lg font-black text-slate-900">{checklistRevisao.emailsNaFila}</p>
                            <p className="text-[9px] font-black uppercase text-slate-500">e-mails</p>
                        </div>
                        <div className="rounded-xl bg-white/80 px-3 py-2">
                            <p className="text-lg font-black text-slate-900">{checklistRevisao.substituicoes}</p>
                            <p className="text-[9px] font-black uppercase text-slate-500">substituições</p>
                        </div>
                        <div className="rounded-xl bg-white/80 px-3 py-2">
                            <p className="text-lg font-black text-slate-900">{checklistRevisao.agendaPendente}</p>
                            <p className="text-[9px] font-black uppercase text-slate-500">agenda</p>
                        </div>
                        <div className="rounded-xl bg-white/80 px-3 py-2">
                            <p className="text-lg font-black text-slate-900">{checklistRevisao.historicoPendente}</p>
                            <p className="text-[9px] font-black uppercase text-slate-500">histórico</p>
                        </div>
                    </div>
                </div>

                {(checklistRevisao.semDesignado.length > 0 || checklistRevisao.duplicados.length > 0 || checklistRevisao.semContato.length > 0 || checklistRevisao.agendaPendente > 0 || checklistRevisao.historicoPendente > 0) && (
                    <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-3">
                        {checklistRevisao.semDesignado.length > 0 && (
                            <div className="rounded-xl bg-white/80 p-3">
                                <p className="font-black text-amber-800">Completar</p>
                                <p className="mt-1 line-clamp-3">{checklistRevisao.semDesignado.slice(0, 3).join(' • ')}</p>
                            </div>
                        )}
                        {checklistRevisao.duplicados.length > 0 && (
                            <div className="rounded-xl bg-white/80 p-3">
                                <p className="font-black text-rose-800">Duplicados</p>
                                <p className="mt-1 line-clamp-3">{checklistRevisao.duplicados.slice(0, 3).join(' • ')}</p>
                            </div>
                        )}
                        {checklistRevisao.semContato.length > 0 && (
                            <div className="rounded-xl bg-white/80 p-3">
                                <p className="font-black text-slate-800">Contato faltando</p>
                                <p className="mt-1 line-clamp-3">{checklistRevisao.semContato.slice(0, 3).join(' • ')}</p>
                            </div>
                        )}
                        {checklistRevisao.agendaPendente > 0 && (
                            <div className="rounded-xl bg-white/80 p-3">
                                <p className="font-black text-sky-800">Google Agenda</p>
                                <p className="mt-1">Sincronize novamente as semanas alteradas depois de revisar as substituições.</p>
                            </div>
                        )}
                        {checklistRevisao.historicoPendente > 0 && (
                            <div className="rounded-xl bg-white/80 p-3">
                                <p className="font-black text-orange-800">Histórico</p>
                                <p className="mt-1">Grave o histórico novamente para refletir as últimas alterações publicadas.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* PAINEL DISPARO GLOBAL */}
            <div className="mb-6 bg-indigo-50 rounded-xl p-5 border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <h4 className="font-bold text-indigo-800 flex items-center gap-2">
                        <Send size={18} /> {t.emailBatchTitle}
                    </h4>
                    <p className="text-xs text-indigo-600 mt-1 max-w-lg">
                        {t.emailBatchDescription}
                    </p>

                    {!emailJsReady && (
                        <p className="mt-2 text-xs font-semibold text-rose-700">
                            {emailJsConfigMessage}
                        </p>
                    )}

                    {enviandoGlobal && (
                        <div className="w-full max-w-md bg-indigo-200 h-2 mt-3 rounded-full overflow-hidden">
                            <div
                                className="bg-indigo-600 h-full transition-all duration-300"
                                style={{ width: `${(progresso.enviados + progresso.erros) / progresso.total * 100}%` }}
                            ></div>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleDispararEmails}
                    disabled={!emailJsReady || enviandoGlobal}
                    title={!emailJsReady ? emailJsConfigMessage : t.emailBatchButton}
                    className={`px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition inline-flex items-center gap-2 shrink-0 ${(!emailJsReady || enviandoGlobal)
                            ? 'bg-indigo-300 text-white cursor-wait'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                >
                    {enviandoGlobal ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    {enviandoGlobal ? formatText(t.emailBatchSendingTpl, { sent: progresso.enviados, total: progresso.total }) : t.emailBatchButton}
                </button>
            </div>

            <div className="space-y-5">
                {semanasParaNotificar.map((sem, sIdx) => {
                    const partes = Array.isArray(sem?.partes) ? sem.partes : [];
                    const dataISO = getDataReuniaoISO(sem);
                    const dataReuniaoFormatada = formatarDataFolha(dataISO, lang);
                    const horarioExib = config?.horarioReuniao ?? config?.horario ?? '';
                    const tipoEvento = getTipoEventoSemana(sem, config);
                    const isVisita = tipoEvento === 'visita';

                    // --- BLOQUEIO DE EVENTO ESPECIAL ---
                    if (tipoEvento !== 'normal' && tipoEvento !== 'visita') {
                        return (
                            <div key={sIdx} className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200 text-center">
                                <div className="flex justify-center mb-3">
                                    <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
                                        {tipoEvento === 'congresso' ? <UsersRound size={32} /> : <Tent size={32} />}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 uppercase mb-1">{sem.semana}</h3>
                                <p className="text-sm font-semibold text-yellow-800 uppercase tracking-wide mb-2">
                                    {formatText(t.assemblyWeekTpl, { type: tipoEvento === 'congresso' ? t.congresso : t.assembleia })}
                                </p>
                                <p className="text-xs text-gray-600">{t.noAssignmentsThisWeek}</p>
                            </div>
                        );
                    }
                    // -----------------------------------

                    const oracoes = partes.filter(isOracao);
                    const primeira = partes[0];
                    const ultima = partes[partes.length - 1];

                    const oracaoInicial =
                        oracoes.find((p) => getOracaoPos(p) === 'inicio') ||
                        (primeira && isOracao(primeira) ? primeira : null);

                    const oracaoFinal =
                        oracoes.find((p) => getOracaoPos(p) === 'final') ||
                        (ultima && isOracao(ultima) ? ultima : null);

                    const partesSemOracao = partes.filter((p) => !isOracao(p));
                    const normSec = (v) => (v ?? '').toString().trim().toLowerCase();

                    const grupos = {
                        tesouros: partesSemOracao.filter((p) => normSec(p?.secao) === 'tesouros'),
                        ministerio: partesSemOracao.filter((p) => normSec(p?.secao) === 'ministerio'),
                        vida: partesSemOracao.filter((p) => normSec(p?.secao) === 'vida'),
                        outros: partesSemOracao.filter((p) => !['tesouros', 'ministerio', 'vida'].includes(normSec(p?.secao))),
                    };

                    const renderParteNormal = (p) => {
                        const estudante = p?.estudante;
                        if (!estudante) return null;

                        const tituloParte = p?.titulo ?? 'Parte';
                        const descricao = (p?.descricao ?? '').toString().trim();
                        const min = (p?.tempo ?? '').toString().trim();
                        const ajud = p?.ajudante;

                        const msgResp = montarMensagemDesignacao({
                            t,
                            lang,
                            config,
                            semana: sem.semana,
                            dataISO,
                            responsavelNome: estudante.nome,
                            ajudanteNome: ajud?.nome || '',
                            tituloParte,
                            descricaoParte: descricao,
                            minutosParte: min,
                            isVisita,
                            incluirLinkAgenda: false
                        });

                        const keyResp = buildMsgKey({
                            dataISO,
                            semana: sem.semana,
                            parteId: p?.id || tituloParte,
                            pessoaId: estudante?.id || estudante?.nome,
                            role: 'resp',
                        });

                        const agendaLinkResp = buildAgendaLink({
                            config,
                            semana: sem.semana,
                            dataISO,
                            tituloParte,
                            responsavelNome: estudante.nome,
                            ajudanteNome: ajud?.nome
                        });

                        const confirmationDataResp = {
                            assignmentKey: keyResp,
                            lang,
                            semana: sem.semana,
                            dataISO,
                            tituloParte,
                            pessoaNome: estudante.nome,
                            role: 'resp',
                            congregacaoNome: config?.nome_cong,
                            agendaLink: agendaLinkResp,
                            sala: p.sala || 'Principal',
                            isVisita
                        };

                        const emailPayloadResp = {
                            Nome: estudante.nome,
                            Ajudante: ajud?.nome || "—",
                            Data: dataReuniaoFormatada,
                            Desig: tituloParte,
                            Sala: p.sala || 'Principal',
                            Link: agendaLinkResp,
                            LinkAgenda: agendaLinkResp,
                            email_destino: estudante.email
                        };

                        let msgAjud = null;
                        let keyAjud = null;
                        let emailPayloadAjud = null;

                        if (ajud?.nome) {
                            msgAjud = montarMensagemDesignacao({
                                t,
                                lang,
                                config,
                                semana: sem.semana,
                                dataISO,
                                responsavelNome: estudante.nome,
                                ajudanteNome: ajud.nome,
                                tituloParte,
                                descricaoParte: descricao,
                                minutosParte: min,
                                isVisita,
                                incluirLinkAgenda: false
                            });

                            keyAjud = buildMsgKey({
                                dataISO,
                                semana: sem.semana,
                                parteId: p?.id || tituloParte,
                                pessoaId: ajud?.id || ajud?.nome,
                                role: 'ajud',
                            });

                            const agendaLinkAjud = buildAgendaLink({
                                config,
                                semana: sem.semana,
                                dataISO,
                                tituloParte: `${t.ajudante} - ${tituloParte}`,
                                responsavelNome: ajud.nome
                            });

                            emailPayloadAjud = {
                                Nome: ajud.nome,
                                Ajudante: "—",
                                Data: dataReuniaoFormatada,
                                Desig: `${t.ajudante} - ${tituloParte}`,
                                Sala: p.sala || 'Principal',
                                Link: agendaLinkAjud,
                                LinkAgenda: agendaLinkAjud,
                                email_destino: ajud.email
                            };

                            emailPayloadAjud.confirmationData = {
                                assignmentKey: keyAjud,
                                lang,
                                semana: sem.semana,
                                dataISO,
                                tituloParte: `${t.ajudante} - ${tituloParte}`,
                                pessoaNome: ajud.nome,
                                role: 'ajud',
                                congregacaoNome: config?.nome_cong,
                                agendaLink: agendaLinkAjud,
                                sala: p.sala || 'Principal',
                                isVisita
                            };
                        }

                        return (
                            <div
                                key={`${p.id || tituloParte}-${estudante?.id || estudante?.nome}`}
                                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                            >
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 truncate">
                                        {tituloParte}
                                    </p>

                                    {descricao && (
                                        <p className="mt-1 text-[11px] italic text-slate-500 line-clamp-2">
                                            {descricao}
                                        </p>
                                    )}
                                </div>

                                <div className={`mt-3 grid gap-3 ${msgAjud && ajud ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
                                    {renderCardPessoa({
                                        tituloTopo: t.designado || 'Designado',
                                        pessoa: estudante,
                                        msg: msgResp,
                                        msgKey: keyResp,
                                        compact: true,
                                        emailPayload: emailPayloadResp,
                                        confirmationData: confirmationDataResp
                                    })}

                                    {msgAjud && ajud && renderCardPessoa({
                                        tituloTopo: t.ajudante,
                                        pessoa: ajud,
                                        msg: msgAjud,
                                        msgKey: keyAjud,
                                        compact: true,
                                        emailPayload: emailPayloadAjud,
                                        confirmationData: emailPayloadAjud?.confirmationData
                                    })}
                                </div>
                            </div>
                        );
                    };

                    const renderOracao = (p, tituloTopoOverride) => {
                        const pessoa = p?.oracao || p?.estudante;
                        if (!pessoa) return null;

                        // AQUI ESTÁ A MÁGICA PARA A ORAÇÃO:
                        // Ignora o texto de "Cântico e Comentários"
                        // e usa APENAS "Oração (inicial)" ou "Oração (final)"
                        const tituloParte = tituloTopoOverride || t.oracao;

                        // Zera a descrição e os minutos pra oração, pois não é necessário na designação
                        const descricao = '';
                        const min = '';

                        const msg = montarMensagemDesignacao({
                            t,
                            lang,
                            config,
                            semana: sem.semana,
                            dataISO,
                            responsavelNome: pessoa.nome,
                            ajudanteNome: '',
                            tituloParte,
                            descricaoParte: descricao,
                            minutosParte: min,
                            isVisita,
                            incluirLinkAgenda: false
                        });

                        const msgKey = buildMsgKey({
                            dataISO,
                            semana: sem.semana,
                            parteId: p?.id || tituloParte,
                            pessoaId: pessoa?.id || pessoa?.nome,
                            role: 'oracao',
                        });

                        const agendaLink = buildAgendaLink({
                            config,
                            semana: sem.semana,
                            dataISO,
                            tituloParte,
                            responsavelNome: pessoa.nome
                        });

                        const confirmationData = {
                            assignmentKey: msgKey,
                            lang,
                            semana: sem.semana,
                            dataISO,
                            tituloParte,
                            pessoaNome: pessoa.nome,
                            role: 'oracao',
                            congregacaoNome: config?.nome_cong,
                            agendaLink,
                            sala: 'Principal',
                            isVisita
                        };

                        const emailPayload = {
                            Nome: pessoa.nome,
                            Ajudante: "—",
                            Data: dataReuniaoFormatada,
                            Desig: tituloParte,
                            Sala: 'Principal',
                            Link: agendaLink,
                            LinkAgenda: agendaLink,
                            email_destino: pessoa.email
                        };

                        return renderCardPessoa({
                            tituloTopo: tituloTopoOverride || t.oracao,
                            pessoa,
                            msg,
                            msgKey,
                            corWa: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                            compact: true,
                            emailPayload,
                            confirmationData
                        });
                    };

                    const renderEstudo = (p) => {
                        const dirigente = p?.dirigente || p?.estudante;
                        const leitor = p?.leitor || sem?.leitor;
                        const tituloBase = p?.titulo || 'Estudo bíblico de congregação';
                        const descricao = (p?.descricao ?? '').toString().trim();
                        const min = (p?.tempo ?? '').toString().trim();
                        const studyCards = [];

                        if (dirigente) {
                            const tituloFinal = `${t.dirigente} - ${tituloBase}`;
                            const msg = montarMensagemDesignacao({
                                t,
                                lang,
                                config,
                                semana: sem.semana,
                                dataISO,
                                responsavelNome: dirigente.nome,
                                ajudanteNome: '',
                                tituloParte: tituloFinal,
                                descricaoParte: descricao,
                                minutosParte: min,
                                isVisita,
                                incluirLinkAgenda: false
                            });

                            const msgKey = buildMsgKey({
                                dataISO,
                                semana: sem.semana,
                                parteId: p?.id || tituloBase,
                                pessoaId: dirigente?.id || dirigente?.nome,
                                role: 'dirigente',
                            });

                            const agendaLink = buildAgendaLink({
                                config,
                                semana: sem.semana,
                                dataISO,
                                tituloParte: tituloFinal,
                                responsavelNome: dirigente.nome
                            });

                            const confirmationData = {
                                assignmentKey: msgKey,
                                lang,
                                semana: sem.semana,
                                dataISO,
                                tituloParte: tituloFinal,
                                pessoaNome: dirigente.nome,
                                role: 'dirigente',
                                congregacaoNome: config?.nome_cong,
                                agendaLink,
                                sala: 'Principal',
                                isVisita
                            };

                            const emailPayload = {
                                Nome: dirigente.nome,
                                Ajudante: "—",
                                Data: dataReuniaoFormatada,
                                Desig: tituloFinal,
                                Sala: 'Principal',
                                Link: agendaLink,
                                LinkAgenda: agendaLink,
                                email_destino: dirigente.email
                            };

                            studyCards.push(renderCardPessoa({
                                cardKey: `${msgKey}-dirigente`,
                                tituloTopo: t.dirigente,
                                pessoa: dirigente,
                                msg,
                                msgKey,
                                compact: true,
                                emailPayload,
                                confirmationData
                            }));
                        }

                        if (leitor) {
                            const tituloFinal = `${t.leitor} - ${tituloBase}`;
                            const msg = montarMensagemDesignacao({
                                t,
                                lang,
                                config,
                                semana: sem.semana,
                                dataISO,
                                responsavelNome: leitor.nome,
                                ajudanteNome: '',
                                tituloParte: tituloFinal,
                                descricaoParte: descricao,
                                minutosParte: min,
                                isVisita,
                                incluirLinkAgenda: false
                            });

                            const msgKey = buildMsgKey({
                                dataISO,
                                semana: sem.semana,
                                parteId: p?.id || tituloBase,
                                pessoaId: leitor?.id || leitor?.nome,
                                role: 'leitor',
                            });

                            const agendaLink = buildAgendaLink({
                                config,
                                semana: sem.semana,
                                dataISO,
                                tituloParte: tituloFinal,
                                responsavelNome: leitor.nome
                            });

                            const confirmationData = {
                                assignmentKey: msgKey,
                                lang,
                                semana: sem.semana,
                                dataISO,
                                tituloParte: tituloFinal,
                                pessoaNome: leitor.nome,
                                role: 'leitor',
                                congregacaoNome: config?.nome_cong,
                                agendaLink,
                                sala: 'Principal',
                                isVisita
                            };

                            const emailPayload = {
                                Nome: leitor.nome,
                                Ajudante: "—",
                                Data: dataReuniaoFormatada,
                                Desig: tituloFinal,
                                Sala: 'Principal',
                                Link: agendaLink,
                                LinkAgenda: agendaLink,
                                email_destino: leitor.email
                            };

                            studyCards.push(renderCardPessoa({
                                cardKey: `${msgKey}-leitor`,
                                tituloTopo: t.leitor,
                                pessoa: leitor,
                                msg,
                                msgKey,
                                compact: true,
                                emailPayload,
                                confirmationData
                            }));
                        }

                        return (
                            <div
                                key={p?.id || `estudo-${sIdx}`}
                                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                            >
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 truncate">
                                        {tituloBase}
                                    </p>

                                    {descricao && (
                                        <p className="mt-1 text-[11px] italic text-slate-500 line-clamp-2">
                                            {descricao}
                                        </p>
                                    )}

                                    {min && (
                                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                                            {min} min
                                        </p>
                                    )}
                                </div>

                                <div className={`mt-3 grid gap-3 ${studyCards.length > 1 ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
                                    {studyCards}
                                </div>
                            </div>
                        );
                    };

                    const renderParte = (p) => {
                        if (isOracao(p)) return renderOracao(p);
                        if (isEstudo(p)) return renderEstudo(p);
                        if (p?.estudante) return renderParteNormal(p);
                        return null;
                    };

                    const renderSecaoBox = (key) => {
                        const arr = grupos[key];
                        if (!arr || !arr.length) return null;

                        const ui = SECAO_UI[key] || SECAO_UI.vida;

                        return (
                            <div className={`rounded-2xl border p-4 ${ui.wrap}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`text-[10px] font-black uppercase tracking-widest text-white px-2 py-1 rounded ${ui.chip}`}>
                                        {t.secoes[key]}
                                    </span>
                                    <span className="text-[10px] font-black text-gray-500">{arr.length}</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {arr.map(renderParte)}
                                </div>
                            </div>
                        );
                    };

                    return (
                        <div key={sIdx} className={`bg-gray-50 rounded-2xl p-4 border ${isVisita ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b pb-3 mb-4">
                                <h4 className="font-black text-blue-900 uppercase text-xs tracking-wider flex items-center gap-2">
                                    {sem.semana}
                                    {isVisita && (
                                        <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded border border-blue-700">
                                            {t.visitTag}
                                        </span>
                                    )}
                                </h4>
                                <div className="text-[11px] text-gray-500 font-bold">
                                    {config?.nome_cong} | {horarioExib} | {dataReuniaoFormatada} {isVisita && t.tuesdayLabel}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                {sem?.presidente &&
                                    (() => {
                                        const tituloParte = t.presidente;

                                        const msg = montarMensagemDesignacao({
                                            t,
                                            lang,
                                            config,
                                            semana: sem.semana,
                                            dataISO,
                                            responsavelNome: sem.presidente.nome,
                                            ajudanteNome: '',
                                            tituloParte,
                                            descricaoParte: '',
                                            minutosParte: '',
                                            isVisita,
                                            incluirLinkAgenda: false
                                        });

                                        const msgKey = buildMsgKey({
                                            dataISO,
                                            semana: sem.semana,
                                            parteId: 'presidente',
                                            pessoaId: sem?.presidente?.id || sem?.presidente?.nome,
                                            role: 'presidente',
                                        });

                                        const agendaLink = buildAgendaLink({
                                            config,
                                            semana: sem.semana,
                                            dataISO,
                                            tituloParte,
                                            responsavelNome: sem.presidente.nome
                                        });

                                        const confirmationData = {
                                            assignmentKey: msgKey,
                                            lang,
                                            semana: sem.semana,
                                            dataISO,
                                            tituloParte,
                                            pessoaNome: sem.presidente.nome,
                                            role: 'presidente',
                                            congregacaoNome: config?.nome_cong,
                                            agendaLink,
                                            sala: 'Principal',
                                            isVisita
                                        };

                                        const emailPayload = {
                                            Nome: sem.presidente.nome,
                                            Ajudante: "—",
                                            Data: dataReuniaoFormatada,
                                            Desig: tituloParte,
                                            Sala: 'Principal',
                                            Link: agendaLink,
                                            LinkAgenda: agendaLink,
                                            email_destino: sem.presidente.email
                                        };

                                        return renderCardPessoa({
                                            tituloTopo: t.presidente,
                                            pessoa: sem.presidente,
                                            msg,
                                            msgKey,
                                            corWa: 'bg-green-100 text-green-700 hover:bg-green-200',
                                            emailPayload,
                                            confirmationData
                                        });
                                    })()}

                                {oracaoInicial && renderOracao(oracaoInicial, `${t.oracao} (inicial)`)}
                            </div>

                            <div className="space-y-4">
                                {renderSecaoBox('tesouros')}
                                {renderSecaoBox('ministerio')}
                                {renderSecaoBox('vida')}

                                {grupos.outros.length > 0 && (
                                    <div className="rounded-2xl border p-4 bg-white">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">{t.secoes.outros}</span>
                                            <span className="text-[10px] font-black text-gray-500">{grupos.outros.length}</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {grupos.outros.map(renderParte)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {oracaoFinal && oracaoFinal !== oracaoInicial && (
                                <div className="rounded-2xl border p-4 bg-white mt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">{t.closing}</span>
                                        <span className="text-[10px] font-black text-gray-500">1</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {renderOracao(oracaoFinal, `${t.oracao} (final)`)}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RevisarEnviarNotificarTab;
