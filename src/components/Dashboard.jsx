import React, { useMemo, useState } from 'react';
import {
    Calendar, Users, CheckCircle, AlertTriangle,
    ArrowRight, Activity, Clock, Briefcase, Tent, UsersRound, Plus, Trash2, Info,
    UserCheck, UserX, User, Medal, BookHeart, Archive, HeartPulse, ThumbsUp, AlertCircle
} from 'lucide-react';
import { getMeetingDateISOFromSemana } from '../utils/revisarEnviar/dates';
import { getEventoEspecialDaSemana, getTipoEventoSemana } from '../utils/eventos';
import { useSectionMessages } from '../i18n';

export default function Dashboard({
    listaProgramacoes,
    alunos,
    config,
    setAbaAtiva,
    onDefinirEvento,
    t
}) {
    const [dataEvento, setDataEvento] = useState('');
    const [tipoEvento, setTipoEvento] = useState('visita');

    const txt = t?.dashboard || { eventos: {}, estatisticas: {} };
    const localTxt = useSectionMessages('dashboardExtra');

    // --- ESTATÍSTICAS E PAINEL DE SAÚDE ---
    const stats = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const dataLimitePassado = new Date(hoje);
        dataLimitePassado.setDate(hoje.getDate() - 30);

        // Define um limite estrito de +29 dias (4 semanas redondas)
        const daquiA4Semanas = new Date(hoje);
        daquiA4Semanas.setDate(hoje.getDate() + 29);

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

        // 1. Ordernar Reuniões Ativas
        const ativas = listaProgramacoes
            .filter(s => !s.arquivada)
            .map(s => ({ ...s, dataReuniaoResolvida: getDataReuniaoISO(s) }))
            .sort((a, b) => new Date(a.dataReuniaoResolvida || a.dataInicio) - new Date(b.dataReuniaoResolvida || b.dataInicio));

        // Encontrar a próxima reunião
        const proximaIdx = ativas.findIndex(s => {
            if (!s.dataReuniaoResolvida) return false;
            const [ano, mes, dia] = s.dataReuniaoResolvida.split('-').map(Number);
            const dataReuniao = new Date(ano, mes - 1, dia);
            return dataReuniao >= hoje;
        });

        const proxima = proximaIdx !== -1 ? ativas[proximaIdx] : ativas[0];

        // CORREÇÃO: Pega apenas as próximas 4 reuniões contanto que a data não ultrapasse os 29 dias
        const proximasSemanas = [];
        if (proximaIdx !== -1) {
            for (let i = proximaIdx; i < ativas.length; i++) {
                const s = ativas[i];
                if (!s.dataReuniaoResolvida) continue;
                const [ano, mes, dia] = s.dataReuniaoResolvida.split('-').map(Number);
                const dataR = new Date(ano, mes - 1, dia);
                if (dataR <= daquiA4Semanas) {
                    proximasSemanas.push(s);
                }
                if (proximasSemanas.length >= 4) break;
            }
        }

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

        // 3. Pendências (CALCULADORA INTELIGENTE)
        let partesTotais = 0;
        let partesPreenchidas = 0;
        let partesFaltando = [];

        const normalizeStr = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

        proximasSemanas.forEach(sem => {
            const tipoEvento = getTipoEventoSemana(sem, config);
            const isSemReuniao = tipoEvento !== 'normal' && tipoEvento !== 'visita';
            if (isSemReuniao) return;

            const semanaLabel = sem.semana?.split(' -')[0] || '';

            // Presidente
            partesTotais++;
            if (sem.presidente?.id || sem.presidente?.nome) {
                partesPreenchidas++;
            } else {
                partesFaltando.push(`${semanaLabel}: Presidente`);
            }

            sem.partes?.forEach(parte => {
                const tipo = normalizeStr(parte?.tipo);
                const titulo = normalizeStr(parte?.titulo);
                const secao = normalizeStr(parte?.secao);
                const rawInfo = `${tipo} ${titulo} ${secao}`;
                const tituloCurto = parte.titulo?.split(' - ')[0] || 'Parte';

                // Ignora Cânticos Puros
                const isCantico = tipo.includes('cantico') || tipo.includes('cancion') || titulo.includes('cantico') || titulo.includes('cancion');
                const isOracao = tipo.includes('oracao') || tipo.includes('oracion') || titulo.includes('oracao') || titulo.includes('oracion');

                if (isCantico && !isOracao) return;

                if (isOracao) {
                    partesTotais++;
                    if (parte.oracao?.id || parte.oracao?.nome || parte.estudante?.id || parte.estudante?.nome) {
                        partesPreenchidas++;
                    } else {
                        partesFaltando.push(`${semanaLabel}: Oração`);
                    }
                } else if (rawInfo.includes('estudo biblico') || rawInfo.includes('estudio biblico')) {
                    partesTotais += 2; // Dirigente e Leitor

                    if (parte.dirigente?.id || parte.dirigente?.nome) partesPreenchidas++;
                    else partesFaltando.push(`${semanaLabel}: Dirigente (${tituloCurto})`);

                    if (parte.leitor?.id || parte.leitor?.nome) partesPreenchidas++;
                    else partesFaltando.push(`${semanaLabel}: Leitor (${tituloCurto})`);

                } else {
                    // Parte Normal (Estudante sempre é cobrado)
                    partesTotais++;
                    if (parte.estudante?.id || parte.estudante?.nome) {
                        partesPreenchidas++;
                    } else {
                        partesFaltando.push(`${semanaLabel}: Estudante (${tituloCurto})`);
                    }

                    // Ajudante
                    if (secao.includes('minist')) {
                        const isDiscurso = rawInfo.includes('discurso');
                        const isLeitura = rawInfo.includes('leitura');
                        const isExplicando = rawInfo.includes('explicando');

                        if (!isDiscurso && !isLeitura && !isExplicando) {
                            partesTotais++;
                            if (parte.ajudante?.id || parte.ajudante?.nome) {
                                partesPreenchidas++;
                            } else {
                                partesFaltando.push(`${semanaLabel}: Ajudante (${tituloCurto})`);
                            }
                        }
                    }
                }
            });
        });

        const pendentes = partesTotais - partesPreenchidas;
        const progresso = partesTotais > 0 ? (partesPreenchidas / partesTotais) * 100 : (proximasSemanas.length > 0 ? 100 : 0);

        // 4. Estatísticas de Alunos & SAÚDE DA CONGREGAÇÃO
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

        return {
            proxima, ativas, proximasSemanas, pendentes, progresso, eventosAgendados, partesFaltando,
            totalAlunos, totalAtivos, totalDesabilitados,
            countAnciaos, countServos, countIrmas,
            usadosNoTrimestre, precisandoAtencao
        };
    }, [listaProgramacoes, alunos, config]);

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
                            <div className="relative z-10 grid gap-5 min-[920px]:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.9fr)] items-start">
                                <div className="space-y-5">
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
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 min-[920px]:grid-cols-1 gap-3">
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

                                    <div className="rounded-2xl border border-white/15 bg-black/10 p-4 backdrop-blur-sm">
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
                                    <div className="mt-2 text-3xl font-black text-slate-900">
                                        {Math.round(stats.progresso)}%
                                    </div>
                                </div>

                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${stats.pendentes === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {stats.pendentes === 0 ? localTxt.completoMes : `${stats.pendentes} ${localTxt.pendentesMes}`}
                                </span>
                            </div>

                            <div className="mt-4 w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shrink-0">
                                <div className={`h-full transition-all duration-1000 ${stats.progresso === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${stats.progresso}%` }} />
                            </div>

                            <div className="mt-5 flex-1 flex flex-col">
                                {stats.pendentes === 0 ? (
                                    <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-3 text-sm font-bold text-green-700">
                                        <CheckCircle size={16} />
                                        {localTxt.completoMes}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 text-sm font-bold text-amber-700">
                                            <AlertTriangle size={16} />
                                            {stats.pendentes} {localTxt.pendentesMes}
                                        </div>

                                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-y-auto custom-scroll flex-1 min-h-[110px] max-h-[220px]">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">{localTxt.faltando}</p>
                                            <ul className="space-y-2 text-xs text-slate-700">
                                                {stats.partesFaltando.map((falta, i) => (
                                                    <li key={i} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                                                        {falta}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                )}
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
                                <div className="flex min-[1500px]:flex-col min-[1500px]:items-start items-center gap-4 bg-green-50/60 border border-green-100 p-4 rounded-xl">
                                    <ProgressRing percentage={engagementPercentage} />
                                    <div>
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
