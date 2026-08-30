import React from 'react';
import { getSemanaSortTimestamp } from '../../utils/revisarEnviar/dates';
import { isBibleStudyPart, isPrayerPart, isSongOnlyPart } from '../../utils/meetingParts';
import { getTipoEventoSemana } from '../../utils/eventos';
import {
    FIM_DE_SEMANA_RESPONSABILIDADES,
    MEIO_SEMANA_RESPONSABILIDADES,
    normalizeFimDeSemana,
    normalizeResponsabilidades
} from '../../utils/fimDeSemana';

const NavegadorSemanas = ({
    listaSemanas,
    semanasSelecionadas,
    semanaAtivaIndex,
    setSemanaAtivaIndex,
    getSemanaKey,
    stickyOffset = 176,
    TT,
    config = {},
    lang = 'pt' // Adicionado lang como prop (ou fallback)
}) => {
    if (!listaSemanas || listaSemanas.length === 0) return null;

    const hasPessoaDesignada = (value) => !!(value?.id || value?.nome);
    const hasTextValue = (value) => !!String(value || '').trim();

    const getSemanaProgress = (sem) => {
        const totals = { total: 0, preenchidas: 0 };
        const addRequiredSlot = (value) => {
            totals.total += 1;
            if (hasPessoaDesignada(value)) totals.preenchidas += 1;
        };
        const addRequiredText = (value) => {
            totals.total += 1;
            if (hasTextValue(value)) totals.preenchidas += 1;
        };
        const addRequiredResponsabilidade = (responsabilidades, storageKey) => {
            totals.total += 1;
            if ((responsabilidades[storageKey] || []).some(hasPessoaDesignada)) totals.preenchidas += 1;
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

        const responsabilidadesMeioSemana = normalizeResponsabilidades(sem?.responsabilidades, MEIO_SEMANA_RESPONSABILIDADES);
        MEIO_SEMANA_RESPONSABILIDADES.forEach(({ storageKey }) => {
            addRequiredResponsabilidade(responsabilidadesMeioSemana, storageKey);
        });

        const fds = normalizeFimDeSemana(sem?.fimDeSemana);
        if (fds.ativo) {
            const isVisita = getTipoEventoSemana(sem, config) === 'visita';
            addRequiredSlot(fds.presidente);
            addRequiredText(fds.reuniaoPublica.temaDiscurso);
            addRequiredText(fds.reuniaoPublica.oradorNomeManual);
            addRequiredText(fds.reuniaoPublica.congregacaoOrador);
            addRequiredSlot(fds.estudoSentinela.leitor);
            if (isVisita) addRequiredText(fds.visitaSuperintendente.discursoFinal);

            FIM_DE_SEMANA_RESPONSABILIDADES.forEach(({ storageKey }) => {
                addRequiredResponsabilidade(fds.responsabilidades, storageKey);
            });
        }

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
            apoioMeioSemana: "Apoio do meio de semana",
            fimDeSemana: "Fim de semana",
            discursoPublico: "Discurso público",
            discursoFinalVisita: "Disc. visita",
            orador: "Orador",
            congregacao: "Congregação",
            sentinela: "Sentinela",
            dirigente: "Dirigente",
            leitor: "Leitor"
        },
        es: {
            resumo: "Resumen",
            tesouros: "Tesoros",
            oracaoInicial: "Oración Inicial",
            oracaoFinal: "Oración Final",
            apoioMeioSemana: "Apoyo de entre semana",
            fimDeSemana: "Fin de semana",
            discursoPublico: "Discurso público",
            discursoFinalVisita: "Disc. visita",
            orador: "Orador",
            congregacao: "Congregación",
            sentinela: "Atalaya",
            dirigente: "Conductor",
            leitor: "Lector"
        }
    }[lang] || { 
        resumo: "Resumo", 
        tesouros: "Tesouros", 
        oracaoInicial: "Oração Inicial", 
        oracaoFinal: "Oração Final",
        apoioMeioSemana: "Apoio do meio de semana",
        fimDeSemana: "Fim de semana",
        discursoPublico: "Discurso público",
        discursoFinalVisita: "Disc. visita",
        orador: "Orador",
        congregacao: "Congregação",
        sentinela: "Sentinela",
        dirigente: "Dirigente",
        leitor: "Leitor"
    };

    const responsabilidadeResumoLabels = {
        pt: {
            videoZoomSom: 'Áudio/vídeo',
            indicadoresEntrada: 'Ind. entrada',
            indicadoresAuditorio: 'Ind. auditório',
            microfonesVolantes: 'Microfones',
        },
        es: {
            videoZoomSom: 'Audio/video',
            indicadoresEntrada: 'Acom. entrada',
            indicadoresAuditorio: 'Acom. auditorio',
            microfonesVolantes: 'Micrófonos',
        },
    }[lang] || {
        videoZoomSom: 'Áudio/vídeo',
        indicadoresEntrada: 'Ind. entrada',
        indicadoresAuditorio: 'Ind. auditório',
        microfonesVolantes: 'Microfones',
    };

    const getPessoaNome = (pessoa) => pessoa?.nome || '--';
    const getTextoResumo = (value) => String(value || '').trim() || '--';
    const getResponsabilidadeLabel = ({ storageKey, labels }) =>
        responsabilidadeResumoLabels[storageKey] || TT?.[storageKey] || labels?.[lang] || labels?.pt || storageKey;
    const getResponsabilidadeNomes = (responsabilidades, storageKey) => {
        const nomes = (responsabilidades?.[storageKey] || [])
            .map((pessoa) => pessoa?.nome)
            .filter(Boolean);
        return nomes.length ? nomes.join(', ') : '--';
    };
    const buildResponsabilidadesResumo = (responsabilidades, defs) => defs.map((def) => ({
        key: def.storageKey,
        label: getResponsabilidadeLabel(def),
        value: getResponsabilidadeNomes(responsabilidades, def.storageKey),
    }));
    const renderResumoLinha = ({ key, label, value }) => (
        <div
            key={key}
            className="grid grid-cols-[82px_minmax(0,1fr)] gap-1 text-[10px] leading-tight"
            title={`${label}: ${value}`}
        >
            <span className="font-semibold text-gray-600 truncate">{label}:</span>
            <span className={`${value === '--' ? 'text-gray-400' : 'text-gray-700'} min-w-0 break-words`}>
                {value}
            </span>
        </div>
    );

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
                        ? 'bg-emerald-200/90'
                        : 'bg-blue-200/90';
                    const cardBaseClass = progresso.percentual >= 100
                        ? 'bg-emerald-50'
                        : 'bg-blue-50';
                    const fds = normalizeFimDeSemana(sem?.fimDeSemana);
                    const isVisita = getTipoEventoSemana(sem, config) === 'visita';
                    const responsabilidadesMeioSemana = normalizeResponsabilidades(sem?.responsabilidades, MEIO_SEMANA_RESPONSABILIDADES);
                    const apoioResumo = buildResponsabilidadesResumo(responsabilidadesMeioSemana, MEIO_SEMANA_RESPONSABILIDADES);
                    const fdsCamposResumo = fds.ativo ? [
                        { key: 'presidente_fds', label: TT.presidente, value: getPessoaNome(fds.presidente) },
                        { key: 'oracao_fds', label: localTx.oracaoFinal, value: getPessoaNome(fds.oracaoFinal) },
                        { key: 'tema_discurso', label: localTx.discursoPublico, value: getTextoResumo(fds.reuniaoPublica.temaDiscurso) },
                        { key: 'orador_manual', label: localTx.orador, value: getTextoResumo(fds.reuniaoPublica.oradorNomeManual) },
                        { key: 'congregacao_orador', label: localTx.congregacao, value: getTextoResumo(fds.reuniaoPublica.congregacaoOrador) },
                        { key: 'dirigente_sentinela', label: localTx.dirigente, value: getPessoaNome(fds.estudoSentinela.dirigente) },
                        { key: 'leitor_sentinela', label: localTx.leitor, value: getPessoaNome(fds.estudoSentinela.leitor) },
                        ...(isVisita ? [{ key: 'discurso_final_visita', label: localTx.discursoFinalVisita, value: getTextoResumo(fds.visitaSuperintendente.discursoFinal) }] : []),
                        ...buildResponsabilidadesResumo(fds.responsabilidades, FIM_DE_SEMANA_RESPONSABILIDADES),
                    ] : [];

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
                            className={`relative overflow-hidden text-left p-3 rounded-lg border transition-all ${isActive ? 'border-blue-300 ring-1 ring-blue-300' : 'border-gray-100 hover:border-blue-100'
                                }`}
                        >
                            <div className={`absolute inset-0 ${cardBaseClass}`} aria-hidden="true" />
                            <div
                                className={`absolute inset-y-0 left-0 rounded-r-lg transition-all duration-500 ${progressFillClass}`}
                                style={{ width: `${progresso.percentual}%` }}
                                aria-hidden="true"
                            />

                            <div className="relative z-10">
                                <div className="mb-2">
                                    <div className="font-bold text-sm text-gray-800 truncate" title={sem.semana}>
                                        {sem.semana || `${TT.semana} ${idx + 1}`}
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
                                        <div className="border-t border-gray-100/80 pt-1.5 mt-0.5">
                                            <div className="text-[10px] font-black uppercase text-indigo-700 truncate">
                                                {localTx.apoioMeioSemana}
                                            </div>
                                            <div className="mt-1 space-y-0.5">
                                                {apoioResumo.map(renderResumoLinha)}
                                            </div>
                                        </div>
                                        {fds.ativo && (
                                            <div className="border-t border-gray-100/80 pt-1.5 mt-0.5">
                                                <div className="text-[10px] font-black uppercase text-sky-700 truncate">
                                                    {localTx.fimDeSemana}
                                                </div>
                                                <div className="mt-1 space-y-0.5">
                                                    {fdsCamposResumo.map(renderResumoLinha)}
                                                </div>
                                            </div>
                                        )}
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
