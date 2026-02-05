import React, { useMemo } from 'react';
import { Edit, Plus, Info, CheckCircle, AlertTriangle, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { TRANSLATIONS, SECAO_UI } from '../../utils/importador/constants';
import { formatHm } from '../../utils/importador/helpers';
import { calcularTotalInfo } from '../../utils/importador/parser';

export default function RevisarImportacao({ dados, setDados, onConfirm, onCancel, lang = 'pt' }) {
    const t = TRANSLATIONS[lang];

    const totalInfo = useMemo(() => calcularTotalInfo(dados?.partes || [], lang), [dados, lang]);
    const totalMin = totalInfo.totalEfetivo;
    const totalOk = totalMin >= 100 && totalMin <= 105;

    const moverParte = (index, direcao) => {
        const n = [...dados.partes];
        const target = direcao === 'cima' ? index - 1 : index + 1;
        if (target < 0 || target >= n.length) return;
        [n[index], n[target]] = [n[target], n[index]];
        setDados({ ...dados, partes: n });
    };

    const deletarParte = (id) => {
        setDados({ ...dados, partes: dados.partes.filter((p) => p.id !== id) });
    };

    const updateParte = (idx, field, value) => {
        const n = [...dados.partes];
        n[idx][field] = value;
        setDados({ ...dados, partes: n });
    };

    const uiSecaoKey = (p) => {
        const key = (p?.secao || '').trim();
        return ['tesouros', 'ministerio', 'vida'].includes(key) ? key : 'na';
    };

    const labelSecao = (secao) => {
        if (secao === 'tesouros') return t.secaoTesouros;
        if (secao === 'ministerio') return t.secaoMinisterio;
        if (secao === 'vida') return t.secaoVida;
        return t.secaoNA;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 bg-white p-6 rounded-3xl shadow-2xl border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 mb-2 pb-4 border-b">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Edit className="text-blue-600" /> {t.revisar}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">Idioma: <span className="font-bold text-blue-500 uppercase">{lang}</span></p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition">{t.cancelar}</button>
                    <button 
                        onClick={() => onConfirm(dados)} 
                        className="px-8 py-2 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition active:scale-95"
                    >
                        {t.confirmar}
                    </button>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs flex gap-2 items-start">
                <Info className="mt-0.5 shrink-0" size={16} />
                <div className="leading-snug">{t.dicaRevisao}</div>
            </div>

            {/* Totalizador */}
            <div className={`rounded-xl p-3 text-xs border flex gap-2 items-start ${totalOk ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {totalOk ? <CheckCircle className="mt-0.5 shrink-0" size={16} /> : <AlertTriangle className="mt-0.5 shrink-0" size={16} />}
                <div className="leading-snug w-full">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <div className="font-extrabold">{t.totalTempoLabel}: {formatHm(totalMin)}</div>
                        <div className="text-[11px] opacity-80">{t.totalTempoEsperado}: 1:40–1:45 (100–105 min)</div>
                    </div>
                    {!totalOk && <div className="text-[11px] mt-1">{t.totalTempoAviso}</div>}
                    <details className="mt-2">
                        <summary className="cursor-pointer select-none text-[11px] opacity-80">{t.totalTempoDetalhes}</summary>
                        <div className="mt-1 text-[11px] opacity-90 space-y-1">
                            <div>{t.totalTempoSomaPartes}: {formatHm(totalInfo.totalVisivel)}</div>
                            {totalInfo.bonusLeituraBiblia > 0 && <div>{t.totalTempoLeituraBiblia}</div>}
                            {totalInfo.ministerioCount > 0 && <div>{t.totalTempoMinisterioTpl.replace('{n}', totalInfo.bonusMinisterio)}</div>}
                        </div>
                    </details>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-inner">
                    <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">{t.tituloSemana}</label>
                    <input 
                        type="text" 
                        value={dados.semana} 
                        onChange={(e) => setDados({ ...dados, semana: e.target.value })} 
                        className="w-full bg-white/60 border border-blue-100 rounded-xl px-3 py-2 font-bold text-lg text-blue-900 outline-none focus:ring-4 focus:ring-blue-100" 
                    />
                </div>

                <div className="space-y-3">
                    {dados.partes.map((p, idx) => {
                        const ui = SECAO_UI[uiSecaoKey(p)];
                        return (
                            <div key={p.id} className={`relative border p-4 pt-8 rounded-2xl flex gap-4 items-start hover:shadow-sm transition-all border-l-4 ${ui.wrap} ${ui.left}`}>
                                <div className={`absolute left-4 top-3 text-[10px] px-2 py-0.5 border rounded-full font-extrabold tracking-wide ${ui.chip}`}>{labelSecao(p.secao)}</div>
                                
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => moverParte(idx, 'cima')} className="text-gray-300 hover:text-blue-500 p-1"><ArrowUp size={18} /></button>
                                    <button onClick={() => moverParte(idx, 'baixo')} className="text-gray-300 hover:text-blue-500 p-1"><ArrowDown size={18} /></button>
                                </div>

                                <div className="flex-1 grid grid-cols-12 gap-3 items-end">
                                    <div className="col-span-12 md:col-span-8">
                                        <label className="text-[9px] font-bold text-gray-500 uppercase">{t.rotulos.titulo}</label>
                                        <input type="text" value={p.titulo} onChange={(e) => updateParte(idx, 'titulo', e.target.value)} className={`w-full h-10 font-bold text-sm outline-none border rounded-xl px-3 py-2 bg-white/70 focus:ring-4 ${ui.focus}`} />
                                    </div>
                                    <div className="col-span-6 md:col-span-2">
                                        <label className="text-[9px] font-bold text-gray-500 uppercase text-center block leading-none mb-1">{t.rotulos.tempo}</label>
                                        <input type="text" inputMode="numeric" value={p.tempo} onChange={(e) => updateParte(idx, 'tempo', e.target.value.replace(/[^\d]/g, ''))} className={`w-full h-10 text-center font-mono text-sm border rounded-xl px-3 py-2 bg-white/70 outline-none focus:ring-4 ${ui.focus}`} />
                                    </div>
                                    <div className="col-span-6 md:col-span-2">
                                        <label className="text-[9px] font-bold text-gray-500 uppercase block leading-none mb-1">{t.rotulos.secao}</label>
                                        <select value={p.secao} onChange={(e) => updateParte(idx, 'secao', e.target.value)} className={`w-full h-10 text-[10px] font-extrabold bg-white/70 border rounded-xl px-3 py-2 outline-none focus:ring-4 ${ui.focus}`}>
                                            <option value="tesouros">{t.secaoTesouros}</option>
                                            <option value="ministerio">{t.secaoMinisterio}</option>
                                            <option value="vida">{t.secaoVida}</option>
                                            <option value="">{t.secaoNA}</option>
                                        </select>
                                    </div>
                                    <div className="col-span-12">
                                        <label className="text-[9px] font-bold text-gray-500 uppercase">{t.rotulos.detalhes}</label>
                                        <textarea value={p.descricao} onChange={(e) => updateParte(idx, 'descricao', e.target.value)} className={`w-full text-xs text-gray-700 outline-none resize-y h-14 max-h-56 border rounded-xl p-3 bg-white/70 focus:ring-4 ${ui.focus}`} placeholder={t.placeholderDetalhes} />
                                    </div>
                                </div>
                                <button onClick={() => deletarParte(p.id)} className="text-gray-300 hover:text-red-600 p-2 rounded-xl hover:bg-white/50 transition"><Trash2 size={18} /></button>
                            </div>
                        );
                    })}
                </div>
                
                <div className="flex gap-3 mt-4">
                    <button onClick={() => setDados({...dados, partes: [...dados.partes, { id: Math.random(), titulo: '', tempo: '5', tipo: 'parte', secao: 'tesouros', descricao: '' }]})} className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition inline-flex items-center justify-center gap-2"><Plus size={18} /> {t.addLinha}</button>
                    <button onClick={() => onConfirm(dados)} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-2xl font-bold shadow hover:bg-green-700 transition inline-flex items-center justify-center gap-2"><CheckCircle size={18} /> {t.confirmar}</button>
                </div>
            </div>
        </div>
    );
}