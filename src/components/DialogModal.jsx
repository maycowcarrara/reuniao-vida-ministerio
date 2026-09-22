import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Check, Info, HelpCircle, X } from 'lucide-react';
import { dialogStore } from '../utils/dialog';

const DIALOG_VARIANTS = {
    danger: {
        icon: AlertTriangle,
        iconWrap: 'bg-rose-100 text-rose-600 border-rose-200',
        confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 focus:ring-rose-500',
    },
    error: {
        icon: AlertTriangle,
        iconWrap: 'bg-rose-100 text-rose-600 border-rose-200',
        confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 focus:ring-rose-500',
    },
    warning: {
        icon: AlertTriangle,
        iconWrap: 'bg-amber-100 text-amber-600 border-amber-200',
        confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200 focus:ring-amber-500',
    },
    info: {
        icon: Info,
        iconWrap: 'bg-blue-100 text-blue-600 border-blue-200',
        confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 focus:ring-blue-500',
    },
    question: {
        icon: HelpCircle,
        iconWrap: 'bg-indigo-100 text-indigo-600 border-indigo-200',
        confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 focus:ring-indigo-500',
    },
    success: {
        icon: CheckCircle2,
        iconWrap: 'bg-emerald-100 text-emerald-600 border-emerald-200',
        confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 focus:ring-emerald-500',
    },
};

export function DialogModal() {
    const [current, setCurrent] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [copied, setCopied] = useState(false);
    const inputRef = useRef(null);
    const confirmBtnRef = useRef(null);
    const cancelBtnRef = useRef(null);

    useEffect(() => {
        return dialogStore.subscribe((dialog) => {
            setCurrent(dialog);
            setInputValue(dialog?.defaultValue ?? '');
            setCopied(false);
        });
    }, []);

    useEffect(() => {
        if (!current) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const timer = setTimeout(() => {
            if (current.type === 'prompt' && inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            } else if ((current.variant === 'danger' || current.variant === 'error') && cancelBtnRef.current) {
                cancelBtnRef.current.focus();
            } else if (confirmBtnRef.current) {
                confirmBtnRef.current.focus();
            }
        }, 50);

        return () => {
            document.body.style.overflow = originalOverflow;
            clearTimeout(timer);
        };
    }, [current]);

    useEffect(() => {
        if (!current) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            } else if (e.key === 'Enter') {
                if (current.type === 'prompt') {
                    e.preventDefault();
                    handleConfirm();
                } else if (e.target.tagName !== 'BUTTON') {
                    e.preventDefault();
                    handleConfirm();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [current, inputValue]);

    if (!current) return null;

    const variantConfig = DIALOG_VARIANTS[current.variant] || DIALOG_VARIANTS.warning;
    const Icon = variantConfig.icon;

    const handleConfirm = () => {
        if (current.type === 'prompt') {
            dialogStore.close(inputValue);
        } else if (current.type === 'alert') {
            dialogStore.close(true);
        } else {
            dialogStore.close(true);
        }
    };

    const handleCancel = () => {
        if (current.type === 'prompt') {
            dialogStore.close(null);
        } else {
            dialogStore.close(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inputValue);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
        }
    };

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) handleCancel();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
        >
            <div
                className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-900"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3.5 shrink-0">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${variantConfig.iconWrap}`}>
                        <Icon size={22} />
                    </div>

                    <div className="min-w-0 flex-1 pt-0.5">
                        <h3 id="dialog-title" className="text-base font-bold tracking-tight text-slate-900">
                            {current.title}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={handleCancel}
                        className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Fechar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[60vh] pr-1 mt-2">
                    {current.message ? (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                            {current.message}
                        </p>
                    ) : null}

                    {current.type === 'prompt' && (
                        <div className="mt-3 flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={current.placeholder}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                />
                                {(current.isCopyable || current.defaultValue) && (
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        title="Copiar texto"
                                        className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
                                            copied
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                        <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
                    {current.type !== 'alert' && (
                        <button
                            ref={cancelBtnRef}
                            type="button"
                            onClick={handleCancel}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 active:scale-95"
                        >
                            {current.cancelText}
                        </button>
                    )}

                    <button
                        ref={confirmBtnRef}
                        type="button"
                        onClick={handleConfirm}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 active:scale-95 ${variantConfig.confirmBtn}`}
                    >
                        {current.confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
