import React, { createContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { toast, toastStore } from '../utils/toast';
import { useDocumentSectionMessages } from '../i18n';

const ToastContext = createContext(toast);

const TOAST_STYLES = {
    success: {
        wrap: 'border-emerald-200 bg-emerald-50/95 text-emerald-950',
        iconWrap: 'bg-emerald-600 text-white',
        icon: CheckCircle2
    },
    error: {
        wrap: 'border-rose-200 bg-rose-50/95 text-rose-950',
        iconWrap: 'bg-rose-600 text-white',
        icon: AlertTriangle
    },
    info: {
        wrap: 'border-blue-200 bg-white/95 text-slate-900',
        iconWrap: 'bg-blue-600 text-white',
        icon: Info
    }
};

function ToastViewport() {
    const [items, setItems] = useState([]);
    const t = useDocumentSectionMessages('toast');

    useEffect(() => toastStore.subscribe(setItems), []);

    useEffect(() => {
        const timers = items.map((item) =>
            window.setTimeout(() => toast.dismiss(item.id), item.duration ?? 4000)
        );

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [items]);

    return (
        <div className="pointer-events-none fixed right-4 top-4 z-[1000] flex w-[min(92vw,26rem)] flex-col gap-3">
            {items.map((item) => {
                const style = TOAST_STYLES[item.variant] || TOAST_STYLES.info;
                const Icon = style.icon;

                return (
                    <div
                        key={item.id}
                        className={`pointer-events-auto rounded-2xl border p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-300 ${style.wrap}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.iconWrap}`}>
                                <Icon size={18} />
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="whitespace-pre-line text-sm font-semibold tracking-[0.01em] leading-tight">
                                    {item.title}
                                </p>
                                {item.description ? (
                                    <p className="mt-1 whitespace-pre-line text-xs font-normal leading-relaxed opacity-75">
                                        {item.description}
                                    </p>
                                ) : null}
                            </div>

                            <button
                                type="button"
                                onClick={() => toast.dismiss(item.id)}
                                className="rounded-lg p-1 text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
                                aria-label={t.fechar}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function ToastProvider({ children }) {
    const value = useMemo(() => toast, []);
    const t = useDocumentSectionMessages('toast');

    useEffect(() => {
        const originalAlert = window.alert;
        const originalOnError = window.onerror;
        const originalOnUnhandledRejection = window.onunhandledrejection;

        window.alert = (message) => {
            toast.info(String(message ?? t.aviso));
        };

        window.onerror = (message, source, lineno, colno, error) => {
            toast.error(error ?? message, t.erroInesperado);
            if (typeof originalOnError === 'function') {
                return originalOnError(message, source, lineno, colno, error);
            }
            return false;
        };

        window.onunhandledrejection = (event) => {
            toast.error(event.reason, t.erroInesperado);
            if (typeof originalOnUnhandledRejection === 'function') {
                return originalOnUnhandledRejection.call(window, event);
            }
            return false;
        };

        return () => {
            window.alert = originalAlert;
            window.onerror = originalOnError;
            window.onunhandledrejection = originalOnUnhandledRejection;
        };
    }, [t]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastViewport />
        </ToastContext.Provider>
    );
}
