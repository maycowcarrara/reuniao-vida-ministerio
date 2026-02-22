import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, MessageCircle, BookOpen, Archive, Mail, CheckCircle, Briefcase, Tent, UsersRound } from 'lucide-react';

import RevisarEnviarHeader from './RevisarEnviarHeader';
import "./revisarEnviar.print.css";
import RevisarEnviarNotificarTab from './RevisarEnviarNotificarTab';

import { getI18n } from '../utils/revisarEnviar/translations';
import { getMeetingDateISOFromSemana, formatarDataFolha } from '../utils/revisarEnviar/dates';
import { buildWhatsappHref, buildMailtoHref } from '../utils/revisarEnviar/links';
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

    // historicoSelect: Do mais novo para o mais antigo (para o dropdown)
    const historicoSelect = useMemo(() => [...historicoOrdenado].reverse(), [historicoOrdenado]);

    // --- AJUSTE 1: Definir startIndex padrão para a semana ativa mais antiga ---
    useEffect(() => {
        if (historicoSelect.length > 0) {
            let indexMaisAntigaAtiva = -1;

            for (let i = historicoSelect.length - 1; i >= 0; i--) {
                if (!historicoSelect[i].arquivada) {
                    indexMaisAntigaAtiva = i;
                    break;
                }
            }

            if (indexMaisAntigaAtiva !== -1) {
                setStartIndex(indexMaisAntigaAtiva);
            } else {
                setStartIndex(0);
            }
        }
    }, [historicoSelect]);

    const realStartIndex = historicoOrdenado.length - 1 - startIndex;
    const startSeguro = Math.max(0, realStartIndex);

    const getSemanaKey = (sem, idx) =>
        (sem?.id ?? sem?.dataReuniao ?? sem?.semana ?? String(idx)).toString();

    // --- MÁGICA DA HIDRATAÇÃO ---
    // Atualiza os dados de contato do aluno com base na lista de alunos mais recente!
    const semanasDisponiveisBase = useMemo(() => {
        const hidratar = (snap) => {
            if (!snap || !snap.id) return snap;
            const fresco = alunos.find(a => a.id === snap.id);
            // Pega o snapshot antigo, mas sobrescreve com dados frescos se o aluno ainda existir
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
            return newSem;
        });
    }, [historicoOrdenado, startSeguro, alunos]);

    const semanasDisponiveis = useMemo(() => {
        if (filtroSemanas === 'todas') return semanasDisponiveisBase;
        if (filtroSemanas === 'arquivadas') return semanasDisponiveisBase.filter(s => !!s?.arquivada);
        return semanasDisponiveisBase.filter(s => !s?.arquivada); // ativas (default)
    }, [semanasDisponiveisBase, filtroSemanas]);

    const [printSelecionadas, setPrintSelecionadas] = useState({});

    const prevStartSeguroRef = useRef(startSeguro);
    const userClearedRef = useRef(false);

    useEffect(() => {
        const startChanged = prevStartSeguroRef.current !== startSeguro;

        if (!startChanged && userClearedRef.current) return;

        const hasAnySelected = Object.values(printSelecionadas).some(Boolean);
        if (!startChanged && hasAnySelected) return;

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

        if (userClearedRef.current) return [];

        return marcadas.length ? marcadas : semanasDisponiveis.slice(0, qtdSemanas);
    }, [semanasDisponiveis, printSelecionadas, qtdSemanas]);

    const getDataReuniaoISO = (sem) => {
        const eventoEspecial = config?.eventosAnuais?.find(e => e.dataInicio === sem.dataInicio);

        if (eventoEspecial) {
            if (eventoEspecial.dataInput) {
                return eventoEspecial.dataInput;
            }
        }

        if (sem?.dataReuniao && sem.dataReuniao !== sem.dataInicio) {
            return sem.dataReuniao;
        }

        return (
            getMeetingDateISOFromSemana({
                semanaStr: sem?.semana,
                config,
                isoFallback: sem?.dataReuniao
            }) || null
        );
    };

    const getLayoutConfig = (qtd) => {
        switch (qtd) {
            case 1:
                return {
                    semanasPorPag: 1,
                    sectionTitle: 'text-lg font-bold mt-6 mb-4 border-b border-gray-400 uppercase tracking-wide',
                    partTitle: 'text-base font-semibold',
                    description: 'text-[11px] leading-snug text-gray-600 mt-0.5 print:text-[9.5px] print:leading-tight',
                    names: 'text-base font-semibold text-right',
                    meta: 'text-sm text-gray-600',
                    grid: 'grid-cols-[80px_1fr_220px] gap-x-6',
                };
            case 2:
                return {
                    semanasPorPag: 2,
                    sectionTitle: 'text-[11px] font-bold mt-2 mb-1 border-b border-gray-300 uppercase tracking-wide',
                    partTitle: 'text-[11px] font-semibold',
                    description: 'text-[9px] leading-tight text-gray-500 mt-0.5 print:text-[8px]',
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

    const gravarHistorico = () => {
        if (typeof onAlunosChange !== 'function') {
            alert(t.erroSemCallback);
            return;
        }
        if (!Array.isArray(alunos) || alunos.length === 0) {
            alert(t.nadaParaGravar);
            return;
        }

        const msgConfirmacao = lang === 'es'
            ? "¿Desea guardar el historial? Esto actualizará las fechas y eliminará automáticamente a los hermanos que hayan sido sustituidos."
            : "Deseja gravar o histórico? Isso atualizará as datas e removerá automaticamente os irmãos que foram substituídos.";

        const ok = window.confirm(t.confirmarGravar || msgConfirmacao);
        if (!ok) return;

        let novosAlunos = [...alunos];
        let gravouAlgo = false;

        // 1. PASSO DE LIMPEZA INTELIGENTE
        const datasParaLimpar = semanasParaImprimir
            .map(sem => getDataReuniaoISO(sem))
            .filter(Boolean);

        if (datasParaLimpar.length > 0) {
            novosAlunos = novosAlunos.map(aluno => {
                if (!aluno.historico || !Array.isArray(aluno.historico)) return aluno;
                return {
                    ...aluno,
                    historico: aluno.historico.filter(h => !datasParaLimpar.includes(h.data))
                };
            });
        }

        // 3. PASSO DE GRAVAÇÃO
        semanasParaImprimir.forEach((sem) => {
            const data = getDataReuniaoISO(sem);
            if (!data) return;

            if (sem?.presidente?.id) {
                novosAlunos = addHistorico(novosAlunos, sem.presidente.id, {
                    data,
                    parte: 'presidente',
                    ajudante: '',
                });
                gravouAlgo = true;
            }

            (sem?.partes || []).forEach((p) => {
                const tituloLower = (p.titulo || '').toLowerCase();
                const secaoLower = (p.secao || '').toLowerCase();

                let termoGravacao = '';

                if (isOracao(p)) {
                    termoGravacao = 'oracao';
                }
                else if (secaoLower === 'tesouros') {
                    if (tituloLower.includes('joias') || tituloLower.includes('joyas')) {
                        termoGravacao = 'joias';
                    } else if (tituloLower.includes('leitura') || tituloLower.includes('lectura')) {
                        termoGravacao = 'leitura';
                    } else {
                        termoGravacao = 'tesouros';
                    }
                }
                else if (secaoLower === 'ministerio') {
                    if (tituloLower.includes('discurso')) {
                        termoGravacao = 'discurso';
                    } else {
                        termoGravacao = 'ministerio';
                    }
                }
                else if (secaoLower === 'vida' || isEstudo(p) || tituloLower.includes('estudo') || tituloLower.includes('estudio')) {
                    if (isEstudo(p) || tituloLower.includes('estudo bíblico') || tituloLower.includes('estudio bíblico')) {
                        termoGravacao = 'estudobiblico';
                    } else {
                        termoGravacao = 'vidacrista';
                    }
                }

                if (termoGravacao) {
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

                if (p.ajudante?.id) {
                    novosAlunos = addHistorico(novosAlunos, p.ajudante.id, {
                        data,
                        parte: 'ajudante',
                        ajudante: p.estudante?.nome || '',
                    });
                    gravouAlgo = true;
                }

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

    const handlePrint = () => {
        try {
            window.print();
        } catch (e) {
            console.error("Erro ao imprimir", e);
            alert("Não foi possível abrir a janela de impressão do seu navegador.");
        }
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
                    showWeekTabs={true} /* MÁGICA: SEMPRE EXIBE OS CHIPS DE SELEÇÃO! */
                    semanasDisponiveis={semanasDisponiveis}
                    getSemanaKey={getSemanaKey}
                    printSelecionadas={printSelecionadas}
                    toggleSemanaPrint={toggleSemanaPrint}
                    selecionarTodasPrint={selecionarTodasPrint}
                    limparPrint={limparPrint}
                    onPrint={handlePrint}
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

                                    const eventoEspecial = config?.eventosAnuais?.find(e => e.dataInicio === semana.dataInicio);
                                    const isVisita = semana.evento === 'visita' || eventoEspecial?.tipo === 'visita';

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
                                                        {semana.semana}
                                                        {isVisita && (
                                                            <span className="text-[9px] bg-white text-blue-700 px-2 py-0.5 rounded border border-blue-700 font-bold uppercase tracking-widest">
                                                                VISITA DO SC
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
                <RevisarEnviarNotificarTab
                    semanasParaNotificar={semanasParaImprimir} /* MÁGICA: USA O ARRAY SELECIONADO DOS CHIPS! */
                    config={config}
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
                />
            )}
        </div>
    );
};

export default RevisarEnviar;