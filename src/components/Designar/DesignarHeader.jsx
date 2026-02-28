import React from 'react';
import { Archive, RotateCcw, Trash2, Briefcase, Tent, UsersRound } from 'lucide-react';

const DesignarHeader = ({
    TT, lang, config,
    filtroSemanas, mudarFiltro,
    totalSelecionadas,
    arquivarSelecionadas, restaurarSelecionadas, apagarArquivadas,
    selecionarTodasVisiveis, limparSelecaoVisiveis,
    listaFiltradaPorFlag, getSemanaKey,
    semanasSelecionadas, setSemanasSelecionadas,
    semanaAtivaIndex, setSemanaAtivaIndex,
    userClearedWeeksRef
}) => {

    // Função auxiliar super robusta para extrair a data correta de qualquer semana
    const getTimestamp = (sem) => {
        if (!sem) return 0;

        // 1. Busca a data em qualquer um dos campos mapeados do banco
        const dataStr = sem.dataInicio || sem.dataReuniao || sem.data;

        if (dataStr) {
            // Se a data estiver no formato YYYY-MM-DD (Padrão do seu banco)
            if (dataStr.includes('-')) {
                const [ano, mes, dia] = dataStr.split('-');
                // Mês no Javascript começa em 0 (Janeiro = 0, Março = 2)
                return new Date(ano, mes - 1, dia, 12, 0, 0).getTime();
            }

            // Se a data estiver no formato DD/MM/YYYY
            if (dataStr.includes('/')) {
                const [dia, mes, ano] = dataStr.split('/');
                return new Date(ano, mes - 1, dia, 12, 0, 0).getTime();
            }
        }

        // 2. Fallback: Se por algum motivo a semana não tiver data exata, tenta ler a string "23-29 de março"
        if (sem.semana) {
            const str = sem.semana.toLowerCase();

            const meses = [
                'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
                'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
            ];

            let mesIndex = 0;
            for (let i = 0; i < meses.length; i++) {
                if (str.includes(meses[i])) {
                    mesIndex = i % 12;
                    break;
                }
            }

            const matchDia = str.match(/^(\d+)/);
            const dia = matchDia ? parseInt(matchDia[1], 10) : 1;

            const matchAno = str.match(/(20\d{2})/);
            const ano = matchAno ? parseInt(matchAno[1], 10) : new Date().getFullYear();

            return new Date(ano, mesIndex, dia, 12, 0, 0).getTime();
        }

        return 0;
    };

    // Mapeamos para preservar o índice original (idx) antes de ordenar
    const semanasOrdenadas = listaFiltradaPorFlag
        .map((sem, idx) => ({ sem, originalIndex: idx }))
        .sort((a, b) => getTimestamp(a.sem) - getTimestamp(b.sem));

    return (
        <div className="w-full sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200 transition-all">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col gap-3">

                {/* LINHA 1: FILTROS E AÇÕES DE ARQUIVO */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex border rounded-full overflow-hidden shrink-0 shadow-sm">
                        <button type="button" onClick={() => mudarFiltro('ativas')} className={`px-3 py-1.5 text-xs font-bold transition-colors ${filtroSemanas === 'ativas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{TT.filtroAtivas}</button>
                        <button type="button" onClick={() => mudarFiltro('arquivadas')} className={`px-3 py-1.5 text-xs font-bold border-l transition-colors ${filtroSemanas === 'arquivadas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{TT.filtroArquivadas}</button>
                        <button type="button" onClick={() => mudarFiltro('todas')} className={`px-3 py-1.5 text-xs font-bold border-l transition-colors ${filtroSemanas === 'todas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{TT.filtroTodas}</button>
                    </div>

                    <button type="button" onClick={arquivarSelecionadas} disabled={totalSelecionadas === 0} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition inline-flex items-center gap-1 shadow-sm ${totalSelecionadas === 0 ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'}`} title={TT.arquivar}>
                        <Archive size={14} /> {TT.arquivar}
                    </button>

                    <button type="button" onClick={restaurarSelecionadas} disabled={totalSelecionadas === 0} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition inline-flex items-center gap-1 shadow-sm ${totalSelecionadas === 0 ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}`} title={TT.restaurar}>
                        <RotateCcw size={14} /> {TT.restaurar}
                    </button>

                    <button type="button" onClick={apagarArquivadas} className="px-3 py-1.5 rounded-full text-xs font-bold border bg-red-50 text-red-700 hover:bg-red-100 border-red-200 transition shadow-sm inline-flex items-center gap-1" title={TT.apagarArquivadas}>
                        <Trash2 size={14} /> {TT.apagarArquivadas}
                    </button>
                </div>

                {/* LINHA 2: CAIXA DE SEMANAS */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                        <div className="text-[10px] font-black uppercase text-gray-400">
                            {totalSelecionadas} {lang === 'es' ? 'semana(s) seleccionada(s)' : 'semana(s) selecionada(s)'}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button type="button" onClick={selecionarTodasVisiveis} className="px-3 py-1 rounded-full text-xs font-bold border bg-gray-100 hover:bg-gray-200 transition text-gray-700">
                                {lang === 'es' ? 'Todas' : 'Todas'}
                            </button>
                            <button type="button" onClick={limparSelecaoVisiveis} className="px-3 py-1 rounded-full text-xs font-bold border bg-white hover:bg-gray-100 transition text-gray-700">
                                {lang === 'es' ? 'Limpiar' : 'Limpar'}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {semanasOrdenadas.map(({ sem, originalIndex: idx }) => {
                            const k = getSemanaKey(sem, idx);
                            const on = !!semanasSelecionadas?.[k];
                            const foco = idx === semanaAtivaIndex;
                            const isArq = !!sem?.arquivada;

                            const eventoConfig = config?.eventosAnuais?.find(e => e.dataInicio === sem.dataInicio);
                            const tipoEvento = eventoConfig?.tipo || sem.evento || 'normal';
                            const isVisita = tipoEvento === 'visita';
                            const isAssembly = tipoEvento.includes('assembleia') || tipoEvento.includes('congresso');

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
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap inline-flex items-center gap-1.5 shadow-sm ${on ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'} ${foco ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`}
                                    title={sem?.semana}
                                >
                                    <span className="truncate max-w-[80px] sm:max-w-[120px]">{sem?.semana?.split(' -')[0]}</span>
                                    {isVisita && <Briefcase size={12} className={on ? "text-white" : "text-blue-600"} />}
                                    {isAssembly && <Tent size={12} className={on ? "text-white" : "text-yellow-600"} />}
                                    {isArq && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${on ? "bg-black/20 text-white" : "bg-gray-100 text-gray-600"}`}>{TT.arquivada}</span>}
                                </button>
                            );
                        })}
                        {listaFiltradaPorFlag.length === 0 && (
                            <div className="text-xs text-gray-400 italic py-1">
                                {lang === 'es' ? 'Ninguna semana para este filtro.' : 'Nenhuma semana para este filtro.'}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DesignarHeader;