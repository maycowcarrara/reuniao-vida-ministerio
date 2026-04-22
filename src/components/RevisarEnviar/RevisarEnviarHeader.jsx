import React, { useState } from 'react';
import { CalendarDays, Loader2, Calendar, X, Printer, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from '../../utils/toast';
import { getSemanaSortTimestamp } from '../../utils/revisarEnviar/dates';

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
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    // Mapeamos para preservar o índice original
    const semanasOrdenadas = semanasDisponiveis
        .map((sem, originalIndex) => ({ sem, originalIndex }))
        .sort((a, b) => getSemanaSortTimestamp(a.sem) - getSemanaSortTimestamp(b.sem));

    const filtroLabel = {
        ativas: L('filtroAtivas', 'Ativas'),
        arquivadas: L('filtroArquivadas', 'Arquivadas'),
        todas: L('filtroTodas', 'Todas')
    }[filtroSemanas] || L('filtroAtivas', 'Ativas');

    const renderTabs = () => (
        <div className="flex bg-gray-100 p-1 rounded-lg shrink-0 shadow-inner">
            <button
                type="button"
                aria-pressed={abaAtiva === 'imprimir'}
                onClick={() => setAbaAtiva('imprimir')}
                className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${abaAtiva === 'imprimir'
                    ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                {t.abaVisualizar || 'Visualizar'}
            </button>
            <button
                type="button"
                aria-pressed={abaAtiva === 'notificar'}
                onClick={() => setAbaAtiva('notificar')}
                className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${abaAtiva === 'notificar'
                    ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                {t.abaNotificar || 'Notificar'}
            </button>
        </div>
    );

    const renderFiltroStatus = () => (
        <div className="flex border border-gray-200 rounded-full overflow-hidden shadow-sm shrink-0">
            <button type="button" onClick={() => setFiltroSemanas('ativas')} className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${filtroSemanas === 'ativas' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-white'}`}>
                {L('filtroAtivas', 'Ativas')}
            </button>
            <button type="button" onClick={() => setFiltroSemanas('arquivadas')} className={`px-3 py-1.5 text-[11px] font-bold border-l border-gray-200 transition-colors ${filtroSemanas === 'arquivadas' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-white'}`}>
                {L('filtroArquivadas', 'Arquivadas')}
            </button>
            <button type="button" onClick={() => setFiltroSemanas('todas')} className={`px-3 py-1.5 text-[11px] font-bold border-l border-gray-200 transition-colors ${filtroSemanas === 'todas' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-white'}`}>
                {L('filtroTodas', 'Todas')}
            </button>
        </div>
    );

    const renderActions = (mobile = false) => (
        <div className={mobile ? 'grid grid-cols-1 gap-2' : 'flex flex-wrap items-center gap-2'}>
            {abaAtiva === 'imprimir' && (
                <button onClick={onPrint} className="px-3 py-2 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl sm:rounded-full text-[11px] font-bold shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95">
                    <Printer size={13} /> {t.btnImprimir || 'Imprimir'}
                </button>
            )}

            <button onClick={onGravarHistorico} className="px-3 py-2 sm:py-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl sm:rounded-full text-[11px] font-bold shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95" title={t.btnGravarHistorico}>
                <Save size={13} /> {t.btnGravarHistorico || 'Sincronizar Historico'}
            </button>

            <button onClick={handleSyncClick} disabled={sincronizando} className="px-3 py-2 sm:py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl sm:rounded-full text-[11px] font-bold shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed" title={t.agendaHint}>
                {sincronizando ? <Loader2 className="animate-spin" size={13} /> : <CalendarDays size={13} />}
                {sincronizando ? t.agendaConnecting : t.agendaSync}
            </button>
        </div>
    );

    const renderWeekBox = (mobile = false) => (
        <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm flex flex-wrap items-center gap-2.5">
            {abaAtiva === 'imprimir' && (
                <>
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-[11px]">
                        <span className="font-bold text-gray-400">{L('labelInicio', 'A partir de:')}</span>
                        <select className="bg-transparent outline-none font-bold text-gray-700 cursor-pointer max-w-[120px] truncate" value={startIndex} onChange={(e) => setStartIndex(Number(e.target.value))}>
                            {historicoSelect.map((h, i) => (
                                <option key={i} value={i}>{h.semana}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-[11px]">
                        <span className="font-bold text-gray-400">{L('labelLayout', 'Layout:')}</span>
                        <select className="bg-transparent outline-none font-bold text-gray-700 cursor-pointer max-w-[150px] truncate" value={qtdSemanas} onChange={(e) => setQtdSemanas(Number(e.target.value))}>
                            <option value={1}>{t.layoutOpcoes?.[0] ?? '1 p/ pag'}</option>
                            <option value={2}>{t.layoutOpcoes?.[1] ?? '2 p/ pag'}</option>
                            <option value={4}>{t.layoutOpcoes?.[2] ?? '4 p/ pag'}</option>
                            <option value={5}>{t.layoutOpcoes?.[3] ?? '5 p/ pag'}</option>
                        </select>
                    </div>

                    <div className="w-px h-5 bg-gray-300 mx-1 hidden md:block"></div>
                </>
            )}

            <div className="flex items-center gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400 mr-1 hidden sm:block">
                    {selectedCount} {L('selecionadas', 'sel.')}
                </span>
                <button type="button" onClick={selecionarTodasPrint} className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-gray-100 hover:bg-gray-200 transition text-gray-700">
                    {L('btnTodas', 'Todas')}
                </button>
                <button type="button" onClick={limparPrint} className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-white hover:bg-gray-100 transition text-gray-700">
                    {L('btnLimpar', 'Limpar')}
                </button>
            </div>

            <div className={mobile ? 'flex w-full flex-col gap-1.5' : 'flex flex-wrap items-center gap-1.5 ml-1'}>
                {semanasOrdenadas.map(({ sem: s, originalIndex: i }) => {
                    const k = getSemanaKey(s, i);
                    const on = !!printSelecionadas?.[k];
                    const isArq = !!s?.arquivada;

                    return (
                        <button
                            key={k}
                            type="button"
                            onClick={() => toggleSemanaPrint(k)}
                            className={[
                                'px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap inline-flex items-center gap-1 max-w-full',
                                mobile ? 'justify-between' : '',
                                on ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            ].join(' ')}
                            title={s.semana}
                        >
                            <span className="truncate max-w-[80px] sm:max-w-[100px]">{s.semana?.split(' -')[0] || s.semana}</span>
                            {isArq && (
                                <span className={`text-[9px] font-black px-1 py-0.5 rounded ${on ? "bg-black/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                                    {t.badgeArquivada}
                                </span>
                            )}
                        </button>
                    );
                })}

                {semanasDisponiveis.length === 0 && (
                    <div className="text-[11px] text-gray-400 italic px-2">
                        {L('nenhumaSemanaFiltro', 'Nenhuma semana para este filtro.')}
                    </div>
                )}
            </div>
        </div>
    );

    // Etapa 1: Abre a janela do Google, pega o token e as agendas
    const handleSyncClick = async () => {
        if (!onConfirmSync) return;
        setSincronizando(true);
        try {
            const { iniciarSincronizacao } = await import('../../services/calendarSync');
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
                toast.error(res.erro, t.agendaGoogleError);
            }
        } catch (err) {
            console.error(err);
            toast.error(err, t.agendaGoogleError);
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
        <div className="bg-white p-2.5 sm:p-3 md:p-4 rounded-2xl shadow-sm border border-gray-100 no-print shrink-0 relative flex flex-col gap-2.5 sm:gap-3">

            <div className="sm:hidden flex items-center justify-between gap-2">
                {renderTabs()}
                <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-700 shadow-sm"
                    aria-label="Filtros"
                >
                    <SlidersHorizontal size={18} />
                </button>
            </div>

            <div className="sm:hidden flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase text-gray-400">{filtroLabel}</div>
                    <div className="truncate text-sm font-black text-gray-800">{selectedCount} {L('selecionadas', 'selecionadas')}</div>
                </div>
                <div className="text-[10px] font-bold uppercase text-gray-400">{abaAtiva === 'imprimir' ? (t.abaVisualizar || 'Visualizar') : (t.abaNotificar || 'Notificar')}</div>
            </div>

            <div className="hidden sm:flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                    {renderTabs()}
                    {renderFiltroStatus()}
                </div>
                {renderActions()}
            </div>

            {showWeekTabs && (
                <div className="hidden sm:block">
                    {renderWeekBox()}
                </div>
            )}

            {mobileFiltersOpen && (
                <div className="fixed inset-0 z-[180] bg-black/40 sm:hidden" onClick={() => setMobileFiltersOpen(false)}>
                    <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <div className="text-sm font-black text-gray-900">Filtros</div>
                                <div className="text-[10px] font-bold uppercase text-gray-400">{selectedCount} semanas selecionadas</div>
                            </div>
                            <button type="button" onClick={() => setMobileFiltersOpen(false)} className="rounded-xl border border-gray-200 p-2 text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {renderFiltroStatus()}
                            {renderActions(true)}
                            {showWeekTabs && renderWeekBox(true)}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE SELEÇÃO DE CALENDÁRIO GOOGLE */}
            {modalCalendario && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm no-print text-left">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <CalendarDays size={18} /> {t.agendaChoose}
                            </h3>
                            <button onClick={() => !enviando && setModalCalendario(false)} className="hover:text-indigo-200"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-gray-500">
                                {t.agendaChooseDescription}
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
                                            {cal.nome} {cal.principal ? `(${t.agendaPrimary})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                                <button onClick={() => setModalCalendario(false)} disabled={enviando} className="px-4 py-2 text-xs font-bold text-gray-400 hover:bg-gray-100 rounded-xl transition">
                                    {t.agendaCancel}
                                </button>
                                <button onClick={handleConfirmar} disabled={enviando} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95">
                                    {enviando ? <Loader2 className="animate-spin" size={14} /> : null}
                                    {enviando ? t.agendaSendingEvents : t.agendaConfirmSave}
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
