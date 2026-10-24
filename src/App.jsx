import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { hasFimDeSemanaData, normalizeFimDeSemana } from './utils/fimDeSemana';
import {
  createProgramacaoId,
  ensureUniqueProgramacaoIds,
  findMatchingProgramacaoIndex
} from './utils/programacoes';
import { normalizeLanguage, normalizeMeetingDay, syncDocumentLanguage } from './config/appConfig';
import { getSectionMessages, I18nProvider } from './i18n';
import { resolveDataOwnerUid } from './services/adminAccess';
import { MULTI_GRUPOS_LOCAL } from './config/multiGruposLocal.js';
import { USUARIO_ENSAIO_GRUPOS } from './data/ensaioGrupos.js';
import { normalizeGruposProgramacao } from './utils/gruposProgramacao.js';
import { projetarConfigGrupo } from './utils/grupoAtivo.js';
import { createProgramacoesController, operacoesDaListaDoGrupo, patchConfiguracaoGrupo, selecionarProgramacoesGrupo } from './utils/programacoesPorGrupo.js';
import { useGrupoAtivo } from './hooks/useGrupoAtivo.js';
import { GRUPO_EDICAO_CONTEXT } from './hooks/useProtecaoTrocaGrupo.js';
import SeletorGrupo from './components/SeletorGrupo.jsx';
import ConfiguracoesGrupos from './components/ConfiguracoesGrupos.jsx';
import ReunioesIndependentes from './components/ReunioesIndependentes.jsx';
import DesignacoesGrupo from './components/Designar/DesignacoesGrupo.jsx';
import PainelGrupo from './components/PainelGrupo.jsx';
import RevisaoGrupo from './components/RevisaoGrupo.jsx';
import QuadroPorGrupo from './components/QuadroPorGrupo.jsx';
import { projetarQuadroPublico } from './utils/quadroPublico.js';
import { gruposRemotosAtivos } from './utils/compatibilidadeGrupos.js';
import { prepararImportacaoMeioSemana } from './utils/agendamentoReunioes.js';
import { destinoNotificacao } from './utils/integracoesGrupo.js';
import { prepararEventoGrupo, reconstruirHistoricoGrupo } from './utils/designacoesPorGrupo.js';

const LOCAL_ADMIN_UID_KEY = 'quadro_admin_uid';

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
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const syncConfirmacoes = abaAtiva === 'dashboard' || abaAtiva === 'revisar';

  // 🔥 FUNÇÃO excluirSemanaELimparHistorico ADICIONADA AQUI:
  const {
    dados: dadosNuvem,
    confirmacoes,
    notificacoes,
    loading,
    usuario,
    salvarItem,
    salvarLoteProgramacoes,
    salvarHistoricosLocais,
    excluirItem,
    publicarQuadroPublico,
    excluirSemanaELimparHistorico,
    marcarNotificacaoComoLida,
    marcarTodasNotificacoesComoLidas,
    excluirNotificacao,
    excluirNotificacoesLidas
  } = useGerenciadorDados({ syncConfirmacoes, localOnly: MULTI_GRUPOS_LOCAL });
  const dadosSistema = dadosNuvem;
  const modoGrupos = MULTI_GRUPOS_LOCAL || gruposRemotosAtivos(dadosSistema.configuracoes);
  const adaptadoresRef = useRef({ salvarLoteProgramacoes, publicarQuadroPublico });
  useEffect(() => { adaptadoresRef.current = { salvarLoteProgramacoes, publicarQuadroPublico }; }, [salvarLoteProgramacoes, publicarQuadroPublico]);
  const dadosAtuaisRef = useRef(dadosSistema);
  useEffect(() => { dadosAtuaisRef.current = dadosSistema; }, [dadosSistema]);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);
  const guardsRef = useRef(new Set());
  const registrarGuard = useCallback(guard => { guardsRef.current.add(guard); return () => guardsRef.current.delete(guard); }, []);
  const configGrupos = useMemo(() => modoGrupos ? normalizeGruposProgramacao(dadosSistema.configuracoes) : {}, [dadosSistema.configuracoes, modoGrupos]);
  const { grupoId, selecionarGrupo } = useGrupoAtivo({ ownerUid: MULTI_GRUPOS_LOCAL ? usuario?.uid : resolveDataOwnerUid(usuario), config: configGrupos, enabled: modoGrupos });
  const configEmFoco = useMemo(() => modoGrupos && grupoId
    ? projetarConfigGrupo(configGrupos, grupoId) : dadosSistema.configuracoes, [configGrupos, grupoId, dadosSistema.configuracoes, modoGrupos]);
  const [controller] = useState(() => createProgramacoesController({
    getEstado: () => dadosAtuaisRef.current,
    salvarLote: async lote => {
      await adaptadoresRef.current.salvarLoteProgramacoes(lote);
      const anterior = dadosAtuaisRef.current;
      dadosAtuaisRef.current = { ...anterior, historico_reunioes: [
        ...anterior.historico_reunioes.filter(item => !lote.excluirIds.includes(item.id) && !lote.upserts.some(next => next.id === item.id)), ...lote.upserts,
      ] };
    },
    publicar: payload => adaptadoresRef.current.publicarQuadroPublico(payload),
  }));
  const executarLocal = async operacao => {
    if (pendingRef.current) throw new Error('Uma operação já está em andamento.');
    pendingRef.current = true;
    setBusy(true);
    try { return await operacao(); }
    finally { pendingRef.current = false; setBusy(false); }
  };
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [sharedWeekSelection, setSharedWeekSelection] = useState({});
  const [reviewShortcutRequest, setReviewShortcutRequest] = useState(null);
  const [substitutionShortcutRequest, setSubstitutionShortcutRequest] = useState(null);
  const [dupModal, setDupModal] = useState({ open: false, existing: null, incoming: null, resolve: null });

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

  const lang = normalizeLanguage(configEmFoco?.idioma);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;
  const APP_TEXTS = getSectionMessages('adminPanel', lang);
  const G = getSectionMessages('gruposProgramacao', lang);
  const trocarContexto = async acao => {
    if (pendingRef.current || dupModal.open) return;
    pendingRef.current = true;
    setBusy(true);
    try {
      for (const guard of [...guardsRef.current]) if (!await guard()) return;
      setSharedWeekSelection({});
      setReviewShortcutRequest(null);
      setSubstitutionShortcutRequest(null);
      acao();
    } finally { pendingRef.current = false; setBusy(false); }
  };
  const navegarAba = proxima => modoGrupos
    ? trocarContexto(() => setAbaAtiva(proxima)) : setAbaAtiva(proxima);

  useEffect(() => {
    syncDocumentLanguage(lang);
  }, [lang]);

  const todasProgramacoes = Array.isArray(dadosSistema?.historico_reunioes) ? dadosSistema.historico_reunioes : [];
  const listaProgramacoes = modoGrupos
    ? selecionarProgramacoesGrupo(todasProgramacoes, grupoId, dadosSistema.configuracoes) : todasProgramacoes;
  const unreadNotificationsCount = (notificacoes || []).filter((item) => !item?.readAt && !item?.readAtIso).length;

  const getTodayISO = () => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const getDataReuniaoDaProgramacao = (sem, config = dadosSistema?.configuracoes) => (
    sem?.dataReuniao ||
    sem?.dataExata ||
    getMeetingDateISOFromSemana({
      semanaStr: sem?.semana,
      config,
      isoFallback: sem?.dataInicio || sem?.data || null,
      textSources: [sem?.semana]
    })
  );

  const limparHistoricoAlunosPorDatas = (alunos = [], datasBase = []) => {
    const ranges = datasBase.filter(Boolean).map((dataStr) => {
      const [ano, mes, dia] = dataStr.split('-').map(Number);
      if (!ano || !mes || !dia) return null;
      const dataBase = new Date(ano, mes - 1, dia, 12, 0, 0);
      const diaSemana = dataBase.getDay();
      const diffParaSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
      const start = new Date(dataBase);
      start.setDate(dataBase.getDate() - diffParaSegunda);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }).filter(Boolean);

    if (ranges.length === 0) return { alunos, alterou: false };

    let alterou = false;
    const novosAlunos = alunos.map((aluno) => {
      if (!Array.isArray(aluno?.historico)) return aluno;
      const historico = aluno.historico.filter((item) => {
        if (!item?.data) return true;
        const [ano, mes, dia] = item.data.split('-').map(Number);
        if (!ano || !mes || !dia) return true;
        const dataHist = new Date(ano, mes - 1, dia, 12, 0, 0);
        const caiNaSemana = ranges.some((range) => dataHist >= range.start && dataHist <= range.end);
        if (caiNaSemana) alterou = true;
        return !caiNaSemana;
      });
      return historico === aluno.historico ? aluno : { ...aluno, historico };
    });

    return { alunos: novosAlunos, alterou };
  };

  const normalizeProgramacaoDates = (programacao, config = dadosSistema?.configuracoes) => {
    if (!programacao) return programacao;

    const nextProg = { ...programacao, semana: (programacao.semana || '').toString().trim() };
    const fallbackISO = nextProg.dataExata || nextProg.dataReuniao || nextProg.dataInicio || nextProg.data || null;

    if (nextProg.semana) {
      const dataInicioCalculada = getWeekStartISOFromSemana({
        semanaStr: nextProg.semana,
        config,
        isoFallback: fallbackISO,
        textSources: [nextProg.semana]
      });

      if (dataInicioCalculada) {
        nextProg.dataInicio = dataInicioCalculada;
      }

      const eventoNestaData = (config?.eventosAnuais || []).find((ev) => ev?.dataInicio === nextProg.dataInicio);

      if (eventoNestaData) {
        nextProg.evento = eventoNestaData.tipo;
        nextProg.dataEventoEspecial = eventoNestaData.dataInput;

        if (eventoNestaData.tipo === 'visita') {
          const dataBase = new Date(`${nextProg.dataInicio}T12:00:00`);
          dataBase.setDate(dataBase.getDate() + 1);
          const dataVisita = dataBase.toISOString().split('T')[0];
          nextProg.dataExata = dataVisita;
          nextProg.dataReuniao = dataVisita;
        } else {
          nextProg.dataExata = nextProg.dataInicio;
          nextProg.dataReuniao = nextProg.dataInicio;
        }

        return nextProg;
      }

      const dataReuniaoCalculada = getMeetingDateISOFromSemana({
        semanaStr: nextProg.semana,
        config,
        isoFallback: nextProg.dataInicio || fallbackISO,
        textSources: [nextProg.semana]
      });

      if (dataReuniaoCalculada) {
        nextProg.dataExata = dataReuniaoCalculada;
        nextProg.dataReuniao = dataReuniaoCalculada;
      }
    }

    return nextProg;
  };

  const prepararProgramacoesParaSalvar = (programacoes = [], configDestino = dadosSistema?.configuracoes, configOrigem = dadosSistema?.configuracoes) => {
    const diaOrigem = normalizeMeetingDay(configOrigem?.dia_reuniao || configOrigem?.diaReuniao || configOrigem?.diaSemana);
    const diaDestino = normalizeMeetingDay(configDestino?.dia_reuniao || configDestino?.diaReuniao || configDestino?.diaSemana);
    const diaFimSemanaOrigem = normalizeMeetingDay(configOrigem?.dia_reuniao_fds || configOrigem?.diaReuniaoFds || configOrigem?.diaSemanaFimDeSemana || 'saturday');
    const diaFimSemanaDestino = normalizeMeetingDay(configDestino?.dia_reuniao_fds || configDestino?.diaReuniaoFds || configDestino?.diaSemanaFimDeSemana || 'saturday');
    const horarioFimSemanaOrigem = (configOrigem?.horario_fds || configOrigem?.horarioFimDeSemana || '18:00').toString();
    const horarioFimSemanaDestino = (configDestino?.horario_fds || configDestino?.horarioFimDeSemana || '18:00').toString();
    const mudouDiaReuniao = diaOrigem !== diaDestino;
    const mudouConfigFimDeSemana = diaFimSemanaOrigem !== diaFimSemanaDestino || horarioFimSemanaOrigem !== horarioFimSemanaDestino;
    const hojeISO = getTodayISO();
    const now = new Date().toISOString();

    return programacoes.map((programacao) => {
      if (!mudouDiaReuniao && !mudouConfigFimDeSemana) return normalizeProgramacaoDates(programacao, configDestino);

      const dataAtual = getDataReuniaoDaProgramacao(programacao, configOrigem);
      const isPublicada = programacao?.publicadaNoQuadro !== false;
      const fds = normalizeFimDeSemana(programacao?.fimDeSemana);
      const semanaAfetadaPorFimDeSemana = mudouConfigFimDeSemana && fds.ativo && hasFimDeSemanaData(programacao?.fimDeSemana);
      const dataFimSemanaAtual = semanaAfetadaPorFimDeSemana
        ? getMeetingDateISOFromSemana({
          semanaStr: programacao?.semana,
          config: configOrigem,
          isoFallback: programacao?.fimDeSemana?.data || programacao?.dataInicio || dataAtual,
          overrideDia: diaFimSemanaOrigem,
          textSources: [programacao?.semana]
        })
        : null;
      const isFutura = !dataAtual || dataAtual >= hojeISO || (semanaAfetadaPorFimDeSemana && (!dataFimSemanaAtual || dataFimSemanaAtual >= hojeISO));
      const deveMarcarPendencia = mudouDiaReuniao || semanaAfetadaPorFimDeSemana;
      const configParaSemana = isFutura && isPublicada && deveMarcarPendencia ? configDestino : configOrigem;
      const normalizada = normalizeProgramacaoDates(programacao, configParaSemana);

      if (!isFutura || !isPublicada || !deveMarcarPendencia) return normalizada;
      const motivo = mudouDiaReuniao && semanaAfetadaPorFimDeSemana
        ? 'mudanca_datas_reunioes'
        : (semanaAfetadaPorFimDeSemana ? 'mudanca_fim_de_semana' : 'mudanca_dia_reuniao');

      return {
        ...normalizada,
        agendaPendenteSync: true,
        needsCalendarSync: true,
        agendaPendenteMotivo: motivo,
        agendaPendenteDesde: now,
        historicoPendenteSync: true,
        historicoPendenteMotivo: motivo,
        historicoPendenteDesde: now,
        ultimaAlteracaoPublicadaEm: now
      };
    });
  };

  const stableStringify = (value) => {
    if (Array.isArray(value)) {
      return `[${value.map(stableStringify).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const entries = Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
      return `{${entries.join(',')}}`;
    }

    return JSON.stringify(value);
  };

  const getProgramacaoDocId = (programacao) => createProgramacaoId(programacao);

  const hasMeaningfulChange = (next, current) => stableStringify(next || {}) !== stableStringify(current || {});

  const buildQuadroPublicoPayload = (configuracoes, programacoes = []) => projetarQuadroPublico({
    configuracoes, historico_reunioes: programacoes, ownerUid: resolveDataOwnerUid(usuario),
  });

  const republicarQuadroPublicoAtual = async (programacoesOverride = listaProgramacoes) => {
    if (modoGrupos) {
      const resultado = await executarLocal(() => controller.executar({ grupoId, operacoes: [], republicar: true }));
      if (resultado.erroPublicacao) toast.error(resultado.erroPublicacao, G.parcial);
      return resultado;
    }
    const programacoesPreparadas = ensureUniqueProgramacaoIds(
      prepararProgramacoesParaSalvar(
        Array.isArray(programacoesOverride) ? programacoesOverride : listaProgramacoes,
        dadosSistema?.configuracoes,
        dadosSistema?.configuracoes
      )
    );

    await publicarQuadroPublico(buildQuadroPublicoPayload(dadosSistema?.configuracoes, programacoesPreparadas));
    toast.success(APP_TEXTS.quadroRepublicado || 'Quadro publico republicado.');
  };

  const salvarAlteracao = async (novosDados) => {
    if (modoGrupos) {
      // Configuração e programas têm operações próprias, nunca gravar props de tela.
      if (novosDados.configuracoes && novosDados.configuracoes !== dadosSistema.configuracoes) throw new Error('Use a edição explícita de configuração por grupo.');
      return executarLocal(async () => {
        if (novosDados.alunos) {
          for (const aluno of novosDados.alunos) await salvarItem('alunos', aluno.id, aluno);
        }
        if (novosDados.historico_reunioes) return controller.executar({ grupoId,
          operacoes: operacoesDaListaDoGrupo({ lista: novosDados.historico_reunioes, grupoId, config: dadosAtuaisRef.current.configuracoes }) });
      });
    }
    const operacoes = [];
    const configDestino = novosDados.configuracoes || dadosSistema?.configuracoes;
    let configAlterada = false;
    let programacoesAlteradas = false;
    let programacoesPreparadasParaPublico = null;
    let payloadQuadroPublico = null;

    if (novosDados.configuracoes && hasMeaningfulChange(novosDados.configuracoes, dadosSistema?.configuracoes)) {
      configAlterada = true;
      operacoes.push(salvarItem('configuracoes', 'geral', novosDados.configuracoes));
    }

    if (Array.isArray(novosDados.alunos)) {
      const alunosAtuaisPorId = new Map((dadosSistema?.alunos || []).map((aluno) => [String(aluno?.id), aluno]));
      novosDados.alunos.forEach(a => {
        if (a?.id != null && String(a.id).trim() !== '') {
          const alunoAtual = alunosAtuaisPorId.get(String(a.id));
          if (!alunoAtual || hasMeaningfulChange(a, alunoAtual)) {
            operacoes.push(salvarItem('alunos', a.id, a));
          }
        }
      });
    }

    if (Array.isArray(novosDados.historico_reunioes)) {
      const programacoesAtuaisPorDocId = new Map(
        (listaProgramacoes || [])
          .map((programacao) => [getProgramacaoDocId(programacao), programacao])
          .filter(([docId]) => docId)
      );
      const programacoesPreparadas = ensureUniqueProgramacaoIds(
        prepararProgramacoesParaSalvar(
          novosDados.historico_reunioes,
          configDestino,
          dadosSistema?.configuracoes
        )
      );
      programacoesPreparadasParaPublico = programacoesPreparadas;
      const proximosDocIds = new Set();
      programacoesPreparadas.forEach(p => {
        const programacaoNormalizada = p;
        const docId = getProgramacaoDocId(programacaoNormalizada);
        if (docId) {
          proximosDocIds.add(docId);
          const programacaoAtual = programacoesAtuaisPorDocId.get(docId);
          if (!programacaoAtual || hasMeaningfulChange(programacaoNormalizada, programacaoAtual)) {
            programacoesAlteradas = true;
            operacoes.push(salvarItem('programacao', docId, programacaoNormalizada));
          }
        }
      });

      if (!programacoesAlteradas) {
        programacoesAlteradas = [...programacoesAtuaisPorDocId.keys()].some((docId) => !proximosDocIds.has(docId));
      }
    }

    if (configAlterada || programacoesAlteradas) {
      payloadQuadroPublico = buildQuadroPublicoPayload(
        configDestino,
        programacoesPreparadasParaPublico || listaProgramacoes
      );
    }

    if (operacoes.length > 0) {
      await Promise.all(operacoes);
    }

    if (payloadQuadroPublico) {
      try {
        await publicarQuadroPublico(payloadQuadroPublico);
      } catch (error) {
        console.warn('Nao foi possivel publicar o resumo do quadro publico:', error);
      }
    }
  };

  const setListaProgramacoes = (updater) => {
    if (modoGrupos) {
      const grupoDestino = grupoId;
      return executarLocal(() => {
        const config = dadosAtuaisRef.current.configuracoes;
        const atual = selecionarProgramacoesGrupo(dadosAtuaisRef.current.historico_reunioes, grupoDestino, config);
        const next = typeof updater === 'function' ? updater(atual) : updater;
        return controller.executar({ grupoId: grupoDestino, operacoes: operacoesDaListaDoGrupo({ lista: next, grupoId: grupoDestino, config }) });
      }).catch(error => { toast.error(error, G.erroSalvar); return { salvo: false, error }; });
    }
    const current = listaProgramacoes;
    const nextRaw = typeof updater === 'function' ? updater(current) : (Array.isArray(updater) ? updater : []);
    const next = ensureUniqueProgramacaoIds(
      nextRaw.filter(Boolean).map(p => normalizeProgramacaoDates(p, dadosSistema?.configuracoes))
    );
    return salvarAlteracao({ ...dadosSistema, historico_reunioes: next });
  };

  const getWeekSelectionKey = (sem, idx = 0) =>
    (sem?.id ?? sem?.dataReuniao ?? sem?.dataInicio ?? sem?.dataExata ?? sem?.data ?? String(idx)).toString();

  const handleAbrirNotificacoesSemana = (semana) => {
    const key = getWeekSelectionKey(semana);
    if (!key) return;

    setSharedWeekSelection({ [key]: true });
    setReviewShortcutRequest({ tab: 'notificar', token: Date.now() });
    setAbaAtiva('revisar');
  };

  const handleSolicitarSubstituicao = (request) => {
    const key = request?.semanaKey || request?.dataISO || '';
    if (key) {
      setSharedWeekSelection({ [key]: true });
    }
    setSubstitutionShortcutRequest({ ...request, token: Date.now() });
    setAbaAtiva('designar');
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

    nextProg.id = createProgramacaoId(nextProg);

    const idxAtual = findMatchingProgramacaoIndex(nextProg, listaProgramacoes, dadosSistema?.configuracoes);

    if (idxAtual === -1) { setListaProgramacoes(prev => [...prev, nextProg]); return; }

    const choice = await new Promise(resolve => setDupModal({ open: true, existing: listaProgramacoes[idxAtual], incoming: nextProg, resolve }));
    setDupModal({ open: false, existing: null, incoming: null, resolve: null });

    if (choice === 'replace') {
      setListaProgramacoes(prev => {
        const out = [...prev];
        out[idxAtual] = { ...out[idxAtual], ...nextProg, id: out[idxAtual]?.id || nextProg.id };
        return out;
      });
    } else if (choice === 'duplicate') {
      setListaProgramacoes(prev => [...prev, {
        ...nextProg,
        id: createProgramacaoId(nextProg, { forceRandom: true }),
        semana: `${nextProg.semana} (cópia)`
      }]);
    }
  };

  const handleDefinirEvento = (dataInput, tipoEvento) => {
    if (modoGrupos) { toast.info(G.pendente); return; }
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
    if (modoGrupos) return executarLocal(() => controller.excluirProgramacoes({ grupoId, ids: [id] }));
    const { alunos: alunosLimpos, alterou } = limparHistoricoAlunosPorDatas(dadosSistema?.alunos || [], [dataDaSemana]);
    if (alterou) {
      await salvarAlteracao({ ...dadosSistema, alunos: alunosLimpos });
    }
    await excluirSemanaELimparHistorico(id, dataDaSemana);
  };

  const handleSalvarAlunoBanco = async aluno => modoGrupos
    ? executarLocal(() => salvarItem('alunos', aluno.id, aluno)) : salvarItem('alunos', aluno.id, aluno);

  const handleExcluirAlunoBanco = useCallback(
    async (id) => await excluirItem('alunos', id),
    [excluirItem]
  );

  const salvarConfigGrupoLocal = pedido => executarLocal(async () => {
    const config = patchConfiguracaoGrupo(dadosAtuaisRef.current.configuracoes, pedido);
    await salvarItem('configuracoes', 'geral', config);
    dadosAtuaisRef.current = { ...dadosAtuaisRef.current, configuracoes: config };
  });

  const salvarEventoGrupoLocal = pedido => executarLocal(async () => {
    const config = prepararEventoGrupo({ config: dadosAtuaisRef.current.configuracoes, ...pedido });
    await salvarItem('configuracoes', 'geral', config);
    dadosAtuaisRef.current = { ...dadosAtuaisRef.current, configuracoes: config };
  });
  const sincronizarHistoricoGrupoLocal = pedido => executarLocal(async () => {
    const estado = dadosAtuaisRef.current;
    const alunos = reconstruirHistoricoGrupo({ ...pedido, config: estado.configuracoes,
      alunos: estado.alunos, programacoes: estado.historico_reunioes });
    await salvarHistoricosLocais(alunos, pedido);
    dadosAtuaisRef.current = { ...estado, alunos };
  });

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
      <GRUPO_EDICAO_CONTEXT.Provider value={modoGrupos ? registrarGuard : null}>
      {/* AS CLASSES DE IMPRESSÃO FORAM ADICIONADAS NESTA DIV (print:block print:h-auto print:overflow-visible) */}
      <div id="app-root" className="flex h-screen w-full bg-gray-100 font-sans text-gray-900 overflow-hidden relative print:block print:h-auto print:overflow-visible">
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
          setAbaAtiva={navegarAba}
          usuario={usuario}
          logout={() => MULTI_GRUPOS_LOCAL ? window.location.reload() : auth.signOut()}
          listaProgramacoes={listaProgramacoes}
          permitirImportacao={!modoGrupos || configGrupos.grupos[grupoId]?.meioSemana.habilitada}
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
                <h2 className={`${modoGrupos ? 'hidden sm:block' : ''} text-base md:text-lg font-bold text-slate-800 capitalize truncate max-w-[160px] sm:max-w-none`}>
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
                    onClick={() => navegarAba('designar')}
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
                    onClick={() => navegarAba('revisar')}
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

                {modoGrupos && <SeletorGrupo grupos={configGrupos.grupos} grupoId={grupoId} disabled={busy || dupModal.open}
                  onChange={id => id !== grupoId && trocarContexto(() => selecionarGrupo(id))} />}

                <Link
                  to="/quadro"
                  title={APP_TEXTS.verQuadro}
                  className="hidden sm:flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  <Globe size={18} />
                  <span className="hidden sm:block text-xs font-bold">{APP_TEXTS.verQuadro}</span>
                </Link>

                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">
                  {configEmFoco?.nome_cong || APP_TEXTS.minhaCong}
                </div>

                <NotificationBell
                  notifications={notificacoes}
                  unreadCount={unreadNotificationsCount}
                  onMarkOne={marcarNotificacaoComoLida}
                  onMarkAll={marcarTodasNotificacoesComoLidas}
                  onDeleteOne={excluirNotificacao}
                  onDeleteRead={excluirNotificacoesLidas}
                  onNavigate={modoGrupos ? alerta => {
                    const destino = destinoNotificacao(alerta, configGrupos);
                    if (!configGrupos.grupos[destino.grupoId]?.ativo) { toast.info('Programação indisponível.'); return; }
                    trocarContexto(() => { selecionarGrupo(destino.grupoId); setAbaAtiva('revisar');
                      setReviewShortcutRequest({ token: Date.now(), ...destino }); });
                  } : null}
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
        <div key={modoGrupos ? grupoId : 'legado'} className="flex-1 overflow-y-auto scroll-smooth print:overflow-visible">
          {MULTI_GRUPOS_LOCAL && <p role="status" className="no-print m-3 p-3 rounded-xl border border-amber-300 bg-amber-50 text-sm">{G.ensaio}</p>}
          {!modoGrupos && dadosSistema.configuracoes?.versaoProgramacao >= 2 && <p role="alert" className="m-3 p-3 border border-amber-300 bg-amber-50">
            {lang === 'es' ? 'Programa v2 protegido. Actualiza en Versión del Sistema; las escrituras remotas requieren activación autorizada.' : 'Programação v2 protegida. Atualize em Versão do Sistema; escritas remotas exigem ativação autorizada.'}
          </p>}
          <fieldset disabled={modoGrupos && busy} className="min-w-0 border-0 p-0 m-0">
          <Suspense fallback={<RouteLoading text={APP_TEXTS.carregando} />}>
            {abaAtiva === 'dashboard' && (modoGrupos
              ? <PainelGrupo config={configGrupos} grupoId={grupoId} alunos={dadosSistema.alunos} programacoes={todasProgramacoes}
                  busy={busy} onEvento={salvarEventoGrupoLocal} onHistorico={sincronizarHistoricoGrupoLocal} onDesignar={() => navegarAba('designar')} />
              : <Dashboard listaProgramacoes={listaProgramacoes} alunos={dadosSistema?.alunos || []} config={configEmFoco} setAbaAtiva={navegarAba} onDefinirEvento={handleDefinirEvento} t={t} confirmacoes={confirmacoes} onAbrirNotificacoesSemana={handleAbrirNotificacoesSemana} />)}
            {abaAtiva === 'importar' && (modoGrupos
              ? (!MULTI_GRUPOS_LOCAL && configEmFoco.dia_reuniao && configEmFoco.horario
                ? <Importador config={configEmFoco} programacoes={listaProgramacoes} idioma={lang} onImportComplete={async d => {
                    const conteudo = { ...d }; delete conteudo.id;
                    const data = d.meioSemana?.data || d.dataReuniao || d.dataExata || getMeetingDateISOFromSemana({ semanaStr: d.semana, config: configEmFoco, isoFallback: d.dataInicio });
                    await executarLocal(() => controller.executar({ grupoId, preparar: estado => prepararImportacaoMeioSemana({ ...estado, dados: conteudo, data, horario: configEmFoco.horario }) }));
                    setAbaAtiva('designar');
                  }} />
                : <ReunioesIndependentes key={`${grupoId}-importar`} importar config={configGrupos} grupoId={grupoId} programacoes={listaProgramacoes} busy={busy} onExecutar={pedido => executarLocal(() => controller.executar(pedido))} />)
              : <Importador config={dadosSistema.configuracoes} programacoes={listaProgramacoes} onImportComplete={async (d) => { await upsertProgramacaoComConfirmacao(d); setAbaAtiva('designar'); }} idioma={lang} />)}

            {abaAtiva === 'designar' && (modoGrupos
              ? <><ReunioesIndependentes key={`${grupoId}-agendar`} config={configGrupos} grupoId={grupoId} programacoes={listaProgramacoes} busy={busy} onExecutar={pedido => executarLocal(() => controller.executar(pedido))} />
                  <DesignacoesGrupo config={configGrupos} grupoId={grupoId} programacoes={todasProgramacoes} alunos={dadosSistema.alunos} cargosMap={CARGOS_MAP}
                    busy={busy} onExecutar={pedido => executarLocal(() => controller.executar(pedido))} onCadastro={() => navegarAba('alunos')} /></> :
              <Designar
                listaProgramacoes={listaProgramacoes}
                setListaProgramacoes={setListaProgramacoes}
                alunos={dadosSistema?.alunos || []}
                cargosMap={CARGOS_MAP}
                lang={lang}
                t={t}
                config={configEmFoco}
                onExcluirSemana={handleExcluirSemanaBanco}
                sharedWeekSelection={sharedWeekSelection}
                setSharedWeekSelection={setSharedWeekSelection}
                substitutionShortcutRequest={substitutionShortcutRequest}
                onRepublicarQuadroPublico={republicarQuadroPublicoAtual}
              />
            )}

            {abaAtiva === 'revisar' && (modoGrupos ? <RevisaoGrupo alunos={dadosSistema.alunos} localOnly={MULTI_GRUPOS_LOCAL} ownerUid={resolveDataOwnerUid(usuario)} config={configGrupos} grupoId={grupoId} programacoes={todasProgramacoes} confirmacoes={confirmacoes} programacaoFoco={reviewShortcutRequest?.programacaoId}
              onExecutar={pedido => executarLocal(() => controller.executar(pedido))} /> :
              <RevisarEnviar
                historico={listaProgramacoes}
                alunos={dadosSistema?.alunos || []}
                config={dadosSistema?.configuracoes}
                confirmacoes={confirmacoes}
                onAlunosChange={(novosAlunos) => salvarAlteracao({ ...dadosSistema, alunos: novosAlunos })}
                onProgramacoesChange={setListaProgramacoes}
                sharedWeekSelection={sharedWeekSelection}
                setSharedWeekSelection={setSharedWeekSelection}
                reviewShortcutRequest={reviewShortcutRequest}
                onSolicitarSubstituicao={handleSolicitarSubstituicao}
              />
            )}
            {abaAtiva === 'alunos' && <ListaAlunos alunos={dadosSistema?.alunos || []} setAlunos={(n) => salvarAlteracao({ ...dadosSistema, alunos: n })} onSalvarAluno={handleSalvarAlunoBanco} config={configEmFoco} cargosMap={CARGOS_MAP} onExcluirAluno={handleExcluirAlunoBanco} multiGrupos={modoGrupos} />}
            {abaAtiva === 'configuracoes' && (modoGrupos
              ? <ConfiguracoesGrupos config={configGrupos} grupoId={grupoId} onSalvar={salvarConfigGrupoLocal} busy={busy} lang={lang} />
              : <Configuracoes dados={dadosSistema} salvarAlteracao={salvarAlteracao} t={t} lang={lang} />)}
          </Suspense>
          </fieldset>
        </div>
      </main>
      </div>
      </GRUPO_EDICAO_CONTEXT.Provider>
    </I18nProvider>
  );
}

// ============================================================================
// 2. WRAPPER DO QUADRO PÚBLICO
// ============================================================================
function QuadroPublicoWrapper({ usuario }) {
  const { dados, loading } = useQuadroPublico(usuario?.uid);

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
        {config.versaoProgramacao >= 2 ? <QuadroPorGrupo dados={{ ...dados, historico_reunioes: programacoes }} usuario={usuario} /> : <QuadroPublico programacoes={programacoes} config={config} usuario={usuario} />}
      </Suspense>
    </I18nProvider>
  );
}

// ============================================================================
// 3. APLICATIVO PRINCIPAL (ROTEADOR INTELIGENTE)
// ============================================================================
function App() {
  const [usuarioVerificado, setUsuarioVerificado] = useState(MULTI_GRUPOS_LOCAL ? USUARIO_ENSAIO_GRUPOS : undefined);

  useEffect(() => {
    if (MULTI_GRUPOS_LOCAL) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (typeof window !== 'undefined') {
        try {
          if (user?.uid) {
            window.localStorage.setItem(LOCAL_ADMIN_UID_KEY, resolveDataOwnerUid(user));
          }
        } catch {
          // Ignora falhas de storage e segue com o fluxo normal do app.
        }
      }
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
