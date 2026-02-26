import React, { useState, useMemo } from 'react';
import { Search, Calendar, User, BookOpen, ChevronRight, Lock, Music, CalendarPlus, Star } from 'lucide-react';

const formatarData = (dataISO) => {
    if (!dataISO) return 'Data não definida';
    const data = new Date(dataISO + 'T12:00:00');
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
};

const checkEstaSemana = (dataInicioISO) => {
    if (!dataInicioISO) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const inicioSemana = new Date(dataInicioISO + 'T00:00:00');
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(fimSemana.getDate() + 6);
    
    return hoje >= inicioSemana && hoje <= fimSemana;
};

const gerarLinkAgenda = (parte, dataSemanaISO) => {
    const dataReuniao = dataSemanaISO ? new Date(dataSemanaISO + 'T19:30:00') : new Date();
    const start = dataReuniao.toISOString().replace(/-|:|\.\d+/g, '');
    const dataFim = new Date(dataReuniao.getTime() + (parte.tempo || 10) * 60000);
    const end = dataFim.toISOString().replace(/-|:|\.\d+/g, '');
    
    const texto = encodeURIComponent(`Designação: ${parte.titulo}`);
    const desc = encodeURIComponent(`Seção: ${parte.secao || 'Reunião'}\nTempo: ${parte.tempo || 0} min\nLembre-se de chegar com antecedência!`);
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${texto}&dates=${start}/${end}&details=${desc}`;
};

export default function QuadroPublico({ programacoes, config }) {
    const [busca, setBusca] = useState('');
    const [autenticado, setAutenticado] = useState(false);
    const [senhaInput, setSenhaInput] = useState('');

    const SENHA_CONGREGACAO = "2026";

    const handleLogin = (e) => {
        e.preventDefault();
        if (senhaInput === SENHA_CONGREGACAO) {
            setAutenticado(true);
            localStorage.setItem('quadro_auth', 'true');
        } else {
            alert('Senha incorreta!');
        }
    };

    useMemo(() => {
        if (localStorage.getItem('quadro_auth') === 'true') {
            setAutenticado(true);
        }
    }, []);

    const semanasParaExibir = useMemo(() => {
        if (!programacoes) return [];

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        hoje.setDate(hoje.getDate() - 2);

        let futuras = programacoes.filter(sem => {
            if (sem.arquivada) return false;
            const dataReuniao = new Date((sem.dataReuniao || sem.dataInicio) + 'T12:00:00');
            return dataReuniao >= hoje;
        });

        const termo = busca.toLowerCase().trim();
        if (termo) {
            futuras = futuras.map(sem => {
                const temPres = sem.presidente?.nome?.toLowerCase().includes(termo);

                const partesFiltradas = (sem.partes || []).filter(p => {
                    const nEstudante = p.estudante?.nome?.toLowerCase() || '';
                    const nAjudante = p.ajudante?.nome?.toLowerCase() || '';
                    const nOracao = p.oracao?.nome?.toLowerCase() || '';
                    const nDirigente = p.dirigente?.nome?.toLowerCase() || '';
                    const nLeitor = p.leitor?.nome?.toLowerCase() || '';

                    return nEstudante.includes(termo) || nAjudante.includes(termo) ||
                        nOracao.includes(termo) || nDirigente.includes(termo) || nLeitor.includes(termo);
                });

                if (temPres || partesFiltradas.length > 0) {
                    return { ...sem, partes: partesFiltradas };
                }
                return null;
            }).filter(Boolean);
        }

        futuras.sort((a, b) => {
            const dataA = new Date((a.dataReuniao || a.dataInicio) + 'T12:00:00');
            const dataB = new Date((b.dataReuniao || b.dataInicio) + 'T12:00:00');
            return dataA.getTime() - dataB.getTime();
        });

        return futuras;
    }, [programacoes, busca]);

    if (!autenticado) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
                    <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-xl font-black text-gray-800 mb-2">Quadro de Anúncios</h2>
                    <p className="text-sm text-gray-500 mb-6">Digite o código de acesso da congregação para visualizar as designações.</p>
                    <input
                        type="number"
                        pattern="[0-9]*"
                        placeholder="Ex: 2026"
                        className="w-full text-center text-2xl font-bold tracking-widest bg-gray-50 border border-gray-200 rounded-xl py-3 outline-none focus:border-blue-500 mb-4"
                        value={senhaInput}
                        onChange={e => setSenhaInput(e.target.value)}
                    />
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">
                        Acessar
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
            
            {/* CABEÇALHO 100% FIXO */}
            <div className="bg-blue-700 text-white sticky top-0 z-50 shadow-md shrink-0 w-full">
                <div className="px-4 py-4 max-w-2xl mx-auto">
                    <h1 className="text-lg font-black leading-tight">{config?.nome_cong || 'Reunião Vida e Ministério'}</h1>
                    <p className="text-blue-200 text-xs font-medium">Quadro de Designações Virtual</p>

                    <div className="mt-4">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3 text-blue-300" />
                            <input
                                type="text"
                                placeholder="Busque pelo seu nome..."
                                className="w-full bg-blue-800/50 border border-blue-600/50 text-white placeholder-blue-300 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:bg-blue-800 focus:ring-2 focus:ring-blue-400 transition"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                            />
                        </div>
                        {/* Texto de aviso posicionado no fluxo normal (não corta mais) */}
                        {busca && (
                            <div className="mt-2 text-[11px] font-bold text-yellow-300 flex items-center gap-1">
                                Mostrando apenas as suas partes 👇
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CORPO DA PÁGINA COM ROLAGEM */}
            <div className="flex-1 overflow-y-auto pb-10">
                <div className="px-4 pt-6 max-w-2xl mx-auto space-y-5">
                    {semanasParaExibir.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Calendar size={48} className="mx-auto mb-3 opacity-20" />
                            <p className="font-bold">Nenhuma designação futura encontrada.</p>
                        </div>
                    ) : (
                        semanasParaExibir.map((sem, idx) => {
                            
                            const estaSemana = checkEstaSemana(sem.dataInicio);
                            const isVisita = sem.evento === 'visita';
                            const isAssembleia = sem.evento === 'assembleia' || sem.evento === 'congresso';
                            
                            let borderClass = "border-gray-200";
                            let headerClass = "bg-slate-50 border-gray-100";
                            
                            if (isVisita) {
                                borderClass = "border-blue-400 ring-2 ring-blue-100";
                                headerClass = "bg-blue-50 border-blue-200";
                            } else if (isAssembleia) {
                                borderClass = "border-amber-400 ring-2 ring-amber-100";
                                headerClass = "bg-amber-50 border-amber-200";
                            } else if (estaSemana) {
                                borderClass = "border-emerald-400 shadow-emerald-100 shadow-lg";
                            }

                            // Tenta capturar os cânticos de várias formas que podem estar no seu banco
                            const cant1 = sem.cantico1 || sem.canticoInicial || sem.cantico_1;
                            const cant2 = sem.cantico2 || sem.canticoIntermediario || sem.canticoMeio || sem.cantico_2;
                            const cant3 = sem.cantico3 || sem.canticoFinal || sem.cantico_3;
                            const temCanticos = cant1 || cant2 || cant3;

                            return (
                                <div key={sem.id || idx} className={`bg-white rounded-2xl shadow-sm border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 ${borderClass}`}>
                                    
                                    {isVisita && (
                                        <div className="bg-blue-600 text-white text-[11px] font-bold uppercase tracking-widest text-center py-1.5 flex items-center justify-center gap-2">
                                            <Star size={12} className="fill-white" /> Visita do Superintendente de Circuito
                                        </div>
                                    )}
                                    {isAssembleia && (
                                        <div className="bg-amber-500 text-white text-[11px] font-bold uppercase tracking-widest text-center py-1.5 flex items-center justify-center gap-2">
                                            <Star size={12} className="fill-white" /> Semana de Assembleia / Congresso
                                        </div>
                                    )}

                                    <div className={`${headerClass} border-b px-4 py-3 flex items-center justify-between`}>
                                        <div className="flex-1">
                                            <div className="flex items-center flex-wrap gap-2">
                                                <h3 className="font-black text-gray-800 text-sm">{sem.semana}</h3>
                                                {estaSemana && !isVisita && !isAssembleia && (
                                                    <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap">
                                                        Esta Semana
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-0.5">
                                                <Calendar size={12} /> {formatarData(sem.dataReuniao || sem.dataInicio)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        {sem.presidente && (!busca || sem.presidente.nome.toLowerCase().includes(busca.toLowerCase())) && (
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                                    <User size={18} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase">Presidente</p>
                                                    <p className="text-sm font-bold text-gray-800">{sem.presidente.nome}</p>
                                                </div>
                                            </div>
                                        )}

                                        {sem.partes?.map((parte, i) => {
                                            let labelSecao = null;
                                            let secaoCor = '';

                                            if (parte.secao === 'tesouros') {
                                                labelSecao = 'Tesouros da Palavra de Deus';
                                                secaoCor = 'bg-slate-100 text-slate-700';
                                            } else if (parte.secao === 'ministerio') {
                                                labelSecao = 'Faça Seu Melhor no Ministério';
                                                secaoCor = 'bg-amber-100 text-amber-800';
                                            } else if (parte.secao === 'vida') {
                                                labelSecao = 'Nossa Vida Cristã';
                                                secaoCor = 'bg-rose-100 text-rose-800';
                                            }

                                            const principal = parte.estudante || parte.dirigente || parte.oracao;

                                            return (
                                                <div key={i} className="flex gap-3 relative">
                                                    <div className="w-px bg-gray-200 absolute left-5 top-8 bottom-0 -z-10"></div>
                                                    <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex flex-col items-center justify-center shrink-0 z-10">
                                                        <span className="text-[9px] font-bold text-gray-400">{parte.tempo}m</span>
                                                    </div>
                                                    <div className="flex-1 pb-3">
                                                        
                                                        {labelSecao && (
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${secaoCor}`}>
                                                                {labelSecao}
                                                            </span>
                                                        )}
                                                        
                                                        <p className="text-xs font-bold text-gray-800 mt-1 leading-tight pr-2">{parte.titulo}</p>

                                                        <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded-lg p-2">
                                                            {principal?.nome && (
                                                                <div className="flex justify-between items-center">
                                                                    <p className="text-sm font-bold text-gray-900">{principal.nome}</p>
                                                                    
                                                                    <a 
                                                                        href={gerarLinkAgenda(parte, sem.dataReuniao || sem.dataInicio)} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="bg-blue-100/50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-md transition-colors"
                                                                        title="Adicionar à Agenda"
                                                                    >
                                                                        <CalendarPlus size={14} />
                                                                    </a>
                                                                </div>
                                                            )}
                                                            {parte.ajudante?.nome && (
                                                                <p className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1">
                                                                    <ChevronRight size={10} className="text-gray-400" />
                                                                    Ajudante: <span className="font-semibold">{parte.ajudante.nome}</span>
                                                                </p>
                                                            )}
                                                            {parte.leitor?.nome && (
                                                                <p className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1">
                                                                    <BookOpen size={10} className="text-gray-400" />
                                                                    Leitor: <span className="font-semibold">{parte.leitor.nome}</span>
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* CÂNTICOS COM MELHOR DETECÇÃO */}
                                        {!busca && temCanticos && (
                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-around bg-slate-50/50 rounded-xl p-2">
                                                {cant1 && (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase">Inicial</span>
                                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                                            <Music size={10} className="text-blue-500"/> {cant1}
                                                        </span>
                                                    </div>
                                                )}
                                                {cant2 && (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase">Meio</span>
                                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                                            <Music size={10} className="text-amber-500"/> {cant2}
                                                        </span>
                                                    </div>
                                                )}
                                                {cant3 && (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase">Final</span>
                                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                                            <Music size={10} className="text-rose-500"/> {cant3}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="text-center mt-8 text-[10px] text-gray-400 font-medium pb-8">
                    Atualizado em tempo real.
                </div>
            </div>
        </div>
    );
}