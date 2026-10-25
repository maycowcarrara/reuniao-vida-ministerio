import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock, X, Eye, Check, Plus, CalendarRange, List, Pencil, Ban } from 'lucide-react';
import { getWeekdayLabel } from '../config/appConfig.js';
import { getGrupoProgramacao } from '../utils/gruposProgramacao.js';
import { normalizeOcorrenciaReuniao } from '../utils/ocorrenciasReuniao.js';
import { prepararAgendamento, prepararGeracaoReunioes, prepararImportacaoMeioSemana, prepararEstadoOcorrencia, prepararEdicaoDiscurso, temOcorrencia } from '../utils/agendamentoReunioes.js';
import { extrairDados } from '../utils/importador/parser';
import { isLikelyHtml } from '../utils/importador/helpers';
import { useProtecaoTrocaGrupo } from '../hooks/useProtecaoTrocaGrupo.js';
import { dialog } from '../utils/dialog';
import { useSectionMessages } from '../i18n';

// Ações recebem operações com escopo; a interface não escreve no Firebase diretamente.
export default function ReunioesIndependentes({ config, grupoId, programacoes, onExecutar, busy = false, importar = false, modal = false, onClose }) {
    const T = useSectionMessages('reunioesIndependentes');
    const G = useSectionMessages('gruposProgramacao');
    const es = config.grupos[grupoId].idioma === 'es';
    const [aba, setAba] = useState('data');
    const rootRef = useRef(null);
    const fechandoRef = useRef(false);
    const grupo = getGrupoProgramacao(grupoId, config);
    const [tipo, setTipo] = useState(importar || !grupo.fimDeSemana.habilitada ? 'meioSemana' : 'fimDeSemana');
    const [data, setData] = useState('');
    const [horario, setHorario] = useState('');
    const [inicio, setInicio] = useState('');
    const [fim, setFim] = useState('');
    const [texto, setTexto] = useState('');
    const [conteudo, setConteudo] = useState(null);
    const [previa, setPrevia] = useState(null);
    const [erro, setErro] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [processando, setProcessando] = useState(false);
    const pendente = useRef(false);
    const [edicao, setEdicao] = useState(null);
    const dirty = !!(data || horario || inicio || fim || texto || edicao || previa);
    const bloqueado = busy || processando;
    const podeSair = useCallback(async () => !pendente.current && (!dirty || await dialog.confirm({
        title: G.sairTitulo, message: G.sairMensagem, confirmText: G.sairConfirmar, cancelText: G.continuarEditando,
    })), [dirty, G]);
    useProtecaoTrocaGrupo(podeSair);
    const fechar = useCallback(async () => {
        if (fechandoRef.current || bloqueado) return;
        fechandoRef.current = true;
        try { if (await podeSair()) onClose?.(); } finally { fechandoRef.current = false; }
    }, [bloqueado, podeSair, onClose]);
    useEffect(() => {
        if (!modal) return;
        const original = document.body.style.overflow, previous = document.activeElement;
        document.body.style.overflow = 'hidden';
        rootRef.current?.querySelector('input,select,button')?.focus();
        return () => { document.body.style.overflow = original; previous?.focus?.(); };
    }, [modal]);
    useEffect(() => {
        if (!modal) return;
        const onKey = event => {
            if (event.key === 'Escape' && !document.querySelector('[aria-labelledby="dialog-title"]')) { event.preventDefault(); fechar(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modal, fechar]);
    useEffect(() => {
        if (!dirty) return;
        const proteger = e => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', proteger);
        return () => window.removeEventListener('beforeunload', proteger);
    }, [dirty]);
    const executar = async acao => {
        if (pendente.current) return;
        pendente.current = true; setProcessando(true); setErro(''); setMensagem('');
        try { await acao(); }
        catch (error) { setErro(error.message); }
        finally { pendente.current = false; setProcessando(false); }
    };
    const confirmar = preparar => executar(async () => {
        await onExecutar({ grupoId, preparar });
        setPrevia(null); setMensagem(T.salvo);
        setData(''); setHorario(''); setTexto(''); setConteudo(null); setInicio(''); setFim('');
    });
    const contexto = { programacoes, config, grupoId };
    const prepararManual = estado => {
        const resultado = prepararAgendamento({ ...estado, tipo, data, horario });
        if (resultado.status !== 'criar') throw new Error(T[resultado.status]);
        return resultado;
    };
    const prepararImport = estado => prepararImportacaoMeioSemana({ ...estado, dados: conteudo, data, horario });
    const inputClass = 'mt-1.5 block w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100';
    const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40';
    const primaryClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40';
    const cardClass = 'space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5';
    const campo = (label, type, value, setter) => <label className="block min-w-0 text-[11px] font-bold text-slate-500">{label}
        <input required type={type} value={value} onChange={e => { setter(e.target.value); setPrevia(null); }} className={inputClass} />
    </label>;
    const mostrarPrevia = preparar => executar(async () => setPrevia(preparar(contexto)));
    const conteudoTela = <section ref={rootRef} className={`${modal ? '' : 'mx-auto max-w-4xl p-3 sm:p-6'} space-y-4 text-slate-800`}>
        {!modal && <div><h2 className="text-xl font-black">{importar ? T.importar : T.titulo}</h2><p className="mt-1 text-xs font-medium text-slate-500">{grupo.nome}</p></div>}
        {erro && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{erro}</p>}
        {mensagem && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</p>}
        <fieldset disabled={bloqueado} className="min-w-0 space-y-4">
            {(!importar || grupo.meioSemana.habilitada) && grupo.ativo && <>
                {!importar && <label className="block text-[11px] font-bold text-slate-500">{T.tipo}<select className={inputClass} value={tipo} onChange={e => { setTipo(e.target.value); setPrevia(null); setAba('data'); }}>
                    {['fimDeSemana', 'meioSemana'].filter(key => grupo[key].habilitada).map(key => <option key={key} value={key}>{G[key]}</option>)}
                </select></label>}
                {modal && <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label={es ? 'Agendamiento' : 'Agendamento'}>
                    {[['data', es ? 'Una fecha' : 'Uma data', Plus], ...(grupo[tipo].frequencia === 'semanal' ? [['semanal', es ? 'Semanal' : 'Semanal', CalendarRange]] : []), ['reunioes', es ? 'Reuniones' : 'Reuniões', List]].map(([id, label, Icon]) => <button key={id} role="tab" type="button" aria-selected={aba === id} onClick={() => setAba(id)} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${aba === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{React.createElement(Icon, { size: 14 })}{label}</button>)}
                </div>}
                {grupo[tipo].habilitada && (!modal || aba === 'data') && <div className={cardClass}>
                    <h3 className="flex items-center gap-2 text-sm font-black"><CalendarDays size={17} className="text-blue-600" />{importar ? T.importar : T.agendar}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">{campo(T.data, 'date', data, setData)}{campo(G.horario, 'time', horario, setHorario)}</div>
                    {importar && <>
                        <label className="block text-xs font-bold text-slate-500">{T.texto}<textarea className={`${inputClass} h-36`} value={texto} onChange={e => { setTexto(e.target.value); setConteudo(null); setPrevia(null); }} /></label>
                        <button type="button" className={buttonClass} onClick={() => executar(async () => { const extraido = await extrairDados(texto, isLikelyHtml(texto) ? 'html' : 'texto', grupo.idioma); if (!extraido?.partes?.length) throw new Error(T.semConteudo); setConteudo(extraido); setPrevia(null); })}>{T.extrair}</button>
                        {conteudo && <div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">{conteudo.semana}</p><ol className="mt-2 list-decimal space-y-1 pl-5">{conteudo.partes.map((parte, index) => <li key={index}>{parte.titulo}</li>)}</ol></div>}
                    </>}
                    <button type="button" className={buttonClass} disabled={importar && !conteudo} onClick={() => mostrarPrevia(importar ? prepararImport : prepararManual)}><Eye size={15} />{T.prever}</button>
                    {previa && !previa.previa && <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm"><p className="flex items-center gap-2 font-bold text-blue-900"><Clock size={15} />{data} · {horario}</p><p className="text-xs text-blue-800">{T.rascunho} {previa.evento?.tipo}</p><button type="button" className={primaryClass} onClick={() => confirmar(importar ? prepararImport : prepararManual)}><Check size={15} />{T.confirmar}</button></div>}
                </div>}
                {!importar && grupo[tipo].habilitada && grupo[tipo].frequencia === 'semanal' && (!modal || aba === 'semanal') && <div className={cardClass}>
                    <h3 className="flex items-center gap-2 text-sm font-black"><CalendarRange size={17} className="text-blue-600" />{T.gerar}</h3>
                    <p className="text-xs font-semibold text-slate-500">{G[tipo]} · {getWeekdayLabel(grupo[tipo].dia, grupo.idioma)} · {grupo[tipo].horario}</p>
                    <div className="grid gap-3 sm:grid-cols-2">{campo(T.inicio, 'date', inicio, setInicio)}{campo(T.fim, 'date', fim, setFim)}</div>
                    <button type="button" className={buttonClass} onClick={() => mostrarPrevia(estado => prepararGeracaoReunioes({ ...estado, tipo, inicio, fim }))}><Eye size={15} />{T.prever}</button>
                    {previa?.previa && <div className="space-y-3 rounded-xl bg-blue-50 p-3"><ul className="space-y-2 text-xs">{previa.previa.map(item => <li key={item.data} className="flex flex-wrap gap-2"><strong>{item.data} · {item.horario}</strong><span>{T[item.status]} {item.evento?.tipo}</span></li>)}</ul>{!previa.previa.length && <p className="text-sm">{T.semDatas}</p>}<button type="button" disabled={!previa.operacoes.length} className={primaryClass} onClick={() => confirmar(estado => prepararGeracaoReunioes({ ...estado, tipo, inicio, fim }))}><Check size={15} />{T.confirmar}</button></div>}
                </div>}
            </>}
            {importar && !grupo.meioSemana.habilitada && <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">{T.desabilitada}</p>}
            {!importar && (!modal || aba === 'reunioes') && <div className="space-y-3">
                {programacoes.filter(p => !modal || (!p.arquivada && temOcorrencia(p, tipo))).map(programacao => <article key={programacao.id} className={cardClass}>
                    <h3 className="text-sm font-black">{programacao.semana}</h3>
                    {['meioSemana', 'fimDeSemana'].filter(key => temOcorrencia(programacao, key) && (!modal || key === tipo)).map(key => {
                        const ocorrencia = normalizeOcorrenciaReuniao(programacao, key, config);
                        return <div key={key} className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-bold">{G[key]} · {ocorrencia.data} · {ocorrencia.horario}</span><span className={`rounded-full px-2 py-1 font-bold ${ocorrencia.cancelada ? 'bg-rose-50 text-rose-700' : ocorrencia.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{ocorrencia.cancelada ? T.cancelada : ocorrencia.ativo ? T.ativa : T.rascunho}</span></div>
                            <p className="text-xs text-slate-500">{ocorrencia.publicada ? T.publicada : T.naoPublicada}</p>
                            {!grupo[key].habilitada && <p className="text-xs text-slate-500">{T.desabilitada}</p>}
                            {grupo.ativo && grupo[key].habilitada && !ocorrencia.cancelada && !programacao.arquivada && <div className="flex flex-wrap gap-2">
                                {!ocorrencia.ativo && <button type="button" className={primaryClass} onClick={() => confirmar(estado => prepararEstadoOcorrencia({ ...estado, programacaoId: programacao.id, tipo: key }))}><Check size={14} />{T.ativar}</button>}
                                <button type="button" className={buttonClass} onClick={() => executar(async () => { if (await dialog.confirm({ title: T.cancelar, message: T.confirmarCancelamento, confirmText: T.cancelar, cancelText: G.continuarEditando })) await onExecutar({ grupoId, preparar: estado => prepararEstadoOcorrencia({ ...estado, programacaoId: programacao.id, tipo: key, cancelar: true }) }); })}><Ban size={14} />{T.cancelar}</button>
                                {key === 'fimDeSemana' && <button type="button" className={buttonClass} onClick={() => setEdicao({ id: programacao.id, ...programacao.fimDeSemana?.reuniaoPublica })}><Pencil size={14} />{T.editar}</button>}
                            </div>}
                            {key === 'fimDeSemana' && <p className="text-xs text-slate-500">{programacao.fimDeSemana?.reuniaoPublica?.temaDiscurso} {programacao.fimDeSemana?.reuniaoPublica?.oradorNomeManual}</p>}
                        </div>;
                    })}
                </article>)}
                {!programacoes.some(p => !p.arquivada && temOcorrencia(p, tipo)) && <p className="py-8 text-center text-sm text-slate-500">{es ? 'No hay reuniones de este tipo.' : 'Nenhuma reunião deste tipo.'}</p>}
            </div>}
            {edicao && <div className={cardClass}>
                {[['temaDiscurso', T.tema], ['oradorNomeManual', T.orador], ['congregacaoOrador', T.congregacao]].map(([key, label]) => <React.Fragment key={key}>{campo(label, 'text', edicao[key] || '', value => setEdicao({ ...edicao, [key]: value }))}</React.Fragment>)}
                <div className="flex gap-2"><button type="button" className={primaryClass} onClick={() => executar(async () => { await onExecutar({ grupoId, preparar: estado => prepararEdicaoDiscurso({ ...estado, programacaoId: edicao.id, valores: edicao }) }); setEdicao(null); setMensagem(T.salvo); })}><Check size={14} />{G.salvar}</button><button type="button" onClick={() => setEdicao(null)} className={buttonClass}>{G.cancelar}</button></div>
            </div>}
        </fieldset>
    </section>;
    if (!modal) return conteudoTela;
    return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-6" onClick={event => { if (event.target === event.currentTarget) fechar(); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="agendamento-titulo" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl">
            <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-5 py-4 sm:px-6"><div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600"><CalendarDays size={22} /></div><div className="min-w-0 flex-1"><h2 id="agendamento-titulo" className="text-lg font-black text-slate-800">{T.titulo}</h2><p className="truncate text-xs font-semibold text-slate-500">{grupo.nome}</p></div><button type="button" disabled={bloqueado} onClick={fechar} aria-label={es ? 'Cerrar agendamiento' : 'Fechar agendamento'} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X size={20} /></button></header>
            <div className="overflow-y-auto p-4 sm:p-6">{conteudoTela}</div>
        </div>
    </div>;
}
