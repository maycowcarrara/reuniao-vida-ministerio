import React, { useEffect, useState } from 'react';
import {
    Calendar, Users, LayoutDashboard, Send, Settings,
    ChevronLeft, LogOut, Home, Maximize, RefreshCw, X, Cloud, Download
} from 'lucide-react';
// Importa o package.json diretamente para ler a versão
import packageJson from '../../package.json';
import { formatText, useSectionMessages } from '../i18n';
import { refreshAppVersion } from '../services/appUpdater';
import { toast } from '../utils/toast';

function SidebarButton({ active, onClick, icon, label, badge, sidebarOpen }) {
    const iconElement = React.createElement(icon, { size: 18, className: 'shrink-0' });

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between px-4 py-3 transition-all border-l-4 ${active
                ? 'bg-blue-800 border-white text-white'
                : 'border-transparent text-blue-100 hover:bg-blue-700'
                }`}
        >
            <div className="flex items-center gap-3">
                {iconElement}
                {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
            </div>
            {sidebarOpen && badge > 0 && (
                <span className="bg-blue-900 px-2 py-0.5 rounded-full text-[10px]">{badge}</span>
            )}
        </button>
    );
}

export default function Sidebar({
    sidebarOpen,
    setSidebarOpen,
    abaAtiva,
    setAbaAtiva,
    usuario,
    logout,
    listaProgramacoes,
    alunos = [],
    t,
    toggleFullscreen
}) {
    const versaoSistema = packageJson.version;
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [atualizandoVersao, setAtualizandoVersao] = useState(false);
    const totalSemanasAtivas = (listaProgramacoes || []).filter(semana => !semana?.arquivada).length;
    const totalAlunosAtivos = (alunos || []).filter(aluno => aluno?.tipo !== 'desab').length;

    // --- ESCUTA O EVENTO DE INSTALAÇÃO DO PWA ---
    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            // Previne o mini-infobar padrão do navegador em dispositivos móveis
            e.preventDefault();
            // Guarda o evento para ser disparado pelo nosso botão
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallApp = async () => {
        if (deferredPrompt) {
            // Mostra o prompt de instalação do navegador
            deferredPrompt.prompt();
            // Aguarda a resposta do usuário
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                // Se aceitou, limpa o prompt e esconde o botão
                setDeferredPrompt(null);
            }
        }
    };

    const SIDEBAR_TEXTS = useSectionMessages('sidebar');
    const alertaAtualizacao = formatText(SIDEBAR_TEXTS.alertaAtualizacao, { version: versaoSistema });

    const handleAtualizarSistema = async () => {
        if (atualizandoVersao) return;
        if (!window.confirm(alertaAtualizacao)) return;

        setAtualizandoVersao(true);
        toast.info(SIDEBAR_TEXTS.atualizacaoIniciada);

        try {
            await refreshAppVersion(versaoSistema);
        } catch (error) {
            setAtualizandoVersao(false);
            toast.error(error, SIDEBAR_TEXTS.atualizacaoErro);
        }
    };

    // Quando clica num botão, muda a aba e, se estiver no celular, fecha o menu automaticamente
    const handleTabClick = (id) => {
        setAbaAtiva(id);
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    return (
        <>
            {/* OVERLAY ESCURO (Aparece só no celular quando o menu está aberto) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity print:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
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
                    <SidebarButton active={abaAtiva === 'dashboard'} onClick={() => handleTabClick('dashboard')} icon={Home} label={t.inicio || "Início"} sidebarOpen={sidebarOpen} />
                    <SidebarButton active={abaAtiva === 'importar'} onClick={() => handleTabClick('importar')} icon={Calendar} label={t.importar} sidebarOpen={sidebarOpen} />
                    <SidebarButton active={abaAtiva === 'designar'} onClick={() => handleTabClick('designar')} icon={LayoutDashboard} label={t.designar} badge={totalSemanasAtivas} sidebarOpen={sidebarOpen} />
                    <SidebarButton active={abaAtiva === 'revisar'} onClick={() => handleTabClick('revisar')} icon={Send} label={t.revisar} sidebarOpen={sidebarOpen} />
                    <SidebarButton active={abaAtiva === 'alunos'} onClick={() => handleTabClick('alunos')} icon={Users} label={t.alunos} badge={totalAlunosAtivos} sidebarOpen={sidebarOpen} />
                    <div className="mt-4 border-t border-blue-500/30 pt-2">
                        <SidebarButton active={abaAtiva === 'configuracoes'} onClick={() => handleTabClick('configuracoes')} icon={Settings} label={t.configuracoes || t.ajustes} sidebarOpen={sidebarOpen} />
                    </div>
                </nav>

                {/* Rodapé Sidebar (Ações Extras e Usuário) */}
                {sidebarOpen && (
                    <div className="p-4 bg-blue-900/40 border-t border-blue-500/30 flex flex-col gap-2 shrink-0">

                        {/* Botão de Instalar PWA (Aparece dinamicamente) */}
                        {deferredPrompt && (
                            <button
                                onClick={handleInstallApp}
                                className="flex w-full items-center gap-3 px-2 py-2 text-sm font-bold text-green-300 hover:text-green-100 hover:bg-green-800/30 border border-green-800/30 rounded-md transition-colors"
                            >
                                <Download size={16} />
                                <span>{SIDEBAR_TEXTS.instalarApp}</span>
                            </button>
                        )}

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
                            type="button"
                            onClick={handleAtualizarSistema}
                            disabled={atualizandoVersao}
                            className={`flex w-full items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${atualizandoVersao
                                ? 'cursor-wait bg-blue-800/60 text-white'
                                : 'text-blue-100 hover:text-white hover:bg-blue-800/50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <RefreshCw size={16} className={atualizandoVersao ? 'animate-spin' : ''} />
                                <span>{atualizandoVersao ? SIDEBAR_TEXTS.atualizandoVersao : SIDEBAR_TEXTS.versao}</span>
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
                                    alt={SIDEBAR_TEXTS.avatarAlt}
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
