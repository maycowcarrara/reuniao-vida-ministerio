import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { normalizeSystemConfig } from '../config/appConfig';

const LOCAL_ADMIN_UID_KEY = 'quadro_admin_uid';

export function useQuadroPublico(fallbackUid = '') {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);

    const configuredAdminUid = String(import.meta.env.VITE_ADMIN_UID || '').trim();
    const runtimeFallbackUid = String(fallbackUid || '').trim();

    useEffect(() => {
        let storedAdminUid = '';

        if (typeof window !== 'undefined') {
            try {
                storedAdminUid = String(window.localStorage.getItem(LOCAL_ADMIN_UID_KEY) || '').trim();
            } catch {
                storedAdminUid = '';
            }
        }

        const effectiveAdminUid = configuredAdminUid || runtimeFallbackUid || storedAdminUid;

        if (!effectiveAdminUid) {
            setDados({ configuracoes: {}, historico_reunioes: [] });
            setLoading(false);
            return;
        }

        setLoading(true);

        let active = true;

        async function fetchFallbackDadosPublicos() {
            try {
                // 1. Puxa o nome da Congregação
                const configRef = doc(db, 'users', effectiveAdminUid, 'configuracoes', 'geral');
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? normalizeSystemConfig(configSnap.data()) : normalizeSystemConfig();

                // 2. Puxa as programações
                const progRef = collection(db, 'users', effectiveAdminUid, 'programacao');
                const progSnap = await getDocs(progRef);
                const programacoes = progSnap.docs.map(d => d.data());

                if (!active) return;

                setDados({
                    configuracoes: config,
                    historico_reunioes: programacoes
                });
            } catch (error) {
                console.error("Erro ao buscar quadro público:", error);
                if (active) {
                    setDados({ configuracoes: {}, historico_reunioes: [] });
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        const publicRef = doc(db, 'quadros_publicos', effectiveAdminUid);
        const unsubscribe = onSnapshot(publicRef, (publicSnap) => {
            if (!active) return;

            if (publicSnap.exists()) {
                const publicData = publicSnap.data() || {};
                setDados({
                    configuracoes: normalizeSystemConfig(publicData.configuracoes || {}),
                    historico_reunioes: Array.isArray(publicData.historico_reunioes) ? publicData.historico_reunioes : []
                });
                setLoading(false);
                return;
            }

            fetchFallbackDadosPublicos();
        }, (error) => {
            console.error("Erro ao escutar quadro público:", error);
            if (active) {
                setDados({ configuracoes: {}, historico_reunioes: [] });
                setLoading(false);
            }
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, [configuredAdminUid, runtimeFallbackUid]);

    return { dados, loading };
}
