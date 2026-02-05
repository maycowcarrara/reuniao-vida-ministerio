import React, { useMemo, useState } from 'react';
import {
    Calendar, Users, CheckCircle, AlertTriangle,
    ArrowRight, Activity, Clock, Briefcase, Tent, UsersRound, Plus, Trash2, Info
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

    // --- ESTATÍSTICAS ---
    const stats = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // 1. Próxima Reunião (Baseado nas semanas importadas)
        const ativas = listaProgramacoes
            .filter(s => !s.arquivada)
            .sort((a, b) => new Date(a.dataReuniao) - new Date(b.dataReuniao));

        const proxima = ativas.find(s => new Date(s.dataReuniao) >= hoje) || ativas[0];

        // 2. Lista de Eventos Agendados (Lê das Configurações globais)
        const eventosAgendados = (config?.eventosAnuais || [])
            .sort((a, b) => new Date(a.dataInicio) - new Date(b.dataInicio))
            .filter(ev => new Date(ev.dataInicio) >= hoje); // Apenas futuros ou atuais

        // 3. Pendências
        let partesTotais = 0;
        let partesPreenchidas = 0;
        const isSemReuniao = proxima?.evento && proxima.evento !== 'visita' && proxima.evento !== 'normal';

        if (proxima && !isSemReuniao) {
            if (proxima.presidente) partesPreenchidas++; partesTotais++;
            proxima.partes?.forEach(p => {
                if (p.estudante !== undefined) { partesTotais++; if (p.estudante) partesPreenchidas++; }
                if (p.ajudante !== undefined) { partesTotais++; if (p.ajudante) partesPreenchidas++; }
                if (p.leitor !== undefined) { partesTotais++; if (p.leitor) partesPreenchidas++; }
            });
        }

        const pendentes = partesTotais - partesPreenchidas;
        const progresso = partesTotais > 0 ? (partesPreenchidas / partesTotais) * 100 : (isSemReuniao ? 100 : 0);

        return { proxima, ativas, pendentes, progresso, eventosAgendados, totalAlunos: alunos.length };
    }, [listaProgramacoes, alunos, config?.eventosAnuais]); // Recalcula se a config mudar

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

    const getCorEvento = (tipo) => {
        if (tipo === 'visita') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (tipo === 'congresso') return 'bg-purple-100 text-purple-700 border-purple-200';
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    };

    const getHelpText = () => {
        if (tipoEvento === 'visita') return txt.eventos.helpVisita;
        if (tipoEvento === 'congresso') return txt.eventos.helpCongresso;
        return txt.eventos.helpAssembleia;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{txt.titulo}</h1>
                    <p className="text-gray-500 text-sm">{txt.visaoGeral} {config?.nome_cong || 'Congregação'}</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-full border shadow-sm text-sm text-gray-600 flex items-center gap-2">
                    <Calendar size={16} className="text-blue-600" />
                    <span>{txt.hoje}: <strong>{new Date().toLocaleDateString()}</strong></span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUNA ESQUERDA */}
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
                                    <div className="bg-white/10 rounded-xl p-4 min-w-[220px] backdrop-blur-sm">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-sm font-medium text-blue-100">{txt.status}</span>
                                            <span className="text-2xl font-bold">{Math.round(stats.progresso)}%</span>
                                        </div>
                                        <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                                            <div className={`h-full transition-all duration-1000 ${stats.progresso === 100 ? 'bg-green-400' : 'bg-yellow-400'}`} style={{ width: `${stats.progresso}%` }} />
                                        </div>
                                        <div className="mt-3 flex items-center gap-2 text-sm">
                                            {stats.pendentes === 0 ? (
                                                <span className="flex items-center gap-1 text-green-300 font-bold"><CheckCircle size={16} /> {txt.completo}</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-yellow-300 font-bold"><AlertTriangle size={16} /> {stats.pendentes} {txt.pendentes}</span>
                                            )}
                                        </div>
                                        <button onClick={() => setAbaAtiva('designar')} className="mt-4 w-full bg-white text-blue-700 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition flex items-center justify-center gap-2">
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

                    {/* LISTA DE PRÓXIMOS EVENTOS (AGORA LÊ DAS CONFIGURAÇÕES) */}
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
                                    <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg border text-xs font-bold w-16 text-center ${getCorEvento(ev.tipo)}`}>
                                                {formatarData(ev.dataInput || ev.dataInicio)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 text-sm">{getNomeEvento(ev.tipo)}</p>
                                                <p className="text-xs text-gray-500">Semana de {formatarData(ev.dataInicio)}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Remover evento da lista?')) {
                                                    onDefinirEvento(ev.dataInput, 'normal');
                                                }
                                            }}
                                            className="text-gray-400 hover:text-red-500 p-2"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA */}
                <div className="lg:col-span-1 space-y-6">

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-6">
                        <div className="flex items-center gap-2 mb-4 text-indigo-700 font-bold">
                            <Calendar size={20} />
                            <span>{txt.eventos.agendar}</span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">{txt.eventos.tipo}</label>
                                <select
                                    className="w-full mt-1 p-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
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
                                <label className="text-xs font-bold text-gray-500 uppercase">{txt.eventos.data}</label>
                                <input
                                    type="date"
                                    className="w-full mt-1 p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                                    value={dataEvento}
                                    onChange={(e) => setDataEvento(e.target.value)}
                                />
                                <div className="flex gap-2 mt-2 bg-indigo-50 p-2 rounded text-[10px] text-indigo-800">
                                    <Info size={14} className="shrink-0" />
                                    <p>{getHelpText()}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (!dataEvento) return alert('Selecione uma data');
                                    onDefinirEvento(dataEvento, tipoEvento);
                                    setDataEvento('');
                                }}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition"
                            >
                                <Plus size={16} /> {txt.eventos.adicionar}
                            </button>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-2">
                        <p className="font-bold flex items-center gap-2"><Briefcase size={14} /> {txt.eventos.visita}</p>
                        <p>{txt.eventos.dicaVisita}</p>

                        <div className="h-px bg-blue-200 my-2"></div>

                        <p className="font-bold flex items-center gap-2"><Tent size={14} /> {txt.eventos.assembleia_circuito}</p>
                        <p>{txt.eventos.dicaCancelamento}</p>
                    </div>

                </div>
            </div>
        </div>
    );
}