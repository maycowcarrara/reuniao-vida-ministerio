import { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import {
    collection,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    writeBatch,
    getDocs
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const ESTADO_INICIAL = {
    configuracoes: { idioma: 'pt', nome_cong: '', dia_reuniao: 'Segunda-feira', horario: '19:30' },
    alunos: [],
    historico_reunioes: []
};

export function useGerenciadorDados() {
    const [dados, setDados] = useState(ESTADO_INICIAL);
    const [usuario, setUsuario] = useState(null);
    const [loading, setLoading] = useState(true);

    // 1. Monitorar Login
    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            setUsuario(user);
            if (!user) {
                setDados(ESTADO_INICIAL);
                setLoading(false);
            }
        });
        return () => unsubAuth();
    }, []);

    // 2. Sincronizar Dados
    useEffect(() => {
        if (!usuario) return;

        setLoading(true);
        const uid = usuario.uid;
        const basePath = `users/${uid}`;

        const unsubConfig = onSnapshot(doc(db, basePath, "configuracoes", "geral"), (docSnap) => {
            if (docSnap.exists()) {
                setDados(prev => ({ ...prev, configuracoes: docSnap.data() }));
            }
        });

        const unsubAlunos = onSnapshot(collection(db, basePath, "alunos"), (snap) => {
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            setDados(prev => ({ ...prev, alunos: lista }));
        });

        const unsubProg = onSnapshot(collection(db, basePath, "programacao"), (snap) => {
            const lista = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            lista.sort((a, b) => new Date(a.semana) - new Date(b.semana));
            setDados(prev => ({ ...prev, historico_reunioes: lista }));
            setLoading(false);
        });

        return () => {
            unsubConfig();
            unsubAlunos();
            unsubProg();
        };
    }, [usuario]);

    // --- AÇÕES ---

    const salvarItem = async (colecao, id, objeto) => {
        if (!usuario) return;
        const path = `users/${usuario.uid}/${colecao}`;
        const docRef = id ? doc(db, path, id) : doc(collection(db, path));
        const objetoLimpo = JSON.parse(JSON.stringify(objeto));
        await setDoc(docRef, { ...objetoLimpo, id: docRef.id }, { merge: true });
    };

    const excluirItem = async (colecao, id) => {
        if (!usuario) return;
        await deleteDoc(doc(db, `users/${usuario.uid}/${colecao}`, id));
    };

    // --- NOVA FUNÇÃO: EXCLUIR SEMANA E LIMPAR HISTÓRICO ---
    const excluirSemanaELimparHistorico = async (semanaId, dataDaSemana) => {
        if (!usuario) return;

        try {
            const uid = usuario.uid;
            const batch = writeBatch(db);

            // 1. Excluir o documento da semana na coleção "programacao"
            const semanaRef = doc(db, `users/${uid}/programacao`, semanaId);
            batch.delete(semanaRef);

            // 2. Buscar todos os alunos para verificar quem tem essa data no histórico
            if (dataDaSemana) {
                const alunosRef = collection(db, `users/${uid}/alunos`);
                const snapshot = await getDocs(alunosRef);

                snapshot.docs.forEach((docSnap) => {
                    const aluno = docSnap.data();

                    if (aluno.historico && Array.isArray(aluno.historico) && aluno.historico.length > 0) {
                        // Filtra o histórico, removendo qualquer registro que tenha a mesma data da semana excluída
                        const historicoLimpo = aluno.historico.filter(h => h.data !== dataDaSemana);

                        // Se o tamanho do array diminuiu, significa que o aluno estava designado nesta semana apagada
                        if (historicoLimpo.length !== aluno.historico.length) {
                            batch.update(docSnap.ref, { historico: historicoLimpo });
                        }
                    }
                });
            }

            // 3. Executar todas as operações de uma vez só (garante que nada fique quebrado)
            await batch.commit();

        } catch (error) {
            console.error("Erro ao excluir semana e limpar histórico:", error);
            throw error;
        }
    };

    const importarBackupParaUsuario = async (jsonFile) => {
        if (!usuario) return;

        try {
            const dadosImport = jsonFile.dadosSistema || jsonFile;
            const cong = dadosImport.configuracoes || {};
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
                    const semanaId = semanaStr.replace(/[\/\s]/g, '-');
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
            const collections = ['alunos', 'programacao', 'configuracoes'];

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

    return {
        dados,
        loading,
        usuario,
        salvarItem,
        excluirItem,
        excluirSemanaELimparHistorico,
        importarBackupParaUsuario,
        resetarConta
    };
}