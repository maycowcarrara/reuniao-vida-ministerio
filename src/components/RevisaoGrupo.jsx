import React, { useState } from 'react';
import { getGrupoEfetivoId } from '../utils/gruposProgramacao.js';
import { getReunioesAtivas } from '../utils/ocorrenciasReuniao.js';
import { projetarConfigGrupo } from '../utils/grupoAtivo.js';
import RevisarEnviar from './RevisarEnviar/index.jsx';
import IntegracoesGrupo from './IntegracoesGrupo.jsx';
import IntegracoesGrupoReal from './IntegracoesGrupoReal.jsx';

export default function RevisaoGrupo({ config, grupoId, programacoes, onExecutar, confirmacoes = [], programacaoFoco = '', localOnly = true, ownerUid, alunos = [] }) {
    const [selecao, setSelecao] = useState({});
    const [status, setStatus] = useState('');
    const Integracoes = localOnly ? IntegracoesGrupo : IntegracoesGrupoReal;
    const foco = projetarConfigGrupo(config, grupoId);
    const es = foco.idioma === 'es';
    const programas = programacoes.filter(item => getGrupoEfetivoId(item, config) === grupoId && !item.arquivada)
        .map(item => ({ ...item, fimDeSemana: { ...item.fimDeSemana, ativo: getReunioesAtivas(item, config).some(r => r.tipoReuniao === 'fimDeSemana') } }))
        .filter(item => getReunioesAtivas(item, config).length);
    const executar = async pedido => {
        try {
            const resultado = await onExecutar(pedido);
            setStatus(resultado.erroPublicacao ? `${es ? 'Datos guardados; tablero pendiente' : 'Dados salvos; quadro pendente'}: ${resultado.erroPublicacao.message}`
                : localOnly ? (es ? 'Tablero simulado actualizado en memoria.' : 'Quadro simulado atualizado na memória.') : (es ? 'Tablero publicado.' : 'Quadro publicado.'));
        } catch (error) { setStatus(error.message); }
    };
    return <section className="p-4">
        <div className="no-print">
        <h2>{es ? 'Tablero e impresión' : 'Quadro e impressão'}</h2>
        <Integracoes key={grupoId} ownerUid={ownerUid} alunos={alunos} config={config} grupoId={grupoId} programacoes={programacoes} confirmacoes={confirmacoes} programacaoFoco={programacaoFoco} />
        <p>{es ? 'Cada reunión se publica por separado.' : 'Cada reunião é publicada separadamente.'}</p>
        {programas.map(programa => <div key={programa.id} className="p-2 border-b">{programa.semana}
            {getReunioesAtivas(programa, config).map(reuniao => <label className="m-3 inline-block" key={reuniao.tipoReuniao}>
                <input type="checkbox" checked={reuniao.publicada} onChange={e => executar({ grupoId, republicar: true, operacoes: [{ tipo: 'patch', programacaoId: programa.id,
                    alteracoes: { publicadaNoQuadro: true,
                        ...(programa.publicadaNoQuadro === false ? { [reuniao.tipoReuniao === 'fimDeSemana' ? 'meioSemana' : 'fimDeSemana']: { publicadaNoQuadro: false } } : {}),
                        [reuniao.tipoReuniao]: { publicadaNoQuadro: e.target.checked } } }] })} />
                {reuniao.tipoReuniao === 'fimDeSemana' ? (es ? 'Fin de semana' : 'Fim de semana') : (es ? 'Entre semana' : 'Meio de semana')}: {reuniao.data} {reuniao.horario}
            </label>)}
        </div>)}
        <button type="button" className="p-3 border rounded" onClick={() => executar({ grupoId, operacoes: [], republicar: true })}>{localOnly ? (es ? 'Volver a publicar conjunto completo (simulado)' : 'Republicar conjunto completo (simulado)') : (es ? 'Volver a publicar conjunto completo' : 'Republicar conjunto completo')}</button>
        <p role="status">{status}</p>
        {!programas.length && <p>{es ? 'No hay reuniones operativas.' : 'Nenhuma reunião operacional.'}</p>}
        </div>
        <RevisarEnviar somenteImpressao historico={programas} alunos={[]} config={foco} sharedWeekSelection={selecao} setSharedWeekSelection={setSelecao} />
    </section>;
}
