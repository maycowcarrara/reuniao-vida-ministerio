import React, { useEffect, useRef, useState } from 'react';
import { getGrupoEfetivoId, participaDoGrupo } from '../utils/gruposProgramacao.js';
import { normalizeOcorrenciaReuniao, TIPOS_REUNIAO } from '../utils/ocorrenciasReuniao.js';
import { listarSlotsReuniao } from '../utils/designacoesPorGrupo.js';
import { useSectionMessages } from '../i18n';
import { useProtecaoTrocaGrupo } from '../hooks/useProtecaoTrocaGrupo.js';
import { dialog } from '../utils/dialog';

export default function PainelGrupo({ programacoes, alunos, config, grupoId, onEvento, onHistorico, onDesignar, busy }) {
    const T = useSectionMessages('operacaoGrupo');
    const G = useSectionMessages('gruposProgramacao');
    const [data, setData] = useState('');
    const [tipo, setTipo] = useState('visita');
    const [ids, setIds] = useState([]);
    const [tipos, setTipos] = useState(['meioSemana', 'fimDeSemana']);
    const [erro, setErro] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [pendente, setPendente] = useState(false);
    const pendingRef = useRef(false);
    useProtecaoTrocaGrupo(async () => !pendingRef.current && (!data || await dialog.confirm({ title: G.sairTitulo, message: G.sairMensagem, confirmText: G.sairConfirmar, cancelText: G.continuarEditando })));
    useEffect(() => {
        if (!data) return;
        const proteger = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', proteger);
        return () => window.removeEventListener('beforeunload', proteger);
    }, [data]);
    const agir = async acao => {
        if (pendingRef.current || busy) return;
        pendingRef.current = true; setPendente(true); setErro(''); setMensagem('');
        try { await acao(); setMensagem(T.salvo); }
        catch (error) { setErro(error.message); }
        finally { pendingRef.current = false; setPendente(false); }
    };
    const doGrupo = programacoes.filter(item => getGrupoEfetivoId(item, config) === grupoId);
    const reunioes = doGrupo.flatMap(programacao => TIPOS_REUNIAO.map(tipoReuniao => ({ programacao, tipoReuniao,
        reuniao: normalizeOcorrenciaReuniao(programacao, tipoReuniao, config) }))).filter(item => item.reuniao.operacional && !item.programacao.arquivada);
    const toggle = (value, array, setter) => setter(array.includes(value) ? array.filter(item => item !== value) : [...array, value]);
    return <section className="max-w-4xl mx-auto p-4 space-y-4">
        <h2 className="font-bold text-xl">{config.grupos[grupoId].nome}</h2>
        <p>{T.participantes}: {alunos.filter(aluno => participaDoGrupo(aluno, grupoId, config)).length} · {T.reunioesAtivas}: {reunioes.length}</p>
        <button className="underline" onClick={onDesignar}>{T.designar}</button>
        {erro && <p role="alert">{erro}</p>}{mensagem && <p role="status">{mensagem}</p>}
        <ul className="space-y-2">{reunioes.map(({ programacao, tipoReuniao, reuniao }) => <li key={`${programacao.id}-${tipoReuniao}`} className="border bg-white rounded-xl p-3">
            {G[tipoReuniao]} — {reuniao.data} {reuniao.horario} · {T.designadas}: {listarSlotsReuniao(programacao, tipoReuniao, { incluirVagos: false }).length}
            {reuniao.eventoEspecial && <p>{T.eventos}: {reuniao.eventoEspecial.tipo}</p>}
        </li>)}</ul>
        <fieldset disabled={busy || pendente} className="border bg-white rounded-xl p-4 space-y-3">
            <legend>{T.eventos}</legend>
            <label>{T.dataEvento}<input type="date" value={data} onChange={event => setData(event.target.value)} className="block border rounded p-2" /></label>
            <label>{T.tipoEvento}<select value={tipo} onChange={event => setTipo(event.target.value)} className="block border rounded p-2">{['normal', 'visita', 'assembleia', 'congresso'].map(key => <option key={key} value={key}>{T[key]}</option>)}</select></label>
            <p className="text-sm">{T.eventoAviso}</p>
            <button disabled={!data} onClick={() => agir(async () => { await onEvento({ grupoId, data, tipo }); setData(''); })}>{T.salvarEvento}</button>
            <ul>{config.grupos[grupoId].eventosAnuais.map(evento => <li key={evento.dataInicio}>{evento.dataInput || evento.dataInicio} — {T[evento.tipo] || evento.tipo}</li>)}</ul>
        </fieldset>
        <fieldset disabled={busy || pendente} className="border bg-white rounded-xl p-4 space-y-3">
            <legend>{T.historico}</legend>
            <p>{T.historicoAviso}</p>
            {doGrupo.map(item => <label key={item.id} className="block"><input type="checkbox" checked={ids.includes(item.id)} onChange={() => toggle(item.id, ids, setIds)} /> {item.semana}</label>)}
            {TIPOS_REUNIAO.map(key => <label key={key} className="block"><input type="checkbox" checked={tipos.includes(key)} onChange={() => toggle(key, tipos, setTipos)} /> {G[key]}</label>)}
            <button disabled={!ids.length || !tipos.length} onClick={() => agir(() => onHistorico({ grupoId, programacaoIds: ids, tipos }))}>{T.sincronizar}</button>
        </fieldset>
    </section>;
}
