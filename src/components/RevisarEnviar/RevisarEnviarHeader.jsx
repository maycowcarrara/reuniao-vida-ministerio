import React, { useState } from 'react';
import { CalendarDays, Loader2, Calendar, X, Printer, Save } from 'lucide-react';
import { iniciarSincronizacao } from '../../services/calendarSync';

const RevisarEnviarHeader = ({
    t,
    abaAtiva,
    setAbaAtiva,

    startIndex,
    setStartIndex,
    qtdSemanas,
    setQtdSemanas,

    historicoSelect,

    // filtro semanas
    filtroSemanas,
    setFiltroSemanas,

    // Chips semanas (impressão)
    showWeekTabs,
    semanasDisponiveis,
    getSemanaKey,
    printSelecionadas,
    toggleSemanaPrint,
    selecionarTodasPrint,
    limparPrint,

    // Ações
    onPrint,
    onGravarHistorico,

    // Callback para executar o salvamento de fato
    onConfirmSync,
}) => {
    const selectedCount = Object.values(printSelecionadas || {}).filter(Boolean).length;
    const L = (key, fallback) => (t?.[key] ?? fallback);

    // Estados do Modal do Google Agenda
    const [sincronizando, setSincronizando] = useState(false);
    const [modalCalendario, setModalCalendario] = useState(false);
    const [calendarios, setCalendarios] = useState([]);
    const [calendarioSelecionado, setCalendarioSelecionado] = useState('');
    const [tokenGoogle, setTokenGoogle] = useState(null);
    const [enviando, setEnviando] = useState(false);

    // Etapa 1: Abre a janela do Google, pega o token e as agendas
    const handleSyncClick = async () => {
        if (!onConfirmSync) return;
        setSincronizando(true);
        try {
            const res = await iniciarSincronizacao();
            if (res.sucesso) {
                setTokenGoogle(res.token);
                setCalendarios(res.calendarios);

                // Verifica se tem uma agenda salva na memória do navegador
                const agendaSalva = localStorage.getItem('rvm_saved_calendar_id');
                const agendaSalvaExiste = res.calendarios.find(c => c.id === agendaSalva);

                if (agendaSalvaExiste) {
                    setCalendarioSelecionado(agendaSalva);
                } else {
                    const principal = res.calendarios.find(c => c.principal);
                    setCalendarioSelecionado(principal ? principal.id : res.calendarios[0].id);
                }

                setModalCalendario(true);
            } else {
                alert(`Erro ao acessar o Google: ${res.erro}`);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSincronizando(false);
        }
    };

    // Etapa 2: O usuário clicou em Confirmar dentro do Modal
    const handleConfirmar = async () => {
        setEnviando(true);
        try {
            // Salva a escolha do usuário na memória para a próxima vez
            localStorage.setItem('rvm_saved_calendar_id', calendarioSelecionado);

            await onConfirmSync(tokenGoogle, calendarioSelecionado);
            setModalCalendario(false);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-gray-100 no-print shrink-0 relative flex flex-col gap-5">
            
            {/* LINHA 1: ABAS E BOTÕES DE AÇÃO PRINCIPAIS */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                
                {/* Abas Visualizar / Notificar */}
                <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto shrink-0 shadow-inner">
                    <button
                        type="button"
                        aria-pressed={abaAtiva === 'imprimir'}
                        onClick={() => setAbaAtiva('imprimir')}
                        className={`flex-1 lg:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                            abaAtiva === 'imprimir'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.abaVisualizar || 'Visualizar'}
                    </button>

                    <button
                        type="button"
                        aria-pressed={abaAtiva === 'notificar'}
                        onClick={() => setAbaAtiva('notificar')}
                        className={`flex-1 lg:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                            abaAtiva === 'notificar'
                                ? 'bg-white text-green-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.abaNotificar || 'Notificar'}
                    </button>
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {abaAtiva === 'imprimir' && (
                        <button
                            onClick={onPrint}
                            className="flex-1 lg:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95"
                        >
                            <Printer size={14} /> {t.btnImprimir || 'Imprimir'}
                        </button>
                    )}

                    <button
                        onClick={onGravarHistorico}
                        className="flex-1 lg:flex-none px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-full text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95"
                        title={t.btnGravarHistorico}
                    >
                        <Save size={14} /> {t.btnGravarHistorico || 'Sincronizar Histórico'}
                    </button>

                    <button
                        onClick={handleSyncClick}
                        disabled={sincronizando}
                        className="flex-1 lg:flex-none px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-full text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        title="Enviar as designações ativas para o seu Google Agenda"
                    >
                        {sincronizando ? <Loader2 className="animate-spin" size={14} /> : <CalendarDays size={14} />}
                        {sincronizando ? 'Conectando...' : 'Sincronizar Agenda'}
                    </button>
                </div>
            </div>

            {/* LINHA 2: SELECTS E FILTROS */}
            <div className="flex flex-wrap items-end gap-4">
                
                {/* Filtro Ativas/Arquivadas/Todas */}
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 px-1">
                        {L('labelSemanas', 'Filtro:')}
                    </span>
                    <div className="flex border border-gray-200 rounded-full overflow-hidden shadow-sm">
                        <button
                            type="button"
                            onClick={() => setFiltroSemanas('ativas')}
                            className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                                filtroSemanas === 'ativas' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-white'
                            }`}
                        >
                            {L('filtroAtivas', 'Ativas')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFiltroSemanas('arquivadas')}
                            className={`px-4 py-1.5 text-xs font-bold border-l border-gray-200 transition-colors ${
                                filtroSemanas === 'arquivadas' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-white'
                            }`}
                        >
                            {L('filtroArquivadas', 'Arquivadas')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFiltroSemanas('todas')}
                            className={`px-4 py-1.5 text-xs font-bold border-l border-gray-200 transition-colors ${
                                filtroSemanas === 'todas' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-white'
                            }`}
                        >
                            {L('filtroTodas', 'Todas')}
                        </button>
                    </div>
                </div>

                {/* Aparece Apenas na aba de Imprimir */}
                {abaAtiva === 'imprimir' && (
                    <>
                        <div className="flex flex-col min-w-[200px] flex-1 lg:flex-none">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 px-1">
                                {t.labelInicio || 'A partir de:'}
                            </span>
                            <select
                                className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-blue-100 shadow-sm"
                                value={startIndex}
                                onChange={(e) => setStartIndex(Number(e.target.value))}
                            >
                                {historicoSelect.map((h, i) => (
                                    <option key={i} value={i}>
                                        {h.semana}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col min-w-[200px] flex-1 lg:flex-none">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 px-1">
                                {t.labelLayout || 'Layout de Impressão:'}
                            </span>
                            <select
                                className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-blue-100 shadow-sm"
                                value={qtdSemanas}
                                onChange={(e) => setQtdSemanas(Number(e.target.value))}
                            >
                                <option value={1}>{t.layoutOpcoes?.[0] ?? '1 semana por página'}</option>
                                <option value={2}>{t.layoutOpcoes?.[1] ?? '2 semanas por página'}</option>
                                <option value={4}>{t.layoutOpcoes?.[2] ?? '4 semanas por página'}</option>
                                <option value={5}>{t.layoutOpcoes?.[3] ?? '5 semanas (compacto)'}</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            {/* LINHA 3: CAIXA DE SEMANAS COM TODAS/LIMPAR */}
            {showWeekTabs && (
                <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm mt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                        <div className="text-[10px] font-black uppercase text-gray-400">
                            {selectedCount} {L('selecionadas', 'semana(s) selecionada(s)')}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={selecionarTodasPrint}
                                className="px-3 py-1 rounded-full text-xs font-bold border bg-gray-100 hover:bg-gray-200 transition text-gray-700 shadow-sm"
                            >
                                {L('btnTodas', 'Todas')}
                            </button>
                            <button
                                type="button"
                                onClick={limparPrint}
                                className="px-3 py-1 rounded-full text-xs font-bold border bg-white hover:bg-gray-100 transition text-gray-700 shadow-sm"
                            >
                                {L('btnLimpar', 'Limpar')}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {semanasDisponiveis.map((s, i) => {
                            const k = getSemanaKey(s, i);
                            const on = !!printSelecionadas?.[k];
                            const isArq = !!s?.arquivada;

                            return (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => toggleSemanaPrint(k)}
                                    className={[
                                        'px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap inline-flex items-center gap-1.5 shadow-sm max-w-full',
                                        on
                                            ? 'bg-blue-600 text-white border-blue-700'
                                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                    ].join(' ')}
                                    title={s.semana}
                                >
                                    <span className="truncate max-w-[80px] sm:max-w-[120px]">{s.semana?.split(' -')[0] || s.semana}</span>
                                    {isArq && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${on ? "bg-black/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                                            {L('badgeArquivada', 'Arquivada')}
                                        </span>
                                    )}
                                </button>
                            );
                        })}

                        {semanasDisponiveis.length === 0 && (
                            <div className="text-xs text-gray-400 italic py-1">
                                {L('nenhumaSemanaFiltro', 'Nenhuma semana para este filtro.')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DE SELEÇÃO DE CALENDÁRIO GOOGLE */}
            {modalCalendario && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm no-print text-left">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <CalendarDays size={18} /> Escolha a Agenda
                            </h3>
                            <button onClick={() => !enviando && setModalCalendario(false)} className="hover:text-indigo-200"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-gray-500">
                                Encontramos as seguintes agendas na sua conta do Google. Em qual delas você deseja salvar os blocos de horário da reunião?
                            </p>

                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-3.5 text-gray-400" />
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-indigo-500 cursor-pointer"
                                    value={calendarioSelecionado}
                                    onChange={(e) => setCalendarioSelecionado(e.target.value)}
                                    disabled={enviando}
                                >
                                    {calendarios.map(cal => (
                                        <option key={cal.id} value={cal.id}>
                                            {cal.nome} {cal.principal ? '(Principal)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => setModalCalendario(false)}
                                    disabled={enviando}
                                    className="px-4 py-2 text-xs font-bold text-gray-400 hover:bg-gray-100 rounded-xl transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmar}
                                    disabled={enviando}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {enviando ? <Loader2 className="animate-spin" size={14} /> : null}
                                    {enviando ? 'Enviando Eventos...' : 'Confirmar e Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RevisarEnviarHeader;