import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';

import { normalizeLanguage, normalizeSystemConfig } from '../config/appConfig';
import { db, auth } from './firebase';
import { createInternalNotification } from './notificacoesInternas';
import { getMeetingDateISOFromSemana } from '../utils/revisarEnviar/dates';
import { getEventoEspecialDaSemana, getTipoEventoSemana } from '../utils/eventos';

const PRIVATE_COLLECTION = 'confirmacoes';
const PUBLIC_COLLECTION = 'confirmacoes_publicas';
const TOKEN_LENGTH = 10;
const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const PRIMARY_STATUSES = ['pendente', 'confirmado', 'nao_pode'];
const WEEK_REMINDER_STATUSES = ['nao_enviado', 'pendente', 'confirmado', 'imprevisto'];

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

const mergeSentChannels = (currentChannels = {}, channel, changedAtIso) => ({
    ...currentChannels,
    [channel]: changedAtIso
});

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
        nao_pode: 'Não poderá cumprir',
        nao_enviado: 'Lembrete não enviado',
        imprevisto: 'Teve imprevisto'
    },
    es: {
        pendente: 'Pendiente',
        confirmado: 'Aceptado',
        nao_pode: 'No podrá cumplir',
        nao_enviado: 'Recordatorio no enviado',
        imprevisto: 'Tuvo un imprevisto'
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

const buildWeekReminderNotificationCopy = ({ lang, pessoaNome, tituloParte, previousStatus, nextStatus }) => {
    const safeLang = normalizeLanguage(lang);

    if (safeLang === 'es') {
        return {
            title: 'Recordatorio semanal actualizado',
            description: `${pessoaNome || 'Alguien'} cambió el recordatorio de "${tituloParte || 'la asignación'}" de ${getStatusLabel(previousStatus, safeLang)} a ${getStatusLabel(nextStatus, safeLang)}.`
        };
    }

    return {
        title: 'Lembrete semanal atualizado',
        description: `${pessoaNome || 'Alguém'} mudou o lembrete de "${tituloParte || 'a designação'}" de ${getStatusLabel(previousStatus, safeLang)} para ${getStatusLabel(nextStatus, safeLang)}.`
    };
};

const isPrimaryStatus = (status) => PRIMARY_STATUSES.includes(status);
const isWeekReminderStatus = (status) => WEEK_REMINDER_STATUSES.includes(status);
const isPrimaryResolvedStatus = (status) => ['confirmado', 'nao_pode'].includes(status);
const isWeekResolvedStatus = (status) => ['confirmado', 'imprevisto'].includes(status);

const getTodayLocalISODate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isPastEventDate = (dateISO) => /^\d{4}-\d{2}-\d{2}$/.test(String(dateISO || '').trim())
    && String(dateISO).trim() < getTodayLocalISODate();

const normalizeText = (value = '') =>
    value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const buildAssignmentKey = ({ dataISO, semana, parteId, pessoaId, role }) =>
    [dataISO || '', semana || '', parteId || '', pessoaId || '', role || ''].join('|');

const isPrayerPart = (part) => {
    const type = normalizeText(part?.tipo ?? part?.type ?? '');
    const title = normalizeText(part?.titulo ?? '');
    return type.includes('oracao') || type.includes('oracion') || title.includes('oracao') || title.includes('oracion');
};

const isBibleStudyPart = (part) => {
    const type = normalizeText(part?.tipo ?? part?.type ?? '');
    const title = normalizeText(part?.titulo ?? '');

    return (
        type.includes('estudo') ||
        type.includes('estudio') ||
        title.includes('estudo biblico') ||
        title.includes('estudio biblico')
    );
};

const getProgramacaoCollectionRef = (uid) =>
    collection(db, `users/${String(uid || '').trim()}/programacao`);

const getConfigRef = (uid) =>
    doc(db, `users/${String(uid || '').trim()}/configuracoes`, 'geral');

const getMeetingDateForWeek = (week, config) => {
    const eventoEspecial = getEventoEspecialDaSemana(week, config);
    const tipoEvento = getTipoEventoSemana(week, config);
    const isVisita = tipoEvento === 'visita';
    const fallbackStr = week?.dataReuniao || week?.dataExata || week?.dataInicio || week?.data || null;

    if (eventoEspecial?.dataInput && !isVisita) {
        return eventoEspecial.dataInput;
    }

    let dataCalculada = getMeetingDateISOFromSemana({
        semanaStr: week?.semana,
        config,
        isoFallback: fallbackStr,
        overrideDia: isVisita ? 'terça-feira' : null,
        textSources: [week?.semana]
    });

    if (!dataCalculada) {
        dataCalculada = fallbackStr;
    }

    if (isVisita && dataCalculada) {
        const [ano, mes, dia] = dataCalculada.split('-').map(Number);
        const d = new Date(ano, mes - 1, dia, 12, 0, 0);

        if (d.getDay() !== 2) {
            const diff = 2 - d.getDay();
            d.setDate(d.getDate() + diff);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }

    return dataCalculada;
};

const collectAssignmentKeysForWeek = (week, config = {}) => {
    const keys = new Set();
    const dataISO = getMeetingDateForWeek(week, config);
    const semana = String(week?.semana || '').trim();

    const addAssignment = (pessoa, role, parteId) => {
        const pessoaId = pessoa?.id || pessoa?.nome;
        if (!pessoaId) return;

        keys.add(buildAssignmentKey({
            dataISO,
            semana,
            parteId,
            pessoaId,
            role
        }));
    };

    if (week?.presidente) {
        addAssignment(week.presidente, 'presidente', 'presidente');
    }

    (Array.isArray(week?.partes) ? week.partes : []).forEach((parte) => {
        if (isPrayerPart(parte)) {
            addAssignment(parte?.oracao || parte?.estudante, 'oracao', parte?.id);
            return;
        }

        if (isBibleStudyPart(parte)) {
            addAssignment(parte?.dirigente || parte?.estudante, 'dirigente', parte?.id);
            addAssignment(parte?.leitor || week?.leitor, 'leitor', parte?.id);
            return;
        }

        addAssignment(parte?.estudante, 'resp', parte?.id);
        addAssignment(parte?.ajudante, 'ajud', parte?.id);
    });

    return keys;
};

const validateConfirmationTarget = async (confirmationData = {}) => {
    const ownerUid = String(confirmationData?.ownerUid || '').trim();
    const assignmentKey = String(confirmationData?.assignmentKey || '').trim();
    const semana = String(confirmationData?.semana || '').trim();

    if (!ownerUid || !assignmentKey || !semana) {
        return { isUnavailable: true, unavailableReason: 'missing_reference' };
    }

    const [configSnap, weeksSnap] = await Promise.all([
        getDoc(getConfigRef(ownerUid)),
        getDocs(query(getProgramacaoCollectionRef(ownerUid), where('semana', '==', semana)))
    ]);

    if (weeksSnap.empty) {
        return { isUnavailable: true, unavailableReason: 'week_removed' };
    }

    const config = normalizeSystemConfig(configSnap.exists() ? configSnap.data() : {});
    const found = weeksSnap.docs.some((weekDoc) => {
        const keys = collectAssignmentKeysForWeek(weekDoc.data(), config);
        return keys.has(assignmentKey);
    });

    if (!found) {
        return { isUnavailable: true, unavailableReason: 'assignment_changed' };
    }

    return { isUnavailable: false, unavailableReason: '' };
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

export const buildConfirmationUrl = (token, responseCode = '', flow = '') => {
    if (!token || typeof window === 'undefined') return '';

    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    const path = `${base || ''}/c/${token}`;
    const url = new URL(path.startsWith('/') ? path : `/${path}`, window.location.origin);
    if (responseCode) {
        url.searchParams.set('r', responseCode);
    }
    if (flow) {
        url.searchParams.set('f', flow);
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
    const weekReminderStatus = publicData?.weekReminderStatus || privateData?.weekReminderStatus || 'nao_enviado';
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
        weekReminderStatus,
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
        weekLink: buildConfirmationUrl(token, '', 'w'),
        status
    };
};

export const getPublicConfirmation = async (token) => {
    const safeToken = String(token || '').trim();
    if (!safeToken) return null;

    const snap = await getDoc(buildPublicRef(safeToken));
    if (!snap.exists()) return null;

    const data = {
        id: snap.id,
        ...snap.data()
    };
    const availability = await validateConfirmationTarget(data);

    return {
        ...data,
        ...availability
    };
};

const updateConfirmationState = async (token, mode, status, options = {}) => {
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
    const availability = await validateConfirmationTarget(current);
    if (availability.isUnavailable) {
        const error = new Error('A designação vinculada a este link não existe mais.');
        error.code = availability.unavailableReason || 'assignment_unavailable';
        throw error;
    }

    const source = options?.source || 'public_link';
    const actorType = options?.actorType || 'public';
    const changedAtIso = new Date().toISOString();
    let payload = {};
    let changed = false;
    let previousStatus = '';
    let nextStatus = '';

    if (mode === 'week') {
        nextStatus = status === 'imprevisto' ? 'imprevisto' : 'confirmado';
        if (!isWeekReminderStatus(nextStatus)) {
            throw new Error('Status semanal inválido.');
        }

        previousStatus = current?.weekReminderStatus || 'nao_enviado';
        changed = previousStatus !== nextStatus;
        if (changed && isPastEventDate(current?.dataISO) && isWeekResolvedStatus(previousStatus)) {
            const error = new Error('Não é possível alterar a resposta de uma designação após a data da reunião.');
            error.code = 'past_event_change_locked';
            throw error;
        }
        const responseCode = nextStatus === 'confirmado' ? 'c' : 'i';
        const history = Array.isArray(current?.weekReminderHistory) ? [...current.weekReminderHistory] : [];
        history.push(buildHistoryEntry({ previousStatus, nextStatus, responseCode, source, actorType }));

        payload = {
            weekReminderStatus: nextStatus,
            weekReminderPreviousStatus: previousStatus,
            weekReminderHistory: history,
            lastWeekReminderSource: source,
            lastWeekReminderActorType: actorType,
            weekReminderRespondedAt: serverTimestamp(),
            weekReminderRespondedAtIso: changedAtIso,
            lastWeekReminderChangeAtIso: changed ? changedAtIso : current?.lastWeekReminderChangeAtIso || null,
            lastWeekReminderChangeFrom: changed ? previousStatus : current?.lastWeekReminderChangeFrom || null,
            lastWeekReminderChangeTo: changed ? nextStatus : current?.lastWeekReminderChangeTo || nextStatus,
            lastWeekReminderChangeKey: changed ? `${changedAtIso}|${nextStatus}` : current?.lastWeekReminderChangeKey || null,
            weekReminderAlertPending: changed ? true : Boolean(current?.weekReminderAlertPending),
            weekReminderAlertSeenAt: changed ? null : current?.weekReminderAlertSeenAt || null,
            updatedAt: serverTimestamp()
        };
    } else {
        nextStatus = status === 'nao_pode' ? 'nao_pode' : 'confirmado';
        if (!isPrimaryStatus(nextStatus)) {
            throw new Error('Status da designação inválido.');
        }

        previousStatus = current?.status || 'pendente';
        changed = previousStatus !== nextStatus;
        if (changed && isPastEventDate(current?.dataISO) && isPrimaryResolvedStatus(previousStatus)) {
            const error = new Error('Não é possível alterar a resposta de uma designação após a data da reunião.');
            error.code = 'past_event_change_locked';
            throw error;
        }
        const responseCode = nextStatus === 'confirmado' ? 'a' : 'n';
        const responseHistory = Array.isArray(current?.responseHistory) ? [...current.responseHistory] : [];
        responseHistory.push(buildHistoryEntry({ previousStatus, nextStatus, responseCode, source, actorType }));

        payload = {
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
    }

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
        const copy = mode === 'week'
            ? buildWeekReminderNotificationCopy({
                lang: current?.lang,
                pessoaNome: current?.pessoaNome,
                tituloParte: current?.tituloParte,
                previousStatus,
                nextStatus
            })
            : buildNotificationCopy({
                lang: current?.lang,
                pessoaNome: current?.pessoaNome,
                tituloParte: current?.tituloParte,
                previousStatus,
                nextStatus
            });

        await createInternalNotification({
            ownerUid: current?.ownerUid,
            type: mode === 'week' ? 'lembrete_semana_status' : 'confirmacao_status',
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

export const respondToPublicConfirmation = async (token, status, options = {}) =>
    updateConfirmationState(token, 'primary', status, options);

export const respondToPublicWeekReminder = async (token, status, options = {}) =>
    updateConfirmationState(token, 'week', status, options);

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

export const respondToWeekReminderByAssignment = async (assignmentKey, status, options = {}) => {
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

    return respondToPublicWeekReminder(token, status, options);
};

export const registerConfirmationReminder = async (assignmentKey) => {
    const user = getCurrentUser();
    const safeKey = String(assignmentKey || '').trim();
    if (!safeKey) return;

    const privateRef = buildPrivateRef(user.uid, safeKey);
    const privateSnap = await getDoc(privateRef);
    if (!privateSnap.exists()) return;

    const token = privateSnap.data()?.token;
    const currentChannels = privateSnap.data()?.sentChannels || {};
    const changedAtIso = new Date().toISOString();
    const payload = {
        weekReminderStatus: 'pendente',
        lastReminderSentAt: serverTimestamp(),
        lastReminderSentAtIso: changedAtIso,
        sentChannels: mergeSentChannels(currentChannels, 'waReminder', changedAtIso),
        updatedAt: serverTimestamp()
    };

    await updateDoc(privateRef, payload);

    if (token) {
        await setDoc(buildPublicRef(token), payload, { merge: true });
    }
};

export const registerNotificationChannelByAssignment = async (assignmentKey, channel) => {
    const user = getCurrentUser();
    const safeKey = String(assignmentKey || '').trim();
    const safeChannel = String(channel || '').trim();
    if (!safeKey || !safeChannel) return;

    const privateRef = buildPrivateRef(user.uid, safeKey);
    const privateSnap = await getDoc(privateRef);
    if (!privateSnap.exists()) return;

    const current = privateSnap.data() || {};
    const token = current?.token;
    const changedAtIso = new Date().toISOString();
    const sentChannels = mergeSentChannels(current?.sentChannels || {}, safeChannel, changedAtIso);
    const payload = {
        sentChannels,
        lastNotificationChannel: safeChannel,
        lastNotificationSentAt: serverTimestamp(),
        lastNotificationSentAtIso: changedAtIso,
        updatedAt: serverTimestamp()
    };

    if (safeChannel === 'wa') {
        payload.lastWhatsappSentAt = serverTimestamp();
        payload.lastWhatsappSentAtIso = changedAtIso;
    }

    if (safeChannel === 'mail') {
        payload.lastEmailSentAt = serverTimestamp();
        payload.lastEmailSentAtIso = changedAtIso;
    }

    if (safeChannel === 'waReminder') {
        payload.lastReminderSentAt = serverTimestamp();
        payload.lastReminderSentAtIso = changedAtIso;
    }

    await setDoc(privateRef, payload, { merge: true });

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
