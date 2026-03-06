import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    Calendar, User, Search, UsersRound, UserRound, Clock,
    AlertTriangle, StickyNote, Trash2, Edit2, X, Save, UserPlus,
    Archive, RotateCcw, Lightbulb, Briefcase, Tent, FilterX, SortAsc, SortDesc
} from 'lucide-react';

import ModalSugestao from './ModalSugestao';
import NavegadorSemanas from './NavegadorSemanas';
import SidebarAlunos from './SidebarAlunos';
import DesignarHeader from './DesignarHeader';
import {
    SECOES_ORDEM, SECOES_META, normalizar, normalizarSecao,
    tipoLower, isAbertura, isEncerramento, isLinhaInicialFinal,
    isEstudoBiblicoCongregacao, isCanticoIntermediario, isSemanaAssembleia
} from './helpers';
import { getMeetingDateISOFromSemana } from '../../utils/revisarEnviar/dates';

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
    onAlunosChange, // <--- ADICIONADO AQUI
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

    const [draggedAluno, setDraggedAluno] = useState(null);
    const [dragOverSlot, setDragOverSlot] = useState(null);

    const TT = useMemo(() => {
        const base = T_FALLBACK?.[lang] || T_FALLBACK.pt;
        return { ...base, ...t, ordem: { ...(base?.ordem || {}), ...(t?.ordem || {}) }, info: { ...(base?.info || {}), ...(t?.info || {}) } };
    }, [t, lang]);

    const getSemanaKey = (sem, idx) =>
        (sem?.id ?? sem?.dataReuniao ?? sem?.dataInicio ?? sem?.dataExata ?? sem?.data ?? sem?.semana ?? String(idx)).toString();

    const getCargoInfo = (cargoKey) => cargosMap?.[cargoKey] || (CARGO_FALLBACK?.[lang] || CARGO_FALLBACK.pt);

    // FUNÇÃO ROBUSTA DE ORDENAÇÃO E EXTRAÇÃO DE DATAS
    const getSortTime = (sem) => {
        if (!sem) return 0;
        const dataStr = sem.dataInicio || sem.dataExata || sem.dataReuniao || sem.data;
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
                if (str.includes(meses[i])) { mesIndex = i % 12; break; }
            }
            const matchDia = str.match(/^(\d+)/);
            const dia = matchDia ? parseInt(matchDia[1], 10) : 1;

            const matchAno = str.match(/(20\d{2})/);
            let ano = matchAno ? parseInt(matchAno[1], 10) : new Date().getFullYear();

            // TRATAMENTO INTELIGENTE DE VIRADA DE ANO
            if (!matchAno) {
                const mesAtual = new Date().getMonth(); // 0 (Jan) a 11 (Dez)

                // Se estamos no fim do ano (Nov/Dez) e importamos o começo (Jan/Fev) -> É ano que vem
                if (mesAtual >= 10 && mesIndex <= 1) {
                    ano += 1;
                }
                // Se estamos no começo do ano (Jan/Fev) e mexemos no final (Nov/Dez) -> É do ano passado
                else if (mesAtual <= 1 && mesIndex >= 10) {
                    ano -= 1;
                }
            }

            return new Date(ano, mesIndex, dia, 12, 0, 0).getTime();
        }
        return 0;
    };

    // 🔥 FORMATADOR DE DATA USANDO A SUA LÓGICA OFICIAL
    const formatarDataPorExtenso = (sem) => {
        let dataBaseStr = null;

        const eventoConfig = config?.eventosAnuais?.find(e => e.dataInicio === sem?.dataInicio);
        const tipoEvento = eventoConfig?.tipo || sem?.evento || 'normal';
        const isVisita = tipoEvento === 'visita';

        if (eventoConfig?.dataInput && !isVisita) {
            dataBaseStr = eventoConfig.dataInput;
        } else {
            try {
                dataBaseStr = getMeetingDateISOFromSemana({
                    semanaStr: sem?.semana,
                    config,
                    isoFallback: sem?.dataReuniao || sem?.dataExata || sem?.dataInicio || sem?.data,
                    overrideDia: isVisita ? 'terça-feira' : null
                });
            } catch (e) {
                console.error("Erro ao tentar calcular a data da reunião:", e);
            }
        }

        if (!dataBaseStr) {
            dataBaseStr = sem?.dataReuniao || sem?.dataExata || sem?.dataInicio || sem?.data;
        }

        if (!dataBaseStr && sem?.semana) {
            const timeMs = getSortTime(sem);
            if (timeMs > 0) {
                const d = new Date(timeMs);
                dataBaseStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        }

        if (!dataBaseStr) return null;

        if (isVisita) {
            const [ano, mes, dia] = dataBaseStr.split('-').map(Number);
            const d = new Date(ano, mes - 1, dia, 12, 0, 0);
            if (d.getDay() !== 2) {
                const diff = 2 - d.getDay();
                d.setDate(d.getDate() + diff);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                dataBaseStr = `${y}-${m}-${day}`;
            }
        }

        try {
            const dataBase = new Date(dataBaseStr + 'T12:00:00');
            const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const dataFormatada = dataBase.toLocaleDateString(lang === 'es' ? 'es-ES' : 'pt-BR', opcoes);

            return dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
        } catch (e) {
            return dataBaseStr;
        }
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

    // ------------------------------------------------------------------------------------------
    // 🔥 LÓGICA DE LIMPEZA DE HISTÓRICO (Lixeira Inteligente) PARA O DESIGNAR
    // ------------------------------------------------------------------------------------------
    const limparHistoricoPorDatas = (datasBase) => {
        // Se a função não foi passada por props, ignoramos silenciosamente
        if (!onAlunosChange || typeof onAlunosChange !== 'function' || !Array.isArray(alunos) || alunos.length === 0) return;

        // Calcula os limites da(s) semana(s) selecionada(s)
        const ranges = datasBase.filter(Boolean).map(dataStr => {
            const [ano, mes, dia] = dataStr.split('-').map(Number);
            const dataBaseObj = new Date(ano, mes - 1, dia, 12, 0, 0);
            const diaSemana = dataBaseObj.getDay();
            const diffParaSegunda = diaSemana === 0 ? 6 : diaSemana - 1;

            const start = new Date(dataBaseObj);
            start.setDate(dataBaseObj.getDate() - diffParaSegunda);
            start.setHours(0, 0, 0, 0);

            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);

            return { start, end };
        });

        if (ranges.length === 0) return;

        let alterouAlgo = false;
        const novosAlunos = alunos.map(aluno => {
            if (!aluno.historico || !Array.isArray(aluno.historico)) return aluno;

            const historicoLimpo = aluno.historico.filter(h => {
                if (!h.data) return true; // Mantém históricos mal formatados (sem data)
                const [hAno, hMes, hDia] = h.data.split('-').map(Number);
                const hDate = new Date(hAno, hMes - 1, hDia, 12, 0, 0);

                // Se a data do histórico estiver dentro da semana que está sendo apagada:
                const caiEmAlgumRange = ranges.some(r => hDate >= r.start && hDate <= r.end);
                if (caiEmAlgumRange) alterouAlgo = true;

                return !caiEmAlgumRange; // false = Joga no lixo
            });

            return { ...aluno, historico: historicoLimpo };
        });

        // Só executa a alteração geral se realmente algum aluno perdeu um histórico
        if (alterouAlgo) {
            console.log("Limpando histórico atrelado à(s) semana(s) excluída(s)...");
            onAlunosChange(novosAlunos);
        }
    };

    // 🔥 EXCLUSÃO SUPER SEGURA DA SEMANA (AGORA LIMPA O HISTÓRICO TAMBÉM)
    const handleExcluirSemana = async (semanaKey) => {
        const atual = listaProgramacoes.find((s, idx) => getSemanaKey(s, idx) === semanaKey);
        if (!atual || !window.confirm(`Excluir a semana ${atual?.semana || semanaKey}? Isso também apagará os históricos dos alunos associados a esta semana.`)) return;

        let dataBase = atual.dataExata || atual.dataInicio || atual.dataReuniao || atual.data;
        if (!dataBase && atual.semana) {
            const timeMs = getSortTime(atual);
            if (timeMs > 0) {
                const d = new Date(timeMs);
                dataBase = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        }

        // 1º Passo: Limpa os registros do banco de dados de alunos (se a dataBase existir)
        if (dataBase) {
            limparHistoricoPorDatas([dataBase]);
        }

        // 2º Passo: Exclui a Programação em si
        if (onExcluirSemana && atual.id) {
            await onExcluirSemana(atual.id, dataBase);
        }

        setSlotAtivo(null);
        setModalEditarOpen(false);
        setParteEditCtx(null);

        setListaProgramacoesSafe(prev => prev.filter((s, idx) => getSemanaKey(s, idx) !== semanaKey));
        setSemanasSelecionadas(prev => { const next = { ...prev }; delete next[semanaKey]; return next; });
    };

    // 🔥 EXCLUSÃO EM MASSA DE ARQUIVADAS (AGORA LIMPA O HISTÓRICO TAMBÉM)
    const apagarArquivadas = async () => {
        const keys = getSelectedKeys();
        let alvo = [];
        if (keys.length > 0) {
            alvo = listaProgramacoes.filter((s, idx) => keys.includes(getSemanaKey(s, idx)) && s?.arquivada);
        } else {
            alvo = listaProgramacoes.filter(s => !!s?.arquivada);
        }

        if (alvo.length === 0) return alert('Nenhuma semana arquivada para apagar.');
        if (!window.confirm(`${TT.apagarArquivadas}? (${alvo.length})\nIsso também apagará os históricos dos alunos associados a estas semanas.`)) return;

        const datasParaLimpar = [];

        if (onExcluirSemana) {
            for (const item of alvo) {
                if (item.id) {
                    let dataBase = item.dataExata || item.dataInicio || item.dataReuniao || item.data;
                    if (!dataBase && item.semana) {
                        const timeMs = getSortTime(item);
                        if (timeMs > 0) {
                            const d = new Date(timeMs);
                            dataBase = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        }
                    }
                    if (dataBase) datasParaLimpar.push(dataBase);

                    await onExcluirSemana(item.id, dataBase);
                }
            }
        }

        // Executa a limpeza do histórico para todas as semanas afetadas
        if (datasParaLimpar.length > 0) {
            limparHistoricoPorDatas(datasParaLimpar);
        }

        const idsApagados = new Set(alvo.map(a => a.id));
        setListaProgramacoesSafe(prev => prev.filter(s => !idsApagados.has(s.id)));
        setSemanasSelecionadas({});
        userClearedWeeksRef.current = true;
    };
    // ------------------------------------------------------------------------------------------

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

    const atribuirAluno = (aluno, targetSlot = slotAtivo) => {
        if (!targetSlot) return;
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(Number.isInteger(targetSlot.semanaIndex) ? targetSlot.semanaIndex : semanaAtivaIndex);
        if (semanaRealIndex === -1) return;

        const sem = listaProgramacoes[semanaRealIndex];

        // 🔥 TRAVA: BLOQUEIA DESIGNAÇÃO SE FOR ASSEMBLEIA
        if (isSemanaAssembleia(sem, config)) {
            alert(`⛔ BLOQUEIO:\n\nA semana "${sem.semana}" está marcada como Assembleia ou Congresso.\nA atribuição de partes foi bloqueada.`);
            if (targetSlot === slotAtivo) setSlotAtivo(null);
            return;
        }

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

        if (targetSlot === slotAtivo) { setTimeout(() => setSlotAtivo(null), 10); }
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
            if (!atual || isSemanaAssembleia(atual, config)) return lista; // Trava
            const semana = { ...atual, partes: [...(atual.partes || [])] };
            const idx = semana.partes.findIndex(p => p.id === parteId);
            if (idx === -1) return lista;
            semana.partes[idx] = { ...semana.partes[idx], ...patch };
            lista[semanaRealIndex] = semana;
            return lista;
        });
    };

    const abrirModalEditarParte = (parte, semanaIndexFiltrado) => {
        const sem = listaFiltradaPorFlag[semanaIndexFiltrado];
        if (isSemanaAssembleia(sem, config)) {
            alert("Ações bloqueadas em semana de Assembleia.");
            return;
        }
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
        const sem = listaFiltradaPorFlag[semanaIndexFiltrado];
        if (isSemanaAssembleia(sem, config)) return; // Trava

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

    const renderSlotButton = ({ label, value, onClick, active, hint, emptyText, onSuggest, slotCtx }) => {
        const isEmpty = !value;
        const isHoveredByDrag = dragOverSlot && slotCtx && dragOverSlot.key === slotCtx.key && dragOverSlot.parteId === slotCtx.parteId && dragOverSlot.semanaIndex === slotCtx.semanaIndex;

        const currentColorClass = active
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
            : isEmpty
                ? 'border-red-200 bg-red-50 hover:border-red-300 border-dashed'
                : 'border-green-200 bg-green-50 hover:border-green-300 shadow-sm';

        const textColorClass = isEmpty ? 'text-red-400' : 'text-green-900';
        const labelColorClass = isEmpty ? 'text-red-300' : 'text-green-600';

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
                    className={`w-full py-2 px-3 rounded-lg border-2 transition-all text-left relative group focus:outline-none ${isHoveredByDrag ? "ring-2 ring-blue-500 bg-blue-100 border-blue-400 scale-[1.01]" : currentColorClass}`}
                    title={value ? TT.cliquePara : (emptyText || hint || TT.cliquePara)}
                >
                    <div className="flex flex-row items-center justify-between gap-2">
                        <span className={`text-[10px] font-black uppercase shrink-0 w-20 ${active ? 'text-blue-500' : labelColorClass}`}>{label}</span>
                        {value ? (
                            <p className={`font-bold text-[13px] truncate text-right flex-1 ${active ? 'text-blue-900' : textColorClass}`}>{value.nome}</p>
                        ) : (
                            <p className={`text-[11px] italic flex items-center justify-end gap-1 flex-1 ${active ? 'text-blue-400' : textColorClass}`}>
                                <UserPlus size={12} className={active ? 'opacity-100' : 'opacity-60'} /> {emptyText || hint || TT.cliquePara}
                            </p>
                        )}
                    </div>
                </button>
                {onSuggest && (
                    <button type="button" onClick={onSuggest} className="absolute top-1/2 -translate-y-1/2 right-1 z-10 p-1.5 rounded-full bg-yellow-100 text-yellow-600 opacity-0 group-hover/slot:opacity-100 transition-all hover:bg-yellow-200 shadow-sm focus:opacity-100" title={lang === 'es' ? "Sugerencia Inteligente" : "Sugestão Inteligente"}>
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

        const tituloNormalizado = (parte?.titulo || '').toLowerCase();
        const tipoNormalizado = (parte?.tipo || '').toLowerCase();

        const isDiscurso = tituloNormalizado.includes('discurso') || tipoNormalizado.includes('discurso');
        const requiresAjudante = secKey === 'ministerio' && !isDiscurso;

        return (
            <div key={parte.id} className="bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className={`${headerClass} px-3 py-1.5 flex justify-between items-start gap-3`}>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm leading-tight">{parte.titulo}</p>
                        {!!parte.descricao && (
                            <p className={`text-[10px] mt-0.5 line-clamp-2 leading-tight ${isLinhaInicialFinal(parte) ? 'text-gray-500' : 'text-white/70'}`}>
                                {parte.descricao}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        {typeof parte.tempo !== 'undefined' && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isLinhaInicialFinal(parte) ? "bg-white text-gray-700 border border-gray-300" : "bg-white/20 text-white"}`}>{parte.tempo} min</span>}
                        <button type="button" onClick={() => abrirModalEditarParte(parte, semanaIndexFiltrado)} className={`p-1 rounded border transition ${isLinhaInicialFinal(parte) ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50" : "border-white/20 bg-white/10 text-white hover:bg-white/20"}`} title={TT.editarParte}><Edit2 size={12} /></button>
                        <button type="button" onClick={() => handleExcluirParte(parte.id, semanaIndexFiltrado)} className={`p-1 rounded border transition ${isLinhaInicialFinal(parte) ? "border-gray-300 bg-white text-red-500 hover:bg-red-50" : "border-white/20 bg-white/10 text-white hover:bg-red-500 hover:border-red-500"}`} title={TT.excluirParte}><Trash2 size={12} /></button>
                    </div>
                </div>

                {isCantico ? (
                    <div className="p-2 text-[11px] text-center text-gray-400 italic bg-gray-50 border-t border-gray-100">
                        {lang === 'es' ? "Ninguna asignación necesaria" : "Nenhuma designação necessária"}
                    </div>
                ) : isLinhaInicialFinal(parte) ? (
                    <div className="p-2">
                        {renderSlotButton({
                            label: TT.oracao, value: parte.oracao || null,
                            onClick: () => setSlotAtivo({ key: 'oracao', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                            active: slotAtivo?.key === 'oracao' && slotAtivo?.parteId === parte.id,
                            onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'oracao', parteId: parte.id }); },
                            slotCtx: { key: 'oracao', parteId: parte.id, semanaIndex: semanaIndexFiltrado }
                        })}
                    </div>
                ) : isEstudoBiblicoCongregacao(parte) ? (
                    <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {renderSlotButton({ label: TT.dirigente, value: parte.dirigente, onClick: () => setSlotAtivo({ key: 'dirigente', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'dirigente' && slotAtivo?.parteId === parte.id, onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'dirigente', parteId: parte.id }); }, slotCtx: { key: 'dirigente', parteId: parte.id, semanaIndex: semanaIndexFiltrado } })}
                        {renderSlotButton({ label: TT.leitor, value: parte.leitor, onClick: () => setSlotAtivo({ key: 'leitor', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'leitor' && slotAtivo?.parteId === parte.id, onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'leitor', parteId: parte.id }); }, slotCtx: { key: 'leitor', parteId: parte.id, semanaIndex: semanaIndexFiltrado } })}
                    </div>
                ) : (
                    <div className={`p-2 grid gap-1.5 ${requiresAjudante ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                        {renderSlotButton({ label: TT.estudante, value: parte.estudante, onClick: () => setSlotAtivo({ key: 'estudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'estudante' && slotAtivo?.parteId === parte.id, onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'estudante', parteId: parte.id }); }, slotCtx: { key: 'estudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado } })}

                        {requiresAjudante && renderSlotButton({
                            label: TT.ajudante,
                            value: parte.ajudante,
                            onClick: () => setSlotAtivo({ key: 'ajudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                            active: slotAtivo?.key === 'ajudante' && slotAtivo?.parteId === parte.id,
                            emptyText: lang === 'es' ? 'Opcional' : 'Opcional',
                            onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'ajudante', parteId: parte.id }); },
                            slotCtx: { key: 'ajudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full min-h-screen bg-gray-50 relative font-sans text-gray-800">

            <DesignarHeader
                TT={TT}
                lang={lang}
                config={config}
                filtroSemanas={filtroSemanas}
                mudarFiltro={mudarFiltro}
                totalSelecionadas={totalSelecionadas}
                arquivarSelecionadas={arquivarSelecionadas}
                restaurarSelecionadas={restaurarSelecionadas}
                apagarArquivadas={apagarArquivadas}
                selecionarTodasVisiveis={selecionarTodasVisiveis}
                limparSelecaoVisiveis={limparSelecaoVisiveis}
                listaFiltradaPorFlag={listaFiltradaPorFlag}
                getSemanaKey={getSemanaKey}
                semanasSelecionadas={semanasSelecionadas}
                setSemanasSelecionadas={setSemanasSelecionadas}
                semanaAtivaIndex={semanaAtivaIndex}
                setSemanaAtivaIndex={setSemanaAtivaIndex}
                userClearedWeeksRef={userClearedWeeksRef}
            />

            <div className="w-full max-w-7xl mx-auto py-4">
                <div className="flex flex-col lg:flex-row gap-6 pb-20 items-start">

                    <NavegadorSemanas
                        listaSemanas={listaFiltradaPorFlag}
                        semanasSelecionadas={semanasSelecionadas}
                        semanaAtivaIndex={semanaAtivaIndex}
                        setSemanaAtivaIndex={setSemanaAtivaIndex}
                        getSemanaKey={getSemanaKey}
                        TT={TT}
                        lang={lang}
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
                                        <p className="text-sm font-medium">{lang === 'es' ? "Ninguna semana encontrada en este filtro." : "Nenhuma semana encontrada neste filtro."}</p>
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

                                        // 🔥 TRAVA VISUAL: Verifica se é assembleia/congresso!
                                        const isAssembly = isSemanaAssembleia(sem, config);

                                        // 🔥 FORMATADOR INTELIGENTE (Mesma técnica do RevisarEnviar)
                                        const displayDateExtenso = formatarDataPorExtenso(sem);

                                        const cardBgClass = isVisita ? 'bg-blue-50 border-blue-200'
                                            : isAssembly ? 'bg-yellow-50 border-yellow-200'
                                                : (idx % 2 === 0) ? 'bg-white border-gray-200 shadow-sm'
                                                    : 'bg-slate-50 border-slate-200';

                                        return (
                                            <div id={`semana-${key}`} key={key} className={`scroll-mt-40 rounded-2xl border p-2.5 space-y-2.5 transition-all ${cardBgClass}`}>

                                                {/* CABEÇALHO DA SEMANA */}
                                                <div className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-3 ${isVisita ? 'bg-white/80 border-blue-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                                                        <h3 className="font-black text-[15px] text-gray-800 truncate flex items-center gap-2">
                                                            <span>{sem?.semana || `${TT.semana} ${idx + 1}`}</span>
                                                            {isVisita && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-600 text-white border border-blue-700 flex items-center gap-1 uppercase tracking-wider animate-pulse"><Briefcase size={10} /> {TT.visitaSC}</span>}
                                                            {isAssembly && !tipoEvento.includes('congresso') && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-1"><Tent size={10} /> {TT.assembleia}</span>}
                                                            {isAssembly && tipoEvento.includes('congresso') && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1"><UsersRound size={10} /> {TT.congresso}</span>}
                                                        </h3>
                                                        <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                                            {displayDateExtenso ? (
                                                                <>
                                                                    <Calendar size={10} />
                                                                    <strong className={isVisita ? 'text-blue-700' : ''}>
                                                                        {displayDateExtenso}
                                                                    </strong>
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

                                                {/* 🔥 AVISO CHAMATIVO NA TELA (Substitui as partes) */}
                                                {isAssembly ? (
                                                    <div className="bg-white rounded-xl border-2 border-dashed border-yellow-300 p-6 text-center flex flex-col items-center justify-center gap-2">
                                                        <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
                                                            {tipoEvento.includes('congresso') ? <UsersRound size={32} /> : <Tent size={32} />}
                                                        </div>
                                                        <h3 className="text-lg font-bold text-gray-700">{TT.semanaDe} {tipoEvento.includes('congresso') ? TT.congresso : TT.assembleia}</h3>
                                                        <p className="text-xs text-gray-500 max-w-md">Não há reunião no meio de semana em épocas de evento especial. O quadro de anúncios não exibirá designações para esta data.</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* PRESIDENTE */}
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
                                                                className={`bg-white py-2 px-3 rounded-xl border-2 text-left w-full transition-all hover:border-blue-300 ${dragOverSlot?.key === 'presidente' && dragOverSlot?.semanaIndex === idx
                                                                    ? "ring-2 ring-blue-500 bg-blue-100 border-blue-400 scale-[1.01]"
                                                                    : slotAtivo?.key === 'presidente' && slotAtivo?.semanaIndex === idx
                                                                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                                                                        : sem.presidente
                                                                            ? "border-green-200 bg-green-50"
                                                                            : "border-red-200 bg-red-50 border-dashed"
                                                                    }`}
                                                            >
                                                                <div className="flex flex-row items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-1.5 w-24 shrink-0">
                                                                        <User size={14} className={sem.presidente ? 'text-green-500' : 'text-red-300'} />
                                                                        <span className={`text-[10px] font-black uppercase ${sem.presidente ? 'text-green-600' : 'text-red-300'}`}>{TT.presidente}</span>
                                                                    </div>
                                                                    {sem.presidente ? (
                                                                        <p className="font-bold text-[13px] text-green-900 truncate flex-1 text-right">{sem.presidente.nome}</p>
                                                                    ) : (
                                                                        <p className="text-[11px] text-red-400 italic flex items-center justify-end gap-1 flex-1"><UserPlus size={12} className="opacity-60" /> {TT.cliquePara}</p>
                                                                    )}
                                                                </div>
                                                            </button>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: idx, key: 'presidente' }); }} className="absolute top-1/2 -translate-y-1/2 right-1 z-10 p-1.5 rounded-full bg-yellow-100 text-yellow-600 opacity-0 group-hover/slot:opacity-100 transition-all hover:bg-yellow-200 shadow-sm focus:opacity-100"><Lightbulb size={12} /></button>
                                                        </div>

                                                        {/* PARTES INICIAIS E SECOES */}
                                                        <div className="space-y-2">{partesDaSemana.filter(isAbertura).map(p => renderParteCard(p, idx))}</div>

                                                        <div className="space-y-2.5">
                                                            {SECOES_ORDEM.map(secKey => {
                                                                const partesSecao = partesDaSemana.filter(p => normalizarSecao(p.secao) === secKey && !isAbertura(p) && !isEncerramento(p));
                                                                return (
                                                                    <div key={secKey} className="space-y-2">
                                                                        <div className={`rounded-lg overflow-hidden border ${SECOES_META[secKey].border} shadow-sm`}>
                                                                            <div className={`${SECOES_META[secKey].header} px-3 py-1.5 flex items-center justify-between`}>
                                                                                <span className="text-[10px] font-black tracking-widest uppercase">{SECOES_META[secKey].titulo}</span>
                                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${SECOES_META[secKey].pill}`}>{partesSecao.length} {lang === 'es' ? 'ítems' : 'itens'}</span>
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
                        TT={TT} buildSlotLabel={() => slotAtivo ? `${lang === 'es' ? 'Asignando' : 'Designando'} ${slotAtivo.key}` : TT.alunos}
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