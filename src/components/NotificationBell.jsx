import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronDown, Trash2 } from 'lucide-react';

import { useI18n, useSectionMessages } from '../i18n';

const INITIAL_VISIBLE_COUNT = 5;
const VISIBLE_INCREMENT = 10;

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
    onMarkAll,
    onDeleteOne,
    onDeleteRead
}) {
    const [open, setOpen] = useState(false);
    const [visibleUnreadCount, setVisibleUnreadCount] = useState(INITIAL_VISIBLE_COUNT);
    const [visibleReadCount, setVisibleReadCount] = useState(INITIAL_VISIBLE_COUNT);
    const wrapRef = useRef(null);
    const { lang } = useI18n();
    const t = useSectionMessages('notificationsCenter');

    const closeNotifications = useCallback(() => {
        setVisibleUnreadCount(INITIAL_VISIBLE_COUNT);
        setVisibleReadCount(INITIAL_VISIBLE_COUNT);
        setOpen(false);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!wrapRef.current?.contains(event.target)) {
                closeNotifications();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [closeNotifications]);

    const unreadNotifications = useMemo(
        () => notifications
            .filter((item) => !item?.readAt && !item?.readAtIso)
            .sort((a, b) => (b?.createdAtIso || '').localeCompare(a?.createdAtIso || '')),
        [notifications]
    );

    const readNotifications = useMemo(
        () => notifications
            .filter((item) => item?.readAt || item?.readAtIso)
            .sort((a, b) => (b?.createdAtIso || '').localeCompare(a?.createdAtIso || '')),
        [notifications]
    );

    const visibleUnreadNotifications = unreadNotifications.slice(0, visibleUnreadCount);
    const visibleReadNotifications = readNotifications.slice(0, visibleReadCount);
    const hasMoreUnread = unreadNotifications.length > visibleUnreadNotifications.length;
    const hasMoreRead = readNotifications.length > visibleReadNotifications.length;

    return (
        <div ref={wrapRef} className="relative z-[130]">
            <button
                type="button"
                onClick={() => {
                    if (open) {
                        closeNotifications();
                    } else {
                        setOpen(true);
                    }
                }}
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
                <div className="fixed left-3 right-3 top-16 z-[140] overflow-hidden rounded-3xl border border-slate-300 bg-slate-100/95 shadow-2xl shadow-slate-300/80 backdrop-blur-sm md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-[22rem] md:max-w-[calc(100vw-2rem)]">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-200/90 px-4 py-3">
                        <div className="min-w-0">
                            <h3 className="text-sm font-black text-slate-900">{t.titulo}</h3>
                            <p className="text-xs font-semibold text-slate-500">
                                {unreadCount > 0 ? `${unreadCount} ${t.novas}` : t.semNovas}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={onMarkAll}
                                disabled={!unreadCount}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-40"
                                title={t.marcarTodas}
                                aria-label={t.marcarTodas}
                            >
                                <CheckCheck size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={onDeleteRead}
                                disabled={!readNotifications.length}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-rose-600 disabled:opacity-40"
                                title={t.limparLidas}
                                aria-label={t.limparLidas}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
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
                                    {visibleUnreadNotifications.map((item) => (
                                        <div
                                            key={item.id}
                                            className="w-full rounded-2xl border border-blue-200 bg-white/95 px-3 py-3 text-left shadow-sm transition hover:bg-blue-50"
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
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => onMarkOne?.(item.id)}
                                                        className="rounded-lg px-2 py-1 text-[11px] font-black text-blue-700 transition hover:bg-blue-100"
                                                    >
                                                        {t.marcarUma}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteOne?.(item.id)}
                                                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                        title={t.excluir}
                                                        aria-label={t.excluir}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {hasMoreUnread && (
                                    <button
                                        type="button"
                                        onClick={() => setVisibleUnreadCount((count) => count + VISIBLE_INCREMENT)}
                                        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-50"
                                    >
                                        <ChevronDown size={15} />
                                        {t.verMais}
                                    </button>
                                )}
                            </div>
                        )}

                        {!!readNotifications.length && (
                            <div className="px-3 py-3">
                                <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    {t.lidas}
                                </p>
                                <div className="space-y-2">
                                    {visibleReadNotifications.map((item) => (
                                        <div
                                            key={item.id}
                                            className="rounded-2xl border border-slate-300 bg-slate-50/95 px-3 py-3 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="min-w-0 text-sm font-black text-slate-800">{item.title}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => onDeleteOne?.(item.id)}
                                                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                    title={t.excluir}
                                                    aria-label={t.excluir}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{item.description}</p>
                                            <span className="mt-2 block text-[11px] font-semibold text-slate-400">
                                                {formatNotificationTime(item.createdAtIso, lang)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {hasMoreRead && (
                                    <button
                                        type="button"
                                        onClick={() => setVisibleReadCount((count) => count + VISIBLE_INCREMENT)}
                                        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                                    >
                                        <ChevronDown size={15} />
                                        {t.verMais}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
