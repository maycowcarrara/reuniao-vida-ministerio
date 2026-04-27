import {
    collection,
    deleteDoc,
    doc,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch
} from 'firebase/firestore';

import { db } from './firebase';

export const NOTIFICATIONS_COLLECTION = 'notificacoes';
const FIRESTORE_BATCH_LIMIT = 450;

export const createInternalNotification = async ({
    id = '',
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

    const safeId = String(id || '').trim();
    const ref = safeId
        ? doc(db, NOTIFICATIONS_COLLECTION, safeId)
        : doc(collection(db, NOTIFICATIONS_COLLECTION));
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

    const readAtIso = new Date().toISOString();

    for (let index = 0; index < unread.length; index += FIRESTORE_BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = unread.slice(index, index + FIRESTORE_BATCH_LIMIT);

        chunk.forEach((item) => {
            batch.update(doc(db, NOTIFICATIONS_COLLECTION, item.id), {
                readAt: serverTimestamp(),
                readAtIso
            });
        });

        await batch.commit();
    }
};

export const deleteNotification = async (id) => {
    const safeId = String(id || '').trim();
    if (!safeId) return;

    await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, safeId));
};

export const deleteReadNotifications = async (notifications = []) => {
    const read = (notifications || []).filter((item) => item?.readAt || item?.readAtIso);
    if (!read.length) return;

    for (let index = 0; index < read.length; index += FIRESTORE_BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = read.slice(index, index + FIRESTORE_BATCH_LIMIT);

        chunk.forEach((item) => {
            if (item?.id) {
                batch.delete(doc(db, NOTIFICATIONS_COLLECTION, item.id));
            }
        });

        await batch.commit();
    }
};
