import React from 'react';
import {
    Calendar, Users, LayoutDashboard, Send, Settings,
    ChevronLeft, FileUp, FileDown, AlertTriangle, LogOut, Home
} from 'lucide-react';

export default function Sidebar({
    sidebarOpen,
    setSidebarOpen,
    abaAtiva,
    setAbaAtiva,
    usuario,
    handleAbrirBackup,
    handleSalvarBackup,
    handleResetarTudo,
    logout,
    listaProgramacoes,
    t
}) {

    const SidebarButton = ({ id, icon: Icon, label, badge }) => (
        <button
            onClick={() => setAbaAtiva(id)}
            className={`w-full flex items-center justify-between px-4 py-3 transition-all border-l-4 ${abaAtiva === id
                    ? 'bg-blue-800 border-white text-white'
                    : 'border-transparent text-blue-100 hover:bg-blue-700'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon size={18} />
                {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
            </div>
            {sidebarOpen && badge > 0 && (
                <span className="bg-blue-900 px-2 py-0.5 rounded-full text-[10px]">{badge}</span>
            )}
        </button>
    );

    return (
        <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-jw-blue transition-all duration-300 flex flex-col z-50 shadow-xl`}>
            {/* Header Sidebar */}
            <div className="p-4 border-b border-blue-500/30 flex justify-between items-center h-16 text-white font-bold">
                {sidebarOpen && <span className="truncate tracking-tighter text-lg">V&M Cloud</span>}
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-blue-700 rounded transition-colors">
                    <ChevronLeft className={!sidebarOpen ? 'rotate-180' : ''} />
                </button>
            </div>

            {/* Navegação Principal */}
            <nav className="flex-1 py-4">
                <SidebarButton id="dashboard" icon={Home} label="Início" />
                <SidebarButton id="importar" icon={Calendar} label={t.importar} />
                <SidebarButton id="designar" icon={LayoutDashboard} label={t.designar} badge={listaProgramacoes.length} />
                <SidebarButton id="revisar" icon={Send} label={t.revisar} />
                <SidebarButton id="alunos" icon={Users} label={t.alunos} />
                <div className="mt-4 border-t border-blue-500/30">
                    <SidebarButton id="configuracoes" icon={Settings} label={t.ajustes} />
                </div>
            </nav>

            {/* Rodapé Sidebar (Usuário e Ações) */}
            {sidebarOpen && (
                <div className="p-4 bg-blue-900/40 border-t border-blue-500/30 space-y-3">
                    {/* Info User */}
                    <div className="flex items-center gap-3 mb-4 p-2 bg-blue-800/50 rounded-lg">
                        {usuario?.photoURL ? (
                            <img
                                src={usuario.photoURL}
                                className="w-8 h-8 rounded-full border border-blue-300"
                                referrerPolicy="no-referrer"
                                alt="Perfil"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white border border-blue-400">
                                <span className="text-xs font-bold">{usuario?.displayName?.charAt(0) || 'U'}</span>
                            </div>
                        )}

                        <div className="flex flex-col overflow-hidden">
                            <span className="text-xs font-bold text-white truncate">{usuario?.displayName}</span>
                            <span className="text-[9px] text-blue-300 truncate">{usuario?.email}</span>
                        </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleAbrirBackup} className="flex flex-col items-center gap-1 bg-blue-700 p-2 rounded-lg text-white hover:bg-blue-600 transition">
                            <FileUp size={16} /> <span className="text-[9px] font-bold">Restaurar</span>
                        </button>
                        <button onClick={handleSalvarBackup} className="flex flex-col items-center gap-1 bg-green-700 p-2 rounded-lg text-white hover:bg-green-600 transition">
                            <FileDown size={16} /> <span className="text-[9px] font-bold">Backup JSON</span>
                        </button>
                    </div>

                    <button
                        onClick={handleResetarTudo}
                        className="w-full flex items-center justify-center gap-2 text-red-300 hover:text-white hover:bg-red-900/30 text-xs py-2 mt-2 rounded border border-transparent hover:border-red-900/30 transition"
                        title="Apagar todos os dados da nuvem"
                    >
                        <AlertTriangle size={12} /> Limpar Banco
                    </button>

                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-blue-300 hover:text-white text-xs py-2 mt-1 border border-blue-800/30 rounded hover:bg-blue-800/50 transition">
                        <LogOut size={12} /> Sair da Conta
                    </button>
                </div>
            )}
        </aside>
    );
}