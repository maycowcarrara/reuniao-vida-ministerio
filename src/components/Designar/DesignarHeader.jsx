import React from 'react';
import { Archive, RotateCcw, Trash2, Briefcase, Tent, UsersRound } from 'lucide-react';
import { isSemanaAssembleia } from './helpers';
import { getTipoEventoSemana } from '../../utils/eventos';
import { formatText } from '../../i18n';
import { getSemanaSortTimestamp } from '../../utils/revisarEnviar/dates';

const DesignarHeader = ({
    headerRef,
    TT, config,
    filtroSemanas, mudarFiltro,
    totalSelecionadas,
    arquivarSelecionadas, restaurarSelecionadas, apagarArquivadas,
    selecionarTodasVisiveis, limparSelecaoVisiveis,
    listaFiltradaPorFlag, getSemanaKey,
    semanasSelecionadas, setSemanasSelecionadas,
    semanaAtivaIndex, setSemanaAtivaIndex,
    userClearedWeeksRef
}) => {

    // Mapeamos para preservar o índice original (idx) antes de ordenar
    const semanasOrdenadas = listaFiltradaPorFlag
        .map((sem, idx) => ({ sem, originalIndex: idx }))
        .sort((a, b) => getSemanaSortTimestamp(a.sem, config) - getSemanaSortTimestamp(b.sem, config));

    return (
        <div ref={headerRef} className="w-full sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200 transition-all">
            <div className="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 py-3 sm:py-4 flex flex-col gap-3">

                {/* LINHA 1: FILTROS E AÇÕES DE ARQUIVO */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                    <div className="grid w-full sm:w-auto grid-cols-3 border rounded-2xl sm:rounded-full overflow-hidden shadow-sm">
                        <button type="button" onClick={() => mudarFiltro('ativas')} className={`px-3 py-2 sm:py-1.5 text-xs font-bold transition-colors ${filtroSemanas === 'ativas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{TT.filtroAtivas}</button>
                        <button type="button" onClick={() => mudarFiltro('arquivadas')} className={`px-3 py-2 sm:py-1.5 text-xs font-bold border-l transition-colors ${filtroSemanas === 'arquivadas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{TT.filtroArquivadas}</button>
                        <button type="button" onClick={() => mudarFiltro('todas')} className={`px-3 py-2 sm:py-1.5 text-xs font-bold border-l transition-colors ${filtroSemanas === 'todas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{TT.filtroTodas}</button>
                    </div>

                    <button type="button" onClick={arquivarSelecionadas} disabled={totalSelecionadas === 0} className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-full text-xs font-bold border transition inline-flex items-center justify-center gap-1 shadow-sm ${totalSelecionadas === 0 ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'}`} title={TT.arquivar}>
                        <Archive size={14} /> {TT.arquivar}
                    </button>

                    <button type="button" onClick={restaurarSelecionadas} disabled={totalSelecionadas === 0} className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-full text-xs font-bold border transition inline-flex items-center justify-center gap-1 shadow-sm ${totalSelecionadas === 0 ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}`} title={TT.restaurar}>
                        <RotateCcw size={14} /> {TT.restaurar}
                    </button>

                    <button type="button" onClick={apagarArquivadas} className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-full text-xs font-bold border bg-red-50 text-red-700 hover:bg-red-100 border-red-200 transition shadow-sm inline-flex items-center justify-center gap-1" title={TT.apagarArquivadas}>
                        <Trash2 size={14} /> {TT.apagarArquivadas}
                    </button>
                </div>

                {/* LINHA 2: CAIXA DE SEMANAS */}
                    <div className="bg-white rounded-xl border border-gray-200 p-2.5 sm:p-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                        <div className="text-[10px] font-black uppercase text-gray-400">
                            {formatText(TT.semanasSelecionadasTpl, { count: totalSelecionadas })}
                        </div>
                        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 w-full sm:w-auto">
                            <button type="button" onClick={selecionarTodasVisiveis} className="px-3 py-1.5 sm:py-1 rounded-xl sm:rounded-full text-xs font-bold border bg-gray-100 hover:bg-gray-200 transition text-gray-700">
                                {TT.selecionarTodas}
                            </button>
                            <button type="button" onClick={limparSelecaoVisiveis} className="px-3 py-1.5 sm:py-1 rounded-xl sm:rounded-full text-xs font-bold border bg-white hover:bg-gray-100 transition text-gray-700">
                                {TT.limparSelecao}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                        {semanasOrdenadas.map(({ sem, originalIndex: idx }) => {
                            const k = getSemanaKey(sem, idx);
                            const on = !!semanasSelecionadas?.[k];
                            const foco = idx === semanaAtivaIndex;
                            const isArq = !!sem?.arquivada;

                            const tipoEvento = getTipoEventoSemana(sem, config);
                            const isVisita = tipoEvento === 'visita';
                            const isAssembly = isSemanaAssembleia(sem, config);

                            return (
                                <button
                                    key={k} type="button"
                                    onClick={() => {
                                        userClearedWeeksRef.current = false;
                                        setSemanasSelecionadas(prev => ({ ...(prev || {}), [k]: !prev?.[k] }));
                                        setSemanaAtivaIndex(idx);
                                        setTimeout(() => {
                                            const el = document.getElementById(`semana-${k}`);
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 50);
                                    }}
                                    className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-full text-xs font-bold border transition-all inline-flex items-center justify-between sm:justify-start gap-1.5 shadow-sm min-w-0 ${on ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'} ${foco ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`}
                                    title={sem?.semana}
                                >
                                    <span className="min-w-0 flex-1 truncate sm:flex-none sm:max-w-[120px]">{sem?.semana?.split(' -')[0]}</span>
                                    {isVisita && <Briefcase size={12} className={on ? "text-white" : "text-blue-600"} />}
                                    {isAssembly && <Tent size={12} className={on ? "text-white" : "text-yellow-600"} />}
                                    {isArq && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${on ? "bg-black/20 text-white" : "bg-gray-100 text-gray-600"}`}>{TT.arquivada}</span>}
                                </button>
                            );
                        })}
                        {listaFiltradaPorFlag.length === 0 && (
                            <div className="text-xs text-gray-400 italic py-1">
                                {TT.nenhumaSemanaFiltro}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DesignarHeader;
