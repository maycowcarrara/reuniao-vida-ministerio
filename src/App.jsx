import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Globe, X, Minimize, WifiOff, Menu, LayoutDashboard, Send } from 'lucide-react';

// Firebase Auth
import { onAuthStateChanged } from 'firebase/auth';

import Sidebar from './components/Sidebar';
import NotificationBell from './components/NotificationBell';

// Hooks e Serviços
import { useGerenciadorDados } from './hooks/useGerenciadorDados';
import { useQuadroPublico } from './hooks/useQuadroPublico';
import { auth } from './services/firebase';
import { CARGOS_MAP, TRANSLATIONS } from './data/constants';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { toast } from './utils/toast';
import { getMeetingDateISOFromSemana, getWeekStartISOFromSemana } from './utils/revisarEnviar/dates';
import { getSemanaStartISO } from './utils/eventos';
import { normalizeLanguage, syncDocumentLanguage } from './config/appConfig';
import { getSectionMessages, I18nProvider } from './i18n';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Importador = lazy(() => import('./components/Importador'));
const Designar = lazy(() => import('./components/Designar'));
const ListaAlunos = lazy(() => import('./components/ListaAlunos'));
const RevisarEnviar = lazy(() => import('./components/RevisarEnviar'));
const Configuracoes = lazy(() => import('./components/Configuracoes'));
const Login = lazy(() => import('./components/Login'));
const QuadroPublico = lazy(() => import('./components/QuadroPublico'));
const ConfirmacaoPublica = lazy(() => import('./components/ConfirmacaoPublica'));

function RouteLoading({ text = 'Carregando...' }) {
  return (
    <div className="h-full min-h-[16rem] flex items-center justify-center font-bold text-slate-500">
      {text}
    </div>
  );
}

// ============================================================================
// 1. ADMIN PANEL (Seu Sistema de Gerenciamento)
// ============================================================================
function AdminPanel() {
  // 🔥 FUNÇÃO excluirSemanaELimparHistorico ADICIONADA AQUI:
  const {
    dados: dadosNuvem,
    confirmacoes,
    notificacoes,
    loading,
    usuario,
    salvarItem,
    excluirItem,
    excluirSemanaELimparHistorico,
    importarBackupParaUsuario,
    resetarConta,
    marcarNotificacaoComoLida,
    marcarTodasNotificacoesComoLidas
  } = useGerenciadorDados();
  const dadosSistema = dadosNuvem;
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [sharedWeekSelection, setSharedWeekSelection] = useState({});
  const [reviewShortcutRequest, setReviewShortcutRequest] = useState(null);
  const [dupModal, setDupModal] = useState({ open: false, existing: null, incoming: null, resolve: null });

  const fileInputRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (isFull) setSidebarOpen(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err.message));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const lang = normalizeLanguage(dadosSistema?.configuracoes?.idioma);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;
  const APP_TEXTS = getSectionMessages('adminPanel', lang);

  useEffect(() => {
    syncDocumentLanguage(lang);
  }, [lang]);

  const listaProgramacoes = Array.isArray(dadosSistema?.historico_reunioes) ? dadosSistema.historico_reunioes : [];
  const unreadNotificationsCount = (notificacoes || []).filter((item) => !item?.readAt && !item?.readAtIso).length;

  const salvarAlteracao = async (novosDados) => {
    const operacoes = [];

    if (novosDados.configuracoes) {
      operacoes.push(salvarItem('configuracoes', 'geral', novosDados.configuracoes));
    }

    if (Array.isArray(novosDados.alunos)) {
      novosDados.alunos.forEach(a => {
        if (a?.id != null && String(a.id).trim() !== '') {
          operacoes.push(salvarItem('alunos', a.id, a));
        }
      });
    }

    if (Array.isArray(novosDados.historico_reunioes)) {
      novosDados.historico_reunioes.forEach(p => {
        const semanaStr = String(p.semana || '').trim();
        if (semanaStr) operacoes.push(salvarItem('programacao', semanaStr.replace(/[/\s,.]/g, '-'), p));
      });
    }

    await Promise.all(operacoes);
  };

  const setListaProgramacoes = (updater) => {
    const current = listaProgramacoes;
    const nextRaw = typeof updater === 'function' ? updater(current) : (Array.isArray(updater) ? updater : []);
    const next = nextRaw.filter(Boolean).map(p => ({ ...p, semana: (p.semana || '').toString().trim() }));
    salvarAlteracao({ ...dadosSistema, historico_reunioes: next });
  };

  const getWeekSelectionKey = (sem, idx = 0) =>
    (sem?.id ?? sem?.dataReuniao ?? sem?.dataInicio ?? sem?.dataExata ?? sem?.data ?? sem?.semana ?? String(idx)).toString();

  const handleAbrirNotificacoesSemana = (semana) => {
    const key = getWeekSelectionKey(semana);
    if (!key) return;

    setSharedWeekSelection({ [key]: true });
    setReviewShortcutRequest({ tab: 'notificar', token: Date.now() });
    setAbaAtiva('revisar');
  };

  const handleAbrirBackup = async () => {
    try {
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({ types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
        const file = await handle.getFile();
        const content = await file.text();
        await importarBackupParaUsuario(JSON.parse(content));
        toast.success(APP_TEXTS.backupOk);
        return;
      }
      if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); }
    } catch (e) { if (e.name !== 'AbortError') console.error(e); }
  };

  const handleFileInputChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      await importarBackupParaUsuario(JSON.parse(content));
      toast.success(APP_TEXTS.backupOk);
    } catch (error) {
      toast.error(error, APP_TEXTS.backupInvalido);
    }
  };

  const handleSalvarBackup = async () => {
    try {
      const jsonText = JSON.stringify(dadosSistema, null, 2);
      const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
        const writable = await handle.createWritable();
        await writable.write(jsonText);
        await writable.close();
        toast.success(APP_TEXTS.backupSalvo);
        return;
      }
      const url = URL.createObjectURL(new Blob([jsonText], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      toast.success(APP_TEXTS.backupSalvo);
    } catch (e) {
      if (e.name !== 'AbortError') toast.error(e, APP_TEXTS.backupErroSalvar);
    }
  };

  const handleResetarTudo = async () => {
    if (!window.confirm(APP_TEXTS.alertaReset1)) return;
    if (!window.confirm(APP_TEXTS.alertaReset2)) return;
    try {
      await resetarConta();
      toast.success(APP_TEXTS.bancoLimpo);
    } catch (error) {
      toast.error(error, APP_TEXTS.erroLimpar);
    }
  };

  const upsertProgramacaoComConfirmacao = async (novaProg) => {
    let nextProg = { ...novaProg, semana: (novaProg.semana || '').trim() };
    if (!nextProg.dataInicio) {
      nextProg.dataInicio = getWeekStartISOFromSemana({
        semanaStr: nextProg.semana,
        config: dadosSistema?.configuracoes,
        isoFallback: nextProg.dataExata || nextProg.dataReuniao || null,
        textSources: [nextProg.semana]
      });
    }

    if (!nextProg.dataExata) {
      const dataReuniaoPadrao = getMeetingDateISOFromSemana({
        semanaStr: nextProg.semana,
        config: dadosSistema?.configuracoes,
        isoFallback: nextProg.dataInicio || nextProg.dataReuniao || null,
        textSources: [nextProg.semana]
      });

      if (dataReuniaoPadrao) {
        nextProg.dataExata = dataReuniaoPadrao;
        if (!nextProg.dataReuniao) nextProg.dataReuniao = dataReuniaoPadrao;
      }
    }

    const eventosAgendados = dadosSistema?.configuracoes?.eventosAnuais || [];
    const eventoNestaData = eventosAgendados.find(ev => ev.dataInicio === nextProg.dataInicio);

    if (eventoNestaData) {
      nextProg.evento = eventoNestaData.tipo;
      nextProg.dataEventoEspecial = eventoNestaData.dataInput;
      if (eventoNestaData.tipo === 'visita') {
        const dataBase = new Date(nextProg.dataInicio + 'T12:00:00');
        dataBase.setDate(dataBase.getDate() + 1);
        nextProg.dataReuniao = dataBase.toISOString().split('T')[0];
      } else {
        nextProg.dataReuniao = nextProg.dataInicio;
      }
    }

    const keyNova = nextProg.semana.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const idxAtual = listaProgramacoes.findIndex(p => (p.semana || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === keyNova);

    if (idxAtual === -1) { setListaProgramacoes(prev => [...prev, nextProg]); return; }

    const choice = await new Promise(resolve => setDupModal({ open: true, existing: listaProgramacoes[idxAtual], incoming: nextProg, resolve }));
    setDupModal({ open: false, existing: null, incoming: null, resolve: null });

    if (choice === 'replace') {
      setListaProgramacoes(prev => { const out = [...prev]; out[idxAtual] = { ...out[idxAtual], ...nextProg }; return out; });
    } else if (choice === 'duplicate') {
      setListaProgramacoes(prev => [...prev, { ...nextProg, semana: `${nextProg.semana} (cópia)` }]);
    }
  };

  const handleDefinirEvento = (dataInput, tipoEvento) => {
    if (!dataInput) return;
    const dataAlvo = new Date(dataInput + 'T12:00:00');
    const diaSemana = dataAlvo.getDay();
    const diffParaSegunda = dataAlvo.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const dataSegunda = new Date(dataAlvo.setDate(diffParaSegunda));
    const stringSegunda = dataSegunda.toISOString().split('T')[0];

    const novosEventos = [...(dadosSistema?.configuracoes?.eventosAnuais || [])];
    const listaLimpa = novosEventos.filter(ev => ev.dataInicio !== stringSegunda);

    if (tipoEvento !== 'normal') listaLimpa.push({ dataInicio: stringSegunda, dataInput: dataInput, tipo: tipoEvento });

    const configAtualizada = { ...dadosSistema.configuracoes, eventosAnuais: listaLimpa };
    const idx = listaProgramacoes.findIndex(s => getSemanaStartISO(s, dadosSistema?.configuracoes) === stringSegunda);
    let novasProgramacoes = [...listaProgramacoes];

    if (idx !== -1) {
      const semana = { ...novasProgramacoes[idx] };
      semana.evento = tipoEvento;
      semana.dataEventoEspecial = dataInput;
      if (tipoEvento === 'visita') {
        const dataBase = new Date(stringSegunda + 'T12:00:00');
        dataBase.setDate(dataBase.getDate() + 1);
        semana.dataReuniao = dataBase.toISOString().split('T')[0];
      } else {
        semana.dataReuniao = semana.dataInicio;
      }
      novasProgramacoes[idx] = semana;
    }

    salvarAlteracao({ ...dadosSistema, configuracoes: configAtualizada, historico_reunioes: novasProgramacoes });
    toast.success(APP_TEXTS.eventoOk);
  };

  // 🔥 HANDLER ATUALIZADO: Agora recebe a data da semana e repassa para a função de limpar o histórico
  const handleExcluirSemanaBanco = async (id, dataDaSemana) => {
    await excluirSemanaELimparHistorico(id, dataDaSemana);
  };

  const handleExcluirAlunoBanco = async (id) => await excluirItem('alunos', id);

  if (loading) {
    return (
      <I18nProvider lang={lang}>
        <div className="h-screen flex items-center justify-center font-bold text-slate-500">{APP_TEXTS.carregando}</div>
      </I18nProvider>
    );
  }
  if (!usuario) {
    return (
      <I18nProvider lang={lang}>
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-bold text-slate-500">{APP_TEXTS.carregando}</div>}>
          <Login />
        </Suspense>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider lang={lang}>
      {/* AS CLASSES DE IMPRESSÃO FORAM ADICIONADAS NESTA DIV (print:block print:h-auto print:overflow-visible) */}
      <div id="app-root" className="flex h-screen w-full bg-gray-100 font-sans text-gray-900 overflow-hidden relative print:block print:h-auto print:overflow-visible">
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileInputChange} />

      {dupModal.open && (
        <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">{APP_TEXTS.dupTitulo}</h3>
              <button onClick={() => dupModal.resolve('cancel')} className="text-slate-400 hover:text-slate-800"><X size={20} /></button>
            </div>
            <p className="text-slate-600">{APP_TEXTS.dupDesc}</p>
            <div className="grid grid-cols-3 gap-2">
              <button className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl transition-colors font-bold" onClick={() => dupModal.resolve('replace')}>{APP_TEXTS.btnSubstituir}</button>
              <button className="bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-xl transition-colors font-bold" onClick={() => dupModal.resolve('duplicate')}>{APP_TEXTS.btnDuplicar}</button>
              <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl transition-colors font-bold" onClick={() => dupModal.resolve('cancel')}>{APP_TEXTS.btnCancelar}</button>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && (
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          abaAtiva={abaAtiva}
          setAbaAtiva={setAbaAtiva}
          usuario={usuario}
          handleAbrirBackup={handleAbrirBackup}
          handleSalvarBackup={handleSalvarBackup}
          handleResetarTudo={handleResetarTudo}
          logout={() => auth.signOut()}
          listaProgramacoes={listaProgramacoes}
          alunos={dadosSistema?.alunos || []}
          t={t}
          lang={lang}
          toggleFullscreen={toggleFullscreen}
        />
      )}

      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 z-[9999] shadow-md transition-all">
          <WifiOff size={16} />
          <span>{APP_TEXTS.offlineAviso}</span>
        </div>
      )}

      {/* AS CLASSES DE IMPRESSÃO TAMBÉM FORAM ADICIONADAS AQUI NO MAIN */}
      <main className={`flex-1 flex flex-col min-w-0 bg-slate-50 h-screen overflow-hidden relative print:block print:h-auto print:overflow-visible ${isFullscreen ? 'fullscreen-active' : ''}`}>

        {!isFullscreen && (
          // NO-PRINT ADICIONADO AQUI PARA ESCONDER O HEADER
          <header className="relative bg-white shadow-sm px-3 sm:px-4 md:px-6 py-2 md:h-14 border-b shrink-0 z-[120] no-print">

            <div className="flex items-center justify-between gap-3 md:gap-4">
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <h2 className="text-base md:text-lg font-bold text-slate-800 capitalize truncate max-w-[160px] sm:max-w-none">
                  {abaAtiva === 'dashboard' ? t.inicio : (t[abaAtiva] || abaAtiva)}
                </h2>

                <div className="hidden sm:flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  <Globe size={12} className="text-blue-600" />
                  <span className="text-[10px] font-black uppercase text-blue-800">{lang}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-4 shrink-0">

                <div className="md:hidden flex items-center gap-1.5">
                  <button
                    type="button"
                    title={t.designar}
                    aria-label={t.designar}
                    onClick={() => setAbaAtiva('designar')}
                    className={`flex items-center justify-center p-2 rounded-xl border transition-colors ${abaAtiva === 'designar'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <LayoutDashboard size={18} />
                  </button>

                  <button
                    type="button"
                    title={t.revisar}
                    aria-label={t.revisar}
                    onClick={() => setAbaAtiva('revisar')}
                    className={`flex items-center justify-center p-2 rounded-xl border transition-colors ${abaAtiva === 'revisar'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <Send size={18} />
                  </button>

                  <Link
                    to="/quadro"
                    title={APP_TEXTS.verQuadro}
                    aria-label={APP_TEXTS.verQuadro}
                    className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <Globe size={18} />
                  </Link>
                </div>

                <div className="md:hidden h-7 w-px bg-slate-200 mx-0.5" />

                <Link
                  to="/quadro"
                  title={APP_TEXTS.verQuadro}
                  className="hidden sm:flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  <Globe size={18} />
                  <span className="hidden sm:block text-xs font-bold">{APP_TEXTS.verQuadro}</span>
                </Link>

                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">
                  {dadosSistema?.configuracoes?.nome_cong || APP_TEXTS.minhaCong}
                </div>

                <NotificationBell
                  notifications={notificacoes}
                  unreadCount={unreadNotificationsCount}
                  onMarkOne={marcarNotificacaoComoLida}
                  onMarkAll={marcarTodasNotificacoesComoLidas}
                />

                <button
                  className="md:hidden p-1.5 -mr-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu size={24} />
                </button>
              </div>
            </div>
          </header>
        )}

        {isFullscreen && (
          <button onClick={toggleFullscreen} className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-800 text-white px-4 py-3 rounded-full shadow-2xl hover:bg-slate-700 transition-all opacity-50 hover:opacity-100 no-print">
            <Minimize size={20} /> <span className="text-sm font-medium">{APP_TEXTS.sairTelaCheia}</span>
          </button>
        )}

        {/* PRINT:OVERFLOW-VISIBLE AQUI PARA DEIXAR O CONTEÚDO ROLAR LIVREMENTE */}
        <div className="flex-1 overflow-y-auto scroll-smooth print:overflow-visible">
          <Suspense fallback={<RouteLoading text={APP_TEXTS.carregando} />}>
            {abaAtiva === 'dashboard' && <Dashboard listaProgramacoes={listaProgramacoes} alunos={dadosSistema?.alunos || []} config={dadosSistema?.configuracoes} setAbaAtiva={setAbaAtiva} onDefinirEvento={handleDefinirEvento} t={t} confirmacoes={confirmacoes} onAbrirNotificacoesSemana={handleAbrirNotificacoesSemana} />}
            {abaAtiva === 'importar' && <Importador onImportComplete={async (d) => { await upsertProgramacaoComConfirmacao(d); setAbaAtiva('designar'); }} idioma={lang} />}

            {abaAtiva === 'designar' && (
              <Designar
                listaProgramacoes={listaProgramacoes}
                setListaProgramacoes={setListaProgramacoes}
                alunos={dadosSistema?.alunos || []}
                onAlunosChange={(novosAlunos) => salvarAlteracao({ ...dadosSistema, alunos: novosAlunos })}
                cargosMap={CARGOS_MAP}
                lang={lang}
                t={t}
                config={dadosSistema?.configuracoes}
                onExcluirSemana={handleExcluirSemanaBanco}
                sharedWeekSelection={sharedWeekSelection}
                setSharedWeekSelection={setSharedWeekSelection}
              />
            )}

            {abaAtiva === 'revisar' && (
              <RevisarEnviar
                historico={listaProgramacoes}
                alunos={dadosSistema?.alunos || []}
                config={dadosSistema?.configuracoes}
                confirmacoes={confirmacoes}
                onAlunosChange={(novosAlunos) => salvarAlteracao({ ...dadosSistema, alunos: novosAlunos })}
                sharedWeekSelection={sharedWeekSelection}
                setSharedWeekSelection={setSharedWeekSelection}
                reviewShortcutRequest={reviewShortcutRequest}
              />
            )}
            {abaAtiva === 'alunos' && <ListaAlunos alunos={dadosSistema?.alunos || []} setAlunos={(n) => salvarAlteracao({ ...dadosSistema, alunos: n })} config={dadosSistema?.configuracoes} cargosMap={CARGOS_MAP} onExcluirAluno={handleExcluirAlunoBanco} />}
            {abaAtiva === 'configuracoes' && <Configuracoes dados={dadosSistema} salvarAlteracao={salvarAlteracao} t={t} lang={lang} importarBackup={importarBackupParaUsuario} resetarConta={resetarConta} />}
          </Suspense>
        </div>
      </main>
      </div>
    </I18nProvider>
  );
}

// ============================================================================
// 2. WRAPPER DO QUADRO PÚBLICO
// ============================================================================
function QuadroPublicoWrapper({ usuario }) {
  const { dados, loading } = useQuadroPublico();

  // Ajusta idioma do loading dinamicamente
  const lang = normalizeLanguage(dados?.configuracoes?.idioma);
  const loadingText = getSectionMessages('adminPanel', lang).loadingQuadro;

  if (loading) {
    return (
      <I18nProvider lang={lang}>
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 font-sans">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="font-bold text-sm tracking-wider uppercase">{loadingText}</p>
        </div>
      </I18nProvider>
    );
  }
  const programacoes = Array.isArray(dados?.historico_reunioes) ? dados.historico_reunioes : [];
  const config = dados?.configuracoes || {};
  return (
    <I18nProvider lang={lang}>
      <Suspense fallback={
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 font-sans">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="font-bold text-sm tracking-wider uppercase">{loadingText}</p>
        </div>
      }>
        <QuadroPublico programacoes={programacoes} config={config} usuario={usuario} />
      </Suspense>
    </I18nProvider>
  );
}

// ============================================================================
// 3. APLICATIVO PRINCIPAL (ROTEADOR INTELIGENTE)
// ============================================================================
function App() {
  const [usuarioVerificado, setUsuarioVerificado] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuarioVerificado(user);
    });
    return unsubscribe;
  }, []);

  if (usuarioVerificado === undefined) {
    return <div className="h-screen bg-slate-50"></div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          usuarioVerificado ? <Navigate to="/admin" replace /> : <Navigate to="/quadro" replace />
        } />
        <Route path="/quadro" element={<QuadroPublicoWrapper usuario={usuarioVerificado} />} />
        <Route path="/c/:token" element={
          <Suspense fallback={<RouteLoading text="Carregando confirmação..." />}>
            <ConfirmacaoPublica />
          </Suspense>
        } />
        <Route path="/admin/*" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
