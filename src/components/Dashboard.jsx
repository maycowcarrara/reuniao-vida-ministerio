import React, { useMemo, useState } from 'react';
import {
    Calendar, Users, CheckCircle, AlertTriangle,
    ArrowRight, Activity, Clock, Briefcase, Tent, UsersRound, Plus, Trash2, Info, MessageCircle,
    UserCheck, UserX, User, Medal, BookHeart, Archive, HeartPulse, ThumbsUp, AlertCircle
} from 'lucide-react';
import { getWeekdayJsDay } from '../config/appConfig';
import { getCanonicalWeekStartISO, getMeetingDateISOFromSemana } from '../utils/revisarEnviar/dates';
import { getEventoEspecialDaSemana, getTipoEventoSemana, isTipoEventoBloqueante } from '../utils/eventos';
import { useSectionMessages } from '../i18n';

export default function Dashboard({
    listaProgramacoes,
    alunos,
    config,
    setAbaAtiva,
    onDefinirEvento,
    t,
    confirmacoes = [],
    onAbrirNotificacoesSemana
}) {
    const [dataEvento, setDataEvento] = useState('');
    const [tipoEvento, setTipoEvento] = useState('visita');

    const txt = t?.dashboard || { eventos: {}, estatisticas: {} };
    const localTxt = useSectionMessages('dashboardExtra');
    const normalizeStr = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // --- ESTATÍSTICAS E PAINEL DE SAÚDE ---
    const stats = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const dataLimitePassado = new Date(hoje);
        dataLimitePassado.setDate(hoje.getDate() - 30);
        const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const inicioProximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
        const inicioMesSeguinte = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 1);
        const localeMes = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'pt-BR';

        const getDataReuniaoISO = (sem) => {
            const eventoEspecial = getEventoEspecialDaSemana(sem, config);
            const tipoEvento = getTipoEventoSemana(sem, config);
            const isVisita = tipoEvento === 'visita';

            if (eventoEspecial?.dataInput && !isVisita) {
                return eventoEspecial.dataInput;
            }

            const fallbackStr = sem?.dataReuniao || sem?.dataExata || sem?.dataInicio || sem?.data;

            let dataCalculada = getMeetingDateISOFromSemana({
                semanaStr: sem?.semana,
                config,
                isoFallback: fallbackStr,
                overrideDia: isVisita ? 'terça-feira' : null
            });

            if (!dataCalculada) {
                dataCalculada = fallbackStr;
            }

            if (isVisita && dataCalculada) {
                const [ano, mes, dia] = dataCalculada.split('-').map(Number);
                const d = new Date(ano, mes - 1, dia, 12, 0, 0);

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

        const parseISODate = (dataISO) => {
            if (!dataISO) return null;
            const [ano, mes, dia] = dataISO.split('-').map(Number);
            if (!ano || !mes || !dia) return null;
            return new Date(ano, mes - 1, dia, 12, 0, 0);
        };

        const toISODateOnly = (dateObj) => {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const formatMonthLabel = (date) => {
            const label = new Intl.DateTimeFormat(localeMes, { month: 'long' }).format(date);
            return label.charAt(0).toUpperCase() + label.slice(1);
        };

        const getWeekStartISOFromDate = (dateObj) => {
            const d = new Date(dateObj);
            d.setHours(12, 0, 0, 0);
            const day = d.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            d.setDate(d.getDate() + diffToMonday);
            return toISODateOnly(d);
        };

        const getFirstMeetingDateOnOrAfter = (startDate, weekdayJs) => {
            const d = new Date(startDate);
            d.setHours(12, 0, 0, 0);
            while (d.getDay() !== weekdayJs) {
                d.setDate(d.getDate() + 1);
            }
            return d;
        };

        const getSemanaStartISO = (sem) => getCanonicalWeekStartISO({ sem, config });

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

        const isSongOnlyPart = (parte) => {
            const tipo = normalizeStr(parte?.tipo ?? parte?.type ?? '');
            return tipo === 'cantico';
        };

        const countRequiredAssignmentsForWeek = (semana) => {
            const addRequiredSlot = (value, acc) => {
                acc.total += 1;
                if (value?.id || value?.nome) {
                    acc.preenchidas += 1;
                }
            };

            const totals = { total: 0, preenchidas: 0 };

            addRequiredSlot(semana?.presidente, totals);

            (Array.isArray(semana?.partes) ? semana.partes : []).forEach((parte) => {
                if (isSongOnlyPart(parte)) return;

                if (isPrayerPart(parte)) {
                    addRequiredSlot(parte?.oracao || parte?.estudante, totals);
                    return;
                }

                if (isBibleStudyPart(parte)) {
                    addRequiredSlot(parte?.dirigente || parte?.estudante, totals);
                    addRequiredSlot(parte?.leitor || semana?.leitor, totals);
                    return;
                }

                addRequiredSlot(parte?.estudante, totals);
            });

            return totals;
        };

        const buildAssignmentKey = ({ dataISO, semana, parteId, pessoaId, role }) =>
            [dataISO || '', semana || '', parteId || '', pessoaId || '', role || ''].join('|');

        const countConfirmacoesDaSemana = (semana) => {
            if (!semana?.semana) return { total: 0, confirmadas: 0, recusadas: 0, faltando: 0 };

            const dataISO = getDataReuniaoISO(semana);
            const confirmacoesMap = new Map(
                (confirmacoes || []).map((item) => [String(item?.assignmentKey || '').trim(), item])
            );
            const assignmentKeys = [];

            const addAssignment = (pessoa, role, parteId) => {
                const pessoaId = pessoa?.id || pessoa?.nome;
                if (!pessoaId) return;

                assignmentKeys.push(buildAssignmentKey({
                    dataISO,
                    semana: semana.semana,
                    parteId,
                    pessoaId,
                    role
                }));
            };

            if (semana.presidente) addAssignment(semana.presidente, 'presidente', 'presidente');

            (semana.partes || []).forEach((parte) => {
                const tipo = normalizeStr(parte?.tipo ?? parte?.type ?? '');
                const titulo = normalizeStr(parte?.titulo ?? '');
                const isOracao = tipo.includes('oracao') || titulo.includes('oracao');
                const isEstudo = tipo.includes('estudo') || titulo.includes('estudo biblico') || titulo.includes('estudio biblico');

                if (isOracao) {
                    addAssignment(parte.oracao || parte.estudante, 'oracao', parte.id);
                    return;
                }

                if (isEstudo) {
                    addAssignment(parte.dirigente || parte.estudante, 'dirigente', parte.id);
                    addAssignment(parte.leitor || semana.leitor, 'leitor', parte.id);
                    return;
                }

                addAssignment(parte.estudante, 'resp', parte.id);
                addAssignment(parte.ajudante, 'ajud', parte.id);
            });

            const confirmadas = assignmentKeys.filter((key) => confirmacoesMap.get(key)?.status === 'confirmado').length;
            const recusadas = assignmentKeys.filter((key) => confirmacoesMap.get(key)?.status === 'nao_pode').length;
            return {
                total: assignmentKeys.length,
                confirmadas,
                recusadas,
                faltando: Math.max(assignmentKeys.length - confirmadas - recusadas, 0)
            };
        };

        // 1. Ordernar Reuniões Ativas
        const ativas = listaProgramacoes
            .filter(s => !s.arquivada)
            .map(s => ({
                ...s,
                dataReuniaoResolvida: getDataReuniaoISO(s),
                semanaStartISO: getSemanaStartISO(s)
            }))
            .sort((a, b) => new Date(a.dataReuniaoResolvida || a.dataInicio) - new Date(b.dataReuniaoResolvida || b.dataInicio));

        // Encontrar a próxima reunião
        const proximaIdx = ativas.findIndex(s => {
            if (!s.dataReuniaoResolvida) return false;
            const [ano, mes, dia] = s.dataReuniaoResolvida.split('-').map(Number);
            const dataReuniao = new Date(ano, mes - 1, dia);
            return dataReuniao >= hoje;
        });

        const proxima = proximaIdx !== -1 ? ativas[proximaIdx] : ativas[0];

        // 2. Eventos Agendados
        const eventosAgendados = (config?.eventosAnuais || [])
            .map(ev => {
                const [ano, mes, dia] = ev.dataInicio.split('-').map(Number);
                const dataInicioObj = new Date(ano, mes - 1, dia);

                const fimDaSemana = new Date(dataInicioObj);
                fimDaSemana.setDate(dataInicioObj.getDate() + 6);

                return {
                    ...ev,
                    dataObjeto: dataInicioObj,
                    fimDaSemana: fimDaSemana,
                    isPassado: hoje > fimDaSemana
                };
            })
            .filter(ev => ev.dataObjeto >= dataLimitePassado)
            .sort((a, b) => a.dataObjeto - b.dataObjeto);

        const meetingJsDay = getWeekdayJsDay(config?.dia_reuniao || config?.diaReuniao || config?.diaSemana);
        const semanasBloqueadas = new Set(
            (config?.eventosAnuais || [])
                .filter((evento) => isTipoEventoBloqueante(evento?.tipo))
                .map((evento) => String(evento?.dataInicio || '').trim())
                .filter(Boolean)
        );

        const programacaoPorMes = [
            {
                id: 'atual',
                periodoLabel: localTxt.mesAtual,
                nomeMes: formatMonthLabel(inicioMesAtual),
                inicio: inicioMesAtual,
                fim: inicioProximoMes
            },
            {
                id: 'proximo',
                periodoLabel: localTxt.proximoMes,
                nomeMes: formatMonthLabel(inicioProximoMes),
                inicio: inicioProximoMes,
                fim: inicioMesSeguinte
            }
        ].map((periodo) => {
            const analiseInicio = new Date(Math.max(periodo.inicio.getTime(), hoje.getTime()));
            analiseInicio.setHours(12, 0, 0, 0);

            const semanasPrevistas = new Set();
            if (analiseInicio < periodo.fim && meetingJsDay != null) {
                for (
                    let dataCursor = getFirstMeetingDateOnOrAfter(analiseInicio, meetingJsDay);
                    dataCursor < periodo.fim;
                    dataCursor = new Date(dataCursor.getFullYear(), dataCursor.getMonth(), dataCursor.getDate() + 7, 12, 0, 0)
                ) {
                    const semanaStartISO = getWeekStartISOFromDate(dataCursor);
                    if (!semanasBloqueadas.has(semanaStartISO)) {
                        semanasPrevistas.add(semanaStartISO);
                    }
                }
            }

            const resumoSemanasImportadas = ativas.reduce((acc, semana) => {
                const semanaStartISO = semana.semanaStartISO;

                if (!semanaStartISO || !semanasPrevistas.has(semanaStartISO)) return acc;
                if (isTipoEventoBloqueante(getTipoEventoSemana(semana, config))) return acc;

                const requiredAssignments = countRequiredAssignmentsForWeek(semana);
                const anterior = acc.get(semanaStartISO) || {
                    total: 0,
                    preenchidas: 0
                };

                acc.set(semanaStartISO, {
                    total: Math.max(anterior.total, requiredAssignments.total),
                    preenchidas: Math.max(anterior.preenchidas, requiredAssignments.preenchidas)
                });

                return acc;
            }, new Map());

            const previstas = semanasPrevistas.size;
            const importadas = resumoSemanasImportadas.size;
            const faltandoImportacao = Math.max(previstas - importadas, 0);
            const designacoesObrigatoriasTotal = Array.from(resumoSemanasImportadas.values())
                .reduce((acc, item) => acc + item.total, 0);
            const designacoesObrigatoriasPreenchidas = Array.from(resumoSemanasImportadas.values())
                .reduce((acc, item) => acc + item.preenchidas, 0);
            const designacoesPendentes = Math.max(designacoesObrigatoriasTotal - designacoesObrigatoriasPreenchidas, 0);
            const percentualDesignacoes = designacoesObrigatoriasTotal > 0
                ? Math.round((designacoesObrigatoriasPreenchidas / designacoesObrigatoriasTotal) * 100)
                : (importadas > 0 ? 100 : 0);
            const semReunioesPrevistas = previstas === 0;

            return {
                id: periodo.id,
                periodoLabel: periodo.periodoLabel,
                nomeMes: periodo.nomeMes,
                previstas,
                importadas,
                faltandoImportacao,
                designacoesObrigatoriasTotal,
                designacoesObrigatoriasPreenchidas,
                designacoesPendentes,
                percentualDesignacoes,
                semReunioesPrevistas,
                emDia: faltandoImportacao === 0 && designacoesPendentes === 0
            };
        });

        const mesesCobertos = programacaoPorMes.filter((item) => item.emDia).length;
        const coberturaProgramacao = programacaoPorMes.length > 0
            ? (mesesCobertos / programacaoPorMes.length) * 100
            : 0;

        const historicoContaComoParte = (historico = []) => historico.some((item) => {
            const parte = normalizeStr(item?.parte);
            return [
                'ajudante',
                'joias',
                'leitura',
                'tesouros',
                'ministerio',
                'discurso',
                'estudobiblico',
                'vidacrista'
            ].includes(parte);
        });

        // 3. Estatísticas de Alunos & SAÚDE DA CONGREGAÇÃO
        const totalAlunos = alunos.length;
        const ativosAlunos = alunos.filter(a => a.tipo !== 'desab');
        const totalAtivos = ativosAlunos.length;
        const totalDesabilitados = totalAlunos - totalAtivos;

        const countAnciaos = ativosAlunos.filter(a => a.tipo === 'anciao').length;
        const countServos = ativosAlunos.filter(a => a.tipo === 'servo').length;
        const countIrmas = ativosAlunos.filter(a => ['irma', 'irma_exp', 'irma_lim'].includes(a.tipo)).length;

        // Cálculos do Painel de Saúde
        const hojeTs = new Date().getTime();
        const trimestresTs = hojeTs - (90 * 24 * 60 * 60 * 1000);
        const quatroMesesTs = hojeTs - (120 * 24 * 60 * 60 * 1000);

        let usadosNoTrimestre = 0;
        const precisandoAtencao = [];

        ativosAlunos.forEach(aluno => {
            const historico = Array.isArray(aluno.historico) ? aluno.historico : [];
            const nuncaRecebeuParte = !historicoContaComoParte(historico);

            if (nuncaRecebeuParte) {
                precisandoAtencao.push({ ...aluno, dias: null });
                return;
            }

            const sortedHist = [...historico].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
            const ultimaDataTs = new Date(sortedHist[0].data).getTime();

            if (ultimaDataTs >= trimestresTs) {
                usadosNoTrimestre++;
            }

            if (ultimaDataTs < quatroMesesTs) {
                const diffTime = Math.abs(hojeTs - ultimaDataTs);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                precisandoAtencao.push({ ...aluno, dias: diffDays });
            }
        });

        precisandoAtencao.sort((a, b) => {
            if (a.dias === null) return -1;
            if (b.dias === null) return 1;
            return b.dias - a.dias;
        });

        const resumoConfirmacoes = countConfirmacoesDaSemana(proxima);

        return {
            proxima, ativas, eventosAgendados, programacaoPorMes, mesesCobertos, coberturaProgramacao,
            totalAlunos, totalAtivos, totalDesabilitados,
            countAnciaos, countServos, countIrmas,
            usadosNoTrimestre, precisandoAtencao, resumoConfirmacoes
        };
    }, [listaProgramacoes, alunos, config, confirmacoes, localTxt]);

    // --- HELPERS ---
    const formatarData = (dataIso) => {
        if (!dataIso) return '--/--';
        const [, mes, dia] = dataIso.split('-');
        return `${dia}/${mes}`;
    };

    const getNomeEvento = (tipo) => {
        const map = {
            'visita': txt.eventos.visita,
            'assembleia_betel': txt.eventos.assembleia_betel,
            'assembleia_circuito': txt.eventos.assembleia_circuito,
            'congresso': txt.eventos.congresso
        };
        return map[tipo] || tipo;
    };

    const getCorEvento = (tipo, isPassado) => {
        if (isPassado) return 'bg-gray-100 text-gray-500 border-gray-200 grayscale';
        if (tipo === 'visita') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (tipo === 'congresso') return 'bg-purple-100 text-purple-700 border-purple-200';
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    };

    const getHelpText = () => {
        if (tipoEvento === 'visita') return txt.eventos.helpVisita;
        if (tipoEvento === 'congresso') return txt.eventos.helpCongresso;
        return txt.eventos.helpAssembleia;
    };

    // Helper SVG
    const ProgressRing = ({ percentage }) => {
        const radius = 28;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        return (
            <div className="relative flex items-center justify-center">
                <svg width="70" height="70" className="transform -rotate-90">
                    <circle cx="35" cy="35" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-green-100" />
                    <circle
                        cx="35" cy="35" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent"
                        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                        className="text-green-500 transition-all duration-1000 ease-out drop-shadow-sm"
                    />
                </svg>
                <div className="absolute flex flex-col items-center justify-center inset-0">
                    <span className="text-sm font-black text-green-700">{percentage}%</span>
                </div>
            </div>
        );
    };

    const engagementPercentage = stats.totalAtivos > 0 ? Math.round((stats.usadosNoTrimestre / stats.totalAtivos) * 100) : 0;
    const meetingTypeLabel = stats.proxima?.evento && stats.proxima.evento !== 'normal'
        ? getNomeEvento(stats.proxima.evento)
        : localTxt.reuniaoNormal;
    const meetingTimeText = config?.horario || '19:30';
    const meetingTypeDescription = stats.proxima?.evento?.includes('assembleia') || stats.proxima?.evento === 'congresso'
        ? localTxt.semanaComEvento
        : localTxt.semanaSemEvento;

    const studentOverviewItems = [
        {
            label: localTxt.total,
            value: stats.totalAlunos,
            icon: Users,
            cardClass: 'bg-slate-50 border-slate-200',
            iconClass: 'text-slate-500',
            valueClass: 'text-slate-900',
            labelClass: 'text-slate-500'
        },
        {
            label: localTxt.ativos,
            value: stats.totalAtivos,
            icon: UserCheck,
            cardClass: 'bg-green-50 border-green-100',
            iconClass: 'text-green-600',
            valueClass: 'text-green-700',
            labelClass: 'text-green-600'
        },
        {
            label: localTxt.inativos,
            value: stats.totalDesabilitados,
            icon: UserX,
            cardClass: 'bg-gray-50 border-gray-200',
            iconClass: 'text-gray-500',
            valueClass: 'text-gray-700',
            labelClass: 'text-gray-500'
        },
        {
            label: localTxt.anciaos,
            value: stats.countAnciaos,
            icon: Medal,
            cardClass: 'bg-blue-50 border-blue-100',
            iconClass: 'text-blue-600',
            valueClass: 'text-blue-800',
            labelClass: 'text-blue-500'
        },
        {
            label: localTxt.servos,
            value: stats.countServos,
            icon: User,
            cardClass: 'bg-indigo-50 border-indigo-100',
            iconClass: 'text-indigo-600',
            valueClass: 'text-indigo-800',
            labelClass: 'text-indigo-500'
        },
        {
            label: localTxt.irmas,
            value: stats.countIrmas,
            icon: BookHeart,
            cardClass: 'bg-pink-50 border-pink-100',
            iconClass: 'text-pink-600',
            valueClass: 'text-pink-800',
            labelClass: 'text-pink-500'
        }
    ];

    return (
        <div className="space-y-5 px-3 pt-3 pb-20 sm:p-6 xl:p-7 min-[1800px]:p-8 animate-in fade-in duration-500">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{txt.titulo}</h1>
                    <p className="text-gray-500 text-sm">{txt.visaoGeral} {config?.nome_cong || 'Congregação'}</p>
                </div>
                <div className="bg-white px-3 py-1.5 rounded-full border shadow-sm text-xs text-gray-600 flex items-center gap-2">
                    <Calendar size={14} className="text-blue-600" />
                    <span>{txt.hoje}: <strong>{new Date().toLocaleDateString()}</strong></span>
                </div>
            </div>

            {/* TOP: PAINEL PRINCIPAL */}
            <div className="dashboard-top-grid">
                {stats.proxima ? (
                    <>
                        <div className="dashboard-top-hero bg-gradient-to-r from-blue-700 via-blue-600 to-blue-600 rounded-2xl p-5 sm:p-6 xl:p-7 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.14),transparent_28%)] pointer-events-none" />
                            <div className="relative z-10 grid gap-4 min-[920px]:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)] items-start">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-blue-100 text-xs font-bold uppercase tracking-wider">
                                            <Activity size={14} /> {txt.proximaReuniao}
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl xl:text-[2rem] leading-tight font-bold max-w-4xl">
                                            {stats.proxima.semana}
                                        </h2>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2.5 text-sm">
                                        <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-blue-50 backdrop-blur-sm">
                                            <Clock size={16} />
                                            {formatarData(stats.proxima.dataReuniaoResolvida)}
                                            {stats.proxima.evento === 'visita' ? '' : ` • ${config?.horario || '19:30'}`}
                                        </span>

                                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-blue-50 backdrop-blur-sm">
                                            {stats.proxima.evento === 'visita' && <Briefcase size={15} />}
                                            {stats.proxima.evento === 'congresso' && <UsersRound size={15} />}
                                            {stats.proxima.evento?.includes('assembleia') && <Tent size={15} />}
                                            {(!stats.proxima.evento || stats.proxima.evento === 'normal') && <CheckCircle size={15} />}
                                            {meetingTypeLabel}
                                        </span>

                                        {(stats.proxima.evento?.includes('assembleia') || stats.proxima.evento === 'congresso') && (
                                            <span className="inline-flex items-center gap-2 rounded-full bg-yellow-300/95 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-yellow-950 shadow-sm">
                                                <AlertTriangle size={14} />
                                                {txt.eventos.avisoSemReuniao}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid max-w-2xl gap-2 sm:grid-cols-3">
                                        <div className="rounded-2xl border border-emerald-300/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
                                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/90">
                                                {localTxt.confirmadasProxima}
                                            </div>
                                            <div className="mt-1 text-2xl font-black text-white">
                                                {stats.resumoConfirmacoes.confirmadas}
                                                <span className="ml-1 text-sm font-bold text-blue-100">/ {stats.resumoConfirmacoes.total}</span>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-amber-300/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
                                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/90">
                                                {localTxt.faltamConfirmar}
                                            </div>
                                            <div className="mt-1 text-2xl font-black text-white">
                                                {stats.resumoConfirmacoes.faltando}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-rose-300/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
                                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-100/90">
                                                {localTxt.naoPoderao}
                                            </div>
                                            <div className="mt-1 text-2xl font-black text-white">
                                                {stats.resumoConfirmacoes.recusadas}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => onAbrirNotificacoesSemana?.(stats.proxima)}
                                            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50"
                                        >
                                            <MessageCircle size={16} />
                                            {localTxt.irNotificacoesSemana}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setAbaAtiva('designar')}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/15"
                                        >
                                            {txt.gerenciar}
                                            <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[920px]:grid-cols-2">
                                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/80">
                                            {localTxt.dataReuniao}
                                        </div>
                                        <div className="mt-2 text-2xl font-black text-white">
                                            {formatarData(stats.proxima.dataReuniaoResolvida)}
                                        </div>
                                        <div className="mt-1 text-sm text-blue-100">
                                            {stats.proxima.evento === 'visita' ? txt.eventos.visita : txt.proximaReuniao}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/80">
                                            {localTxt.horarioReuniao}
                                        </div>
                                        <div className="mt-2 text-2xl font-black text-white">
                                            {meetingTimeText}
                                        </div>
                                        <div className="mt-1 text-sm text-blue-100">
                                            {stats.proxima.evento === 'visita' ? localTxt.horarioConformeSemana : localTxt.horarioHabitual}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/15 bg-black/10 p-4 backdrop-blur-sm sm:col-span-2">
                                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/80">
                                            {localTxt.tipoSemana}
                                        </div>
                                        <div className="mt-2 text-lg font-bold text-white leading-snug">
                                            {meetingTypeLabel}
                                        </div>
                                        <div className="mt-1 text-xs text-blue-100 leading-relaxed">
                                            {stats.proxima.evento?.includes('assembleia') || stats.proxima.evento === 'congresso'
                                                ? txt.eventos.avisoSemReuniao
                                                : meetingTypeDescription}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-top-progress bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 flex flex-col">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        {localTxt.visaoMes}
                                    </div>
                                    <div className="mt-2 flex items-end gap-2">
                                        <div className="text-3xl font-black text-slate-900">
                                            {stats.mesesCobertos}/2
                                        </div>
                                        <div className="pb-1 text-sm font-bold text-slate-500">
                                            {localTxt.mesesCobertos}
                                        </div>
                                    </div>
                                </div>

                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${stats.mesesCobertos === 2 ? 'bg-green-100 text-green-700' : stats.mesesCobertos === 1 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {stats.mesesCobertos === 2
                                        ? localTxt.coberturaCompleta
                                        : stats.mesesCobertos === 1
                                            ? localTxt.coberturaParcial
                                            : localTxt.semProgramacaoPeriodo}
                                </span>
                            </div>

                            <div className="mt-4 w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shrink-0">
                                <div
                                    className={`h-full transition-all duration-1000 ${stats.coberturaProgramacao === 100 ? 'bg-green-500' : stats.coberturaProgramacao === 0 ? 'bg-rose-500' : 'bg-amber-500'}`}
                                    style={{ width: `${stats.coberturaProgramacao}%` }}
                                />
                            </div>

                            <div className="mt-5 flex-1 flex flex-col">
                                <div className="space-y-3">
                                    {stats.programacaoPorMes.map((mes) => {
                                        const completionPercent = mes.semReunioesPrevistas
                                            ? 100
                                            : Math.max(0, Math.min(mes.percentualDesignacoes, 100));
                                        const statusClass = mes.semReunioesPrevistas
                                            ? 'border-slate-200 bg-slate-50 text-slate-600'
                                            : mes.emDia
                                                ? 'border-green-200 bg-green-50/70 text-green-700'
                                                : mes.faltandoImportacao > 0
                                                    ? 'border-amber-200 bg-amber-50/70 text-amber-700'
                                                    : 'border-blue-200 bg-blue-50/70 text-blue-700';
                                        const progressFillClass = mes.semReunioesPrevistas
                                            ? 'bg-slate-200/70'
                                            : mes.emDia
                                                ? 'bg-green-200/70'
                                                : mes.faltandoImportacao > 0
                                                    ? 'bg-amber-200/70'
                                                    : 'bg-blue-200/70';
                                        const metaText = mes.semReunioesPrevistas
                                            ? localTxt.semReunioesPrevistas
                                            : `${mes.importadas}/${mes.previstas} ${mes.importadas === 1 ? localTxt.semanaImportada : localTxt.semanasImportadas}`;
                                        const percentText = mes.semReunioesPrevistas
                                            ? ''
                                            : `${mes.percentualDesignacoes}% ${localTxt.designacoesPreenchidas}`;
                                        const badgeText = mes.semReunioesPrevistas
                                            ? localTxt.semReuniao
                                            : mes.emDia
                                                ? localTxt.programacaoCompleta
                                                : mes.faltandoImportacao > 0
                                                    ? `${localTxt.faltam} ${mes.faltandoImportacao} ${mes.faltandoImportacao === 1 ? localTxt.semana : localTxt.semanas}`
                                                    : percentText;

                                        return (
                                            <div key={mes.id} className={`relative overflow-hidden rounded-xl border px-3 py-3 ${statusClass}`}>
                                                <div
                                                    className={`absolute inset-y-0 left-0 rounded-r-2xl transition-all duration-700 ${progressFillClass}`}
                                                    style={{ width: `${completionPercent}%` }}
                                                    aria-hidden="true"
                                                />

                                                <div className="relative z-10 flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">
                                                            {mes.periodoLabel}
                                                        </div>
                                                        <div className="mt-1 text-base font-black">
                                                            {mes.nomeMes}
                                                        </div>
                                                        <div className="mt-1 text-xs font-bold opacity-90">
                                                            {metaText}
                                                        </div>
                                                        {!mes.semReunioesPrevistas && (
                                                            <div className="mt-1 text-[11px] font-semibold opacity-80">
                                                                {percentText}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black">
                                                        {mes.semReunioesPrevistas ? <Info size={14} /> : mes.emDia ? <CheckCircle size={14} /> : mes.faltandoImportacao > 0 ? <AlertTriangle size={14} /> : <Info size={14} />}
                                                        {badgeText}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button onClick={() => setAbaAtiva('designar')} className="mt-5 w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-sm shadow-blue-200">
                                {txt.gerenciar} <ArrowRight size={14} />
                            </button>
                        </div>

                        <div className="dashboard-top-health bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6 flex flex-col">
                            <div className="flex items-center gap-2 mb-4 text-rose-600 font-bold border-b border-gray-50 pb-3">
                                <HeartPulse size={18} />
                                <span className="text-sm">{localTxt.saudeTitulo}</span>
                            </div>

                            <div className="grid gap-4 flex-1 min-[1500px]:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.2fr)] min-[1800px]:grid-cols-1">
                                <div className="flex items-center gap-4 bg-green-50/60 border border-green-100 p-4 rounded-xl">
                                    <ProgressRing percentage={engagementPercentage} />
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-green-900 text-sm">{localTxt.rodizio}</h4>
                                        <p className="text-xs text-green-700 mt-1 leading-tight">{localTxt.rodizioSub}</p>
                                    </div>
                                </div>

                                <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex flex-col flex-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h4 className="font-bold text-red-900 text-sm flex items-center gap-1.5">
                                                <AlertCircle size={16} className="text-red-600" /> {localTxt.atencao}
                                            </h4>
                                            <p className="text-[10px] text-red-700 mt-0.5">{localTxt.atencaoSub}</p>
                                        </div>
                                        <span className="bg-red-200 text-red-800 text-xs font-black px-2.5 py-0.5 rounded-full">
                                            {stats.precisandoAtencao.length}
                                        </span>
                                    </div>

                                    {stats.precisandoAtencao.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-2 text-green-600">
                                            <ThumbsUp size={24} className="mb-2 opacity-50" />
                                            <p className="text-xs font-medium">{localTxt.tudoEmDia}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {stats.precisandoAtencao.slice(0, 3).map(aluno => (
                                                <div key={aluno.id} className="flex justify-between items-center text-xs p-2.5 bg-white rounded-lg border border-red-100 shadow-sm">
                                                    <span className="font-bold text-red-900 truncate max-w-[180px]">{aluno.nome}</span>
                                                    <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded font-bold whitespace-nowrap border border-red-100">
                                                        {aluno.dias === null ? localTxt.nunca : `${aluno.dias} ${localTxt.dias}`}
                                                    </span>
                                                </div>
                                            ))}
                                            {stats.precisandoAtencao.length > 3 && (
                                                <button onClick={() => setAbaAtiva('alunos')} className="w-full text-center text-[11px] text-red-500 font-bold hover:text-red-700 pt-2 pb-1">
                                                    + {stats.precisandoAtencao.length - 3} {localTxt.outros}...
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-gray-100 rounded-2xl p-8 text-center border-2 border-dashed border-gray-300">
                        <p className="text-gray-500 mb-4">{txt.semReuniaoFutura}</p>
                        <button onClick={() => setAbaAtiva('importar')} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition">{txt.importar}</button>
                    </div>
                )}
            </div>

            {/* LOWER PANELS */}
            <div className="grid grid-cols-1 min-[1800px]:grid-cols-12 gap-6">

                {/* PAINEL VISÃO GERAL DE ALUNOS */}
                <div className="min-[1800px]:col-span-5 bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-5 text-blue-800 font-bold border-b pb-3 border-gray-100">
                        <Users size={18} />
                        <span className="text-sm">{localTxt.alunosTitulo}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 min-[1500px]:grid-cols-6 min-[1800px]:grid-cols-3 gap-3">
                        {studentOverviewItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className={`rounded-xl border p-3.5 flex flex-col justify-between min-h-[110px] ${item.cardClass}`}>
                                    <Icon size={16} className={item.iconClass} />
                                    <div className="mt-5">
                                        <div className={`text-2xl font-black leading-none ${item.valueClass}`}>{item.value}</div>
                                        <div className={`mt-1 text-[10px] uppercase tracking-[0.18em] font-bold ${item.labelClass}`}>{item.label}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
                        <button
                            onClick={() => setAbaAtiva('alunos')}
                            className="w-full sm:w-auto bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            {localTxt.irParaAlunos} <ArrowRight size={14} />
                        </button>
                    </div>
                </div>

                {/* GESTÃO DE EVENTOS E VISITAS */}
                <div className="min-[1800px]:col-span-7 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 font-bold text-indigo-800 flex items-center gap-2 bg-indigo-50/40">
                        <Tent size={18} className="text-indigo-600" />
                        <span>{localTxt.gestaoEventosVisitas}</span>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] min-[1800px]:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.75fr)] divide-y xl:divide-y-0 xl:divide-x divide-gray-100">

                        {/* Lista de Eventos */}
                        <div className="bg-white">
                            {stats.eventosAgendados.length === 0 ? (
                                <div className="p-10 text-center text-gray-400 text-sm flex h-full items-center justify-center">
                                    {txt.eventos.semEventos}
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50 max-h-[320px] min-[1800px]:max-h-[420px] overflow-y-auto custom-scroll">
                                    {stats.eventosAgendados.map((ev, idx) => (
                                        <div key={idx} className={`px-6 py-4 flex items-center justify-between transition-colors ${ev.isPassado ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg border text-xs font-bold w-16 text-center ${getCorEvento(ev.tipo, ev.isPassado)}`}>
                                                    {formatarData(ev.dataInicio)}
                                                </div>
                                                <div>
                                                    <p className={`font-bold text-sm ${ev.isPassado ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                                        {getNomeEvento(ev.tipo)}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <p className="text-xs text-gray-500">
                                                            {localTxt.semanaDe} {formatarData(ev.dataInicio)}
                                                        </p>
                                                        {ev.isPassado && (
                                                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                                                                <Archive size={10} /> {localTxt.passado}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(localTxt.removerEventoLista)) {
                                                        onDefinirEvento(ev.dataInicio, 'normal');
                                                    }
                                                }}
                                                className="text-gray-400 hover:text-red-500 p-2 bg-white rounded-full shadow-sm border border-gray-100 transition-colors"
                                                title={localTxt.removerEvento}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Agendar Evento */}
                        <div className="p-6 bg-gray-50/30 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-4 text-gray-700 font-bold">
                                <Calendar size={16} />
                                <span className="text-sm">{txt.eventos.agendar}</span>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{txt.eventos.tipo}</label>
                                        <select
                                            className="w-full mt-1.5 p-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all shadow-sm"
                                            value={tipoEvento}
                                            onChange={(e) => {
                                                setTipoEvento(e.target.value);
                                                setDataEvento('');
                                            }}
                                        >
                                            <option value="visita">{txt.eventos.visita}</option>
                                            <option value="assembleia_betel">{txt.eventos.assembleia_betel}</option>
                                            <option value="assembleia_circuito">{txt.eventos.assembleia_circuito}</option>
                                            <option value="congresso">{txt.eventos.congresso}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{txt.eventos.data}</label>
                                        <input
                                            type="date"
                                            className="w-full mt-1.5 p-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all shadow-sm"
                                            value={dataEvento}
                                            onChange={(e) => setDataEvento(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2.5 bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg text-xs text-indigo-800 leading-relaxed shadow-sm">
                                    <Info size={16} className="shrink-0 mt-0.5 text-indigo-500" />
                                    <p>{getHelpText()}</p>
                                </div>

                                <button
                                    onClick={() => {
                                        if (!dataEvento) return alert(localTxt.selecioneData);
                                        onDefinirEvento(dataEvento, tipoEvento);
                                        setDataEvento('');
                                    }}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-200 mt-2"
                                >
                                    <Plus size={16} /> {txt.eventos.adicionar}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
