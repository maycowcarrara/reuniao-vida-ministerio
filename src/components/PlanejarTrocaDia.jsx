import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { getWeekdayLabel, getWeekdayOptions } from '../config/appConfig.js';
import { hojeReunioesISO, validarProximaTroca } from '../config/meetingSchedule.js';
import { useSectionMessages } from '../i18n';

export default function PlanejarTrocaDia({ padrao, onChange, lang, salvarDepois = false }) {
    const T = useSectionMessages('trocaDiasReuniao');
    const [data, setData] = useState(padrao.proximaTroca?.data || '');
    const [dia, setDia] = useState(padrao.proximaTroca?.dia || padrao.dia || 'monday');
    const [erro, setErro] = useState('');
    const [busy, setBusy] = useState(false);
    const salvar = async troca => {
        setErro('');
        try {
            if (troca && troca.data < hojeReunioesISO()) throw new Error('trocaDiaInvalida');
            validarProximaTroca({ ...padrao, proximaTroca: troca });
            setBusy(true);
            await onChange(troca);
        } catch (error) { setErro(T[error.message] || error.message); }
        finally { setBusy(false); }
    };
    const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100';
    const igual = data === (padrao.proximaTroca?.data || '') && dia === (padrao.proximaTroca?.dia || padrao.dia);
    return <fieldset disabled={busy} className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
        <legend className="px-1 text-xs font-black text-blue-900"><CalendarDays size={14} className="mr-1 inline" />{T.titulo}</legend>
        <p className="text-xs leading-relaxed text-slate-600">{T.descricao}</p>
        <p className="text-xs font-bold text-slate-700">{T.atual}: {getWeekdayLabel(padrao.dia, lang)}{padrao.proximaTroca ? ` · ${T.aPartirDe} ${padrao.proximaTroca.data.split('-').reverse().join('/')} → ${getWeekdayLabel(padrao.proximaTroca.dia, lang)}` : ''}</p>
        <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-600">{T.data}<input type="date" min={hojeReunioesISO()} value={data} onChange={e => setData(e.target.value)} className={`${inputClass} mt-1`} /></label>
            <label className="block text-xs font-bold text-slate-600">{T.novoDia}<select value={dia} onChange={e => setDia(e.target.value)} className={`${inputClass} mt-1`}>{getWeekdayOptions(lang).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        {erro && <p role="alert" className="text-xs font-bold text-red-700">{erro}</p>}
        <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!data || igual || busy} onClick={() => salvar({ data, dia })} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{T.definir}</button>
            {padrao.proximaTroca && <button type="button" onClick={() => salvar(null)} className="text-xs font-bold text-slate-600 underline">{T.cancelar}</button>}
        </div>
        {salvarDepois && <p className="text-xs text-slate-500">{T.salvarConfiguracoes}</p>}
        {!!padrao.historicoDias?.length && <p className="text-xs text-slate-500">{T.historico}</p>}
    </fieldset>;
}
