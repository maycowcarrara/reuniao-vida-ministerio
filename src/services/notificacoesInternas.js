import {
    collection,
    doc,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch
} from 'firebase/firestore';

import { db } from './firebase';

export const NOTIFICATIONS_COLLECTION = 'notificacoes';

export const createInternalNotification = async ({
    ownerUid,
    type,
    title,
    description,
    token = '',
    assignmentKey = '',
    dataISO = '',
    semana = '',
    pessoaNome = '',
    status = '',
    previousStatus = '',
    meta = {}
}) => {
    const safeOwnerUid = String(ownerUid || '').trim();
    if (!safeOwnerUid) return null;

    const ref = doc(collection(db, NOTIFICATIONS_COLLECTION));
    const createdAtIso = new Date().toISOString();

    await setDoc(ref, {
        id: ref.id,
        ownerUid: safeOwnerUid,
        type: type || 'info',
        title: title || 'Nova notificação',
        description: description || '',
        token: token || '',
        assignmentKey: assignmentKey || '',
        dataISO: dataISO || '',
        semana: semana || '',
        pessoaNome: pessoaNome || '',
        status: status || '',
        previousStatus: previousStatus || '',
        meta,
        readAt: null,
        readAtIso: null,
        createdAt: serverTimestamp(),
        createdAtIso
    });

    return ref.id;
};

export const markNotificationRead = async (id) => {
    const safeId = String(id || '').trim();
    if (!safeId) return;

    await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, safeId), {
        readAt: serverTimestamp(),
        readAtIso: new Date().toISOString()
    });
};

export const markAllNotificationsRead = async (notifications = []) => {
    const unread = (notifications || []).filter((item) => !item?.readAt && !item?.readAtIso);
    if (!unread.length) return;

    const batch = writeBatch(db);
    const readAtIso = new Date().toISOString();

    unread.forEach((item) => {
        batch.update(doc(db, NOTIFICATIONS_COLLECTION, item.id), {
            readAt: serverTimestamp(),
            readAtIso
        });
    });

    await batch.commit();
};
