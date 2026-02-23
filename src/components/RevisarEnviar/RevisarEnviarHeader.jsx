import React, { useState } from 'react';
import { CalendarDays, Loader2, Calendar, X } from 'lucide-react';
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
                // Pré-seleciona a agenda principal
                const principal = res.calendarios.find(c => c.principal);
                setCalendarioSelecionado(principal ? principal.id : res.calendarios[0].id);
                setModalCalendario(true);
            } else {
                alert(`Erro ao acessar o Google: ${res.erro}`);
            }
        } finally {
            setSincronizando(false);
        }
    };

    // Etapa 2: O usuário clicou em Confirmar dentro do Modal
    const handleConfirmar = async () => {
        setEnviando(true);
        try {
            await onConfirmSync(tokenGoogle, calendarioSelecionado);
            setModalCalendario(false);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 no-print shrink-0 relative">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                {/* ESQUERDA */}
                <div className="min-w-0 flex flex-col gap-2">
                    {/* selects e filtros */}
                    <div className="flex flex-wrap items-end gap-4">
                        
                        {abaAtiva === 'imprimir' && (
                            <>
                                <div className="flex flex-col min-w-[220px]">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        {t.labelInicio}
                                    </span>
                                    <select
                                        className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none cursor-pointer"
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

                                <div className="flex flex-col min-w-[200px]">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        {t.labelLayout}
                                    </span>
                                    <select
                                        className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none cursor-pointer"
                                        value={qtdSemanas}
                                        onChange={(e) => setQtdSemanas(Number(e.target.value))}
                                    >
                                        <option value={1}>{t.layoutOpcoes?.[0] ?? '1 semana'}</option>
                                        <option value={2}>{t.layoutOpcoes?.[1] ?? '2 semanas'}</option>
                                        <option value={4}>{t.layoutOpcoes?.[2] ?? '4 semanas'}</option>
                                        <option value={5}>{t.layoutOpcoes?.[3] ?? '5 semanas (compacto)'}</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {/* filtro Ativas/Arquivadas/Todas (Este continua visível) */}
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {L('labelSemanas', 'Semanas:')}
                            </span>

                            <div className="flex border rounded-full overflow-hidden h-8">
                                <button
                                    type="button"
                                    aria-pressed={filtroSemanas === 'ativas'}
                                    onClick={() => setFiltroSemanas('ativas')}
                                    className={`px-2 text-[11px] font-bold ${filtroSemanas === 'ativas'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {L('filtroAtivas', 'Ativas')}
                                </button>

                                <button
                                    type="button"
                                    aria-pressed={filtroSemanas === 'arquivadas'}
                                    onClick={() => setFiltroSemanas('arquivadas')}
                                    className={`px-2 text-[11px] font-bold border-l ${filtroSemanas === 'arquivadas'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {L('filtroArquivadas', 'Arquivadas')}
                                </button>

                                <button
                                    type="button"
                                    aria-pressed={filtroSemanas === 'todas'}
                                    onClick={() => setFiltroSemanas('todas')}
                                    className={`px-2 text-[11px] font-bold border-l ${filtroSemanas === 'todas'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {L('filtroTodas', 'Todas')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Chips semanas */}
                    {showWeekTabs && (
                        <div className="bg-white rounded-lg border p-2 mt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                <div className="text-[10px] font-black uppercase text-gray-400">
                                    {selectedCount} {L('selecionadas', 'selecionada(s)')}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={selecionarTodasPrint}
                                        className="px-2 py-1 rounded-full text-xs font-bold border bg-gray-100 hover:bg-gray-200 transition"
                                        title={L('titleSelecionarTodas', 'Selecionar todas')}
                                    >
                                        {L('btnTodas', 'Todas')}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={limparPrint}
                                        className="px-2 py-1 rounded-full text-xs font-bold border bg-white hover:bg-gray-100 transition"
                                        title={L('titleLimparSelecao', 'Limpar seleção')}
                                    >
                                        {L('btnLimpar', 'Limpar')}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-2">
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
                                                'px-3 py-1 rounded-full text-xs font-bold border transition whitespace-nowrap inline-flex items-center gap-2 max-w-full',
                                                on
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
                                            ].join(' ')}
                                            title={s.semana}
                                        >
                                            <span className="truncate">{s.semana}</span>

                                            {isArq && (
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-black/10">
                                                    {L('badgeArquivada', 'Arquivada')}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {semanasDisponiveis.length === 0 && (
                                <div className="text-xs text-gray-400 italic mt-2">
                                    {L('nenhumaSemanaFiltro', 'Nenhuma semana para este filtro.')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* DIREITA (Botões de Ação) */}
                <div className="flex flex-col items-stretch md:items-end gap-3">
                    <div className="flex flex-col gap-2 w-full md:w-[230px]">
                        {abaAtiva === 'imprimir' && (
                            <button
                                onClick={onPrint}
                                className="w-full whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition active:scale-95"
                            >
                                {t.btnImprimir}
                            </button>
                        )}

                        <button
                            onClick={onGravarHistorico}
                            className="w-full whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition active:scale-95"
                            title={t.btnGravarHistorico}
                        >
                            {t.btnGravarHistorico}
                        </button>

                        <button
                            onClick={handleSyncClick}
                            disabled={sincronizando}
                            className="w-full whitespace-nowrap bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            title="Enviar as designações ativas para o seu Google Agenda"
                        >
                            {sincronizando ? <Loader2 className="animate-spin" size={16} /> : <CalendarDays size={16} />}
                            {sincronizando ? 'Conectando...' : 'Sincronizar Agenda'}
                        </button>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-[230px]">
                        <button
                            type="button"
                            aria-pressed={abaAtiva === 'imprimir'}
                            onClick={() => setAbaAtiva('imprimir')}
                            className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition ${abaAtiva === 'imprimir'
                                    ? 'bg-white text-blue-700 shadow-sm'
                                    : 'text-gray-500'
                                }`}
                        >
                            {t.abaVisualizar}
                        </button>

                        <button
                            type="button"
                            aria-pressed={abaAtiva === 'notificar'}
                            onClick={() => setAbaAtiva('notificar')}
                            className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition ${abaAtiva === 'notificar'
                                    ? 'bg-white text-green-700 shadow-sm'
                                    : 'text-gray-500'
                                }`}
                        >
                            {t.abaNotificar}
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL DE SELEÇÃO DE CALENDÁRIO */}
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
                                    className="px-4 py-2 text-xs font-bold text-gray-400 hover:bg-gray-100 rounded-xl"
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