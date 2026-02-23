import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Printer,
    MessageCircle,
    BookOpen,
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
import { getMeetingDateISOFromSemana, formatarDataFolha } from '../../utils/revisarEnviar/dates';
import { buildWhatsappHref, buildMailtoHref } from '../../utils/revisarEnviar/links';
import { addHistorico, tipoOracaoToDb } from '../../utils/revisarEnviar/historico';

const RevisarEnviar = ({ historico, alunos, config, onAlunosChange }) => {
    const hasHistorico = Array.isArray(historico) && historico.length > 0;
    const { lang, t } = getI18n(config);

    const [startIndex, setStartIndex] = useState(0);
    const [qtdSemanas, setQtdSemanas] = useState(1);
    const [abaAtiva, setAbaAtiva] = useState('imprimir');
    const [filtroSemanas, setFiltroSemanas] = useState('ativas');
    const [sentMap, setSentMap] = useState({});

    // Sobrescrevendo o texto do botão para o novo conceito de Sincronizar
    const tModificado = {
        ...t,
        btnGravarHistorico: lang === 'es' ? 'Sincronizar Historial' : 'Sincronizar Histórico'
    };

    // --- HELPERS DE TIPO E DETECÇÃO ---
    const getTipo = (p) => (p?.tipo ?? p?.type ?? '').toString();

    const isOracao = (p) => {
        const tipo = getTipo(p).toLowerCase();
        return tipo.includes('oracao') || tipo.includes('oração') || tipo.includes('oración');
    };

    const isEstudo = (p) => {
        const tipo = getTipo(p).toLowerCase();
        const titulo = (p?.titulo ?? '').toLowerCase();
        return tipo === 'estudo' || titulo.includes('estudo bíblico') || titulo.includes('estudio bíblico');
    };

    const getOracaoPos = (p) => {
        const tipo = getTipo(p).toLowerCase();
        const titulo = (p?.titulo ?? '').toString().toLowerCase();
        const raw = `${tipo} ${titulo}`.trim();

        if (raw.includes('inicial') || raw.includes('inicio') || raw.includes('abertura')) return 'inicio';
        if (raw.includes('final') || raw.includes('encerr') || raw.includes('encerramento')) return 'final';
        return null;
    };

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

    // --- PROCESSAMENTO E ORDENAÇÃO ---
    const historicoOrdenado = useMemo(() => {
        return [...historico].sort((a, b) => {
            const dA = a?.dataReuniao ? new Date(a.dataReuniao) : new Date(0);
            const dB = b?.dataReuniao ? new Date(b.dataReuniao) : new Date(0);
            return dA - dB;
        });
    }, [historico]);

    const historicoSelect = useMemo(() => [...historicoOrdenado].reverse(), [historicoOrdenado]);

    // Auto-ajuste do startIndex para a reunião mais próxima
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
            return newSem;
        });
    }, [historicoOrdenado, startSeguro, alunos]);

    const semanasDisponiveis = useMemo(() => {
        if (filtroSemanas === 'todas') return semanasDisponiveisBase;
        if (filtroSemanas === 'arquivadas') return semanasDisponiveisBase.filter(s => !!s?.arquivada);
        return semanasDisponiveisBase.filter(s => !s?.arquivada);
    }, [semanasDisponiveisBase, filtroSemanas]);

    // --- SELEÇÃO DE SEMANAS (CHIPS) ---
    const [printSelecionadas, setPrintSelecionadas] = useState({});
    const prevStartSeguroRef = useRef(startSeguro);
    const userClearedRef = useRef(false);
    const getSemanaKey = (sem, idx) => (sem?.id ?? sem?.dataReuniao ?? sem?.semana ?? String(idx)).toString();

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

        if (userClearedRef.current && marcadas.length === 0) return [];
        return marcadas.length ? marcadas : semanasDisponiveis.slice(0, qtdSemanas);
    }, [semanasDisponiveis, printSelecionadas, qtdSemanas]);

    // --- CÁLCULO DE DATA ---
    const getDataReuniaoISO = (sem) => {
        const dataReferencia = sem.dataInicio || sem.dataReuniao || sem.data;
        const eventoEspecial = config?.eventosAnuais?.find(e => e.dataInicio === dataReferencia);

        if (eventoEspecial?.dataInput) return eventoEspecial.dataInput;

        const hasDataInicio = !!sem?.dataInicio;
        if (hasDataInicio && sem?.dataReuniao && sem.dataReuniao !== sem.dataInicio) {
            return sem.dataReuniao;
        }

        return (
            getMeetingDateISOFromSemana({
                semanaStr: sem?.semana,
                config,
                isoFallback: sem?.dataReuniao || sem?.dataInicio
            }) || sem?.dataReuniao || sem?.dataInicio
        );
    };

    // --- CONFIGURAÇÃO DE LAYOUTS ---
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
                    // h1 e h2 controlam o cabeçalho principal da semana
                    h1: 'text-xl', 
                    h2: 'text-sm',
                    // Títulos das seções (Tesouros, Ministério, etc)
                    sectionTitle: 'text-[16px] font-bold mt-4 mb-2 border-b-2 border-gray-300 uppercase tracking-wide',
                    // Título de cada parte (Ex: Leitura da Bíblia)
                    partTitle: 'text-[14px] font-semibold',
                    // Descrição (quando houver)
                    description: 'text-[12px] leading-snug text-gray-600 mt-0.5 print:text-[10px]',
                    // Nomes dos designados
                    names: 'text-[13px] font-medium',
                    // Ajudante e Leitor (textos menores abaixo do nome principal)
                    meta: 'text-[12px]',
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

        const msgConfirmacao = lang === 'es'
            ? "¿Desea sincronizar el historial? Esto eliminará automáticamente versiones anteriores en estas semanas para evitar duplicados."
            : "Deseja sincronizar o histórico? Isso apagará as versões anteriores das datas destas semanas para não gerar histórico duplicado.";

        if (!window.confirm(msgConfirmacao)) return;

        let novosAlunos = [...alunos];
        let gravouAlgo = false;

        console.log("=== INICIANDO SINCRONIZAÇÃO DE HISTÓRICO ===");

        // 1. PASSO DE LIMPEZA INTELIGENTE POR INTERVALO DE SEMANA
        const rangesParaLimpar = semanasParaImprimir.map(sem => {
            const dataBase = sem.dataInicio || sem.dataReuniao || sem.data;
            if (!dataBase) return null;

            const [ano, mes, dia] = dataBase.split('-').map(Number);
            const start = new Date(ano, mes - 1, dia); // Segunda-feira

            const end = new Date(ano, mes - 1, dia);
            end.setDate(start.getDate() + 6); // Domingo

            return { start, end, label: dataBase };
        }).filter(Boolean);

        console.log("Semanas identificadas para limpeza (Intervalos):",
            rangesParaLimpar.map(r => `Semana ${r.label}: De ${r.start.toLocaleDateString()} a ${r.end.toLocaleDateString()}`)
        );

        if (rangesParaLimpar.length > 0) {
            novosAlunos = novosAlunos.map(aluno => {
                if (!aluno.historico || !Array.isArray(aluno.historico)) return aluno;

                const historicoLimpo = aluno.historico.filter(h => {
                    if (!h.data) return true; // Se não tem data, não apaga

                    const [hAno, hMes, hDia] = h.data.split('-').map(Number);
                    const hDate = new Date(hAno, hMes - 1, hDia);

                    // Verifica se a data do histórico cai dentro de alguma das semanas
                    const caiNaSemana = rangesParaLimpar.some(range => hDate >= range.start && hDate <= range.end);

                    if (caiNaSemana) {
                        console.log(`[LIXEIRA] Apagando registro -> Aluno: ${aluno.nome} | Parte: ${h.parte} | Data antiga: ${h.data}`);
                    }

                    // Retorna "false" (remover) se a data cair na semana.
                    return !caiNaSemana;
                });

                return {
                    ...aluno,
                    historico: historicoLimpo
                };
            });
        }

        console.log("=== LIMPEZA CONCLUÍDA. INICIANDO GRAVAÇÃO DE NOVOS DADOS ===");

        // 2. PASSO DE GRAVAÇÃO
        semanasParaImprimir.forEach((sem) => {
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
                const tituloLower = (p.titulo || '').toLowerCase();
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
                    if (isEstudo(p) || tituloLower.includes('estudo bíblico') || tituloLower.includes('estudio bíblico')) {
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
        });

        console.log("=== SINCRONIZAÇÃO TOTAL FINALIZADA ===");

        if (gravouAlgo) {
            onAlunosChange(novosAlunos);
            alert(lang === 'es' ? '¡Historial sincronizado con éxito!' : 'Histórico sincronizado com sucesso!');
        } else {
            alert(t.nadaParaGravar);
        }
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

        const oracaoInicial = partes.find((p) => isOracao(p) && getOracaoPos(p) === 'inicio');
        const oracaoFinal = partes.find((p) => isOracao(p) && getOracaoPos(p) === 'final');
        
        // Filtramos para IGNORAR orações e cânticos
        const partesReais = partes.filter((p) => {
            if (isOracao(p)) return false;

            const tipo = (p?.tipo ?? p?.type ?? '').toString().toLowerCase();
            const titulo = (p?.titulo ?? '').toString().toLowerCase();
            
            const ehCantico = tipo.includes('cantico') || 
                              tipo.includes('cântico') || 
                              titulo.includes('cantico') || 
                              titulo.includes('cântico');
            
            return !ehCantico;
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

            // 🔍 MÁGICA AQUI: Extrai o número do começo do título (ex: "5. Leitura" -> "5")
            const tituloStr = (parte?.titulo || '').trim();
            const matchNumero = tituloStr.match(/^(\d+)/); 
            const numeroExtraido = matchNumero ? matchNumero[1] : null;

            linhas.push({
                tipo: 'parte',
                pessoaTexto: nomes,
                tempo: parte?.tempo,
                // Prioridade 1: Número do Título | Prioridade 2: Banco de dados
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
                            // Se achou um número real, calibra o nosso contador automático para o próximo número!
                            contadorPartesReais = parseInt(item.numero, 10) + 1;
                        } else {
                            // Se o título não tinha número, usa o contador automático
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
        <div className="space-y-6 h-full flex flex-col relative">

            <div className="no-print">
                <RevisarEnviarHeader
                    t={tModificado}
                    abaAtiva={abaAtiva}
                    setAbaAtiva={setAbaAtiva}
                    startIndex={startIndex}
                    setStartIndex={setStartIndex}
                    filtroSemanas={filtroSemanas}
                    setFiltroSemanas={setFiltroSemanas}
                    qtdSemanas={qtdSemanas}
                    setQtdSemanas={setQtdSemanas}
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
                                    const horarioExib = config?.horarioReuniao ?? config?.horario ?? '19:30';

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
                                                                                : 'grid-cols-[60px_1fr_200px] gap-x-2 py-0.5'
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
                                                                                ${qtdSemanas === 1 ? 'min-w-[260px] gap-1' : 'min-w-[200px]'}
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
                    semanasParaNotificar={semanasParaImprimir}
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