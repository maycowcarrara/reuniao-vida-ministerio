import React, { useEffect, useRef, useState } from 'react';
import { Globe, X } from 'lucide-react';

// Componentes
import Dashboard from './components/Dashboard';
import Importador from './components/Importador';
import Designar from './components/Designar';
import ListaAlunos from './components/ListaAlunos';
import RevisarEnviar from './components/RevisarEnviar';
import Configuracoes from './components/Configuracoes';
import Login from './components/Login';
import Sidebar from './components/Sidebar';

// Hooks e Serviços
import { useGerenciadorDados } from './hooks/useGerenciadorDados';
import { auth } from './services/firebase';
import { CARGOS_MAP, TRANSLATIONS } from './data/constants';

function App() {
  const {
    dados: dadosNuvem,
    loading,
    usuario,
    salvarItem,
    excluirItem,
    importarBackupParaUsuario,
    resetarConta
  } = useGerenciadorDados();

  const [dadosSistema, setDadosSistema] = useState(dadosNuvem);
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dupModal, setDupModal] = useState({ open: false, existing: null, incoming: null, resolve: null });

  const fileInputRef = useRef(null);

  // --- Sincronização Inicial ---
  useEffect(() => {
    if (dadosNuvem) {
      setDadosSistema(dadosNuvem);
    }
  }, [dadosNuvem]);

  // --- Helpers de Idioma e Dados ---
  const normalizarIdioma = (idioma) => {
    const v = (idioma || '').toString().trim().toLowerCase();
    if (v.startsWith('pt')) return 'pt';
    if (v.startsWith('es')) return 'es';
    return 'pt';
  };

  const lang = normalizarIdioma(dadosSistema?.configuracoes?.idioma);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;
  const listaProgramacoes = Array.isArray(dadosSistema?.historico_reunioes) ? dadosSistema.historico_reunioes : [];

  // --- Funções de Salvamento ---
  const salvarAlteracao = (novosDados) => {
    setDadosSistema(novosDados);

    if (novosDados.configuracoes) salvarItem('configuracoes', 'geral', novosDados.configuracoes);

    if (Array.isArray(novosDados.alunos)) {
      novosDados.alunos.forEach(a => {
        if (a.id) salvarItem('alunos', a.id, a);
      });
    }

    if (Array.isArray(novosDados.historico_reunioes)) {
      novosDados.historico_reunioes.forEach(p => {
        const semanaStr = String(p.semana || '').trim();
        if (semanaStr) {
          const idSeguro = semanaStr.replace(/[\/\s,.]/g, '-');
          salvarItem('programacao', idSeguro, p);
        }
      });
    }
  };

  const setListaProgramacoes = (updater) => {
    const current = listaProgramacoes;
    const nextRaw = typeof updater === 'function' ? updater(current) : (Array.isArray(updater) ? updater : []);
    const next = nextRaw.filter(Boolean).map(p => ({ ...p, semana: (p.semana || '').toString().trim() }));
    salvarAlteracao({ ...dadosSistema, historico_reunioes: next });
  };

  // --- Lógica de Backup ---
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
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

  // --- Lógica de Duplicação e Importação ---
  const upsertProgramacaoComConfirmacao = async (novaProg) => {
    // 1. Normalizar dados básicos
    let nextProg = { ...novaProg, semana: (novaProg.semana || '').trim() };

    // 2. Verificar se existe EVENTO ESPECIAL agendado para esta semana
    const eventosAgendados = dadosSistema?.configuracoes?.eventosAnuais || [];
    const eventoNestaData = eventosAgendados.find(ev => ev.dataInicio === nextProg.dataInicio);

    if (eventoNestaData) {
      // APLICAR REGRA AUTOMATICAMENTE NA IMPORTAÇÃO
      console.log("Aplicando regra de evento agendado:", eventoNestaData.tipo);
      nextProg.evento = eventoNestaData.tipo;
      nextProg.dataEventoEspecial = eventoNestaData.dataInput;

      if (eventoNestaData.tipo === 'visita') {
        const dataBase = new Date(nextProg.dataInicio + 'T12:00:00');
        dataBase.setDate(dataBase.getDate() + 1); // Terça
        nextProg.dataReuniao = dataBase.toISOString().split('T')[0];
      } else if (eventoNestaData.tipo === 'normal') {
        nextProg.dataReuniao = nextProg.dataInicio;
      } else {
        // Assembleias/Congressos mantêm data base para ordenação
        nextProg.dataReuniao = nextProg.dataInicio;
      }
    }

    // 3. Lógica de conflito existente
    const keyNova = nextProg.semana.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const idxAtual = listaProgramacoes.findIndex(p =>
      (p.semana || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === keyNova
    );

    if (idxAtual === -1) {
      setListaProgramacoes(prev => [...prev, nextProg]);
      return;
    }

    const choice = await new Promise(resolve => setDupModal({ open: true, existing: listaProgramacoes[idxAtual], incoming: nextProg, resolve }));
    setDupModal({ open: false, existing: null, incoming: null, resolve: null });

    if (choice === 'replace') {
      setListaProgramacoes(prev => {
        const out = [...prev];
        out[idxAtual] = { ...out[idxAtual], ...nextProg };
        return out;
      });
    } else if (choice === 'duplicate') {
      setListaProgramacoes(prev => [...prev, { ...nextProg, semana: `${nextProg.semana} (cópia)` }]);
    }
  };

  // --- NOVA LÓGICA DE EVENTOS (AGORA PERSISTENTE) ---
  const handleDefinirEvento = (dataInput, tipoEvento) => {
    if (!dataInput) return;

    // 1. Calcular a Segunda-feira
    const dataAlvo = new Date(dataInput + 'T12:00:00');
    const diaSemana = dataAlvo.getDay();
    const diffParaSegunda = dataAlvo.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const dataSegunda = new Date(dataAlvo.setDate(diffParaSegunda));
    const stringSegunda = dataSegunda.toISOString().split('T')[0];

    // 2. SALVAR NAS CONFIGURAÇÕES (O "Calendário Anual")
    const novosEventos = [...(dadosSistema?.configuracoes?.eventosAnuais || [])];

    // Remove evento anterior dessa semana (se houver) e adiciona o novo
    const listaLimpa = novosEventos.filter(ev => ev.dataInicio !== stringSegunda);

    if (tipoEvento !== 'normal') {
      listaLimpa.push({
        dataInicio: stringSegunda,
        dataInput: dataInput, // Data exata (ex: sábado da assembleia)
        tipo: tipoEvento
      });
    }

    // Atualiza Configurações primeiro
    const configAtualizada = { ...dadosSistema.configuracoes, eventosAnuais: listaLimpa };

    // 3. SE A SEMANA JÁ EXISTIR, ATUALIZA ELA TAMBÉM
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

    // Salva tudo de uma vez
    salvarAlteracao({
      ...dadosSistema,
      configuracoes: configAtualizada,
      historico_reunioes: novasProgramacoes
    });

    alert("✅ Evento agendado! Será aplicado nas semanas existentes e futuras importações.");
  };

  //EXCLUIR SEMANA
  const handleExcluirSemanaBanco = async (id) => {
    // 'programacao' é o nome da coleção no Firebase definida no seu hook
    await excluirItem('programacao', id);
  };

  // Excluir Aluno (Para passar ao componente ListaAlunos)
  const handleExcluirAlunoBanco = async (id) => {
    await excluirItem('alunos', id);
  };

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
        t={t}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-gray-50 h-screen overflow-hidden relative">
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
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {dadosSistema?.configuracoes?.nome_cong || 'Minha Congregação'}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          {abaAtiva === 'dashboard' && (
            <Dashboard
              listaProgramacoes={listaProgramacoes}
              alunos={dadosSistema?.alunos || []}
              config={dadosSistema?.configuracoes}
              setAbaAtiva={setAbaAtiva}
              onDefinirEvento={handleDefinirEvento}
              t={t}
            />
          )}

          {abaAtiva === 'importar' && (
            <Importador
              onImportComplete={async (d) => {
                await upsertProgramacaoComConfirmacao(d);
                setAbaAtiva('designar');
              }}
              idioma={lang}
            />
          )}

          {abaAtiva === 'designar' && (
            <Designar
              listaProgramacoes={listaProgramacoes}
              setListaProgramacoes={setListaProgramacoes}
              alunos={dadosSistema?.alunos || []}
              cargosMap={CARGOS_MAP}
              lang={lang}
              t={t}
              onExcluirSemana={handleExcluirSemanaBanco}
            />
          )}

          {abaAtiva === 'revisar' && (
            <RevisarEnviar
              historico={listaProgramacoes}
              alunos={dadosSistema?.alunos || []}
              config={dadosSistema?.configuracoes}
              onAlunosChange={(novosAlunos) => salvarAlteracao({ ...dadosSistema, alunos: novosAlunos })}
            />
          )}

          {abaAtiva === 'alunos' && (
            <ListaAlunos
              alunos={dadosSistema?.alunos || []}
              setAlunos={(n) => salvarAlteracao({ ...dadosSistema, alunos: n })}
              config={dadosSistema?.configuracoes}
              cargosMap={CARGOS_MAP}
              onExcluirAluno={handleExcluirAlunoBanco}
            />
          )}

          {abaAtiva === 'configuracoes' && (
            <Configuracoes
              dados={dadosSistema}
              salvarAlteracao={salvarAlteracao}
              t={t}
              lang={lang}
              importarBackup={importarBackupParaUsuario}
              resetarConta={resetarConta}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;