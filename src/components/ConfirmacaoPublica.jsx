import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { normalizeLanguage, syncDocumentLanguage } from '../config/appConfig';
import { getSectionMessages } from '../i18n';
import {
    getPublicConfirmation,
    respondToPublicConfirmation,
    respondToPublicWeekReminder
} from '../services/confirmacoesPublicas';
import { formatarDataFolha } from '../utils/revisarEnviar/dates';

const STATUS_STYLES = {
    pendente: 'bg-amber-100 text-amber-800 border-amber-200',
    confirmado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    nao_pode: 'bg-rose-100 text-rose-800 border-rose-200'
};

const getTodayLocalISODate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function ConfirmacaoPublica() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [registro, setRegistro] = useState(null);

    const lang = normalizeLanguage(registro?.lang);
    const t = useMemo(() => getSectionMessages('confirmacaoPublica', lang), [lang]);
    const quadroPath = '/quadro';
    const isWeekFlow = (searchParams.get('f') || '').trim().toLowerCase() === 'w';
    const registroIndisponivel = Boolean(registro?.isUnavailable);

    useEffect(() => {
        syncDocumentLanguage(lang);
    }, [lang]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('quadro_auth', 'true');
    }, []);

    const limparRespostaDaUrl = useCallback(() => {
        if (!searchParams.get('r')) return;

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('r');
        const nextSearch = nextParams.toString();

        navigate(
            {
                search: nextSearch ? `?${nextSearch}` : ''
            },
            { replace: true }
        );
    }, [navigate, searchParams]);

    const carregarRegistro = useCallback(async ({ silent = false } = {}) => {
        if (!token) {
            setRegistro(null);
            setLoading(false);
            return null;
        }

        if (!silent) {
            setLoading(true);
        }

        try {
            const data = await getPublicConfirmation(token);
            setRegistro(data);
            return data;
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [token]);

    useEffect(() => {
        carregarRegistro();
    }, [carregarRegistro]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const refresh = () => {
            carregarRegistro({ silent: true });
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        };

        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [carregarRegistro]);

    useEffect(() => {
        const responseCode = (searchParams.get('r') || '').trim().toLowerCase();
        const validCodes = isWeekFlow ? ['c', 'i'] : ['a', 'n'];
        if (!registro || registroIndisponivel || !validCodes.includes(responseCode) || saving) return;
        if (registro?.autoResponseApplied === responseCode) return;

        const status = isWeekFlow
            ? (responseCode === 'c' ? 'confirmado' : 'imprevisto')
            : (responseCode === 'a' ? 'confirmado' : 'nao_pode');

        const aplicarResposta = async () => {
            setSaving(true);
            try {
                const atualizado = isWeekFlow
                    ? await respondToPublicWeekReminder(token, status)
                    : await respondToPublicConfirmation(token, status);
                setRegistro({ ...atualizado, autoResponseApplied: responseCode, saveError: false, saveLockedPast: false });
            } catch (error) {
                const atualizado = await carregarRegistro({ silent: true });
                if (atualizado) {
                    setRegistro({
                        ...atualizado,
                        saveError: !atualizado?.isUnavailable && error?.code !== 'past_event_change_locked',
                        saveLockedPast: error?.code === 'past_event_change_locked',
                        autoResponseApplied: responseCode
                    });
                } else {
                    setRegistro(null);
                }
            } finally {
                setSaving(false);
                limparRespostaDaUrl();
            }
        };

        aplicarResposta();
    }, [carregarRegistro, isWeekFlow, limparRespostaDaUrl, registro, registroIndisponivel, saving, searchParams, token]);

    const currentStatus = isWeekFlow
        ? (registro?.weekReminderStatus || 'nao_enviado')
        : (registro?.status || 'pendente');

    const statusLabel = isWeekFlow
        ? currentStatus === 'confirmado'
            ? t.semanaConfirmada
            : currentStatus === 'imprevisto'
                ? t.semanaImprevisto
                : currentStatus === 'nao_enviado'
                    ? t.semanaNaoEnviada
                    : t.semanaPendente
        : currentStatus === 'confirmado'
            ? t.confirmado
            : currentStatus === 'nao_pode'
                ? t.naoPode
                : t.pendente;

    const responder = async (status) => {
        setSaving(true);
        try {
            const atualizado = isWeekFlow
                ? await respondToPublicWeekReminder(token, status)
                : await respondToPublicConfirmation(token, status);
            setRegistro({ ...atualizado, saveError: false, saveLockedPast: false });
        } catch (error) {
            const atualizado = await carregarRegistro({ silent: true });
            if (atualizado) {
                setRegistro({
                    ...atualizado,
                    saveError: !atualizado?.isUnavailable && error?.code !== 'past_event_change_locked',
                    saveLockedPast: error?.code === 'past_event_change_locked'
                });
            } else {
                setRegistro(null);
            }
        } finally {
            setSaving(false);
            limparRespostaDaUrl();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="flex items-center gap-3 text-slate-600 font-bold">
                    <Loader2 className="animate-spin" size={20} />
                    <span>{t.carregando}</span>
                </div>
            </div>
        );
    }

    if (!registro) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-sm p-8 text-center space-y-5">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                        <XCircle size={28} />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-black text-slate-900">{t.titulo}</h1>
                        <p className="text-sm text-slate-500">{t.tokenInvalido}</p>
                    </div>
                    <Link
                        to={quadroPath}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
                    >
                        {t.voltarQuadro}
                    </Link>
                </div>
            </div>
        );
    }

    const dataFmt = registro?.dataISO ? formatarDataFolha(registro.dataISO, lang) : '—';

    if (registroIndisponivel) {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fee2e2,_#fff7ed_40%,_#f8fafc)] flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[1.75rem] shadow-xl shadow-slate-200/60 overflow-hidden">
                    <div className="bg-slate-900 text-white px-5 py-5 sm:px-6">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-rose-200 font-black">
                            {registro?.congregacaoNome || t.titulo}
                        </p>
                        <h1 className="mt-2 text-2xl sm:text-[2rem] font-black leading-tight">{t.titulo}</h1>
                        <p className="mt-2 max-w-2xl text-sm text-slate-300">{t.indisponivelDescricao}</p>
                    </div>

                    <div className="p-5 sm:p-6">
                        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                                    <XCircle size={24} />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-lg font-black text-rose-900">{t.indisponivelTitulo}</h2>
                                    <p className="text-sm text-rose-800">{t.indisponivelDescricao}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.data}</p>
                                <p className="mt-1.5 text-sm font-bold text-slate-900">{dataFmt}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.designado}</p>
                                <p className="mt-1.5 text-sm font-bold text-slate-900">{registro?.pessoaNome || '—'}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.parte}</p>
                                <p className="mt-1.5 text-base font-black text-slate-900">{registro?.tituloParte || '—'}</p>
                            </div>
                        </div>

                        <div className="mt-5">
                            <Link
                                to={quadroPath}
                                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
                            >
                                {t.voltarQuadro}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const statusClass = isWeekFlow
        ? currentStatus === 'confirmado'
            ? STATUS_STYLES.confirmado
            : currentStatus === 'imprevisto'
                ? STATUS_STYLES.nao_pode
                : STATUS_STYLES.pendente
        : STATUS_STYLES[registro?.status] || STATUS_STYLES.pendente;
    const jaConfirmou = currentStatus === 'confirmado';
    const jaRecusou = isWeekFlow ? currentStatus === 'imprevisto' : currentStatus === 'nao_pode';
    const jaRespondeu = isWeekFlow
        ? currentStatus === 'confirmado' || currentStatus === 'imprevisto'
        : currentStatus === 'confirmado' || currentStatus === 'nao_pode';
    const eventoJaPassou = /^\d{4}-\d{2}-\d{2}$/.test(String(registro?.dataISO || '').trim())
        && String(registro?.dataISO).trim() < getTodayLocalISODate();
    const alteracaoBloqueadaPorData = jaRespondeu && eventoJaPassou;
    const acaoConfirmar = {
        label: jaConfirmou
            ? t.btnConfirmadoAtual
            : jaRecusou
                ? (isWeekFlow ? t.btnAlterarParaConfirmadoSemana : t.btnAlterarParaConfirmado)
                : (isWeekFlow ? t.btnConfirmarSemana : t.btnConfirmar),
        isCurrent: jaConfirmou,
        className: jaConfirmou
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'
    };
    const acaoRecusar = {
        label: jaRecusou
            ? (isWeekFlow ? t.btnRecusadoAtualSemana : t.btnRecusadoAtual)
            : jaConfirmou
                ? (isWeekFlow ? t.btnAlterarParaImprevistoSemana : t.btnAlterarParaNaoPosso)
                : (isWeekFlow ? t.btnImprevistoSemana : t.btnNaoPosso),
        isCurrent: jaRecusou,
        className: jaRecusou
            ? 'bg-rose-100 text-rose-800 border border-rose-200 cursor-default'
            : 'bg-rose-600 text-white hover:bg-rose-700'
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_40%,_#f8fafc)] flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[1.75rem] shadow-xl shadow-slate-200/60 overflow-hidden">
                <div className="bg-slate-900 text-white px-5 py-5 sm:px-6">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-blue-200 font-black">
                        {registro?.congregacaoNome || t.titulo}
                    </p>
                    <h1 className="mt-2 text-2xl sm:text-[2rem] font-black leading-tight">{t.titulo}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-300">{isWeekFlow ? t.subtituloSemana : t.subtitulo}</p>
                </div>

                <div className="p-5 sm:p-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.data}</p>
                            <p className="mt-1.5 text-sm font-bold text-slate-900">{dataFmt}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.designado}</p>
                            <p className="mt-1.5 text-sm font-bold text-slate-900">{registro?.pessoaNome || '—'}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.parte}</p>
                            <p className="mt-1.5 text-base font-black text-slate-900">{registro?.tituloParte || '—'}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.status}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-slate-700">{statusLabel}</p>
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black ${statusClass}`}>
                                    {statusLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    {registro?.saveError && (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {t.erroSalvar}
                        </div>
                    )}

                    {registro?.saveLockedPast && (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                            {isWeekFlow ? t.avisoPassadoSemana : t.avisoPassado}
                        </div>
                    )}

                    {jaRespondeu && !registro?.saveLockedPast && (
                        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
                            {alteracaoBloqueadaPorData
                                ? (isWeekFlow ? t.avisoPassadoSemana : t.avisoPassado)
                                : (isWeekFlow ? t.avisoAlteracaoSemana : t.avisoAlteracao)}
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            disabled={saving || acaoConfirmar.isCurrent || alteracaoBloqueadaPorData}
                            onClick={() => {
                                if (acaoConfirmar.isCurrent || alteracaoBloqueadaPorData) return;
                                responder('confirmado');
                            }}
                            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:opacity-60 ${acaoConfirmar.className}`}
                        >
                            {saving && !jaRecusou ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            {saving && !acaoConfirmar.isCurrent ? t.salvando : acaoConfirmar.label}
                        </button>

                        <button
                            type="button"
                            disabled={saving || acaoRecusar.isCurrent || alteracaoBloqueadaPorData}
                            onClick={() => {
                                if (acaoRecusar.isCurrent || alteracaoBloqueadaPorData) return;
                                responder(isWeekFlow ? 'imprevisto' : 'nao_pode');
                            }}
                            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:opacity-60 ${acaoRecusar.className}`}
                        >
                            {saving && !jaConfirmou ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                            {saving && !acaoRecusar.isCurrent ? t.salvando : acaoRecusar.label}
                        </button>
                    </div>

                    {jaConfirmou && !isWeekFlow && (
                        <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                            <div>
                                <h2 className="text-sm font-black text-emerald-900">{t.confirmadoOk}</h2>
                                <p className="mt-1 text-sm text-emerald-800">{t.agendaDescricao}</p>
                            </div>

                            {registro?.agendaLink && (
                                <a
                                    href={registro.agendaLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 hover:bg-emerald-100"
                                >
                                    <CalendarPlus size={16} />
                                    {t.btnAgenda}
                                </a>
                            )}
                        </div>
                    )}

                    {jaConfirmou && isWeekFlow && (
                        <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                            {t.confirmadoSemanaOk}
                        </div>
                    )}

                    {jaRecusou && (
                        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                            {isWeekFlow ? t.imprevistoSemanaOk : t.recusadoOk}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
