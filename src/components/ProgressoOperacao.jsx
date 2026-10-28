import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { progressoOperacoes } from '../utils/progressoOperacoes.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useDocumentSectionMessages } from '../i18n';

export function BarraOperacao({ estado, agora, online = true, textos }) {
    const ativa = estado.fase === 'processando' || estado.pendentes > 0;
    const visivel = ativa || (estado.terminouEm > 0 && agora < estado.terminouEm + 250);
    if (!visivel) return null;
    // Avanço visual indeterminado: não representa percentual de dados gravados.
    // A linha só chega ao fim quando todas as promessas terminam.
    const largura = ativa ? 12 + 78 * (1 - Math.exp(-Math.max(0, agora - estado.desde) / 3500)) : 100;
    const detalhe = !online ? textos.semConexao : estado.falhou ? textos.falhou
        : ativa ? (textos[estado.tipo] || textos.processando) : textos.concluido;
    return <div role="progressbar" aria-label={textos.progresso} aria-valuetext={detalhe}
        {...(!ativa ? { 'aria-valuenow': 100, 'aria-valuemin': 0, 'aria-valuemax': 100 } : {})}
        className="rvm-progresso-topo no-print" data-ciclo={estado.ciclo} data-fase={ativa ? 'processando' : 'concluido'}
        data-estado={estado.falhou ? 'erro' : !online ? 'offline' : 'normal'}>
        <div className="rvm-progresso-topo-linha" style={{ width: `${largura}%` }} />
    </div>;
}

export default function ProgressoOperacao() {
    const estado = useSyncExternalStore(progressoOperacoes.subscribe, progressoOperacoes.getSnapshot, progressoOperacoes.getServerSnapshot);
    const textos = useDocumentSectionMessages('andamento');
    const online = useOnlineStatus();
    const [agora, setAgora] = useState(0);
    useEffect(() => {
        if (!estado.desde) return;
        if (estado.fase === 'processando') {
            const timer = window.setInterval(() => setAgora(Date.now()), 80);
            return () => window.clearInterval(timer);
        }
        const timer = window.setTimeout(() => setAgora(Date.now()), Math.max(0, estado.terminouEm + 250 - Date.now()));
        return () => window.clearTimeout(timer);
    }, [estado.ciclo, estado.desde, estado.fase, estado.terminouEm]);
    return <BarraOperacao key={estado.ciclo} estado={estado} agora={Math.max(agora, estado.desde)} online={online !== false} textos={textos} />;
}
