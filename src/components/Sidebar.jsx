import React from 'react';
import {
    Calendar, Users, LayoutDashboard, Send, Settings,
    ChevronLeft, LogOut, Home, Maximize, RefreshCw
} from 'lucide-react';
// Importa o package.json diretamente para ler a versão
import packageJson from '../../package.json';

export default function Sidebar({
    sidebarOpen,
    setSidebarOpen,
    abaAtiva,
    setAbaAtiva,
    usuario,
    logout,
    listaProgramacoes,
    t,
    toggleFullscreen // <-- Lembre-se de garantir que o App.jsx está passando isso
}) {

    // Pega a versão do package.json
    const versaoSistema = packageJson.version;

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
            <div className="p-4 border-b border-blue-500/30 flex justify-between items-center h-16 text-white font-bold shrink-0">
                {sidebarOpen && <span className="truncate tracking-tighter text-lg">V&M Cloud</span>}
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-blue-700 rounded transition-colors">
                    <ChevronLeft className={!sidebarOpen ? 'rotate-180' : ''} />
                </button>
            </div>

            {/* Navegação Principal */}
            <nav className="flex-1 py-4 overflow-y-auto">
                <SidebarButton id="dashboard" icon={Home} label="Início" />
                <SidebarButton id="importar" icon={Calendar} label={t.importar} />
                <SidebarButton id="designar" icon={LayoutDashboard} label={t.designar} badge={listaProgramacoes.length} />
                <SidebarButton id="revisar" icon={Send} label={t.revisar} />
                <SidebarButton id="alunos" icon={Users} label={t.alunos} />
                <div className="mt-4 border-t border-blue-500/30">
                    <SidebarButton id="configuracoes" icon={Settings} label={t.ajustes} />
                </div>
            </nav>

            {/* Rodapé Sidebar (Ações Extras e Usuário) */}
            {sidebarOpen && (
                <div className="p-4 bg-blue-900/40 border-t border-blue-500/30 flex flex-col gap-2 shrink-0">

                    {/* NOVO: Botão de Tela Cheia */}
                    <button
                        onClick={toggleFullscreen}
                        className="flex w-full items-center gap-3 px-2 py-2 text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-800/50 rounded-md transition-colors"
                    >
                        <Maximize size={16} />
                        <span>Tela Cheia</span>
                    </button>

                    {/* NOVO: Botão de Versão (Verificar Atualizações) */}
                    <button
                        onClick={() => {
                            if (window.confirm(`Versão Atual: ${versaoSistema}\n\nDeseja recarregar a página para verificar atualizações no sistema?`)) {
                                window.location.reload(true);
                            }
                        }}
                        className="flex w-full items-center justify-between px-2 py-2 text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-800/50 rounded-md transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <RefreshCw size={16} />
                            <span>Versão do Sistema</span>
                        </div>
                        <span className="text-[10px] font-bold text-blue-900 bg-blue-200 px-2 py-0.5 rounded-full">
                            v{versaoSistema}
                        </span>
                    </button>

                    <div className="border-t border-blue-500/30 my-1"></div>

                    {/* Info User */}
                    <div className="flex items-center gap-3 mb-1 p-2 bg-blue-800/50 rounded-lg">
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

                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-blue-300 hover:text-white text-xs py-2 mt-1 border border-blue-800/30 rounded hover:bg-blue-800/50 transition">
                        <LogOut size={14} /> Sair da Conta
                    </button>
                </div>
            )}
        </aside>
    );
}