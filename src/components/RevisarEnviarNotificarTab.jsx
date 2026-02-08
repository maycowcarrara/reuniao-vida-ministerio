import React from 'react';
import { CheckCircle, Mail, MessageCircle, Briefcase, Tent, UsersRound } from 'lucide-react';

import { formatarDataFolha } from '../utils/revisarEnviar/dates';
import { montarMensagemDesignacao } from '../utils/revisarEnviar/messages';

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
    enviarEmail,
    buildMsgKey,
    markSent,
    isSent,
}) => {
    const renderButtons = ({ pessoa, msg, subject, msgKey, corWa, compact = false }) => {
        const waSent = isSent(msgKey, 'wa');
        const mailSent = isSent(msgKey, 'mail');

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
                    onClick={() => {
                        enviarEmail(pessoa, subject, msg);
                        markSent(msgKey, 'mail');
                    }}
                    className={`relative ${compact ? 'p-1.5' : 'p-2'} rounded-lg transition ${mailSent ? 'bg-gray-200 text-gray-600' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                        }`}
                    title={t.btnEnviarEmail}
                >
                    <Mail size={compact ? 16 : 18} />
                    {mailSent && (
                        <CheckCircle
                            size={compact ? 12 : 14}
                            className="absolute -top-1 -right-1 text-green-700 bg-white rounded-full"
                        />
                    )}
                </button>
            </div>
        );
    };

    const renderCardPessoa = ({ tituloTopo, pessoa, msg, subject, msgKey, corWa, compact = false }) => (
        <div className={`bg-white ${compact ? 'p-2' : 'p-3'} rounded-lg shadow-sm flex justify-between items-center border`}>
            <div className="min-w-0 pr-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{tituloTopo}</p>
                <p className={`${compact ? 'text-[13px]' : 'text-sm'} font-bold truncate`}>{pessoa?.nome}</p>
                {pessoa?.email && <p className="text-[10px] text-gray-400 truncate">{pessoa.email}</p>}
            </div>
            {renderButtons({ pessoa, msg, subject, msgKey, corWa, compact })}
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

            <div className="space-y-5">
                {semanasParaNotificar.map((sem, sIdx) => {
                    const partes = Array.isArray(sem?.partes) ? sem.partes : [];
                    const dataISO = getDataReuniaoISO(sem);
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
                            isVisita // <--- Passando flag de visita
                        });

                        const subjectResp = `${sem.semana} - ${tituloParte}`;
                        const keyResp = buildMsgKey({
                            dataISO,
                            semana: sem.semana,
                            parteId: p?.id || tituloParte,
                            pessoaId: estudante?.id || estudante?.nome,
                            role: 'resp',
                        });

                        const msgAjud = ajud?.nome
                            ? montarMensagemDesignacao({
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
                                isVisita // <--- Passando flag de visita
                            })
                            : null;

                        const subjectAjud = `${sem.semana} - ${t.ajudante} - ${tituloParte}`;
                        const keyAjud = buildMsgKey({
                            dataISO,
                            semana: sem.semana,
                            parteId: p?.id || tituloParte,
                            pessoaId: ajud?.id || ajud?.nome,
                            role: 'ajud',
                        });

                        return (
                            <div
                                key={`${p.id || tituloParte}-${estudante?.id || estudante?.nome}`}
                                className="bg-white p-3 rounded-lg shadow-sm border flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{tituloParte}</p>
                                    <p className="text-sm font-bold truncate">{estudante.nome}</p>
                                    {ajud?.nome && (
                                        <p className="text-[12px] print:text-[11px] text-blue-700 font-bold truncate">
                                            {t.ajudante}: {ajud.nome}
                                        </p>
                                    )}
                                    {descricao && <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-2">{descricao}</p>}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {renderButtons({
                                        pessoa: estudante,
                                        msg: msgResp,
                                        subject: subjectResp,
                                        msgKey: keyResp,
                                        corWa: 'bg-green-100 text-green-700 hover:bg-green-200',
                                    })}

                                    {msgAjud && ajud && (
                                        <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
                                            {renderButtons({
                                                pessoa: ajud,
                                                msg: msgAjud,
                                                subject: subjectAjud,
                                                msgKey: keyAjud,
                                                corWa: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
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

                        const tituloParte = p?.titulo || t.oracao;
                        const descricao = (p?.descricao ?? '').toString().trim();
                        const min = (p?.tempo ?? '').toString().trim();

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
                            isVisita // <--- Passando flag de visita
                        });

                        const subject = `${sem.semana} - ${tituloParte}`;
                        const msgKey = buildMsgKey({
                            dataISO,
                            semana: sem.semana,
                            parteId: p?.id || tituloParte,
                            pessoaId: pessoa?.id || pessoa?.nome,
                            role: 'oracao',
                        });

                        return renderCardPessoa({
                            tituloTopo: tituloTopoOverride || t.oracao,
                            pessoa,
                            msg,
                            subject,
                            msgKey,
                            corWa: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                            compact: true,
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
                            const msg = montarMensagemDesignacao({
                                t,
                                lang,
                                config,
                                semana: sem.semana,
                                dataISO,
                                responsavelNome: dirigente.nome,
                                ajudanteNome: '',
                                tituloParte: `${t.dirigente} - ${tituloBase}`,
                                descricaoParte: descricao,
                                minutosParte: min,
                                isVisita // <--- Passando flag de visita
                            });

                            const subject = `${sem.semana} - ${t.dirigente} - ${tituloBase}`;
                            const msgKey = buildMsgKey({
                                dataISO,
                                semana: sem.semana,
                                parteId: p?.id || tituloBase,
                                pessoaId: dirigente?.id || dirigente?.nome,
                                role: 'dirigente',
                            });

                            cards.push(
                                <React.Fragment key={`dir-${p?.id || tituloBase}`}>
                                    {renderCardPessoa({
                                        tituloTopo: t.dirigente,
                                        pessoa: dirigente,
                                        msg,
                                        subject,
                                        msgKey,
                                        corWa: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
                                    })}
                                </React.Fragment>
                            );
                        }

                        if (leitor) {
                            const msg = montarMensagemDesignacao({
                                t,
                                lang,
                                config,
                                semana: sem.semana,
                                dataISO,
                                responsavelNome: leitor.nome,
                                ajudanteNome: '',
                                tituloParte: `${t.leitor} - ${tituloBase}`,
                                descricaoParte: descricao,
                                minutosParte: min,
                                isVisita // <--- Passando flag de visita
                            });

                            const subject = `${sem.semana} - ${t.leitor} - ${tituloBase}`;
                            const msgKey = buildMsgKey({
                                dataISO,
                                semana: sem.semana,
                                parteId: p?.id || tituloBase,
                                pessoaId: leitor?.id || leitor?.nome,
                                role: 'leitor',
                            });

                            cards.push(
                                <React.Fragment key={`lei-${p?.id || tituloBase}`}>
                                    {renderCardPessoa({
                                        tituloTopo: t.leitor,
                                        pessoa: leitor,
                                        msg,
                                        subject,
                                        msgKey,
                                        corWa: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{arr.map(renderParte)}</div>
                            </div>
                        );
                    };

                    return (
                        <div key={sIdx} className={`bg-gray-50 rounded-2xl p-4 border ${isVisita ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b pb-3 mb-4">
                                <h4 className="font-black text-blue-900 uppercase text-xs tracking-wider flex items-center gap-2">
                                    {sem.semana}
                                    {/* --- BADGE VISITA SC (NOTIFICAÇÃO) --- */}
                                    {isVisita && (
                                        <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded border border-blue-700">
                                            VISITA SC
                                        </span>
                                    )}
                                </h4>
                                <div className="text-[11px] text-gray-500 font-bold">
                                    {config?.nome_cong} | {horarioExib} | {formatarDataFolha(dataISO, lang)} {isVisita && "(Terça-feira)"}
                                </div>
                            </div>

                            {/* Abertura: Presidente + Oração inicial */}
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
                                            isVisita // <--- Passando flag de visita
                                        });

                                        const subject = `${sem.semana} - ${tituloParte}`;
                                        const msgKey = buildMsgKey({
                                            dataISO,
                                            semana: sem.semana,
                                            parteId: 'presidente',
                                            pessoaId: sem?.presidente?.id || sem?.presidente?.nome,
                                            role: 'presidente',
                                        });

                                        return renderCardPessoa({
                                            tituloTopo: t.presidente,
                                            pessoa: sem.presidente,
                                            msg,
                                            subject,
                                            msgKey,
                                            corWa: 'bg-green-100 text-green-700 hover:bg-green-200',
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{grupos.outros.map(renderParte)}</div>
                                    </div>
                                )}
                            </div>

                            {/* Encerramento: Oração final (se existir e não duplicar a inicial) */}
                            {oracaoFinal && oracaoFinal !== oracaoInicial && (
                                <div className="rounded-2xl border p-4 bg-white mt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Encerramento</span>
                                        <span className="text-[10px] font-black text-gray-500">1</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{renderOracao(oracaoFinal, `${t.oracao} (final)`)}</div>
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