import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Globe, X, Maximize, Minimize, WifiOff, Users } from 'lucide-react';

// Firebase Auth
import { onAuthStateChanged } from 'firebase/auth';

// Componentes
import Dashboard from './components/Dashboard';
import Importador from './components/Importador';
import Designar from './components/Designar';
import ListaAlunos from './components/ListaAlunos';
import RevisarEnviar from './components/RevisarEnviar';
import Configuracoes from './components/Configuracoes';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import QuadroPublico from './components/QuadroPublico'; 

// Hooks e Serviços
import { useGerenciadorDados } from './hooks/useGerenciadorDados';
import { useQuadroPublico } from './hooks/useQuadroPublico';
import { auth } from './services/firebase';
import { CARGOS_MAP, TRANSLATIONS } from './data/constants';
import { useOnlineStatus } from './hooks/useOnlineStatus';

// ============================================================================
// 1. ADMIN PANEL (Seu Sistema de Gerenciamento)
// ============================================================================
function AdminPanel() {
  const { dados: dadosNuvem, loading, usuario, salvarItem, excluirItem, importarBackupParaUsuario, resetarConta } = useGerenciadorDados();
  const [dadosSistema, setDadosSistema] = useState(dadosNuvem);
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dupModal, setDupModal] = useState({ open: false, existing: null, incoming: null, resolve: null });

  const fileInputRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isOnline = useOnlineStatus();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err.message));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (isFull) setSidebarOpen(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => { if (dadosNuvem) setDadosSistema(dadosNuvem); }, [dadosNuvem]);

  const normalizarIdioma = (idioma) => {
    const v = (idioma || '').toString().trim().toLowerCase();
    if (v.startsWith('pt')) return 'pt';
    if (v.startsWith('es')) return 'es';
    return 'pt';
  };

  const lang = normalizarIdioma(dadosSistema?.configuracoes?.idioma);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;
  const listaProgramacoes = Array.isArray(dadosSistema?.historico_reunioes) ? dadosSistema.historico_reunioes : [];

  const salvarAlteracao = (novosDados) => {
    setDadosSistema(novosDados);
    if (novosDados.configuracoes) salvarItem('configuracoes', 'geral', novosDados.configuracoes);
    if (Array.isArray(novosDados.alunos)) novosDados.alunos.forEach(a => { if (a.id) salvarItem('alunos', a.id, a); });
    if (Array.isArray(novosDados.historico_reunioes)) {
      novosDados.historico_reunioes.forEach(p => {
        const semanaStr = String(p.semana || '').trim();
        if (semanaStr) salvarItem('programacao', semanaStr.replace(/[\/\s,.]/g, '-'), p);
      });
    }
  };

  const setListaProgramacoes = (updater) => {
    const current = listaProgramacoes;
    const nextRaw = typeof updater === 'function' ? updater(current) : (Array.isArray(updater) ? updater : []);
    const next = nextRaw.filter(Boolean).map(p => ({ ...p, semana: (p.semana || '').toString().trim() }));
    salvarAlteracao({ ...dadosSistema, historico_reunioes: next });
  };

  const handleAbrirBackup = async () => {
    try {
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({ types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
        const file = await handle.getFile();
        const content = await file.text();
        await importarBackupParaUsuario(JSON.parse(content));
        alert('✅ Backup restaurado com sucesso!');
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
      alert('✅ Backup restaurado com sucesso!');
    } catch (err) { alert('⚠️ Arquivo inválido.'); }
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
        alert('✅ Backup salvo com sucesso!');
        return;
      }
      const url = URL.createObjectURL(new Blob([jsonText], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { if (e.name !== 'AbortError') alert('⚠️ Erro ao salvar backup.'); }
  };

  const handleResetarTudo = async () => {
    if (!window.confirm("⚠️ PERIGO: Isso vai apagar TUDO.\nTem certeza?")) return;
    if (!window.confirm("⚠️ ÚLTIMA CHANCE: Clique em OK para apagar.")) return;
    try { await resetarConta(); alert("✅ Banco limpo!"); } catch (error) { alert("Erro ao limpar."); }
  };

  const upsertProgramacaoComConfirmacao = async (novaProg) => {
    let nextProg = { ...novaProg, semana: (novaProg.semana || '').trim() };
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
    const idx = listaProgramacoes.findIndex(s => s.dataInicio === stringSegunda);
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
    alert("✅ Evento agendado!");
  };

  const handleExcluirSemanaBanco = async (id) => await excluirItem('programacao', id);
  const handleExcluirAlunoBanco = async (id) => await excluirItem('alunos', id);

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  if (!usuario) return <Login />;

  return (
    <div id="app-root" className="flex h-screen w-full bg-gray-100 font-sans text-gray-900 overflow-hidden">
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileInputChange} />

      {dupModal.open && (
        <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold">Semana já existe</h3>
              <button onClick={() => dupModal.resolve('cancel')}><X size={20} /></button>
            </div>
            <p>O que deseja fazer com a semana duplicada?</p>
            <div className="grid grid-cols-3 gap-2">
              <button className="bg-blue-600 text-white p-2 rounded" onClick={() => dupModal.resolve('replace')}>Substituir</button>
              <button className="bg-orange-500 text-white p-2 rounded" onClick={() => dupModal.resolve('duplicate')}>Duplicar</button>
              <button className="bg-gray-200 p-2 rounded" onClick={() => dupModal.resolve('cancel')}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && (
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} abaAtiva={abaAtiva} setAbaAtiva={setAbaAtiva} usuario={usuario} handleAbrirBackup={handleAbrirBackup} handleSalvarBackup={handleSalvarBackup} handleResetarTudo={handleResetarTudo} logout={() => auth.signOut()} listaProgramacoes={listaProgramacoes} t={t} toggleFullscreen={toggleFullscreen} />
      )}

      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 z-[9999] shadow-md transition-all">
          <WifiOff size={16} />
          <span>Você está offline. Pode continuar editando!</span>
        </div>
      )}

      <main className={`flex-1 flex flex-col min-w-0 bg-gray-50 h-screen overflow-hidden relative ${isFullscreen ? 'fullscreen-active' : ''}`}>
        {!isFullscreen && (
          <header className="h-14 bg-white shadow-sm flex items-center justify-between px-6 border-b shrink-0 z-40">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-gray-800 capitalize">
                {abaAtiva === 'dashboard' ? t.inicio : (t[abaAtiva] || abaAtiva)}
              </h2>
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                <Globe size={12} className="text-blue-600" />
                <span className="text-[10px] font-black uppercase text-blue-800">{lang}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* NOVO BOTÃO DE ACESSO AO QUADRO PÚBLICO AQUI */}
              <a 
                href="/quadro" 
                target="_blank" 
                rel="noreferrer"
                className="hidden sm:flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 text-xs font-bold hover:bg-indigo-100 transition-colors"
              >
                <Users size={14} /> Ver Quadro Público
              </a>

              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:block">
                {dadosSistema?.configuracoes?.nome_cong || 'Minha Congregação'}
              </div>
            </div>
          </header>
        )}

        {isFullscreen && (
          <button onClick={toggleFullscreen} className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-800 text-white px-4 py-3 rounded-full shadow-2xl hover:bg-gray-700 transition-all opacity-50 hover:opacity-100 no-print">
            <Minimize size={20} /> <span className="text-sm font-medium">Sair da Tela Cheia</span>
          </button>
        )}

        <div className="flex-1 overflow-y-auto scroll-smooth">
          {abaAtiva === 'dashboard' && <Dashboard listaProgramacoes={listaProgramacoes} alunos={dadosSistema?.alunos || []} config={dadosSistema?.configuracoes} setAbaAtiva={setAbaAtiva} onDefinirEvento={handleDefinirEvento} t={t} />}
          {abaAtiva === 'importar' && <Importador onImportComplete={async (d) => { await upsertProgramacaoComConfirmacao(d); setAbaAtiva('designar'); }} idioma={lang} />}
          {abaAtiva === 'designar' && <Designar listaProgramacoes={listaProgramacoes} setListaProgramacoes={setListaProgramacoes} alunos={dadosSistema?.alunos || []} cargosMap={CARGOS_MAP} lang={lang} t={t} config={dadosSistema?.configuracoes} onExcluirSemana={handleExcluirSemanaBanco} />}
          {abaAtiva === 'revisar' && <RevisarEnviar historico={listaProgramacoes} alunos={dadosSistema?.alunos || []} config={dadosSistema?.configuracoes} onAlunosChange={(novosAlunos) => salvarAlteracao({ ...dadosSistema, alunos: novosAlunos })} />}
          {abaAtiva === 'alunos' && <ListaAlunos alunos={dadosSistema?.alunos || []} setAlunos={(n) => salvarAlteracao({ ...dadosSistema, alunos: n })} config={dadosSistema?.configuracoes} cargosMap={CARGOS_MAP} onExcluirAluno={handleExcluirAlunoBanco} />}
          {abaAtiva === 'configuracoes' && <Configuracoes dados={dadosSistema} salvarAlteracao={salvarAlteracao} t={t} lang={lang} importarBackup={importarBackupParaUsuario} resetarConta={resetarConta} />}
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// 2. WRAPPER DO QUADRO PÚBLICO
// ============================================================================
function QuadroPublicoWrapper() {
  const { dados, loading } = useQuadroPublico(); 

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        Carregando Quadro...
      </div>
    );
  }
  const programacoes = Array.isArray(dados?.historico_reunioes) ? dados.historico_reunioes : [];
  const config = dados?.configuracoes || {};
  return <QuadroPublico programacoes={programacoes} config={config} />;
}

// ============================================================================
// 3. APLICATIVO PRINCIPAL (ROTEADOR INTELIGENTE)
// ============================================================================
function App() {
  const [usuarioVerificado, setUsuarioVerificado] = useState(undefined);

  // Fica observando em background se tem alguém logado no Google
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuarioVerificado(user);
    });
    return unsubscribe;
  }, []);

  // Tela rápida enquanto o Firebase decide se tá logado
  if (usuarioVerificado === undefined) {
    return <div className="h-screen bg-slate-50"></div>; 
  }

  return (
    <BrowserRouter>
      <Routes>
        
        {/* A MÁGICA ACONTECE AQUI: O "/" decide sozinho pra onde mandar a pessoa */}
        <Route path="/" element={
          usuarioVerificado ? <Navigate to="/admin" replace /> : <Navigate to="/quadro" replace />
        } />
        
        <Route path="/quadro" element={<QuadroPublicoWrapper />} />
        <Route path="/admin/*" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;