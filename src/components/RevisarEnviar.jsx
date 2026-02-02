import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, MessageCircle, BookOpen, Archive, Mail, CheckCircle } from 'lucide-react';

import RevisarEnviarHeader from './RevisarEnviarHeader';
import "./revisarEnviar.print.css";

import { getI18n } from '../utils/revisarEnviar/translations';
import { getMeetingDateISOFromSemana, formatarDataFolha } from '../utils/revisarEnviar/dates';
import { buildWhatsappHref, buildMailtoHref } from '../utils/revisarEnviar/links';
import { montarMensagemDesignacao } from '../utils/revisarEnviar/messages';
import { addHistorico, tipoOracaoToDb } from '../utils/revisarEnviar/historico';

const RevisarEnviar = ({ historico, alunos, config, onAlunosChange }) => {
    const hasHistorico = Array.isArray(historico) && historico.length > 0;
    const { lang, t } = getI18n(config);

    const [startIndex, setStartIndex] = useState(0);
    const [qtdSemanas, setQtdSemanas] = useState(1); // dropdown: semanas por folha (1/2/4/5)
    const [abaAtiva, setAbaAtiva] = useState('imprimir');

    const [filtroSemanas, setFiltroSemanas] = useState('ativas'); // 'ativas' | 'arquivadas' | 'todas'

    // marcação em tempo de execução do que já foi clicado (WA / email)
    const [sentMap, setSentMap] = useState({});

    const getTipo = (p) => (p?.tipo ?? p?.type ?? '').toString();
    const isOracao = (p) =>
        getTipo(p).toLowerCase().includes('oracao') ||
        getTipo(p).toLowerCase().includes('oração') ||
        getTipo(p).toLowerCase().includes('oración');
    const isEstudo = (p) => getTipo(p).toLowerCase() === 'estudo';

    // detecta se uma oração é "inicial" ou "final" (por tipo/título)
    const getOracaoPos = (p) => {
        const tipo = getTipo(p).toLowerCase();
        const titulo = (p?.titulo ?? '').toString().toLowerCase();
        const raw = `${tipo} ${titulo}`.trim();

        if (raw.includes('inicial') || raw.includes('inicio') || raw.includes('abertura')) return 'inicio';
        if (raw.includes('final') || raw.includes('encerr') || raw.includes('encerramento')) return 'final';
        return null;
    };

    // === UTILITÁRIOS PARA 5 SEMANAS ===
    const nomeCurto = (nome = '') => {
        const partes = nome.trim().split(/\s+/);
        if (partes.length === 1) return partes[0];
        return `${partes[0]} ${partes[partes.length - 1][0]}.`;
    };

    const montarLinhaCompacta = (semana, secao) => {
        return (semana?.partes || [])
            .filter(p => p.secao === secao && !isOracao(p))
            .map((p, idx) => {
                const pessoa =
                    p?.estudante ||
                    p?.dirigente ||
                    p?.oracao ||
                    null;

                const nome = pessoa ? nomeCurto(pessoa.nome) : '';
                return `${idx + 1}. ${p.titulo} – ${nome}`;
            })
            .join(' | ');
    };

    // --- PREPARAÇÃO E ORDENAÇÃO ---
    const historicoOrdenado = useMemo(() => {
        return [...historico].sort((a, b) => {
            const dA = a?.dataReuniao ? new Date(a.dataReuniao) : new Date(0);
            const dB = b?.dataReuniao ? new Date(b.dataReuniao) : new Date(0);
            return dA - dB;
        });
    }, [historico]);

    const historicoSelect = useMemo(() => [...historicoOrdenado].reverse(), [historicoOrdenado]);
    const realStartIndex = historicoOrdenado.length - 1 - startIndex;
    const startSeguro = Math.max(0, realStartIndex);

    // --- Seleção de semanas para impressão (tabs) ---
    // --- Seleção de semanas para impressão (chips) ---
    const getSemanaKey = (sem, idx) =>
        (sem?.id ?? sem?.dataReuniao ?? sem?.semana ?? String(idx)).toString();

    const semanasDisponiveisBase = useMemo(() => {
        return historicoOrdenado.slice(startSeguro);
    }, [historicoOrdenado, startSeguro]);

    const semanasDisponiveis = useMemo(() => {
        if (filtroSemanas === 'todas') return semanasDisponiveisBase;
        if (filtroSemanas === 'arquivadas') return semanasDisponiveisBase.filter(s => !!s?.arquivada);
        return semanasDisponiveisBase.filter(s => !s?.arquivada); // ativas (default)
    }, [semanasDisponiveisBase, filtroSemanas]);


    const [printSelecionadas, setPrintSelecionadas] = useState({});

    /**
     * CORREÇÃO IMPORTANTE:
     * - O dropdown muda "qtdSemanas" (semanas por folha), mas NÃO deve destruir a seleção das tabs.
     * - Só deve auto-selecionar quando:
     *   a) muda a semana inicial (startSeguro), OU
     *   b) não há nada selecionado ainda.
     * - Se o usuário clicou em "Limpar", respeitar a seleção vazia (até ele selecionar de novo).
     */
    const prevStartSeguroRef = useRef(startSeguro);
    const userClearedRef = useRef(false);

    useEffect(() => {
        const startChanged = prevStartSeguroRef.current !== startSeguro;

        // se o usuário limpou e não mudou o start, não repopula
        if (!startChanged && userClearedRef.current) return;

        // se não mudou o start e já existe seleção, não repopula ao trocar dropdown
        const hasAnySelected = Object.values(printSelecionadas).some(Boolean);
        if (!startChanged && hasAnySelected) return;

        // se mudou o start, reseta o "cleared" e faz seleção default de acordo com o dropdown
        if (startChanged) userClearedRef.current = false;

        const base = semanasDisponiveis.slice(0, qtdSemanas);
        const next = {};
        base.forEach((s, i) => {
            next[getSemanaKey(s, i)] = true;
        });
        setPrintSelecionadas(next);

        prevStartSeguroRef.current = startSeguro;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startSeguro, semanasDisponiveis, qtdSemanas]);

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

        // Se o usuário limpou, não força fallback (imprime nada)
        if (userClearedRef.current) return [];

        // Fallback: imprime 1 "folha cheia" conforme dropdown
        return marcadas.length ? marcadas : semanasDisponiveis.slice(0, qtdSemanas);
    }, [semanasDisponiveis, printSelecionadas, qtdSemanas]);

    // Para mensagens: manter 1 semana por vez (a semana foco do select)
    const semanasParaNotificar = useMemo(() => {
        return historicoOrdenado.slice(startSeguro, startSeguro + 1);
    }, [historicoOrdenado, startSeguro]);

    const getDataReuniaoISO = (sem) => {
        const fallback = sem?.dataReuniao;
        return (
            getMeetingDateISOFromSemana({
                semanaStr: sem?.semana,
                config,
                isoFallback: fallback,
            }) ||
            fallback ||
            null
        );
    };

    const getLayoutConfig = (qtd) => {
        switch (qtd) {
            case 1:
                return {
                    semanasPorPag: 1,

                    sectionTitle:
                        'text-lg font-bold mt-6 mb-4 border-b border-gray-400 uppercase tracking-wide',

                    partTitle:
                        'text-base font-semibold',

                    description:
                        'text-[11px] leading-snug text-gray-600 mt-0.5 print:text-[9.5px] print:leading-tight',


                    names:
                        'text-base font-semibold text-right',

                    meta:
                        'text-sm text-gray-600',

                    grid:
                        'grid-cols-[80px_1fr_220px] gap-x-6',
                };


            case 2:
                return {
                    semanasPorPag: 2,
                    sectionTitle:
                        'text-[11px] font-bold mt-2 mb-1 border-b border-gray-300 uppercase tracking-wide',
                    partTitle: 'text-[11px] font-semibold',
                    description:
                        'text-[9px] leading-tight text-gray-500 mt-0.5 print:text-[8px]',
                    names: 'text-[10px]',
                    meta: 'text-[9px]',
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

                    sectionTitle: `
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-tight
                        mt-1
                        mb-0.5
                    `,

                    partTitle: 'text-[10px] font-medium',
                    names: 'text-[10px] font-medium',
                    meta: 'text-[9px]',
                };


            case 5:
                return {
                    semanasPorPag: 5,
                    sectionTitle:
                        'text-[9.5px] font-semibold mt-1.5 mb-1 border-b border-gray-300 uppercase tracking-wide',
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

    // --- LOGICA DE NOTIFICAÇÃO ---
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

    // --- status helpers (tempo de execução) ---
    const buildMsgKey = ({ dataISO, semana, parteId, pessoaId, role }) => {
        return [dataISO || '', semana || '', parteId || '', pessoaId || '', role || ''].join('|');
    };

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

    // --- GRAVAR HISTÓRICO COM PADRONIZAÇÃO DE TERMOS ---
    const gravarHistorico = () => {
        if (typeof onAlunosChange !== 'function') {
            alert(t.erroSemCallback);
            return;
        }
        if (!Array.isArray(alunos) || alunos.length === 0) {
            alert(t.nadaParaGravar);
            return;
        }

        const ok = window.confirm(t.confirmarGravar);
        if (!ok) return;

        let novosAlunos = [...alunos];
        let gravouAlgo = false;

        semanasParaImprimir.forEach((sem) => {
            const data = getDataReuniaoISO(sem);
            if (!data) return;

            // 1. PRESIDENTE (Sempre "presidente")
            if (sem?.presidente?.id) {
                novosAlunos = addHistorico(novosAlunos, sem.presidente.id, {
                    data,
                    parte: 'presidente',
                    ajudante: '',
                });
                gravouAlgo = true;
            }

            // Loop nas partes
            (sem?.partes || []).forEach((p) => {
                const tituloLower = (p.titulo || '').toLowerCase();
                const secaoLower = (p.secao || '').toLowerCase();

                // Variável para definir o termo exato a ser gravado
                let termoGravacao = '';

                // A. ORAÇÕES
                if (isOracao(p)) {
                    termoGravacao = 'oracao';
                }
                // B. TESOUROS (Parte 1, Joias, Leitura)
                else if (secaoLower === 'tesouros') {
                    if (tituloLower.includes('joias')) {
                        termoGravacao = 'joias';
                    } else if (tituloLower.includes('leitura')) {
                        termoGravacao = 'leitura';
                    } else {
                        // Se é Tesouros e não é joias nem leitura, é a Parte 1 (Discurso)
                        termoGravacao = 'tesouros';
                    }
                }
                // C. MINISTÉRIO
                else if (secaoLower === 'ministerio') {
                    termoGravacao = 'ministerio';
                }
                // D. VIDA CRISTÃ e ESTUDO
                else if (secaoLower === 'vida' || isEstudo(p) || tituloLower.includes('estudo')) {
                    if (isEstudo(p) || tituloLower.includes('estudo bíblico')) {
                        termoGravacao = 'estudobiblico';
                    } else {
                        termoGravacao = 'vidacrista';
                    }
                }

                // --- APLICAR A GRAVAÇÃO ---

                // 1. Gravar o Principal (Estudante, Dirigente, Orador)
                if (termoGravacao) {
                    // Tenta achar quem é o principal nessa parte
                    const principal = p.dirigente || p.oracao || p.estudante;

                    if (principal?.id) {
                        novosAlunos = addHistorico(novosAlunos, principal.id, {
                            data,
                            parte: termoGravacao,
                            ajudante: p.ajudante?.nome || '',
                        });
                        gravouAlgo = true;
                    }
                }

                // 2. Gravar o Ajudante (Sempre "ajudante")
                if (p.ajudante?.id) {
                    novosAlunos = addHistorico(novosAlunos, p.ajudante.id, {
                        data,
                        parte: 'ajudante',
                        ajudante: p.estudante?.nome || '', // Referência de quem ele ajudou
                    });
                    gravouAlgo = true;
                }

                // 3. Gravar o Leitor do Estudo (Sempre "leitor")
                // Só grava leitor se a parte for o Estudo Bíblico
                if (termoGravacao === 'estudobiblico') {
                    const leitor = p.leitor || sem.leitor;
                    if (leitor?.id) {
                        novosAlunos = addHistorico(novosAlunos, leitor.id, {
                            data,
                            parte: 'leitor',
                            ajudante: '',
                        });
                        gravouAlgo = true;
                    }
                }
            });
        });

        if (!gravouAlgo) {
            alert(t.nadaParaGravar);
            return;
        }

        onAlunosChange(novosAlunos);
        alert(t.okGravou);
    };

    const SECAO_UI = {
        tesouros: { chip: 'bg-slate-600', wrap: 'border-slate-200 bg-slate-50', text: 'text-slate-900' },
        ministerio: { chip: 'bg-yellow-600', wrap: 'border-amber-200 bg-amber-50', text: 'text-amber-950' },
        vida: { chip: 'bg-red-700', wrap: 'border-rose-200 bg-rose-50', text: 'text-rose-950' },
    };

    const renderButtons = ({ pessoa, msg, subject, msgKey, corWa, compact = false }) => {
        const waSent = isSent(msgKey, 'wa');
        const mailSent = isSent(msgKey, 'mail');

        return (
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => {
                        enviarZap(pessoa, msg);
                        markSent(msgKey, 'wa');
                    }}
                    className={`relative ${compact ? 'p-1.5' : 'p-2'} rounded-lg transition ${waSent ? 'bg-gray-200 text-gray-600' : corWa || 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                    title={t.btnEnviar}
                >
                    <MessageCircle size={compact ? 16 : 18} />
                    {waSent && (
                        <CheckCircle
                            size={compact ? 12 : 14}
                            className="absolute -top-1 -right-1 text-green-700 bg-white rounded-full"
                        />
                    )}
                </button>

                <button
                    onClick={() => {
                        enviarEmail(pessoa, subject, msg);
                        markSent(msgKey, 'mail');
                    }}
                    className={`relative ${compact ? 'p-1.5' : 'p-2'} rounded-lg transition ${mailSent ? 'bg-gray-200 text-gray-600' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                        }`}
                    title={t.btnEnviarEmail}
                >
                    <Mail size={compact ? 16 : 18} />
                    {mailSent && (
                        <CheckCircle
                            size={compact ? 12 : 14}
                            className="absolute -top-1 -right-1 text-green-700 bg-white rounded-full"
                        />
                    )}
                </button>
            </div>
        );
    };

    const renderCardPessoa = ({ tituloTopo, pessoa, msg, subject, msgKey, corWa, compact = false }) => (
        <div className={`bg-white ${compact ? 'p-2' : 'p-3'} rounded-lg shadow-sm flex justify-between items-center border`}>
            <div className="min-w-0 pr-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{tituloTopo}</p>
                <p className={`${compact ? 'text-[13px]' : 'text-sm'} font-bold truncate`}>{pessoa?.nome}</p>
                {pessoa?.email && <p className="text-[10px] text-gray-400 truncate">{pessoa.email}</p>}
            </div>
            {renderButtons({ pessoa, msg, subject, msgKey, corWa, compact })}
        </div>
    );

    // --- LIST MODE helpers (4/5) ---
    const getSecaoChip = (secao) => {
        const s = (secao ?? '').toString().trim().toLowerCase();
        if (s === 'tesouros') return { key: 'tesouros', label: 'TESOUROS', cls: 're-chip-tes' };
        if (s === 'ministerio') return { key: 'ministerio', label: 'MINISTÉRIO', cls: 're-chip-min' };
        if (s === 'vida') return { key: 'vida', label: 'VIDA', cls: 're-chip-vida' };
        if (!s) return null;
        return { key: s, label: s.slice(0, 10).toUpperCase(), cls: 're-chip-outros' };
    };

    const montarNomesLista = ({ parte, semana }) => {
        const eOracao = isOracao(parte);
        const eEstudo = isEstudo(parte);

        const principal = eEstudo
            ? parte?.dirigente || parte?.estudante
            : eOracao
                ? parte?.oracao || parte?.estudante
                : parte?.estudante;

        const ajud = parte?.ajudante || null;
        const leitorEbc = eEstudo ? parte?.leitor || semana?.leitor : null;

        if (eEstudo) {
            return (
                <>
                    {principal?.nome ? (
                        <span className="re-name-main">
                            <span className="re-tag re-tag-dir">Dir:</span> {principal.nome}
                        </span>
                    ) : null}
                    {leitorEbc?.nome ? (
                        <span className="re-name-sub">
                            {' '}
                            <span className="re-dot">•</span>{' '}
                            <span className="re-tag re-tag-lei">Lei:</span> {leitorEbc.nome}
                        </span>
                    ) : null}
                </>
            );
        }

        if (eOracao) {
            return principal?.nome ? <span className="re-name-main">{principal.nome}</span> : null;
        }

        return (
            <>
                {principal?.nome ? <span className="re-name-main">{principal.nome}</span> : null}
                {ajud?.nome ? (
                    <span className="re-name-sub">
                        {' '}
                        <span className="re-dot">•</span> <span className="re-tag re-tag-aj">Aj:</span> {ajud.nome}
                    </span>
                ) : null}
            </>
        );
    };

    const renderPartes5Semanas = (semana) => {
        const partes = semana?.partes || [];

        const nomePrimeiroUltimo = (nome = '') => {
            const p = nome.trim().split(/\s+/);
            if (p.length <= 1) return nome;
            return `${p[0]} ${p[p.length - 1]}`;
        };

        const oracaoInicial = partes.find(
            (p) => isOracao(p) && getOracaoPos(p) === 'inicio'
        );

        const oracaoFinal = partes.find(
            (p) => isOracao(p) && getOracaoPos(p) === 'final'
        );

        const partesSemOracao = partes.filter((p) => !isOracao(p));

        const linhas = [];

        // 🔹 Oração inicial (primeira linha)
        if (oracaoInicial) {
            const pessoa = oracaoInicial?.oracao || oracaoInicial?.estudante;
            linhas.push({
                tipo: 'oracao-inicial',
                label: t.oracao,
                pessoa,
                tempo: oracaoInicial?.tempo,
            });
        }

        // 🔹 Partes normais
        partesSemOracao.forEach((parte) => {
            const eEstudo = isEstudo(parte);

            const principal = eEstudo
                ? parte?.dirigente || parte?.estudante
                : parte?.estudante;

            const ajudante = parte?.ajudante;
            const leitor = eEstudo ? parte?.leitor || semana?.leitor : null;

            let nomes = principal?.nome || '—';

            if (ajudante?.nome) {
                nomes += ` / ${nomePrimeiroUltimo(ajudante.nome)}`;
            }

            if (leitor?.nome) {
                nomes += ` • ${t.leitor}: ${nomePrimeiroUltimo(leitor.nome)}`;
            }

            linhas.push({
                tipo: 'parte',
                pessoaTexto: nomes,
                tempo: parte?.tempo,
            });
        });

        // 🔹 Oração final (última linha)
        if (oracaoFinal) {
            const pessoa = oracaoFinal?.oracao || oracaoFinal?.estudante;
            linhas.push({
                tipo: 'oracao-final',
                label: `${t.oracao} (${t.final || 'final'})`,
                pessoa,
                tempo: oracaoFinal?.tempo,
            });
        }

        return (
            <div className="week-5-grid">
                {linhas.map((item, idx) => (
                    <div key={idx} className="week-5-item">
                        <span className="week-5-num">{idx + 1}.</span>

                        {item?.tempo && (
                            <span className="week-5-time">{item.tempo}m</span>
                        )}

                        <span className="week-5-name">
                            {item.tipo.startsWith('oracao')
                                ? `${item.label}: ${item.pessoa?.nome || '—'}`
                                : item.pessoaTexto}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
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
                    historicoSelect={historicoSelect}
                    showWeekTabs={abaAtiva === 'imprimir'}
                    semanasDisponiveis={semanasDisponiveis}
                    getSemanaKey={getSemanaKey}
                    printSelecionadas={printSelecionadas}
                    toggleSemanaPrint={toggleSemanaPrint}
                    selecionarTodasPrint={selecionarTodasPrint}
                    limparPrint={limparPrint}
                    onPrint={() => window.print()}
                    onGravarHistorico={gravarHistorico}
                />
            </div>

            {/* PRINT ROOT (somente folhas) */}
            <div id="print-root" className={abaAtiva !== 'imprimir' ? 'hidden-print-root' : 'no-scrollbar'}>
                {paginas.map((semanasDaPagina, idxPag) => {
                    return (
                        <div key={idxPag} className="page-break bg-white">
                            <div
                                className="page-content"
                                data-qtd={qtdSemanas}
                                style={{
                                    boxSizing: 'border-box',
                                    gap: layout.gap,
                                }}
                            >
                                {semanasDaPagina.map((semana, idxSem) => {
                                    const dataISO = getDataReuniaoISO(semana);
                                    const horarioExib = config?.horarioReuniao ?? config?.horario ?? '';

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
                                                    <h2 className={`${layout.h1} font-bold uppercase tracking-tighter`}>{semana.semana}</h2>
                                                    {qtdSemanas === 5 ? (
                                                        <p className="text-[13px] font-extrabold text-gray-500 uppercase">
                                                            {formatarDataFolha(dataISO, lang)}
                                                        </p>
                                                    ) : (
                                                        <p className={`${layout.h2} font-bold text-gray-500 uppercase`}>
                                                            {config?.nome_cong} | {horarioExib} | {formatarDataFolha(dataISO, lang)}
                                                        </p>
                                                    )}

                                                    {semana?.presidente && (
                                                        <div className="mt-1 flex justify-center items-center gap-2 text-[11px] font-bold text-gray-800 uppercase">
                                                            <span className="bg-gray-100 px-2 rounded">{t.presidente}:</span>
                                                            <span className="underline decoration-2">{semana.presidente.nome}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="re-week-header">
                                                    <div className="re-week-title">{semana.semana}</div>
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
                                                            const firstTipo = getTipo(semana.partes?.[0]);
                                                            const isIntroEnd =
                                                                idxPart === 1 &&
                                                                (firstTipo.toLowerCase().includes('oracao') ||
                                                                    firstTipo.toLowerCase().includes('oração') ||
                                                                    firstTipo.toLowerCase().includes('oración'));

                                                            const sectionChanged = idxPart === 0 || (prev && prev.secao !== parte.secao);

                                                            const tipo = getTipo(parte);
                                                            const showDescOk =
                                                                layout.showDesc &&
                                                                parte.descricao &&
                                                                !(
                                                                    tipo.toLowerCase().includes('oracao') ||
                                                                    tipo.toLowerCase().includes('oração') ||
                                                                    tipo.toLowerCase().includes('oración')
                                                                );

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
                                                                                    ? 'text-slate-700'
                                                                                    : parte.secao === 'ministerio'
                                                                                        ? 'text-amber-700'
                                                                                        : 'text-rose-700'
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
                                                                                ? 'grid-cols-[48px_1fr_240px] gap-x-4 py-2'
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
                                                                            text-right flex flex-col items-end
                                                                            ${qtdSemanas === 1 ? 'min-w-[260px] gap-1' : 'min-w-[140px]'}
                                                                        `}
                                                                        >

                                                                            <span className={`${layout.names} text-black`}>
                                                                                {isEbc ? `${t.dirigente}: ` : ''}
                                                                                {designadoPrincipal?.nome || ''}
                                                                            </span>

                                                                            {/* LEITOR NO ESTUDO BÍBLICO */}
                                                                            {isEbc && leitorEbc && (
                                                                                <div className={`flex items-center gap-1 mt-0.5 ${layout.meta} text-gray-600 leading-tight`}>
                                                                                    <BookOpen size={12} className="text-gray-500" />
                                                                                    <span>{t.leitor}: {leitorEbc.nome}</span>
                                                                                </div>
                                                                            )}

                                                                            {parte?.ajudante && (
                                                                                <p className={`${layout.meta} text-gray-600 leading-tight`}>
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
                <div className="flex-1 bg-white p-6 rounded-2xl border max-w-5xl mx-auto w-full overflow-y-auto no-print">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <MessageCircle className="text-green-600" /> {t.notificarTitulo}
                        </h3>
                        <p className="text-sm text-gray-500">{t.notificarAviso}</p>
                    </div>

                    <div className="space-y-5">
                        {semanasParaNotificar.map((sem, sIdx) => {
                            const partes = Array.isArray(sem?.partes) ? sem.partes : [];
                            const dataISO = getDataReuniaoISO(sem);
                            const horarioExib = config?.horarioReuniao ?? config?.horario ?? '';

                            const oracoes = partes.filter(isOracao);
                            const primeira = partes[0];
                            const ultima = partes[partes.length - 1];

                            const oracaoInicial =
                                oracoes.find((p) => getOracaoPos(p) === 'inicio') ||
                                (primeira && isOracao(primeira) ? primeira : null);

                            const oracaoFinal =
                                oracoes.find((p) => getOracaoPos(p) === 'final') ||
                                (ultima && isOracao(ultima) ? ultima : null);

                            const partesSemOracao = partes.filter((p) => !isOracao(p));
                            const grupos = {
                                tesouros: partesSemOracao.filter((p) => (p?.secao ?? '').toString().trim().toLowerCase() === 'tesouros'),
                                ministerio: partesSemOracao.filter((p) => (p?.secao ?? '').toString().trim().toLowerCase() === 'ministerio'),
                                vida: partesSemOracao.filter((p) => (p?.secao ?? '').toString().trim().toLowerCase() === 'vida'),
                                outros: partesSemOracao.filter((p) => !['tesouros', 'ministerio', 'vida'].includes((p?.secao ?? '').toString().trim().toLowerCase())),
                            };

                            const renderParteNormal = (p) => {
                                const estudante = p?.estudante;
                                if (!estudante) return null;

                                const tituloParte = p?.titulo ?? 'Parte';
                                const descricao = (p?.descricao ?? '').toString().trim();
                                const min = (p?.tempo ?? '').toString().trim();
                                const ajud = p?.ajudante;

                                const msgResp = montarMensagemDesignacao({
                                    t,
                                    lang,
                                    config,
                                    semana: sem.semana,
                                    dataISO,
                                    responsavelNome: estudante.nome,
                                    ajudanteNome: ajud?.nome || '',
                                    tituloParte,
                                    descricaoParte: descricao,
                                    minutosParte: min,
                                });

                                const subjectResp = `${sem.semana} - ${tituloParte}`;
                                const keyResp = buildMsgKey({
                                    dataISO,
                                    semana: sem.semana,
                                    parteId: p?.id || tituloParte,
                                    pessoaId: estudante?.id || estudante?.nome,
                                    role: 'resp',
                                });

                                const msgAjud = ajud?.nome
                                    ? montarMensagemDesignacao({
                                        t,
                                        lang,
                                        config,
                                        semana: sem.semana,
                                        dataISO,
                                        responsavelNome: estudante.nome,
                                        ajudanteNome: ajud.nome,
                                        tituloParte,
                                        descricaoParte: descricao,
                                        minutosParte: min,
                                    })
                                    : null;

                                const subjectAjud = `${sem.semana} - ${t.ajudante} - ${tituloParte}`;
                                const keyAjud = buildMsgKey({
                                    dataISO,
                                    semana: sem.semana,
                                    parteId: p?.id || tituloParte,
                                    pessoaId: ajud?.id || ajud?.nome,
                                    role: 'ajud',
                                });

                                return (
                                    <div
                                        key={`${p.id || tituloParte}-${estudante?.id || estudante?.nome}`}
                                        className="bg-white p-3 rounded-lg shadow-sm border flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{tituloParte}</p>
                                            <p className="text-sm font-bold truncate">{estudante.nome}</p>
                                            {ajud?.nome && (
                                                <p className="text-[12px] print:text-[11px] text-blue-700 font-bold truncate">
                                                    {t.ajudante}: {ajud.nome}
                                                </p>
                                            )}
                                            {descricao && <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-2">{descricao}</p>}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {renderButtons({
                                                pessoa: estudante,
                                                msg: msgResp,
                                                subject: subjectResp,
                                                msgKey: keyResp,
                                                corWa: 'bg-green-100 text-green-700 hover:bg-green-200',
                                            })}

                                            {msgAjud && ajud && (
                                                <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
                                                    {renderButtons({
                                                        pessoa: ajud,
                                                        msg: msgAjud,
                                                        subject: subjectAjud,
                                                        msgKey: keyAjud,
                                                        corWa: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            };

                            const renderOracao = (p, tituloTopoOverride) => {
                                const pessoa = p?.oracao || p?.estudante;
                                if (!pessoa) return null;

                                const tituloParte = p?.titulo || t.oracao;
                                const descricao = (p?.descricao ?? '').toString().trim();
                                const min = (p?.tempo ?? '').toString().trim();

                                const msg = montarMensagemDesignacao({
                                    t,
                                    lang,
                                    config,
                                    semana: sem.semana,
                                    dataISO,
                                    responsavelNome: pessoa.nome,
                                    ajudanteNome: '',
                                    tituloParte,
                                    descricaoParte: descricao,
                                    minutosParte: min,
                                });

                                const subject = `${sem.semana} - ${tituloParte}`;
                                const msgKey = buildMsgKey({
                                    dataISO,
                                    semana: sem.semana,
                                    parteId: p?.id || tituloParte,
                                    pessoaId: pessoa?.id || pessoa?.nome,
                                    role: 'oracao',
                                });

                                return renderCardPessoa({
                                    tituloTopo: tituloTopoOverride || t.oracao,
                                    pessoa,
                                    msg,
                                    subject,
                                    msgKey,
                                    corWa: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                                    compact: true,
                                });
                            };

                            const renderEstudo = (p) => {
                                const dirigente = p?.dirigente || p?.estudante;
                                const leitor = p?.leitor || sem?.leitor;
                                const cards = [];

                                if (dirigente) {
                                    const tituloParte = p?.titulo || 'Estudo bíblico de congregação';
                                    const descricao = (p?.descricao ?? '').toString().trim();
                                    const min = (p?.tempo ?? '').toString().trim();

                                    const msg = montarMensagemDesignacao({
                                        t,
                                        lang,
                                        config,
                                        semana: sem.semana,
                                        dataISO,
                                        responsavelNome: dirigente.nome,
                                        ajudanteNome: '',
                                        tituloParte: `${t.dirigente} - ${tituloParte}`,
                                        descricaoParte: descricao,
                                        minutosParte: min,
                                    });

                                    const subject = `${sem.semana} - ${t.dirigente} - ${tituloParte}`;
                                    const msgKey = buildMsgKey({
                                        dataISO,
                                        semana: sem.semana,
                                        parteId: p?.id || tituloParte,
                                        pessoaId: dirigente?.id || dirigente?.nome,
                                        role: 'dirigente',
                                    });

                                    cards.push(
                                        <React.Fragment key={`dir-${p?.id || tituloParte}`}>
                                            {renderCardPessoa({
                                                tituloTopo: t.dirigente,
                                                pessoa: dirigente,
                                                msg,
                                                subject,
                                                msgKey,
                                                corWa: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
                                            })}
                                        </React.Fragment>
                                    );
                                }

                                if (leitor) {
                                    const tituloParte = p?.titulo || 'Estudo bíblico de congregação';
                                    const descricao = (p?.descricao ?? '').toString().trim();
                                    const min = (p?.tempo ?? '').toString().trim();

                                    const msg = montarMensagemDesignacao({
                                        t,
                                        lang,
                                        config,
                                        semana: sem.semana,
                                        dataISO,
                                        responsavelNome: leitor.nome,
                                        ajudanteNome: '',
                                        tituloParte: `${t.leitor} - ${tituloParte}`,
                                        descricaoParte: descricao,
                                        minutosParte: min,
                                    });

                                    const subject = `${sem.semana} - ${t.leitor} - ${tituloParte}`;
                                    const msgKey = buildMsgKey({
                                        dataISO,
                                        semana: sem.semana,
                                        parteId: p?.id || tituloParte,
                                        pessoaId: leitor?.id || leitor?.nome,
                                        role: 'leitor',
                                    });

                                    cards.push(
                                        <React.Fragment key={`lei-${p?.id || tituloParte}`}>
                                            {renderCardPessoa({
                                                tituloTopo: t.leitor,
                                                pessoa: leitor,
                                                msg,
                                                subject,
                                                msgKey,
                                                corWa: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
                                            })}
                                        </React.Fragment>
                                    );
                                }

                                return <React.Fragment key={p?.id || `estudo-${sIdx}`}>{cards}</React.Fragment>;
                            };

                            const renderParte = (p) => {
                                if (isOracao(p)) return renderOracao(p);
                                if (isEstudo(p)) return renderEstudo(p);
                                if (p?.estudante) return renderParteNormal(p);
                                return null;
                            };

                            const renderSecaoBox = (key) => {
                                const arr = grupos[key];
                                if (!arr || !arr.length) return null;

                                const ui = SECAO_UI[key] || SECAO_UI.vida;

                                return (
                                    <div className={`rounded-2xl border p-4 ${ui.wrap}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`text-[10px] font-black uppercase tracking-widest text-white px-2 py-1 rounded ${ui.chip}`}>
                                                {t.secoes[key]}
                                            </span>
                                            <span className="text-[10px] font-black text-gray-500">{arr.length}</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{arr.map(renderParte)}</div>
                                    </div>
                                );
                            };

                            return (
                                <div key={sIdx} className="bg-gray-50 rounded-2xl p-4 border">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b pb-3 mb-4">
                                        <h4 className="font-black text-blue-900 uppercase text-xs tracking-wider">{sem.semana}</h4>
                                        <div className="text-[11px] text-gray-500 font-bold">
                                            {config?.nome_cong} | {horarioExib} | {formatarDataFolha(dataISO, lang)}
                                        </div>
                                    </div>

                                    {/* Abertura: Presidente + Oração inicial */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                        {sem?.presidente &&
                                            (() => {
                                                const tituloParte = t.presidente;
                                                const msg = montarMensagemDesignacao({
                                                    t,
                                                    lang,
                                                    config,
                                                    semana: sem.semana,
                                                    dataISO,
                                                    responsavelNome: sem.presidente.nome,
                                                    ajudanteNome: '',
                                                    tituloParte,
                                                    descricaoParte: '',
                                                    minutosParte: '',
                                                });
                                                const subject = `${sem.semana} - ${tituloParte}`;
                                                const msgKey = buildMsgKey({
                                                    dataISO,
                                                    semana: sem.semana,
                                                    parteId: 'presidente',
                                                    pessoaId: sem?.presidente?.id || sem?.presidente?.nome,
                                                    role: 'presidente',
                                                });
                                                return renderCardPessoa({
                                                    tituloTopo: t.presidente,
                                                    pessoa: sem.presidente,
                                                    msg,
                                                    subject,
                                                    msgKey,
                                                    corWa: 'bg-green-100 text-green-700 hover:bg-green-200',
                                                });
                                            })()}

                                        {oracaoInicial && renderOracao(oracaoInicial, `${t.oracao} (inicial)`)}
                                    </div>

                                    <div className="space-y-4">
                                        {renderSecaoBox('tesouros')}
                                        {renderSecaoBox('ministerio')}
                                        {renderSecaoBox('vida')}

                                        {grupos.outros.length > 0 && (
                                            <div className="rounded-2xl border p-4 bg-white">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Outros</span>
                                                    <span className="text-[10px] font-black text-gray-500">{grupos.outros.length}</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{grupos.outros.map(renderParte)}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Encerramento: Oração final (se existir e não duplicar a inicial) */}
                                    {oracaoFinal && oracaoFinal !== oracaoInicial && (
                                        <div className="rounded-2xl border p-4 bg-white mt-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Encerramento</span>
                                                <span className="text-[10px] font-black text-gray-500">1</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{renderOracao(oracaoFinal, `${t.oracao} (final)`)}</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RevisarEnviar;
