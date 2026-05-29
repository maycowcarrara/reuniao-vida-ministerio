import React from 'react';
import { getSemanaSortTimestamp } from '../../utils/revisarEnviar/dates';

const NavegadorSemanas = ({
    listaSemanas,
    semanasSelecionadas,
    semanaAtivaIndex,
    setSemanaAtivaIndex,
    getSemanaKey,
    stickyOffset = 176,
    TT,
    lang = 'pt' // Adicionado lang como prop (ou fallback)
}) => {
    if (!listaSemanas || listaSemanas.length === 0) return null;

    const normalizeStr = (value) => (value || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hasPessoaDesignada = (value) => !!(value?.id || value?.nome);
    const isPrayerPart = (parte) => {
        const tipo = normalizeStr(parte?.tipo ?? parte?.type ?? '');
        const titulo = normalizeStr(parte?.titulo ?? '');
        return tipo.includes('oracao') || titulo.includes('oracao');
    };
    const isBibleStudyPart = (parte) => {
        const tipo = normalizeStr(parte?.tipo ?? parte?.type ?? '');
        const titulo = normalizeStr(parte?.titulo ?? '');
        return tipo.includes('estudo') || titulo.includes('estudo biblico') || titulo.includes('estudio biblico');
    };
    const isSongOnlyPart = (parte) => normalizeStr(parte?.tipo ?? parte?.type ?? '') === 'cantico';
    const getSemanaProgress = (sem) => {
        const totals = { total: 0, preenchidas: 0 };
        const addRequiredSlot = (value) => {
            totals.total += 1;
            if (hasPessoaDesignada(value)) totals.preenchidas += 1;
        };

        addRequiredSlot(sem?.presidente);

        (Array.isArray(sem?.partes) ? sem.partes : []).forEach((parte) => {
            if (isSongOnlyPart(parte)) return;

            if (isPrayerPart(parte)) {
                addRequiredSlot(parte?.oracao || parte?.estudante);
                return;
            }

            if (isBibleStudyPart(parte)) {
                addRequiredSlot(parte?.dirigente || parte?.estudante);
                addRequiredSlot(parte?.leitor || sem?.leitor);
                return;
            }

            addRequiredSlot(parte?.estudante);
        });

        const percentual = totals.total > 0
            ? Math.round((totals.preenchidas / totals.total) * 100)
            : 0;

        return { ...totals, percentual };
    };

    // Adicionado os textos necessários para as alterações
    const localTx = {
        pt: {
            resumo: "Resumo",
            tesouros: "Tesouros",
            oracaoInicial: "Oração Inicial",
            oracaoFinal: "Oração Final",
            concluido: "concluído",
            preenchidas: "preenchidas"
        },
        es: {
            resumo: "Resumen",
            tesouros: "Tesoros",
            oracaoInicial: "Oración Inicial",
            oracaoFinal: "Oración Final",
            concluido: "completado",
            preenchidas: "completadas"
        }
    }[lang] || { 
        resumo: "Resumo", 
        tesouros: "Tesouros", 
        oracaoInicial: "Oração Inicial", 
        oracaoFinal: "Oração Final",
        concluido: "concluído",
        preenchidas: "preenchidas"
    };

    // Mapeamos para preservar o índice original (idx) antes de ordenar
    const semanasOrdenadas = listaSemanas
        .map((sem, idx) => ({ sem, originalIndex: idx }))
        .sort((a, b) => getSemanaSortTimestamp(a.sem) - getSemanaSortTimestamp(b.sem));

    return (
        <div
            className="hidden xl:flex flex-col w-64 shrink-0 xl:sticky self-start overflow-y-auto bg-white rounded-xl shadow-sm border border-gray-200 custom-scroll z-30"
            style={{ top: `${stickyOffset}px`, maxHeight: `calc(100vh - ${stickyOffset + 16}px)` }}
        >
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
                    const progresso = getSemanaProgress(sem);
                    const progressFillClass = progresso.percentual >= 100
                        ? 'bg-emerald-200/80'
                        : 'bg-blue-200/80';
                    const progressBarClass = progresso.percentual >= 100
                        ? 'bg-emerald-500'
                        : 'bg-blue-500';

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
                            className={`relative overflow-hidden text-left p-3 rounded-lg border transition-all ${isActive ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-100 hover:border-blue-100 hover:bg-gray-50'
                                }`}
                        >
                            <div
                                className={`absolute inset-y-0 left-0 rounded-r-2xl transition-all duration-500 ${progressFillClass}`}
                                style={{ width: `${progresso.percentual}%` }}
                                aria-hidden="true"
                            />

                            <div className="relative z-10">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="font-bold text-sm text-gray-800 truncate" title={sem.semana}>
                                        {sem.semana || `${TT.semana} ${idx + 1}`}
                                    </div>
                                    <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-gray-700 border border-white/80">
                                        {progresso.percentual}%
                                    </span>
                                </div>

                                <div className="mb-2">
                                    <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-gray-600">
                                        <span>{progresso.preenchidas}/{progresso.total} {localTx.preenchidas}</span>
                                        <span className="font-semibold">{localTx.concluido}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/80 border border-white/70">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${progressBarClass}`}
                                            style={{ width: `${progresso.percentual}%` }}
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="text-xs text-gray-500 space-y-1.5 leading-tight">
                                    <div className="truncate text-[11px]">
                                        <span className="font-semibold text-gray-700">{TT.presidente}:</span> <span className="text-gray-600">{sem.presidente?.nome || '--'}</span>
                                    </div>
                                    <div className="border-t border-gray-100/80 pt-1.5 flex flex-col gap-1">
                                        {/* Mapeando recebendo (p, i, arr) para saber a posição (início vs fim) */}
                                        {sem.partes?.filter(p => p.estudante || p.dirigente || p.leitor || p.oracao).map((p, i, arr) => {
                                            const nome = p.estudante?.nome || p.dirigente?.nome || p.leitor?.nome || p.oracao?.nome;
                                            
                                            const tituloOriginal = p.titulo || '';
                                            const tituloLower = tituloOriginal.toLowerCase();
                                            let tituloCurto = '';

                                            // REGRA 1: Cântico no Início vira "Oração Inicial"
                                            if (i === 0 && (tituloLower.includes('cântico') || tituloLower.includes('cantico'))) {
                                                tituloCurto = localTx.oracaoInicial;
                                            } 
                                            // REGRA 2: Comentários no final vira "Oração Final"
                                            else if (i === arr.length - 1 && (tituloLower.includes('comentários') || tituloLower.includes('comentarios'))) {
                                                tituloCurto = localTx.oracaoFinal;
                                            } 
                                            // REGRA 3: Se começar com "1.", substitui pelo texto "1. Tesouros"
                                            else if (tituloOriginal.trim().startsWith('1.')) {
                                                tituloCurto = `1. ${localTx.tesouros}`;
                                            } 
                                            // REGRA 4: Padrão (Extrai o número se houver + primeira palavra)
                                            else {
                                                const match = tituloOriginal.match(/^(\d+\.)\s*([^\s]+)/);
                                                tituloCurto = match ? `${match[1]} ${match[2]}` : tituloOriginal.split(' ')[0];
                                            }

                                            return (
                                                <div key={p.id} className="truncate text-[10px]" title={tituloOriginal}>
                                                    <span className="font-medium text-gray-600">{tituloCurto}</span>: {nome}
                                                </div>
                                            )
                                        })}
                                    </div>
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
