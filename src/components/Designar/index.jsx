import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    Calendar, User, Search, UsersRound, UserRound, Clock,
    AlertTriangle, StickyNote, Trash2, Edit2, X, Save, UserPlus,
    Archive, RotateCcw, Lightbulb, Briefcase, Tent, FilterX, SortAsc, SortDesc, Eye, EyeOff, RefreshCw, Plus, ArrowUp, ArrowDown, ChevronDown
} from 'lucide-react';

import ModalSugestao from './ModalSugestao';
import NavegadorSemanas from './NavegadorSemanas';
import SidebarAlunos from './SidebarAlunos';
import DesignarHeader from './DesignarHeader';
import {
    SECOES_ORDEM, SECOES_META, normalizar, normalizarSecao,
    isAbertura, isEncerramento, isLinhaInicialFinal,
    isEstudoBiblicoCongregacao, isCanticoIntermediario, isSemanaAssembleia
} from './helpers';
import { getCanonicalMeetingDateISO, getSemanaSortTimestamp } from '../../utils/revisarEnviar/dates';
import { getEventoEspecialDaSemana, getTipoEventoSemana } from '../../utils/eventos';
import { formatHm } from '../../utils/importador/helpers';
import { calcularTotalInfo } from '../../utils/importador/parser';
import { formatText, useSectionMessages } from '../../i18n';
import { getLanguageMeta } from '../../config/appConfig';
import { isAlunoEligibleForAssignment } from '../../utils/assignmentEligibility';
import {
    FIM_DE_SEMANA_RESPONSABILIDADES,
    MEIO_SEMANA_RESPONSABILIDADES,
    getFimDeSemanaAssignedPeople,
    getFimDeSemanaSlotLabel,
    getMeioSemanaAssignedPeople,
    hasFimDeSemanaData,
    normalizeFimDeSemana,
    normalizeResponsabilidades
} from '../../utils/fimDeSemana';

const CARGO_FALLBACK = {
    pt: { pt: "Irmão", es: "Hermano", cor: "bg-gray-100 text-gray-700", gen: "M" }
};

const Designar = ({
    listaProgramacoes = [],
    setListaProgramacoes = () => { },
    alunos = [],
    cargosMap = {},
    lang = 'pt',
    onExcluirSemana,
    config = {},
    sharedWeekSelection = {},
    setSharedWeekSelection = () => { },
    substitutionShortcutRequest = null,
    onRepublicarQuadroPublico = null
}) => {
    const [semanaAtivaIndex, setSemanaAtivaIndex] = useState(0);
    const [filtroSemanas, setFiltroSemanas] = useState('ativas');
    const userClearedWeeksRef = useRef(false);
    const selectionBootstrapRef = useRef(true);

    const [slotAtivo, setSlotAtivo] = useState(null);
    const [fdsAbertoPorSemana, setFdsAbertoPorSemana] = useState({});
    const [termoBusca, setTermoBusca] = useState('');
    const [filtrosTiposAtivos, setFiltrosTiposAtivos] = useState([]);
    const [filtroGenero, setFiltroGenero] = useState('todos');
    const [ordenacaoChave, setOrdenacaoChave] = useState('dias');
    const [ordemCrescente, setOrdemCrescente] = useState(true);

    const [modalEditarOpen, setModalEditarOpen] = useState(false);
    const [parteEditCtx, setParteEditCtx] = useState(null);
    const [modalEditarSemanaOpen, setModalEditarSemanaOpen] = useState(false);
    const [semanaEditCtx, setSemanaEditCtx] = useState(null);

    const [modalSugestao, setModalSugestao] = useState({
        aberto: false, semanaIndex: null, parteId: null, key: null
    });

    const [draggedAluno, setDraggedAluno] = useState(null);
    const [dragOverSlot, setDragOverSlot] = useState(null);
    const stickyHeaderRef = useRef(null);
    const lastSubstitutionShortcutTokenRef = useRef(null);
    const [stickyOffset, setStickyOffset] = useState(176);
    const semanasSelecionadas = sharedWeekSelection || {};
    const setSemanasSelecionadas = setSharedWeekSelection;

    const TT = useSectionMessages('designar');

    const getSemanaKey = (sem, idx) =>
        (sem?.id ?? sem?.dataReuniao ?? sem?.dataInicio ?? sem?.dataExata ?? sem?.data ?? String(idx)).toString();

    const getCargoInfo = (cargoKey) => cargosMap?.[cargoKey] || (CARGO_FALLBACK?.[lang] || CARGO_FALLBACK.pt);
    const getSecaoTitulo = (secao) => TT.secoes?.[secao] || SECOES_META?.[secao]?.titulo || secao;
    const getTempoTotalMeta = (partes) => {
        const totalMin = calcularTotalInfo(partes).totalEfetivo;
        const faixa = totalMin >= 104 && totalMin <= 106
            ? 'ok'
            : totalMin >= 100 && totalMin <= 103
                ? 'alerta'
                : 'erro';
        const classes = {
            ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            alerta: 'bg-amber-50 text-amber-700 border-amber-200',
            erro: 'bg-red-50 text-red-700 border-red-200'
        };
        return { totalMin, label: formatHm(totalMin), className: classes[faixa] };
    };
    const getDefaultFimDeSemanaDataISO = (sem) => {
        try {
            return getCanonicalMeetingDateISO({
                sem,
                config,
                overrideDia: config?.dia_reuniao_fds || config?.diaReuniaoFds || 'saturday',
            }) || '';
        } catch {
            return '';
        }
    };
    const getDefaultFimDeSemanaHorario = () => config?.horario_fds || config?.horarioFimDeSemana || '18:00';
    const getFimDeSemanaParaSemana = (sem) => {
        const fds = normalizeFimDeSemana(sem?.fimDeSemana);
        return {
            ...fds,
            data: getDefaultFimDeSemanaDataISO(sem) || fds.data,
            horario: getDefaultFimDeSemanaHorario() || fds.horario,
        };
    };
    const withFimDeSemanaDefaults = (sem) => getFimDeSemanaParaSemana(sem);
    const getResponsabilidadesMeioSemana = (sem) => normalizeResponsabilidades(sem?.responsabilidades, MEIO_SEMANA_RESPONSABILIDADES);
    const hasPessoaDesignada = (pessoa) => !!(pessoa?.id || pessoa?.nome);
    const mesmaPessoa = (a, b) => {
        if (!a || !b) return false;
        const aKey = a.id || a.nome;
        const bKey = b.id || b.nome;
        return !!aKey && !!bKey && String(aKey) === String(bKey);
    };

    const sameSlotCtx = (a, b) => {
        if (!a || !b) return false;
        return a.key === b.key
            && a.parteId === b.parteId
            && a.semanaIndex === b.semanaIndex
            && !!a.fds === !!b.fds
            && !!a.meioSemana === !!b.meioSemana
            && a.responsabilidadeKey === b.responsabilidadeKey
            && a.itemIndex === b.itemIndex;
    };

    const hasSlotPessoa = (item, aluno) => {
        if (!item?.pessoa || !aluno) return false;
        return mesmaPessoa(item.pessoa, aluno);
    };

    const getFimDeSemanaLabel = (slotKey) => getFimDeSemanaSlotLabel(slotKey, lang);

    const compactPessoa = (pessoa) => {
        if (!pessoa) return null;
        return {
            id: pessoa.id || null,
            nome: pessoa.nome || ''
        };
    };

    const getSubstituicoesSemana = (sem) => (Array.isArray(sem?.substituicoes) ? sem.substituicoes : []).filter((item) => !item?.canceladaEm);

    const getPessoasDesignadasSemana = (sem) => {
        const assigned = [];
        const add = (pessoa, slotKey, label, extra = {}) => {
            if (!hasPessoaDesignada(pessoa)) return;
            assigned.push({ pessoa, slotKey, label, context: extra });
        };

        add(sem?.presidente, 'presidente', TT.presidente);
        (sem?.partes || []).forEach((parte) => {
            add(parte?.estudante, 'estudante', parte?.titulo || TT.estudante, { parteId: parte?.id });
            add(parte?.ajudante, 'ajudante', TT.ajudante, { parteId: parte?.id });
            add(parte?.oracao, 'oracao', TT.oracao, { parteId: parte?.id });
            add(parte?.dirigente, 'dirigente', TT.dirigente, { parteId: parte?.id });
            add(parte?.leitor, 'leitor', TT.leitor, { parteId: parte?.id });
        });

        getMeioSemanaAssignedPeople(sem).forEach((item) => assigned.push(item));
        getFimDeSemanaAssignedPeople(sem).forEach((item) => assigned.push(item));
        return assigned;
    };

    const getConflitoDesignacaoSemana = (sem, aluno, targetSlot) => {
        if (!sem || !aluno || !targetSlot) return null;
        const ocorrencias = getPessoasDesignadasSemana(sem).filter((item) => {
            if (!hasSlotPessoa(item, aluno)) return false;
            const ctx = item.context || {};
            const itemSlot = {
                key: item.slotKey,
                semanaIndex: targetSlot.semanaIndex,
                parteId: ctx.parteId,
                fds: !!ctx.fds,
                meioSemana: !!ctx.meioSemana,
                responsabilidadeKey: ctx.responsabilidadeKey,
                itemIndex: ctx.itemIndex,
            };
            return !sameSlotCtx(itemSlot, targetSlot);
        });

        if (ocorrencias.length === 0) return null;
        const temOutroSlotPrincipalFds = !!targetSlot.fds && ocorrencias.some((item) => item.context?.fds && !item.context?.responsabilidade);
        return {
            severity: temOutroSlotPrincipalFds && !targetSlot.responsabilidadeKey ? 'block' : 'warning',
            labels: ocorrencias.map((item) => item.label || item.slotKey),
        };
    };

    const getSubstituicaoAtiva = (sem, slotCtx, value) => {
        if (!slotCtx || !hasPessoaDesignada(value)) return null;
        const substituicoes = getSubstituicoesSemana(sem);
        return [...substituicoes].reverse().find((item) => {
            const parteId = slotCtx.key === 'presidente'
                ? 'presidente'
                : (slotCtx.parteId || slotCtx.responsabilidadeKey || slotCtx.key);
            return item?.role === slotCtx.key && item?.parteId === parteId && mesmaPessoa(item?.para, value);
        }) || null;
    };

    const marcarSemanaPublicadaPendente = (semana, motivo = 'alteracao_publicada', now = new Date().toISOString()) => {
        if (!semana || semana?.publicadaNoQuadro === false) return;
        semana.agendaPendenteSync = true;
        semana.needsCalendarSync = true;
        semana.agendaPendenteMotivo = motivo;
        semana.agendaPendenteDesde = now;
        semana.historicoPendenteSync = true;
        semana.historicoPendenteMotivo = motivo;
        semana.historicoPendenteDesde = now;
        semana.ultimaAlteracaoPublicadaEm = now;
    };

    const marcarNotificacaoSemanaPendente = (semana, now = new Date().toISOString()) => {
        if (!semana || semana?.publicadaNoQuadro === false) return;
        semana.notificacaoAlteradaEm = now;
    };

    const marcarNotificacaoPartePendente = (parte, semana, now = new Date().toISOString()) => {
        if (!parte || semana?.publicadaNoQuadro === false) return parte;
        return { ...parte, notificacaoAlteradaEm: now };
    };

    // FUNÇÃO ROBUSTA DE ORDENAÇÃO E EXTRAÇÃO DE DATAS
    const getSortTime = useCallback((sem) => getSemanaSortTimestamp(sem, config), [config]);

    // 🔥 FORMATADOR DE DATA USANDO A SUA LÓGICA OFICIAL
    const formatarDataPorExtenso = (sem) => {
        let dataBaseStr = null;

        const eventoConfig = getEventoEspecialDaSemana(sem, config);
        const tipoEvento = getTipoEventoSemana(sem, config);
        const isVisita = tipoEvento === 'visita';

        if (eventoConfig?.dataInput && !isVisita) {
            dataBaseStr = eventoConfig.dataInput;
        } else {
            try {
                dataBaseStr = getCanonicalMeetingDateISO({
                    sem,
                    config,
                    overrideDia: isVisita ? 'terça-feira' : null,
                });
            } catch (e) {
                console.error("Erro ao tentar calcular a data da reunião:", e);
            }
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
            const dataFormatada = dataBase.toLocaleDateString(getLanguageMeta(lang).locale, opcoes);

            return dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
        } catch {
            return dataBaseStr;
        }
    };

    const normalizeAndSortProgramacoes = (arr) => [...(arr || [])].sort((a, b) => {
        const timeA = getSortTime(a);
        const timeB = getSortTime(b);
        if (timeA !== timeB && timeA > 0 && timeB > 0) return timeA - timeB;
        return (a?.semana || '').localeCompare(b?.semana || '');
    });

    const getNextProgramacoes = (prev, updater) => normalizeAndSortProgramacoes(typeof updater === 'function' ? updater(prev) : updater);

    const setListaProgramacoesSafe = (updater, options = {}) => {
        if (options.republicarQuadro) {
            const next = getNextProgramacoes(listaProgramacoes, updater);
            setListaProgramacoes(next);
            if (onRepublicarQuadroPublico) {
                onRepublicarQuadroPublico(next).catch((error) => {
                    console.error('Erro ao republicar quadro publico:', error);
                });
            }
            return;
        }

        setListaProgramacoes(prev => getNextProgramacoes(prev, updater));
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
    }, [listaProgramacoes, filtroSemanas, getSortTime]);

    const semanaAtivaIndexAtual = Math.min(semanaAtivaIndex, Math.max(0, listaFiltradaPorFlag.length - 1));

    const getSemanaKeyByFilteredIndex = (idxFiltrado) => getSemanaKey(listaFiltradaPorFlag?.[idxFiltrado], idxFiltrado);
    const getSemanaRealIndexByKey = (semanaKey) => listaProgramacoes.findIndex((s, idx) => getSemanaKey(s, idx) === semanaKey);
    const getSemanaRealIndexFromFilteredIndex = (idxFiltrado) => getSemanaRealIndexByKey(getSemanaKeyByFilteredIndex(idxFiltrado));
    const getSemanaIndexContexto = () => Number.isInteger(slotAtivo?.semanaIndex) ? slotAtivo.semanaIndex : semanaAtivaIndexAtual;
    const isSemanaTotalmenteDesignada = useCallback((sem) => {
        const hasTextoPreenchido = (value) => !!String(value || '').trim();
        const hasResponsabilidadePreenchida = (responsabilidades, storageKey) =>
            (responsabilidades?.[storageKey] || []).some(hasPessoaDesignada);

        if (!sem || isSemanaAssembleia(sem, config)) return true;
        if (!hasPessoaDesignada(sem?.presidente)) return false;

        const partes = Array.isArray(sem?.partes) ? sem.partes : [];

        const partesCompletas = partes.every((parte) => {
            if (isCanticoIntermediario(parte)) return true;

            if (isLinhaInicialFinal(parte)) {
                return hasPessoaDesignada(parte?.oracao) || hasPessoaDesignada(parte?.estudante);
            }

            if (isEstudoBiblicoCongregacao(parte)) {
                const temDirigente = hasPessoaDesignada(parte?.dirigente) || hasPessoaDesignada(parte?.estudante);
                const temLeitor = hasPessoaDesignada(parte?.leitor) || hasPessoaDesignada(sem?.leitor);
                return temDirigente && temLeitor;
            }

            return hasPessoaDesignada(parte?.estudante);
        });
        if (!partesCompletas) return false;

        const responsabilidadesMeioSemana = getResponsabilidadesMeioSemana(sem);
        const responsabilidadesMeioSemanaCompletas = MEIO_SEMANA_RESPONSABILIDADES.every(({ storageKey }) =>
            hasResponsabilidadePreenchida(responsabilidadesMeioSemana, storageKey)
        );
        if (!responsabilidadesMeioSemanaCompletas) return false;

        const fds = normalizeFimDeSemana(sem?.fimDeSemana);
        if (!fds.ativo) return true;

        if (!hasPessoaDesignada(fds.presidente)) return false;
        if (!hasPessoaDesignada(fds.oracaoFinal)) return false;
        if (!hasTextoPreenchido(fds.reuniaoPublica.temaDiscurso)) return false;
        if (!hasTextoPreenchido(fds.reuniaoPublica.oradorNomeManual)) return false;
        if (!hasTextoPreenchido(fds.reuniaoPublica.congregacaoOrador)) return false;
        if (!hasPessoaDesignada(fds.estudoSentinela.dirigente)) return false;
        if (!hasPessoaDesignada(fds.estudoSentinela.leitor)) return false;
        if (getTipoEventoSemana(sem, config) === 'visita' && !hasTextoPreenchido(fds.visitaSuperintendente.discursoFinal)) return false;

        return FIM_DE_SEMANA_RESPONSABILIDADES.every(({ storageKey }) =>
            hasResponsabilidadePreenchida(fds.responsabilidades, storageKey)
        );
    }, [config]);

    useEffect(() => {
        if (!Array.isArray(listaFiltradaPorFlag) || listaFiltradaPorFlag.length === 0) {
            if (selectionBootstrapRef.current) {
                setSemanasSelecionadas({});
            }
            return;
        }

        setSemanasSelecionadas((prev) => {
            const keysVisiveis = new Set(listaFiltradaPorFlag.map((s, i) => getSemanaKey(s, i)));
            const selecaoPadrao = {};

            listaFiltradaPorFlag.forEach((sem, idx) => {
                if (!isSemanaTotalmenteDesignada(sem)) {
                    selecaoPadrao[getSemanaKey(sem, idx)] = true;
                }
            });

            const hasAnyVisibleSelected = Object.keys(prev).some(k => keysVisiveis.has(k) && prev[k]);

            if (selectionBootstrapRef.current) {
                selectionBootstrapRef.current = false;
                return selecaoPadrao;
            }

            if (!userClearedWeeksRef.current && !hasAnyVisibleSelected) {
                return selecaoPadrao;
            }

            return prev;
        });
    }, [isSemanaTotalmenteDesignada, listaFiltradaPorFlag, setSemanasSelecionadas]);

    useEffect(() => {
        const headerNode = stickyHeaderRef.current;
        if (!headerNode) return undefined;

        const updateStickyOffset = () => {
            const nextOffset = Math.ceil(headerNode.getBoundingClientRect().height) + 16;
            setStickyOffset((prev) => (prev === nextOffset ? prev : nextOffset));
        };

        updateStickyOffset();

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(updateStickyOffset);
            observer.observe(headerNode);
            return () => observer.disconnect();
        }

        window.addEventListener('resize', updateStickyOffset);
        return () => window.removeEventListener('resize', updateStickyOffset);
    }, []);

    const semanasParaExibir = (listaFiltradaPorFlag || [])
        .map((sem, idx) => ({ sem, idx, key: getSemanaKey(sem, idx) }))
        .filter(({ key }) => !!semanasSelecionadas[key]);

    const mudarFiltro = (novoFiltro) => {
        setFiltroSemanas(novoFiltro);
        userClearedWeeksRef.current = false;
        selectionBootstrapRef.current = true;
        setSemanaAtivaIndex(0);
        setSemanasSelecionadas({});
    };

    const totalSelecionadas = Object.values(semanasSelecionadas).filter(Boolean).length;

    useEffect(() => {
        if (!substitutionShortcutRequest?.token || lastSubstitutionShortcutTokenRef.current === substitutionShortcutRequest.token) return;

        const normalizeRoleToSlot = (role) => {
            if (role === 'resp') return 'estudante';
            if (role === 'ajud') return 'ajudante';
            if ([
                'presidente_fds',
                'oracao_fds',
                'dirigente_sentinela',
                'leitor_sentinela',
                'indicador_entrada',
                'indicador_auditorio',
                'microfones_volantes',
                'audio_video'
            ].includes(role)) return role;
            if (['presidente', 'oracao', 'dirigente', 'leitor', 'estudante', 'ajudante'].includes(role)) return role;
            return 'estudante';
        };

        const targetIdx = listaFiltradaPorFlag.findIndex((sem, idx) => {
            const requestKey = String(substitutionShortcutRequest.semanaKey || '').trim();
            const currentKey = getSemanaKey(sem, idx);
            return (
                (requestKey && currentKey === requestKey) ||
                String(sem?.semana || '').trim() === String(substitutionShortcutRequest.semana || '').trim() ||
                String(sem?.id || '').trim() === String(substitutionShortcutRequest.id || '').trim()
            );
        });

        if (targetIdx === -1) return;
        lastSubstitutionShortcutTokenRef.current = substitutionShortcutRequest.token;

        const sem = listaFiltradaPorFlag[targetIdx];
        const key = getSemanaKey(sem, targetIdx);
        setSemanasSelecionadas({ [key]: true });
        setSemanaAtivaIndex(targetIdx);
        setSlotAtivo(null);
        setModalSugestao({
            aberto: true,
            semanaIndex: targetIdx,
            key: normalizeRoleToSlot(substitutionShortcutRequest.role),
            parteId: substitutionShortcutRequest.parteId,
            fds: !!substitutionShortcutRequest.fds,
            meioSemana: !!substitutionShortcutRequest.meioSemana,
            responsabilidadeKey: substitutionShortcutRequest.responsabilidadeKey,
            itemIndex: substitutionShortcutRequest.itemIndex,
            modo: 'substituicao',
            anterior: substitutionShortcutRequest.pessoa || null
        });
    }, [substitutionShortcutRequest, listaFiltradaPorFlag, setSemanasSelecionadas]);

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

    // 🔥 EXCLUSÃO SUPER SEGURA DA SEMANA
    const handleExcluirSemana = async (semanaKey) => {
        const atual = listaProgramacoes.find((s, idx) => getSemanaKey(s, idx) === semanaKey);
        if (!atual || !window.confirm(formatText(TT.confirmarExcluirSemanaTpl, { semana: atual?.semana || semanaKey }))) return;

        let dataBase = atual.dataExata || atual.dataInicio || atual.dataReuniao || atual.data;
        if (!dataBase && atual.semana) {
            const timeMs = getSortTime(atual);
            if (timeMs > 0) {
                const d = new Date(timeMs);
                dataBase = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        }

        if (onExcluirSemana && atual.id) {
            await onExcluirSemana(atual.id, dataBase);
        }

        setSlotAtivo(null);
        setModalEditarOpen(false);
        setParteEditCtx(null);
        setModalEditarSemanaOpen(false);
        setSemanaEditCtx(null);

        setListaProgramacoesSafe(prev => prev.filter((s, idx) => getSemanaKey(s, idx) !== semanaKey));
        setSemanasSelecionadas(prev => { const next = { ...prev }; delete next[semanaKey]; return next; });
    };

    // 🔥 EXCLUSÃO EM MASSA DE ARQUIVADAS
    const apagarArquivadas = async () => {
        const keys = getSelectedKeys();
        let alvo = [];
        if (keys.length > 0) {
            alvo = listaProgramacoes.filter((s, idx) => keys.includes(getSemanaKey(s, idx)) && s?.arquivada);
        } else {
            alvo = listaProgramacoes.filter(s => !!s?.arquivada);
        }

        if (alvo.length === 0) return alert(TT.nenhumaSemanaArquivada);
        if (!window.confirm(formatText(TT.confirmarApagarArquivadasTpl, { count: alvo.length }))) return;

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
                    await onExcluirSemana(item.id, dataBase);
                }
            }
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

    const togglePublicacaoSemana = (semanaKey) => {
        setListaProgramacoesSafe(prev => prev.map((s, idx) => {
            if (getSemanaKey(s, idx) !== semanaKey) return s;
            const publicada = s?.publicadaNoQuadro !== false;
            return {
                ...s,
                publicadaNoQuadro: !publicada,
                publicacaoQuadroAtualizadaEm: new Date().toISOString()
            };
        }), { republicarQuadro: true });
    };

    const republicarQuadroPublico = () => {
        if (!onRepublicarQuadroPublico) return;
        onRepublicarQuadroPublico(normalizeAndSortProgramacoes(listaProgramacoes)).catch((error) => {
            console.error('Erro ao republicar quadro publico:', error);
        });
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
        return getPessoasDesignadasSemana(sem).some((item) => {
            const pessoaKey = item?.pessoa?.id || item?.pessoa?.nome;
            return pessoaKey && alunoId && String(pessoaKey) === String(alunoId);
        });
    };

    const alunosFiltrados = (alunos || []).filter(aluno => {
        const buscaNorm = termoBusca ? normalizar(termoBusca) : '';
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
        const res = ordenacaoChave === 'nome'
            ? (a?.nome || '').localeCompare(b?.nome || '')
            : (calcularDiasDesdeUltimaParte(a) ?? 99999) - (calcularDiasDesdeUltimaParte(b) ?? 99999);
        return ordemCrescente ? res : -res;
    });

    const getParteFromTargetSlot = (sem, targetSlot) => {
        if (!sem || !targetSlot || targetSlot.key === 'presidente' || targetSlot.fds || targetSlot.meioSemana) return null;
        return (sem.partes || []).find((parte) => parte.id === targetSlot.parteId) || null;
    };

    const getAlunoEligibilityForSlot = (aluno, targetSlot = slotAtivo) => {
        if (!targetSlot || !aluno) return { eligible: true, reason: '' };
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(Number.isInteger(targetSlot.semanaIndex) ? targetSlot.semanaIndex : semanaAtivaIndexAtual);
        if (semanaRealIndex === -1) return { eligible: false, reason: TT.semanaNaoEncontrada || 'Semana nao encontrada.' };

        const sem = listaProgramacoes[semanaRealIndex];
        const parte = getParteFromTargetSlot(sem, targetSlot);
        if (targetSlot.key !== 'presidente' && !targetSlot.fds && !targetSlot.meioSemana && !parte) {
            return { eligible: false, reason: TT.parteNaoEncontrada || 'Parte nao encontrada.' };
        }
        return isAlunoEligibleForAssignment({
            aluno,
            parte,
            slotKey: targetSlot.key,
            cargosMap,
            assignedStudent: parte?.estudante,
            lang,
        });
    };

    const atribuirAluno = (aluno, targetSlot = slotAtivo, options = {}) => {
        if (!targetSlot) return false;
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(Number.isInteger(targetSlot.semanaIndex) ? targetSlot.semanaIndex : semanaAtivaIndexAtual);
        if (semanaRealIndex === -1) return false;

        const sem = listaProgramacoes[semanaRealIndex];

        // 🔥 TRAVA: BLOQUEIA DESIGNAÇÃO SE FOR ASSEMBLEIA
        if (isSemanaAssembleia(sem, config)) {
            alert(formatText(TT.bloqueioSemanaEventoTpl, { semana: sem.semana }));
            if (targetSlot === slotAtivo) setSlotAtivo(null);
            return false;
        }

        if (aluno === null) {
            let valorAtual = null;
            if (targetSlot.meioSemana) {
                const responsabilidades = getResponsabilidadesMeioSemana(sem);
                valorAtual = responsabilidades?.[targetSlot.responsabilidadeKey]?.[targetSlot.itemIndex] || null;
            } else if (targetSlot.fds) {
                valorAtual = getFimDeSemanaSlotValue(withFimDeSemanaDefaults(sem), targetSlot);
            } else if (targetSlot.key === 'presidente') {
                valorAtual = sem?.presidente || null;
            } else {
                valorAtual = getParteFromTargetSlot(sem, targetSlot)?.[targetSlot.key] || null;
            }

            if (!hasPessoaDesignada(valorAtual)) {
                if (targetSlot === slotAtivo) setTimeout(() => setSlotAtivo(null), 10);
                return false;
            }
        }

        if (aluno) {
            const parte = getParteFromTargetSlot(sem, targetSlot);
            if (targetSlot.key !== 'presidente' && !targetSlot.fds && !targetSlot.meioSemana && !parte) {
                alert(TT.parteNaoEncontrada || 'Parte nao encontrada.');
                return false;
            }
            const eligibility = isAlunoEligibleForAssignment({
                aluno,
                parte,
                slotKey: targetSlot.key,
                cargosMap,
                assignedStudent: parte?.estudante,
                lang,
            });

            if (!eligibility.eligible) {
                alert(eligibility.reason || TT.alunoSemHabilitacao || 'Aluno sem habilitacao para esta designacao.');
                return false;
            }

            const conflito = getConflitoDesignacaoSemana(sem, aluno, targetSlot);
            if (conflito) {
                const msg = conflito.severity === 'block'
                    ? (TT.bloqueioConflitoFds || 'Este irmao ja esta em outra funcao principal do fim de semana. Confirmar excecao?')
                    : (TT.confirmarConflitoFds || TT.confirmarDuplicado || 'Este aluno ja esta designado nesta semana. Deseja continuar?');
                if (!window.confirm(`${msg}\n\n${conflito.labels.join(', ')}`)) return false;
            }
        }

        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const semana = { ...lista[semanaRealIndex], partes: [...(lista[semanaRealIndex].partes || [])] };
            const now = new Date().toISOString();
            let registroSubstituicao = null;
            const registrarSubstituicao = (anterior, parte) => {
                const semanaPublicada = semana?.publicadaNoQuadro !== false;
                if ((!options.registrarSubstituicao && !semanaPublicada) || !hasPessoaDesignada(anterior) || mesmaPessoa(anterior, aluno)) return;
                const parteIdSubstituicao = targetSlot.key === 'presidente'
                    ? 'presidente'
                    : (targetSlot.parteId || targetSlot.responsabilidadeKey || targetSlot.key);

                registroSubstituicao = {
                    id: `${Date.now()}-${targetSlot.key}-${parteIdSubstituicao}`,
                    role: targetSlot.key,
                    parteId: parteIdSubstituicao,
                    parteTitulo: targetSlot.key === 'presidente' ? TT.presidente : (parte?.titulo || 'Parte'),
                    de: compactPessoa(anterior),
                    para: compactPessoa(aluno),
                    criadoEm: now,
                    origem: 'designar'
                };
            };

            if (targetSlot.meioSemana) {
                const responsabilidades = getResponsabilidadesMeioSemana(semana);
                const anterior = responsabilidades?.[targetSlot.responsabilidadeKey]?.[targetSlot.itemIndex] || null;
                registrarSubstituicao(anterior, { id: targetSlot.responsabilidadeKey || targetSlot.key, titulo: getFimDeSemanaLabel(targetSlot.key) });
                const atual = [...(responsabilidades[targetSlot.responsabilidadeKey] || [])];
                if (aluno === null) {
                    atual.splice(targetSlot.itemIndex, 1);
                } else {
                    atual[targetSlot.itemIndex] = aluno;
                }
                semana.responsabilidades = normalizeResponsabilidades({
                    ...responsabilidades,
                    [targetSlot.responsabilidadeKey]: atual,
                }, MEIO_SEMANA_RESPONSABILIDADES);
                marcarNotificacaoSemanaPendente(semana, now);
            }
            else if (targetSlot.fds) {
                const fdsAtual = withFimDeSemanaDefaults(semana);
                const anterior = getFimDeSemanaSlotValue(fdsAtual, targetSlot);
                registrarSubstituicao(anterior, { id: targetSlot.responsabilidadeKey || targetSlot.key, titulo: getFimDeSemanaLabel(targetSlot.key) });
                semana.fimDeSemana = setFimDeSemanaSlotValue(fdsAtual, targetSlot, aluno);
                marcarNotificacaoSemanaPendente(semana, now);
            }
            else if (targetSlot.key === 'presidente') {
                registrarSubstituicao(semana.presidente, null);
                semana.presidente = aluno;
                marcarNotificacaoSemanaPendente(semana, now);
            }
            else {
                const idxParte = semana.partes.findIndex(p => p.id === targetSlot.parteId);
                if (idxParte !== -1) {
                    const parteAtual = semana.partes[idxParte];
                    registrarSubstituicao(parteAtual?.[targetSlot.key], parteAtual);
                    semana.partes[idxParte] = marcarNotificacaoPartePendente({ ...parteAtual, [targetSlot.key]: aluno }, semana, now);
                }
            }

            if (registroSubstituicao) {
                semana.substituicoes = [...getSubstituicoesSemana(semana), registroSubstituicao];
                marcarSemanaPublicadaPendente(semana, 'substituicao', now);
                semana.ultimaSubstituicaoEm = now;
            }

            lista[semanaRealIndex] = semana;
            return lista;
        });

        if (targetSlot === slotAtivo) { setTimeout(() => setSlotAtivo(null), 10); }
        return true;
    };

    const aplicarSugestao = (aluno) => {
        const { semanaIndex, key, parteId, fds, meioSemana, responsabilidadeKey, itemIndex } = modalSugestao;
        const aplicado = atribuirAluno(aluno, { key, parteId, semanaIndex, fds, meioSemana, responsabilidadeKey, itemIndex }, { registrarSubstituicao: modalSugestao.modo === 'substituicao' });
        if (aplicado) setModalSugestao({ ...modalSugestao, aberto: false });
    };

    const abrirSubstituicao = (slotCtx, anterior) => {
        if (!slotCtx || !hasPessoaDesignada(anterior)) return;
        setModalSugestao({
            aberto: true,
            semanaIndex: slotCtx.semanaIndex,
            key: slotCtx.key,
            parteId: slotCtx.parteId,
            fds: slotCtx.fds,
            meioSemana: slotCtx.meioSemana,
            responsabilidadeKey: slotCtx.responsabilidadeKey,
            itemIndex: slotCtx.itemIndex,
            modo: 'substituicao',
            anterior: compactPessoa(anterior)
        });
    };

    const atualizarParteNaSemanaRealIndex = (semanaRealIndex, parteId, patch) => {
        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const atual = lista[semanaRealIndex];
            if (!atual || isSemanaAssembleia(atual, config)) return lista; // Trava
            const semana = { ...atual, partes: [...(atual.partes || [])] };
            const idx = semana.partes.findIndex(p => p.id === parteId);
            if (idx === -1) return lista;
            const parteAtualizada = marcarNotificacaoPartePendente({ ...semana.partes[idx], ...patch }, semana);
            semana.partes[idx] = parteAtualizada;
            if (patch?.secao && normalizarSecao(patch.secao) !== normalizarSecao(atual.partes[idx]?.secao)) {
                semana.partes.splice(idx, 1);
                const insertAt = getIndiceInsercaoParte(semana.partes, patch.secao);
                semana.partes.splice(insertAt, 0, parteAtualizada);
            }
            marcarSemanaPublicadaPendente(semana, 'edicao_parte');
            lista[semanaRealIndex] = semana;
            return lista;
        });
    };

    const getIndiceInsercaoParte = (partes, secao) => {
        const alvo = normalizarSecao(secao);
        const alvoOrdem = SECOES_ORDEM.indexOf(alvo);
        const lastSame = partes.reduce((last, p, idx) => (
            normalizarSecao(p?.secao) === alvo && !isAbertura(p) && !isEncerramento(p) ? idx : last
        ), -1);
        if (lastSame >= 0) return lastSame + 1;

        const firstLaterSection = partes.findIndex((p) => {
            if (isAbertura(p) || isEncerramento(p)) return false;
            const ordem = SECOES_ORDEM.indexOf(normalizarSecao(p?.secao));
            return ordem > alvoOrdem;
        });
        if (firstLaterSection >= 0) return firstLaterSection;

        const firstClosing = partes.findIndex(isEncerramento);
        return firstClosing >= 0 ? firstClosing : partes.length;
    };

    const adicionarParteNaSemanaRealIndex = (semanaRealIndex, valores) => {
        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const atual = lista[semanaRealIndex];
            if (!atual || isSemanaAssembleia(atual, config)) return lista;

            const semana = { ...atual, partes: [...(atual.partes || [])] };
            const secao = valores?.secao || 'tesouros';
            const novaParte = marcarNotificacaoPartePendente({
                id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                titulo: valores?.titulo || '',
                descricao: valores?.descricao || '',
                tempo: valores?.tempo || '5',
                tipo: 'parte',
                secao,
                estudante: null,
                ajudante: null
            }, semana);

            const insertAt = getIndiceInsercaoParte(semana.partes, secao);
            semana.partes.splice(insertAt, 0, novaParte);
            marcarSemanaPublicadaPendente(semana, 'adicao_parte');
            lista[semanaRealIndex] = semana;
            return lista;
        });
    };

    const abrirModalEditarParte = (parte, semanaIndexFiltrado) => {
        const sem = listaFiltradaPorFlag[semanaIndexFiltrado];
        if (isSemanaAssembleia(sem, config)) {
            alert(TT.acoesBloqueadasSemanaEvento);
            return;
        }
        setParteEditCtx({
            parteId: parte.id, semanaIndex: semanaIndexFiltrado,
            isLinhaInicialFinal: isLinhaInicialFinal(parte),
            valores: { titulo: (parte?.titulo ?? '').toString(), descricao: (parte?.descricao ?? '').toString(), tempo: String(parte?.tempo ?? ''), secao: normalizarSecao(parte?.secao) }
        });
        setModalEditarOpen(true);
    };

    const abrirModalEditarSemana = (semanaIndexFiltrado) => {
        const sem = listaFiltradaPorFlag[semanaIndexFiltrado];
        if (!sem) return;
        setSemanaEditCtx({
            semanaIndex: semanaIndexFiltrado,
            semanaKey: getSemanaKey(sem, semanaIndexFiltrado),
            valores: {
                semana: (sem?.semana ?? '').toString()
            }
        });
        setModalEditarSemanaOpen(true);
    };

    const abrirModalNovaParte = (secao, semanaIndexFiltrado) => {
        const sem = listaFiltradaPorFlag[semanaIndexFiltrado];
        if (isSemanaAssembleia(sem, config)) {
            alert(TT.acoesBloqueadasSemanaEvento);
            return;
        }
        setParteEditCtx({
            modo: 'novo',
            semanaIndex: semanaIndexFiltrado,
            valores: { titulo: '', descricao: '', tempo: '5', secao }
        });
        setModalEditarOpen(true);
    };

    const salvarEdicaoParte = () => {
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(Number.isInteger(parteEditCtx.semanaIndex) ? parteEditCtx.semanaIndex : semanaAtivaIndexAtual);
        if (semanaRealIndex === -1) return;

        if (parteEditCtx?.modo === 'novo') {
            adicionarParteNaSemanaRealIndex(semanaRealIndex, parteEditCtx.valores || {});
            setModalEditarOpen(false);
            setParteEditCtx(null);
            return;
        }

        if (!parteEditCtx?.parteId) return;
        const sem = listaProgramacoes[semanaRealIndex];
        const parte = (sem?.partes || []).find(p => p.id === parteEditCtx.parteId);
        if (!parte) return;

        const travarTempo = isLinhaInicialFinal(parte);
        const travarSecao = isLinhaInicialFinal(parte);
        atualizarParteNaSemanaRealIndex(semanaRealIndex, parteEditCtx.parteId, {
            titulo: parteEditCtx.valores.titulo,
            descricao: parteEditCtx.valores.descricao,
            ...(travarTempo ? {} : { tempo: parteEditCtx.valores.tempo }),
            ...(travarSecao ? {} : { secao: parteEditCtx.valores.secao || 'tesouros' })
        });
        setModalEditarOpen(false);
        setParteEditCtx(null);
    };

    const salvarEdicaoSemana = () => {
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(Number.isInteger(semanaEditCtx?.semanaIndex) ? semanaEditCtx.semanaIndex : semanaAtivaIndexAtual);
        if (semanaRealIndex === -1) return;

        const proximoTituloSemana = String(semanaEditCtx?.valores?.semana || '').trim();
        if (!proximoTituloSemana) {
            alert(TT.tituloSemanaObrigatorio);
            return;
        }

        const semanaAtual = listaProgramacoes?.[semanaRealIndex];
        const proximaKey = getSemanaKey({ ...semanaAtual, semana: proximoTituloSemana }, semanaRealIndex);

        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const atual = lista[semanaRealIndex];
            if (!atual) return lista;

            const now = new Date().toISOString();
            const semana = { ...atual, semana: proximoTituloSemana };
            marcarNotificacaoSemanaPendente(semana, now);
            marcarSemanaPublicadaPendente(semana, 'edicao_semana', now);
            lista[semanaRealIndex] = semana;
            return lista;
        });

        setSemanasSelecionadas((prev) => {
            if (!semanaEditCtx?.semanaKey || semanaEditCtx.semanaKey === proximaKey) return prev;
            const next = { ...(prev || {}) };
            const estavaSelecionada = !!next[semanaEditCtx.semanaKey];
            delete next[semanaEditCtx.semanaKey];
            if (estavaSelecionada) next[proximaKey] = true;
            return next;
        });

        setModalEditarSemanaOpen(false);
        setSemanaEditCtx(null);
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
            const semana = { ...atual, partes: atual.partes.filter(p => p.id !== parteId) };
            marcarSemanaPublicadaPendente(semana, 'exclusao_parte');
            lista[semanaRealIndex] = semana;
            return lista;
        });

        if (parteEditCtx?.parteId === parteId) { setModalEditarOpen(false); setParteEditCtx(null); }
        if (slotAtivo?.parteId === parteId) setSlotAtivo(null);
    };

    const moverParteNaSemana = (parteId, semanaIndexFiltrado, direcao) => {
        const sem = listaFiltradaPorFlag[semanaIndexFiltrado];
        if (isSemanaAssembleia(sem, config)) return;

        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(semanaIndexFiltrado);
        if (semanaRealIndex === -1) return;

        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const atual = lista[semanaRealIndex];
            if (!atual || isSemanaAssembleia(atual, config)) return lista;

            const partes = [...(atual.partes || [])];
            const idxAtual = partes.findIndex(p => p.id === parteId);
            if (idxAtual === -1) return lista;

            const parteAtual = partes[idxAtual];
            if (isLinhaInicialFinal(parteAtual)) return lista;

            const secaoAtual = normalizarSecao(parteAtual?.secao);
            const indicesDaSecao = partes
                .map((p, idx) => ({ p, idx }))
                .filter(({ p }) => normalizarSecao(p?.secao) === secaoAtual && !isAbertura(p) && !isEncerramento(p))
                .map(({ idx }) => idx);

            const posicaoNaSecao = indicesDaSecao.indexOf(idxAtual);
            const alvoNaSecao = direcao === 'cima' ? posicaoNaSecao - 1 : posicaoNaSecao + 1;
            if (posicaoNaSecao === -1 || alvoNaSecao < 0 || alvoNaSecao >= indicesDaSecao.length) return lista;

            const idxAlvo = indicesDaSecao[alvoNaSecao];
            [partes[idxAtual], partes[idxAlvo]] = [partes[idxAlvo], partes[idxAtual]];

            const semana = { ...atual, partes };
            marcarSemanaPublicadaPendente(semana, 'ordem_partes');
            lista[semanaRealIndex] = semana;
            return lista;
        });
    };

    const atualizarResponsabilidadesMeioSemana = (semanaIndexFiltrado, updater) => {
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(semanaIndexFiltrado);
        if (semanaRealIndex === -1) return;

        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const atual = lista[semanaRealIndex];
            if (!atual || isSemanaAssembleia(atual, config)) return lista;

            const responsabilidadesAtuais = getResponsabilidadesMeioSemana(atual);
            const proximo = typeof updater === 'function'
                ? updater(responsabilidadesAtuais)
                : { ...responsabilidadesAtuais, ...(updater || {}) };
            const semana = {
                ...atual,
                responsabilidades: normalizeResponsabilidades(proximo, MEIO_SEMANA_RESPONSABILIDADES),
            };
            marcarNotificacaoSemanaPendente(semana);
            marcarSemanaPublicadaPendente(semana, 'edicao_responsabilidades_meio_semana');
            lista[semanaRealIndex] = semana;
            return lista;
        });
    };

    const removerResponsavelMeioSemana = (semanaIndexFiltrado, responsabilidadeKey, itemIndex) => {
        atualizarResponsabilidadesMeioSemana(semanaIndexFiltrado, (atuais) => ({
            ...atuais,
            [responsabilidadeKey]: (atuais[responsabilidadeKey] || []).filter((_, idx) => idx !== itemIndex),
        }));
        if (slotAtivo?.meioSemana && slotAtivo?.responsabilidadeKey === responsabilidadeKey && slotAtivo?.itemIndex === itemIndex) {
            setSlotAtivo(null);
        }
    };

    const atualizarFimDeSemana = (semanaIndexFiltrado, updater) => {
        const semanaRealIndex = getSemanaRealIndexFromFilteredIndex(semanaIndexFiltrado);
        if (semanaRealIndex === -1) return;

        setListaProgramacoesSafe(prev => {
            const lista = [...prev];
            const atual = lista[semanaRealIndex];
            if (!atual || isSemanaAssembleia(atual, config)) return lista;

            const atualNormalizado = withFimDeSemanaDefaults(atual);
            const proximo = typeof updater === 'function' ? updater(atualNormalizado) : { ...atualNormalizado, ...(updater || {}) };
            const semana = { ...atual, fimDeSemana: normalizeFimDeSemana(proximo) };
            marcarNotificacaoSemanaPendente(semana);
            marcarSemanaPublicadaPendente(semana, 'edicao_fim_de_semana');
            lista[semanaRealIndex] = semana;
            return lista;
        });
    };

    const setFimDeSemanaPath = (semanaIndexFiltrado, path, value) => {
        atualizarFimDeSemana(semanaIndexFiltrado, (fds) => {
            const next = normalizeFimDeSemana(fds);
            if (path.length === 1) {
                next[path[0]] = value;
            } else if (path.length === 2) {
                next[path[0]] = { ...(next[path[0]] || {}), [path[1]]: value };
            } else if (path.length === 3) {
                next[path[0]] = {
                    ...(next[path[0]] || {}),
                    [path[1]]: {
                        ...((next[path[0]] || {})[path[1]] || {}),
                        [path[2]]: value,
                    },
                };
            }
            return next;
        });
    };

    const setFimDeSemanaAtivo = (semanaIndexFiltrado, ativo) => {
        atualizarFimDeSemana(semanaIndexFiltrado, (fds) => ({
            ...fds,
            ativo,
            data: fds.data || getDefaultFimDeSemanaDataISO(listaFiltradaPorFlag[semanaIndexFiltrado]),
            horario: fds.horario || getDefaultFimDeSemanaHorario(),
        }));
    };

    const removerResponsavelFimDeSemana = (semanaIndexFiltrado, responsabilidadeKey, itemIndex) => {
        atualizarFimDeSemana(semanaIndexFiltrado, (fds) => ({
            ...fds,
            responsabilidades: {
                ...(fds.responsabilidades || {}),
                [responsabilidadeKey]: (fds.responsabilidades?.[responsabilidadeKey] || []).filter((_, idx) => idx !== itemIndex),
            },
        }));
        if (slotAtivo?.fds && slotAtivo?.responsabilidadeKey === responsabilidadeKey && slotAtivo?.itemIndex === itemIndex) {
            setSlotAtivo(null);
        }
    };

    const getFimDeSemanaSlotValue = (fds, targetSlot) => {
        if (!targetSlot?.fds) return null;
        if (targetSlot.responsabilidadeKey) {
            return fds?.responsabilidades?.[targetSlot.responsabilidadeKey]?.[targetSlot.itemIndex] || null;
        }
        if (targetSlot.key === 'presidente_fds') return fds?.presidente || null;
        if (targetSlot.key === 'oracao_fds') return fds?.oracaoFinal || null;
        if (targetSlot.key === 'dirigente_sentinela') return fds?.estudoSentinela?.dirigente || null;
        if (targetSlot.key === 'leitor_sentinela') return fds?.estudoSentinela?.leitor || null;
        return null;
    };

    const setFimDeSemanaSlotValue = (fds, targetSlot, aluno) => {
        const next = normalizeFimDeSemana(fds);
        next.ativo = true;
        if (targetSlot.responsabilidadeKey) {
            const atual = [...(next.responsabilidades[targetSlot.responsabilidadeKey] || [])];
            if (aluno === null) {
                atual.splice(targetSlot.itemIndex, 1);
            } else {
                atual[targetSlot.itemIndex] = aluno;
            }
            next.responsabilidades[targetSlot.responsabilidadeKey] = atual;
            return next;
        }
        if (targetSlot.key === 'presidente_fds') next.presidente = aluno;
        if (targetSlot.key === 'oracao_fds') next.oracaoFinal = aluno;
        if (targetSlot.key === 'dirigente_sentinela') next.estudoSentinela.dirigente = aluno;
        if (targetSlot.key === 'leitor_sentinela') next.estudoSentinela.leitor = aluno;
        return next;
    };

    const renderSlotButton = ({ label, value, onClick, active, hint, emptyText, onSuggest, slotCtx, substituicao, permitirSubstituicao = false, icon: SlotIcon = null, buttonRadiusClass = 'rounded-lg', substituteTitle = TT.substituirDesignado, showLabel = true }) => {
        const isEmpty = !value;
        const isHoveredByDrag = dragOverSlot && slotCtx && sameSlotCtx(dragOverSlot, slotCtx);
        const canSubstitute = permitirSubstituicao && !!value && !!slotCtx;
        const hasActions = !!onSuggest || canSubstitute;

        const currentColorClass = active
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
            : isEmpty
                ? 'border-red-200 bg-red-50 hover:border-red-300 border-dashed'
                : 'border-green-200 bg-green-50 hover:border-green-300 shadow-sm';

        const textColorClass = isEmpty ? 'text-red-400' : 'text-green-900';
        const labelColorClass = isEmpty ? 'text-red-300' : 'text-green-600';

        return (
            <div
                className="relative w-full min-w-0 group/slot"
                onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedAluno && slotCtx && (!dragOverSlot || !sameSlotCtx(dragOverSlot, slotCtx))) {
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
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-w-0 w-full">
                    <button
                        type="button"
                        onClick={onClick}
                        className={`w-full min-w-0 min-h-[38px] py-2 px-3 ${buttonRadiusClass} border-2 transition-all text-left relative focus:outline-none ${isHoveredByDrag ? "ring-2 ring-blue-500 bg-blue-100 border-blue-400 scale-[1.01]" : currentColorClass}`}
                        title={value ? TT.cliquePara : (emptyText || hint || TT.cliquePara)}
                    >
                        {value ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                                {SlotIcon && <SlotIcon size={14} className={`shrink-0 ${active ? 'text-blue-500' : 'text-green-500'}`} />}
                                <div className="flex items-baseline gap-1.5 min-w-0">
                                    {showLabel && <span className={`text-[10px] leading-tight font-black uppercase shrink-0 ${active ? 'text-blue-500' : labelColorClass}`}>{label}:</span>}
                                    <p className={`font-bold text-[13px] leading-tight truncate min-w-0 ${active ? 'text-blue-900' : textColorClass}`}>{value.nome}</p>
                                </div>
                            </div>
                        ) : (
                            <div className={`text-[11px] italic flex items-center gap-1.5 min-w-0 ${active ? 'text-blue-400' : textColorClass}`}>
                                {SlotIcon && <SlotIcon size={14} className={`shrink-0 ${active ? 'text-blue-500' : 'text-red-300'}`} />}
                                {showLabel && <span className={`text-[10px] leading-tight font-black uppercase shrink-0 ${active ? 'text-blue-500' : labelColorClass}`}>{label}:</span>}
                                <p className="flex items-center gap-1 min-w-0 leading-tight">
                                    <UserPlus size={12} className={active ? 'opacity-100' : 'opacity-60'} /> {emptyText || hint || TT.cliquePara}
                                </p>
                            </div>
                        )}
                    </button>
                    {hasActions && (
                        <div className="shrink-0 justify-self-end flex items-center gap-1 self-center">
                            {canSubstitute && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); abrirSubstituicao(slotCtx, value); }} className="p-1.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 shadow-sm" title={substituteTitle}>
                                    <RefreshCw size={12} />
                                </button>
                            )}
                            {onSuggest && (
                                <button type="button" onClick={onSuggest} className="p-1.5 rounded-full bg-yellow-100 text-yellow-600 hover:bg-yellow-200 shadow-sm" title={TT.sugestaoInteligente}>
                                    <Lightbulb size={12} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
                {substituicao && (
                    <div className="mt-1 flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
                        <RefreshCw size={10} />
                        <span className="truncate">{TT.substituicao}: {substituicao.de?.nome || '—'} {TT.para} {substituicao.para?.nome || value?.nome}</span>
                    </div>
                )}
            </div>
        );
    };

    const renderParteCard = (parte, semanaIndexFiltrado) => {
        const secKey = normalizarSecao(parte?.secao);
        const headerClass = isLinhaInicialFinal(parte) ? 'bg-gray-200 text-gray-800' : SECOES_META[secKey]?.header || SECOES_META.vida.header;
        const isCantico = isCanticoIntermediario(parte);
        const semanaDaParte = listaFiltradaPorFlag?.[semanaIndexFiltrado];
        const semanaPublicada = semanaDaParte?.publicadaNoQuadro !== false;
        const getSubstituicaoSlot = (slotCtx, value) => getSubstituicaoAtiva(semanaDaParte, slotCtx, value);

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
                        {!isLinhaInicialFinal(parte) && (
                            <>
                                <button type="button" onClick={() => moverParteNaSemana(parte.id, semanaIndexFiltrado, 'cima')} className="p-1 rounded border border-white/30 bg-white/15 text-white hover:bg-white/30 transition" title={TT.moverCima}><ArrowUp size={12} /></button>
                                <button type="button" onClick={() => moverParteNaSemana(parte.id, semanaIndexFiltrado, 'baixo')} className="p-1 rounded border border-white/30 bg-white/15 text-white hover:bg-white/30 transition" title={TT.moverBaixo}><ArrowDown size={12} /></button>
                            </>
                        )}
                        <button type="button" onClick={() => abrirModalEditarParte(parte, semanaIndexFiltrado)} className={`p-1 rounded border transition ${isLinhaInicialFinal(parte) ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50" : "border-white/20 bg-white/10 text-white hover:bg-white/20"}`} title={TT.editarParte}><Edit2 size={12} /></button>
                        <button type="button" onClick={() => handleExcluirParte(parte.id, semanaIndexFiltrado)} className={`p-1 rounded border transition ${isLinhaInicialFinal(parte) ? "border-gray-300 bg-white text-red-500 hover:bg-red-50" : "border-white/20 bg-white/10 text-white hover:bg-red-500 hover:border-red-500"}`} title={TT.excluirParte}><Trash2 size={12} /></button>
                    </div>
                </div>

                {isCantico ? (
                    <div className="p-2 text-[11px] text-center text-gray-400 italic bg-gray-50 border-t border-gray-100">
                        {TT.nenhumaDesignacaoNecessaria}
                    </div>
                ) : isLinhaInicialFinal(parte) ? (
                    <div className="p-2">
                        {renderSlotButton({
                            label: TT.oracao, value: parte.oracao || null,
                            onClick: () => setSlotAtivo({ key: 'oracao', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                            active: slotAtivo?.key === 'oracao' && slotAtivo?.parteId === parte.id,
                            onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'oracao', parteId: parte.id }); },
                            slotCtx: { key: 'oracao', parteId: parte.id, semanaIndex: semanaIndexFiltrado },
                            substituicao: getSubstituicaoSlot({ key: 'oracao', parteId: parte.id, semanaIndex: semanaIndexFiltrado }, parte.oracao || null),
                            permitirSubstituicao: semanaPublicada
                        })}
                    </div>
                ) : isEstudoBiblicoCongregacao(parte) ? (
                    <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {renderSlotButton({ label: TT.dirigente, value: parte.dirigente, onClick: () => setSlotAtivo({ key: 'dirigente', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'dirigente' && slotAtivo?.parteId === parte.id, onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'dirigente', parteId: parte.id }); }, slotCtx: { key: 'dirigente', parteId: parte.id, semanaIndex: semanaIndexFiltrado }, substituicao: getSubstituicaoSlot({ key: 'dirigente', parteId: parte.id, semanaIndex: semanaIndexFiltrado }, parte.dirigente), permitirSubstituicao: semanaPublicada })}
                        {renderSlotButton({ label: TT.leitor, value: parte.leitor, onClick: () => setSlotAtivo({ key: 'leitor', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'leitor' && slotAtivo?.parteId === parte.id, onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'leitor', parteId: parte.id }); }, slotCtx: { key: 'leitor', parteId: parte.id, semanaIndex: semanaIndexFiltrado }, substituicao: getSubstituicaoSlot({ key: 'leitor', parteId: parte.id, semanaIndex: semanaIndexFiltrado }, parte.leitor), permitirSubstituicao: semanaPublicada })}
                    </div>
                ) : (
                    <div className={`p-2 grid gap-1.5 ${requiresAjudante ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                        {renderSlotButton({ label: TT.estudante, value: parte.estudante, onClick: () => setSlotAtivo({ key: 'estudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }), active: slotAtivo?.key === 'estudante' && slotAtivo?.parteId === parte.id, onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'estudante', parteId: parte.id }); }, slotCtx: { key: 'estudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }, substituicao: getSubstituicaoSlot({ key: 'estudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }, parte.estudante), permitirSubstituicao: semanaPublicada })}

                        {requiresAjudante && renderSlotButton({
                            label: TT.ajudante,
                            value: parte.ajudante,
                            onClick: () => setSlotAtivo({ key: 'ajudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }),
                            active: slotAtivo?.key === 'ajudante' && slotAtivo?.parteId === parte.id,
                            emptyText: TT.opcional,
                            onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: 'ajudante', parteId: parte.id }); },
                            slotCtx: { key: 'ajudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado },
                            substituicao: getSubstituicaoSlot({ key: 'ajudante', parteId: parte.id, semanaIndex: semanaIndexFiltrado }, parte.ajudante),
                            permitirSubstituicao: semanaPublicada
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderResponsabilidadesMeioSemana = (sem, semanaIndexFiltrado) => {
        const responsabilidades = getResponsabilidadesMeioSemana(sem);
        return (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-800">{TT.apoioMeioSemana || TT.responsabilidades}</h4>
                        <p className="text-[10px] font-semibold text-indigo-700/70">{TT.apoioMeioSemanaDescricao || TT.meioDeSemana}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {MEIO_SEMANA_RESPONSABILIDADES.map(({ storageKey, slotKey, labels }) => {
                        const pessoas = responsabilidades[storageKey] || [];
                        const label = TT[storageKey] || labels?.[lang] || labels?.pt || storageKey;
                        const novoSlotCtx = { key: slotKey, semanaIndex: semanaIndexFiltrado, meioSemana: true, responsabilidadeKey: storageKey, itemIndex: pessoas.length };
                        return (
                            <div key={storageKey} className="rounded-lg border border-gray-100 bg-white p-2 space-y-2">
                                <div className="min-h-[32px] flex items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-tight text-gray-500 break-words">{label}</span>
                                </div>
                                {pessoas.length > 0 && (
                                    pessoas.map((pessoa, itemIndex) => {
                                        const slotCtx = { key: slotKey, semanaIndex: semanaIndexFiltrado, meioSemana: true, responsabilidadeKey: storageKey, itemIndex };
                                        return (
                                            <div key={`${storageKey}-${itemIndex}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 items-center">
                                                {renderSlotButton({
                                                    label,
                                                    value: pessoa,
                                                    onClick: () => setSlotAtivo(slotCtx),
                                                    active: sameSlotCtx(slotAtivo, slotCtx),
                                                    onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: slotKey, meioSemana: true, responsabilidadeKey: storageKey, itemIndex }); },
                                                    slotCtx,
                                                    emptyText: TT.opcional,
                                                    showLabel: false,
                                                })}
                                                <button
                                                    type="button"
                                                    onClick={() => removerResponsavelMeioSemana(semanaIndexFiltrado, storageKey, itemIndex)}
                                                    className="p-2 rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 shrink-0"
                                                    title={TT.removerResponsavel}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                                {renderSlotButton({
                                    label,
                                    value: null,
                                    onClick: () => setSlotAtivo(novoSlotCtx),
                                    active: sameSlotCtx(slotAtivo, novoSlotCtx),
                                    onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: slotKey, meioSemana: true, responsabilidadeKey: storageKey, itemIndex: pessoas.length }); },
                                    slotCtx: novoSlotCtx,
                                    emptyText: TT.cliquePara,
                                    showLabel: false,
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderFimDeSemana = (sem, semanaIndexFiltrado, semanaKey) => {
        const fds = getFimDeSemanaParaSemana(sem);
        const isVisita = getTipoEventoSemana(sem, config) === 'visita';
        const temDadosSalvos = hasFimDeSemanaData(sem?.fimDeSemana);
        const aberto = fdsAbertoPorSemana[semanaKey] ?? temDadosSalvos;
        const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400";
        const labelClass = "block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1";
        const getSlotCtx = (key, extra = {}) => ({ key, semanaIndex: semanaIndexFiltrado, fds: true, ...extra });
        const renderPessoaSlot = ({ key, label, value, icon = User, extra = {} }) => {
            const slotCtx = getSlotCtx(key, extra);
            return renderSlotButton({
                label,
                value,
                onClick: () => setSlotAtivo(slotCtx),
                active: sameSlotCtx(slotAtivo, slotCtx),
                onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key, fds: true, ...extra }); },
                slotCtx,
                permitirSubstituicao: false,
                icon,
            });
        };

        const field = (label, value, onChange, props = {}) => (
            <div>
                <label className={labelClass}>{label}</label>
                <input
                    {...props}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={inputClass}
                />
            </div>
        );

        return (
            <div className="rounded-xl border border-sky-100 bg-sky-50/40 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setFdsAbertoPorSemana(prev => ({ ...prev, [semanaKey]: !aberto }))}
                    className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left hover:bg-sky-50 transition"
                >
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-sky-600 shrink-0" />
                            <span className="text-xs font-black uppercase tracking-widest text-sky-800">{TT.fimDeSemana}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${fds.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-500 border-gray-200'}`}>
                                {fds.ativo ? TT.publicada : TT.rascunho}
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-semibold text-sky-700/70 truncate">
                            {fds.data || TT.dataNaoDefinida} {fds.horario ? `• ${fds.horario}` : ''}
                        </p>
                    </div>
                    <ChevronDown size={16} className={`text-sky-700 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                </button>

                {aberto && (
                    <div className="border-t border-sky-100 bg-white/80 p-3 space-y-4">
                        <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-gray-700">
                            <input
                                type="checkbox"
                                checked={!!fds.ativo}
                                onChange={(e) => setFimDeSemanaAtivo(semanaIndexFiltrado, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                            />
                            {TT.ativarFimDeSemana}
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {renderPessoaSlot({ key: 'presidente_fds', label: TT.presidente, value: fds.presidente, icon: User })}
                            {renderPessoaSlot({ key: 'oracao_fds', label: TT.oracaoFinal, value: fds.oracaoFinal, icon: UserRound })}
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-700">{TT.reuniaoPublica}</h4>
                            {field(TT.temaDiscurso, fds.reuniaoPublica.temaDiscurso, (value) => setFimDeSemanaPath(semanaIndexFiltrado, ['reuniaoPublica', 'temaDiscurso'], value), { type: 'text' })}
                            {field(TT.oradorDiscursoPublico, fds.reuniaoPublica.oradorNomeManual, (value) => setFimDeSemanaPath(semanaIndexFiltrado, ['reuniaoPublica', 'oradorNomeManual'], value), { type: 'text' })}
                            {field(TT.congregacaoOrador, fds.reuniaoPublica.congregacaoOrador, (value) => setFimDeSemanaPath(semanaIndexFiltrado, ['reuniaoPublica', 'congregacaoOrador'], value), { type: 'text' })}
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-700">{TT.estudoSentinela}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {renderPessoaSlot({ key: 'dirigente_sentinela', label: TT.dirigenteSentinela, value: fds.estudoSentinela.dirigente, icon: User })}
                                {renderPessoaSlot({ key: 'leitor_sentinela', label: TT.leitorSentinela, value: fds.estudoSentinela.leitor, icon: User })}
                            </div>
                        </div>

                        {isVisita && (
                            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-800">{TT.discursoFinalVisita}</h4>
                                {field(TT.temaDiscurso, fds.visitaSuperintendente.discursoFinal, (value) => setFimDeSemanaPath(semanaIndexFiltrado, ['visitaSuperintendente', 'discursoFinal'], value), { type: 'text' })}
                            </div>
                        )}

                        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-700">{TT.apoioFimDeSemana || TT.responsabilidades}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {FIM_DE_SEMANA_RESPONSABILIDADES.map(({ storageKey, slotKey, labels }) => {
                                    const pessoas = fds.responsabilidades[storageKey] || [];
                                    const label = TT[storageKey] || labels?.[lang] || labels?.pt || storageKey;
                                    const novoSlotCtx = getSlotCtx(slotKey, { responsabilidadeKey: storageKey, itemIndex: pessoas.length });
                                    return (
                                        <div key={storageKey} className="rounded-lg border border-gray-100 bg-gray-50 p-2 space-y-2">
                                            <div className="min-h-[32px] flex items-center">
                                                <span className="text-[10px] font-black uppercase tracking-widest leading-tight text-gray-500 break-words">{label}</span>
                                            </div>
                                            {pessoas.length > 0 && (
                                                pessoas.map((pessoa, itemIndex) => {
                                                    const slotCtx = getSlotCtx(slotKey, { responsabilidadeKey: storageKey, itemIndex });
                                                    return (
                                                        <div key={`${storageKey}-${itemIndex}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 items-center">
                                                            {renderSlotButton({
                                                                label,
                                                                value: pessoa,
                                                                onClick: () => setSlotAtivo(slotCtx),
                                                                active: sameSlotCtx(slotAtivo, slotCtx),
                                                                onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: slotKey, fds: true, responsabilidadeKey: storageKey, itemIndex }); },
                                                                slotCtx,
                                                                emptyText: TT.opcional,
                                                                showLabel: false,
                                                            })}
                                                            <button
                                                                type="button"
                                                                onClick={() => removerResponsavelFimDeSemana(semanaIndexFiltrado, storageKey, itemIndex)}
                                                                className="p-2 rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 shrink-0"
                                                                title={TT.removerResponsavel}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    );
                                                })
                                            )}
                                            {renderSlotButton({
                                                label,
                                                value: null,
                                                onClick: () => setSlotAtivo(novoSlotCtx),
                                                active: sameSlotCtx(slotAtivo, novoSlotCtx),
                                                onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: semanaIndexFiltrado, key: slotKey, fds: true, responsabilidadeKey: storageKey, itemIndex: pessoas.length }); },
                                                slotCtx: novoSlotCtx,
                                                emptyText: TT.cliquePara,
                                                showLabel: false,
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full min-h-screen bg-gray-50 relative font-sans text-gray-800">

            <DesignarHeader
                headerRef={stickyHeaderRef}
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
                semanaAtivaIndex={semanaAtivaIndexAtual}
                setSemanaAtivaIndex={setSemanaAtivaIndex}
                userClearedWeeksRef={userClearedWeeksRef}
                onRepublicarQuadroPublico={republicarQuadroPublico}
            />

            <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 py-3 sm:py-4">
                <div className="flex flex-col lg:flex-row gap-6 pb-20 items-stretch lg:items-start">

                    <NavegadorSemanas
                        listaSemanas={listaFiltradaPorFlag}
                        semanasSelecionadas={semanasSelecionadas}
                        semanaAtivaIndex={semanaAtivaIndexAtual}
                        setSemanaAtivaIndex={setSemanaAtivaIndex}
                        getSemanaKey={getSemanaKey}
                        stickyOffset={stickyOffset}
                        TT={TT}
                        lang={lang}
                        config={config}
                    />

                    {/* COLUNA CENTRAL */}
                    <div className="w-full flex-1 space-y-4 min-w-0">
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
                                        <p className="text-sm font-medium">{TT.nenhumaSemanaFiltro}</p>
                                    </div>
                                ) : semanasParaExibir.length === 0 ? (
                                    <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                        <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm font-medium">{TT.selecioneSemana}</p>
                                    </div>
                                ) : (
                                    semanasParaExibir.map(({ sem, idx, key }) => {
                                        const partesDaSemana = Array.isArray(sem?.partes) ? sem.partes : [];
                                        const tempoTotalMeta = getTempoTotalMeta(partesDaSemana);
                                        const isArq = !!sem?.arquivada;
                                        const publicadaNoQuadro = sem?.publicadaNoQuadro !== false;
                                        const substituicoesSemana = getSubstituicoesSemana(sem);
                                        const agendaPendenteSync = !!(sem?.agendaPendenteSync || sem?.needsCalendarSync);
                                        const historicoPendenteSync = !!sem?.historicoPendenteSync;
                                        const substituicaoPresidente = getSubstituicaoAtiva(sem, { key: 'presidente', semanaIndex: idx }, sem?.presidente);

                                        const tipoEvento = getTipoEventoSemana(sem, config);
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
                                            <div id={`semana-${key}`} key={key} className={`w-full scroll-mt-40 rounded-2xl border p-2.5 space-y-2.5 transition-all ${cardBgClass}`}>

                                                {/* CABEÇALHO DA SEMANA */}
                                                <div className={`rounded-xl border px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isVisita ? 'bg-white/80 border-blue-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                    <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                                                        <h3 className="font-black text-[15px] text-gray-800 min-w-0 flex flex-wrap items-center gap-2">
                                                            <span className="min-w-0 truncate">{sem?.semana || `${TT.semana} ${idx + 1}`}</span>
                                                            {isVisita && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-600 text-white border border-blue-700 flex items-center gap-1 uppercase tracking-wider animate-pulse"><Briefcase size={10} /> {TT.visitaSC}</span>}
                                                            {isAssembly && !tipoEvento.includes('congresso') && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-1"><Tent size={10} /> {TT.assembleia}</span>}
                                                            {isAssembly && tipoEvento.includes('congresso') && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1"><UsersRound size={10} /> {TT.congresso}</span>}
                                                             <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 uppercase tracking-wider ${publicadaNoQuadro ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                                 {publicadaNoQuadro ? <Eye size={10} /> : <EyeOff size={10} />}
                                                                 {publicadaNoQuadro ? TT.publicada : TT.rascunho}
                                                             </span>
                                                            {!isAssembly && (
                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 uppercase tracking-wider ${tempoTotalMeta.className}`} title={formatText(TT.tempoTotalTooltipTpl, { tempo: tempoTotalMeta.label })}>
                                                                    <Clock size={10} /> {tempoTotalMeta.label}
                                                                </span>
                                                            )}
                                                            {agendaPendenteSync && (
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 uppercase tracking-wider bg-amber-50 text-amber-700 border-amber-200">
                                                                    <Calendar size={10} /> {TT.agendaPendente}
                                                                </span>
                                                            )}
                                                            {historicoPendenteSync && (
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 uppercase tracking-wider bg-orange-50 text-orange-700 border-orange-200">
                                                                    <Archive size={10} /> {TT.historicoPendente}
                                                                </span>
                                                            )}
                                                            {substituicoesSemana.length > 0 && (
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 uppercase tracking-wider bg-orange-50 text-orange-700 border-orange-200">
                                                                    <RefreshCw size={10} /> {formatText(TT.substituicoesAbrevTpl, { count: substituicoesSemana.length })}
                                                                </span>
                                                             )}
                                                         </h3>
                                                        <p className="text-[11px] text-gray-500 flex items-center gap-1 min-w-0">
                                                            {displayDateExtenso ? (
                                                                <>
                                                                    <Calendar size={10} className="shrink-0" />
                                                                    <strong className={`min-w-0 ${isVisita ? 'text-blue-700' : ''}`}>
                                                                        {displayDateExtenso}
                                                                    </strong>
                                                                </>
                                                            ) : <span>{TT.dataNaoDefinida}</span>}
                                                        </p>
                                                    </div>
                                                    <div className="flex w-full sm:w-auto justify-end gap-1.5 shrink-0">
                                                        <button onClick={() => abrirModalEditarSemana(idx)} className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition" title={TT.editarSemana}>
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button onClick={() => togglePublicacaoSemana(key)} className={`p-1.5 rounded-lg border bg-white transition ${publicadaNoQuadro ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`} title={publicadaNoQuadro ? 'Ocultar do quadro público' : 'Publicar no quadro público'}>
                                                            {publicadaNoQuadro ? <Eye size={14} /> : <EyeOff size={14} />}
                                                        </button>
                                                        <button onClick={() => toggleArquivadaSemana(key, !isArq)} className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition" title={isArq ? TT.restaurar : TT.arquivar}>
                                                            {isArq ? <RotateCcw size={14} /> : <Archive size={14} />}
                                                        </button>
                                                        <button onClick={() => handleExcluirSemana(key)} className="p-1.5 rounded-lg border bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 transition">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {(agendaPendenteSync || historicoPendenteSync) && !isAssembly && (
                                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 flex items-center gap-2">
                                                                    <RefreshCw size={13} className="shrink-0" />
                                                                    <span>{TT.avisoSubstituicaoSemana}</span>
                                                    </div>
                                                )}

                                                {/* 🔥 AVISO CHAMATIVO NA TELA (Substitui as partes) */}
                                                {isAssembly ? (
                                                    <div className="bg-white rounded-xl border-2 border-dashed border-yellow-300 p-6 text-center flex flex-col items-center justify-center gap-2">
                                                        <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
                                                            {tipoEvento.includes('congresso') ? <UsersRound size={32} /> : <Tent size={32} />}
                                                        </div>
                                                        <h3 className="text-lg font-bold text-gray-700">{TT.semanaDe} {tipoEvento.includes('congresso') ? TT.congresso : TT.assembleia}</h3>
                                                        <p className="text-xs text-gray-500 max-w-md">{TT.semReuniaoEventoDescricao}</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-2 px-1 pt-1">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{TT.meioDeSemana}</span>
                                                            <span className="h-px flex-1 bg-gray-200" />
                                                        </div>

                                                        {/* PRESIDENTE */}
                                                        {renderSlotButton({
                                                            label: TT.presidente,
                                                            value: sem.presidente || null,
                                                            onClick: () => setSlotAtivo({ key: 'presidente', semanaIndex: idx }),
                                                            active: slotAtivo?.key === 'presidente' && slotAtivo?.semanaIndex === idx,
                                                            onSuggest: (e) => { e.stopPropagation(); setModalSugestao({ aberto: true, semanaIndex: idx, key: 'presidente' }); },
                                                            slotCtx: { key: 'presidente', semanaIndex: idx },
                                                            substituicao: substituicaoPresidente,
                                                            permitirSubstituicao: publicadaNoQuadro,
                                                            icon: User,
                                                            buttonRadiusClass: 'rounded-xl',
                                                            substituteTitle: TT.substituirPresidente
                                                        })}

                                                        {/* PARTES INICIAIS E SECOES */}
                                                        <div className="space-y-2">{partesDaSemana.filter(isAbertura).map(p => renderParteCard(p, idx))}</div>

                                                        <div className="space-y-2.5">
                                                            {SECOES_ORDEM.map(secKey => {
                                                                const partesSecao = partesDaSemana.filter(p => normalizarSecao(p.secao) === secKey && !isAbertura(p) && !isEncerramento(p));
                                                                return (
                                                                    <div key={secKey} className="space-y-2">
                                                                        <div className={`rounded-lg overflow-hidden border ${SECOES_META[secKey].border} shadow-sm`}>
                                                                            <div className={`${SECOES_META[secKey].header} px-3 py-1.5 flex items-center justify-between`}>
                                                                                <span className="text-[10px] font-black tracking-widest uppercase">{getSecaoTitulo(secKey)}</span>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${SECOES_META[secKey].pill}`}>{partesSecao.length} {TT.itens}</span>
                                                                                    <button type="button" onClick={() => abrirModalNovaParte(secKey, idx)} className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-black shadow-sm transition ${SECOES_META[secKey].actionButton}`} title={TT.adicionarParte}>
                                                                                        <Plus size={12} />
                                                                                        <span>{TT.adicionar}</span>
                                                                                    </button>
                                                                                </div>
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

                                                        {renderResponsabilidadesMeioSemana(sem, idx)}

                                                        {renderFimDeSemana(sem, idx, key)}
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
                        TT={TT} buildSlotLabel={() => slotAtivo ? formatText(TT.atribuindoTpl, { slot: (slotAtivo.fds || slotAtivo.meioSemana) ? getFimDeSemanaLabel(slotAtivo.key) : slotAtivo.key }) : TT.alunos}
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
                        getAlunoEligibilityForSlot={getAlunoEligibilityForSlot}
                        setDraggedAluno={setDraggedAluno}
                        semanasSelecionadas={semanasSelecionadas}
                        dragOverSlot={dragOverSlot}
                        stickyOffset={stickyOffset}
                    />

                </div>
            </div>

            {/* MODAL: Editar parte */}
            {modalEditarOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModalEditarOpen(false); setParteEditCtx(null); }} />
                    <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border overflow-hidden">
                        <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between">
                            <div className="text-sm font-black">{parteEditCtx?.modo === 'novo' ? TT.adicionarParte : TT.editarParte}</div>
                            <button type="button" onClick={() => { setModalEditarOpen(false); setParteEditCtx(null); }} className="p-1 rounded hover:bg-white/10 transition" title={TT.cancelar}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            {!parteEditCtx?.isLinhaInicialFinal && (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">{TT.secao}</label>
                                    <select value={parteEditCtx?.valores?.secao ?? 'tesouros'} onChange={(e) => setParteEditCtx(prev => ({ ...prev, valores: { ...(prev?.valores || {}), secao: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                                        {SECOES_ORDEM.map(secKey => (
                                            <option key={secKey} value={secKey}>{getSecaoTitulo(secKey)}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
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

            {modalEditarSemanaOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModalEditarSemanaOpen(false); setSemanaEditCtx(null); }} />
                    <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border overflow-hidden">
                        <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between">
                            <div className="text-sm font-black">{TT.editarSemana}</div>
                            <button type="button" onClick={() => { setModalEditarSemanaOpen(false); setSemanaEditCtx(null); }} className="p-1 rounded hover:bg-white/10 transition" title={TT.cancelar}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">{TT.tituloSemana}</label>
                                <input
                                    type="text"
                                    value={semanaEditCtx?.valores?.semana ?? ''}
                                    onChange={(e) => setSemanaEditCtx(prev => ({ ...prev, valores: { ...(prev?.valores || {}), semana: e.target.value } }))}
                                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                        </div>

                        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                            <button type="button" onClick={() => { setModalEditarSemanaOpen(false); setSemanaEditCtx(null); }} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-100 transition text-sm font-bold inline-flex items-center gap-2">
                                <X size={16} /> {TT.cancelar}
                            </button>
                            <button type="button" onClick={salvarEdicaoSemana} className="px-3 py-2 rounded-lg border bg-blue-600 hover:bg-blue-700 text-white transition text-sm font-bold inline-flex items-center gap-2">
                                <Save size={16} /> {TT.salvar}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SUGESTÃO */}
            <ModalSugestao isOpen={modalSugestao.aberto} onClose={() => setModalSugestao({ ...modalSugestao, aberto: false })} onSelect={aplicarSugestao} alunos={alunos} historico={listaProgramacoes} parteAtual={modalSugestao.parteId ? listaFiltradaPorFlag?.[modalSugestao.semanaIndex]?.partes?.find(p => p.id === modalSugestao.parteId) : null} semanaAtual={listaFiltradaPorFlag?.[modalSugestao.semanaIndex]} modalKey={modalSugestao.key} cargosMap={cargosMap} lang={lang} modo={modalSugestao.modo} pessoaAtual={modalSugestao.anterior} />
        </div>
    );
};

export default Designar;
