import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
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
import { lerDadosSessaoEnsaio, guardarDadosSessaoEnsaio, USUARIO_ENSAIO_GRUPOS } from '../data/ensaioGrupos.js';
import { mergeCamposPreservados } from '../utils/programacoesPorGrupo.js';
import { MULTI_GRUPOS_LOCAL } from '../config/multiGruposLocal.js';
import { projetarQuadroPublico } from '../utils/quadroPublico.js';
import { publicarQuadroLocal } from '../services/quadroLocal.js';
import { integracoesLocais, atualizarContextoIntegracoesLocal } from '../services/integracoesLocais.js';
import { exigirEscritaCompativel, gruposRemotosAtivos } from '../utils/compatibilidadeGrupos.js';
import { createRemoteGroupAdapter } from '../services/adaptadorGruposFirestore.js';
import { acompanharOperacao } from '../utils/progressoOperacoes.js';

const acompanhar = (tipo, acao) => (...args) => acompanharOperacao(tipo, () => acao(...args));

const ESTADO_INICIAL = {
    configuracoes: DEFAULT_CONFIG,
    alunos: [],
    historico_reunioes: []
};

export function useGerenciadorDados({ syncConfirmacoes = true, localOnly = false } = {}) {
    const modoLocal = localOnly && MULTI_GRUPOS_LOCAL;
    const [dados, setDados] = useState(() => modoLocal ? lerDadosSessaoEnsaio() : ESTADO_INICIAL);
    const [usuario, setUsuario] = useState(modoLocal ? USUARIO_ENSAIO_GRUPOS : null);
    const [confirmacoes, setConfirmacoes] = useState([]);
    const [notificacoes, setNotificacoes] = useState([]);
    const [loading, setLoading] = useState(!modoLocal);
    const [accessError, setAccessError] = useState(null);
    const handledPermissionError = useRef(false);
    const handleSnapshotError = useCallback(error => {
        console.error('Erro ao sincronizar dados:', error);
        setLoading(false);
        if (error?.code === 'permission-denied' && !handledPermissionError.current) {
            handledPermissionError.current = true;
            setAccessError(error);
            toast.error(error, 'Acesso restrito a administradores autorizados.');
            auth.signOut().catch(signOutError => console.error('Erro ao sair apos acesso negado:', signOutError));
        }
    }, []);
    const dataOwnerUid = modoLocal ? USUARIO_ENSAIO_GRUPOS.uid : resolveDataOwnerUid(usuario);
    const modoRemoto = !modoLocal && gruposRemotosAtivos(dados.configuracoes);
    const [remoto] = useState(() => createRemoteGroupAdapter({ db,
        getOwnerUid: () => { if (!auth.currentUser) throw new Error('Autenticação necessária.'); return resolveDataOwnerUid(auth.currentUser); } }));
    useEffect(() => { remoto.atualizarEstado(dados); }, [dados, remoto]);

    useEffect(() => {
        if (modoLocal) { guardarDadosSessaoEnsaio(dados); atualizarContextoIntegracoesLocal(dados); }
    }, [modoLocal, dados]);
    useEffect(() => {
        if (!modoLocal) return;
        const atualizar = () => { const s = integracoesLocais.snapshot(); setConfirmacoes(s.confirmacoes); setNotificacoes(s.notificacoes); };
        queueMicrotask(atualizar);
        return integracoesLocais.subscribe(atualizar);
    }, [modoLocal]);

    // 1. Monitorar Login
    useEffect(() => {
        if (modoLocal) return;
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            setUsuario(user);
            if (user) {
                handledPermissionError.current = false;
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
    }, [modoLocal]);

    // 2. Sincronizar Dados
    useEffect(() => {
        if (modoLocal) return;
        if (!usuario) return;

        const uid = dataOwnerUid;
        if (!uid) return;
        const basePath = `users/${uid}`;

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
            unsubNotifications();
        };
    }, [usuario, dataOwnerUid, modoLocal, handleSnapshotError]);

    // Alternar abas muda apenas este listener, preservando as assinaturas de
    // cadastro, configuração e programação que já estão sincronizadas.
    useEffect(() => {
        if (modoLocal) return;
        if (!usuario || !dataOwnerUid || !syncConfirmacoes) {
            queueMicrotask(() => setConfirmacoes([]));
            return;
        }
        return onSnapshot(collection(db, `users/${dataOwnerUid}/confirmacoes`), snap => {
            setConfirmacoes(snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.lastResponseAtIso || '').localeCompare(a.lastResponseAtIso || '')));
        }, handleSnapshotError);
    }, [usuario, dataOwnerUid, syncConfirmacoes, modoLocal, handleSnapshotError]);

    // --- AÇÕES ---

    const salvarItem = useCallback(async (colecao, id, objeto, opcoes = {}) => {
        if (modoLocal) {
            const campo = colecao === 'programacao' ? 'historico_reunioes' : colecao;
            setDados(prev => colecao === 'configuracoes'
                ? { ...prev, configuracoes: mergeCamposPreservados(prev.configuracoes, objeto) }
                : { ...prev, [campo]: [...(prev[campo] || []).filter(item => String(item.id) !== String(id)), objeto] });
            return;
        }
        exigirEscritaCompativel(dados.configuracoes, objeto);
        if (modoRemoto && colecao === 'configuracoes') return remoto.salvarConfig(objeto);
        if (modoRemoto && colecao === 'alunos') return remoto.salvarAluno(objeto, opcoes);
        if (modoRemoto && colecao === 'programacao') throw new Error('Use a operação transacional por grupo.');
        if (!usuario || !dataOwnerUid) return;
        const path = `users/${dataOwnerUid}/${colecao}`;
        const idNormalizado = id != null ? String(id).trim() : '';
        const docRef = idNormalizado ? doc(db, path, idNormalizado) : doc(collection(db, path));
        const objetoLimpo = JSON.parse(JSON.stringify(objeto));
        const deveMesclar = colecao !== 'programacao';
        await setDoc(docRef, { ...objetoLimpo, id: docRef.id }, { merge: deveMesclar });
    }, [usuario, dataOwnerUid, modoLocal, dados.configuracoes, modoRemoto, remoto]);

    const excluirItem = useCallback(async (colecao, id) => {
        if (modoLocal) {
            const campo = colecao === 'programacao' ? 'historico_reunioes' : colecao;
            setDados(prev => ({ ...prev, [campo]: (prev[campo] || []).filter(item => String(item.id) !== String(id)) }));
            return;
        }
        exigirEscritaCompativel(dados.configuracoes);
        if (modoRemoto && colecao === 'alunos') return remoto.excluirAluno(id);
        if (modoRemoto && colecao === 'programacao') throw new Error('Use a exclusão transacional por grupo.');
        if (!usuario || !dataOwnerUid) return;
        await deleteDoc(doc(db, `users/${dataOwnerUid}/${colecao}`, String(id)));
    }, [usuario, dataOwnerUid, modoLocal, dados.configuracoes, modoRemoto, remoto]);

    const publicarQuadroPublico = useCallback(async (payload) => {
        if (modoLocal) return publicarQuadroLocal(projetarQuadroPublico({ ...payload, ownerUid: dataOwnerUid }));
        if (modoRemoto) return remoto.publicar();
        exigirEscritaCompativel(dados.configuracoes);
        if (!usuario || !dataOwnerUid) return;
        const objetoLimpo = JSON.parse(JSON.stringify(payload || {}));
        await setDoc(doc(db, 'quadros_publicos', dataOwnerUid), {
            ...objetoLimpo,
            ownerUid: dataOwnerUid,
            updatedAtIso: new Date().toISOString()
        });
    }, [usuario, dataOwnerUid, modoLocal, dados.configuracoes, modoRemoto, remoto]);

    // Escrita real exige o contrato de ativação; fixtures continuam isoladas.
    const salvarLoteProgramacoes = useCallback(async lote => {
        const { upserts, excluirIds } = lote;
        if (modoRemoto) return remoto.salvarLote(lote);
        if (!modoLocal) throw new Error('Escrita multi-grupos indisponível antes da ativação autorizada.');
        setDados(prev => ({ ...prev, historico_reunioes: [
            ...prev.historico_reunioes.filter(item => !excluirIds.includes(item.id) && !upserts.some(next => next.id === item.id)),
            ...upserts,
        ] }));
    }, [modoLocal, modoRemoto, remoto]);

    const salvarHistoricosLocais = useCallback(async (alunos, escopo) => {
        if (modoRemoto) return remoto.salvarHistoricos(alunos, escopo);
        if (!modoLocal) throw new Error('Histórico por grupo disponível somente no ensaio local.');
        const historicos = new Map(alunos.map(aluno => [String(aluno.id), aluno.historico]));
        setDados(prev => ({ ...prev, alunos: prev.alunos.map(aluno => historicos.has(String(aluno.id))
            ? { ...aluno, historico: historicos.get(String(aluno.id)) } : aluno) }));
    }, [modoLocal, modoRemoto, remoto]);

    // --- FUNÇÃO SIMPLIFICADA: EXCLUIR SEMANA ---
    // Mantivemos o mesmo nome para não quebrar a importação no App.jsx
    const excluirSemanaELimparHistorico = useCallback(async (semanaId) => {
        if (modoRemoto) throw new Error("Use a exclusão transacional com escopo de grupo.");
        if (modoLocal) return excluirItem('programacao', semanaId);
        exigirEscritaCompativel(dados.configuracoes);
        if (!usuario || !dataOwnerUid) return;

        try {
            // Como a limpeza do histórico dos alunos agora acontece no Frontend (Designar.jsx),
            // aqui nós apenas deletamos a programação do banco de dados.
            await deleteDoc(doc(db, `users/${dataOwnerUid}/programacao`, semanaId));
        } catch (error) {
            console.error("Erro ao excluir semana:", error);
            throw error;
        }
    }, [modoRemoto, modoLocal, excluirItem, dados.configuracoes, usuario, dataOwnerUid]);

    const marcarNotificacaoComoLida = useCallback(async (id) => {
        if (modoLocal) return integracoesLocais.markRead(id);
        await markNotificationRead(id);
    }, [modoLocal]);

    const marcarTodasNotificacoesComoLidas = useCallback(async () => {
        if (modoLocal) return integracoesLocais.markAllRead();
        await markAllNotificationsRead(notificacoes);
    }, [modoLocal, notificacoes]);

    const excluirNotificacao = useCallback(async (id) => {
        if (modoLocal) return integracoesLocais.deleteNotification(id);
        await deleteNotification(id);
    }, [modoLocal]);

    const excluirNotificacoesLidas = useCallback(async () => {
        if (modoLocal) return integracoesLocais.deleteRead();
        await deleteReadNotifications(notificacoes);
    }, [modoLocal, notificacoes]);

    const acoes = useMemo(() => ({
        salvarItem: (...args) => acompanharOperacao(args[0] === 'alunos' ? 'salvarCadastro' : args[0] === 'configuracoes' ? 'salvarConfiguracoes' : 'salvarProgramacoes', () => salvarItem(...args)),
        salvarLoteProgramacoes: acompanhar('salvarProgramacoes', salvarLoteProgramacoes),
        salvarHistoricosLocais: acompanhar('historico', salvarHistoricosLocais),
        excluirItem: acompanhar('excluir', excluirItem),
        publicarQuadroPublico: acompanhar('publicar', publicarQuadroPublico),
        excluirSemanaELimparHistorico: acompanhar('excluir', excluirSemanaELimparHistorico),
        marcarNotificacaoComoLida: acompanhar('notificacao', marcarNotificacaoComoLida),
        marcarTodasNotificacoesComoLidas: acompanhar('notificacao', marcarTodasNotificacoesComoLidas),
        excluirNotificacao: acompanhar('notificacao', excluirNotificacao),
        excluirNotificacoesLidas: acompanhar('notificacao', excluirNotificacoesLidas)
    }), [salvarItem, salvarLoteProgramacoes, salvarHistoricosLocais, excluirItem, publicarQuadroPublico, excluirSemanaELimparHistorico,
        marcarNotificacaoComoLida, marcarTodasNotificacoesComoLidas, excluirNotificacao, excluirNotificacoesLidas]);

    return { dados, confirmacoes, notificacoes, loading, accessError, usuario, dataOwnerUid, ...acoes };
}
