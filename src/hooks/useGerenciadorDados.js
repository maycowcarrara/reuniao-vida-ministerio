import { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import {
    collection,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    query,
    where,
    limit
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { DEFAULT_CONFIG, normalizeSystemConfig } from '../config/appConfig';
import { getSemanaSortTimestamp } from '../utils/revisarEnviar/dates';
import {
    deleteNotification,
    deleteReadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    NOTIFICATIONS_COLLECTION
} from '../services/notificacoesInternas';
import { toast } from '../utils/toast';
import { resolveDataOwnerUid } from '../services/adminAccess';

const ESTADO_INICIAL = {
    configuracoes: DEFAULT_CONFIG,
    alunos: [],
    historico_reunioes: []
};

export function useGerenciadorDados({ syncConfirmacoes = true } = {}) {
    const [dados, setDados] = useState(ESTADO_INICIAL);
    const [usuario, setUsuario] = useState(null);
    const [confirmacoes, setConfirmacoes] = useState([]);
    const [notificacoes, setNotificacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState(null);
    const dataOwnerUid = resolveDataOwnerUid(usuario);

    // 1. Monitorar Login
    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            setUsuario(user);
            if (user) {
                setAccessError(null);
                setLoading(true);
            } else {
                setDados(ESTADO_INICIAL);
                setConfirmacoes([]);
                setNotificacoes([]);
                setAccessError(null);
                setLoading(false);
            }
        });
        return () => unsubAuth();
    }, []);

    // 2. Sincronizar Dados
    useEffect(() => {
        if (!usuario) return;

        const uid = dataOwnerUid;
        if (!uid) return;
        const basePath = `users/${uid}`;
        let handledPermissionError = false;

        const handleSnapshotError = (error) => {
            console.error("Erro ao sincronizar dados:", error);
            setLoading(false);

            if (error?.code === 'permission-denied' && !handledPermissionError) {
                handledPermissionError = true;
                setAccessError(error);
                toast.error(error, 'Acesso restrito a administradores autorizados.');
                auth.signOut().catch((signOutError) => console.error("Erro ao sair apos acesso negado:", signOutError));
            }
        };

        const unsubConfig = onSnapshot(doc(db, basePath, "configuracoes", "geral"), (docSnap) => {
            if (docSnap.exists()) {
                setDados(prev => ({ ...prev, configuracoes: normalizeSystemConfig(docSnap.data()) }));
            }
        }, handleSnapshotError);

        const unsubAlunos = onSnapshot(collection(db, basePath, "alunos"), (snap) => {
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            setDados(prev => ({ ...prev, alunos: lista }));
        }, handleSnapshotError);

        const unsubProg = onSnapshot(collection(db, basePath, "programacao"), (snap) => {
            const lista = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            lista.sort((a, b) => getSemanaSortTimestamp(a) - getSemanaSortTimestamp(b));
            setDados(prev => ({ ...prev, historico_reunioes: lista }));
            setLoading(false);
        }, handleSnapshotError);

        let unsubConfirmacoes = () => {};
        if (syncConfirmacoes) {
            unsubConfirmacoes = onSnapshot(collection(db, basePath, "confirmacoes"), (snap) => {
                const lista = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (b.lastResponseAtIso || '').localeCompare(a.lastResponseAtIso || ''));

                setConfirmacoes(lista);
            }, handleSnapshotError);
        } else {
            queueMicrotask(() => setConfirmacoes([]));
        }

        const notificationsQuery = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where('ownerUid', '==', uid),
            limit(75)
        );

        const unsubNotifications = onSnapshot(notificationsQuery, (snap) => {
            const lista = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));

            setNotificacoes(lista);
        }, handleSnapshotError);

        return () => {
            unsubConfig();
            unsubAlunos();
            unsubProg();
            unsubConfirmacoes();
            unsubNotifications();
        };
    }, [usuario, dataOwnerUid, syncConfirmacoes]);

    // --- AÇÕES ---

    const salvarItem = async (colecao, id, objeto) => {
        if (!usuario || !dataOwnerUid) return;
        const path = `users/${dataOwnerUid}/${colecao}`;
        const idNormalizado = id != null ? String(id).trim() : '';
        const docRef = idNormalizado ? doc(db, path, idNormalizado) : doc(collection(db, path));
        const objetoLimpo = JSON.parse(JSON.stringify(objeto));
        const deveMesclar = colecao !== 'programacao';
        await setDoc(docRef, { ...objetoLimpo, id: docRef.id }, { merge: deveMesclar });
    };

    const excluirItem = async (colecao, id) => {
        if (!usuario || !dataOwnerUid) return;
        await deleteDoc(doc(db, `users/${dataOwnerUid}/${colecao}`, String(id)));
    };

    const publicarQuadroPublico = async (payload) => {
        if (!usuario || !dataOwnerUid) return;
        const objetoLimpo = JSON.parse(JSON.stringify(payload || {}));
        await setDoc(doc(db, 'quadros_publicos', dataOwnerUid), {
            ...objetoLimpo,
            ownerUid: dataOwnerUid,
            updatedAtIso: new Date().toISOString()
        });
    };

    // --- FUNÇÃO SIMPLIFICADA: EXCLUIR SEMANA ---
    // Mantivemos o mesmo nome para não quebrar a importação no App.jsx
    const excluirSemanaELimparHistorico = async (semanaId) => {
        if (!usuario || !dataOwnerUid) return;

        try {
            // Como a limpeza do histórico dos alunos agora acontece no Frontend (Designar.jsx),
            // aqui nós apenas deletamos a programação do banco de dados.
            await deleteDoc(doc(db, `users/${dataOwnerUid}/programacao`, semanaId));
        } catch (error) {
            console.error("Erro ao excluir semana:", error);
            throw error;
        }
    };

    const marcarNotificacaoComoLida = async (id) => {
        await markNotificationRead(id);
    };

    const marcarTodasNotificacoesComoLidas = async () => {
        await markAllNotificationsRead(notificacoes);
    };

    const excluirNotificacao = async (id) => {
        await deleteNotification(id);
    };

    const excluirNotificacoesLidas = async () => {
        await deleteReadNotifications(notificacoes);
    };

    return {
        dados,
        confirmacoes,
        notificacoes,
        loading,
        accessError,
        usuario,
        dataOwnerUid,
        salvarItem,
        excluirItem,
        publicarQuadroPublico,
        excluirSemanaELimparHistorico,
        marcarNotificacaoComoLida,
        marcarTodasNotificacoesComoLidas,
        excluirNotificacao,
        excluirNotificacoesLidas
    };
}
