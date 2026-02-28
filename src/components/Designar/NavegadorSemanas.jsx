import React from 'react';

const NavegadorSemanas = ({
    listaSemanas,
    semanasSelecionadas,
    semanaAtivaIndex,
    setSemanaAtivaIndex,
    getSemanaKey,
    TT,
    lang = 'pt' // Adicionado lang como prop (ou fallback)
}) => {
    if (!listaSemanas || listaSemanas.length === 0) return null;

    // Fallback de textos locais para o que não estava mapeado no TT
    const localTx = {
        pt: {
            resumo: "Resumo"
        },
        es: {
            resumo: "Resumen"
        }
    }[lang] || { resumo: "Resumo" };

    // Função auxiliar super robusta para extrair a data correta de qualquer semana
    const getTimestamp = (sem) => {
        if (!sem) return 0;

        const dataStr = sem.dataInicio || sem.dataReuniao || sem.data;

        if (dataStr) {
            if (dataStr.includes('-')) {
                const [ano, mes, dia] = dataStr.split('-');
                return new Date(ano, mes - 1, dia, 12, 0, 0).getTime();
            }
            if (dataStr.includes('/')) {
                const [dia, mes, ano] = dataStr.split('/');
                return new Date(ano, mes - 1, dia, 12, 0, 0).getTime();
            }
        }

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
    const semanasOrdenadas = listaSemanas
        .map((sem, idx) => ({ sem, originalIndex: idx }))
        .sort((a, b) => getTimestamp(a.sem) - getTimestamp(b.sem));

    return (
        <div className="hidden xl:flex flex-col w-64 shrink-0 lg:sticky lg:top-45 self-start max-h-[calc(100vh-11rem)] overflow-y-auto bg-white rounded-xl shadow-sm border border-gray-200 custom-scroll z-30">
            <div className="p-4 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between">
                <h3 className="font-bold text-xs text-gray-700 uppercase tracking-widest">
                    {localTx.resumo}
                </h3>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {listaSemanas.filter((_, i) => semanasSelecionadas[getSemanaKey(_, i)]).length} {TT.filtroAtivas}
                </span>
            </div>

            <div className="p-2 flex flex-col gap-2">
                {semanasOrdenadas.map(({ sem, originalIndex: idx }) => {
                    const key = getSemanaKey(sem, idx);
                    const isSelected = semanasSelecionadas[key];
                    if (!isSelected) return null;

                    const isActive = idx === semanaAtivaIndex;

                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => {
                                setSemanaAtivaIndex(idx);
                                // Solução infalível para rolar até a semana
                                setTimeout(() => {
                                    const el = document.getElementById(`semana-${key}`);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 50);
                            }}
                            className={`text-left p-3 rounded-lg border transition-all ${isActive ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-100 hover:border-blue-100 hover:bg-gray-50'
                                }`}
                        >
                            <div className="font-bold text-sm text-gray-800 mb-2 truncate" title={sem.semana}>
                                {sem.semana || `${TT.semana} ${idx + 1}`}
                            </div>
                            <div className="text-xs text-gray-500 space-y-1.5 leading-tight">
                                <div className="truncate text-[11px]">
                                    <span className="font-semibold text-gray-700">{TT.presidente}:</span> <span className="text-gray-600">{sem.presidente?.nome || '--'}</span>
                                </div>
                                <div className="border-t border-gray-100 pt-1.5 flex flex-col gap-1">
                                    {sem.partes?.filter(p => p.estudante || p.dirigente || p.leitor || p.oracao).map(p => {
                                        const nome = p.estudante?.nome || p.dirigente?.nome || p.leitor?.nome || p.oracao?.nome;

                                        // Regex atualizado para extrair o número (se houver) e a primeira palavra subsequente
                                        const match = p.titulo.match(/^(\d+\.)\s*([^\s]+)/);
                                        const tituloCurto = match ? `${match[1]} ${match[2]}` : p.titulo.split(' ')[0];

                                        return (
                                            <div key={p.id} className="truncate text-[10px]" title={p.titulo}>
                                                <span className="font-medium text-gray-600">{tituloCurto}</span>: {nome}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default NavegadorSemanas;