import React, { useEffect, useRef, useState } from 'react';
import Importador from './components/Importador';
import Designar from './components/Designar';
import ListaAlunos from './components/ListaAlunos';
import RevisarEnviar from './components/RevisarEnviar';
import { CARGOS_MAP, TRANSLATIONS } from './data/constants';

import {
  Calendar,
  Users,
  LayoutDashboard,
  Send,
  Database,
  Settings,
  ChevronLeft,
  Globe,
  FileUp,
  FileDown,
  X
} from 'lucide-react';

function App() {
  const DB_KEY = 'jw_sistema_v3';

  const [abaAtiva, setAbaAtiva] = useState('designar');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fileInputRef = useRef(null);

  const DEFAULT_CONFIG = {
    idioma: 'pt',
    nome_cong: '',
    dia_reuniao: 'Segunda-feira',
    horario: '19:30'
  };

  const criarSistemaVazio = () => ({
    configuracoes: { ...DEFAULT_CONFIG },
    alunos: [],
    historico_reunioes: []
  });

  const normalizarSistema = (obj) => {
    const base = obj && typeof obj === 'object' ? obj : criarSistemaVazio();

    // remove duplicadas (campo legado)
    // eslint-disable-next-line no-unused-vars
    const { historicoreunioes, ...rest } = base;

    const hist =
      Array.isArray(rest?.historico_reunioes) ? rest.historico_reunioes :
        Array.isArray(base?.historicoreunioes) ? base.historicoreunioes :
          [];

    return {
      ...criarSistemaVazio(),
      ...rest,
      configuracoes: { ...DEFAULT_CONFIG, ...(rest.configuracoes || {}) },
      alunos: Array.isArray(rest.alunos) ? rest.alunos : [],
      historico_reunioes: hist
    };
  };

  const [dadosSistema, setDadosSistema] = useState(() => {
    // ✅ NÃO carrega banco_de_dados.json; só localStorage (se existir) ou vazio
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(DB_KEY));
    } catch (e) { }

    let base = data && typeof data === 'object' ? data : criarSistemaVazio();

    // migração: se existir jw_prog_v3 antigo e ainda não há historico_reunioes, importa
    try {
      const oldProgRaw = localStorage.getItem('jw_prog_v3');
      const oldProg = oldProgRaw ? JSON.parse(oldProgRaw) : null;
      const hasHistory = Array.isArray(base?.historico_reunioes) || Array.isArray(base?.historicoreunioes);

      if (!hasHistory && Array.isArray(oldProg) && oldProg.length > 0) {
        base = {
          ...base,
          historico_reunioes: oldProg
        };
      }
    } catch (e) { }

    return normalizarSistema(base);
  });

  // Persistência única (já limpando duplicadas)
  useEffect(() => {
    try {
      // eslint-disable-next-line no-unused-vars
      const { historicoreunioes, ...clean } = dadosSistema;
      localStorage.setItem(DB_KEY, JSON.stringify(clean));
    } catch (e) {
      // Falha silenciosa aqui pode ser ok (modo privado/quota), mas ao menos loga
      // para facilitar debug.
      // eslint-disable-next-line no-console
      console.warn('Falha ao salvar no localStorage:', e);
    }
  }, [dadosSistema]);

  // limpeza do legado (depois de migrar)
  useEffect(() => {
    try {
      localStorage.removeItem('jw_prog_v3');
    } catch (e) { }
  }, []);

  const normalizarIdioma = (idioma) => {
    const v = (idioma || '').toString().trim().toLowerCase();
    if (v.startsWith('pt')) return 'pt';
    if (v.startsWith('es')) return 'es';
    return 'pt';
  };

  const lang = normalizarIdioma(dadosSistema.configuracoes?.idioma);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;

  // ✅ ÚNICA fonte: dadosSistema.historico_reunioes
  const listaProgramacoes = Array.isArray(dadosSistema?.historico_reunioes)
    ? dadosSistema.historico_reunioes
    : [];

  // ---------- Helpers (UX / feedback) ----------
  const notifyOk = (msg) => {
    try { window.alert(msg); } catch (e) { }
  };
  const notifyWarn = (msg) => {
    try { window.alert(msg); } catch (e) { }
  };

  const isAbortError = (err) => {
    const name = err?.name || err?.constructor?.name || '';
    return name === 'AbortError';
  };

  // ---------- Helpers (normalização) ----------
  const normalizarTexto = (s) =>
    (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const normalizarSemana = (semana) => {
    const s = (semana ?? '').toString().trim();
    return s;
  };

  const normalizarListaProgramacoes = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(Boolean)
      .map((p) => {
        if (!p || typeof p !== 'object') return p;
        const semana = normalizarSemana(p.semana);
        // mantém como veio, mas garante trim
        return { ...p, semana: semana || p.semana };
      });
  };

  // ✅ Setter compatível com setState (aceita função) - sem duplicadas
  const setListaProgramacoes = (updater) => {
    setDadosSistema((prev) => {
      const current = Array.isArray(prev?.historico_reunioes) ? prev.historico_reunioes : [];
      const nextRaw = typeof updater === 'function'
        ? updater(current)
        : (Array.isArray(updater) ? updater : []);

      const next = normalizarListaProgramacoes(nextRaw);
      return { ...prev, historico_reunioes: next };
    });
  };

  // ---------- Helpers (Backup / Download) ----------
  const baixarBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const getCleanDadosSistema = () => {
    // eslint-disable-next-line no-unused-vars
    const { historicoreunioes, ...clean } = dadosSistema;
    // garante que historico esteja sempre normalizado antes de exportar
    clean.historico_reunioes = normalizarListaProgramacoes(clean.historico_reunioes);
    return clean;
  };

  // ---------- Modal (semana duplicada) ----------
  const [dupModal, setDupModal] = useState({
    open: false,
    existing: null,
    incoming: null,
    resolve: null
  });

  const abrirDupModal = (existing, incoming) =>
    new Promise((resolve) => {
      setDupModal({
        open: true,
        existing,
        incoming,
        resolve
      });
    });

  const fecharDupModal = () => {
    setDupModal({ open: false, existing: null, incoming: null, resolve: null });
  };

  const resolverDupModal = (choice) => {
    try {
      dupModal?.resolve?.(choice);
    } catch (e) { }
    fecharDupModal();
  };

  useEffect(() => {
    if (!dupModal.open) return;

    const onKey = (e) => {
      if (e.key === 'Escape') resolverDupModal('cancel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dupModal.open]);

  // ---------- Upsert com confirmação (agora via modal) ----------
  const upsertProgramacaoComConfirmacao = async (novaProg) => {
    const nextProg = novaProg && typeof novaProg === 'object' ? { ...novaProg } : null;
    if (!nextProg) return;

    nextProg.semana = normalizarSemana(nextProg.semana);

    const keyNova = normalizarTexto(nextProg?.semana);
    // sem semana? apenas adiciona
    if (!keyNova) {
      setListaProgramacoes((prev) => [...prev, nextProg]);
      return;
    }

    const idxAtual = listaProgramacoes.findIndex((p) => normalizarTexto(p?.semana) === keyNova);

    if (idxAtual === -1) {
      setListaProgramacoes((prev) => [...prev, nextProg]);
      return;
    }

    const existing = listaProgramacoes[idxAtual];
    const choice = await abrirDupModal(existing, nextProg);

    if (choice === 'replace') {
      setListaProgramacoes((prev) => {
        const idx = prev.findIndex((p) => normalizarTexto(p?.semana) === keyNova);
        if (idx === -1) return [...prev, nextProg];
        const out = [...prev];
        // mantém possíveis campos antigos que não existam no novo, mas prioriza o novo
        out[idx] = { ...out[idx], ...nextProg };
        return out;
      });
      return;
    }

    if (choice === 'duplicate') {
      setListaProgramacoes((prev) => {
        const baseSemana = (nextProg?.semana || 'Semana').toString().trim();
        const stamp = new Date().toLocaleString();
        return [...prev, { ...nextProg, semana: `${baseSemana} (cópia - ${stamp})` }];
      });
      return;
    }

    // cancel
    return;
  };

  // ---------- Backup (Abrir / Salvar) ----------
  const aplicarBackupJson = (parsed) => {
    // Aceita:
    // - NOVO: (dadosSistema direto)
    // - ANTIGO: { dadosSistema, backupVersion, backupAt }
    // - COMPAT: { ...dadosSistema, listaProgramacoes }
    const nextDadosSistema =
      parsed?.dadosSistema?.alunos ? parsed.dadosSistema :
        parsed?.alunos ? parsed :
          null;

    const nextListaProgramacoes =
      Array.isArray(parsed?.listaProgramacoes) ? parsed.listaProgramacoes :
        Array.isArray(parsed?.programacoes) ? parsed.programacoes :
          Array.isArray(parsed?.historico_reunioes) ? parsed.historico_reunioes :
            Array.isArray(parsed?.historicoreunioes) ? parsed.historicoreunioes :
              Array.isArray(parsed?.jw_prog_v3) ? parsed.jw_prog_v3 :
                null;

    if (nextDadosSistema) {
      const normal = normalizarSistema(nextDadosSistema);

      // se o backup antigo veio com listaProgramacoes separada, injeta no campo único
      if (Array.isArray(nextListaProgramacoes) && nextListaProgramacoes.length > 0) {
        normal.historico_reunioes = normalizarListaProgramacoes(nextListaProgramacoes);
      } else {
        normal.historico_reunioes = normalizarListaProgramacoes(normal.historico_reunioes);
      }

      setDadosSistema(normal);
      notifyOk('✅ Backup restaurado!');
      return true;
    }

    // Se veio só as programações (backup bem antigo), injeta no sistema atual
    if (Array.isArray(nextListaProgramacoes)) {
      setListaProgramacoes(normalizarListaProgramacoes(nextListaProgramacoes));
      notifyOk('✅ Programações importadas!');
      return true;
    }

    notifyWarn('⚠️ Arquivo não reconhecido como backup do sistema.');
    return false;
  };

  const handleAbrirBackup = async () => {
    try {
      // Preferencial: File System Access API
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });

        const file = await handle.getFile();
        const content = await file.text();
        const parsed = JSON.parse(content);
        aplicarBackupJson(parsed);
        return;
      }

      // Fallback: input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    } catch (e) {
      // Cancelar picker é comum; não precisa alertar.
      if (isAbortError(e)) return;
      notifyWarn('⚠️ Não foi possível abrir o backup.');
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const handleFileInputChange = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const content = await file.text();
      const parsed = JSON.parse(content);
      aplicarBackupJson(parsed);
    } catch (err) {
      notifyWarn('⚠️ Não foi possível ler esse arquivo JSON.');
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const handleSalvarBackup = async () => {
    try {
      const clean = getCleanDadosSistema();
      const jsonText = JSON.stringify(clean, null, 2);
      const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;

      // Preferencial: File System Access API
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });

        const writable = await handle.createWritable();
        await writable.write(jsonText);
        await writable.close();

        notifyOk('✅ Backup salvo com sucesso!');
        return;
      }

      // Fallback: download por Blob
      baixarBlob(new Blob([jsonText], { type: 'application/json' }), filename);
      notifyOk('✅ Backup baixado com sucesso!');
    } catch (e) {
      if (isAbortError(e)) return;
      notifyWarn('⚠️ Não foi possível salvar o backup.');
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

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
        <span className="bg-blue-900 px-2 py-0.5 rounded-full text-[10px]">
          {badge}
        </span>
      )}
    </button>
  );

  return (

    <div id="app-root" className="flex h-screen w-full bg-gray-100 font-sans text-gray-900 overflow-hidden">
      {/* Hidden fallback input for backup open */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* MODAL - Semana duplicada */}
      {dupModal.open && (
        <div
          className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) resolverDupModal('cancel');
          }}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-blue-700 text-white flex items-center justify-between">
              <div className="font-black text-sm">Semana já existe</div>
              <button
                className="p-1 rounded hover:bg-white/10"
                onClick={() => resolverDupModal('cancel')}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                Já existe uma programação para:
              </p>

              <div className="bg-gray-50 border rounded-xl p-3">
                <div className="text-xs uppercase font-black text-gray-400 tracking-widest">Existente</div>
                <div className="text-sm font-bold text-gray-800 mt-1">
                  {dupModal.existing?.semana || '(sem título)'}
                </div>
              </div>

              <div className="bg-gray-50 border rounded-xl p-3">
                <div className="text-xs uppercase font-black text-gray-400 tracking-widest">Nova</div>
                <div className="text-sm font-bold text-gray-800 mt-1">
                  {dupModal.incoming?.semana || '(sem título)'}
                </div>
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-500 transition"
                  onClick={() => resolverDupModal('replace')}
                >
                  Substituir
                </button>

                <button
                  className="px-4 py-2 rounded-xl bg-orange-600 text-white font-black text-xs uppercase hover:bg-orange-500 transition"
                  onClick={() => resolverDupModal('duplicate')}
                >
                  Duplicar
                </button>

                <button
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-black text-xs uppercase hover:bg-gray-200 transition"
                  onClick={() => resolverDupModal('cancel')}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-jw-blue transition-all duration-300 flex flex-col z-50 shadow-xl`}>
        <div className="p-4 border-b border-blue-500/30 flex justify-between items-center h-16 text-white font-bold">
          {sidebarOpen && <span className="truncate tracking-tighter text-lg">V&M Manager</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
            title="Abrir/fechar menu"
          >
            <ChevronLeft className={!sidebarOpen ? 'rotate-180' : ''} />
          </button>
        </div>

        <nav className="flex-1 py-4">
          <SidebarButton id="importar" icon={Calendar} label={t.importar} />
          <SidebarButton id="designar" icon={LayoutDashboard} label={t.designar} badge={listaProgramacoes.length} />
          <SidebarButton id="revisar" icon={Send} label={t.revisar} />
          <SidebarButton id="alunos" icon={Users} label={t.alunos} />
          <div className="mt-4 border-t border-blue-500/30">
            <SidebarButton id="configuracoes" icon={Settings} label={t.ajustes} />
          </div>
        </nav>

        {sidebarOpen && (
          <div className="p-4 bg-blue-900/40 border-t border-blue-500/30 space-y-3">
            <div className="flex items-center gap-2 text-blue-300">
              <Database size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">{t.backup}</span>
            </div>

            <p className="text-[9px] text-blue-200 leading-tight italic">{t.infoBackup}</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleAbrirBackup}
                className="flex flex-col items-center gap-1 bg-blue-700 p-2 rounded-lg text-white hover:bg-blue-600 transition"
              >
                <FileUp size={16} />
                <span className="text-[9px] font-bold">{t.carregar}</span>
              </button>

              <button
                onClick={handleSalvarBackup}
                className="flex flex-col items-center gap-1 bg-green-700 p-2 rounded-lg text-white hover:bg-green-600 transition"
              >
                <FileDown size={16} />
                <span className="text-[9px] font-bold">{t.salvar}</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-gray-50 h-screen overflow-hidden relative">
        <header className="h-14 bg-white shadow-sm flex items-center justify-between px-6 border-b shrink-0 z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-gray-800 capitalize">{t[abaAtiva] || abaAtiva}</h2>
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              <Globe size={12} className="text-blue-600" />
              <span className="text-[10px] font-black uppercase text-blue-800">{lang}</span>
            </div>
          </div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {dadosSistema.configuracoes?.nome_cong}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
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
              alunos={dadosSistema.alunos}
              cargosMap={CARGOS_MAP}
              lang={lang}
              t={t}
            />
          )}

          {abaAtiva === 'revisar' && (
            <RevisarEnviar
              historico={listaProgramacoes}
              alunos={dadosSistema.alunos}
              config={dadosSistema.configuracoes}
              onAlunosChange={(novosAlunos) =>
                setDadosSistema((prev) => ({ ...prev, alunos: novosAlunos }))
              }
            />
          )}

          {abaAtiva === 'alunos' && (
            <ListaAlunos
              alunos={dadosSistema.alunos}
              setAlunos={(n) => setDadosSistema((prev) => ({ ...prev, alunos: n }))}
              config={dadosSistema.configuracoes}
              cargosMap={CARGOS_MAP}
            />
          )}

          {abaAtiva === 'configuracoes' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-lg mx-auto space-y-8 animate-in fade-in zoom-in duration-300">
              <h3 className="font-bold border-b pb-2 flex items-center gap-2 text-jw-blue">
                <Settings size={18} /> {t.ajustes}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Congregação
                  </label>
                  <input
                    type="text"
                    value={dadosSistema.configuracoes?.nome_cong || ''}
                    onChange={(e) =>
                      setDadosSistema((prev) => ({
                        ...prev,
                        configuracoes: { ...prev.configuracoes, nome_cong: e.target.value }
                      }))
                    }
                    className="w-full p-2.5 border rounded-lg mt-1 outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dia</label>
                    <select
                      value={dadosSistema.configuracoes?.dia_reuniao || 'Segunda-feira'}
                      onChange={(e) =>
                        setDadosSistema((prev) => ({
                          ...prev,
                          configuracoes: { ...prev.configuracoes, dia_reuniao: e.target.value }
                        }))
                      }
                      className="w-full p-2.5 border rounded-lg mt-1 bg-white outline-none"
                    >
                      {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Horário</label>
                    <input
                      type="time"
                      value={dadosSistema.configuracoes?.horario || '19:30'}
                      onChange={(e) =>
                        setDadosSistema((prev) => ({
                          ...prev,
                          configuracoes: { ...prev.configuracoes, horario: e.target.value }
                        }))
                      }
                      className="w-full p-2.5 border rounded-lg mt-1 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <label className="text-[10px] font-black text-gray-400 uppercase">Idioma Global</label>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() =>
                      setDadosSistema((prev) => ({
                        ...prev,
                        configuracoes: { ...prev.configuracoes, idioma: 'pt' }
                      }))
                    }
                    className={`flex-1 p-3 rounded-lg border font-bold ${lang === 'pt' ? 'bg-blue-600 text-white shadow-lg border-blue-600' : 'bg-gray-50'
                      }`}
                  >
                    Português
                  </button>

                  <button
                    onClick={() =>
                      setDadosSistema((prev) => ({
                        ...prev,
                        configuracoes: { ...prev.configuracoes, idioma: 'es' }
                      }))
                    }
                    className={`flex-1 p-3 rounded-lg border font-bold ${lang === 'es' ? 'bg-blue-600 text-white shadow-lg border-blue-600' : 'bg-gray-50'
                      }`}
                  >
                    Español
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>

  );
}

export default App;
