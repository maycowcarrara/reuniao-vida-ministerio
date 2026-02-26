import React, { useState, useMemo } from 'react';
import {
    Search,
    Calendar,
    User,
    BookOpen,
    ChevronRight,
    Lock,
    Music,
    CalendarPlus,
    Star,
    Info,
    LayoutDashboard,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { Link } from 'react-router-dom';


// ============================================================================
// FUNÇÕES AUXILIARES (HELPERS)
// ============================================================================

// --- FUNÇÃO CORRIGIDA ---
const extrairNumeroCantico = (texto) => {
    if (!texto) return '';
    // Procura pela palavra "cântico" (com ou sem acento, case insensitive), 
    // seguida opcionalmente de espaços, e captura os números seguintes.
    const regex = /c[âa]ntico\s*(\d+)/i;
    const match = texto.match(regex);

    // Se encontrou o padrão "cântico X", retorna o grupo capturado (o número)
    if (match && match[1]) {
        return match[1];
    }

    // Fallback: se a palavra "cântico" não existir, mas o tipo da parte for cantico,
    // ele tenta pegar o último número da string para evitar pegar minutos.
    const numbers = texto.match(/\d+/g);
    return numbers ? numbers[numbers.length - 1] : '';
};

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

// --- FUNÇÃO DE AGENDA APRIMORADA ---
const gerarLinkAgenda = (parte, dataSemanaISO) => {
    const dataReuniao = dataSemanaISO ? new Date(dataSemanaISO + 'T19:30:00') : new Date();
    const start = dataReuniao.toISOString().replace(/-|:|\.\d+/g, '');
    const dataFim = new Date(dataReuniao.getTime() + (parseInt(parte.tempo) || 10) * 60000);
    const end = dataFim.toISOString().replace(/-|:|\.\d+/g, '');

    // Define o principal
    const principal = parte.estudante || parte.dirigente || parte.oracao;
    const nomePrincipal = principal?.nome ? `Designado: ${principal.nome}\n` : '';
    const nomeAjudante = parte.ajudante?.nome ? `Ajudante: ${parte.ajudante.nome}\n` : '';
    const nomeLeitor = parte.leitor?.nome ? `Leitor: ${parte.leitor.nome}\n` : '';

    const texto = encodeURIComponent(`Reunião: ${parte.titulo}`);
    const desc = encodeURIComponent(`Seção: ${parte.secao || 'Reunião'}\nTempo: ${parte.tempo} min\n\n${nomePrincipal}${nomeAjudante}${nomeLeitor}`);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${texto}&dates=${start}/${end}&details=${desc}`;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function QuadroPublico({ programacoes, config }) {
    const [busca, setBusca] = useState('');
    const [autenticado, setAutenticado] = useState(false);
    const [senhaInput, setSenhaInput] = useState('');

    // Estado para controlar a semana expandida (guarda o ID ou índice)
    const [semanaExpandida, setSemanaExpandida] = useState(0);

    const SENHA_CONGREGACAO = "2026";

    const handleLogin = (e) => {
        e.preventDefault();
        if (senhaInput === SENHA_CONGREGACAO) {
            setAutenticado(true);
            localStorage.setItem('quadro_auth', 'true');
        } else {
            alert('Código de acesso incorreto.');
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

        let filtradas = programacoes.filter(sem => {
            if (sem.arquivada) return false;
            const dataReuniao = new Date((sem.dataReuniao || sem.dataInicio) + 'T12:00:00');
            return dataReuniao >= hoje;
        });

        const termo = busca.toLowerCase().trim();
        if (termo) {
            filtradas = filtradas.map(sem => {
                const temPres = sem.presidente?.nome?.toLowerCase().includes(termo);
                const partesFiltradas = (sem.partes || []).filter(p => {
                    const nomes = [
                        p.estudante?.nome,
                        p.ajudante?.nome,
                        p.oracao?.nome,
                        p.dirigente?.nome,
                        p.leitor?.nome
                    ].map(n => n?.toLowerCase() || '');
                    return nomes.some(n => n.includes(termo));
                });

                if (temPres || partesFiltradas.length > 0) {
                    // Quando há busca, força a exibir apenas as partes encontradas
                    return { ...sem, partes: partesFiltradas, filtrado: true };
                }
                return null;
            }).filter(Boolean);
        }

        return filtradas.sort((a, b) =>
            new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime()
        );
    }, [programacoes, busca]);


    if (!autenticado) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-sm text-center border border-slate-200">
                    <div className="bg-blue-600 text-white w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3">
                        <Lock size={40} className="-rotate-3" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Acesso ao Quadro</h2>
                    <p className="text-slate-500 text-sm mb-8 px-4 leading-relaxed">
                        Digite o código da congregação para visualizar as próximas designações.
                    </p>
                    <input
                        type="number"
                        pattern="[0-9]*"
                        placeholder="0000"
                        className="w-full text-center text-4xl font-black tracking-[0.2em] bg-slate-50 border-2 border-slate-200 rounded-2xl py-4 focus:border-blue-500 focus:bg-white outline-none transition-all mb-6"
                        value={senhaInput}
                        onChange={e => setSenhaInput(e.target.value)}
                    />
                    <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95">
                        Acessar Agora
                    </button>
                </form>
            </div>
        );
    }

    // Toggle da semana
    const toggleSemana = (idx) => {
        setSemanaExpandida(prev => prev === idx ? null : idx);
    };

    return (
        <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">

            {/* HEADER FIXO NO TOPO - MAIS COMPACTO */}
            <header className="bg-blue-700 text-white shadow-md z-50 shrink-0">
                <div className="px-4 py-4 max-w-2xl mx-auto">
                    <div className="flex justify-between items-center mb-3">
                        <div>
                            <h1 className="text-lg font-black leading-none tracking-tight">{config?.nome_cong || 'Palmas PR'}</h1>
                            <p className="text-blue-200 text-[9px] font-bold uppercase tracking-[0.1em] mt-1 opacity-90">Vida e Ministério</p>
                        </div>
                        <div className="bg-blue-800/60 p-2 rounded-xl border border-blue-500/30 shadow-inner">
                            <LayoutDashboard size={18} className="text-blue-100" />
                        </div>
                    </div>

                    {/* BARRA DE PESQUISA COMPACTA */}
                    <div className="space-y-2">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3 text-blue-300" />
                            <input
                                type="text"
                                placeholder="Filtrar por nome..."
                                className="w-full bg-blue-800/40 border border-blue-400/30 text-white placeholder-blue-300 rounded-xl pl-10 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 transition-all shadow-inner text-sm"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                            />
                        </div>

                        {/* AVISO DE FILTRO ATIVO */}
                        {busca && (
                            <div className="bg-yellow-400 text-yellow-950 text-[10px] font-black px-3 py-2 rounded-lg flex items-center gap-2 animate-in fade-in duration-300 shadow-sm">
                                <Info size={14} className="shrink-0" />
                                <span className="uppercase tracking-wider">Filtrando suas partes</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ÁREA DE ROLAGEM DOS CARDS */}
            <main className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
                <div className="max-w-2xl mx-auto space-y-6">

                    {semanasParaExibir.length === 0 ? (
                        <div className="text-center py-20 text-slate-300">
                            <Calendar size={60} className="mx-auto mb-4 opacity-10" />
                            <p className="font-black uppercase tracking-[0.1em] text-xs">Nenhuma reunião futura</p>
                        </div>
                    ) : (
                        semanasParaExibir.map((sem, idx) => {
                            const estaSemana = checkEstaSemana(sem.dataInicio);
                            const isVisita = sem.evento === 'visita';
                            const isEspecial = sem.evento && sem.evento !== 'normal';

                            // A semana está expandida se não houver busca e for o card ativo, OU se houver busca ativa
                            const isExpanded = busca ? true : semanaExpandida === idx;

                            // Extração de cânticos
                            const numCantInicial = extrairNumeroCantico(sem.partes?.find(p => p.tipo === 'oracao_inicial')?.titulo);
                            const numCantMeio = extrairNumeroCantico(sem.partes?.find(p => p.tipo === 'cantico')?.titulo);
                            const numCantFinal = extrairNumeroCantico(sem.partes?.find(p => p.tipo === 'oracao_final')?.titulo);

                            return (
                                <div key={idx} className={`bg-white rounded-3xl shadow-sm border overflow-hidden transition-all duration-300 ${isVisita ? 'border-blue-500' :
                                    estaSemana ? 'border-emerald-500 ring-1 ring-emerald-200' :
                                        isEspecial ? 'border-amber-500' : 'border-slate-200'
                                    }`}>

                                    {/* BANNERS ESPECIAIS */}
                                    {isVisita && (
                                        <div className="bg-blue-500 text-white text-[10px] font-black uppercase tracking-[0.1em] text-center py-2 flex items-center justify-center gap-2">
                                            <Star size={12} className="fill-white" /> Visita do Superintendente
                                        </div>
                                    )}
                                    {isEspecial && !isVisita && (
                                        <div className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.1em] text-center py-2 flex items-center justify-center gap-2">
                                            <Star size={12} className="fill-white" /> Evento Especial
                                        </div>
                                    )}

                                    {/* CABEÇALHO DO CARD (Clicável) */}
                                    <button
                                        onClick={() => toggleSemana(idx)}
                                        className={`w-full px-5 py-4 flex justify-between items-center transition-colors ${estaSemana ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100'
                                            }`}
                                    >
                                        <div className="text-left">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-black text-slate-800 text-base">{sem.semana}</h3>
                                                {estaSemana && (
                                                    <span className="bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md">
                                                        Atual
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-blue-600 font-bold text-xs flex items-center gap-1.5 uppercase">
                                                <Calendar size={12} /> {formatarData(sem.dataReuniao || sem.dataInicio)}
                                            </p>
                                        </div>
                                        <div className="text-slate-400">
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </button>

                                    {/* CONTEÚDO DA SEMANA (Colapsável) */}
                                    {isExpanded && (
                                        <div className="p-5 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">

                                            {/* CÂNTICOS NO TOPO (Apenas visão geral) */}
                                            {!busca && (numCantInicial || numCantMeio || numCantFinal) && (
                                                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 mb-2">
                                                    <div className="text-center flex-1 border-r border-slate-200 last:border-0">
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Início</p>
                                                        <div className="flex items-center justify-center gap-1 text-blue-600 font-black text-sm">
                                                            <Music size={12} /> {numCantInicial || '-'}
                                                        </div>
                                                    </div>
                                                    <div className="text-center flex-1 border-r border-slate-200 last:border-0">
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Meio</p>
                                                        <div className="flex items-center justify-center gap-1 text-amber-600 font-black text-sm">
                                                            <Music size={12} /> {numCantMeio || '-'}
                                                        </div>
                                                    </div>
                                                    <div className="text-center flex-1">
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Fim</p>
                                                        <div className="flex items-center justify-center gap-1 text-rose-600 font-black text-sm">
                                                            <Music size={12} /> {numCantFinal || '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PRESIDENTE */}
                                            {sem.presidente && (!busca || sem.presidente.nome.toLowerCase().includes(busca.toLowerCase())) && (
                                                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                        <User size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">Presidente</p>
                                                        <p className="text-sm font-black text-slate-800">{sem.presidente.nome}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* LISTA DE PARTES */}
                                            <div className="space-y-6 pt-2">
                                                {sem.partes.filter(p => ['tesouros', 'ministerio', 'vida'].includes(p.secao)).map((parte, i) => {
                                                    const principal = parte.estudante || parte.dirigente || parte.oracao;

                                                    if (sem.filtrado && !JSON.stringify(parte).toLowerCase().includes(busca.toLowerCase())) return null;

                                                    const configLabels = {
                                                        tesouros: { txt: "Tesouros", css: "bg-slate-100 text-slate-600" },
                                                        ministerio: { txt: "Ministério", css: "bg-amber-100 text-amber-800" },
                                                        vida: { txt: "Vida Cristã", css: "bg-rose-100 text-rose-800" }
                                                    };
                                                    const label = configLabels[parte.secao] || null;

                                                    return (
                                                        <div key={i} className="flex gap-3 relative">
                                                            {/* Timeline Line */}
                                                            <div className="w-px bg-slate-200 absolute left-5 top-12 bottom-[-1.5rem] -z-10 last:hidden"></div>

                                                            {/* Círculo de Tempo */}
                                                            <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-100 flex flex-col items-center justify-center shrink-0 z-10">
                                                                <span className="text-[10px] font-black text-slate-600 leading-none">{parte.tempo}</span>
                                                                <span className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">min</span>
                                                            </div>

                                                            <div className="flex-1 space-y-2">
                                                                {label && (
                                                                    <span className={`inline-block text-[8px] font-black px-2 py-0.5 rounded uppercase ${label.css}`}>
                                                                        {label.txt}
                                                                    </span>
                                                                )}

                                                                <h4 className="text-[11px] font-bold text-slate-800 leading-snug">{parte.titulo}</h4>

                                                                {principal?.nome && (
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                                                                        <div className="flex-1">
                                                                            <p className="text-sm font-black text-slate-900">{principal.nome}</p>
                                                                            {parte.ajudante?.nome && (
                                                                                <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                                                                                    <ChevronRight size={10} className="text-blue-400" />
                                                                                    Ajuda: <span className="font-semibold text-slate-700">{parte.ajudante.nome}</span>
                                                                                </p>
                                                                            )}
                                                                            {parte.leitor?.nome && (
                                                                                <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                                                                                    <BookOpen size={10} className="text-blue-400" />
                                                                                    Leitor: <span className="font-semibold text-slate-700">{parte.leitor.nome}</span>
                                                                                </p>
                                                                            )}
                                                                        </div>

                                                                        <a
                                                                            href={gerarLinkAgenda(parte, sem.dataReuniao)}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="bg-white p-2.5 rounded-xl text-blue-600 border border-slate-200 shadow-sm active:scale-95"
                                                                            title="Salvar na Agenda"
                                                                        >
                                                                            <CalendarPlus size={18} />
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* RODAPÉ FINAL COM BOTÃO SECRETO */}
                <div className="py-10 text-center flex flex-col items-center opacity-60">
                    <p className="text-slate-500 font-bold text-[9px] uppercase tracking-widest mb-4">
                        Atualizado em Tempo Real
                    </p>
                    <Link
                        to="/admin"
                        className="flex items-center gap-1.5 bg-slate-200/50 hover:bg-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-500 transition-colors"
                    >
                        <Lock size={10} /> Acesso Superintendente
                    </Link>
                </div>
            </main>
        </div>
    );
}