import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc
} from 'firebase/firestore';

import { normalizeLanguage } from '../config/appConfig';
import { db, auth } from './firebase';
import { createInternalNotification } from './notificacoesInternas';

const PRIVATE_COLLECTION = 'confirmacoes';
const PUBLIC_COLLECTION = 'confirmacoes_publicas';
const TOKEN_LENGTH = 10;
const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const getCurrentUser = () => {
    const user = auth.currentUser;
    if (!user?.uid) {
        throw new Error('Usuário autenticado não encontrado para gerar confirmação.');
    }
    return user;
};

const randomIndex = (max) => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const buffer = new Uint32Array(1);
        crypto.getRandomValues(buffer);
        return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
};

const createShortToken = () => {
    let token = '';
    for (let i = 0; i < TOKEN_LENGTH; i += 1) {
        token += TOKEN_ALPHABET[randomIndex(TOKEN_ALPHABET.length)];
    }
    return token;
};

const buildPrivateRef = (uid, assignmentKey) =>
    doc(db, `users/${uid}/${PRIVATE_COLLECTION}`, String(assignmentKey || '').trim());

const buildPublicRef = (token) =>
    doc(db, PUBLIC_COLLECTION, String(token || '').trim());

const buildHistoryEntry = ({ previousStatus, nextStatus, responseCode = '', source = 'public_link', actorType = 'public' }) => ({
    previousStatus: previousStatus || 'pendente',
    status: nextStatus,
    responseCode,
    source,
    actorType,
    respondedAt: new Date().toISOString()
});

const STATUS_LABELS = {
    pt: {
        pendente: 'Pendente',
        confirmado: 'Aceito',
        nao_pode: 'Não poderá cumprir'
    },
    es: {
        pendente: 'Pendiente',
        confirmado: 'Aceptado',
        nao_pode: 'No podrá cumplir'
    }
};

const getStatusLabel = (status, lang = 'pt') => {
    const labels = STATUS_LABELS[normalizeLanguage(lang)] || STATUS_LABELS.pt;
    return labels[status] || status;
};

const buildNotificationCopy = ({ lang, pessoaNome, tituloParte, previousStatus, nextStatus }) => {
    const safeLang = normalizeLanguage(lang);

    if (safeLang === 'es') {
        return {
            title: 'Respuesta de asignación actualizada',
            description: `${pessoaNome || 'Alguien'} cambió "${tituloParte || 'la asignación'}" de ${getStatusLabel(previousStatus, safeLang)} a ${getStatusLabel(nextStatus, safeLang)}.`
        };
    }

    return {
        title: 'Resposta de designação atualizada',
        description: `${pessoaNome || 'Alguém'} mudou "${tituloParte || 'a designação'}" de ${getStatusLabel(previousStatus, safeLang)} para ${getStatusLabel(nextStatus, safeLang)}.`
    };
};

const ensureUniqueToken = async () => {
    for (let i = 0; i < 7; i += 1) {
        const token = createShortToken();
        const tokenSnap = await getDoc(buildPublicRef(token));
        if (!tokenSnap.exists()) {
            return token;
        }
    }
    throw new Error('Não foi possível gerar um token exclusivo de confirmação.');
};

export const buildConfirmationUrl = (token, responseCode = '') => {
    if (!token || typeof window === 'undefined') return '';

    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    const path = `${base || ''}/c/${token}`;
    const url = new URL(path.startsWith('/') ? path : `/${path}`, window.location.origin);
    if (responseCode) {
        url.searchParams.set('r', responseCode);
    }
    return url.toString();
};

export const ensurePublicConfirmation = async ({
    assignmentKey,
    lang,
    semana,
    dataISO,
    tituloParte,
    pessoaNome,
    role,
    congregacaoNome,
    agendaLink = '',
    sala = 'Principal'
}) => {
    const user = getCurrentUser();
    const safeKey = String(assignmentKey || '').trim();

    if (!safeKey) {
        throw new Error('Chave da designação ausente para gerar confirmação.');
    }

    const privateRef = buildPrivateRef(user.uid, safeKey);
    const privateSnap = await getDoc(privateRef);
    const privateData = privateSnap.exists() ? privateSnap.data() : {};

    let token = (privateData?.token || '').toString().trim();
    if (!token) {
        token = await ensureUniqueToken();
    }

    const publicRef = buildPublicRef(token);
    const publicSnap = await getDoc(publicRef);
    const publicData = publicSnap.exists() ? publicSnap.data() : {};
    const status = publicData?.status || privateData?.status || 'pendente';
    const createdAt = privateData?.createdAt || publicData?.createdAt || serverTimestamp();

    const baseData = {
        token,
        assignmentKey: safeKey,
        ownerUid: user.uid,
        lang: normalizeLanguage(lang),
        semana: semana || '',
        dataISO: dataISO || '',
        tituloParte: tituloParte || '',
        pessoaNome: pessoaNome || '',
        role: role || '',
        congregacaoNome: congregacaoNome || '',
        agendaLink: agendaLink || '',
        sala: sala || 'Principal',
        status,
        createdAt,
        updatedAt: serverTimestamp()
    };

    await setDoc(publicRef, baseData, { merge: true });
    await setDoc(privateRef, baseData, { merge: true });

    return {
        token,
        link: buildConfirmationUrl(token),
        acceptLink: buildConfirmationUrl(token, 'a'),
        declineLink: buildConfirmationUrl(token, 'n'),
        status
    };
};

export const getPublicConfirmation = async (token) => {
    const safeToken = String(token || '').trim();
    if (!safeToken) return null;

    const snap = await getDoc(buildPublicRef(safeToken));
    if (!snap.exists()) return null;

    return {
        id: snap.id,
        ...snap.data()
    };
};

export const respondToPublicConfirmation = async (token, status, options = {}) => {
    const safeToken = String(token || '').trim();
    if (!safeToken) {
        throw new Error('Token de confirmação inválido.');
    }

    const publicRef = buildPublicRef(safeToken);
    const snap = await getDoc(publicRef);
    if (!snap.exists()) {
        throw new Error('Confirmação pública não encontrada.');
    }

    const current = snap.data() || {};
    const nextStatus = status === 'nao_pode' ? 'nao_pode' : 'confirmado';
    const previousStatus = current?.status || 'pendente';
    const changed = previousStatus !== nextStatus;
    const responseCode = nextStatus === 'confirmado' ? 'a' : 'n';
    const source = options?.source || 'public_link';
    const actorType = options?.actorType || 'public';
    const responseHistory = Array.isArray(current?.responseHistory) ? [...current.responseHistory] : [];

    responseHistory.push(buildHistoryEntry({ previousStatus, nextStatus, responseCode, source, actorType }));

    const changedAtIso = new Date().toISOString();
    const payload = {
        status: nextStatus,
        previousStatus,
        responseHistory,
        lastResponseSource: source,
        lastResponseActorType: actorType,
        updatedAt: serverTimestamp(),
        lastResponseAt: serverTimestamp(),
        lastResponseAtIso: changedAtIso,
        confirmedAt: nextStatus === 'confirmado' ? serverTimestamp() : null,
        declinedAt: nextStatus === 'nao_pode' ? serverTimestamp() : null,
        lastStatusChangeAtIso: changed ? changedAtIso : current?.lastStatusChangeAtIso || null,
        lastStatusChangeFrom: changed ? previousStatus : current?.lastStatusChangeFrom || null,
        lastStatusChangeTo: changed ? nextStatus : current?.lastStatusChangeTo || nextStatus,
        lastStatusChangeKey: changed ? `${changedAtIso}|${nextStatus}` : current?.lastStatusChangeKey || null,
        alertPending: changed ? true : Boolean(current?.alertPending),
        alertSeenAt: changed ? null : current?.alertSeenAt || null
    };

    await updateDoc(publicRef, payload);
    if (current?.ownerUid && current?.assignmentKey) {
        await setDoc(buildPrivateRef(current.ownerUid, current.assignmentKey), {
            ...payload,
            token: safeToken,
            assignmentKey: current.assignmentKey,
            ownerUid: current.ownerUid
        }, { merge: true });
    }

    if (changed) {
        const copy = buildNotificationCopy({
            lang: current?.lang,
            pessoaNome: current?.pessoaNome,
            tituloParte: current?.tituloParte,
            previousStatus,
            nextStatus
        });

        await createInternalNotification({
            ownerUid: current?.ownerUid,
            type: 'confirmacao_status',
            title: copy.title,
            description: copy.description,
            token: safeToken,
            assignmentKey: current?.assignmentKey || '',
            dataISO: current?.dataISO || '',
            semana: current?.semana || '',
            pessoaNome: current?.pessoaNome || '',
            status: nextStatus,
            previousStatus,
            meta: {
                tituloParte: current?.tituloParte || '',
                congregacaoNome: current?.congregacaoNome || ''
            }
        });
    }

    return getPublicConfirmation(safeToken);
};

export const respondToConfirmationByAssignment = async (assignmentKey, status, options = {}) => {
    const user = getCurrentUser();
    const safeKey = String(assignmentKey || '').trim();
    if (!safeKey) {
        throw new Error('Chave da designação inválida.');
    }

    const privateSnap = await getDoc(buildPrivateRef(user.uid, safeKey));
    if (!privateSnap.exists()) {
        throw new Error('Confirmação ainda não foi preparada para esta designação.');
    }

    const token = privateSnap.data()?.token;
    if (!token) {
        throw new Error('Token de confirmação não encontrado para esta designação.');
    }

    return respondToPublicConfirmation(token, status, options);
};

export const registerConfirmationReminder = async (assignmentKey) => {
    const user = getCurrentUser();
    const safeKey = String(assignmentKey || '').trim();
    if (!safeKey) return;

    const privateRef = buildPrivateRef(user.uid, safeKey);
    const privateSnap = await getDoc(privateRef);
    if (!privateSnap.exists()) return;

    const token = privateSnap.data()?.token;
    const payload = {
        lastReminderSentAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await updateDoc(privateRef, payload);

    if (token) {
        await setDoc(buildPublicRef(token), payload, { merge: true });
    }
};

export const markConfirmationAlertSeen = async (token) => {
    const safeToken = String(token || '').trim();
    if (!safeToken) return;

    await updateDoc(buildPublicRef(safeToken), {
        alertPending: false,
        alertSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};
