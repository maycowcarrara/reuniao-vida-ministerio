import { useEffect, useState } from 'react';
import { escolherGrupoAtivo, lerPreferenciaGrupo, salvarPreferenciaGrupo } from '../utils/grupoAtivo.js';

const getStorage = () => {
    try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
};

export const useGrupoAtivo = ({ ownerUid, config, enabled = true }) => {
    const [preferencia, setPreferencia] = useState(() => ({ ownerUid, id: lerPreferenciaGrupo(getStorage(), ownerUid) }));
    const selecionado = preferencia.ownerUid === ownerUid ? preferencia.id : lerPreferenciaGrupo(getStorage(), ownerUid);
    const grupoId = escolherGrupoAtivo({ ...config, preferencia: selecionado });
    useEffect(() => {
        if (!enabled || !ownerUid || !grupoId) return;
        salvarPreferenciaGrupo(getStorage(), ownerUid, grupoId);
        let cancelada = false;
        queueMicrotask(() => {
            if (!cancelada) setPreferencia(prev => prev.ownerUid === ownerUid && prev.id === grupoId ? prev : { ownerUid, id: grupoId });
        });
        return () => { cancelada = true; };
    }, [ownerUid, grupoId, enabled]);
    return { grupoId, selecionarGrupo: id => setPreferencia({ ownerUid, id }) };
};
