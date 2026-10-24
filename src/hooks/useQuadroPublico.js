import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { normalizeSystemConfig } from '../config/appConfig';

import { MULTI_GRUPOS_LOCAL } from '../config/multiGruposLocal.js';
import { assinarQuadroLocal, lerQuadroLocal } from '../services/quadroLocal.js';

const LOCAL_ADMIN_UID_KEY = 'quadro_admin_uid';

export function useQuadroPublico(fallbackUid = '') {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);

    const configuredAdminUid = String(import.meta.env.VITE_ADMIN_UID || '').trim();
    const runtimeFallbackUid = String(fallbackUid || '').trim();

    useEffect(() => {
        if (MULTI_GRUPOS_LOCAL) {
            const atualizar = () => { setDados(lerQuadroLocal() || { configuracoes: {}, historico_reunioes: [] }); setLoading(false); };
            queueMicrotask(atualizar); return assinarQuadroLocal(atualizar);
        }
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
            queueMicrotask(() => { setDados({ configuracoes: {}, historico_reunioes: [] }); setLoading(false); });
            return;
        }

        queueMicrotask(() => setLoading(true));

        let active = true;

        const publicRef = doc(db, 'quadros_publicos', effectiveAdminUid);
        const unsubscribe = onSnapshot(publicRef, (publicSnap) => {
            if (!active) return;

            if (publicSnap.exists()) {
                const publicData = publicSnap.data() || {};
                setDados({
                    ownerUid: effectiveAdminUid,
                    configuracoes: normalizeSystemConfig(publicData.configuracoes || {}),
                    historico_reunioes: Array.isArray(publicData.historico_reunioes) ? publicData.historico_reunioes : []
                });
                setLoading(false);
                return;
            }

            setDados({ ownerUid: effectiveAdminUid, configuracoes: {}, historico_reunioes: [] }); setLoading(false);
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
