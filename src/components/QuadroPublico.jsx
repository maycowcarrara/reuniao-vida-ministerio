import React, { useState, useMemo } from 'react';
import { Search, Calendar, User, BookOpen, ChevronRight, Lock } from 'lucide-react';

// Função para formatar a data (Ex: 15 de Março)
const formatarData = (dataISO) => {
    if (!dataISO) return 'Data não definida';
    const data = new Date(dataISO + 'T12:00:00');
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
};

export default function QuadroPublico({ programacoes, config }) {
    const [busca, setBusca] = useState('');
    const [autenticado, setAutenticado] = useState(false);
    const [senhaInput, setSenhaInput] = useState('');

    // --- PROTEÇÃO SIMPLES DE PRIVACIDADE ---
    // Você pode definir uma senha simples aqui (ex: ano de fundação, ou "1234")
    // Isso evita que robôs do Google leiam os nomes dos irmãos na internet.
    const SENHA_CONGREGACAO = "2026";

    const handleLogin = (e) => {
        e.preventDefault();
        if (senhaInput === SENHA_CONGREGACAO) {
            setAutenticado(true);
            localStorage.setItem('quadro_auth', 'true'); // Salva para não pedir de novo
        } else {
            alert('Senha incorreta!');
        }
    };

    // Pula a senha se já digitou antes no mesmo celular
    useMemo(() => {
        if (localStorage.getItem('quadro_auth') === 'true') {
            setAutenticado(true);
        }
    }, []);

    // --- FILTRAGEM DE SEMANAS ---
    const semanasParaExibir = useMemo(() => {
        if (!programacoes) return [];

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        // Tira 2 dias de margem (para a reunião de quarta continuar aparecendo até quinta de manhã)
        hoje.setDate(hoje.getDate() - 2);

        // 1. Filtra só as reuniões futuras ou da semana atual e que NÃO estão arquivadas
        let futuras = programacoes.filter(sem => {
            if (sem.arquivada) return false;
            const dataReuniao = new Date((sem.dataReuniao || sem.dataInicio) + 'T12:00:00');
            return dataReuniao >= hoje;
        });

        // 2. Filtra pelo nome buscado (Se o irmão digitar o nome dele)
        const termo = busca.toLowerCase().trim();
        if (termo) {
            futuras = futuras.map(sem => {
                // Checa o presidente
                const temPres = sem.presidente?.nome?.toLowerCase().includes(termo);

                // Filtra apenas as partes em que o irmão participa
                const partesFiltradas = (sem.partes || []).filter(p => {
                    const nEstudante = p.estudante?.nome?.toLowerCase() || '';
                    const nAjudante = p.ajudante?.nome?.toLowerCase() || '';
                    const nOracao = p.oracao?.nome?.toLowerCase() || '';
                    const nDirigente = p.dirigente?.nome?.toLowerCase() || '';
                    const nLeitor = p.leitor?.nome?.toLowerCase() || '';

                    return nEstudante.includes(termo) || nAjudante.includes(termo) ||
                        nOracao.includes(termo) || nDirigente.includes(termo) || nLeitor.includes(termo);
                });

                // Só retorna a semana se ele tiver parte ou for presidente
                if (temPres || partesFiltradas.length > 0) {
                    return { ...sem, partes: partesFiltradas };
                }
                return null;
            }).filter(Boolean); // Remove as semanas nulas
        }

        return futuras;
    }, [programacoes, busca]);

    // TELA DE SENHA
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

    // TELA DO QUADRO
    return (
        <div className="min-h-screen bg-gray-100 font-sans pb-10">
            {/* Cabeçalho Fixo */}
            <div className="bg-blue-700 text-white sticky top-0 z-50 shadow-md">
                <div className="px-4 py-4 max-w-2xl mx-auto">
                    <h1 className="text-lg font-black leading-tight">{config?.nome_cong || 'Reunião Vida e Ministério'}</h1>
                    <p className="text-blue-200 text-xs font-medium">Quadro de Designações Virtual</p>

                    {/* Barra de Pesquisa Rápida */}
                    <div className="relative mt-4">
                        <Search size={16} className="absolute left-3 top-3 text-blue-300" />
                        <input
                            type="text"
                            placeholder="Busque pelo seu nome..."
                            className="w-full bg-blue-800/50 border border-blue-600/50 text-white placeholder-blue-300 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:bg-blue-800 focus:ring-2 focus:ring-blue-400 transition"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                        />
                        {busca && (
                            <div className="absolute -bottom-6 left-1 text-[10px] font-bold text-yellow-300">
                                Mostrando apenas as suas partes 👇
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lista de Semanas (Timeline) */}
            <div className="px-4 pt-6 max-w-2xl mx-auto space-y-4">
                {semanasParaExibir.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <Calendar size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="font-bold">Nenhuma designação futura encontrada.</p>
                    </div>
                ) : (
                    semanasParaExibir.map((sem, idx) => (
                        <div key={sem.id || idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Cabeçalho do Card */}
                            <div className="bg-slate-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-gray-800 text-sm">{sem.semana}</h3>
                                    <p className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-0.5">
                                        <Calendar size={12} /> {formatarData(sem.dataReuniao || sem.dataInicio)}
                                    </p>
                                </div>
                            </div>

                            {/* Corpo do Card: As Partes */}
                            <div className="p-4 space-y-3">
                                {sem.presidente && (!busca || sem.presidente.nome.toLowerCase().includes(busca.toLowerCase())) && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                            <User size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Presidente</p>
                                            <p className="text-sm font-bold text-gray-800">{sem.presidente.nome}</p>
                                        </div>
                                    </div>
                                )}

                                {sem.partes?.map((parte, i) => {
                                    const secaoCor = parte.secao === 'tesouros' ? 'bg-slate-100 text-slate-700' :
                                        parte.secao === 'ministerio' ? 'bg-amber-100 text-amber-800' :
                                            'bg-rose-100 text-rose-800';

                                    // Define quem é o principal da parte
                                    const principal = parte.estudante || parte.dirigente || parte.oracao;

                                    return (
                                        <div key={i} className="flex gap-3 relative">
                                            <div className="w-px bg-gray-200 absolute left-5 top-8 bottom-0 -z-10"></div>
                                            <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex flex-col items-center justify-center shrink-0 z-10">
                                                <span className="text-[9px] font-bold text-gray-400">{parte.tempo}m</span>
                                            </div>
                                            <div className="flex-1 pb-3">
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${secaoCor}`}>
                                                    {parte.secao || 'Parte'}
                                                </span>
                                                <p className="text-xs font-bold text-gray-800 mt-1 leading-tight">{parte.titulo}</p>

                                                <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded-lg p-2">
                                                    {principal?.nome && (
                                                        <p className="text-sm font-bold text-gray-900">{principal.nome}</p>
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
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="text-center mt-8 text-[10px] text-gray-400 font-medium">
                Atualizado em tempo real.
            </div>
        </div>
    );
}