import React, { useEffect, useState } from 'react';
import { useSectionMessages } from '../i18n';
import { getWeekdayOptions } from '../config/appConfig.js';
import { useProtecaoTrocaGrupo } from '../hooks/useProtecaoTrocaGrupo.js';
import { dialog } from '../utils/dialog.js';
import { toast } from '../utils/toast.js';

export default function ConfiguracoesGrupos({ config, grupoId, onSalvar, busy = false, lang }) {
    const T = useSectionMessages('gruposProgramacao');
    const [draft, setDraft] = useState(() => config.grupos[grupoId]);
    const [principal, setPrincipal] = useState(config.grupoPrincipalId);
    const [initial, setInitial] = useState(() => JSON.stringify([config.grupos[grupoId], config.grupoPrincipalId]));
    const dirty = JSON.stringify([draft, principal]) !== initial;
    useEffect(() => {
        if (!dirty) return;
        const proteger = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', proteger);
        return () => window.removeEventListener('beforeunload', proteger);
    }, [dirty]);
    useProtecaoTrocaGrupo(async () => {
        if (busy) return false;
        if (!dirty) return true;
        return dialog.confirm({ title: T.sairTitulo, message: T.sairMensagem, confirmText: T.sairConfirmar, cancelText: T.continuarEditando });
    });
    const update = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));
    const updateTipo = (tipo, field, value) => setDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], [field]: value } }));
    const salvar = async event => {
        event.preventDefault();
        if (busy) return;
        try {
            await onSalvar({ grupoId, alteracoes: draft, grupoPrincipalId: principal });
            setInitial(JSON.stringify([draft, principal]));
            toast.success(T.salvo);
        } catch (error) { toast.error(error, T.erroSalvar); }
    };
    const inputClass = 'w-full min-w-0 border border-slate-300 rounded-xl px-3 py-2 mt-1 bg-white';
    return <form onSubmit={salvar} className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <h2 className="text-xl font-bold">{T.titulo} — {T[draft.idioma]}</h2>
        <fieldset disabled={busy} className="space-y-5 rounded-2xl border bg-white p-4 sm:p-6">
            <label className="block">{T.principal}<select className={inputClass} value={principal} onChange={e => setPrincipal(e.target.value)}>
                {Object.values(config.grupos).map(grupo => <option key={grupo.id} value={grupo.id}>{T[grupo.idioma]}</option>)}
            </select></label>
            <label className="block">{T.nome}<input required className={inputClass} value={draft.nome} onChange={e => update('nome', e.target.value)} /></label>
            <label className="block">{T.identificacao}<input required className={inputClass} value={draft.identificacao} onChange={e => update('identificacao', e.target.value)} /></label>
            <label className="flex gap-2"><input type="checkbox" checked={draft.ativo} onChange={e => update('ativo', e.target.checked)} />{T.ativo}</label>
            {['meioSemana', 'fimDeSemana'].map(tipo => <fieldset key={tipo} className="space-y-3 rounded-xl border p-4">
                <legend className="font-bold px-1">{T[tipo]}</legend>
                <label className="flex gap-2"><input type="checkbox" checked={draft[tipo].habilitada} onChange={e => updateTipo(tipo, 'habilitada', e.target.checked)} />{T.habilitada}</label>
                <label className="block">{T.frequencia}<select className={inputClass} value={draft[tipo].frequencia} onChange={e => updateTipo(tipo, 'frequencia', e.target.value)}>
                    <option value="semanal">{T.semanal}</option><option value="datas">{T.datas}</option>
                </select></label>
                <div className="grid sm:grid-cols-2 gap-3">
                    <label>{T.dia}<select className={inputClass} value={draft[tipo].dia || ''} onChange={e => updateTipo(tipo, 'dia', e.target.value || null)}>
                        <option value="">{T.indefinido}</option>{getWeekdayOptions(lang).map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
                    </select></label>
                    <label>{T.horario}<input type="time" className={inputClass} value={draft[tipo].horario} onChange={e => updateTipo(tipo, 'horario', e.target.value)} /></label>
                </div>
            </fieldset>)}
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={!dirty} className="px-4 py-3 rounded-xl bg-blue-700 text-white font-bold disabled:opacity-50">{T.salvar}</button>
                <button type="button" onClick={() => { setDraft(config.grupos[grupoId]); setPrincipal(config.grupoPrincipalId); setInitial(JSON.stringify([config.grupos[grupoId], config.grupoPrincipalId])); }} className="px-4 py-3 border rounded-xl">{T.cancelar}</button>
            </div>
        </fieldset>
    </form>;
}
