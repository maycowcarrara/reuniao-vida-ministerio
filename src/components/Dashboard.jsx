import React, { useMemo, useState } from 'react';
import {
    Calendar, Users, CheckCircle, AlertTriangle,
    ArrowRight, Activity, Clock, Briefcase, Tent, UsersRound, Plus, Trash2, Info,
    UserCheck, UserX, User, Medal, BookHeart, Archive, HeartPulse, ThumbsUp, AlertCircle
} from 'lucide-react';

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

    // Fallback de idioma local
    const lang = (config?.idioma || 'pt').toLowerCase().startsWith('es') ? 'es' : 'pt';

    const localTxt = {
        pt: {
            alunosTitulo: "Visão Geral de Alunos",
            total: "Total",
            ativos: "Ativos",
            inativos: "Desab.",
            irParaAlunos: "Gerenciar Alunos",
            anciaos: "Anciãos",
            servos: "Servos",
            irmas: "Irmãs",
            passado: "Concluído",
            saudeTitulo: "Saúde da Congregação",
            rodizio: "Engajamento (90 dias)",
            rodizioSub: "dos alunos ativos com partes",
            atencao: "Precisam de Atenção",
            atencaoSub: "Sem designação há mais de 4 meses",
            nunca: "Nunca designado",
            dias: "dias",
            tudoEmDia: "Excelente! Nenhum aluno esquecido.",
            visaoMes: "Designações (Próx. 4 Semanas)",
            pendentesMes: "pendentes no mês",
            completoMes: "Mês completo!",
            faltando: "Falta preencher:"
        },
        es: {
            alunosTitulo: "Resumen de Estudiantes",
            total: "Total",
            ativos: "Activos",
            inativos: "Deshab.",
            irParaAlunos: "Gestionar Estudiantes",
            anciaos: "Ancianos",
            servos: "Siervos",
            irmas: "Hermanas",
            passado: "Concluido",
            saudeTitulo: "Salud de la Congregación",
            rodizio: "Participación (90 días)",
            rodizioSub: "de los activos con asignaciones",
            atencao: "Necesitan Atención",
            atencaoSub: "Sin asignación por más de 4 meses",
            nunca: "Nunca asignado",
            dias: "días",
            tudoEmDia: "¡Excelente! Ningún estudiante olvidado.",
            visaoMes: "Asignaciones (Próx. 4 Semanas)",
            pendentesMes: "pendientes en el mes",
            completoMes: "¡Mes completo!",
            faltando: "Falta rellenar:"
        }
    }[lang];

    // --- ESTATÍSTICAS E PAINEL DE SAÚDE ---
    const stats = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const dataLimitePassado = new Date(hoje);
        dataLimitePassado.setDate(hoje.getDate() - 30);

        // 1. Ordernar Reuniões Ativas
        const ativas = listaProgramacoes
            .filter(s => !s.arquivada)
            .sort((a, b) => new Date(a.dataReuniao || a.dataInicio) - new Date(b.dataReuniao || b.dataInicio));

        // Encontrar a próxima reunião
        const proximaIdx = ativas.findIndex(s => {
            if (!s.dataReuniao) return false;
            const [ano, mes, dia] = s.dataReuniao.split('-').map(Number);
            const dataReuniao = new Date(ano, mes - 1, dia);
            return dataReuniao >= hoje;
        });

        const proxima = proximaIdx !== -1 ? ativas[proximaIdx] : ativas[0];
        
        // Obter as próximas 4 reuniões para calcular o progresso do mês
        const proximasSemanas = proximaIdx !== -1 ? ativas.slice(proximaIdx, proximaIdx + 4) : [];

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

        // 3. Pendências (CALCULADORA INTELIGENTE PARA AS PRÓXIMAS 4 SEMANAS)
        let partesTotais = 0;
        let partesPreenchidas = 0;
        let partesFaltando = []; // <-- NOVIDADE: Armazena O QUE está faltando

        const normalizeStr = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        proximasSemanas.forEach(sem => {
            const isSemReuniao = sem.evento && sem.evento !== 'visita' && sem.evento !== 'normal';
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

                    // Ajudante: Só existe em "Faça Seu Melhor no Ministério"
                    if (secao.includes('minist')) {
                        const isDiscurso = rawInfo.includes('discurso');
                        const isLeitura = rawInfo.includes('leitura');
                        const isExplicando = rawInfo.includes('explicando'); // Explicando suas crenças (Discurso)
                        
                        // MÁGICA AQUI: Se for discurso ou leitura, o ajudante NÃO é exigido na matemática!
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
        const trimestresTs = hojeTs - (90 * 24 * 60 * 60 * 1000); // 90 dias
        const quatroMesesTs = hojeTs - (120 * 24 * 60 * 60 * 1000); // 120 dias

        let usadosNoTrimestre = 0;
        const precisandoAtencao = [];

        ativosAlunos.forEach(aluno => {
            if (!aluno.historico || aluno.historico.length === 0) {
                precisandoAtencao.push({ ...aluno, dias: null });
                return;
            }

            const sortedHist = [...aluno.historico].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
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

        // Ordena a lista de esquecidos: os que NUNCA tiveram parte ou há mais tempo
        precisandoAtencao.sort((a, b) => {
            if (a.dias === null) return -1;
            if (b.dias === null) return 1;
            return b.dias - a.dias;
        });

        return {
            proxima, ativas, pendentes, progresso, eventosAgendados, partesFaltando,
            totalAlunos, totalAtivos, totalDesabilitados,
            countAnciaos, countServos, countIrmas,
            usadosNoTrimestre, precisandoAtencao
        };
    }, [listaProgramacoes, alunos, config?.eventosAnuais]);

    // --- HELPERS ---
    const formatarData = (dataIso) => {
        if (!dataIso) return '--/--';
        const [ano, mes, dia] = dataIso.split('-');
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

    // Helper SVG para o círculo de progresso
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

    return (
        <div className="space-y-6 p-6 animate-in fade-in duration-500 pb-20">

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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUNA ESQUERDA (Principal & Saúde) */}
                <div className="lg:col-span-2 space-y-6">
                    {stats.proxima ? (
                        <div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-blue-100 text-xs font-bold uppercase tracking-wider">
                                        <Activity size={14} /> {txt.proximaReuniao}
                                    </div>
                                    <h2 className="text-3xl font-bold">{stats.proxima.semana}</h2>

                                    <div className="text-blue-100 flex flex-col gap-1 mt-2">
                                        <span className="flex items-center gap-2">
                                            <Clock size={16} />
                                            {formatarData(stats.proxima.dataReuniao)}
                                            {stats.proxima.evento === 'visita' ? '' : ` • ${config?.horario || '19:30'}`}
                                        </span>

                                        {stats.proxima.evento && stats.proxima.evento !== 'normal' && (
                                            <span className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-lg text-sm font-bold w-fit mt-1">
                                                {stats.proxima.evento === 'visita' && <Briefcase size={14} />}
                                                {stats.proxima.evento === 'congresso' && <UsersRound size={14} />}
                                                {stats.proxima.evento.includes('assembleia') && <Tent size={14} />}
                                                {getNomeEvento(stats.proxima.evento)}
                                            </span>
                                        )}
                                    </div>

                                    {(stats.proxima.evento?.includes('assembleia') || stats.proxima.evento === 'congresso') && (
                                        <div className="mt-4 bg-yellow-400 text-yellow-900 px-3 py-2 rounded-lg text-xs font-bold shadow-sm inline-block">
                                            {txt.eventos.avisoSemReuniao}
                                        </div>
                                    )}
                                </div>

                                {!stats.proxima.evento?.includes('assembleia') && stats.proxima.evento !== 'congresso' && (
                                    <div className="bg-white/10 rounded-xl p-4 min-w-[220px] backdrop-blur-sm flex flex-col">
                                        <div className="flex justify-between items-end mb-2 gap-4">
                                            <span className="text-[10px] font-bold text-blue-100 uppercase tracking-wider leading-tight w-24">
                                                {localTxt.visaoMes}
                                            </span>
                                            <span className="text-2xl font-bold">{Math.round(stats.progresso)}%</span>
                                        </div>
                                        <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden shrink-0">
                                            <div className={`h-full transition-all duration-1000 ${stats.progresso === 100 ? 'bg-green-400' : 'bg-yellow-400'}`} style={{ width: `${stats.progresso}%` }} />
                                        </div>
                                        
                                        {/* NOVO: LISTA DE PENDÊNCIAS DEDO-DURO */}
                                        <div className="mt-3 flex-1 flex flex-col justify-start">
                                            {stats.pendentes === 0 ? (
                                                <span className="flex items-center gap-1 text-green-300 font-bold text-sm"><CheckCircle size={16} /> {localTxt.completoMes}</span>
                                            ) : (
                                                <>
                                                    <span className="flex items-center gap-1 text-yellow-300 font-bold text-sm mb-2"><AlertTriangle size={16} /> {stats.pendentes} {localTxt.pendentesMes}</span>
                                                    
                                                    <div className="bg-black/20 rounded p-2 overflow-y-auto custom-scroll flex-1 min-h-[50px] max-h-[80px]">
                                                        <p className="text-[9px] font-bold text-blue-200 uppercase tracking-wider mb-1">{localTxt.faltando}</p>
                                                        <ul className="text-[10px] text-white leading-tight space-y-1 list-disc pl-3">
                                                            {stats.partesFaltando.map((falta, i) => (
                                                                <li key={i}>{falta}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <button onClick={() => setAbaAtiva('designar')} className="mt-4 w-full bg-white text-blue-700 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition flex items-center justify-center gap-2 shrink-0">
                                            {txt.gerenciar} <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-100 rounded-2xl p-8 text-center border-2 border-dashed border-gray-300">
                            <p className="text-gray-500 mb-4">{txt.semReuniaoFutura}</p>
                            <button onClick={() => setAbaAtiva('importar')} className="bg-blue-600 text-white px-4 py-2 rounded-lg">{txt.importar}</button>
                        </div>
                    )}

                    {/* --- NOVO: PAINEL DE SAÚDE DA CONGREGAÇÃO --- */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-center gap-2 mb-4 text-rose-600 font-bold border-b border-gray-50 pb-3">
                            <HeartPulse size={18} />
                            <span>{localTxt.saudeTitulo}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Gráfico de Rodízio */}
                            <div className="flex items-center gap-4 bg-green-50/50 border border-green-100 p-4 rounded-xl">
                                <ProgressRing percentage={stats.totalAtivos > 0 ? Math.round((stats.usadosNoTrimestre / stats.totalAtivos) * 100) : 0} />
                                <div>
                                    <h4 className="font-bold text-green-900 text-sm">{localTxt.rodizio}</h4>
                                    <p className="text-[11px] text-green-700 mt-0.5 leading-tight">{localTxt.rodizioSub}</p>
                                </div>
                            </div>

                            {/* Lista de Alunos precisando de atenção */}
                            <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex flex-col h-full">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="font-bold text-red-900 text-sm flex items-center gap-1.5">
                                            <AlertCircle size={14} className="text-red-600" /> {localTxt.atencao}
                                        </h4>
                                        <p className="text-[10px] text-red-700 mt-0.5">{localTxt.atencaoSub}</p>
                                    </div>
                                    <span className="bg-red-200 text-red-800 text-[10px] font-black px-2 py-0.5 rounded-full">
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
                                            <div key={aluno.id} className="flex justify-between items-center text-xs p-2 bg-white rounded border border-red-100 shadow-sm">
                                                <span className="font-bold text-red-900 truncate max-w-[120px]">{aluno.nome}</span>
                                                <span className="text-[9px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-bold whitespace-nowrap border border-red-100">
                                                    {aluno.dias === null ? localTxt.nunca : `${aluno.dias} ${localTxt.dias}`}
                                                </span>
                                            </div>
                                        ))}
                                        {stats.precisandoAtencao.length > 3 && (
                                            <button onClick={() => setAbaAtiva('alunos')} className="w-full text-center text-[10px] text-red-500 font-bold hover:text-red-700 pt-1">
                                                + {stats.precisandoAtencao.length - 3} {lang === 'es' ? 'otros' : 'outros'}...
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* LISTA DE PRÓXIMOS EVENTOS */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800">
                            {txt.eventos.titulo}
                        </div>
                        {stats.eventosAgendados.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                {txt.eventos.semEventos}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {stats.eventosAgendados.map((ev, idx) => (
                                    <div
                                        key={idx}
                                        className={`px-6 py-3 flex items-center justify-between transition-colors
                                            ${ev.isPassado ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50 bg-white'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Data Badge */}
                                            <div className={`p-1.5 rounded-lg border text-[10px] font-bold w-14 text-center ${getCorEvento(ev.tipo, ev.isPassado)}`}>
                                                {formatarData(ev.dataInicio)}
                                            </div>

                                            {/* Info Evento */}
                                            <div>
                                                <p className={`font-bold text-xs ${ev.isPassado ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                                    {getNomeEvento(ev.tipo)}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] text-gray-500">
                                                        Semana de {formatarData(ev.dataInicio)}
                                                    </p>
                                                    {ev.isPassado && (
                                                        <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 rounded flex items-center gap-1">
                                                            <Archive size={10} /> {localTxt.passado}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Botão Excluir */}
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Remover evento da lista?')) {
                                                    onDefinirEvento(ev.dataInicio, 'normal');
                                                }
                                            }}
                                            className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                                            title="Remover evento"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA (Laterais) */}
                <div className="lg:col-span-1 space-y-6">

                    {/* --- PAINEL DE ALUNOS ATUALIZADO --- */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-3 text-blue-800 font-bold border-b pb-2 border-gray-100">
                            <Users size={18} />
                            <span className="text-sm">{localTxt.alunosTitulo}</span>
                        </div>

                        {/* Totais Gerais */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 flex flex-col items-center justify-center">
                                <span className="text-[9px] uppercase font-black text-gray-400 mb-0.5">{localTxt.total}</span>
                                <span className="text-xl font-black text-gray-800">{stats.totalAlunos}</span>
                            </div>
                            <div className="bg-green-50 p-2 rounded-lg border border-green-100 flex flex-col items-center justify-center">
                                <span className="text-[9px] uppercase font-black text-green-600 mb-0.5">{localTxt.ativos}</span>
                                <span className="text-xl font-black text-green-700">{stats.totalAtivos}</span>
                            </div>
                        </div>

                        {/* Detalhes (Anciãos, Servos, Irmãs) */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="bg-blue-50/50 p-2 rounded border border-blue-100 flex flex-col items-center">
                                <Medal size={14} className="text-blue-500 mb-1" />
                                <span className="text-sm font-bold text-blue-900">{stats.countAnciaos}</span>
                                <span className="text-[8px] uppercase font-bold text-blue-400">{localTxt.anciaos}</span>
                            </div>
                            <div className="bg-indigo-50/50 p-2 rounded border border-indigo-100 flex flex-col items-center">
                                <User size={14} className="text-indigo-500 mb-1" />
                                <span className="text-sm font-bold text-indigo-900">{stats.countServos}</span>
                                <span className="text-[8px] uppercase font-bold text-indigo-400">{localTxt.servos}</span>
                            </div>
                            <div className="bg-pink-50/50 p-2 rounded border border-pink-100 flex flex-col items-center">
                                <BookHeart size={14} className="text-pink-500 mb-1" />
                                <span className="text-sm font-bold text-pink-900">{stats.countIrmas}</span>
                                <span className="text-[8px] uppercase font-bold text-pink-400">{localTxt.irmas}</span>
                            </div>
                        </div>

                        {/* Rodapé do Card (Desabilitados + Botão) */}
                        <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-50">
                            {stats.totalDesabilitados > 0 ? (
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <UserX size={12} />
                                    <span>{stats.totalDesabilitados} {localTxt.inativos}</span>
                                </div>
                            ) : <div></div>}

                            <button
                                onClick={() => setAbaAtiva('alunos')}
                                className="bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 py-1 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                            >
                                {localTxt.irParaAlunos} <ArrowRight size={12} />
                            </button>
                        </div>
                    </div>

                    {/* AGENDAR EVENTO (Compacto) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-3 text-indigo-700 font-bold border-b pb-2 border-gray-100">
                            <Calendar size={18} />
                            <span className="text-sm">{txt.eventos.agendar}</span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{txt.eventos.tipo}</label>
                                <select
                                    className="w-full mt-0.5 p-1.5 border rounded text-xs bg-gray-50 outline-none focus:ring-1 focus:ring-indigo-200"
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
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{txt.eventos.data}</label>
                                <input
                                    type="date"
                                    className="w-full mt-0.5 p-1.5 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-200"
                                    value={dataEvento}
                                    onChange={(e) => setDataEvento(e.target.value)}
                                />
                                <div className="flex gap-2 mt-2 bg-indigo-50 p-2 rounded text-[10px] text-indigo-800 leading-tight">
                                    <Info size={12} className="shrink-0 mt-0.5" />
                                    <p>{getHelpText()}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (!dataEvento) return alert('Selecione uma data');
                                    onDefinirEvento(dataEvento, tipoEvento);
                                    setDataEvento('');
                                }}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg flex items-center justify-center gap-2 transition text-xs shadow-sm"
                            >
                                <Plus size={14} /> {txt.eventos.adicionar}
                            </button>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-[10px] text-blue-800 space-y-2">
                        <p className="font-bold flex items-center gap-1.5"><Briefcase size={12} /> {txt.eventos.visita}</p>
                        <p className="leading-tight opacity-80">{txt.eventos.dicaVisita}</p>
                    </div>

                </div>
            </div>
        </div>
    );
}