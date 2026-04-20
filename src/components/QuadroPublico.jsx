import React, { useState, useMemo, useEffect } from 'react';
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
    ChevronUp,
    CheckCircle2,
    X,
    PlayCircle,
    Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSectionMessages, useI18n } from '../i18n';
import { getLanguageMeta } from '../config/appConfig';
import { getMeetingDateISOFromSemana, getWeekStartISOFromSemana } from '../utils/revisarEnviar/dates';
import { getEventoEspecialDaSemana, getTipoEventoSemana, getSemanaStartISO as getSemanaStartISOCompartilhado } from '../utils/eventos';

// ============================================================================
// CAPTURADOR GLOBAL DO PWA (Resolve o bug do React ser mais lento que o Chrome)
// ============================================================================
let globalDeferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Impede o prompt nativo de aparecer logo
    globalDeferredPrompt = e; // Guarda o evento na "gaveta"
    window.dispatchEvent(new Event('pwa-pronto')); // Avisa o React que o evento chegou
});

// ============================================================================
// FUNÇÕES AUXILIARES (HELPERS)
// ============================================================================

const extrairNumeroCantico = (texto) => {
    if (!texto) return '';
    const regex = /(c[âa]ntico|canci[oó]n)\s*(\d+)/i;
    const match = texto.match(regex);
    if (match && match[2]) return match[2];

    const numbers = texto.match(/\d+/g);
    return numbers ? numbers[numbers.length - 1] : '';
};

const formatarDataCompleta = (dataISO, lang, texts) => {
    if (!dataISO) return texts.dataNaoDefinida;
    const data = new Date(dataISO + 'T12:00:00');
    const locale = getLanguageMeta(lang).locale;
    const diaSemana = data.toLocaleDateString(locale, { weekday: 'long' });
    const dataStr = data.toLocaleDateString(locale, { day: '2-digit', month: 'long' });
    return `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}, ${dataStr}`;
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

// --- CÁLCULO DE HORÁRIOS PARA O CRONOGRAMA ---
const calcularHorarios = (partes, dataIso, horarioBase, lang) => {
    if (!partes || !dataIso) return partes;
    const [hora, minuto] = (horarioBase || "19:30").split(':');
    let dataAtual = new Date(`${dataIso}T${hora}:${minuto}:00`);
    const locale = getLanguageMeta(lang).locale;

    return partes.map(parte => {
        let duracao = parseInt(parte.tempo || "5", 10);
        const tituloLower = (parte.titulo || '').toLowerCase();
        const secaoLower = (parte.secao || '').toLowerCase();

        const ehLeitura = tituloLower.includes('leitura') || tituloLower.includes('lectura');
        const ehMinisterio = secaoLower === 'ministerio';

        // Regra: Leitura e Ministério ganham 1 min de transição
        if (ehLeitura || ehMinisterio) duracao += 1;

        const start = new Date(dataAtual);
        const end = new Date(start.getTime() + (duracao * 60000));
        dataAtual = end;

        return {
            ...parte,
            startObj: start,
            endObj: end,
            startTimeStr: start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
            endTimeStr: end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
        };
    });
};

const gerarLinkAgenda = (parte, dataSemanaISO, texts) => {
    const dataReuniao = dataSemanaISO ? new Date(dataSemanaISO + 'T19:30:00') : new Date();
    const start = dataReuniao.toISOString().replace(/-|:|\.\d+/g, '');
    const dataFim = new Date(dataReuniao.getTime() + (parseInt(parte.tempo) || 10) * 60000);
    const end = dataFim.toISOString().replace(/-|:|\.\d+/g, '');

    const principal = parte.estudante || parte.dirigente || parte.oracao;
    const nomePrincipal = principal?.nome ? `${texts.designado}: ${principal.nome}\n` : '';
    const nomeAjudante = parte.ajudante?.nome ? `${texts.ajudante}: ${parte.ajudante.nome}\n` : '';
    const nomeLeitor = parte.leitor?.nome ? `${texts.leitor}: ${parte.leitor.nome}\n` : '';

    const secaoLabel = texts?.secoes?.[parte.secao] || parte.secao || texts.reuniao;
    const texto = encodeURIComponent(`${texts.reuniao}: ${parte.titulo}`);
    const desc = encodeURIComponent(`${texts.secao}: ${secaoLabel}\n${texts.tempo}: ${parte.tempo} min\n\n${nomePrincipal}${nomeAjudante}${nomeLeitor}`);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${texto}&dates=${start}/${end}&details=${desc}`;
};

const formatarContagemRegressiva = (ms) => {
    const totalSegundos = Math.max(0, Math.ceil(ms / 1000));
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;

    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
};

const ajustarDataParaTerça = (dataISO) => {
    if (!dataISO) return null;

    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia, 12, 0, 0);

    if (data.getDay() === 2) {
        return dataISO;
    }

    const diff = 2 - data.getDay();
    data.setDate(data.getDate() + diff);

    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, '0');
    const d = String(data.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getDataReuniaoISO = (sem, config) => {
    const eventoEspecial = getEventoEspecialDaSemana(sem, config);
    const tipoEvento = getTipoEventoSemana(sem, config);
    const isVisita = tipoEvento === 'visita';
    const fallbackStr = sem?.dataExata || sem?.dataReuniao || sem?.dataInicio || sem?.data || null;

    if (eventoEspecial?.dataInput && !isVisita) {
        return eventoEspecial.dataInput;
    }

    let dataCalculada = getMeetingDateISOFromSemana({
        semanaStr: sem?.semana,
        config,
        isoFallback: fallbackStr,
        overrideDia: isVisita ? 'terça-feira' : null,
        textSources: [sem?.semana]
    });

    if (!dataCalculada) {
        dataCalculada = fallbackStr;
    }

    if (isVisita) {
        return ajustarDataParaTerça(dataCalculada);
    }

    return dataCalculada;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function QuadroPublico({ programacoes, config, usuario }) {
    const [busca, setBusca] = useState('');
    const [autenticado, setAutenticado] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('quadro_auth') === 'true';
    });
    const [senhaInput, setSenhaInput] = useState('');

    const [semanaExpandida, setSemanaExpandida] = useState(0);
    const [agora, setAgora] = useState(new Date());

    // --- ESTADOS DO PWA (INSTALAÇÃO) ---
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);

    const SENHA_CONGREGACAO = "2026";

    // --- DICIONÁRIO DE TRADUÇÕES ---
    const { lang } = useI18n();
    const T = useSectionMessages('quadroPublico');
    const agendaTexts = {
        designado: T.designado,
        ajudante: T.ajuda,
        leitor: T.leitor,
        reuniao: T.reuniao,
        secao: T.secao,
        tempo: T.tempo,
        secoes: T.secoes,
    };

    // --- EFEITOS GERAIS E CAPTURADOR PWA ---
    useEffect(() => {
        const timer = setInterval(() => setAgora(new Date()), 1000);

        // Verifica se o evento já foi capturado pela "armadilha global" antes do React carregar
        const checkPrompt = () => {
            if (globalDeferredPrompt) {
                setDeferredPrompt(globalDeferredPrompt);
                setShowInstallBanner(true);
            }
        };

        // Verifica imediatamente ao montar
        checkPrompt();

        // Fica à escuta caso o evento venha depois
        window.addEventListener('pwa-pronto', checkPrompt);

        return () => {
            clearInterval(timer);
            window.removeEventListener('pwa-pronto', checkPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setShowInstallBanner(false);
            }
            setDeferredPrompt(null);
            globalDeferredPrompt = null;
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (senhaInput === SENHA_CONGREGACAO) {
            setAutenticado(true);
            localStorage.setItem('quadro_auth', 'true');
        } else {
            alert(T.codigoIncorreto);
        }
    };

    const semanasParaExibir = useMemo(() => {
        if (!programacoes) return [];

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        hoje.setDate(hoje.getDate() - 2);

        let filtradas = programacoes.filter(sem => {
            if (sem.arquivada) return false;

            const dtCalculo = getSemanaStartISOCompartilhado(sem, config);
            if (!dtCalculo) return false;

            const inicioSemana = new Date(dtCalculo + 'T12:00:00');
            const fimSemana = new Date(inicioSemana);
            fimSemana.setDate(inicioSemana.getDate() + 6);
            fimSemana.setHours(23, 59, 59, 999);

            return fimSemana >= hoje;
        });

        filtradas = filtradas.map(sem => {
            const semanaStartISO = getSemanaStartISOCompartilhado(sem, config);
            const dataCorreta = getDataReuniaoISO(sem, config);

            const partesComHorario = calcularHorarios(sem.partes, dataCorreta, config?.horario, lang);
            const meetingStartTimeStr = partesComHorario.length > 0 ? partesComHorario[0].startTimeStr : '--:--';
            const meetingEndTimeStr = partesComHorario.length > 0 ? partesComHorario[partesComHorario.length - 1].endTimeStr : '--:--';

            return { ...sem, semanaStartISO, dataCorreta, partes: partesComHorario, meetingStartTimeStr, meetingEndTimeStr };
        });

        const termo = busca.toLowerCase().trim();
        if (termo) {
            filtradas = filtradas.map(sem => {
                const temPres = sem.presidente?.nome?.toLowerCase().includes(termo);

                const partesFiltradas = (sem.partes || []).filter(p => {
                    const nomes = [p.estudante?.nome, p.ajudante?.nome, p.oracao?.nome, p.dirigente?.nome, p.leitor?.nome]
                        .map(n => n?.toLowerCase() || '');
                    return nomes.some(n => n.includes(termo));
                });

                if (temPres || partesFiltradas.length > 0) {
                    return { ...sem, partes: partesFiltradas, filtrado: true, termosBuscados: true };
                }
                return null;
            }).filter(Boolean);
        }

        return filtradas.sort((a, b) => new Date(a.semanaStartISO).getTime() - new Date(b.semanaStartISO).getTime());
    }, [programacoes, busca, config, config?.horario, lang]);

    const y = agora.getFullYear();
    const m = String(agora.getMonth() + 1).padStart(2, '0');
    const d = String(agora.getDate()).padStart(2, '0');
    const hojeStr = `${y}-${m}-${d}`;
    const reuniaoAoVivo = useMemo(() => {
        return semanasParaExibir.findIndex((sem) => {
            if (!sem.partes?.length || sem.termosBuscados) return false;

            const inicio = sem.partes[0]?.startObj;
            const fim = sem.partes[sem.partes.length - 1]?.endObj;

            return inicio && fim && agora >= inicio && agora < fim;
        });
    }, [semanasParaExibir, agora]);
    const reuniaoEmContagem = useMemo(() => {
        const index = semanasParaExibir.findIndex((sem) => {
            if (!sem.partes?.length || sem.termosBuscados) return false;

            const inicio = sem.partes[0]?.startObj;
            if (!inicio) return false;

            const cincoMinAntes = new Date(inicio.getTime() - (5 * 60000));
            return agora >= cincoMinAntes && agora < inicio;
        });

        if (index === -1) return { index: -1, msRestantes: 0 };

        return {
            index,
            msRestantes: semanasParaExibir[index].partes[0].startObj.getTime() - agora.getTime()
        };
    }, [semanasParaExibir, agora]);
    const modoTempoReal = reuniaoAoVivo !== -1;
    const modoPreLive = !modoTempoReal && reuniaoEmContagem.index !== -1;
    const contagemRegressiva = formatarContagemRegressiva(reuniaoEmContagem.msRestantes);

    if (!autenticado) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-sm text-center border border-slate-200">
                    <div className="bg-blue-600 text-white w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3">
                        <Lock size={40} className="-rotate-3" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">{T.titulo}</h2>
                    <p className="text-slate-500 text-sm mb-8 px-4 leading-relaxed">
                        {T.descAcesso}
                    </p>
                    <input
                        type="number"
                        pattern="[0-9]*"
                        placeholder="0000"
                        className="w-full text-center text-4xl font-black tracking-[0.2em] bg-slate-50 border-2 border-slate-200 rounded-2xl py-4 focus:border-blue-500 focus:bg-white outline-none transition-all mb-6 focus:ring-4 focus:ring-blue-500/20"
                        value={senhaInput}
                        onChange={e => setSenhaInput(e.target.value)}
                    />
                    <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95">
                        {T.btnAcesso}
                    </button>
                </form>
            </div>
        );
    }

    const toggleSemana = (idx) => setSemanaExpandida(prev => prev === idx ? null : idx);

    return (
        <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
            <style>{`
                @keyframes pop-in {
                    0% { transform: scale(1); }
                    40% { transform: scale(1.8); }
                    100% { transform: scale(1); }
                }
                .animate-pop-in {
                    animation: pop-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1;
                }
            `}</style>
            <header className="bg-blue-700 text-white shadow-md z-50 shrink-0">
                <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">

                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-lg font-black leading-none tracking-tight">{config?.nome_cong || T.congregacaoPadrao}</h1>

                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <p className="text-blue-200 text-[9px] font-bold uppercase tracking-[0.1em] opacity-90">
                                    {T.ministerioLabel}
                                </p>

                                {modoTempoReal && (
                                    <span className="flex items-center gap-1.5 bg-rose-500/20 text-rose-50 border border-rose-300/40 text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm shadow-rose-950/20 backdrop-blur-sm">
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-200 animate-ping opacity-80"></span>
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-50 shadow-[0_0_10px_rgba(255,255,255,0.75)]"></span>
                                        </span>
                                        <span>{T.aoVivo}</span>
                                    </span>
                                )}
                                {modoPreLive && (
                                    <span className="flex items-center gap-1.5 bg-amber-400/20 text-amber-50 border border-amber-200/40 text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm shadow-amber-950/20 backdrop-blur-sm">
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-200 animate-ping opacity-80"></span>
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-50 shadow-[0_0_10px_rgba(255,248,220,0.7)]"></span>
                                        </span>
                                        <span>{T.comecaEm} {contagemRegressiva}</span>
                                    </span>
                                )}
                                {busca && (
                                    <span className="flex items-center gap-1 bg-yellow-400/30 text-yellow-100 border border-yellow-400/50 text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                                        <Info size={8} />
                                        <span className="hidden sm:inline">{T.tagFiltro}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {usuario ? (
                            <Link
                                to="/admin"
                                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95 border border-white/10 shrink-0"
                            >
                                <LayoutDashboard size={14} />
                                <span className="text-[10px] font-black uppercase tracking-wider hidden sm:block">{T.voltarPainel}</span>
                            </Link>
                        ) : (
                            <div className="bg-blue-800/60 p-2 rounded-xl border border-blue-500/30 shadow-inner shrink-0">
                                <LayoutDashboard size={18} className="text-blue-100" />
                            </div>
                        )}
                    </div>

                    <div className="relative w-full group">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300 group-focus-within:text-blue-500 transition-colors" />

                        <input
                            type="text"
                            placeholder={T.placeholderBusca}
                            className="w-full bg-blue-800/40 border border-blue-400/30 text-white placeholder-blue-300 rounded-xl pl-10 pr-12 py-2.5 outline-none focus:ring-4 focus:ring-blue-400/50 focus:bg-blue-900/60 transition-all shadow-inner text-sm"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                        />

                        {busca && (
                            <button
                                onClick={() => setBusca('')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white hover:bg-blue-700/60 p-1.5 rounded-lg transition-all active:scale-95 flex items-center justify-center"
                                title="Limpar busca"
                            >
                                <X size={16} strokeWidth={3} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
                <div className="max-w-2xl mx-auto space-y-6">

                    {/* BANNER DE INSTALAÇÃO PWA */}
                    {showInstallBanner && (
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-xl shrink-0">
                                    <Download size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold">{T.instalarApp}</h4>
                                    <p className="text-[10px] text-blue-100 mt-0.5">{T.acessoRapido}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={handleInstallClick} className="bg-white text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform shadow-sm">
                                    {T.btnInstalar}
                                </button>
                                <button onClick={() => setShowInstallBanner(false)} className="p-1.5 text-blue-200 hover:text-white transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {semanasParaExibir.length === 0 ? (
                        <div className="text-center py-20 text-slate-300">
                            <Calendar size={60} className="mx-auto mb-4 opacity-10" />
                            <p className="font-black uppercase tracking-[0.1em] text-xs">{T.nenhumaReuniao}</p>
                        </div>
                    ) : (
                        semanasParaExibir.map((sem, idx) => {
                            const dataRef = sem.dataCorreta;
                            const estaSemana = checkEstaSemana(sem.semanaStartISO);
                            const isHoje = dataRef === hojeStr;
                            const estaAoVivo = modoTempoReal && reuniaoAoVivo === idx;
                            const estaEmContagem = modoPreLive && reuniaoEmContagem.index === idx;
                            const contagemSemana = estaEmContagem ? formatarContagemRegressiva(sem.partes[0].startObj.getTime() - agora.getTime()) : null;

                            const tipoEvento = getTipoEventoSemana(sem, config);
                            const isVisita = tipoEvento === 'visita';
                            const isAssembleia = tipoEvento === 'assembleia' || tipoEvento === 'congresso';
                            const isEspecial = tipoEvento && tipoEvento !== 'normal' && !isVisita && !isAssembleia;

                            const isExpanded = busca ? true : estaAoVivo || estaEmContagem || semanaExpandida === idx;

                            const numCantInicial = extrairNumeroCantico(sem.partes?.find(p => p.tipo === 'oracao_inicial')?.titulo);
                            const numCantMeio = extrairNumeroCantico(sem.partes?.find(p => p.tipo === 'cantico')?.titulo);
                            const numCantFinal = extrairNumeroCantico(sem.partes?.find(p => p.tipo === 'oracao_final')?.titulo);

                            return (
                                <div
                                    key={idx}
                                    className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${isVisita ? 'border-blue-500' :
                                        isAssembleia ? 'border-purple-500' :
                                            estaSemana ? 'border-emerald-500 ring-1 ring-emerald-200 shadow-md' :
                                                isEspecial ? 'border-amber-500' : 'border-slate-200'
                                        }`}
                                >
                                    {/* BANNERS ESPECIAIS */}
                                    {isVisita && (
                                        <div className="bg-blue-500 text-white text-[10px] font-black uppercase tracking-[0.1em] text-center py-2 flex items-center justify-center gap-2">
                                            <Star size={12} className="fill-white" /> {T.visita}
                                        </div>
                                    )}
                                    {isAssembleia && (
                                        <div className="bg-purple-500 text-white text-[10px] font-black uppercase tracking-[0.1em] text-center py-2 flex items-center justify-center gap-2">
                                            <Star size={12} className="fill-white" /> {tipoEvento === 'congresso' ? T.congresso : T.assembleia}
                                        </div>
                                    )}
                                    {isEspecial && (
                                        <div className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.1em] text-center py-2 flex items-center justify-center gap-2">
                                            <Star size={12} className="fill-white" /> {T.eventoEspecial}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => toggleSemana(idx)}
                                        className={`w-full px-5 py-4 flex justify-between items-center transition-colors ${estaSemana ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100'
                                            }`}
                                    >
                                        <div className="text-left">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-black text-slate-800 text-base">{sem.semana}</h3>
                                                {isHoje && (
                                                    <span className="bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm animate-pulse">{T.hoje}</span>
                                                )}
                                                {estaSemana && !isHoje && (
                                                    <span className="bg-emerald-100 text-emerald-700 border border-emerald-300 text-[8px] font-black uppercase px-2 py-0.5 rounded-md">{T.atual}</span>
                                                )}
                                            </div>
                                            <p className="text-blue-600 font-bold text-xs flex items-center gap-1.5 uppercase">
                                                <Calendar size={12} /> {formatarDataCompleta(dataRef, lang, T)}
                                            </p>
                                        </div>
                                        <div className="text-slate-400">
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </button>

                                    {/* CONTEÚDO EXPANSÍVEL */}
                                    {isExpanded && (
                                        <div className="p-5 space-y-6 bg-white border-t border-slate-100">
                                            {isAssembleia ? (
                                                <div className="text-center py-6 px-4 bg-purple-50 rounded-2xl border border-purple-100">
                                                    <Star size={32} className="mx-auto mb-3 text-purple-300" />
                                                    <p className="font-black text-purple-900 text-sm">
                                                        {tipoEvento === 'congresso' ? T.congresso : T.assembleia}
                                                    </p>
                                                    <p className="text-xs mt-1 text-purple-700 font-medium">
                                                        {T.msgAssembleia}
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* CÂNTICOS (Modo Normal) */}
                                                    {!busca && !estaAoVivo && (numCantInicial || numCantMeio || numCantFinal) && (
                                                        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 mb-2">
                                                            <div className="text-center flex-1 border-r border-slate-200 last:border-0">
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{T.inicio}</p>
                                                                <div className="flex items-center justify-center gap-1 text-blue-600 font-black text-sm"><Music size={12} /> {numCantInicial || '-'}</div>
                                                            </div>
                                                            <div className="text-center flex-1 border-r border-slate-200 last:border-0">
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{T.meio}</p>
                                                                <div className="flex items-center justify-center gap-1 text-amber-600 font-black text-sm"><Music size={12} /> {numCantMeio || '-'}</div>
                                                            </div>
                                                            <div className="text-center flex-1">
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{T.fim}</p>
                                                                <div className="flex items-center justify-center gap-1 text-rose-600 font-black text-sm"><Music size={12} /> {numCantFinal || '-'}</div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* PRESIDENTE */}
                                                    {sem.presidente && (!busca || sem.presidente.nome.toLowerCase().includes(busca.toLowerCase())) && (
                                                        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-4">
                                                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                                <User size={20} />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase">{T.presidente}</p>
                                                                <p className="text-[13px] font-bold text-slate-800">{sem.presidente.nome}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="space-y-0 pt-2">
                                                        {estaEmContagem && !sem.termosBuscados && sem.partes?.length > 0 && (
                                                            <div className="mb-5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 shadow-sm">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                                                                            {T.comecaEm}
                                                                        </p>
                                                                        <p className="text-sm font-bold text-amber-950">
                                                                            {sem.meetingStartTimeStr} • {contagemSemana}
                                                                        </p>
                                                                    </div>
                                                                    <div className="shrink-0 rounded-xl bg-white/80 px-3 py-2 text-center shadow-sm ring-1 ring-amber-200">
                                                                        <div className="text-[18px] leading-none font-black tracking-tight text-amber-600 tabular-nums">
                                                                            {contagemSemana}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* NÓ DE INÍCIO DA REUNIÃO */}
                                                        {estaAoVivo && !sem.termosBuscados && sem.partes?.length > 0 && (() => {
                                                            const meetingStarted = agora >= sem.partes[0]?.startObj;
                                                            return (
                                                                <div className="flex gap-2 relative">
                                                                    <div className="w-[40px] shrink-0 text-right pt-0.5">
                                                                        <span className="text-[11px] font-black text-blue-500 tracking-tighter">{sem.meetingStartTimeStr}</span>
                                                                    </div>

                                                                    <div className="relative w-4 flex justify-center shrink-0">
                                                                        <div className={`absolute top-3 bottom-[-1.5rem] w-[2px] transition-colors duration-500 ${meetingStarted ? 'bg-emerald-400' : 'bg-slate-200'}`}></div>
                                                                        <div className={`w-3 h-3 mt-1.5 rounded-full z-10 shrink-0 shadow-sm transition-colors duration-500 ${meetingStarted ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                                                    </div>

                                                                    <div className="flex-1 pb-6">
                                                                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-sm">
                                                                            <PlayCircle size={10} className="text-blue-500" /> {T.inicioReuniao}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* RENDERIZAÇÃO DAS PARTES */}
                                                        {sem.partes.map((parte, i) => {
                                                            const principal = parte.estudante || parte.dirigente || parte.oracao;
                                                            const isAcontecendo = estaAoVivo && agora >= parte.startObj && agora < parte.endObj;
                                                            const jaPassou = estaAoVivo && agora >= parte.endObj;

                                                            // --- NOVO: Cálculo do Progresso (Barra vertical dinâmica) ---
                                                            let progresso = 0;
                                                            if (jaPassou) {
                                                                progresso = 100;
                                                            } else if (isAcontecendo) {
                                                                const totalTempoMs = parte.endObj.getTime() - parte.startObj.getTime();
                                                                const tempoDecorridoMs = agora.getTime() - parte.startObj.getTime();
                                                                // Garante que o número fique sempre entre 0 e 100%
                                                                progresso = Math.max(0, Math.min(100, (tempoDecorridoMs / totalTempoMs) * 100));
                                                            }
                                                            // -------------------------------------------------------------

                                                            const configLabels = {
                                                                tesouros: { txt: T.secoes.tesouros, css: "bg-slate-100 text-slate-600" },
                                                                ministerio: { txt: T.secoes.ministerio, css: "bg-amber-100 text-amber-800" },
                                                                vida: { txt: T.secoes.vida, css: "bg-rose-100 text-rose-800" }
                                                            };
                                                            const label = configLabels[parte.secao] || null;

                                                            return estaAoVivo ? (
                                                                /* === MODO TEMPO REAL === */
                                                                <div key={i} className={`flex gap-2 relative ${jaPassou ? 'opacity-60 grayscale-[30%]' : ''}`}>

                                                                    <div className="w-[40px] shrink-0 text-right pt-0.5">
                                                                        <span className={`text-[11px] font-black tracking-tighter ${jaPassou ? 'text-slate-400' : isAcontecendo ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                                            {parte.startTimeStr}
                                                                        </span>
                                                                    </div>

                                                                    {/* NOVO: ESTRUTURA DA LINHA DINÂMICA */}
                                                                    {/* NOVO: ESTRUTURA DA LINHA DINÂMICA E BOLINHA */}
                                                                    <div className="relative w-4 flex justify-center shrink-0">

                                                                        {/* Fundo Cinza (Trilho) com overflow-hidden para não vazar a cor */}
                                                                        <div className="absolute top-3 bottom-[-1.5rem] w-[2px] bg-slate-200 overflow-hidden">
                                                                            {/* Barra Verde (Preenchimento) que cresce baseada na % */}
                                                                            <div
                                                                                className="w-full bg-emerald-400 transition-all ease-linear"
                                                                                style={{
                                                                                    height: `${progresso}%`,
                                                                                    transitionDuration: isAcontecendo ? '10000ms' : '500ms'
                                                                                }}
                                                                            ></div>
                                                                        </div>

                                                                        {/* Container da Bolinha */}
                                                                        <div className="relative mt-1.5 flex justify-center items-center z-10 w-3 h-3">

                                                                            {/* 1. O RIPPLE (Onda tipo Sonar) - Roda exatas 1 vez quando começa */}
                                                                            {isAcontecendo && (
                                                                                <div
                                                                                    className="absolute inset-0 rounded-full bg-emerald-400 animate-ping"
                                                                                    style={{ animationIterationCount: 1, animationDuration: '1000ms' }}
                                                                                ></div>
                                                                            )}

                                                                            {/* 2. A BOLINHA (Com efeito "Pop" quando inicia e "Pulse" contínuo depois) */}
                                                                            {/* O 'key' forca o React a recriar a div quando muda de status, ativando a animação de entrada (Pop) */}
                                                                            <div
                                                                                key={isAcontecendo ? 'on' : jaPassou ? 'past' : 'off'}
                                                                                className={`relative w-full h-full rounded-full shadow-sm transition-colors duration-500 ${isAcontecendo ? 'animate-pop-in' : ''}`}
                                                                            >
                                                                                <div className={`w-full h-full rounded-full ${isAcontecendo
                                                                                    ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-100'
                                                                                    : jaPassou
                                                                                        ? 'bg-emerald-400'
                                                                                        : 'bg-slate-300'
                                                                                    }`}></div>
                                                                            </div>

                                                                        </div>
                                                                    </div>

                                                                    <div className="flex-1 pb-6">
                                                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                            {label && (
                                                                                <span className={`inline-block text-[8px] font-black px-2 py-0.5 rounded uppercase ${jaPassou ? 'bg-slate-200 text-slate-500' : label.css}`}>
                                                                                    {label.txt}
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[9px] font-bold text-slate-400">{parte.tempo} min</span>
                                                                            {isAcontecendo && <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded animate-pulse">{T.aoVivo}</span>}
                                                                            {jaPassou && <CheckCircle2 size={12} className="text-slate-400" />}
                                                                        </div>

                                                                        <h4 className={`text-sm font-bold leading-snug pr-2 ${jaPassou ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                                                                            {parte.titulo}
                                                                        </h4>

                                                                        {principal?.nome && (
                                                                            <div className={`mt-2 p-2.5 rounded-xl border ${isAcontecendo ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                                                                                <p className="text-[13px] font-black text-slate-900 flex items-center flex-wrap">
                                                                                    {parte.oracao?.nome && !parte.estudante && !parte.dirigente && (
                                                                                        <span className="text-slate-500 font-bold text-[10px] mr-1.5 uppercase tracking-wider bg-slate-200/50 px-1.5 py-0.5 rounded">{T.oracao}:</span>
                                                                                    )}
                                                                                    {principal.nome}
                                                                                </p>
                                                                                {parte.ajudante?.nome && <p className="text-[11px] mt-1 text-slate-500 flex items-center gap-1"><ChevronRight size={10} className="text-blue-400" /> {T.ajuda}: {parte.ajudante.nome}</p>}
                                                                                {parte.leitor?.nome && <p className="text-[11px] mt-1 text-slate-500 flex items-center gap-1"><BookOpen size={10} className="text-blue-400" /> {T.leitor}: {parte.leitor.nome}</p>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                /* === MODO NORMAL === */
                                                                <div key={i} className="flex gap-3 relative">

                                                                    <div className="relative w-10 flex justify-center shrink-0">
                                                                        {i !== sem.partes.length - 1 && (
                                                                            <div className="absolute top-10 bottom-[-1.5rem] w-[2px] bg-slate-200"></div>
                                                                        )}
                                                                        <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-100 flex flex-col items-center justify-center z-10 shadow-sm">
                                                                            <span className="text-[10px] font-black text-slate-600 leading-none">{parte.tempo}</span>
                                                                            <span className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">min</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex-1 pb-6 space-y-2">
                                                                        {label && (
                                                                            <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded uppercase ${label.css}`}>
                                                                                {label.txt}
                                                                            </span>
                                                                        )}
                                                                        <h4 className="text-sm font-bold text-slate-800 leading-snug pr-2">{parte.titulo}</h4>

                                                                        {principal?.nome && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center mt-2">
                                                                                <div className="flex-1">
                                                                                    <p className="text-[13px] font-bold text-slate-900 flex items-center flex-wrap">
                                                                                        {parte.oracao?.nome && !parte.estudante && !parte.dirigente && (
                                                                                            <span className="text-slate-500 font-bold text-[10px] mr-1.5 uppercase tracking-wider bg-slate-200/50 px-1.5 py-0.5 rounded">{T.oracao}:</span>
                                                                                        )}
                                                                                        {principal.nome}
                                                                                    </p>
                                                                                    {parte.ajudante?.nome && (
                                                                                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                                                                                            <ChevronRight size={10} className="text-blue-400" />
                                                                                            {T.ajuda}: <span className="font-semibold text-slate-700">{parte.ajudante.nome}</span>
                                                                                        </p>
                                                                                    )}
                                                                                    {parte.leitor?.nome && (
                                                                                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                                                                                            <BookOpen size={10} className="text-blue-400" />
                                                                                            {T.leitor}: <span className="font-semibold text-slate-700">{parte.leitor.nome}</span>
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                                <a
                                                                                    href={gerarLinkAgenda(parte, dataRef, agendaTexts)}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="p-2.5 rounded-xl border bg-white text-blue-600 border-slate-200 shadow-sm active:scale-95 transition-colors"
                                                                                    title={T.salvarAgenda}
                                                                                >
                                                                                    <CalendarPlus size={18} />
                                                                                </a>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* NÓ DE TÉRMINO DA REUNIÃO */}
                                                        {estaAoVivo && !sem.termosBuscados && sem.partes?.length > 0 && (
                                                            <div className="flex gap-2 relative mt-[-0.5rem] pb-4">
                                                                <div className="w-[40px] shrink-0 text-right pt-0.5">
                                                                    <span className="text-[11px] font-black text-rose-500 tracking-tighter">{sem.meetingEndTimeStr}</span>
                                                                </div>
                                                                <div className="relative w-4 flex justify-center shrink-0">
                                                                    <div className="w-3 h-3 mt-1.5 rounded-full bg-rose-500 z-10 shrink-0 shadow-sm"></div>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 shadow-sm">
                                                                        <CheckCircle2 size={10} className="text-rose-500" /> {T.fimReuniao}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}

                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="py-10 text-center flex flex-col items-center opacity-60">
                    <p className="text-slate-500 font-bold text-[9px] uppercase tracking-widest mb-4">
                        {T.atualizado}
                    </p>
                    <Link
                        to="/admin"
                        className="flex items-center gap-1.5 bg-slate-200/50 hover:bg-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        {usuario ? <LayoutDashboard size={10} /> : <Lock size={10} />}
                        {usuario ? T.voltarPainel : T.acessoSuper}
                    </Link>
                </div>
            </main>
        </div>
    );
}
