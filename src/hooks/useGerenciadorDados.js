import { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import {
    collection,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    writeBatch,
    getDocs,
    query,
    where
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { DEFAULT_CONFIG, normalizeSystemConfig } from '../config/appConfig';
import { getSemanaSortTimestamp } from '../utils/revisarEnviar/dates';
import {
    markAllNotificationsRead,
    markNotificationRead,
    NOTIFICATIONS_COLLECTION
} from '../services/notificacoesInternas';
import { toast } from '../utils/toast';

const ESTADO_INICIAL = {
    configuracoes: DEFAULT_CONFIG,
    alunos: [],
    historico_reunioes: []
};

export function useGerenciadorDados() {
    const [dados, setDados] = useState(ESTADO_INICIAL);
    const [usuario, setUsuario] = useState(null);
    const [confirmacoes, setConfirmacoes] = useState([]);
    const [notificacoes, setNotificacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState(null);

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

        const uid = usuario.uid;
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

        const unsubConfirmacoes = onSnapshot(collection(db, basePath, "confirmacoes"), (snap) => {
            const lista = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.lastResponseAtIso || '').localeCompare(a.lastResponseAtIso || ''));

            setConfirmacoes(lista);
        }, handleSnapshotError);

        const notificationsQuery = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where('ownerUid', '==', uid)
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
    }, [usuario]);

    // --- AÇÕES ---

    const salvarItem = async (colecao, id, objeto) => {
        if (!usuario) return;
        const path = `users/${usuario.uid}/${colecao}`;
        const idNormalizado = id != null ? String(id).trim() : '';
        const docRef = idNormalizado ? doc(db, path, idNormalizado) : doc(collection(db, path));
        const objetoLimpo = JSON.parse(JSON.stringify(objeto));
        await setDoc(docRef, { ...objetoLimpo, id: docRef.id }, { merge: true });
    };

    const excluirItem = async (colecao, id) => {
        if (!usuario) return;
        await deleteDoc(doc(db, `users/${usuario.uid}/${colecao}`, String(id)));
    };

    // --- FUNÇÃO SIMPLIFICADA: EXCLUIR SEMANA ---
    // Mantivemos o mesmo nome para não quebrar a importação no App.jsx
    const excluirSemanaELimparHistorico = async (semanaId) => {
        if (!usuario) return;

        try {
            // Como a limpeza do histórico dos alunos agora acontece no Frontend (Designar.jsx),
            // aqui nós apenas deletamos a programação do banco de dados.
            await deleteDoc(doc(db, `users/${usuario.uid}/programacao`, semanaId));
        } catch (error) {
            console.error("Erro ao excluir semana:", error);
            throw error;
        }
    };

    const importarBackupParaUsuario = async (jsonFile) => {
        if (!usuario) return;

        try {
            const dadosImport = jsonFile.dadosSistema || jsonFile;
            const cong = normalizeSystemConfig(dadosImport.configuracoes || {});
            const alunos = Array.isArray(dadosImport.alunos) ? dadosImport.alunos : [];
            const programacao = Array.isArray(dadosImport.historico_reunioes) ? dadosImport.historico_reunioes :
                Array.isArray(dadosImport.historicoreunioes) ? dadosImport.historicoreunioes :
                    Array.isArray(jsonFile.listaProgramacoes) ? jsonFile.listaProgramacoes : [];

            const batch = writeBatch(db);
            const uid = usuario.uid;

            const configRef = doc(db, `users/${uid}/configuracoes`, "geral");
            batch.set(configRef, cong);

            alunos.forEach(aluno => {
                if (!aluno) return;
                const alunoId = String(aluno.id || doc(collection(db, "temp")).id);
                const ref = doc(db, `users/${uid}/alunos`, alunoId);
                batch.set(ref, { ...aluno, id: alunoId });
            });

            programacao.forEach(semana => {
                if (!semana) return;
                const semanaStr = String(semana.semana || '');
                if (semanaStr.trim() !== '') {
                    const semanaId = semanaStr.replace(/[/\s]/g, '-');
                    const ref = doc(db, `users/${uid}/programacao`, semanaId);
                    batch.set(ref, { ...semana, semana: semanaStr });
                }
            });

            await batch.commit();

        } catch (error) {
            console.error("Erro na importação:", error);
            throw error;
        }
    };

    // --- NOVA FUNÇÃO: RESETAR CONTA (LIMPA TUDO) ---
    const resetarConta = async () => {
        if (!usuario) return;

        try {
            const uid = usuario.uid;
            const collections = ['alunos', 'programacao', 'configuracoes', 'confirmacoes'];

            // Firestore não deleta coleções inteiras nativamente, precisamos deletar doc por doc
            for (const colName of collections) {
                const colRef = collection(db, `users/${uid}/${colName}`);
                const snapshot = await getDocs(colRef);

                if (!snapshot.empty) {
                    const batch = writeBatch(db);
                    snapshot.docs.forEach((doc) => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                }
            }

            // Reseta estado local imediatamente para feedback visual
            setDados(ESTADO_INICIAL);

        } catch (error) {
            console.error("Erro ao resetar conta:", error);
            throw error;
        }
    };

    const marcarNotificacaoComoLida = async (id) => {
        await markNotificationRead(id);
    };

    const marcarTodasNotificacoesComoLidas = async () => {
        await markAllNotificationsRead(notificacoes);
    };

    return {
        dados,
        confirmacoes,
        notificacoes,
        loading,
        accessError,
        usuario,
        salvarItem,
        excluirItem,
        excluirSemanaELimparHistorico,
        importarBackupParaUsuario,
        resetarConta,
        marcarNotificacaoComoLida,
        marcarTodasNotificacoesComoLidas
    };
}
