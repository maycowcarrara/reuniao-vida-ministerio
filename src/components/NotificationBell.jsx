import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';

import { useI18n, useSectionMessages } from '../i18n';

const formatNotificationTime = (value, lang) => {
    const iso = String(value || '').trim();
    if (!iso) return '';

    try {
        return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(new Date(iso));
    } catch {
        return iso;
    }
};

export default function NotificationBell({
    notifications = [],
    unreadCount = 0,
    onMarkOne,
    onMarkAll
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const { lang } = useI18n();
    const t = useSectionMessages('notificationsCenter');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!wrapRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadNotifications = useMemo(
        () => notifications.filter((item) => !item?.readAt && !item?.readAtIso),
        [notifications]
    );

    const readNotifications = useMemo(
        () => notifications.filter((item) => item?.readAt || item?.readAtIso),
        [notifications]
    );

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="relative flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
                title={t.titulo}
                aria-label={t.titulo}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-500 px-1 text-[10px] font-black text-white flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 bg-slate-50/80">
                        <div>
                            <h3 className="text-sm font-black text-slate-900">{t.titulo}</h3>
                            <p className="text-xs font-semibold text-slate-500">
                                {unreadCount > 0 ? `${unreadCount} ${t.novas}` : t.semNovas}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onMarkAll}
                            disabled={!unreadCount}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-black text-white disabled:opacity-40"
                        >
                            <CheckCheck size={14} />
                            {t.marcarTodas}
                        </button>
                    </div>

                    <div className="max-h-[28rem] overflow-y-auto">
                        {!notifications.length && (
                            <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                                {t.vazio}
                            </div>
                        )}

                        {!!unreadNotifications.length && (
                            <div className="px-3 pt-3">
                                <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    {t.novas}
                                </p>
                                <div className="space-y-2">
                                    {unreadNotifications.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => onMarkOne?.(item.id)}
                                            className="w-full rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-3 text-left transition hover:bg-blue-100/70"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-900">{item.title}</p>
                                                    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{item.description}</p>
                                                </div>
                                                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-3">
                                                <span className="text-[11px] font-semibold text-slate-500">
                                                    {formatNotificationTime(item.createdAtIso, lang)}
                                                </span>
                                                <span className="text-[11px] font-black text-blue-700">{t.marcarUma}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!!readNotifications.length && (
                            <div className="px-3 py-3">
                                <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    {t.lidas}
                                </p>
                                <div className="space-y-2">
                                    {readNotifications.map((item) => (
                                        <div
                                            key={item.id}
                                            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                                        >
                                            <p className="text-sm font-black text-slate-800">{item.title}</p>
                                            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{item.description}</p>
                                            <span className="mt-2 block text-[11px] font-semibold text-slate-400">
                                                {formatNotificationTime(item.createdAtIso, lang)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
