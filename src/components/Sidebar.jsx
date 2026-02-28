import React from 'react';
import {
    Calendar, Users, LayoutDashboard, Send, Settings,
    ChevronLeft, LogOut, Home, Maximize, RefreshCw, X, Cloud
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
    lang, // RECEBE O IDIOMA DO APP.JSX
    toggleFullscreen
}) {
    const versaoSistema = packageJson.version;

    // --- GARANTIA DE IDIOMA ---
    const currentLang = lang === 'es' ? 'es' : 'pt';

    // --- DICIONÁRIO LOCAL DA SIDEBAR ---
    const SIDEBAR_TEXTS = {
        pt: {
            telaCheia: "Tela Cheia",
            versao: "Versão do Sistema",
            sair: "Sair da Conta",
            alertaAtualizacao: `Versão Atual: ${versaoSistema}\n\nDeseja recarregar a página para verificar atualizações no sistema?`
        },
        es: {
            telaCheia: "Pantalla Completa",
            versao: "Versión del Sistema",
            sair: "Cerrar Sesión",
            alertaAtualizacao: `Versión Actual: ${versaoSistema}\n\n¿Deseas recargar la página para buscar actualizaciones en el sistema?`
        }
    }[currentLang];

    // Quando clica num botão, muda a aba e, se estiver no celular, fecha o menu automaticamente
    const handleTabClick = (id) => {
        setAbaAtiva(id);
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    const SidebarButton = ({ id, icon: Icon, label, badge }) => (
        <button
            onClick={() => handleTabClick(id)}
            className={`w-full flex items-center justify-between px-4 py-3 transition-all border-l-4 ${abaAtiva === id
                ? 'bg-blue-800 border-white text-white'
                : 'border-transparent text-blue-100 hover:bg-blue-700'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon size={18} className="shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
            </div>
            {sidebarOpen && badge > 0 && (
                <span className="bg-blue-900 px-2 py-0.5 rounded-full text-[10px]">{badge}</span>
            )}
        </button>
    );

    return (
        // Envolvemos toda a Sidebar + Overlay num Fragmento ou Div print:hidden.
        // Como o React pede apenas um nó pai, usamos o <> vazio (Fragment), 
        // mas as tags filhas imediatas recebem print:hidden.
        <>
            {/* OVERLAY ESCURO (Aparece só no celular quando o menu está aberto) */}
            {sidebarOpen && (
                <div
                    // ADICIONADO: print:hidden
                    className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity print:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                // ADICIONADO: print:hidden e forcei o no-print
                className={`no-print print:hidden fixed right-0 md:relative z-50 h-full flex flex-col bg-jw-blue shadow-2xl md:shadow-xl transition-all duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0 w-64' : 'translate-x-full md:translate-x-0 md:w-16'}`}
            >
                {/* HEADER SIDEBAR - NUVEM SEMPRE VISÍVEL */}
                <div className="p-4 border-b border-blue-500/30 flex justify-between items-center h-14 md:h-16 text-white font-bold shrink-0">

                    {/* CONTAINER DO LOGO */}
                    <div className="flex items-center gap-3 overflow-hidden">
                        <Cloud size={24} className="text-blue-300 shrink-0" strokeWidth={2.5} />
                        {sidebarOpen && <span className="truncate tracking-tighter text-lg font-black">V&M Cloud</span>}
                    </div>

                    {/* Botão de Fechar: Seta no PC, 'X' no Celular */}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-blue-700 rounded transition-colors hidden md:block shrink-0">
                        <ChevronLeft className={!sidebarOpen ? 'rotate-180' : ''} />
                    </button>
                    <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-blue-700 rounded transition-colors md:hidden shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Navegação Principal */}
                <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
                    <SidebarButton id="dashboard" icon={Home} label={t.inicio || "Início"} />
                    <SidebarButton id="importar" icon={Calendar} label={t.importar} />
                    <SidebarButton id="designar" icon={LayoutDashboard} label={t.designar} badge={listaProgramacoes.length} />
                    <SidebarButton id="revisar" icon={Send} label={t.revisar} />
                    <SidebarButton id="alunos" icon={Users} label={t.alunos} />
                    <div className="mt-4 border-t border-blue-500/30 pt-2">
                        <SidebarButton id="configuracoes" icon={Settings} label={t.configuracoes || t.ajustes || "Configurações"} />
                    </div>
                </nav>

                {/* Rodapé Sidebar (Ações Extras e Usuário) */}
                {sidebarOpen && (
                    <div className="p-4 bg-blue-900/40 border-t border-blue-500/30 flex flex-col gap-2 shrink-0">

                        {/* Botão de Tela Cheia */}
                        <button
                            onClick={toggleFullscreen}
                            className="flex w-full items-center gap-3 px-2 py-2 text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-800/50 rounded-md transition-colors"
                        >
                            <Maximize size={16} />
                            <span>{SIDEBAR_TEXTS.telaCheia}</span>
                        </button>

                        {/* Botão de Versão (Verificar Atualizações) */}
                        <button
                            onClick={() => {
                                if (window.confirm(SIDEBAR_TEXTS.alertaAtualizacao)) {
                                    window.location.reload(true);
                                }
                            }}
                            className="flex w-full items-center justify-between px-2 py-2 text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-800/50 rounded-md transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <RefreshCw size={16} />
                                <span>{SIDEBAR_TEXTS.versao}</span>
                            </div>
                            <span className="text-[10px] font-bold text-blue-900 bg-blue-200 px-2 py-0.5 rounded-full">
                                v{versaoSistema}
                            </span>
                        </button>

                        <div className="border-t border-blue-500/30 my-1"></div>

                        {/* Info User */}
                        <div className="flex items-center gap-3 mb-1 p-2 bg-blue-800/50 rounded-lg border border-blue-700/50">
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

                        <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-blue-300 hover:text-rose-400 text-xs py-2 mt-1 border border-blue-800/30 rounded-lg hover:bg-rose-950/30 hover:border-rose-900/50 transition-all">
                            <LogOut size={14} /> {SIDEBAR_TEXTS.sair}
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
}