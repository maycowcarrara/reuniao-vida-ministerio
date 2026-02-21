import React, { useState } from 'react';
import { CheckCircle, Mail, MessageCircle, Briefcase, Tent, UsersRound, Loader2, Send } from 'lucide-react';

import { formatarDataFolha } from '../utils/revisarEnviar/dates';
import { montarMensagemDesignacao } from '../utils/revisarEnviar/messages';
import { enviarEmailAutomatico } from '../utils/revisarEnviar/enviadorEmail';
import { buildAgendaLink } from '../utils/revisarEnviar/links';

const SECAO_UI = {
    tesouros: { chip: 'bg-slate-600', wrap: 'border-slate-200 bg-slate-50', text: 'text-slate-900' },
    ministerio: { chip: 'bg-yellow-600', wrap: 'border-amber-200 bg-amber-50', text: 'text-amber-950' },
    vida: { chip: 'bg-red-700', wrap: 'border-rose-200 bg-rose-50', text: 'text-rose-950' },
};

const RevisarEnviarNotificarTab = ({
    semanasParaNotificar,
    config,
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

    // --- COLETOR DE E-MAILS PARA O DISPARO GLOBAL ---
    const coletarTodasDesignacoes = () => {
        const lista = [];

        semanasParaNotificar.forEach(sem => {
            if (sem.evento && sem.evento !== 'normal' && sem.evento !== 'visita') return;

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

                    // Só adiciona na fila se ainda não foi enviado!
                    if (!isSent(msgKey, 'mail')) {
                        lista.push({
                            msgKey,
                            payload: {
                                Nome: pessoa.nome,
                                Ajudante: ajudante?.nome || "—",
                                Data: dataReuniaoFormatada,
                                Desig: titulo,
                                Sala: salaOverride || 'Principal',
                                Link: buildAgendaLink({
                                    config,
                                    semana: sem.semana,
                                    dataISO,
                                    tituloParte: titulo,
                                    responsavelNome: pessoa.nome,
                                    ajudanteNome: ajudante?.nome
                                }),
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

    const handleDispararEmails = async () => {
        const fila = coletarTodasDesignacoes();

        if (fila.length === 0) {
            alert("Nenhum e-mail pendente ou válido encontrado para envio automático nas semanas ativas.");
            return;
        }

        if (!window.confirm(`Você está prestes a enviar automaticamente ${fila.length} e-mails.\nDeseja continuar?`)) {
            return;
        }

        setEnviandoGlobal(true);
        setProgresso({ total: fila.length, enviados: 0, erros: 0 });

        let contEnviados = 0;
        let contErros = 0;

        for (const item of fila) {
            try {
                await enviarEmailAutomatico(item.payload);
                markSent(item.msgKey, 'mail');
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
        alert(`Disparo concluído!\n✅ Enviados com sucesso: ${contEnviados}\n⚠️ Erros: ${contErros}`);
    };

    const handleEnviarIndividual = async (msgKey, payload) => {
        setEnviandoInd(prev => ({ ...prev, [msgKey]: true }));
        try {
            await enviarEmailAutomatico(payload);
            markSent(msgKey, 'mail');
        } catch (error) {
            alert("Falha ao enviar e-mail. Verifique a configuração do EmailJS.");
        } finally {
            setEnviandoInd(prev => ({ ...prev, [msgKey]: false }));
        }
    };

    const renderButtons = ({ pessoa, msg, msgKey, corWa, compact = false, emailPayload }) => {
        const waSent = isSent(msgKey, 'wa');
        const mailSent = isSent(msgKey, 'mail');
        const hasEmail = !!pessoa?.email;
        const isSending = enviandoInd[msgKey];

        return (
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => {
                        enviarZap(pessoa, msg);
                        markSent(msgKey, 'wa');
                    }}
                    className={`relative ${compact ? 'p-1.5' : 'p-2'} rounded-lg transition ${waSent ? 'bg-gray-200 text-gray-600' : corWa || 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                    title={t.btnEnviar}
                >
                    <MessageCircle size={compact ? 16 : 18} />
                    {waSent && (
                        <CheckCircle
                            size={compact ? 12 : 14}
                            className="absolute -top-1 -right-1 text-green-700 bg-white rounded-full"
                        />
                    )}
                </button>

                <button
                    disabled={!hasEmail || isSending || enviandoGlobal}
                    onClick={() => handleEnviarIndividual(msgKey, emailPayload)}
                    className={`relative ${compact ? 'p-1.5' : 'p-2'} rounded-lg transition ${!hasEmail ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' :
                            mailSent ? 'bg-gray-200 text-gray-600' :
                                'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                        }`}
                    title={!hasEmail ? "Aluno sem e-mail cadastrado" : t.btnEnviarEmail}
                >
                    {isSending ? (
                        <Loader2 size={compact ? 16 : 18} className="animate-spin text-indigo-500" />
                    ) : (
                        <Mail size={compact ? 16 : 18} />
                    )}

                    {mailSent && !isSending && (
                        <CheckCircle
                            size={compact ? 12 : 14}
                            className="absolute -top-1 -right-1 text-indigo-700 bg-white rounded-full"
                        />
                    )}
                </button>
            </div>
        );
    };

    const renderCardPessoa = ({ tituloTopo, pessoa, msg, msgKey, corWa, compact = false, emailPayload }) => (
        <div className={`bg-white ${compact ? 'p-2' : 'p-3'} rounded-lg shadow-sm flex justify-between items-center border`}>
            <div className="min-w-0 pr-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{tituloTopo}</p>
                <p className={`${compact ? 'text-[13px]' : 'text-sm'} font-bold truncate`}>{pessoa?.nome}</p>

                {pessoa?.email && (
                    <p className="text-[10px] text-gray-400 truncate">{pessoa.email}</p>
                )}
                {!pessoa?.email && (
                    <p className="text-[9px] text-red-400 italic truncate">Sem e-mail</p>
                )}
            </div>
            {renderButtons({ pessoa, msg, msgKey, corWa, compact, emailPayload })}
        </div>
    );

    return (
        <div className="flex-1 bg-white p-6 rounded-2xl border max-w-5xl mx-auto w-full overflow-y-auto no-print">
            <div className="mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <MessageCircle className="text-green-600" /> {t.notificarTitulo}
                </h3>
                <p className="text-sm text-gray-500">{t.notificarAviso}</p>
            </div>

            {/* PAINEL DISPARO GLOBAL */}
            <div className="mb-6 bg-indigo-50 rounded-xl p-5 border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <h4 className="font-bold text-indigo-800 flex items-center gap-2">
                        <Send size={18} /> Disparo Automático de E-mails
                    </h4>
                    <p className="text-xs text-indigo-600 mt-1 max-w-lg">
                        Envia todas as designações não notificadas de uma só vez usando o modelo S-89 Oficial no corpo do E-mail.
                    </p>

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
                    disabled={enviandoGlobal}
                    className={`px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition inline-flex items-center gap-2 shrink-0 ${enviandoGlobal
                            ? 'bg-indigo-300 text-white cursor-wait'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                >
                    {enviandoGlobal ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    {enviandoGlobal ? `Enviando (${progresso.enviados}/${progresso.total})` : "Disparar E-mails Pendentes"}
                </button>
            </div>

            <div className="space-y-5">
                {semanasParaNotificar.map((sem, sIdx) => {
                    const partes = Array.isArray(sem?.partes) ? sem.partes : [];
                    const dataISO = getDataReuniaoISO(sem);
                    const dataReuniaoFormatada = formatarDataFolha(dataISO, lang);
                    const horarioExib = config?.horarioReuniao ?? config?.horario ?? '';
                    const isVisita = sem.evento === 'visita';

                    // --- BLOQUEIO DE EVENTO ESPECIAL ---
                    if (sem.evento && sem.evento !== 'normal' && sem.evento !== 'visita') {
                        return (
                            <div key={sIdx} className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200 text-center">
                                <div className="flex justify-center mb-3">
                                    <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
                                        {sem.evento === 'congresso' ? <UsersRound size={32} /> : <Tent size={32} />}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 uppercase mb-1">{sem.semana}</h3>
                                <p className="text-sm font-semibold text-yellow-800 uppercase tracking-wide mb-2">
                                    Semana de {sem.evento === 'congresso' ? 'Congresso' : 'Assembleia'}
                                </p>
                                <p className="text-xs text-gray-600">Não há designações para notificar nesta semana.</p>
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
                            isVisita
                        });

                        const keyResp = buildMsgKey({
                            dataISO,
                            semana: sem.semana,
                            parteId: p?.id || tituloParte,
                            pessoaId: estudante?.id || estudante?.nome,
                            role: 'resp',
                        });

                        const emailPayloadResp = {
                            Nome: estudante.nome,
                            Ajudante: ajud?.nome || "—",
                            Data: dataReuniaoFormatada,
                            Desig: tituloParte,
                            Sala: p.sala || 'Principal',
                            Link: buildAgendaLink({
                                config,
                                semana: sem.semana,
                                dataISO,
                                tituloParte: tituloParte,
                                responsavelNome: estudante.nome,
                                ajudanteNome: ajud?.nome
                            }),
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
                                isVisita
                            });

                            keyAjud = buildMsgKey({
                                dataISO,
                                semana: sem.semana,
                                parteId: p?.id || tituloParte,
                                pessoaId: ajud?.id || ajud?.nome,
                                role: 'ajud',
                            });

                            emailPayloadAjud = {
                                Nome: ajud.nome,
                                Ajudante: "—",
                                Data: dataReuniaoFormatada,
                                Desig: `${t.ajudante} - ${tituloParte}`,
                                Sala: p.sala || 'Principal',
                                Link: buildAgendaLink({
                                    config,
                                    semana: sem.semana,
                                    dataISO,
                                    tituloParte: `${t.ajudante} - ${tituloParte}`,
                                    responsavelNome: ajud.nome
                                }),
                                email_destino: ajud.email
                            };
                        }

                        return (
                            <div
                                key={`${p.id || tituloParte}-${estudante?.id || estudante?.nome}`}
                                className="bg-white p-3 rounded-lg shadow-sm border flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{tituloParte}</p>
                                    <p className="text-sm font-bold truncate">{estudante.nome}</p>

                                    {!estudante.email && (
                                        <p className="text-[9px] text-red-400 italic">Sem e-mail</p>
                                    )}

                                    {ajud?.nome && (
                                        <p className="text-[12px] print:text-[11px] text-blue-700 font-bold truncate">
                                            {t.ajudante}: {ajud.nome}
                                        </p>
                                    )}
                                    {descricao && (
                                        <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-2">{descricao}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {renderButtons({
                                        pessoa: estudante,
                                        msg: msgResp,
                                        msgKey: keyResp,
                                        corWa: 'bg-green-100 text-green-700 hover:bg-green-200',
                                        emailPayload: emailPayloadResp
                                    })}

                                    {msgAjud && ajud && (
                                        <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
                                            {renderButtons({
                                                pessoa: ajud,
                                                msg: msgAjud,
                                                msgKey: keyAjud,
                                                corWa: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                                                emailPayload: emailPayloadAjud
                                            })}
                                        </div>
                                    )}
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
                            isVisita
                        });

                        const msgKey = buildMsgKey({
                            dataISO,
                            semana: sem.semana,
                            parteId: p?.id || tituloParte,
                            pessoaId: pessoa?.id || pessoa?.nome,
                            role: 'oracao',
                        });

                        const emailPayload = {
                            Nome: pessoa.nome,
                            Ajudante: "—",
                            Data: dataReuniaoFormatada,
                            Desig: tituloParte,
                            Sala: 'Principal',
                            Link: buildAgendaLink({
                                config,
                                semana: sem.semana,
                                dataISO,
                                tituloParte: tituloParte,
                                responsavelNome: pessoa.nome
                            }),
                            email_destino: pessoa.email
                        };

                        return renderCardPessoa({
                            tituloTopo: tituloTopoOverride || t.oracao,
                            pessoa,
                            msg,
                            msgKey,
                            corWa: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                            compact: true,
                            emailPayload
                        });
                    };

                    const renderEstudo = (p) => {
                        const dirigente = p?.dirigente || p?.estudante;
                        const leitor = p?.leitor || sem?.leitor;
                        const cards = [];

                        const tituloBase = p?.titulo || 'Estudo bíblico de congregação';
                        const descricao = (p?.descricao ?? '').toString().trim();
                        const min = (p?.tempo ?? '').toString().trim();

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
                                isVisita
                            });

                            const msgKey = buildMsgKey({
                                dataISO,
                                semana: sem.semana,
                                parteId: p?.id || tituloBase,
                                pessoaId: dirigente?.id || dirigente?.nome,
                                role: 'dirigente',
                            });

                            const emailPayload = {
                                Nome: dirigente.nome,
                                Ajudante: "—",
                                Data: dataReuniaoFormatada,
                                Desig: tituloFinal,
                                Sala: 'Principal',
                                Link: buildAgendaLink({
                                    config,
                                    semana: sem.semana,
                                    dataISO,
                                    tituloParte: tituloFinal,
                                    responsavelNome: dirigente.nome
                                }),
                                email_destino: dirigente.email
                            };

                            cards.push(
                                <React.Fragment key={`dir-${p?.id || tituloBase}`}>
                                    {renderCardPessoa({
                                        tituloTopo: t.dirigente,
                                        pessoa: dirigente,
                                        msg,
                                        msgKey,
                                        corWa: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
                                        emailPayload
                                    })}
                                </React.Fragment>
                            );
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
                                isVisita
                            });

                            const msgKey = buildMsgKey({
                                dataISO,
                                semana: sem.semana,
                                parteId: p?.id || tituloBase,
                                pessoaId: leitor?.id || leitor?.nome,
                                role: 'leitor',
                            });

                            const emailPayload = {
                                Nome: leitor.nome,
                                Ajudante: "—",
                                Data: dataReuniaoFormatada,
                                Desig: tituloFinal,
                                Sala: 'Principal',
                                Link: buildAgendaLink({
                                    config,
                                    semana: sem.semana,
                                    dataISO,
                                    tituloParte: tituloFinal,
                                    responsavelNome: leitor.nome
                                }),
                                email_destino: leitor.email
                            };

                            cards.push(
                                <React.Fragment key={`lei-${p?.id || tituloBase}`}>
                                    {renderCardPessoa({
                                        tituloTopo: t.leitor,
                                        pessoa: leitor,
                                        msg,
                                        msgKey,
                                        corWa: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
                                        emailPayload
                                    })}
                                </React.Fragment>
                            );
                        }

                        return <React.Fragment key={p?.id || `estudo-${sIdx}`}>{cards}</React.Fragment>;
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
                                            VISITA SC
                                        </span>
                                    )}
                                </h4>
                                <div className="text-[11px] text-gray-500 font-bold">
                                    {config?.nome_cong} | {horarioExib} | {dataReuniaoFormatada} {isVisita && "(Terça-feira)"}
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
                                            isVisita
                                        });

                                        const msgKey = buildMsgKey({
                                            dataISO,
                                            semana: sem.semana,
                                            parteId: 'presidente',
                                            pessoaId: sem?.presidente?.id || sem?.presidente?.nome,
                                            role: 'presidente',
                                        });

                                        const emailPayload = {
                                            Nome: sem.presidente.nome,
                                            Ajudante: "—",
                                            Data: dataReuniaoFormatada,
                                            Desig: tituloParte,
                                            Sala: 'Principal',
                                            Link: buildAgendaLink({
                                                config,
                                                semana: sem.semana,
                                                dataISO,
                                                tituloParte: tituloParte,
                                                responsavelNome: sem.presidente.nome
                                            }),
                                            email_destino: sem.presidente.email
                                        };

                                        return renderCardPessoa({
                                            tituloTopo: t.presidente,
                                            pessoa: sem.presidente,
                                            msg,
                                            msgKey,
                                            corWa: 'bg-green-100 text-green-700 hover:bg-green-200',
                                            emailPayload
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
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Outros</span>
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
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Encerramento</span>
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