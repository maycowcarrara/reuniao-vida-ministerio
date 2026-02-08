import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    Calendar, User,
    Search, SortAsc, SortDesc, FilterX, UsersRound, UserRound, Clock,
    AlertTriangle, StickyNote, Trash2, Edit2, X, Save, UserPlus,
    Archive, RotateCcw, Lightbulb, Briefcase, Tent, Info
} from 'lucide-react';

import ModalSugestao from './ModalSugestao'; // <--- INJEÇÃO 2: Importamos o Modal

// Fallback mínimo para evitar crash quando t/lang não vierem
const T_FALLBACK = {
    pt: {
        semana: "Semana",
        presidente: "Presidente",
        dirigente: "Dirigente",
        leitor: "Leitor",
        estudante: "Estudante",
        ajudante: "Ajudante",
        oracao: "Oração",
        cliquePara: "Clique para designar",
        selecioneCampo: "Selecione um campo para designar",
        designado: "Designando",
        alunos: "Alunos",
        registros: "registros",
        editarParte: "Editar parte",
        salvar: "Salvar",
        cancelar: "Cancelar",
        minutos: "Minutos",
        ordem: { nome: "Nome", dias: "Tempo" },
        info: { nunca: "Nunca" },

        // novos textos
        filtroAtivas: "Ativas",
        filtroArquivadas: "Arquivadas",
        filtroTodas: "Todas",
        arquivada: "Arquivada",
        arquivar: "Arquivar",
        restaurar: "Restaurar",
        apagarArquivadas: "Apagar arquivadas",
    },
    es: {
        semana: "Semana",
        presidente: "Presidente",
        dirigente: "Director",
        leitor: "Lector",
        estudante: "Estudiante",
        ajudante: "Ayudante",
        oracao: "Oración",
        cliquePara: "Haz clic para asignar",
        selecioneCampo: "Seleccione un campo para asignar",
        designado: "Asignando",
        alunos: "Estudiantes",
        registros: "registros",
        editarParte: "Editar parte",
        salvar: "Guardar",
        cancelar: "Cancelar",
        minutos: "Minutos",
        ordem: { nome: "Nombre", dias: "Tiempo" },
        info: { nunca: "Estreno" },

        filtroAtivas: "Activas",
        filtroArquivadas: "Archivadas",
        filtroTodas: "Todas",
        arquivada: "Archivada",
        arquivar: "Archivar",
        restaurar: "Restaurar",
        apagarArquivadas: "Borrar archivadas",
    }
};

// Fallback mínimo para evitar crash quando cargosMap não vier
const CARGO_FALLBACK = {
    pt: { pt: "Irmão", es: "Hermano", cor: "bg-gray-100 text-gray-700", gen: "M" },
    es: { pt: "Irmão", es: "Hermano", cor: "bg-gray-100 text-gray-700", gen: "M" }
};

const SECOES_ORDEM = ['tesouros', 'ministerio', 'vida'];

const SECOES_META = {
    tesouros: {
        titulo: 'TESOUROS DA PALAVRA DE DEUS',
        header: 'bg-teal-700 text-white',
        pill: 'bg-white/20 text-white',
        border: 'border-teal-200'
    },
    ministerio: {
        titulo: 'FAÇA SEU MELHOR NO MINISTÉRIO',
        header: 'bg-yellow-600 text-white',
        pill: 'bg-white/20 text-white',
        border: 'border-yellow-200'
    },
    vida: {
        titulo: 'NOSSA VIDA CRISTÃ',
        header: 'bg-red-700 text-white',
        pill: 'bg-white/20 text-white',
        border: 'border-red-200'
    }
};

const Designar = ({
    listaProgramacoes = [],
    setListaProgramacoes = () => { },
    alunos = [],
    cargosMap = {},
    lang = 'pt',
    t = {},
    onExcluirSemana
}) => {
    const [semanaAtivaIndex, setSemanaAtivaIndex] = useState(0);

    // filtro para mostrar apenas ativas / arquivadas / todas
    const [filtroSemanas, setFiltroSemanas] = useState('ativas'); // 'ativas' | 'arquivadas' | 'todas'

    // seleção múltipla de semanas (estilo RevisarEnviar)
    const getSemanaKey = (sem, idx) =>
        (sem?.id ?? sem?.dataReuniao ?? sem?.dataInicio ?? sem?.data ?? sem?.semana ?? String(idx)).toString();

    const [semanasSelecionadas, setSemanasSelecionadas] = useState({});
    const userClearedWeeksRef = useRef(false);

    // slotAtivo guarda contexto e a semana alvo (semanaIndex sempre no contexto do filtro atual)
    // { key: 'presidente'|'estudante'|'ajudante'|'oracao'|'dirigente'|'leitor', parteId?: any, semanaIndex?: number }
    const [slotAtivo, setSlotAtivo] = useState(null);

    const [termoBusca, setTermoBusca] = useState('');
    const [filtrosTiposAtivos, setFiltrosTiposAtivos] = useState([]);
    const [filtroGenero, setFiltroGenero] = useState('todos');
    const [ordenacaoChave, setOrdenacaoChave] = useState('dias');
    const [ordemCrescente, setOrdemCrescente] = useState(true);

    // Modal de edição de parte
    const [modalEditarOpen, setModalEditarOpen] = useState(false);
    const [parteEditCtx, setParteEditCtx] = useState(null); // { parteId, semanaIndex, valores }

    // --- INJEÇÃO 3: Estado para o Modal de Sugestão ---
    const [modalSugestao, setModalSugestao] = useState({
        aberto: false,
        semanaIndex: null, // index na lista filtrada
        parteId: null,
        key: null // 'estudante', 'ajudante', 'presidente', etc
    });

    // t "mesclado" (fallback + props)
    const TT = useMemo(() => {
        const base = T_FALLBACK?.[lang] || T_FALLBACK.pt;
        return {
            ...base,
            ...t,
            ordem: { ...(base?.ordem || {}), ...(t?.ordem || {}) },
            info: { ...(base?.info || {}), ...(t?.info || {}) },
        };
    }, [t, lang]);

    // ---------- Normalização + ordenação cronológica ----------
    const normalizar = (texto) =>
        texto
            ? texto.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            : '';

    const mesesPt = useMemo(() => ([
        'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ]), []);

    const pad2 = (n) => String(n).padStart(2, '0');

    const parseSemanaPt = (semanaStr, anoPadrao) => {
        const raw = normalizar(semanaStr || '');
        // ex: "8-14 de setembro - proverbios 30"
        const m = raw.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s*de\s*([a-z]+)\b/);
        if (!m) return null;

        const dIni = Number(m[1]);
        const dFim = Number(m[2]);
        const mesNome = m[3];
        const mesIdx = mesesPt.indexOf(mesNome);
        if (mesIdx === -1) return null;

        const y = Number(anoPadrao);
        if (!Number.isFinite(y) || y < 2000) return null;

        const dataInicio = `${y}-${pad2(mesIdx + 1)}-${pad2(dIni)}`;
        const dataFim = `${y}-${pad2(mesIdx + 1)}-${pad2(dFim)}`;

        // regra atual: reunião é na segunda (dataInicio)
        const dataReuniao = dataInicio;
        return { dataInicio, dataFim, dataReuniao };
    };

    const getSortTime = (sem) => {
        const iso = sem?.dataReuniao || sem?.dataInicio || sem?.data || null;
        if (!iso) return 0;
        const tt = new Date(iso).getTime();
        return Number.isFinite(tt) ? tt : 0;
    };

    const sortProgramacoes = (arr) => [...arr].sort((a, b) => {
        const da = getSortTime(a);
        const db = getSortTime(b);
        if (da !== db) return da - db;
        return (a?.semana || '').localeCompare(b?.semana || '');
    });

    const ensureSemanaDefaults = (sem, idx) => {
        const anoPadrao = new Date().getFullYear();
        const next = { ...(sem || {}) };

        if (typeof next.arquivada !== 'boolean') next.arquivada = false;
        if (typeof next.arquivadaEm === 'undefined') next.arquivadaEm = null;

        const parsed = (!next.dataReuniao || !next.dataInicio || !next.dataFim)
            ? parseSemanaPt(next?.semana, anoPadrao)
            : null;

        if (!next.dataInicio && parsed?.dataInicio) next.dataInicio = parsed.dataInicio;
        if (!next.dataFim && parsed?.dataFim) next.dataFim = parsed.dataFim;
        if (!next.dataReuniao && parsed?.dataReuniao) next.dataReuniao = parsed.dataReuniao;

        if (!next.id) {
            // id estável preferindo data + semana
            const base = next.dataReuniao || next.dataInicio || String(idx);
            const tail = normalizar(next.semana || '').slice(0, 40);
            next.id = `${base}|${tail || 'semana'}`;
        }

        if (!Array.isArray(next.partes)) next.partes = [];
        if (typeof next.presidente === 'undefined') next.presidente = null;
        if (typeof next.leitor === 'undefined') next.leitor = null;

        return next;
    };

    const normalizeAndSortProgramacoes = (arr) => {
        const lista = (Array.isArray(arr) ? arr : []).map((s, idx) => ensureSemanaDefaults(s, idx));
        return sortProgramacoes(lista);
    };

    const isSortedNow = (arr) => {
        const list = Array.isArray(arr) ? arr : [];
        for (let i = 1; i < list.length; i++) {
            if (getSortTime(list[i]) < getSortTime(list[i - 1])) return false;
        }
        return true;
    };

    // normaliza 1x (e quando detectar necessidade) para garantir ordem cronológica real no storage
    useEffect(() => {
        if (!Array.isArray(listaProgramacoes) || listaProgramacoes.length === 0) return;

        const needs =
            !isSortedNow(listaProgramacoes) ||
            listaProgramacoes.some((s, idx) => {
                if (!s) return true;
                if (typeof s.arquivada !== 'boolean') return true;
                if (!s.id) return true;
                if (!s.dataReuniao || !s.dataInicio || !s.dataFim) {
                    return !!parseSemanaPt(s?.semana, new Date().getFullYear());
                }
                return false;
            });

        if (!needs) return;

        setListaProgramacoes(prev => normalizeAndSortProgramacoes(prev));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listaProgramacoes]);

    const setListaProgramacoesSafe = (updater) => {
        setListaProgramacoes(prev => {
            const base = typeof updater === 'function' ? updater(prev) : updater;
            return normalizeAndSortProgramacoes(base);
        });
    };

    // ---------- filtros de semanas ----------
    const listaFiltradaPorFlag = useMemo(() => {
        const lista = Array.isArray(listaProgramacoes) ? listaProgramacoes : [];
        if (filtroSemanas === 'todas') return lista;
        if (filtroSemanas === 'arquivadas') return lista.filter(s => !!s?.arquivada);
        return lista.filter(s => !s?.arquivada);
    }, [listaProgramacoes, filtroSemanas]);

    // clamp do índice (no contexto do filtro atual)
    useEffect(() => {
        setSemanaAtivaIndex(prev => {
            const len = Array.isArray(listaFiltradaPorFlag) ? listaFiltradaPorFlag.length : 0;
            if (len === 0) return 0;
            return Math.min(prev, len - 1);
        });
    }, [listaFiltradaPorFlag?.length]);

    // ---------- helpers de mapeamento (filtrado -> real) ----------
    const getSemanaKeyByFilteredIndex = (idxFiltrado) => {
        const sem = listaFiltradaPorFlag?.[idxFiltrado];
        if (!sem) return null;
        return getSemanaKey(sem, idxFiltrado);
    };

    const getSemanaRealIndexByKey = (semanaKey) => {
        const lista = Array.isArray(listaProgramacoes) ? listaProgramacoes : [];
        return lista.findIndex((s, idx) => getSemanaKey(s, idx) === semanaKey);
    };

    const getSemanaRealIndexFromFilteredIndex = (idxFiltrado) => {
        const k = getSemanaKeyByFilteredIndex(idxFiltrado);
        if (!k) return -1;
        return getSemanaRealIndexByKey(k);
    };

    const getSemanaIndexContexto = () => {
        if (Number.isInteger(slotAtivo?.semanaIndex)) return slotAtivo.semanaIndex;
        return semanaAtivaIndex;
    };

    // ---------- semana foco (para sidebar/contagens; aqui é só referência, não escrever diretamente) ----------
    const semanaAtivaFiltrada = listaFiltradaPorFlag?.[semanaAtivaIndex] || null;
    const partesSemanaAtiva = Array.isArray(semanaAtivaFiltrada?.partes) ? semanaAtivaFiltrada.partes : [];

    // fechar modal/slot no ESC
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (modalEditarOpen) { setModalEditarOpen(false); setParteEditCtx(null); }
                if (slotAtivo) setSlotAtivo(null);
                // Fecha sugestão também
                if (modalSugestao.aberto) setModalSugestao(prev => ({ ...prev, aberto: false }));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modalEditarOpen, slotAtivo, modalSugestao.aberto]);

    // auto-selecionar semanas visíveis (uma vez), respeitando "Limpar"
    useEffect(() => {
        if (!Array.isArray(listaFiltradaPorFlag) || listaFiltradaPorFlag.length === 0) return;

        // remove chaves órfãs quando lista muda
        setSemanasSelecionadas((prev) => {
            const next = {};
            const keysVisiveis = new Set();
            listaFiltradaPorFlag.forEach((sem, idx) => {
                keysVisiveis.add(getSemanaKey(sem, idx));
            });

            // Mantém apenas o que ainda existe
            Object.keys(prev || {}).forEach(k => {
                if (keysVisiveis.has(k) && prev[k]) {
                    next[k] = true;
                }
            });
            return next;
        });

        const hasAny = Object.values(semanasSelecionadas).some(Boolean);
        if (userClearedWeeksRef.current || hasAny) return;

        const next = {};
        listaFiltradaPorFlag.forEach((sem, idx) => { next[getSemanaKey(sem, idx)] = true; });
        setSemanasSelecionadas(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listaFiltradaPorFlag]);

    const semanasParaExibir = useMemo(() => {
        if (!Array.isArray(listaFiltradaPorFlag)) return [];
        return listaFiltradaPorFlag
            .map((sem, idx) => ({ sem, idx, key: getSemanaKey(sem, idx) }))
            .filter(({ key }) => !!semanasSelecionadas[key]);
    }, [listaFiltradaPorFlag, semanasSelecionadas]);

    const normalizarSecao = (secao) => {
        const s = (secao ?? '').toString().toLowerCase();
        if (s.includes('tesou')) return 'tesouros';
        if (s.includes('minist')) return 'ministerio';
        return 'vida';
    };

    const tipoLower = (parte) => (parte?.tipo ?? parte?.type ?? '').toString().toLowerCase();

    // abertura/encerramento (orações)
    const isAbertura = (parte) => {
        const raw = `${tipoLower(parte)} ${(parte?.titulo ?? '').toString().toLowerCase()}`.trim();
        return raw.includes('oracao') && (raw.includes('inicial') || raw.includes('inicio') || raw.includes('abertura'));
    };
    const isEncerramento = (parte) => {
        const raw = `${tipoLower(parte)} ${(parte?.titulo ?? '').toString().toLowerCase()}`.trim();
        return raw.includes('oracao') && (raw.includes('final') || raw.includes('encerr'));
    };

    // regra de negócio: linha inicial/final = blocos mesclados fixos
    const isLinhaInicialFinal = (parte) => isAbertura(parte) || isEncerramento(parte);

    const isEstudoBiblicoCongregacao = (parte) => {
        const tipo = tipoLower(parte);
        if (tipo.includes('estudo')) return true;
        const tituloN = normalizar(parte?.titulo ?? '');
        return (
            tituloN.includes('estudo biblico de congregacao') ||
            tituloN.includes('estudo biblico de congrega') ||
            tituloN.includes('estudio biblico de la congregacion') ||
            tituloN.includes('estudio biblico de congregacion')
        );
    };

    const getCargoInfo = (cargoKey) => {
        const m = cargosMap?.[cargoKey];
        if (m) return m;
        return CARGO_FALLBACK?.[lang] || CARGO_FALLBACK.pt;
    };

    const getHeaderParteClass = (parte) => {
        if (isLinhaInicialFinal(parte)) return 'bg-gray-200 text-gray-800';
        const sec = normalizarSecao(parte?.secao);
        return (SECOES_META?.[sec]?.header) || SECOES_META.vida.header;
    };

    const getTempoExibicao = (parte) => {
        if (isLinhaInicialFinal(parte)) return 5; // regra atual do sistema
        const n = Number(parte?.tempo);
        if (Number.isFinite(n) && n > 0) return n;
        return parte?.tempo;
    };

    // histórico helpers (dias desde última designação)
    const getUltimoRegistro = (aluno) => {
        if (!aluno?.historico || aluno.historico.length === 0) return { data: null, parte: null, ajudante: null };
        const ordenado = [...aluno.historico].sort((a, b) => {
            const dateA = a?.data ? new Date(a.data).getTime() : 0;
            const dateB = b?.data ? new Date(b.data).getTime() : 0;
            return dateB - dateA;
        });
        return { data: ordenado[0]?.data, parte: ordenado[0]?.parte ?? null, ajudante: ordenado[0]?.ajudante ?? null };
    };

    const calcularDiasDesdeUltimaParte = (aluno) => {
        const ultimo = getUltimoRegistro(aluno);
        if (!ultimo?.data) return null;
        const ultimaData = new Date(ultimo.data);
        const hoje = new Date();
        const diff = hoje.getTime() - ultimaData.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const isAlunoDuplicadoBySemanaKey = (alunoId, semanaKey) => {
        const realIndex = getSemanaRealIndexByKey(semanaKey);
        const sem = (Array.isArray(listaProgramacoes) ? listaProgramacoes : [])?.[realIndex];
        if (!sem) return false;

        if (sem?.presidente?.id === alunoId) return true;

        const partes = Array.isArray(sem?.partes) ? sem.partes : [];
        return partes.some(p =>
            p?.estudante?.id === alunoId ||
            p?.ajudante?.id === alunoId ||
            p?.oracao?.id === alunoId ||
            p?.dirigente?.id === alunoId ||
            p?.leitor?.id === alunoId
        );
    };

    const handleMudarGenero = (novoGen) => {
        setFiltroGenero(novoGen);
        setFiltrosTiposAtivos([]);
    };

    const toggleFiltroTipo = (key) => {
        setFiltrosTiposAtivos(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
    };

    // ---------- Ações semanas ----------
    const handleExcluirSemana = async (semanaKey) => {
        const atual = (Array.isArray(listaProgramacoes) ? listaProgramacoes : [])
            .find((s, idx) => getSemanaKey(s, idx) === semanaKey);

        if (!atual) return;

        const ok = window.confirm(`Excluir a semana ${atual?.semana || semanaKey}?`);
        if (!ok) return;

        if (onExcluirSemana && atual.id) {
            try {
                await onExcluirSemana(atual.id);
            } catch (error) {
                alert("Erro ao excluir do banco de dados.");
                console.error(error);
                return; // Para aqui se der erro no banco
            }
        }

        setSlotAtivo(null);
        setModalEditarOpen(false);
        setParteEditCtx(null);

        // índice no filtro atual (para ajustar foco)
        const idxFiltradoExcluir = (Array.isArray(listaFiltradaPorFlag) ? listaFiltradaPorFlag : [])
            .findIndex((s, idx) => getSemanaKey(s, idx) === semanaKey);

        setListaProgramacoesSafe(prev => {
            const lista = Array.isArray(prev) ? prev : [];
            return lista.filter((s, idx) => getSemanaKey(s, idx) !== semanaKey);
        });

        setSemanasSelecionadas(prev => {
            const next = { ...(prev || {}) };
            delete next[semanaKey];
            return next;
        });

        setSemanaAtivaIndex(prev => {
            if (idxFiltradoExcluir === -1) return prev;
            if (prev > idxFiltradoExcluir) return prev - 1;
            if (prev === idxFiltradoExcluir) return Math.max(0, prev - 1);
            return prev;
        });
    };

    const toggleArquivadaSemana = (semanaKey, arquivar) => {
        const alvo = (Array.isArray(listaProgramacoes) ? listaProgramacoes : [])
            .find((s, idx) => getSemanaKey(s, idx) === semanaKey);

        if (!alvo) return;

        const msg = arquivar
            ? `Arquivar a semana ${alvo?.semana || semanaKey}?`
            : `Restaurar a semana ${alvo?.semana || semanaKey}?`;

        const ok = window.confirm(msg);
        if (!ok) return;

        setListaProgramacoesSafe(prev => {
            const lista = Array.isArray(prev) ? prev : [];
            return lista.map((s, idx) => {
                const k = getSemanaKey(s, idx);
                if (k !== semanaKey) return s;

                if (arquivar) {
                    return { ...s, arquivada: true, arquivadaEm: new Date().toISOString() };
                }
                return { ...s, arquivada: false, arquivadaEm: null };
            });
        });
    };

    const getSelectedKeys = () =>
        Object.entries(semanasSelecionadas || {}).filter(([, v]) => !!v).map(([k]) => k);

    const arquivarSelecionadas = () => {
        const keys = getSelectedKeys();
        if (keys.length === 0) return;

        const ok = window.confirm(`Arquivar ${keys.length} semana(s) selecionada(s)?`);
        if (!ok) return;

        setListaProgramacoesSafe(prev => {
            const lista = Array.isArray(prev) ? prev : [];
            return lista.map((s, idx) => {
                const k = getSemanaKey(s, idx);
                if (!keys.includes(k)) return s;
                return { ...s, arquivada: true, arquivadaEm: new Date().toISOString() };
            });
        });
    };

    const restaurarSelecionadas = () => {
        const keys = getSelectedKeys();
        if (keys.length === 0) return;

        const ok = window.confirm(`Restaurar ${keys.length} semana(s) selecionada(s)?`);
        if (!ok) return;

        setListaProgramacoesSafe(prev => {
            const lista = Array.isArray(prev) ? prev : [];
            return lista.map((s, idx) => {
                const k = getSemanaKey(s, idx);
                if (!keys.includes(k)) return s;
                return { ...s, arquivada: false, arquivadaEm: null };
            });
        });
    };

    const apagarArquivadas = async () => {
        const keys = getSelectedKeys();

        // --- CENÁRIO 1: Apagar seleção específica (se houver checkbox marcado) ---
        if (keys.length > 0) {
            const ok = window.confirm(`Apagar ${keys.length} semana(s) selecionada(s)?`);
            if (!ok) return;

            // 1. Identificar quais itens serão apagados para deletar do Banco
            const itensParaDeletar = (Array.isArray(listaProgramacoes) ? listaProgramacoes : [])
                .filter((s, idx) => {
                    const k = getSemanaKey(s, idx);
                    // Deleta se estiver selecionado E estiver arquivado
                    return keys.includes(k) && s?.arquivada;
                });

            // 2. Deletar do Banco de Dados (Firebase)
            if (onExcluirSemana) {
                for (const item of itensParaDeletar) {
                    if (item.id) await onExcluirSemana(item.id);
                }
            }

            // 3. Atualizar Visual (Estado Local)
            setListaProgramacoesSafe(prev => {
                const lista = Array.isArray(prev) ? prev : [];
                return lista.filter((s, idx) => {
                    const k = getSemanaKey(s, idx);
                    // Mantém se NÃO estiver na lista de exclusão
                    if (!keys.includes(k)) return true;
                    return !s?.arquivada;
                });
            });

            setSemanasSelecionadas({});
            userClearedWeeksRef.current = true;
            return;
        }

        // --- CENÁRIO 2: Apagar TODAS as arquivadas (sem seleção) ---
        const arquivadasParaDeletar = (Array.isArray(listaProgramacoes) ? listaProgramacoes : [])
            .filter(s => !!s?.arquivada);

        const qtdArquivadas = arquivadasParaDeletar.length;

        if (qtdArquivadas === 0) {
            window.alert('Nenhuma semana arquivada para apagar.');
            return;
        }

        const ok = window.confirm(`Apagar TODAS as ${qtdArquivadas} semana(s) arquivada(s)?`);
        if (!ok) return;

        // 1. Deletar do Banco de Dados (Firebase)
        if (onExcluirSemana) {
            for (const item of arquivadasParaDeletar) {
                if (item.id) await onExcluirSemana(item.id);
            }
        }

        // 2. Atualizar Visual (Estado Local)
        setListaProgramacoesSafe(prev => {
            const lista = Array.isArray(prev) ? prev : [];
            return lista.filter(s => !s?.arquivada);
        });

        setSemanasSelecionadas({});
        userClearedWeeksRef.current = true;
    };

    // ---------- FILTRO + ORDENACAO ALUNOS (Com busca no histórico) ----------
    const alunosFiltrados = useMemo(() => {
        const buscaNorm = termoBusca ? normalizar(termoBusca) : '';
        const filtrados = (Array.isArray(alunos) ? alunos : [])
            .filter(aluno => {
                const cargoKey = aluno?.tipo;
                const cargoInfo = getCargoInfo(cargoKey);
                const genero = cargoInfo?.gen;

                if (filtroGenero !== 'todos' && genero !== filtroGenero) return false;

                if (buscaNorm) {
                    const nomeNorm = normalizar(aluno?.nome ?? '');
                    const cargoNorm = normalizar(cargoInfo?.[lang] || cargoInfo?.pt || cargoInfo?.es || cargoKey || '');
                    const obsNorm = normalizar(aluno?.observacoes ?? '');

                    // Adicionado: Busca no histórico
                    const histNorm = (Array.isArray(aluno?.historico) ? aluno.historico : [])
                        .map(h => normalizar(h?.parte ?? ''))
                        .join(' ');

                    const passouBusca =
                        nomeNorm.includes(buscaNorm) ||
                        cargoNorm.includes(buscaNorm) ||
                        obsNorm.includes(buscaNorm) ||
                        histNorm.includes(buscaNorm);

                    if (!passouBusca) return false;
                }

                if (filtrosTiposAtivos.length > 0 && !filtrosTiposAtivos.includes(cargoKey)) return false;
                if (cargoKey === 'desab') return false;

                return true;
            })
            .sort((a, b) => {
                let res = 0;
                if (ordenacaoChave === 'nome') {
                    res = (a?.nome ?? '').localeCompare(b?.nome ?? '');
                } else {
                    const dias1 = calcularDiasDesdeUltimaParte(a) ?? 99999;
                    const dias2 = calcularDiasDesdeUltimaParte(b) ?? 99999;
                    res = dias1 - dias2;
                }
                return ordemCrescente ? res : -res;
            });

        return filtrados;
    }, [alunos, cargosMap, filtroGenero, termoBusca, filtrosTiposAtivos, ordenacaoChave, ordemCrescente, lang]);

    // Atualiza parte na semana REAL (recebe semanaRealIndex)
    const atualizarParteNaSemanaRealIndex = (semanaRealIndex, parteId, patch) => {
        setListaProgramacoesSafe(prev => {
            const lista = Array.isArray(prev) ? prev : [];
            const atual = lista[semanaRealIndex];
            if (!atual) return lista;

            const novaLista = [...lista];
            const semana = { ...atual, partes: Array.isArray(atual.partes) ? [...atual.partes] : [] };
            const idx = semana.partes.findIndex(p => p.id === parteId);
            if (idx === -1) return lista;

            semana.partes[idx] = { ...semana.partes[idx], ...patch };
            novaLista[semanaRealIndex] = semana;
            return novaLista;
        });
    };

    const atribuirAluno = (aluno) => {
        if (!slotAtivo) return;

        const semanaIndexFiltrado = getSemanaIndexContexto();
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(semanaIndexFiltrado);
        if (semanaRealIndex === -1) return;

        const sem = (Array.isArray(listaProgramacoes) ? listaProgramacoes : [])?.[semanaRealIndex];
        const partesDaSemana = Array.isArray(sem?.partes) ? sem.partes : [];

        // validações de regra
        if (slotAtivo.key === 'ajudante') {
            const parte = partesDaSemana.find(p => p.id === slotAtivo.parteId);
            if (!parte) return;
            if (normalizarSecao(parte.secao) !== 'ministerio') return;
        }

        if (slotAtivo.key === 'estudante') {
            const parte = partesDaSemana.find(p => p.id === slotAtivo.parteId);
            if (!parte) return;
            if (isLinhaInicialFinal(parte) || isEstudoBiblicoCongregacao(parte)) return;
        }

        if (slotAtivo.key === 'dirigente' || slotAtivo.key === 'leitor') {
            const parte = partesDaSemana.find(p => p.id === slotAtivo.parteId);
            if (!parte) return;
            if (!isEstudoBiblicoCongregacao(parte)) return;
        }

        if (slotAtivo.key === 'oracao') {
            const parte = partesDaSemana.find(p => p.id === slotAtivo.parteId);
            if (!parte) return;
            if (!isLinhaInicialFinal(parte)) return;
        }

        setListaProgramacoesSafe(prev => {
            const lista = Array.isArray(prev) ? prev : [];
            const atual = lista[semanaRealIndex];
            if (!atual) return lista;

            const novaLista = [...lista];
            const semana = { ...atual, partes: Array.isArray(atual.partes) ? [...atual.partes] : [] };

            if (slotAtivo.key === 'presidente') {
                semana.presidente = aluno;
            } else {
                const idxParte = semana.partes.findIndex(p => p.id === slotAtivo.parteId);
                if (idxParte !== -1) {
                    semana.partes[idxParte] = { ...semana.partes[idxParte], [slotAtivo.key]: aluno };
                }
            }

            novaLista[semanaRealIndex] = semana;
            return novaLista;
        });

        setSlotAtivo(null);
    };

    // --- INJEÇÃO 4: Lógica para Sugestão Automática ---
    const abrirSugestao = (e, semanaIndex, key, parteId = null) => {
        e.stopPropagation(); // Impede que o slot seja ativado ao clicar na lâmpada
        setModalSugestao({ aberto: true, semanaIndex, key, parteId });
    };

    const aplicarSugestao = (aluno) => {
        // Usa a lógica de atualização segura
        const { semanaIndex, key, parteId } = modalSugestao;
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(semanaIndex);
        if (semanaRealIndex === -1) return;

        setListaProgramacoesSafe(prev => {
            const lista = Array.isArray(prev) ? prev : [];
            const atual = lista[semanaRealIndex];
            if (!atual) return lista;

            const novaLista = [...lista];
            const semana = { ...atual, partes: Array.isArray(atual.partes) ? [...atual.partes] : [] };

            if (key === 'presidente') {
                semana.presidente = aluno;
            } else {
                const idxParte = semana.partes.findIndex(p => p.id === parteId);
                if (idxParte !== -1) {
                    semana.partes[idxParte] = { ...semana.partes[idxParte], [key]: aluno };
                }
            }
            novaLista[semanaRealIndex] = semana;
            return novaLista;
        });

        setModalSugestao({ ...modalSugestao, aberto: false });
    };

    // Helper para o modal saber qual parte estamos editando
    const getParteFocoModal = () => {
        if (!modalSugestao.aberto) return null;
        const sem = listaFiltradaPorFlag?.[modalSugestao.semanaIndex];
        if (!sem) return null;
        if (modalSugestao.key === 'presidente') return { titulo: TT.presidente };
        return sem.partes?.find(p => p.id === modalSugestao.parteId) || null;
    };
    // ----------------------------------------------------

    const renderTituloSecao = (secKey, partesDaSemana) => {
        const meta = SECOES_META?.[secKey] || SECOES_META.vida;
        const count = (Array.isArray(partesDaSemana) ? partesDaSemana : [])
            .filter(p => normalizarSecao(p?.secao) === secKey && !isAbertura(p) && !isEncerramento(p))
            .length;

        return (
            <div className={`rounded-xl overflow-hidden border ${meta.border} shadow-sm`}>
                <div className={`${meta.header} px-4 py-2 flex items-center justify-between`}>
                    <span className="text-xs font-black tracking-widest uppercase">{meta.titulo}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${meta.pill}`}>{count} itens</span>
                </div>
            </div>
        );
    };

    const abrirModalEditarParte = (parte, semanaIndexFiltrado) => {
        const valores = {
            titulo: (parte?.titulo ?? '').toString(),
            descricao: (parte?.descricao ?? '').toString(),
            tempo: String(parte?.tempo ?? ''),
        };
        setParteEditCtx({ parteId: parte.id, semanaIndex: semanaIndexFiltrado, valores });
        setModalEditarOpen(true);
    };

    const salvarEdicaoParte = () => {
        if (!parteEditCtx?.parteId) return;

        const semanaIndexFiltrado = Number.isInteger(parteEditCtx?.semanaIndex) ? parteEditCtx.semanaIndex : semanaAtivaIndex;
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(semanaIndexFiltrado);
        if (semanaRealIndex === -1) return;

        const sem = (Array.isArray(listaProgramacoes) ? listaProgramacoes : [])?.[semanaRealIndex];
        const partesDaSemana = Array.isArray(sem?.partes) ? sem.partes : [];
        const parte = partesDaSemana.find(p => p.id === parteEditCtx.parteId);
        if (!parte) return;

        const travarTempo = isLinhaInicialFinal(parte);

        const patch = {
            titulo: parteEditCtx.valores.titulo,
            descricao: parteEditCtx.valores.descricao,
            ...(travarTempo ? {} : { tempo: parteEditCtx.valores.tempo }),
        };

        atualizarParteNaSemanaRealIndex(semanaRealIndex, parteEditCtx.parteId, patch);

        setModalEditarOpen(false);
        setParteEditCtx(null);
    };

    const buildSlotLabel = () => {
        if (!slotAtivo) return TT.alunos;
        const map = {
            presidente: TT.presidente,
            oracao: TT.oracao,
            dirigente: TT.dirigente,
            leitor: TT.leitor,
            estudante: TT.estudante,
            ajudante: TT.ajudante,
        };
        return `${TT.designado} ${map?.[slotAtivo.key] || slotAtivo.key}`;
    };

    const slotKeyMatch = (key, parteId, semanaIndex) =>
        slotAtivo?.key === key &&
        (typeof parteId === 'undefined' ? true : slotAtivo?.parteId === parteId) &&
        (typeof semanaIndex === 'undefined' ? true : slotAtivo?.semanaIndex === semanaIndex);

    const renderSlotButton = ({
        label,
        value,
        onClick,
        active,
        hint,
        emptyText,
        activeClass,
        idleClass,
        barActiveClass,
        onSuggest // <--- Aceita nova prop
    }) => {
        const isEmpty = !value;
        return (
            <div className="relative w-full group/slot"> {/* Wrapper para posicionar o botão da lâmpada */}
                <button
                    type="button"
                    onClick={onClick}
                    className={[
                        "w-full p-3 rounded-lg border-2 transition-all text-left relative group focus:outline-none",
                        isEmpty ? "border-dashed" : "",
                        active ? activeClass : idleClass
                    ].join(" ")}
                    title={value ? "Clique para trocar" : (emptyText || hint || TT.cliquePara)}
                >
                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">{label}</span>
                    {value ? (
                        <p className="font-bold text-sm text-gray-800 truncate">{value.nome}</p>
                    ) : (
                        <p className="text-xs text-gray-400 italic flex items-center gap-1">
                            <UserPlus size={14} className="opacity-60" />
                            {emptyText || hint || TT.cliquePara}
                        </p>
                    )}
                    <div
                        className={[
                            "absolute inset-y-0 right-0 w-1 rounded-r-lg transition-opacity",
                            active ? barActiveClass : "bg-transparent"
                        ].join(" ")}
                    />
                </button>

                {/* BOTÃO DA LÂMPADA (Sugestão) */}
                {onSuggest && (
                    <button
                        type="button"
                        onClick={onSuggest}
                        className="absolute top-1 right-1 z-10 p-1.5 rounded-full bg-yellow-100 text-yellow-600 opacity-0 group-hover/slot:opacity-100 transition-all hover:bg-yellow-200 shadow-sm focus:opacity-100"
                        title="Sugestão Inteligente"
                    >
                        <Lightbulb size={14} />
                    </button>
                )}
            </div>
        );
    };

    const renderParteCard = (parte, semanaIndexFiltrado) => {
        const headerClass = getHeaderParteClass(parte);
        const ebc = isEstudoBiblicoCongregacao(parte);
        const secKey = normalizarSecao(parte?.secao);
        const permiteAjudante = secKey === 'ministerio';
        const tempoExib = getTempoExibicao(parte);

        return (
            <div key={parte.id} className="bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className={`${headerClass} px-4 py-2 flex justify-between items-start gap-3`}>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm break-words">{parte.titulo}</p>
                        {!!parte.descricao && (
                            <p className={`text-xs mt-1 line-clamp-1 ${isLinhaInicialFinal(parte) ? 'text-gray-600 opacity-80' : ''}`}>
                                {parte.descricao}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => abrirModalEditarParte(parte, semanaIndexFiltrado)}
                            className={[
                                "p-1.5 rounded-lg border transition",
                                isLinhaInicialFinal(parte)
                                    ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                    : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                            ].join(" ")}
                            title={TT.editarParte}
                        >
                            <Edit2 size={14} />
                        </button>

                        {typeof tempoExib !== 'undefined' && (
                            <span className={[
                                "px-2 py-1 rounded text-xs font-bold",
                                isLinhaInicialFinal(parte)
                                    ? "bg-white text-gray-700 border border-gray-300"
                                    : "bg-white/20 text-white"
                            ].join(" ")}>
                                {tempoExib} min
                            </span>
                        )}
                    </div>
                </div>

                {/* Linha inicial/final: só oração */}
                {isLinhaInicialFinal(parte) ? (
                    <div className="p-3">
                        <div className="grid grid-cols-1 gap-2">
                            {renderSlotButton({
                                label: TT.oracao,
                                value: parte.oracao || null,
                                onClick: () => setSlotAtivo({ key: 'oracao', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                                active: slotKeyMatch('oracao', parte.id, semanaIndexFiltrado),
                                hint: TT.cliquePara,
                                activeClass: 'border-blue-500 bg-blue-50 ring-2 ring-blue-100',
                                idleClass: 'border-gray-200 hover:border-blue-300',
                                barActiveClass: 'bg-blue-500',
                                onSuggest: (e) => abrirSugestao(e, semanaIndexFiltrado, 'oracao', parte.id)
                            })}
                        </div>
                    </div>
                ) : ebc ? (
                    <div className="p-3 grid grid-cols-2 gap-2">
                        {renderSlotButton({
                            label: TT.dirigente,
                            value: parte.dirigente || null,
                            onClick: () => setSlotAtivo({ key: 'dirigente', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                            active: slotKeyMatch('dirigente', parte.id, semanaIndexFiltrado),
                            hint: TT.cliquePara,
                            activeClass: 'border-purple-500 bg-purple-50 ring-2 ring-purple-100',
                            idleClass: 'border-gray-200 hover:border-purple-300',
                            barActiveClass: 'bg-purple-500',
                            onSuggest: (e) => abrirSugestao(e, semanaIndexFiltrado, 'dirigente', parte.id)
                        })}

                        {renderSlotButton({
                            label: TT.leitor,
                            value: parte.leitor || null,
                            onClick: () => setSlotAtivo({ key: 'leitor', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                            active: slotKeyMatch('leitor', parte.id, semanaIndexFiltrado),
                            hint: TT.cliquePara,
                            activeClass: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100',
                            idleClass: 'border-gray-200 hover:border-indigo-300',
                            barActiveClass: 'bg-indigo-500',
                            onSuggest: (e) => abrirSugestao(e, semanaIndexFiltrado, 'leitor', parte.id)
                        })}
                    </div>
                ) : (
                    <div className={`p-3 grid gap-2 ${permiteAjudante ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {renderSlotButton({
                            label: TT.estudante,
                            value: parte.estudante || null,
                            onClick: () => setSlotAtivo({ key: 'estudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                            active: slotKeyMatch('estudante', parte.id, semanaIndexFiltrado),
                            hint: TT.cliquePara,
                            activeClass: 'border-green-500 bg-green-50 ring-2 ring-green-100',
                            idleClass: 'border-gray-200 hover:border-green-300',
                            barActiveClass: 'bg-green-500',
                            onSuggest: (e) => abrirSugestao(e, semanaIndexFiltrado, 'estudante', parte.id)
                        })}

                        {permiteAjudante && renderSlotButton({
                            label: TT.ajudante,
                            value: parte.ajudante || null,
                            onClick: () => setSlotAtivo({ key: 'ajudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                            active: slotKeyMatch('ajudante', parte.id, semanaIndexFiltrado),
                            emptyText: 'Opcional',
                            activeClass: 'border-blue-500 bg-blue-50 ring-2 ring-blue-100',
                            idleClass: 'border-gray-200 hover:border-blue-300',
                            barActiveClass: 'bg-blue-500',
                            onSuggest: (e) => abrirSugestao(e, semanaIndexFiltrado, 'ajudante', parte.id)
                        })}
                    </div>
                )}
            </div>
        );
    };

    // ---------- UI helpers ----------
    const totalSelecionadas = Object.values(semanasSelecionadas).filter(Boolean).length;

    const selecionarTodasVisiveis = () => {
        userClearedWeeksRef.current = false;
        const next = {};
        (Array.isArray(listaFiltradaPorFlag) ? listaFiltradaPorFlag : []).forEach((sem, idx) => {
            next[getSemanaKey(sem, idx)] = true;
        });
        setSemanasSelecionadas(next);
    };

    const limparSelecaoVisiveis = () => {
        userClearedWeeksRef.current = true;
        setSemanasSelecionadas({});
    };

    return (
        <div className="w-full min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col lg:flex-row gap-6 pb-20 items-start">

                    {/* COLUNA PRINCIPAL */}
                    <div className="flex-1 space-y-4 min-w-0">
                        {(!Array.isArray(listaProgramacoes) || listaProgramacoes.length === 0) ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-sm font-medium">Nenhuma programação importada.</p>
                                <p className="text-xs mt-2">Vá para Importar para começar.</p>
                            </div>
                        ) : (
                            <>
                                {/* HEADER - filtro + seleção + ações */}
                                <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
                                    {/* Linha 1: controles */}
                                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                        {/* Esquerda: título + contador (status) */}

                                        {/* Direita: filtros + ações */}
                                        <div className="w-full lg:w-auto flex flex-wrap items-center gap-2 min-w-0">
                                            {/* filtro de semanas */}
                                            <div className="flex border rounded-full overflow-hidden shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => { setFiltroSemanas('ativas'); limparSelecaoVisiveis(); setSemanaAtivaIndex(0); }}
                                                    className={`px-3 py-1 text-xs font-bold ${filtroSemanas === 'ativas'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {TT.filtroAtivas}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => { setFiltroSemanas('arquivadas'); limparSelecaoVisiveis(); setSemanaAtivaIndex(0); }}
                                                    className={`px-3 py-1 text-xs font-bold border-l ${filtroSemanas === 'arquivadas'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {TT.filtroArquivadas}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => { setFiltroSemanas('todas'); limparSelecaoVisiveis(); setSemanaAtivaIndex(0); }}
                                                    className={`px-3 py-1 text-xs font-bold border-l ${filtroSemanas === 'todas'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {TT.filtroTodas}
                                                </button>
                                            </div>

                                            {/* seleção */}
                                            <button
                                                type="button"
                                                onClick={selecionarTodasVisiveis}
                                                className="px-3 py-1 rounded-full text-xs font-bold border bg-gray-100 hover:bg-gray-200 transition"
                                            >
                                                Todas
                                            </button>

                                            <button
                                                type="button"
                                                onClick={limparSelecaoVisiveis}
                                                className="px-3 py-1 rounded-full text-xs font-bold border bg-white hover:bg-gray-100 transition"
                                            >
                                                Limpar
                                            </button>

                                            {/* ações em lote */}
                                            <button
                                                type="button"
                                                onClick={arquivarSelecionadas}
                                                disabled={totalSelecionadas === 0}
                                                className={[
                                                    'px-3 py-1 rounded-full text-xs font-bold border transition inline-flex items-center gap-1',
                                                    totalSelecionadas === 0
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                ].join(' ')}
                                                title={TT.arquivar}
                                            >
                                                <Archive size={14} /> {TT.arquivar}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={restaurarSelecionadas}
                                                disabled={totalSelecionadas === 0}
                                                className={[
                                                    'px-3 py-1 rounded-full text-xs font-bold border transition inline-flex items-center gap-1',
                                                    totalSelecionadas === 0
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                ].join(' ')}
                                                title={TT.restaurar}
                                            >
                                                <RotateCcw size={14} /> {TT.restaurar}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={apagarArquivadas}
                                                className="px-3 py-1 rounded-full text-xs font-bold border bg-red-50 text-red-700 hover:bg-red-100 transition"
                                                title={TT.apagarArquivadas}
                                            >
                                                {TT.apagarArquivadas}
                                            </button>
                                        </div>
                                    </div>

                                    {/* DIVISÓRIA */}
                                    <div className="-mx-4 h-px bg-gray-300" />

                                    {/* Linha 2: chips semanas */}
                                    <div className="flex flex-wrap gap-2">
                                        {listaFiltradaPorFlag.map((sem, idx) => {
                                            const k = getSemanaKey(sem, idx);
                                            const on = !!semanasSelecionadas?.[k];
                                            const foco = idx === semanaAtivaIndex;
                                            const isArq = !!sem?.arquivada;

                                            return (
                                                <button
                                                    key={k}
                                                    type="button"
                                                    onClick={() => {
                                                        userClearedWeeksRef.current = false;
                                                        setSemanasSelecionadas(prev => ({ ...(prev || {}), [k]: !prev?.[k] }));
                                                        setSemanaAtivaIndex(idx);
                                                    }}
                                                    className={[
                                                        'px-3 py-1 rounded-full text-xs font-bold border transition whitespace-nowrap inline-flex items-center gap-2',
                                                        on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300',
                                                        foco ? 'ring-2 ring-blue-200' : ''
                                                    ].join(' ')}
                                                    title={sem?.semana}
                                                >
                                                    <span className="truncate">{sem?.semana}</span>
                                                    {isArq && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-black/10">
                                                            {TT.arquivada}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>


                                {/* CONTEÚDO - várias semanas */}
                                {semanasParaExibir.length === 0 ? (
                                    <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                        <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm font-medium">Selecione pelo menos uma semana acima.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {semanasParaExibir.map(({ sem, idx, key }) => {
                                            const partesDaSemana = Array.isArray(sem?.partes) ? sem.partes : [];
                                            const partesLinhaInicial = partesDaSemana.filter(isAbertura);
                                            const partesLinhaFinal = partesDaSemana.filter(isEncerramento);
                                            const isArq = !!sem?.arquivada;

                                            // ... dentro de semanasParaExibir.map ...
                                            return (
                                                <div key={key} className={`rounded-2xl border p-3 space-y-4 transition-all ${sem.evento === 'visita' ? 'bg-blue-50 border-blue-200' :
                                                    (sem.evento && sem.evento !== 'normal') ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
                                                    }`}>
                                                    {/* HEADER DA SEMANA */}
                                                    <div className="bg-white rounded-xl border p-4 flex flex-col gap-3">
                                                        <div className="flex items-center justify-between">
                                                            <div className="min-w-0">
                                                                <h3 className="font-black text-base text-gray-800 truncate flex items-center gap-2">
                                                                    <span>{sem?.semana || `Semana ${idx + 1}`}</span>

                                                                    {/* BADGES DE EVENTO */}
                                                                    {sem.evento === 'visita' && (
                                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
                                                                            <Briefcase size={12} /> Visita SC
                                                                        </span>
                                                                    )}
                                                                    {sem.evento?.includes('assembleia') && (
                                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-1">
                                                                            <Tent size={12} /> Assembleia
                                                                        </span>
                                                                    )}
                                                                    {sem.evento === 'congresso' && (
                                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                                                                            <UsersRound size={12} /> Congresso
                                                                        </span>
                                                                    )}
                                                                </h3>
                                                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                                                    {sem?.dataReuniao ? (
                                                                        <>
                                                                            <Calendar size={12} />
                                                                            Data Real: <strong>{sem.dataReuniao.split('-').reverse().join('/')}</strong>
                                                                        </>
                                                                    ) : `${TT.semana} ${idx + 1}`}

                                                                    {sem.evento === 'visita' && <span className="text-blue-600 font-bold">(Terça-feira)</span>}
                                                                </p>
                                                            </div>

                                                            <div className="flex gap-2">
                                                                <button onClick={() => toggleArquivadaSemana(key, !isArq)} className="p-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-500 hover:text-blue-600" title={isArq ? TT.restaurar : TT.arquivar}>
                                                                    {isArq ? <RotateCcw size={18} /> : <Archive size={18} />}
                                                                </button>
                                                                <button onClick={() => handleExcluirSemana(key)} className="p-2 rounded-lg border bg-white hover:bg-red-50 text-gray-500 hover:text-red-600">
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* CONTEÚDO CONDICIONAL */}
                                                    {(sem.evento && sem.evento !== 'normal' && sem.evento !== 'visita') ? (
                                                        <div className="bg-white rounded-xl border-2 border-dashed border-yellow-300 p-8 text-center flex flex-col items-center justify-center gap-3">
                                                            <div className="bg-yellow-100 p-4 rounded-full text-yellow-600">
                                                                {sem.evento === 'congresso' ? <UsersRound size={48} /> : <Tent size={48} />}
                                                            </div>
                                                            <h3 className="text-xl font-bold text-gray-700">
                                                                Semana de {sem.evento === 'congresso' ? 'Congresso' : 'Assembleia'}
                                                            </h3>
                                                            <p className="text-sm text-gray-500 max-w-md">
                                                                Não haverá Reunião Vida e Ministério nesta semana.
                                                                O quadro de anúncios não exibirá designações.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {/* PRESIDENTE (Se for Visita, o sistema permite designar normalmente) */}
                                                            <div className="grid grid-cols-1 gap-4">
                                                                <div className="relative group/slot w-full">
                                                                    <button type="button" onClick={() => setSlotAtivo({ key: 'presidente', semanaIndex: idx })} className={`bg-white p-4 rounded-xl border-2 transition-all hover:shadow-md text-left w-full ${slotKeyMatch('presidente', undefined, idx) ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200"}`}>
                                                                        <div className="flex items-center gap-2 mb-2"><User size={16} className="text-blue-600" /><span className="text-xs font-black uppercase text-gray-400">{TT.presidente}</span></div>
                                                                        {sem.presidente ? <p className="font-bold text-gray-800">{sem.presidente.nome}</p> : <p className="text-sm text-gray-400 italic flex items-center gap-1"><UserPlus size={16} className="opacity-60" /> {TT.cliquePara}</p>}
                                                                    </button>
                                                                    <button type="button" onClick={(e) => abrirSugestao(e, idx, 'presidente')} className="absolute top-1 right-1 z-10 p-1.5 rounded-full bg-yellow-100 text-yellow-600 opacity-0 group-hover/slot:opacity-100 transition-all hover:bg-yellow-200 shadow-sm focus:opacity-100"><Lightbulb size={14} /></button>
                                                                </div>
                                                            </div>

                                                            {/* LISTA DE PARTES */}
                                                            {partesLinhaInicial.length > 0 && (
                                                                <div className="space-y-3">{partesLinhaInicial.map(p => renderParteCard(p, idx))}</div>
                                                            )}

                                                            <div className="space-y-4">
                                                                {SECOES_ORDEM.map(secKey => {
                                                                    const partesDaSecao = partesDaSemana.filter(p => {
                                                                        const s = normalizarSecao(p?.secao);
                                                                        return s === secKey && !isAbertura(p) && !isEncerramento(p);
                                                                    });

                                                                    return (
                                                                        <div key={`${key}-${secKey}`} className="space-y-3">
                                                                            {renderTituloSecao(secKey, partesDaSemana)}
                                                                            {partesDaSecao.length === 0 ? (
                                                                                <div className="text-xs text-gray-400 italic px-2">Sem itens.</div>
                                                                            ) : (
                                                                                <div className="space-y-3">{partesDaSecao.map(p => renderParteCard(p, idx))}</div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            {partesLinhaFinal.length > 0 && (
                                                                <div className="space-y-3">{partesLinhaFinal.map(p => renderParteCard(p, idx))}</div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* BARRA LATERAL ALUNOS */}
                    <div className="lg:w-80 shrink-0 w-full lg:sticky lg:top-0 self-start">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
                            <div className="p-4 bg-blue-700 text-white text-xs font-bold uppercase tracking-widest flex justify-between items-center shrink-0">
                                <div className="flex flex-col">
                                    <span>{buildSlotLabel()}</span>
                                    <span className="text-[9px] opacity-60 font-normal">
                                        {alunosFiltrados.length} {TT.registros}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {slotAtivo && (
                                        <button
                                            type="button"
                                            onClick={() => setSlotAtivo(null)}
                                            className="hover:bg-white/20 rounded p-1 transition"
                                            title="Cancelar seleção"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => { setTermoBusca(''); setFiltrosTiposAtivos([]); setFiltroGenero('todos'); }}
                                        className="hover:bg-white/20 rounded p-1 transition"
                                        title="Limpar filtros"
                                    >
                                        <FilterX size={16} />
                                    </button>
                                </div>
                            </div>

                            {!slotAtivo && (
                                <div className="px-4 py-2 bg-blue-50 text-blue-800 text-[11px] font-semibold border-b border-blue-100 shrink-0">
                                    {TT.selecioneCampo}
                                </div>
                            )}

                            <div className="p-3 border-b bg-gray-50 space-y-3 shrink-0">
                                <div className="relative">
                                    <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Nome, cargo ou observação..."
                                        className="w-full pl-8 pr-4 py-1.5 text-xs border rounded-md outline-none focus:ring-1 focus:ring-blue-400"
                                        value={termoBusca}
                                        onChange={(e) => setTermoBusca(e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1 flex border rounded overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setOrdenacaoChave(ordenacaoChave === 'nome' ? 'dias' : 'nome')}
                                            className="px-2 py-1 bg-white hover:bg-gray-100 flex-1 text-[10px] font-bold border-r"
                                        >
                                            {ordenacaoChave === 'nome' ? TT.ordem.nome : TT.ordem.dias}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOrdemCrescente(!ordemCrescente)}
                                            className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-600"
                                            title="Inverter ordem"
                                        >
                                            {ordemCrescente ? <SortAsc size={14} /> : <SortDesc size={14} />}
                                        </button>
                                    </div>

                                    <div className="flex border rounded overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => handleMudarGenero('M')}
                                            className={`px-2 py-1 transition ${filtroGenero === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-400'}`}
                                            title="Masculino"
                                        >
                                            <User size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMudarGenero('F')}
                                            className={`px-2 py-1 border-l transition ${filtroGenero === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-white text-gray-400'}`}
                                            title="Feminino"
                                        >
                                            <UserRound size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMudarGenero('todos')}
                                            className={`px-2 py-1 border-l transition ${filtroGenero === 'todos' ? 'bg-gray-200 text-gray-700' : 'bg-white text-gray-400'}`}
                                            title="Todos"
                                        >
                                            <UsersRound size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                                    {Object.keys(cargosMap || {})
                                        .filter(key => key !== 'desab')
                                        .filter(key => (filtroGenero === 'todos' ? true : (cargosMap?.[key]?.gen === filtroGenero)))
                                        .map((cKey) => (
                                            <button
                                                type="button"
                                                key={cKey}
                                                onClick={() => toggleFiltroTipo(cKey)}
                                                className={[
                                                    "px-2 py-1 rounded-full text-[9px] font-bold border transition-all whitespace-nowrap",
                                                    filtrosTiposAtivos.includes(cKey)
                                                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                        : "bg-white text-gray-400 border-gray-100"
                                                ].join(" ")}
                                            >
                                                {(cargosMap?.[cKey]?.[lang] || cargosMap?.[cKey]?.pt || cargosMap?.[cKey]?.es || cKey)}
                                            </button>
                                        ))}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scroll bg-gray-50/20">
                                {alunosFiltrados.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">
                                        <Search size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-xs">Nenhum aluno encontrado</p>
                                    </div>
                                ) : (
                                    alunosFiltrados.map((aluno) => {
                                        const semanaIdxFiltrado = getSemanaIndexContexto();
                                        const semanaKey = getSemanaKeyByFilteredIndex(semanaIdxFiltrado);

                                        const ja = semanaKey ? isAlunoDuplicadoBySemanaKey(aluno?.id, semanaKey) : false;
                                        const dias = calcularDiasDesdeUltimaParte(aluno);
                                        const ultimo = getUltimoRegistro(aluno);

                                        const cargoKey = aluno?.tipo;
                                        const cargoInfo = getCargoInfo(cargoKey);

                                        const podeClicar = !!slotAtivo;

                                        const miniHist = Array.isArray(aluno?.historico)
                                            ? [...aluno.historico].sort((a, b) => {
                                                const da = a?.data ? new Date(a.data).getTime() : 0;
                                                const db = b?.data ? new Date(b.data).getTime() : 0;
                                                return db - da;
                                            }).slice(0, 6)
                                            : [];

                                        return (
                                            <button
                                                key={aluno?.id || aluno?.nome}
                                                type="button"
                                                onClick={() => {
                                                    if (!podeClicar) return;
                                                    if (ja) {
                                                        const ok = window.confirm("Esse aluno já está designado nesta semana. Quer usar mesmo assim?");
                                                        if (!ok) return;
                                                    }
                                                    atribuirAluno(aluno);
                                                }}
                                                disabled={!podeClicar}
                                                className={[
                                                    "w-full text-left p-3 rounded-xl border transition relative group shadow-sm",
                                                    podeClicar ? "bg-white hover:shadow-md hover:border-blue-200" : "bg-gray-50 cursor-not-allowed",
                                                    ja ? "border-amber-200" : "border-gray-200"
                                                ].join(" ")}
                                                title={
                                                    !slotAtivo ? TT.selecioneCampo
                                                        : ja ? "Duplicado na semana (mas você pode usar se desejar)"
                                                            : "Clique para designar"
                                                }
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="font-black text-sm text-gray-800 truncate flex items-center gap-2">
                                                            <span className="truncate">{aluno?.nome || "(Sem nome)"}</span>
                                                            {ja && <AlertTriangle size={14} className="text-amber-600 shrink-0" />}

                                                            {!!aluno?.observacoes && (
                                                                <div title={aluno.observacoes} className="cursor-help shrink-0">
                                                                    <Info size={14} className="text-blue-400 hover:text-blue-600 transition-colors" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                                            <span className={[
                                                                "text-[10px] font-black px-2 py-0.5 rounded-full border",
                                                                cargoInfo?.cor || "bg-gray-100 text-gray-700 border-gray-200"
                                                            ].join(" ")}>
                                                                {cargoInfo?.[lang] || cargoInfo?.pt || cargoInfo?.es || cargoKey || "—"}
                                                            </span>

                                                            {typeof dias === 'number' ? (
                                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 inline-flex items-center gap-1">
                                                                    <Clock size={12} /> {dias} dias
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 inline-flex items-center gap-1">
                                                                    <Clock size={12} /> {TT.info.nunca}
                                                                </span>
                                                            )}

                                                            {ja && (
                                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                                                                    <AlertTriangle size={12} /> Duplicado
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {/*todo: remover ou comentar*/}
                                                        {!!aluno?.observacoes && (
                                                            <div className="mt-2 text-[11px] text-gray-600 flex items-start gap-2">
                                                                <StickyNote size={14} className="opacity-60 mt-0.5" />
                                                                <span className="line-clamp-2">{aluno.observacoes}</span>
                                                            </div>
                                                        )}

                                                        {(ultimo?.data || ultimo?.parte) && (
                                                            <div className="mt-2 text-[10px] text-gray-400">
                                                                Último: {ultimo?.data ? String(ultimo.data) : "—"}{ultimo?.parte ? ` • ${String(ultimo.parte)}` : ""}
                                                            </div>
                                                        )}

                                                        {miniHist.length > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                                                {miniHist.map((h, i) => {
                                                                    const dt = h?.data ? String(h.data) : '';
                                                                    const ddmm = dt
                                                                        ? dt.toString().split('T')[0].split('-').reverse().slice(0, 2).join('/')
                                                                        : '—';
                                                                    const parte = h?.parte ? String(h.parte) : '';
                                                                    const aj = h?.ajudante ? String(h.ajudante) : '';

                                                                    return (
                                                                        <div key={`${aluno?.id || aluno?.nome}-hist-${i}`} className="flex items-center gap-2 text-[10px] text-gray-500">
                                                                            <span className="font-mono text-gray-400 shrink-0">{ddmm}</span>
                                                                            <span className="truncate flex-1" title={parte || ''}>{parte || '—'}</span>
                                                                            {!!aj && (
                                                                                <span className="text-[9px] text-blue-500 shrink-0" title={aj}>
                                                                                    {aj.split(' ')[0]}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {!slotAtivo && (
                                                    <div className="absolute inset-0 rounded-xl bg-white/40" />
                                                )}

                                                <div className="absolute inset-y-0 right-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-xl" />
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* MODAL: Editar parte */}
            {modalEditarOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => { setModalEditarOpen(false); setParteEditCtx(null); }}
                    />
                    <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border overflow-hidden">
                        <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between">
                            <div className="text-sm font-black">{TT.editarParte}</div>
                            <button
                                type="button"
                                onClick={() => { setModalEditarOpen(false); setParteEditCtx(null); }}
                                className="p-1 rounded hover:bg-white/10 transition"
                                title={TT.cancelar}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">
                                    Título
                                </label>
                                <input
                                    type="text"
                                    value={parteEditCtx?.valores?.titulo ?? ''}
                                    onChange={(e) => setParteEditCtx(prev => ({
                                        ...prev,
                                        valores: { ...(prev?.valores || {}), titulo: e.target.value }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">
                                    Descrição
                                </label>
                                <textarea
                                    rows={3}
                                    value={parteEditCtx?.valores?.descricao ?? ''}
                                    onChange={(e) => setParteEditCtx(prev => ({
                                        ...prev,
                                        valores: { ...(prev?.valores || {}), descricao: e.target.value }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">
                                    Tempo
                                </label>
                                <input
                                    type="text"
                                    value={parteEditCtx?.valores?.tempo ?? ''}
                                    onChange={(e) => setParteEditCtx(prev => ({
                                        ...prev,
                                        valores: { ...(prev?.valores || {}), tempo: e.target.value }
                                    }))}
                                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                />
                                <p className="mt-1 text-[10px] text-gray-400">
                                    Observação: para Abertura/Encerramento, o sistema exibe 5 min (o valor pode ser ignorado ao salvar).
                                </p>
                            </div>
                        </div>

                        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setModalEditarOpen(false); setParteEditCtx(null); }}
                                className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-100 transition text-sm font-bold inline-flex items-center gap-2"
                            >
                                <X size={16} /> {TT.cancelar}
                            </button>

                            <button
                                type="button"
                                onClick={salvarEdicaoParte}
                                className="px-3 py-2 rounded-lg border bg-blue-600 hover:bg-blue-700 text-white transition text-sm font-bold inline-flex items-center gap-2"
                            >
                                <Save size={16} /> {TT.salvar}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- INJEÇÃO 5: RENDERIZAR O MODAL DE SUGESTÃO --- */}
            <ModalSugestao
                isOpen={modalSugestao.aberto}
                onClose={() => setModalSugestao({ ...modalSugestao, aberto: false })}
                onSelect={aplicarSugestao}
                alunos={alunos}
                historico={listaProgramacoes}
                parteAtual={getParteFocoModal()}
                semanaAtual={listaFiltradaPorFlag?.[modalSugestao.semanaIndex]}
                modalKey={modalSugestao.key}
                cargosMap={cargosMap}
                lang={lang}
            />
        </div>
    );
};

export default Designar;