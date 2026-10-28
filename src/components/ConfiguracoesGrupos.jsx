import React, { useEffect, useRef, useState } from 'react';
import { Building2, CalendarDays, Clock, Save, RotateCcw, Layers, Tag, Loader2 } from 'lucide-react';
import Configuracoes from './Configuracoes.jsx';
import UserAccessManager from './UserAccessManager.jsx';
import { patchConfiguracoesGrupos } from '../utils/programacoesPorGrupo.js';
import { useSectionMessages } from '../i18n';
import { getWeekdayOptions } from '../config/appConfig.js';
import { projetarConfigGrupo } from '../utils/grupoAtivo.js';
import { useProtecaoTrocaGrupo } from '../hooks/useProtecaoTrocaGrupo.js';
import { dialog } from '../utils/dialog.js';
import { toast } from '../utils/toast.js';

export default function ConfiguracoesGrupos({ config, grupoId, onSalvar, busy = false, lang, mostrarAcessos = false, onRepublicar, onDesignar }) {
    const T = useSectionMessages('gruposProgramacao');
    const andamento = useSectionMessages('andamento');
    const [erroPublicacao, setErroPublicacao] = useState('');
    const [drafts, setDrafts] = useState(() => config.grupos);
    const [original, setOriginal] = useState(config);
    const pendente = useRef(false);
    const [processando, setProcessando] = useState(false);
    const bloqueado = busy || processando;
    const [erro, setErro] = useState('');
    const [principal, setPrincipal] = useState(config.grupoPrincipalId);
    const [initial, setInitial] = useState(() => JSON.stringify([config.grupos, config.grupoPrincipalId]));
    const dirty = JSON.stringify([drafts, principal]) !== initial;
    useEffect(() => {
        if (!dirty) return;
        const proteger = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', proteger);
        return () => window.removeEventListener('beforeunload', proteger);
    }, [dirty]);
    const descartar = () => {
        setDrafts(config.grupos); setOriginal(config); setErro('');
        setPrincipal(config.grupoPrincipalId); setInitial(JSON.stringify([config.grupos, config.grupoPrincipalId]));
    };
    useProtecaoTrocaGrupo(async () => {
        if (pendente.current) return false;
        if (!dirty) return true;
        if (!await dialog.confirm({ title: T.sairTitulo, message: T.sairMensagem, confirmText: T.sairConfirmar, cancelText: T.continuarEditando })) return false;
        descartar(); return true;
    });
    const update = (id, field, value) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    const updateTipo = (id, tipo, field, value) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [tipo]: { ...prev[id][tipo], [field]: value } } }));
    const salvar = async event => {
        event.preventDefault();
        if (pendente.current || busy) return;
        pendente.current = true; setProcessando(true); setErro('');
        let validacao = true;
        try {
            const pedido = { alteracoesPorGrupo: drafts, grupoPrincipalId: principal, configOriginal: original };
            const validado = patchConfiguracoesGrupos(config, pedido);
            validacao = false;
            const resultado = await onSalvar(pedido);
            setOriginal(validado);
            setInitial(JSON.stringify([drafts, principal]));
            setErroPublicacao(resultado?.erroPublicacao?.message || '');
            if (resultado?.erroPublicacao) toast.error(resultado.erroPublicacao, T.parcial);
            else toast.success(T.salvo);
        } catch (error) {
            const mensagem = T[error.message] || (validacao ? T.erroValidacao : T.erroPersistencia);
            setErro(mensagem); toast.error(mensagem);
        } finally { pendente.current = false; setProcessando(false); }
    };
    const inputClass = 'w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60';
    const labelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-500';
    const editor = <div className="space-y-5">
            <section aria-label={T.geral} className="space-y-4">
                <h3 className="text-lg font-black text-slate-800">{T.geral}</h3>
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8 space-y-3">
                    <label className="block"><span className={labelClass}><Layers size={12} className="mr-1 inline" />{T.padraoAbrir}</span><select className={inputClass} form="config-grupos" disabled={bloqueado} value={principal} onChange={e => setPrincipal(e.target.value)}>{Object.values(drafts).map(g => <option key={g.id} disabled={!g.ativo} value={g.id}>{T[g.idioma]} — {g.nome}{!g.ativo ? ` · ${T.inativo}` : ''}</option>)}</select></label>
                    <p className="text-xs leading-relaxed text-slate-500">{T.padraoEfeito}</p>
                    <p className="text-xs leading-relaxed text-slate-500">{T.seletorEfeito}</p>
                </div>
                {mostrarAcessos && <UserAccessManager lang={lang} />}
            </section>
        <form id="config-grupos" onSubmit={salvar} className="space-y-5">
        {erroPublicacao && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{T.parcial}: {erroPublicacao} {onRepublicar && <button type="button" className="mt-2 block font-bold underline" onClick={async () => { try { const resultado = await onRepublicar(); if (resultado?.erroPublicacao) throw resultado.erroPublicacao; setErroPublicacao(''); } catch (error) { setErroPublicacao(error.message); } }}>{lang === 'es' ? 'Volver a publicar' : 'Republicar quadro'}</button>}</div>}
        {erro && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
        <fieldset disabled={bloqueado} className="space-y-5">
            {Object.values(drafts).map(draft => <details key={draft.id} open className="group rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <summary className="cursor-pointer bg-slate-50 p-5 sm:px-8 marker:text-blue-600">
                    <span className="font-black text-slate-800">{T[draft.idioma]} — {draft.identificacao}</span>
                    <span className="mt-1 block text-xs text-slate-500">{draft.nome} · {draft.ativo ? T.ativo : T.inativo}</span>
                </summary>
                <div className="space-y-5 p-5 sm:p-8">
                    <p className="text-xs font-bold text-blue-700">{T.destino}: {T[draft.idioma]} · {draft.nome}</p>
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={draft.ativo} onChange={e => update(draft.id, 'ativo', e.target.checked)} className="h-4 w-4 accent-blue-600" />{T.ativo}</label>
                    <p className="text-xs leading-relaxed text-slate-500">{T.ativoEfeito}</p>
                    <label className="block"><span className={labelClass}><Building2 size={12} className="mr-1 inline" />{T.nome}</span><input required className={inputClass} value={draft.nome} onChange={e => update(draft.id, 'nome', e.target.value)} /></label>
                    <label className="block"><span className={labelClass}><Tag size={12} className="mr-1 inline" />{T.identificacao}</span><input required className={inputClass} value={draft.identificacao} onChange={e => update(draft.id, 'identificacao', e.target.value)} /></label>
                    <p className="text-xs leading-relaxed text-slate-500">{T.identificacaoEfeito}</p>
                    {!draft.meioSemana.habilitada && draft.fimDeSemana.habilitada && <div className="rounded-2xl bg-sky-50 p-4 space-y-2 text-sky-900">
                        <h4 className="font-bold text-sm">{T.somenteFimDeSemana} · {T[draft.fimDeSemana.frequencia]}</h4>
                        <p className="text-xs leading-relaxed">{T.agendarEfeito}</p>
                        {onDesignar && <button type="button" disabled={!draft.ativo} className="text-sm font-bold underline disabled:opacity-40" onClick={() => onDesignar(draft.id)}>{T.irAgendar}</button>}
                    </div>}

            {['meioSemana', 'fimDeSemana'].map(tipo => <div key={tipo} className="relative space-y-4 overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
                <div className={`absolute inset-y-0 left-0 w-1.5 ${tipo === 'meioSemana' ? 'bg-indigo-500' : 'bg-sky-500'}`} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-800"><CalendarDays size={17} className="text-indigo-500" />{T[tipo]}</h3>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={draft[tipo].habilitada} onChange={e => updateTipo(draft.id, tipo, 'habilitada', e.target.checked)} className="h-4 w-4 accent-blue-600" />{T.habilitada}</label>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">{T.reuniaoEfeito}</p>
                {draft[tipo].habilitada ? <div className="space-y-4">
                    <label className="block"><span className={labelClass}>{T.frequencia}</span><select className={inputClass} value={draft[tipo].frequencia} onChange={e => updateTipo(draft.id, tipo, 'frequencia', e.target.value)}><option value="semanal">{T.semanal}</option><option value="datas">{T.datas}</option></select></label>
                    <div className={`grid gap-4 ${draft[tipo].frequencia === 'semanal' ? 'sm:grid-cols-2' : ''}`}>
                        {draft[tipo].frequencia === 'semanal' && <label className="block"><span className={labelClass}>{T.dia}</span><select className={inputClass} value={draft[tipo].dia || ''} onChange={e => updateTipo(draft.id, tipo, 'dia', e.target.value || null)}><option value="">{T.indefinido}</option>{getWeekdayOptions(lang).map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>}
                        <label className="block"><span className={labelClass}><Clock size={12} className="mr-1 inline" />{T.horarioPadrao}</span><input type="time" className={inputClass} value={draft[tipo].horario} onChange={e => updateTipo(draft.id, tipo, 'horario', e.target.value)} /></label>
                    </div>
                </div> : <p className="text-xs leading-relaxed text-slate-500">{T.tipoDesabilitado}</p>}
            </div>)}
                </div>
            </details>)}
            <p className="text-xs text-slate-500">{T.salvarDestino}</p>
            <div className="flex flex-wrap gap-3 pt-1">
                <button type="submit" disabled={!dirty || bloqueado} aria-busy={processando} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40">{processando ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{processando ? andamento.salvarConfiguracoes : T.salvar}</button>
                <button type="button" onClick={descartar} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"><RotateCcw size={16} />{T.cancelar}</button>
            </div>
        </fieldset>
    </form></div>;
    return <Configuracoes dados={{ configuracoes: projetarConfigGrupo(config, grupoId) }} lang={lang} editorProgramacao={editor} mostrarAcessos={false} />;
}
