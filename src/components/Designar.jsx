import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    Calendar, User, Search, UsersRound, UserRound, Clock,
    AlertTriangle, StickyNote, Trash2, Edit2, X, Save, UserPlus,
    Archive, RotateCcw, Lightbulb, Briefcase, Tent, FilterX, SortAsc, SortDesc
} from 'lucide-react';

import ModalSugestao from './ModalSugestao';
import NavegadorSemanas from './Designar/NavegadorSemanas';
import SidebarAlunos from './Designar/SidebarAlunos';
import {
    SECOES_ORDEM, SECOES_META, normalizar, normalizarSecao,
    tipoLower, isAbertura, isEncerramento, isLinhaInicialFinal,
    isEstudoBiblicoCongregacao, isCanticoIntermediario
} from './Designar/helpers';

const T_FALLBACK = {
    pt: {
        semana: "Semana", presidente: "Presidente", dirigente: "Dirigente", leitor: "Leitor",
        estudante: "Estudante", ajudante: "Ajudante", oracao: "Oração", cliquePara: "Clique para designar",
        selecioneCampo: "Selecione um campo", designado: "Designando", alunos: "Alunos",
        registros: "registros", editarParte: "Editar parte", salvar: "Salvar", cancelar: "Cancelar",
        minutos: "Minutos", ordem: { nome: "Nome", dias: "Tempo" }, info: { nunca: "Nunca" },
        filtroAtivas: "Ativas", filtroArquivadas: "Arquivadas", filtroTodas: "Todas", arquivada: "Arquivada",
        arquivar: "Arquivar", restaurar: "Restaurar", apagarArquivadas: "Apagar arquivadas",
        excluirParte: "Excluir parte", confirmarExcluirParte: "Tem certeza que deseja excluir esta parte?",
        semItens: "Sem itens.", semNome: "(Sem nome)", duplicadoBadge: "Duplicado", duplicadoTooltip: "Duplicado na semana",
        confirmarDuplicado: "Esse aluno já está designado nesta semana. Quer usar mesmo assim?",
        dias: "dias", dataNaoDefinida: "Data não definida", dataReuniao: "Data da Reunião", obsTempo: "Nota de tempo.",
        com: "com", titulo: "Título", descricao: "Descrição", tempo: "Tempo",
        visitaSC: "Visita SC", assembleia: "Assembleia", congresso: "Congresso", semReuniao: "Não haverá Reunião Vida e Ministério nesta semana.",
        quadroAviso: "O quadro de anúncios não exibirá designações.", semanaDe: "Semana de", tercaFeira: "(Terça-feira)",
        nenhumaImportada: "Nenhuma programação importada.", vaParaImportar: "Vá para Importar para começar.",
        selecioneSemana: "Selecione pelo menos uma semana acima."
    }
};

const CARGO_FALLBACK = {
    pt: { pt: "Irmão", es: "Hermano", cor: "bg-gray-100 text-gray-700", gen: "M" }
};

const Designar = ({
    listaProgramacoes = [],
    setListaProgramacoes = () => { },
    alunos = [],
    cargosMap = {},
    lang = 'pt',
    t = {},
    onExcluirSemana,
    config = {}
}) => {
    const [semanaAtivaIndex, setSemanaAtivaIndex] = useState(0);
    const [filtroSemanas, setFiltroSemanas] = useState('ativas');
    const [semanasSelecionadas, setSemanasSelecionadas] = useState({});
    const userClearedWeeksRef = useRef(false);

    const [slotAtivo, setSlotAtivo] = useState(null);
    const [termoBusca, setTermoBusca] = useState('');
    const [filtrosTiposAtivos, setFiltrosTiposAtivos] = useState([]);
    const [filtroGenero, setFiltroGenero] = useState('todos');
    const [ordenacaoChave, setOrdenacaoChave] = useState('dias');
    const [ordemCrescente, setOrdemCrescente] = useState(true);

    const [modalEditarOpen, setModalEditarOpen] = useState(false);
    const [parteEditCtx, setParteEditCtx] = useState(null);

    const [modalSugestao, setModalSugestao] = useState({
        aberto: false, semanaIndex: null, parteId: null, key: null
    });

    // --- ESTADOS DO DRAG AND DROP ---
    const [draggedAluno, setDraggedAluno] = useState(null);
    const [dragOverSlot, setDragOverSlot] = useState(null);

    const TT = useMemo(() => {
        const base = T_FALLBACK?.[lang] || T_FALLBACK.pt;
        return { ...base, ...t, ordem: { ...(base?.ordem || {}), ...(t?.ordem || {}) }, info: { ...(base?.info || {}), ...(t?.info || {}) } };
    }, [t, lang]);

    const getSemanaKey = (sem, idx) =>
        (sem?.id ?? sem?.dataReuniao ?? sem?.dataInicio ?? sem?.data ?? sem?.semana ?? String(idx)).toString();

    const getCargoInfo = (cargoKey) => cargosMap?.[cargoKey] || (CARGO_FALLBACK?.[lang] || CARGO_FALLBACK.pt);

    const getSortTime = (sem) => {
        const iso = sem?.dataReuniao || sem?.dataInicio || sem?.data || null;
        if (iso) {
            const ts = new Date(iso).getTime();
            if (!isNaN(ts)) return ts;
        }
        return 0;
    };

    const normalizeAndSortProgramacoes = (arr) => [...(arr || [])].sort((a, b) => {
        const timeA = getSortTime(a);
        const timeB = getSortTime(b);
        if (timeA !== timeB && timeA > 0 && timeB > 0) return timeA - timeB;
        return (a?.semana || '').localeCompare(b?.semana || '');
    });

    const setListaProgramacoesSafe = (updater) => {
        setListaProgramacoes(prev => normalizeAndSortProgramacoes(typeof updater === 'function' ? updater(prev) : updater));
    };

    const listaFiltradaPorFlag = useMemo(() => {
        const lista = Array.isArray(listaProgramacoes) ? [...listaProgramacoes] : [];
        lista.sort((a, b) => {
            const timeA = getSortTime(a);
            const timeB = getSortTime(b);
            if (timeA !== timeB && timeA > 0 && timeB > 0) return timeA - timeB;
            return (a?.semana || '').localeCompare(b?.semana || '');
        });

        if (filtroSemanas === 'todas') return lista;
        if (filtroSemanas === 'arquivadas') return lista.filter(s => !!s?.arquivada);
        return lista.filter(s => !s?.arquivada);
    }, [listaProgramacoes, filtroSemanas]);

    useEffect(() => {
        setSemanaAtivaIndex(prev => Math.min(prev, Math.max(0, listaFiltradaPorFlag.length - 1)));
    }, [listaFiltradaPorFlag?.length]);

    const getSemanaKeyByFilteredIndex = (idxFiltrado) => getSemanaKey(listaFiltradaPorFlag?.[idxFiltrado], idxFiltrado);
    const getSemanaRealIndexByKey = (semanaKey) => listaProgramacoes.findIndex((s, idx) => getSemanaKey(s, idx) === semanaKey);
    const getSemanaRealIndexFromFilteredIndex = (idxFiltrado) => getSemanaRealIndexByKey(getSemanaKeyByFilteredIndex(idxFiltrado));
    const getSemanaIndexContexto = () => Number.isInteger(slotAtivo?.semanaIndex) ? slotAtivo.semanaIndex : semanaAtivaIndex;

    useEffect(() => {
        if (!Array.isArray(listaFiltradaPorFlag) || listaFiltradaPorFlag.length === 0) return;

        setSemanasSelecionadas((prev) => {
            const keysVisiveis = new Set(listaFiltradaPorFlag.map((s, i) => getSemanaKey(s, i)));
            const hasAnyVisibleSelected = Object.keys(prev).some(k => keysVisiveis.has(k) && prev[k]);

            if (!userClearedWeeksRef.current && !hasAnyVisibleSelected) {
                const next = { ...prev };
                listaFiltradaPorFlag.forEach((sem, idx) => { next[getSemanaKey(sem, idx)] = true; });
                return next;
            }
            return prev;
        });
    }, [listaFiltradaPorFlag]);

    const semanasParaExibir = useMemo(() => {
        return (listaFiltradaPorFlag || []).map((sem, idx) => ({ sem, idx, key: getSemanaKey(sem, idx) })).filter(({ key }) => !!semanasSelecionadas[key]);
    }, [listaFiltradaPorFlag, semanasSelecionadas]);

    const mudarFiltro = (novoFiltro) => {
        setFiltroSemanas(novoFiltro);
        userClearedWeeksRef.current = false;
        setSemanaAtivaIndex(0);
        setSemanasSelecionadas({});
    };

    const totalSelecionadas = Object.values(semanasSelecionadas).filter(Boolean).length;

    const selecionarTodasVisiveis = () => {
        userClearedWeeksRef.current = false;
        const next = {};
        listaFiltradaPorFlag.forEach((sem, idx) => { next[getSemanaKey(sem, idx)] = true; });
        setSemanasSelecionadas(next);
    };

    const limparSelecaoVisiveis = () => {
        userClearedWeeksRef.current = true;
        setSemanasSelecionadas({});
    };

    const getSelectedKeys = () => Object.entries(semanasSelecionadas || {}).filter(([, v]) => !!v).map(([k]) => k);

    const arquivarSelecionadas = () => {
        const keys = getSelectedKeys();
        if (keys.length === 0) return;
        if (!window.confirm(`${TT.arquivar} ${keys.length} ${TT.semana}(s)?`)) return;
        setListaProgramacoesSafe(prev => prev.map((s, idx) => keys.includes(getSemanaKey(s, idx)) ? { ...s, arquivada: true, arquivadaEm: new Date().toISOString() } : s));
    };

    const restaurarSelecionadas = () => {
        const keys = getSelectedKeys();
        if (keys.length === 0) return;
        if (!window.confirm(`${TT.restaurar} ${keys.length} ${TT.semana}(s)?`)) return;
        setListaProgramacoesSafe(prev => prev.map((s, idx) => keys.includes(getSemanaKey(s, idx)) ? { ...s, arquivada: false, arquivadaEm: null } : s));
    };

    const apagarArquivadas = async () => {
        const keys = getSelectedKeys();
        let alvo = [];
        if (keys.length > 0) {
            alvo = listaProgramacoes.filter((s, idx) => keys.includes(getSemanaKey(s, idx)) && s?.arquivada);
        } else {
            alvo = listaProgramacoes.filter(s => !!s?.arquivada);
        }

        if (alvo.length === 0) return alert('Nenhuma semana arquivada para apagar.');
        if (!window.confirm(`${TT.apagarArquivadas}? (${alvo.length})`)) return;

        if (onExcluirSemana) {
            for (const item of alvo) { if (item.id) await onExcluirSemana(item.id); }
        }

        const idsApagados = new Set(alvo.map(a => a.id));
        setListaProgramacoesSafe(prev => prev.filter(s => !idsApagados.has(s.id)));
        setSemanasSelecionadas({});
        userClearedWeeksRef.current = true;
    };

    const handleExcluirSemana = async (semanaKey) => {
        const atual = listaProgramacoes.find((s, idx) => getSemanaKey(s, idx) === semanaKey);
        if (!atual || !window.confirm(`Excluir a semana ${atual?.semana || semanaKey}?`)) return;

        if (onExcluirSemana && atual.id) await onExcluirSemana(atual.id);

        setSlotAtivo(null);
        setModalEditarOpen(false);
        setParteEditCtx(null);

        setListaProgramacoesSafe(prev => prev.filter((s, idx) => getSemanaKey(s, idx) !== semanaKey));
        setSemanasSelecionadas(prev => { const next = { ...prev }; delete next[semanaKey]; return next; });
    };

    const toggleArquivadaSemana = (semanaKey, arquivar) => {
        const atual = listaProgramacoes.find((s, idx) => getSemanaKey(s, idx) === semanaKey);
        if (!atual) return;
        const msg = arquivar ? `${TT.arquivar} ${TT.semana} ${atual?.semana}?` : `${TT.restaurar} ${TT.semana} ${atual?.semana}?`;
        if (!window.confirm(msg)) return;

        setListaProgramacoesSafe(prev => prev.map((s, idx) => getSemanaKey(s, idx) === semanaKey ? { ...s, arquivada: arquivar, arquivadaEm: arquivar ? new Date().toISOString() : null } : s));
    };

    const getUltimoRegistro = (aluno) => {
        if (!aluno?.historico || aluno.historico.length === 0) return { data: null };
        const ordenado = [...aluno.historico].sort((a, b) => new Date(b?.data || 0).getTime() - new Date(a?.data || 0).getTime());
        return { data: ordenado[0]?.data };
    };

    const getHistoricoRecente = (aluno, limit = 6) => {
        if (!aluno?.historico) return [];
        return [...aluno.historico].sort((a, b) => new Date(b?.data || 0).getTime() - new Date(a?.data || 0).getTime()).slice(0, limit);
    };

    const calcularDiasDesdeUltimaParte = (aluno) => {
        const ultimo = getUltimoRegistro(aluno);
        if (!ultimo?.data) return null;
        return Math.floor((new Date().getTime() - new Date(ultimo.data).getTime()) / (1000 * 60 * 60 * 24));
    };

    const isAlunoDuplicadoBySemanaKey = (alunoId, semanaKey) => {
        const sem = listaProgramacoes?.[getSemanaRealIndexByKey(semanaKey)];
        if (!sem) return false;
        if (sem?.presidente?.id === alunoId) return true;
        return (sem?.partes || []).some(p => p?.estudante?.id === alunoId || p?.ajudante?.id === alunoId || p?.oracao?.id === alunoId || p?.dirigente?.id === alunoId || p?.leitor?.id === alunoId);
    };

    const alunosFiltrados = useMemo(() => {
        const buscaNorm = termoBusca ? normalizar(termoBusca) : '';
        return (alunos || []).filter(aluno => {
            const cargoKey = aluno?.tipo;
            const cargoInfo = getCargoInfo(cargoKey);
            if (filtroGenero !== 'todos' && cargoInfo?.gen !== filtroGenero) return false;
            if (buscaNorm) {
                const passaNome = normalizar(aluno?.nome || '').includes(buscaNorm);
                const passaCargo = normalizar(cargoInfo?.[lang] || cargoKey || '').includes(buscaNorm);
                if (!passaNome && !passaCargo) return false;
            }
            if (filtrosTiposAtivos.length > 0 && !filtrosTiposAtivos.includes(cargoKey)) return false;
            return cargoKey !== 'desab';
        }).sort((a, b) => {
            let res = ordenacaoChave === 'nome'
                ? (a?.nome || '').localeCompare(b?.nome || '')
                : (calcularDiasDesdeUltimaParte(a) ?? 99999) - (calcularDiasDesdeUltimaParte(b) ?? 99999);
            return ordemCrescente ? res : -res;
        });
    }, [alunos, cargosMap, filtroGenero, termoBusca, filtrosTiposAtivos, ordenacaoChave, ordemCrescente, lang]);

    // --- ATUALIZADO: ATRIBUIR ALUNO (SUPORTA DRAG & DROP E CLIQUE) ---
    const atribuirAluno = (aluno, targetSlot = slotAtivo) => {
        if (!targetSlot) return;
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(Number.isInteger(targetSlot.semanaIndex) ? targetSlot.semanaIndex : semanaAtivaIndex);
        if (semanaRealIndex === -1) return;

        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const semana = { ...lista[semanaRealIndex], partes: [...(lista[semanaRealIndex].partes || [])] };

            if (targetSlot.key === 'presidente') semana.presidente = aluno;
            else {
                const idxParte = semana.partes.findIndex(p => p.id === targetSlot.parteId);
                if (idxParte !== -1) semana.partes[idxParte] = { ...semana.partes[idxParte], [targetSlot.key]: aluno };
            }
            lista[semanaRealIndex] = semana;
            return lista;
        });

        // Se a designação veio por clique (usando slotAtivo), limpa o ativo. 
        // Se veio por Drag&Drop, o slotAtivo já não interferia.
        if (targetSlot === slotAtivo) {
            setTimeout(() => setSlotAtivo(null), 10);
        }
    };

    const aplicarSugestao = (aluno) => {
        const { semanaIndex, key, parteId } = modalSugestao;
        atribuirAluno(aluno, { key, parteId, semanaIndex });
        setModalSugestao({ ...modalSugestao, aberto: false });
    };

    const atualizarParteNaSemanaRealIndex = (semanaRealIndex, parteId, patch) => {
        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const atual = lista[semanaRealIndex];
            if (!atual) return lista;
            const semana = { ...atual, partes: [...(atual.partes || [])] };
            const idx = semana.partes.findIndex(p => p.id === parteId);
            if (idx === -1) return lista;
            semana.partes[idx] = { ...semana.partes[idx], ...patch };
            lista[semanaRealIndex] = semana;
            return lista;
        });
    };

    const abrirModalEditarParte = (parte, semanaIndexFiltrado) => {
        setParteEditCtx({
            parteId: parte.id, semanaIndex: semanaIndexFiltrado,
            valores: { titulo: (parte?.titulo ?? '').toString(), descricao: (parte?.descricao ?? '').toString(), tempo: String(parte?.tempo ?? '') }
        });
        setModalEditarOpen(true);
    };

    const salvarEdicaoParte = () => {
        if (!parteEditCtx?.parteId) return;
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(Number.isInteger(parteEditCtx.semanaIndex) ? parteEditCtx.semanaIndex : semanaAtivaIndex);
        if (semanaRealIndex === -1) return;

        const sem = listaProgramacoes[semanaRealIndex];
        const parte = (sem?.partes || []).find(p => p.id === parteEditCtx.parteId);
        if (!parte) return;

        const travarTempo = isLinhaInicialFinal(parte);
        atualizarParteNaSemanaRealIndex(semanaRealIndex, parteEditCtx.parteId, {
            titulo: parteEditCtx.valores.titulo,
            descricao: parteEditCtx.valores.descricao,
            ...(travarTempo ? {} : { tempo: parteEditCtx.valores.tempo })
        });
        setModalEditarOpen(false);
        setParteEditCtx(null);
    };

    const handleExcluirParte = (parteId, semanaIndexFiltrado) => {
        if (!window.confirm(TT.confirmarExcluirParte)) return;
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(semanaIndexFiltrado);
        if (semanaRealIndex === -1) return;

        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const atual = lista[semanaRealIndex];
            lista[semanaRealIndex] = { ...atual, partes: atual.partes.filter(p => p.id !== parteId) };
            return lista;
        });

        if (parteEditCtx?.parteId === parteId) { setModalEditarOpen(false); setParteEditCtx(null); }
        if (slotAtivo?.parteId === parteId) setSlotAtivo(null);
    };

    // --- RENDERIZAÇÃO DE BOTÕES COM DRAG & DROP E LAYOUT COMPACTO ---
    const renderSlotButton = ({ label, value, onClick, active, hint, emptyText, activeClass, idleClass, barActiveClass, onSuggest, slotCtx }) => {
        const isEmpty = !value;
        const isHoveredByDrag = dragOverSlot && slotCtx && dragOverSlot.key === slotCtx.key && dragOverSlot.parteId === slotCtx.parteId && dragOverSlot.semanaIndex === slotCtx.semanaIndex;

        return (
            <div
                className="relative w-full group/slot"
                onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedAluno && slotCtx && (!dragOverSlot || dragOverSlot.key !== slotCtx.key || dragOverSlot.parteId !== slotCtx.parteId)) {
                        setDragOverSlot(slotCtx);
                    }
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverSlot(null);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSlot(null);
                    if (draggedAluno && slotCtx) atribuirAluno(draggedAluno, slotCtx);
                }}
            >
                <button
                    type="button"
                    onClick={onClick}
                    className={`w-full py-2 px-3 rounded-lg border-2 transition-all text-left relative group focus:outline-none ${isEmpty ? "border-dashed" : ""} ${isHoveredByDrag ? "ring-2 ring-blue-500 bg-blue-100 border-blue-400 scale-[1.01]" : (active ? activeClass : idleClass)}`}
                    title={value ? TT.cliquePara : (emptyText || hint || TT.cliquePara)}
                >
                    <div className="flex flex-row items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-gray-400 shrink-0 w-20">{label}</span>
                        {value ? (
                            <p className="font-bold text-[13px] text-gray-800 truncate text-right flex-1">{value.nome}</p>
                        ) : (
                            <p className="text-[11px] text-gray-400 italic flex items-center justify-end gap-1 flex-1">
                                <UserPlus size={12} className="opacity-60" /> {emptyText || hint || TT.cliquePara}
                            </p>
                        )}
                    </div>
                    <div className={`absolute inset-y-0 right-0 w-1 rounded-r-lg transition-opacity ${active || isHoveredByDrag ? barActiveClass : "bg-transparent"}`} />
                </button>
                {onSuggest && (
                    <button type="button" onClick={onSuggest} className="absolute top-1/2 -translate-y-1/2 right-1 z-10 p-1.5 rounded-full bg-yellow-100 text-yellow-600 opacity-0 group-hover/slot:opacity-100 transition-all hover:bg-yellow-200 shadow-sm focus:opacity-100" title="Sugestão Inteligente">
                        <Lightbulb size={12} />
                    </button>
                )}
            </div>
        );
    };

    const renderParteCard = (parte, semanaIndexFiltrado) => {
        const secKey = normalizarSecao(parte?.secao);
        const headerClass = isLinhaInicialFinal(parte) ? 'bg-gray-200 text-gray-800' : SECOES_META[secKey]?.header || SECOES_META.vida.header;
        const isCantico = isCanticoIntermediario(parte);

        return (
            <div key={parte.id} className="bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all">
                {/* Cabeçalho mais compacto (px-3 py-1.5) */}
                <div className={`${headerClass} px-3 py-1.5 flex justify-between items-center gap-3`}>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{parte.titulo}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {typeof parte.tempo !== 'undefined' && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isLinhaInicialFinal(parte) ? "bg-white text-gray-700 border border-gray-300" : "bg-white/20 text-white"}`}>{parte.tempo} min</span>}
                        <button type="button" onClick={() => abrirModalEditarParte(parte, semanaIndexFiltrado)} className={`p-1 rounded border transition ${isLinhaInicialFinal(parte) ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50" : "border-white/20 bg-white/10 text-white hover:bg-white/20"}`} title={TT.editarParte}><Edit2 size={12} /></button>
                        <button type="button" onClick={() => handleExcluirParte(parte.id, semanaIndexFiltrado)} className={`p-1 rounded border transition ${isLinhaInicialFinal(parte) ? "border-gray-300 bg-white text-red-500 hover:bg-red-50" : "border-white/20 bg-white/10 text-white hover:bg-red-500 hover:border-red-500"}`} title={TT.excluirParte}><Trash2 size={12} /></button>
                    </div>
                </div>

                {isCantico ? (
                    <div className="p-2 text-[11px] text-center text-gray-400 italic bg-gray-50 border-t border-gray-100">
                        Nenhuma designação necessária
                    </div>
                ) : isLinhaInicialFinal(parte) ? (
                    <div className="p-2">
                        {renderSlotButton({
                            label: TT.oracao, value: parte.oracao || null,
                            onClick: () => setSlotAtivo({ key: 'oracao', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                            active: slotAtivo?.key === 'oracao' && slotAtivo?.parteId === parte.id,
                            activeClass: 'border-blue-500 bg-blue-50 ring-2 ring-blue-100', idleClass: 'border-gray-200 hover:border-blue-300', barActiveClass: 'bg-blue-500',
                            onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'oracao', parteId: parte.id }); },
                            slotCtx: { key: 'oracao', parteId: parte.id, semanaIndex: semanaIndexFiltrado }
                        })}
                    </div>
                ) : isEstudoBiblicoCongregacao(parte) ? (
                    <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {renderSlotButton({ label: TT.dirigente, value: parte.dirigente, onClick: () => setSlotAtivo({ key: 'dirigente', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'dirigente' && slotAtivo?.parteId === parte.id, activeClass: 'border-purple-500 bg-purple-50 ring-2 ring-purple-100', idleClass: 'border-gray-200 hover:border-purple-300', barActiveClass: 'bg-purple-500', onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'dirigente', parteId: parte.id }); }, slotCtx: { key: 'dirigente', parteId: parte.id, semanaIndex: semanaIndexFiltrado } })}
                        {renderSlotButton({ label: TT.leitor, value: parte.leitor, onClick: () => setSlotAtivo({ key: 'leitor', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'leitor' && slotAtivo?.parteId === parte.id, activeClass: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100', idleClass: 'border-gray-200 hover:border-indigo-300', barActiveClass: 'bg-indigo-500', onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'leitor', parteId: parte.id }); }, slotCtx: { key: 'leitor', parteId: parte.id, semanaIndex: semanaIndexFiltrado } })}
                    </div>
                ) : (
                    <div className={`p-2 grid gap-1.5 ${secKey === 'ministerio' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                        {renderSlotButton({ label: TT.estudante, value: parte.estudante, onClick: () => setSlotAtivo({ key: 'estudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'estudante' && slotAtivo?.parteId === parte.id, activeClass: 'border-green-500 bg-green-50 ring-2 ring-green-100', idleClass: 'border-gray-200 hover:border-green-300', barActiveClass: 'bg-green-500', onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'estudante', parteId: parte.id }); }, slotCtx: { key: 'estudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado } })}
                        {secKey === 'ministerio' && renderSlotButton({ label: TT.ajudante, value: parte.ajudante, onClick: () => setSlotAtivo({ key: 'ajudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'ajudante' && slotAtivo?.parteId === parte.id, emptyText: 'Opcional', activeClass: 'border-blue-500 bg-blue-50 ring-2 ring-blue-100', idleClass: 'border-gray-200 hover:border-blue-300', barActiveClass: 'bg-blue-500', onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'ajudante', parteId: parte.id }); }, slotCtx: { key: 'ajudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado } })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full min-h-screen bg-gray-50 relative font-sans text-gray-800">

            {/* CABEÇALHO STICKY EXCLUSIVO COM FULL-WIDTH */}
            <div className="w-full sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200 transition-all">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">

                    <div className="w-full lg:w-auto flex flex-wrap items-center gap-2 min-w-0">
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
                        <button type="button" onClick={apagarArquivadas} className="px-3 py-1.5 rounded-full text-xs font-bold border bg-red-50 text-red-700 hover:bg-red-100 border-red-200 transition shadow-sm" title={TT.apagarArquivadas}>
                            {TT.apagarArquivadas}
                        </button>

                        <button type="button" onClick={selecionarTodasVisiveis} className="px-3 py-1.5 rounded-full text-xs font-bold border bg-gray-100 hover:bg-gray-200 transition text-gray-700 shadow-sm">{TT.filtroTodas}</button>
                        <button type="button" onClick={limparSelecaoVisiveis} className="px-3 py-1.5 rounded-full text-xs font-bold border bg-white hover:bg-gray-100 transition text-gray-700 shadow-sm">Limpar</button>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:max-w-[40%]">
                        {listaFiltradaPorFlag.map((sem, idx) => {
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
                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all whitespace-nowrap inline-flex items-center gap-1.5 shadow-sm ${on ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200'} ${foco ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`}
                                    title={sem?.semana}
                                >
                                    <span className="truncate max-w-[80px] sm:max-w-[120px]">{sem?.semana?.split(' -')[0]}</span>
                                    {isVisita && <Briefcase size={10} className={on ? "text-white" : "text-blue-600"} />}
                                    {isAssembly && <Tent size={10} className={on ? "text-white" : "text-yellow-600"} />}
                                    {isArq && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${on ? "bg-black/20 text-white" : "bg-gray-100 text-gray-600"}`}>{TT.arquivada}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* CONTAINER PRINCIPAL DO LAYOUT */}
            <div className="w-full max-w-7xl mx-auto py-4">
                <div className="flex flex-col lg:flex-row gap-6 pb-20 items-start">

                    <NavegadorSemanas
                        listaSemanas={listaFiltradaPorFlag}
                        semanasSelecionadas={semanasSelecionadas}
                        semanaAtivaIndex={semanaAtivaIndex}
                        setSemanaAtivaIndex={setSemanaAtivaIndex}
                        getSemanaKey={getSemanaKey}
                        TT={TT}
                    />

                    {/* COLUNA CENTRAL */}
                    <div className="flex-1 space-y-4 min-w-0">
                        {(!Array.isArray(listaProgramacoes) || listaProgramacoes.length === 0) ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-sm font-medium">{TT.nenhumaImportada}</p>
                                <p className="text-xs mt-2">{TT.vaParaImportar}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {listaFiltradaPorFlag.length === 0 ? (
                                    <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                        <Archive size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm font-medium">Nenhuma semana encontrada neste filtro.</p>
                                    </div>
                                ) : semanasParaExibir.length === 0 ? (
                                    <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                        <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm font-medium">{TT.selecioneSemana}</p>
                                    </div>
                                ) : (
                                    semanasParaExibir.map(({ sem, idx, key }) => {
                                        const partesDaSemana = Array.isArray(sem?.partes) ? sem.partes : [];
                                        const isArq = !!sem?.arquivada;

                                        const eventoConfig = config?.eventosAnuais?.find(e => e.dataInicio === sem.dataInicio);
                                        const tipoEvento = eventoConfig?.tipo || sem.evento || 'normal';
                                        const isVisita = tipoEvento === 'visita';
                                        const isAssembly = tipoEvento.includes('assembleia') || tipoEvento.includes('congresso');

                                        return (
                                            <div id={`semana-${key}`} key={key} className={`scroll-mt-40 rounded-2xl border p-2.5 space-y-2.5 transition-all ${isVisita ? 'bg-blue-50 border-blue-200' : isAssembly ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>

                                                {/* CABEÇALHO DA SEMANA */}
                                                <div className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-3 ${isVisita ? 'bg-white/80 border-blue-200' : 'bg-white border-gray-200 shadow-sm'}`}>
                                                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                                                        <h3 className="font-black text-[15px] text-gray-800 truncate flex items-center gap-2">
                                                            <span>{sem?.semana || `${TT.semana} ${idx + 1}`}</span>
                                                            {isVisita && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-600 text-white border border-blue-700 flex items-center gap-1 uppercase tracking-wider animate-pulse"><Briefcase size={10} /> {TT.visitaSC}</span>}
                                                            {tipoEvento.includes('assembleia') && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-1"><Tent size={10} /> {TT.assembleia}</span>}
                                                            {tipoEvento.includes('congresso') && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1"><UsersRound size={10} /> {TT.congresso}</span>}
                                                        </h3>
                                                        <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                                            {sem?.dataReuniao ? (
                                                                <>
                                                                    <Calendar size={10} />
                                                                    <strong className={isVisita ? 'text-blue-700' : ''}>{sem.dataReuniao.split('-').reverse().join('/')}</strong>
                                                                    {isVisita && ` ${TT.tercaFeira}`}
                                                                </>
                                                            ) : <span>{TT.dataNaoDefinida}</span>}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1.5 shrink-0">
                                                        <button onClick={() => toggleArquivadaSemana(key, !isArq)} className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition" title={isArq ? TT.restaurar : TT.arquivar}>
                                                            {isArq ? <RotateCcw size={14} /> : <Archive size={14} />}
                                                        </button>
                                                        <button onClick={() => handleExcluirSemana(key)} className="p-1.5 rounded-lg border bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 transition">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {isAssembly ? (
                                                    <div className="bg-white rounded-xl border-2 border-dashed border-yellow-300 p-6 text-center flex flex-col items-center justify-center gap-2">
                                                        <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
                                                            {tipoEvento.includes('congresso') ? <UsersRound size={32} /> : <Tent size={32} />}
                                                        </div>
                                                        <h3 className="text-lg font-bold text-gray-700">{TT.semanaDe} {tipoEvento.includes('congresso') ? TT.congresso : TT.assembleia}</h3>
                                                        <p className="text-xs text-gray-500 max-w-md">{TT.semReuniao} {TT.quadroAviso}</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* PRESIDENTE (DROPZONE) */}
                                                        <div
                                                            className="relative group/slot w-full shadow-sm rounded-xl"
                                                            onDragOver={(e) => {
                                                                e.preventDefault();
                                                                if (draggedAluno && (!dragOverSlot || dragOverSlot.key !== 'presidente' || dragOverSlot.semanaIndex !== idx)) {
                                                                    setDragOverSlot({ key: 'presidente', semanaIndex: idx });
                                                                }
                                                            }}
                                                            onDragLeave={(e) => {
                                                                e.preventDefault();
                                                                if (!e.currentTarget.contains(e.relatedTarget)) setDragOverSlot(null);
                                                            }}
                                                            onDrop={(e) => {
                                                                e.preventDefault();
                                                                setDragOverSlot(null);
                                                                if (draggedAluno) atribuirAluno(draggedAluno, { key: 'presidente', semanaIndex: idx });
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => setSlotAtivo({ key: 'presidente', semanaIndex: idx })}
                                                                className={`bg-white py-2 px-3 rounded-xl border-2 text-left w-full transition-all hover:border-blue-300 ${dragOverSlot?.key === 'presidente' && dragOverSlot?.semanaIndex === idx ? "ring-2 ring-blue-500 bg-blue-100 border-blue-400 scale-[1.01]" : (slotAtivo?.key === 'presidente' && slotAtivo?.semanaIndex === idx ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200")}`}
                                                            >
                                                                <div className="flex flex-row items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-1.5 w-24 shrink-0"><User size={14} className="text-blue-600" /><span className="text-[10px] font-black uppercase text-gray-400">{TT.presidente}</span></div>
                                                                    {sem.presidente ? <p className="font-bold text-[13px] text-gray-800 truncate flex-1 text-right">{sem.presidente.nome}</p> : <p className="text-[11px] text-gray-400 italic flex items-center justify-end gap-1 flex-1"><UserPlus size={12} className="opacity-60" /> {TT.cliquePara}</p>}
                                                                </div>
                                                            </button>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: idx, key: 'presidente' }); }} className="absolute top-1/2 -translate-y-1/2 right-1 z-10 p-1.5 rounded-full bg-yellow-100 text-yellow-600 opacity-0 group-hover/slot:opacity-100 transition-all hover:bg-yellow-200 shadow-sm focus:opacity-100"><Lightbulb size={12} /></button>
                                                        </div>

                                                        {/* PARTES INICIAIS E SECOES (USAM renderParteCard com visual COMPACTO) */}
                                                        <div className="space-y-2">{partesDaSemana.filter(isAbertura).map(p => renderParteCard(p, idx))}</div>

                                                        <div className="space-y-2.5">
                                                            {SECOES_ORDEM.map(secKey => {
                                                                const partesSecao = partesDaSemana.filter(p => normalizarSecao(p.secao) === secKey && !isAbertura(p) && !isEncerramento(p));
                                                                return (
                                                                    <div key={secKey} className="space-y-2">
                                                                        <div className={`rounded-lg overflow-hidden border ${SECOES_META[secKey].border} shadow-sm`}>
                                                                            <div className={`${SECOES_META[secKey].header} px-3 py-1.5 flex items-center justify-between`}>
                                                                                <span className="text-[10px] font-black tracking-widest uppercase">{SECOES_META[secKey].titulo}</span>
                                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${SECOES_META[secKey].pill}`}>{partesSecao.length} itens</span>
                                                                            </div>
                                                                        </div>
                                                                        {partesSecao.length === 0 ? (
                                                                            <div className="text-[10px] text-gray-400 italic px-2">{TT.semItens}</div>
                                                                        ) : (
                                                                            <div className="space-y-2">{partesSecao.map(p => renderParteCard(p, idx))}</div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="space-y-2">{partesDaSemana.filter(isEncerramento).map(p => renderParteCard(p, idx))}</div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* BARRA LATERAL ALUNOS COM DRAG AND DROP */}
                    <SidebarAlunos
                        TT={TT} buildSlotLabel={() => slotAtivo ? `Designando ${slotAtivo.key}` : TT.alunos}
                        alunosFiltrados={alunosFiltrados} slotAtivo={slotAtivo} setSlotAtivo={setSlotAtivo}
                        termoBusca={termoBusca} setTermoBusca={setTermoBusca}
                        ordenacaoChave={ordenacaoChave} setOrdenacaoChave={setOrdenacaoChave}
                        ordemCrescente={ordemCrescente} setOrdemCrescente={setOrdemCrescente}
                        filtroGenero={filtroGenero} handleMudarGenero={setFiltroGenero}
                        cargosMap={cargosMap} filtrosTiposAtivos={filtrosTiposAtivos} toggleFiltroTipo={(c) => setFiltrosTiposAtivos(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                        lang={lang} atribuirAluno={atribuirAluno} calcularDiasDesdeUltimaParte={calcularDiasDesdeUltimaParte}
                        getHistoricoRecente={getHistoricoRecente} isAlunoDuplicadoBySemanaKey={isAlunoDuplicadoBySemanaKey}
                        getSemanaKeyByFilteredIndex={getSemanaKeyByFilteredIndex} getSemanaIndexContexto={getSemanaIndexContexto}
                        getCargoInfo={getCargoInfo}

                        setDraggedAluno={setDraggedAluno}
                        semanasSelecionadas={semanasSelecionadas}
                        dragOverSlot={dragOverSlot}
                    />

                </div>
            </div>

            {/* MODAL: Editar parte */}
            {modalEditarOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModalEditarOpen(false); setParteEditCtx(null); }} />
                    <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border overflow-hidden">
                        <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between">
                            <div className="text-sm font-black">{TT.editarParte}</div>
                            <button type="button" onClick={() => { setModalEditarOpen(false); setParteEditCtx(null); }} className="p-1 rounded hover:bg-white/10 transition" title={TT.cancelar}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">{TT.titulo}</label>
                                <input type="text" value={parteEditCtx?.valores?.titulo ?? ''} onChange={(e) => setParteEditCtx(prev => ({ ...prev, valores: { ...(prev?.valores || {}), titulo: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">{TT.descricao}</label>
                                <textarea rows={3} value={parteEditCtx?.valores?.descricao ?? ''} onChange={(e) => setParteEditCtx(prev => ({ ...prev, valores: { ...(prev?.valores || {}), descricao: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">{TT.tempo}</label>
                                <input type="text" value={parteEditCtx?.valores?.tempo ?? ''} onChange={(e) => setParteEditCtx(prev => ({ ...prev, valores: { ...(prev?.valores || {}), tempo: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200" />
                                <p className="mt-1 text-[10px] text-gray-400">{TT.obsTempo}</p>
                            </div>
                        </div>

                        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                            <button type="button" onClick={() => { setModalEditarOpen(false); setParteEditCtx(null); }} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-100 transition text-sm font-bold inline-flex items-center gap-2">
                                <X size={16} /> {TT.cancelar}
                            </button>
                            <button type="button" onClick={salvarEdicaoParte} className="px-3 py-2 rounded-lg border bg-blue-600 hover:bg-blue-700 text-white transition text-sm font-bold inline-flex items-center gap-2">
                                <Save size={16} /> {TT.salvar}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SUGESTÃO */}
            <ModalSugestao isOpen={modalSugestao.aberto} onClose={() => setModalSugestao({ ...modalSugestao, aberto: false })} onSelect={aplicarSugestao} alunos={alunos} historico={listaProgramacoes} parteAtual={modalSugestao.parteId ? listaFiltradaPorFlag?.[modalSugestao.semanaIndex]?.partes?.find(p => p.id === modalSugestao.parteId) : null} semanaAtual={listaFiltradaPorFlag?.[modalSugestao.semanaIndex]} modalKey={modalSugestao.key} cargosMap={cargosMap} lang={lang} />
        </div>
    );
};

export default Designar;