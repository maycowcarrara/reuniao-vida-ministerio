import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { normalizeSystemConfig } from '../config/appConfig';

export function useQuadroPublico() {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);

    // O seu UID
    const ADMIN_UID = import.meta.env.VITE_ADMIN_UID;

    useEffect(() => {
        if (!ADMIN_UID) {
            setDados({ configuracoes: {}, historico_reunioes: [] });
            setLoading(false);
            return;
        }

        async function fetchDadosPublicos() {
            try {
                // 1. Puxa o nome da Congregação
                const configRef = doc(db, 'users', ADMIN_UID, 'configuracoes', 'geral');
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? normalizeSystemConfig(configSnap.data()) : normalizeSystemConfig();

                // 2. Puxa as programações
                const progRef = collection(db, 'users', ADMIN_UID, 'programacao');
                const progSnap = await getDocs(progRef);
                const programacoes = progSnap.docs.map(d => d.data());

                setDados({
                    configuracoes: config,
                    historico_reunioes: programacoes
                });
            } catch (error) {
                console.error("Erro ao buscar quadro público:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchDadosPublicos();
    }, [ADMIN_UID]);

    return { dados, loading };
}
