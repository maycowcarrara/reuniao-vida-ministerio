import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { normalizeLanguage, syncDocumentLanguage } from '../config/appConfig';
import { getSectionMessages } from '../i18n';
import {
    getPublicConfirmation,
    respondToPublicConfirmation
} from '../services/confirmacoesPublicas';
import { formatarDataFolha } from '../utils/revisarEnviar/dates';

const STATUS_STYLES = {
    pendente: 'bg-amber-100 text-amber-800 border-amber-200',
    confirmado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    nao_pode: 'bg-rose-100 text-rose-800 border-rose-200'
};

export default function ConfirmacaoPublica() {
    const { token } = useParams();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [registro, setRegistro] = useState(null);

    const lang = normalizeLanguage(registro?.lang);
    const t = useMemo(() => getSectionMessages('confirmacaoPublica', lang), [lang]);
    const quadroPath = '/quadro';

    useEffect(() => {
        syncDocumentLanguage(lang);
    }, [lang]);

    useEffect(() => {
        let ativo = true;

        const carregar = async () => {
            setLoading(true);
            try {
                const data = await getPublicConfirmation(token);
                if (ativo) {
                    setRegistro(data);
                }
            } finally {
                if (ativo) setLoading(false);
            }
        };

        carregar();
        return () => {
            ativo = false;
        };
    }, [token]);

    useEffect(() => {
        const responseCode = (searchParams.get('r') || '').trim().toLowerCase();
        if (!registro || !['a', 'n'].includes(responseCode) || saving) return;
        if (registro?.autoResponseApplied === responseCode) return;

        const status = responseCode === 'a' ? 'confirmado' : 'nao_pode';

        const aplicarResposta = async () => {
            setSaving(true);
            try {
                const atualizado = await respondToPublicConfirmation(token, status);
                setRegistro({ ...atualizado, autoResponseApplied: responseCode });
            } catch {
                setRegistro((prev) => prev ? { ...prev, saveError: true, autoResponseApplied: responseCode } : prev);
            } finally {
                setSaving(false);
            }
        };

        aplicarResposta();
    }, [registro, saving, searchParams, token]);

    const statusLabel = registro?.status === 'confirmado'
        ? t.confirmado
        : registro?.status === 'nao_pode'
            ? t.naoPode
            : t.pendente;

    const responder = async (status) => {
        setSaving(true);
        try {
            const atualizado = await respondToPublicConfirmation(token, status);
            setRegistro(atualizado);
        } catch {
            setRegistro((prev) => prev ? { ...prev, saveError: true } : prev);
        } finally {
            setSaving(false);
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
    const statusClass = STATUS_STYLES[registro?.status] || STATUS_STYLES.pendente;
    const jaConfirmou = registro?.status === 'confirmado';
    const jaRecusou = registro?.status === 'nao_pode';

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_40%,_#f8fafc)] flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-xl bg-white border border-slate-200 rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden">
                <div className="bg-slate-900 text-white px-6 py-7">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-blue-200 font-black">
                        {registro?.congregacaoNome || t.titulo}
                    </p>
                    <h1 className="mt-2 text-2xl sm:text-3xl font-black">{t.titulo}</h1>
                    <p className="mt-2 text-sm text-slate-300">{t.subtitulo}</p>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.data}</p>
                            <p className="mt-2 text-sm font-bold text-slate-900">{dataFmt}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.designado}</p>
                            <p className="mt-2 text-sm font-bold text-slate-900">{registro?.pessoaNome || '—'}</p>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.parte}</p>
                        <p className="mt-2 text-base font-black text-slate-900">{registro?.tituloParte || '—'}</p>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">{t.status}</p>
                            <p className="mt-2 text-sm font-bold text-slate-700">{statusLabel}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${statusClass}`}>
                            {statusLabel}
                        </span>
                    </div>

                    {registro?.saveError && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {t.erroSalvar}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => responder('confirmado')}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {saving && !jaRecusou ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            {saving ? t.salvando : t.btnConfirmar}
                        </button>

                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => responder('nao_pode')}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-60"
                        >
                            {saving && !jaConfirmou ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                            {saving ? t.salvando : t.btnNaoPosso}
                        </button>
                    </div>

                    {jaConfirmou && (
                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
                            <div>
                                <h2 className="text-sm font-black text-emerald-900">{t.confirmadoOk}</h2>
                                <p className="mt-1 text-sm text-emerald-800">{t.agendaDescricao}</p>
                            </div>

                            {registro?.agendaLink && (
                                <a
                                    href={registro.agendaLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                                >
                                    <CalendarPlus size={16} />
                                    {t.btnAgenda}
                                </a>
                            )}
                        </div>
                    )}

                    {jaRecusou && (
                        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
                            {t.recusadoOk}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
