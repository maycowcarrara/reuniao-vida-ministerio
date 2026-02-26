import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useQuadroPublico() {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);

    // O seu UID correto!
    const ADMIN_UID = "X8GNogUkSlNyzsjjyRHIlXA31FL2";

    useEffect(() => {
        async function fetchDadosPublicos() {
            try {
                // 1. Puxa o nome da Congregação
                const configRef = doc(db, 'users', ADMIN_UID, 'configuracoes', 'geral');
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? configSnap.data() : {};

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
    }, []);

    return { dados, loading };
}