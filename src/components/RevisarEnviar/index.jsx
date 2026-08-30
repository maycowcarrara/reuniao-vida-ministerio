import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Printer,
    MessageCircle,
    Archive,
    Mail,
    CheckCircle,
    Briefcase,
    Tent,
    UsersRound,
    Edit2,
    Trash2,
    Clock,
    Plus,
    RotateCcw
} from 'lucide-react';

import RevisarEnviarHeader from './RevisarEnviarHeader';
import "./revisarEnviar.print.css";
import RevisarEnviarNotificarTab from './RevisarEnviarNotificarTab';

import { getI18n } from '../../utils/revisarEnviar/translations';
import { getMeetingDateISOFromSemana, formatarDataFolha, getSemanaSortTimestamp } from '../../utils/revisarEnviar/dates';
import { buildWhatsappHref, buildMailtoHref } from '../../utils/revisarEnviar/links';
import { addHistorico } from '../../utils/revisarEnviar/historico';
import { toast } from '../../utils/toast';
import { getEventoEspecialDaSemana, getTipoEventoSemana } from '../../utils/eventos';
import { formatText } from '../../i18n';
import {
    FIM_DE_SEMANA_RESPONSABILIDADES,
    MEIO_SEMANA_RESPONSABILIDADES,
    getMeioSemanaAssignedPeople,
    hasFimDeSemanaData,
    hasResponsabilidadesData,
    normalizeFimDeSemana,
    normalizeResponsabilidades
} from '../../utils/fimDeSemana';
import {
    getMeetingPartTypeNormalized,
    getPrayerPartPosition,
    isBibleStudyPart,
    isPrayerPart,
    isSongOnlyPart
} from '../../utils/meetingParts';

const hasPessoaDesignada = (pessoa) => !!(pessoa?.id || pessoa?.nome);

const temFimDeSemanaDesignado = (sem) => {
    const fds = normalizeFimDeSemana(sem?.fimDeSemana);
    if (!fds.ativo) return false;
    if (hasPessoaDesignada(fds.presidente) || hasPessoaDesignada(fds.oracaoFinal)) return true;
    if ((fds.reuniaoPublica.temaDiscurso || '').trim()) return true;
    if ((fds.reuniaoPublica.oradorNomeManual || '').trim()) return true;
    if ((fds.reuniaoPublica.congregacaoOrador || '').trim()) return true;
    if (hasPessoaDesignada(fds.estudoSentinela.dirigente) || hasPessoaDesignada(fds.estudoSentinela.leitor)) return true;
    if ((fds.visitaSuperintendente.discursoFinal || '').trim()) return true;
    return FIM_DE_SEMANA_RESPONSABILIDADES.some(({ storageKey }) =>
        (fds.responsabilidades[storageKey] || []).some(hasPessoaDesignada)
    );
};

const RevisarEnviar = ({
    historico,
    alunos,
    config,
    confirmacoes = [],
    onAlunosChange,
    onProgramacoesChange = null,
    sharedWeekSelection = {},
    setSharedWeekSelection = () => { },
    reviewShortcutRequest = null,
    onSolicitarSubstituicao = null
}) => {
    const { lang, t } = getI18n(config);

    const [startIndex, setStartIndex] = useState(0);
    const [qtdSemanas, setQtdSemanas] = useState(1);
    const [incluirFimDeSemana, setIncluirFimDeSemana] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('imprimir');
    const [filtroSemanas, setFiltroSemanas] = useState('ativas');
    const [sentMap, setSentMap] = useState({});

    useEffect(() => {
        if (!reviewShortcutRequest?.token) return;
        if (reviewShortcutRequest.tab) {
            setAbaAtiva(reviewShortcutRequest.tab);
        }
    }, [reviewShortcutRequest]);

    useEffect(() => {
        if (qtdSemanas !== 1 && incluirFimDeSemana) {
            setIncluirFimDeSemana(false);
        }
    }, [qtdSemanas, incluirFimDeSemana]);

    // --- HELPERS DE TIPO E DETECÇÃO ---
    const normalizar = (texto = '') =>
        texto
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

    const isOracao = (p) => isPrayerPart(p);
    const isEstudo = (p) => isBibleStudyPart(p);
    const getOracaoPos = (p) => getPrayerPartPosition(p);

    const nomeCurto = (nome = '') => {
        const partes = nome.trim().split(/\s+/);
        if (partes.length === 1) return partes[0];
        return `${partes[0]} ${partes[partes.length - 1][0]}.`;
    };

    // --- HELPERS DE RENDERIZAÇÃO ---
    const getSecaoChip = (secao) => {
        const txtSecoes = t.secoes || {};
        const lower = (secao || '').toLowerCase();
        if (lower === 'tesouros') return { label: txtSecoes.tesouros || 'Tesouros', cls: 're-chip-tesouros' };
        if (lower === 'ministerio') return { label: txtSecoes.ministerio || 'Ministério', cls: 're-chip-ministerio' };
        if (lower === 'vida') return { label: txtSecoes.vida || 'Vida Cristã', cls: 're-chip-vida' };
        return { label: secao, cls: 're-chip-outros' };
    };

    const montarNomesLista = ({ parte, semana }) => {
        const eEbc = isEstudo(parte);
        const eOra = isOracao(parte);

        const principal = eEbc
            ? (parte.dirigente || parte.estudante)
            : eOra
                ? (parte.oracao || parte.estudante)
                : parte.estudante;

        const ajudante = parte.ajudante;
        const leitor = eEbc ? (parte.leitor || semana?.leitor) : null;

        let str = principal?.nome || '—';

        if (ajudante?.nome) {
            str += ` / ${nomeCurto(ajudante.nome)}`;
        }
        if (leitor?.nome) {
            str += ` • L: ${nomeCurto(leitor.nome)}`;
        }

        return str;
    };

    const historicoOrdenado = useMemo(() => {
        return [...historico].sort((a, b) => getSemanaSortTimestamp(a, config) - getSemanaSortTimestamp(b, config));
    }, [historico, config]);

    const historicoSelect = useMemo(() => [...historicoOrdenado].reverse(), [historicoOrdenado]);

    // Auto-ajuste do startIndex agora respeita o filtro selecionado (Ativas vs Arquivadas)
    useEffect(() => {
        if (historicoSelect.length > 0) {
            let indexMaisAntiga = -1;

            for (let i = historicoSelect.length - 1; i >= 0; i--) {
                const isArq = !!historicoSelect[i].arquivada;

                if (filtroSemanas === 'ativas' && !isArq) {
                    indexMaisAntiga = i;
                    break;
                }
                if (filtroSemanas === 'arquivadas' && isArq) {
                    indexMaisAntiga = i;
                    break;
                }
                if (filtroSemanas === 'todas') {
                    indexMaisAntiga = i;
                    break;
                }
            }

            if (indexMaisAntiga !== -1) {
                setStartIndex(indexMaisAntiga);
            } else {
                setStartIndex(0);
            }
        }
    }, [historicoSelect, filtroSemanas]);

    const realStartIndex = historicoOrdenado.length - 1 - startIndex;
    const startSeguro = Math.max(0, realStartIndex);

    // --- MÁGICA DA HIDRATAÇÃO (Dados Sempre Atualizados) ---
    const semanasDisponiveisBase = useMemo(() => {
        const hidratar = (snap) => {
            if (!snap || !snap.id) return snap;
            const fresco = alunos.find(a => a.id === snap.id);
            return fresco ? { ...snap, ...fresco } : snap;
        };

        return historicoOrdenado.slice(startSeguro).map(sem => {
            const newSem = { ...sem };
            if (newSem.presidente) newSem.presidente = hidratar(newSem.presidente);
            if (newSem.leitor) newSem.leitor = hidratar(newSem.leitor);
            if (newSem.partes) {
                newSem.partes = newSem.partes.map(p => ({
                    ...p,
                    estudante: hidratar(p.estudante),
                    ajudante: hidratar(p.ajudante),
                    oracao: hidratar(p.oracao),
                    dirigente: hidratar(p.dirigente),
                    leitor: hidratar(p.leitor),
                }));
            }
            if (newSem.responsabilidades) {
                newSem.responsabilidades = Object.fromEntries(
                    Object.entries(newSem.responsabilidades || {}).map(([key, value]) => [
                        key,
                        Array.isArray(value) ? value.map(hidratar) : [],
                    ])
                );
            }
            if (newSem.fimDeSemana) {
                const fds = normalizeFimDeSemana(newSem.fimDeSemana);
                newSem.fimDeSemana = {
                    ...fds,
                    presidente: hidratar(fds.presidente),
                    oracaoFinal: hidratar(fds.oracaoFinal),
                    reuniaoPublica: {
                        ...fds.reuniaoPublica,
                    },
                    estudoSentinela: {
                        ...fds.estudoSentinela,
                        dirigente: hidratar(fds.estudoSentinela.dirigente),
                        leitor: hidratar(fds.estudoSentinela.leitor),
                    },
                    responsabilidades: Object.fromEntries(
                        Object.entries(fds.responsabilidades || {}).map(([key, value]) => [
                            key,
                            Array.isArray(value) ? value.map(hidratar) : [],
                        ])
                    ),
                };
            }
            return newSem;
        });
    }, [historicoOrdenado, startSeguro, alunos]);

    const semanasDisponiveis = useMemo(() => {
        if (filtroSemanas === 'todas') return semanasDisponiveisBase;
        if (filtroSemanas === 'arquivadas') return semanasDisponiveisBase.filter(s => !!s?.arquivada);
        return semanasDisponiveisBase.filter(s => !s?.arquivada);
    }, [semanasDisponiveisBase, filtroSemanas]);

    // --- SELEÇÃO DE SEMANAS (CHIPS) ---
    const prevStartSeguroRef = useRef(startSeguro);
    const userClearedRef = useRef(false);
    const printSelecionadas = useMemo(() => sharedWeekSelection || {}, [sharedWeekSelection]);
    const setPrintSelecionadas = setSharedWeekSelection;
    const getSemanaKey = (sem, idx) => (sem?.id ?? sem?.dataReuniao ?? sem?.dataInicio ?? sem?.dataExata ?? sem?.data ?? String(idx)).toString();

    useEffect(() => {
        const startChanged = prevStartSeguroRef.current !== startSeguro;
        if (!startChanged && userClearedRef.current) return;

        const hasAnySelected = Object.values(printSelecionadas || {}).some(Boolean);
        if (hasAnySelected) {
            prevStartSeguroRef.current = startSeguro;
            return;
        }

        const visibleKeys = new Set(semanasDisponiveis.map((s, i) => getSemanaKey(s, i)));
        const hasAnyVisibleSelected = Object.keys(printSelecionadas || {}).some((key) => visibleKeys.has(key) && !!printSelecionadas[key]);
        if (!startChanged && hasAnyVisibleSelected) return;

        if (startChanged) userClearedRef.current = false;

        const base = semanasDisponiveis.slice(0, qtdSemanas);
        const next = {};
        base.forEach((s, i) => {
            next[getSemanaKey(s, i)] = true;
        });
        setPrintSelecionadas(next);

        prevStartSeguroRef.current = startSeguro;
    }, [startSeguro, semanasDisponiveis, qtdSemanas, printSelecionadas, setPrintSelecionadas]);

    const toggleSemanaPrint = (key) => {
        userClearedRef.current = false;
        setPrintSelecionadas((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const selecionarTodasPrint = () => {
        userClearedRef.current = false;
        const next = {};
        semanasDisponiveis.forEach((s, i) => {
            next[getSemanaKey(s, i)] = true;
        });
        setPrintSelecionadas(next);
    };

    const limparPrint = () => {
        userClearedRef.current = true;
        setPrintSelecionadas({});
    };

    const semanasParaImprimir = useMemo(() => {
        const marcadas = semanasDisponiveis.filter((s, i) => {
            const k = getSemanaKey(s, i);
            return !!printSelecionadas[k];
        });

        if (userClearedRef.current && marcadas.length === 0) return [];
        return marcadas.length ? marcadas : semanasDisponiveis.slice(0, qtdSemanas);
    }, [semanasDisponiveis, printSelecionadas, qtdSemanas]);

    const selecaoTemFimDeSemanaDesignado = useMemo(
        () => qtdSemanas === 1 && semanasParaImprimir.some(temFimDeSemanaDesignado),
        [qtdSemanas, semanasParaImprimir]
    );

    useEffect(() => {
        if (selecaoTemFimDeSemanaDesignado && !incluirFimDeSemana) {
            setIncluirFimDeSemana(true);
        }
    }, [selecaoTemFimDeSemanaDesignado, incluirFimDeSemana]);

    // --- CÁLCULO DE DATA ---
    const getDataReuniaoISO = (sem) => {
        const eventoEspecial = getEventoEspecialDaSemana(sem, config);
        const tipoEvento = getTipoEventoSemana(sem, config);
        const isVisita = tipoEvento === 'visita';

        // 🚨 A CORREÇÃO ESTÁ AQUI:
        // Se houver data manual, respeita... a menos que seja Visita!
        // Isso impede que o "dataInput" salvo como segunda-feira atropele nosso cálculo.
        if (eventoEspecial?.dataInput && !isVisita) {
            return eventoEspecial.dataInput;
        }

        // Data base para segurança
        const fallbackStr = sem?.dataReuniao || sem?.dataExata || sem?.dataInicio || sem?.data;

        // 1º PRIORIDADE: Calcular o dia correto com base nas configurações
        let dataCalculada = getMeetingDateISOFromSemana({
            semanaStr: sem?.semana,
            config,
            isoFallback: fallbackStr,
            overrideDia: isVisita ? 'terça-feira' : null
        });

        // Caso a função falhe e retorne nulo, pegamos a data de segurança
        if (!dataCalculada) {
            dataCalculada = fallbackStr;
        }

        // 🔥 TRAVA MATEMÁTICA: Garante que caia na terça-feira
        if (isVisita && dataCalculada) {
            const [ano, mes, dia] = dataCalculada.split('-').map(Number);
            const d = new Date(ano, mes - 1, dia, 12, 0, 0); // 12h para evitar bug de fuso horário

            if (d.getDay() !== 2) {
                const diff = 2 - d.getDay();
                d.setDate(d.getDate() + diff);

                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            }
        }

        return dataCalculada;
    };

    const getDataFimDeSemanaISO = (sem) => {
        const fallbackStr = sem?.fimDeSemana?.data || sem?.dataReuniao || sem?.dataExata || sem?.dataInicio || sem?.data;
        return getMeetingDateISOFromSemana({
            semanaStr: sem?.semana,
            config,
            isoFallback: fallbackStr,
            overrideDia: config?.dia_reuniao_fds || config?.diaReuniaoFds || 'saturday'
        }) || fallbackStr || '';
    };

    const getFimDeSemanaParaImpressao = (sem) => {
        const fds = normalizeFimDeSemana(sem?.fimDeSemana);
        return {
            ...fds,
            data: getDataFimDeSemanaISO(sem) || fds.data,
            horario: config?.horario_fds || config?.horarioFimDeSemana || fds.horario || '18:00',
        };
    };

    const formatarDataCurtaTitulo = (dataISO) => {
        if (!dataISO) return '';
        const [ano, mes, dia] = dataISO.split('-').map(Number);
        if (![ano, mes, dia].every(Number.isFinite)) return '';
        return `${dia}/${mes}`;
    };

    const montarTituloReuniaoPrint = (titulo, dataISO) => {
        const dataCurta = formatarDataCurtaTitulo(dataISO);
        return dataCurta ? `${titulo} (${dataCurta})` : titulo;
    };

    const renderResponsabilidadesMeioSemanaPrint = (semana) => {
        if (qtdSemanas !== 1 || !hasResponsabilidadesData(semana?.responsabilidades, MEIO_SEMANA_RESPONSABILIDADES)) return null;
        const responsabilidades = normalizeResponsabilidades(semana?.responsabilidades, MEIO_SEMANA_RESPONSABILIDADES);
        const linhas = MEIO_SEMANA_RESPONSABILIDADES
            .map(({ storageKey, labels }) => {
                const nomes = (responsabilidades[storageKey] || []).map((pessoa) => pessoa?.nome).filter(Boolean);
                if (nomes.length === 0) return null;
                return {
                    label: t[storageKey] || labels?.[lang] || labels?.pt || storageKey,
                    nomes: nomes.join(', '),
                };
            })
            .filter(Boolean);

        if (linhas.length === 0) return null;

        return (
            <div className="mt-2 border-t border-gray-200 pt-2 print:mt-1.5 print:pt-1">
                <h3 className="text-[12px] print:text-[11px] font-black uppercase tracking-wide text-gray-700">
                    {t.apoioMeioSemana || t.responsabilidades || 'Apoio do meio de semana'}
                </h3>
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] print:text-[10.5px] leading-tight">
                    {linhas.map((item) => (
                        <div key={item.label} className="grid grid-cols-[105px_1fr] gap-2">
                            <span className="font-black text-gray-500 uppercase">{item.label}</span>
                            <span className="font-semibold text-gray-900">{item.nomes}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderFimDeSemanaPrint = (semana) => {
        const fds = getFimDeSemanaParaImpressao(semana);
        if (!incluirFimDeSemana || qtdSemanas !== 1 || !fds.ativo || !hasFimDeSemanaData(semana?.fimDeSemana)) return null;
        const isVisita = getTipoEventoSemana(semana, config) === 'visita';
        const oradorNome = fds.reuniaoPublica.oradorNomeManual || '';
        const congregacaoOrador = fds.reuniaoPublica.congregacaoOrador || '';
        const oradorComCongregacao = [
            oradorNome,
            congregacaoOrador ? `(${congregacaoOrador})` : '',
        ].filter(Boolean).join(' ');
        const temaDiscurso = (fds.reuniaoPublica.temaDiscurso || '').trim();
        const dirigenteSentinelaNome = (fds.estudoSentinela.dirigente?.nome || '').trim();
        const leitorSentinelaNome = (fds.estudoSentinela.leitor?.nome || '').trim();
        const temReuniaoPublica = !!(temaDiscurso || oradorNome.trim());
        const temEstudoSentinela = !!(dirigenteSentinelaNome || leitorSentinelaNome);
        const discursoFinalVisita = (fds.visitaSuperintendente.discursoFinal || '').trim();
        const tituloFimDeSemana = montarTituloReuniaoPrint(t.reuniaoFimDeSemana || 'Reunião de fim de semana', fds.data);
        const fimDeSemanaMeta = [
            fds.data ? formatarDataFolha(fds.data, lang) : '',
            fds.horario,
            config?.nome_cong,
        ].filter(Boolean).join(' | ');
        const responsabilidadeLinhas = FIM_DE_SEMANA_RESPONSABILIDADES
            .map(({ storageKey, labels }) => {
                const nomes = (fds.responsabilidades[storageKey] || []).map((p) => p?.nome).filter(Boolean);
                if (nomes.length === 0) return null;
                return {
                    label: t[storageKey] || labels?.[lang] || labels?.pt || storageKey,
                    nomes: nomes.join(', '),
                };
            })
            .filter(Boolean);
        const apoioFimDeSemanaLinhas = [
            ...responsabilidadeLinhas,
            ...(fds.oracaoFinal?.nome ? [{ label: t.oracaoFinal || 'Oração final', nomes: fds.oracaoFinal.nome }] : []),
        ];

        const renderFdsDiscursoLinha = () => (
            <div className="border-b border-gray-200 py-0.5 font-semibold text-gray-900">
                <span className="font-black uppercase text-gray-500">{t.discurso || 'Discurso'}</span>
                <span className="ml-2">{temaDiscurso || '—'}</span>
                <span className="ml-6 font-black uppercase text-gray-500">{t.orador || 'Orador'}</span>
                <span className="ml-2">{oradorComCongregacao || '—'}</span>
            </div>
        );

        const renderFdsSecao = (titulo, children, className = 'text-gray-800') => (
            <div className="break-inside-avoid">
                <h4 className={`border-b border-gray-400 pb-0.5 text-[15px] print:text-[12.5px] font-bold uppercase tracking-wide leading-tight ${className}`}>
                    {titulo}
                </h4>
                <div className="mt-1 text-[13px] print:text-[11.5px] leading-tight">
                    {children}
                </div>
            </div>
        );

        return (
            <div className="mt-2.5 border-t-2 border-gray-400 pt-2 print:mt-2 print:pt-1.5">
                <div className="border-b border-gray-300 pb-1 text-center">
                    <h3 className="text-[19px] print:text-[15px] font-bold uppercase tracking-tighter leading-tight text-gray-900">
                        {tituloFimDeSemana}
                    </h3>
                    {fimDeSemanaMeta && (
                        <p className="mt-0.5 text-[12px] print:text-[10.5px] font-bold uppercase leading-tight text-gray-500">
                            {fimDeSemanaMeta}
                        </p>
                    )}
                    {fds.presidente?.nome && (
                        <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[13px] print:text-[11.5px] font-bold uppercase leading-tight text-gray-800">
                            <span className="rounded bg-gray-100 px-1.5">{t.presidente}:</span>
                            <span>{fds.presidente.nome}</span>
                        </div>
                    )}
                </div>

                <div className="mt-1.5 grid grid-cols-1 gap-1.5">
                    {temReuniaoPublica && renderFdsSecao(t.reuniaoPublica || 'Reunião pública', (
                        renderFdsDiscursoLinha()
                    ), 'text-blue-800')}

                    {temEstudoSentinela && renderFdsSecao(t.estudoSentinela || 'Estudo de A Sentinela', (
                        <div className={`grid gap-x-2 border-b border-gray-200 py-0.5 ${dirigenteSentinelaNome && leitorSentinelaNome ? 'grid-cols-[132px_1fr_132px_1fr]' : 'grid-cols-[132px_1fr]'}`}>
                            {dirigenteSentinelaNome && (
                                <>
                                    <span className="font-black uppercase text-gray-500">{t.dirigente}</span>
                                    <span className="font-semibold text-gray-900">{dirigenteSentinelaNome}</span>
                                </>
                            )}
                            {leitorSentinelaNome && (
                                <>
                                    <span className="font-black uppercase text-gray-500">{t.leitor}</span>
                                    <span className="font-semibold text-gray-900">{leitorSentinelaNome}</span>
                                </>
                            )}
                        </div>
                    ), 'text-amber-800')}

                    {isVisita && discursoFinalVisita && renderFdsSecao(t.discursoFinalVisita || 'Discurso final da visita', (
                        <div className="font-semibold text-gray-900 py-0.5 border-b border-gray-200">
                            {discursoFinalVisita}
                        </div>
                    ), 'text-blue-700')}

                    {apoioFimDeSemanaLinhas.length > 0 && (
                        <div className="mt-0.5 border-t border-gray-400 pt-1.5 break-inside-avoid">
                            <h4 className="text-[12px] print:text-[11px] font-black uppercase tracking-wide text-gray-700 leading-tight">
                                {t.apoioFimDeSemana || t.responsabilidades || 'Apoio do fim de semana'}
                            </h4>
                            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] print:text-[10.5px] leading-tight">
                                {apoioFimDeSemanaLinhas.map((item) => (
                                    <div key={item.label} className="grid grid-cols-[105px_1fr] gap-2">
                                        <span className="font-black text-gray-500 uppercase">{item.label}</span>
                                        <span className="font-semibold text-gray-900">{item.nomes}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // --- CONFIGURAÇÃO DE LAYOUTS ---
    const getLayoutConfig = (qtd) => {
        switch (qtd) {
            case 1:
                return incluirFimDeSemana ? {
                    semanasPorPag: 1,
                    h1: 'text-[19px] print:text-[15px]',
                    h2: 'text-[12px] print:text-[10.5px]',
                    sectionTitle: 'text-[15px] print:text-[12.5px] font-bold mt-2.5 mb-1.5 print:mt-0.5 print:mb-0.5 border-b border-gray-400 uppercase tracking-wide',
                    partTitle: 'text-[13px] print:text-[11.5px] font-semibold',
                    description: 'text-[10.5px] leading-tight text-gray-800 mt-0.5 print:text-[8.5px] print:leading-tight',
                    names: 'text-[13px] print:text-[11.5px] font-semibold text-right',
                    meta: 'text-[11px] print:text-[9.5px] text-gray-800',
                    grid: 'grid-cols-[72px_1fr_205px] gap-x-4',
                } : {
                    semanasPorPag: 1,
                    h1: 'text-2xl',
                    h2: 'text-sm',
                    sectionTitle: 'text-lg font-bold mt-6 mb-4 border-b border-gray-400 uppercase tracking-wide',
                    partTitle: 'text-base font-semibold',
                    description: 'text-[12px] leading-snug text-gray-800 mt-0.5 print:text-[9.5px] print:leading-tight',
                    names: 'text-base font-semibold text-right',
                    meta: 'text-sm text-gray-800',
                    grid: 'grid-cols-[80px_1fr_220px] gap-x-6',
                };
            case 2:
                return {
                    semanasPorPag: 2,
                    h1: 'text-xl print:text-[16px] print:leading-none',
                    h2: 'text-sm print:text-[11px]',
                    // O segredo está aqui: print:mt-1 e print:mb-0.5 removem os "buracos" entre as seções
                    sectionTitle: 'text-[16px] print:text-[13px] font-bold mt-4 mb-2 print:mt-1.5 print:mb-0.5 border-b border-gray-300 uppercase tracking-wide',
                    partTitle: 'text-[14px] print:text-[12px] font-semibold',
                    description: 'text-[12px] leading-snug text-gray-600 mt-0.5 print:text-[10px]',
                    names: 'text-[13px] print:text-[11.5px] font-medium',
                    meta: 'text-[12px] print:text-[10px]',
                };
            case 4:
                return {
                    semanasPorPag: 4,
                    showDesc: false,
                    pad: '6mm',
                    text: 'text-[10px]',
                    h1: 'text-sm',
                    h2: 'text-[9px]',
                    row: 'py-0.5',
                    gap: '2mm',
                    sectionTitle: `text-[10px] font-semibold uppercase tracking-tight mt-1 mb-0.5`,
                    partTitle: 'text-[10px] font-medium',
                    names: 'text-[10px] font-medium',
                    meta: 'text-[9px]',
                };
            case 5:
                return {
                    semanasPorPag: 5,
                    sectionTitle: 'text-[9.5px] font-semibold mt-1.5 mb-1 border-b border-gray-300 uppercase tracking-wide',
                    partTitle: 'text-[9.5px] font-medium',
                    names: 'text-[8.5px]',
                    meta: 'text-[8px]',
                };
            default:
                return getLayoutConfig(2);
        }
    };

    const layout = getLayoutConfig(qtdSemanas);
    const isListMode = layout.mode === 'list';

    const paginas = [];
    for (let i = 0; i < semanasParaImprimir.length; i += layout.semanasPorPag) {
        paginas.push(semanasParaImprimir.slice(i, i + layout.semanasPorPag));
    }

    const enviarZap = (aluno, msg) => {
        const href = buildWhatsappHref(aluno?.telefone, msg);
        if (!href) return alert(t.alunoSemTelefone);
        window.open(href, '_blank');
    };

    const enviarEmail = (aluno, assunto, msg) => {
        const href = buildMailtoHref(aluno?.email, assunto, msg);
        if (!href) return alert(t.alunoSemEmail);
        window.open(href, '_blank');
    };

    const buildMsgKey = ({ dataISO, semana, parteId, pessoaId, role }) =>
        [dataISO || '', semana || '', parteId || '', pessoaId || '', role || ''].join('|');

    const markSent = (key, channel) => {
        setSentMap((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                [channel]: Date.now(),
            },
        }));
    };

    const isSent = (key, channel) => Boolean(sentMap?.[key]?.[channel]);

    // --- SINCRONIZAR HISTÓRICO COM VARREDURA DE SEMANA COMPLETA E DEBUG ---
    const gravarHistorico = () => {
        if (!Array.isArray(alunos) || alunos.length === 0) return alert(t.nadaParaGravar);

        // 1. Filtra EXATAMENTE as semanas que estão com a pílula azul (Opção B)
        const semanasSelecionadas = semanasDisponiveis.filter((sem, i) => {
            const key = getSemanaKey(sem, i);
            return printSelecionadas[key] === true;
        });

        // Trava de segurança
        if (semanasSelecionadas.length === 0) {
            alert(t.syncNoWeeks);
            return;
        }

        if (!window.confirm(formatText(t.syncConfirmTpl, { count: semanasSelecionadas.length }))) return;

        let novosAlunos = [...alunos];
        let gravouAlgo = false;
        let alterouHistorico = false;
        const temPendenciaHistorico = semanasSelecionadas.some((sem) => !!sem?.historicoPendenteSync);

        console.log("=== INICIANDO SINCRONIZAÇÃO DE HISTÓRICO ===");

        // 2. PASSO DE LIMPEZA INTELIGENTE POR INTERVALO DE SEMANA
        // Usa as 'semanasSelecionadas' ao invés de 'semanasDisponiveis'
        const rangesParaLimpar = semanasSelecionadas.map(sem => {
            // Usamos a data ISO garantida em vez de 'sem.dataInicio'
            const dataReuniao = getDataReuniaoISO(sem);
            if (!dataReuniao) return null;

            const [ano, mes, dia] = dataReuniao.split('-').map(Number);
            // Colocamos 12:00:00 para evitar bugs de fuso horário jogando pro dia anterior
            const dataBase = new Date(ano, mes - 1, dia, 12, 0, 0);

            // Acha o dia da semana: 0 = Domingo, 1 = Segunda... 6 = Sábado
            const diaSemana = dataBase.getDay();

            // Quantos dias temos que voltar para chegar na Segunda-feira?
            const diffParaSegunda = diaSemana === 0 ? 6 : diaSemana - 1;

            // Define o começo da semana (Segunda-feira 00:00:00)
            const start = new Date(dataBase);
            start.setDate(dataBase.getDate() - diffParaSegunda);
            start.setHours(0, 0, 0, 0);

            // Define o fim da semana (Domingo 23:59:59)
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);

            return { start, end, label: dataReuniao };
        }).filter(Boolean);

        if (rangesParaLimpar.length > 0) {
            novosAlunos = novosAlunos.map(aluno => {
                if (!aluno.historico || !Array.isArray(aluno.historico)) return aluno;

                const historicoLimpo = aluno.historico.filter(h => {
                    if (!h.data) return true; // Se não tem data, preserva

                    const [hAno, hMes, hDia] = h.data.split('-').map(Number);
                    const hDate = new Date(hAno, hMes - 1, hDia, 12, 0, 0); // 12h para evitar fuso

                    // Verifica se o histórico velho cai dentro da semana que estamos sincronizando
                    const caiNaSemana = rangesParaLimpar.some(range => hDate >= range.start && hDate <= range.end);

                    if (caiNaSemana) {
                        console.log(`[LIXEIRA] Apagando registro -> Aluno: ${aluno.nome} | Parte: ${h.parte} | Data antiga: ${h.data}`);
                        alterouHistorico = true;
                    }

                    return !caiNaSemana; // Se cai na semana, retorna false para APAGAR da lista
                });

                return {
                    ...aluno,
                    historico: historicoLimpo
                };
            });
        }

        console.log("=== LIMPEZA CONCLUÍDA. INICIANDO GRAVAÇÃO DE NOVOS DADOS ===");

        // 3. PASSO DE GRAVAÇÃO
        // Usa as 'semanasSelecionadas' ao invés de 'semanasDisponiveis'
        semanasSelecionadas.forEach((sem) => {
            const data = getDataReuniaoISO(sem); // Data exata da reunião
            if (!data) return;

            // PRESIDENTE
            if (sem?.presidente?.id) {
                novosAlunos = addHistorico(novosAlunos, sem.presidente.id, {
                    data,
                    parte: 'presidente',
                    ajudante: '',
                });
                console.log(`[GRAVADO] ${sem.presidente.nome} -> presidente (${data})`);
                gravouAlgo = true;
            }

            // Loop nas partes
            (sem?.partes || []).forEach((p) => {
                const tituloLower = normalizar(p.titulo || '');
                const secaoLower = (p.secao || '').toLowerCase();
                let termoGravacao = '';

                if (isOracao(p)) termoGravacao = 'oracao';
                else if (secaoLower === 'tesouros') {
                    if (tituloLower.includes('joias') || tituloLower.includes('joyas')) termoGravacao = 'joias';
                    else if (tituloLower.includes('leitura') || tituloLower.includes('lectura')) termoGravacao = 'leitura';
                    else termoGravacao = 'tesouros';
                }
                else if (secaoLower === 'ministerio') {
                    termoGravacao = tituloLower.includes('discurso') ? 'discurso' : 'ministerio';
                }
                else if (secaoLower === 'vida' || isEstudo(p) || tituloLower.includes('estudo') || tituloLower.includes('estudio')) {
                    if (isEstudo(p) || tituloLower.includes('estudo biblico') || tituloLower.includes('estudio biblico')) {
                        termoGravacao = 'estudobiblico';
                    } else {
                        termoGravacao = 'vidacrista';
                    }
                }

                // Salva Principal
                if (termoGravacao) {
                    const principal = p.dirigente || p.oracao || p.estudante;
                    if (principal?.id) {
                        novosAlunos = addHistorico(novosAlunos, principal.id, {
                            data,
                            parte: termoGravacao,
                            ajudante: p.ajudante?.nome || '',
                        });
                        console.log(`[GRAVADO] ${principal.nome} -> ${termoGravacao} (${data})`);
                        gravouAlgo = true;
                    }
                }

                // Salva Ajudante
                if (p.ajudante?.id) {
                    novosAlunos = addHistorico(novosAlunos, p.ajudante.id, {
                        data,
                        parte: 'ajudante',
                        ajudante: p.estudante?.nome || '',
                    });
                    console.log(`[GRAVADO] ${p.ajudante.nome} -> ajudante (${data})`);
                    gravouAlgo = true;
                }

                // Salva Leitor de EBC
                if (termoGravacao === 'estudobiblico') {
                    const leitor = p.leitor || sem.leitor;
                    if (leitor?.id) {
                        novosAlunos = addHistorico(novosAlunos, leitor.id, {
                            data,
                            parte: 'leitor',
                            ajudante: '',
                        });
                        console.log(`[GRAVADO] ${leitor.nome} -> leitor (${data})`);
                        gravouAlgo = true;
                    }
                }
            });

            getMeioSemanaAssignedPeople(sem).forEach((item) => {
                if (!item?.pessoa?.id) return;
                novosAlunos = addHistorico(novosAlunos, item.pessoa.id, {
                    data,
                    parte: item.slotKey,
                    ajudante: '',
                });
                console.log(`[GRAVADO] ${item.pessoa.nome} -> ${item.slotKey} (${data})`);
                gravouAlgo = true;
            });

            const fds = getFimDeSemanaParaImpressao(sem);
            if (fds.ativo && hasFimDeSemanaData(sem?.fimDeSemana)) {
                const dataFds = fds.data || data;
                const gravarFds = (pessoa, parte) => {
                    if (!pessoa?.id) return;
                    novosAlunos = addHistorico(novosAlunos, pessoa.id, {
                        data: dataFds,
                        parte,
                        ajudante: '',
                    });
                    console.log(`[GRAVADO] ${pessoa.nome} -> ${parte} (${dataFds})`);
                    gravouAlgo = true;
                };

                gravarFds(fds.presidente, 'presidente_fds');
                gravarFds(fds.estudoSentinela.dirigente, 'dirigente_sentinela');
                gravarFds(fds.estudoSentinela.leitor, 'leitor_sentinela');
                gravarFds(fds.oracaoFinal, 'oracao_fds');
                FIM_DE_SEMANA_RESPONSABILIDADES.forEach(({ storageKey, slotKey }) => {
                    (fds.responsabilidades[storageKey] || []).forEach((pessoa) => gravarFds(pessoa, slotKey));
                });
            }
        });

        console.log("=== SINCRONIZAÇÃO TOTAL FINALIZADA ===");

        if (gravouAlgo || alterouHistorico || temPendenciaHistorico) {
            if (gravouAlgo || alterouHistorico) {
                onAlunosChange(novosAlunos);
            }
            if (onProgramacoesChange) {
                const sincronizadas = new Set(
                    semanasSelecionadas
                        .map((sem) => (sem?.id || sem?.dataReuniao || sem?.dataInicio || sem?.dataExata || sem?.data || '').toString())
                        .filter(Boolean)
                );
                const syncedAt = new Date().toISOString();
                onProgramacoesChange((prev) => (prev || []).map((sem) => {
                    const key = (sem?.id || sem?.dataReuniao || sem?.dataInicio || sem?.dataExata || sem?.data || '').toString();
                    if (!sincronizadas.has(key)) return sem;
                    const proximaSemana = { ...(sem || {}), historicoGravadoEm: syncedAt };
                    delete proximaSemana.historicoPendenteSync;
                    delete proximaSemana.historicoPendenteMotivo;
                    delete proximaSemana.historicoPendenteDesde;
                    return proximaSemana;
                }));
            }
            toast.success(t.syncOk);
        } else {
            toast.info(t.nadaParaGravar);
        }
    };

    const handlePrint = () => {
        try {
            window.print();
        } catch (e) {
            console.error("Erro ao imprimir", e);
            toast.error(e, t.printError);
        }
    };

    const renderPartes5Semanas = (semana) => {
        const partes = semana?.partes || [];

        const oracaoInicial = partes.find((p) => isOracao(p) && getOracaoPos(p) === 'inicio');
        const oracaoFinal = partes.find((p) => isOracao(p) && getOracaoPos(p) === 'final');

        // Filtramos para IGNORAR orações e cânticos
        const partesReais = partes.filter((p) => {
            if (isOracao(p)) return false;

            return !isSongOnlyPart(p);
        });

        const linhas = [];

        if (oracaoInicial) {
            linhas.push({
                tipo: 'oracao-inicial',
                label: t.oracao,
                pessoa: oracaoInicial?.oracao || oracaoInicial?.estudante,
                tempo: oracaoInicial?.tempo,
                numero: '' // Oração não recebe número
            });
        }

        partesReais.forEach((parte) => {
            const eEstudo = isEstudo(parte);
            const principal = eEstudo ? parte?.dirigente || parte?.estudante : parte?.estudante;
            const ajudante = parte?.ajudante;
            const leitor = eEstudo ? parte?.leitor || semana?.leitor : null;

            let nomes = principal?.nome || '—';
            if (ajudante?.nome) nomes += ` / ${nomeCurto(ajudante.nome)}`;
            if (leitor?.nome) nomes += ` • ${t.leitor}: ${nomeCurto(leitor.nome)}`;

            // Extrai o número do começo do título
            const tituloStr = (parte?.titulo || '').trim();
            const matchNumero = tituloStr.match(/^(\d+)/);
            const numeroExtraido = matchNumero ? matchNumero[1] : null;

            linhas.push({
                tipo: 'parte',
                pessoaTexto: nomes,
                tempo: parte?.tempo,
                numero: numeroExtraido || parte?.num || parte?.numero || ''
            });
        });

        if (oracaoFinal) {
            linhas.push({
                tipo: 'oracao-final',
                label: `${t.oracao} (${t.final || 'final'})`,
                pessoa: oracaoFinal?.oracao || oracaoFinal?.estudante,
                tempo: oracaoFinal?.tempo,
                numero: '' // Oração não recebe número
            });
        }

        let contadorPartesReais = 1;

        return (
            <div className="week-5-grid">
                {linhas.map((item, idx) => {

                    let numExibicao = '';
                    if (item.tipo === 'parte') {
                        if (item.numero) {
                            numExibicao = item.numero;
                            contadorPartesReais = parseInt(item.numero, 10) + 1;
                        } else {
                            numExibicao = contadorPartesReais++;
                        }
                    }

                    return (
                        <div key={idx} className="week-5-item">
                            <span className="week-5-num">
                                {numExibicao ? `${numExibicao}.` : ''}
                            </span>
                            {item?.tempo && (
                                <span className="week-5-time">{item.tempo}m</span>
                            )}
                            <span className="week-5-name">
                                {item.tipo.startsWith('oracao')
                                    ? `${item.label}: ${item.pessoa?.nome || '—'}`
                                    : item.pessoaTexto}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6 flex flex-col relative print:block print:h-auto print:overflow-visible">

            <div className="no-print">
                <RevisarEnviarHeader
                    t={t}
                    abaAtiva={abaAtiva}
                    setAbaAtiva={setAbaAtiva}
                    startIndex={startIndex}
                    setStartIndex={setStartIndex}
                    filtroSemanas={filtroSemanas}
                    setFiltroSemanas={setFiltroSemanas}
                    qtdSemanas={qtdSemanas}
                    setQtdSemanas={setQtdSemanas}
                    incluirFimDeSemana={incluirFimDeSemana}
                    setIncluirFimDeSemana={setIncluirFimDeSemana}
                    historicoSelect={historicoSelect}
                    showWeekTabs={true}
                    semanasDisponiveis={semanasDisponiveis}
                    getSemanaKey={getSemanaKey}
                    printSelecionadas={printSelecionadas}
                    toggleSemanaPrint={toggleSemanaPrint}
                    selecionarTodasPrint={selecionarTodasPrint}
                    limparPrint={limparPrint}
                    onPrint={handlePrint}
                    onGravarHistorico={gravarHistorico}
                    onConfirmSync={async (tokenGoogle, calendarId) => {
                        // OPÇÃO B: Filtra EXATAMENTE as semanas que estão com a pílula azul
                        const reunioesSelecionadas = semanasDisponiveis.filter((sem, i) => {
                            const key = getSemanaKey(sem, i);
                            return printSelecionadas[key] === true;
                        });

                        // Trava de segurança caso o usuário não tenha selecionado nenhuma
                        if (reunioesSelecionadas.length === 0) {
                            alert(t.agendaNoWeeks);
                            return;
                        }

                        const reunioesComDataExata = reunioesSelecionadas.map(sem => ({
                            ...sem,
                            dataExata: getDataReuniaoISO(sem)
                        }));

                        const { enviarEventosParaAgenda } = await import('../../services/calendarSync');
                        const resultado = await enviarEventosParaAgenda(tokenGoogle, calendarId, reunioesComDataExata, config);

                        if (resultado.sucesso) {
                            if (onProgramacoesChange) {
                                const sincronizadas = new Set(
                                    reunioesSelecionadas
                                        .map((sem) => (sem?.id || sem?.dataReuniao || sem?.dataInicio || sem?.dataExata || sem?.data || '').toString())
                                        .filter(Boolean)
                                );
                                const syncedAt = new Date().toISOString();
                                onProgramacoesChange((prev) => (prev || []).map((sem) => {
                                    const key = (sem?.id || sem?.dataReuniao || sem?.dataInicio || sem?.dataExata || sem?.data || '').toString();
                                    if (!sincronizadas.has(key)) return sem;
                                    const proximaSemana = { ...(sem || {}), agendaSincronizadaEm: syncedAt };
                                    delete proximaSemana.agendaPendenteSync;
                                    delete proximaSemana.needsCalendarSync;
                                    delete proximaSemana.agendaPendenteMotivo;
                                    delete proximaSemana.agendaPendenteDesde;
                                    return proximaSemana;
                                }));
                            }
                            toast.success(formatText(t.agendaSuccessTpl, { count: resultado.quantidade }));
                        } else {
                            toast.error(resultado.erro, t.agendaError);
                        }
                    }}
                />
            </div>

            {abaAtiva === 'imprimir' && (
                <button
                    type="button"
                    onClick={handlePrint}
                    className="no-print fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/20 border border-blue-500 flex items-center justify-center hover:bg-blue-700 active:scale-95 transition"
                    title={t.btnImprimir || 'Imprimir agora'}
                    aria-label={t.btnImprimir || 'Imprimir agora'}
                >
                    <Printer size={20} />
                </button>
            )}

            {/* PRINT ROOT (somente folhas) */}
            <div id="print-root" className={abaAtiva !== 'imprimir' ? 'hidden-print-root' : 'no-scrollbar'}>
                {paginas.map((semanasDaPagina, idxPag) => {
                    return (
                        <div key={idxPag} className="page-break bg-white">
                            <div
                                className="page-content"
                                data-qtd={qtdSemanas}
                                data-incluir-fds={qtdSemanas === 1 && incluirFimDeSemana ? 'true' : 'false'}
                                style={{
                                    boxSizing: 'border-box',
                                    gap: layout.gap,
                                }}
                            >
                                {semanasDaPagina.map((semana, idxSem) => {
                                    const dataISO = getDataReuniaoISO(semana);
                                    const horarioExib = config?.horarioReuniao ?? config?.horario ?? '19:30';
                                    const tituloMeioSemana = montarTituloReuniaoPrint(t.reuniaoMeioSemana || 'Reunião de meio de semana', dataISO);

                                    const tipoEvento = getTipoEventoSemana(semana, config);
                                    const isVisita = tipoEvento === 'visita';

                                    return (
                                        <div key={idxSem} className={isListMode ? 're-week' : 'print-block flex flex-col'}>
                                            {/* CABEÇALHO DA SEMANA */}
                                            {!isListMode ? (
                                                <div
                                                    className={`
                                                        text-center border-b border-gray-200
                                                        ${qtdSemanas === 1 ? 'pb-2 mb-2' : 'pb-1 mb-1'}
                                                        ${qtdSemanas === 5 ? 'mt-4 print:mt-2' : ''}
                                                    `}
                                                >
                                                    <h2 className={`${layout.h1} font-bold uppercase tracking-tighter flex items-center justify-center gap-2`}>
                                                        {tituloMeioSemana}
                                                        {isVisita && (
                                                            <span className="text-[9px] bg-white text-blue-700 px-2 py-0.5 rounded border border-blue-700 font-bold uppercase tracking-widest">
                                                                {t.visitTag}
                                                            </span>
                                                        )}
                                                    </h2>
                                                    {qtdSemanas === 5 ? (
                                                        <p className="text-[13px] font-extrabold text-gray-500 uppercase">
                                                            {formatarDataFolha(dataISO, lang)}
                                                        </p>
                                                    ) : (
                                                        <p className={`${layout.h2} font-bold text-gray-500 uppercase`}>
                                                            {formatarDataFolha(dataISO, lang)} | {horarioExib} | {config?.nome_cong}
                                                        </p>
                                                    )}

                                                    {semana?.presidente && (
                                                        <div className={`flex justify-center items-center gap-2 font-bold text-gray-800 uppercase ${qtdSemanas === 1 ? (incluirFimDeSemana ? 'text-[13px] print:text-[11.5px] mt-1' : 'text-[14px] mt-2') : 'text-[11px]'}`}>
                                                            <span className="bg-gray-100 px-2 rounded">{t.presidente}:</span>
                                                            <span>{semana.presidente.nome}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="re-week-header">
                                                    <div className="re-week-title">{tituloMeioSemana}</div>
                                                    <div className="re-week-meta">
                                                        {formatarDataFolha(dataISO, lang)} • {horarioExib} • {config?.nome_cong}
                                                    </div>
                                                    {semana?.presidente?.nome ? (
                                                        <div className="re-week-pres">
                                                            {t.presidente}: {semana.presidente.nome}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}

                                            {/* PARTES DA REUNIÃO */}
                                            {!isListMode ? (
                                                qtdSemanas === 5 ? (
                                                    renderPartes5Semanas(semana)
                                                ) : (
                                                    <div className="print-block flex flex-col justify-start">
                                                        {(semana?.partes || []).map((parte, idxPart) => {
                                                            const prev = semana.partes[idxPart - 1];
                                                            const firstTipo = getMeetingPartTypeNormalized(semana.partes?.[0]);
                                                            const isIntroEnd =
                                                                idxPart === 1 &&
                                                                firstTipo.includes('oracao');

                                                            const sectionChanged = idxPart === 0 || (prev && prev.secao !== parte.secao);

                                                            const isEbc = isEstudo(parte);
                                                            const designadoPrincipal = isEbc
                                                                ? parte?.dirigente || parte?.estudante
                                                                : isOracao(parte)
                                                                    ? parte?.oracao || parte?.estudante
                                                                    : parte?.estudante;

                                                            const leitorEbc = isEbc ? parte?.leitor || semana?.leitor : null;

                                                            return (
                                                                <div key={parte.id || idxPart} className="flex flex-col">
                                                                    {isIntroEnd && <hr className="border-t border-gray-300 my-1" />}

                                                                    {/* Títulos das Seções Oficiais */}
                                                                    {sectionChanged && parte.secao && t.secoes[parte.secao] && (
                                                                        <h3
                                                                            className={`
                                                                                ${layout.sectionTitle}
                                                                                w-full
                                                                                col-span-full
                                                                                whitespace-normal
                                                                                leading-tight
                                                                                print:mt-1 print:mb-0
                                                                                ${parte.secao === 'tesouros'
                                                                                    ? 'jw-sec-text-tesouros'
                                                                                    : parte.secao === 'ministerio'
                                                                                        ? 'jw-sec-text-ministerio'
                                                                                        : 'jw-sec-text-vida'
                                                                                }
                                                                            `}
                                                                        >
                                                                            {t.secoes[parte.secao]}
                                                                        </h3>
                                                                    )}

                                                                    <div
                                                                        className={`
                                                                            grid items-start border-b border-gray-100
                                                                            ${qtdSemanas === 1
                                                                                ? 'grid-cols-[48px_1fr_260px] gap-x-4 py-2'
                                                                                : qtdSemanas === 2
                                                                                    ? 'grid-cols-[60px_1fr_200px] gap-x-2 py-0.5 print:py-[1.5px]'
                                                                                    : 'grid-cols-[60px_1fr_150px] gap-x-2 py-0.5'
                                                                            }
                                                                        `}
                                                                    >

                                                                        {/* Tempo */}
                                                                        <div className={`text-right text-sm font-medium whitespace-nowrap ${qtdSemanas === 2 ? 'pr-2' : 'pr-1'}`}>
                                                                            <span className="bg-gray-100 text-gray-600 font-bold border border-gray-200 rounded px-1.5 py-0.5 text-[9px]">
                                                                                {parte.tempo} min
                                                                            </span>
                                                                        </div>

                                                                        {/* Título e Descrição */}
                                                                        <div>
                                                                            <span
                                                                                className={`
                                                                                    ${layout.partTitle}
                                                                                    text-gray-900 block
                                                                                    leading-tight
                                                                                `}
                                                                            >
                                                                                {parte.titulo}
                                                                            </span>

                                                                            {qtdSemanas === 1 && parte.descricao && (
                                                                                <div className={layout.description}>
                                                                                    {parte.descricao}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Designados */}
                                                                        <div
                                                                            className={`
                                                                                re-assignees
                                                                                text-right flex flex-col items-end
                                                                                ${qtdSemanas === 1
                                                                                    ? 'min-w-[260px] gap-1'
                                                                                    : qtdSemanas === 2
                                                                                        ? 'min-w-[200px]'
                                                                                        : 'min-w-[140px]'
                                                                                }
                                                                            `}
                                                                        >

                                                                            <span className={`re-assignee-primary ${layout.names} text-black`}>
                                                                                {isEbc
                                                                                    ? `${t.dirigente}: `
                                                                                    : isOracao(parte)
                                                                                        ? `${t.oracao}: `
                                                                                        : ''}
                                                                                {designadoPrincipal?.nome || ''}
                                                                            </span>

                                                                            {/* LEITOR NO ESTUDO BÍBLICO */}
                                                                            {isEbc && leitorEbc && (
                                                                                <div className={`re-assignee-secondary re-reader-line mt-0.5 ${layout.meta} text-gray-600 leading-tight`}>
                                                                                    <span>{t.leitor}: {leitorEbc.nome}</span>
                                                                                </div>
                                                                            )}

                                                                            {parte?.ajudante && (
                                                                                <p className={`re-assignee-secondary ${layout.meta} text-gray-600 leading-tight`}>
                                                                                    {t.ajudante}: {parte.ajudante.nome}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )
                                            ) : (
                                                <div className="re-lines">
                                                    {(semana?.partes || []).map((parte, idxPart) => {
                                                        const prev = semana.partes[idxPart - 1];
                                                        const sectionChanged = idxPart === 0 || (prev && prev.secao !== parte.secao);
                                                        const chip = sectionChanged ? getSecaoChip(parte?.secao) : null;

                                                        return (
                                                            <React.Fragment key={parte.id || idxPart}>
                                                                {chip ? <div className={`re-sec-chip ${chip.cls}`}>{chip.label}</div> : null}

                                                                <div className="re-line">
                                                                    <span className="re-time">{(parte?.tempo ?? '').toString().trim() ? `${parte.tempo}m` : ''}</span>
                                                                    <span className="re-title">{parte?.titulo ?? ''}</span>
                                                                    <span className="re-sep">—</span>
                                                                    <span className="re-names">{montarNomesLista({ parte, semana })}</span>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {renderResponsabilidadesMeioSemanaPrint(semana)}
                                            {renderFimDeSemanaPrint(semana)}

                                            {/* Separador entre semanas se houver mais de uma na folha (modo normal) */}
                                            {idxSem < semanasDaPagina.length - 1 && !isListMode && qtdSemanas !== 5 && (
                                                qtdSemanas === 2 ? (
                                                    <div className="week-divider" />
                                                ) : (
                                                    <div className="border-b-2 border-dashed border-gray-300 w-full mt-4"></div>
                                                )
                                            )}

                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ABA NOTIFICAR */}
            {abaAtiva === 'notificar' && (
                <RevisarEnviarNotificarTab
                    semanasParaNotificar={semanasParaImprimir}
                    config={config}
                    confirmacoes={confirmacoes}
                    lang={lang}
                    t={t}
                    getDataReuniaoISO={getDataReuniaoISO}
                    isOracao={isOracao}
                    isEstudo={isEstudo}
                    getOracaoPos={getOracaoPos}
                    enviarZap={enviarZap}
                    enviarEmail={enviarEmail}
                    buildMsgKey={buildMsgKey}
                    markSent={markSent}
                    isSent={isSent}
                    onSolicitarSubstituicao={onSolicitarSubstituicao}
                />
            )}
        </div>
    );
};

export default RevisarEnviar;
