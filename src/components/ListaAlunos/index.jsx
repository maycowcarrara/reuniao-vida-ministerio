import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UsersRound, User, UserRound, FilterX, FileJson, Download, FileText, FileSpreadsheet, Printer, ChevronDown, LayoutGrid, List, SortAsc, SortDesc, Calendar, AlertCircle, Plus, SlidersHorizontal, X, Check } from 'lucide-react';
import AlunoCard from './AlunoCard';
import AlunoListItem from './AlunoListItem';
import ModalHistorico from './ModalHistorico';
import ModalFormulario from './ModalFormulario';
import { CARGOS_MAP_FALLBACK, TRANSLATIONS, normalizarIdioma, normalizar, getCargoKey, getUltimoRegistro, calcularDias, verificarAusenciaAtiva, pruneExpiredUnavailableDates } from './utils';
import { toast } from '../../utils/toast';
import { dialog } from '../../utils/dialog';
import { getAlunoCapabilities, getAssignmentCapabilitiesByGroup, getLegacyCapabilitiesForTipo, normalizeAssignmentCapabilities } from '../../utils/assignmentEligibility';

// Subcomponente para os Cards Estatísticos
const StatCard = ({ icon, label, value, isActive, onClick, colorClass, activeClass, customClass = "" }) => (
    <button
        onClick={onClick}
        className={`p-3 rounded-2xl border text-left flex flex-col transition-all duration-200 ${customClass} ${isActive ? activeClass : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'}`}
    >
        <div className={`flex items-center justify-between w-full mb-1 ${isActive ? 'text-white' : colorClass}`}>
            {icon}
            <span className={`text-xl md:text-2xl font-black ${isActive ? 'text-white' : 'text-gray-800'}`}>{value}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-tight mt-1 ${isActive ? 'text-white/90' : 'text-gray-500'}`}>{label}</span>
    </button>
);

const SAVE_TIMEOUT_MS = 15000;

const withSaveTimeout = (promise, message) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
            reject(Object.assign(new Error(message), { code: 'deadline-exceeded' }));
        }, SAVE_TIMEOUT_MS);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        window.clearTimeout(timeoutId);
    });
};

const ListaAlunos = ({ alunos, setAlunos, onSalvarAluno, onExcluirAluno, config, cargosMap }) => {
    const CARGOS_MAP = cargosMap || CARGOS_MAP_FALLBACK;
    const lang = normalizarIdioma(config?.idioma);
    const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;

    // Estados de Filtro
    const [termo, setTermo] = useState('');
    const [filtrosTiposAtivos, setFiltrosTiposAtivos] = useState([]);
    const [filtrosPartesAtivas, setFiltrosPartesAtivas] = useState([]);
    const [filtroGenero, setFiltroGenero] = useState('todos');
    const [filtroEspecial, setFiltroEspecial] = useState('todos');
    const [filtroStatus, setFiltroStatus] = useState('todos');

    // Ordenação
    const [ordenacao, setOrdenacao] = useState('nome');
    const [ordemCrescente, setOrdemCrescente] = useState(true);

    // UI States
    const [modalFormOpen, setModalFormOpen] = useState(false);
    const [modalHistoryOpen, setModalHistoryOpen] = useState(false);
    const [menuExportOpen, setMenuExportOpen] = useState(false);
    const [menuPartesOpen, setMenuPartesOpen] = useState(false);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [salvandoAluno, setSalvandoAluno] = useState(false);

    // Dados em Edição/Visualização
    const [alunoEmEdicao, setAlunoEmEdicao] = useState(null);
    const [alunoHistorico, setAlunoHistorico] = useState(null);
    const partesFilterRef = useRef(null);

    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('jw_alunos_view') || 'grid';
        } catch {
            return 'grid';
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('jw_alunos_view', viewMode);
        } catch {
            return undefined;
        }
    }, [viewMode]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (menuExportOpen) setMenuExportOpen(false);
                if (menuPartesOpen) setMenuPartesOpen(false);
                if (modalHistoryOpen) setModalHistoryOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menuExportOpen, menuPartesOpen, modalHistoryOpen]);

    useEffect(() => {
        const onPointerDown = (event) => {
            if (!menuPartesOpen || partesFilterRef.current?.contains(event.target)) return;
            setMenuPartesOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [menuPartesOpen]);

    // Calcular Estatísticas Iniciais (Ignorando Filtros)
    const stats = useMemo(() => {
        const ativos = (alunos || []).filter(a => a.tipo !== 'desab');
        let irmaos = 0, irmas = 0, ausentes = 0, atrasados = 0;

        ativos.forEach(a => {
            const gen = CARGOS_MAP[getCargoKey(a.tipo, CARGOS_MAP)]?.gen;
            if (gen === 'M') irmaos++;
            if (gen === 'F') irmas++;
            if (verificarAusenciaAtiva(a)) ausentes++;

            const ult = getUltimoRegistro(a, lang);
            const d = calcularDias(ult.data);
            if (d !== null && d > 60) atrasados++;
        });

        return { total: ativos.length, irmaos, irmas, ausentes, atrasados };
    }, [alunos, CARGOS_MAP, lang]);

    // Lógica para saber se há NENHUM filtro ativo
    const gruposPartes = useMemo(() => getAssignmentCapabilitiesByGroup(), []);

    const partesSelecionadasLabel = useMemo(() => {
        if (filtrosPartesAtivas.length === 0) return t.filtros.partes;
        if (filtrosPartesAtivas.length === 1) {
            const parte = gruposPartes
                .flatMap((grupo) => grupo.capabilities)
                .find((capability) => capability.key === filtrosPartesAtivas[0]);
            return parte?.labels?.[lang] || parte?.labels?.pt || t.filtros.partes;
        }
        return `${filtrosPartesAtivas.length} ${t.filtros.partesSelecionadas}`;
    }, [filtrosPartesAtivas, gruposPartes, lang, t]);

    const toggleFiltroParte = (key) => {
        setFiltrosPartesAtivas((prev) =>
            prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
        );
    };

    const hasActiveFilters = termo !== '' || filtrosTiposAtivos.length > 0 || filtrosPartesAtivas.length > 0 || filtroGenero !== 'todos' || filtroEspecial !== 'todos' || filtroStatus !== 'todos';

    const limparFiltros = () => {
        setTermo('');
        setFiltrosTiposAtivos([]);
        setFiltrosPartesAtivas([]);
        setFiltroGenero('todos');
        setFiltroEspecial('todos');
        setFiltroStatus('todos');
        setMenuPartesOpen(false);
    };

    // Processamento da Lista Final Baseada nos Filtros
    const alunosProcessados = useMemo(() => {
        const buscaNorm = normalizar(termo);
        return (alunos || [])
            .filter(a => {
                const cKey = getCargoKey(a.tipo, CARGOS_MAP);
                const info = CARGOS_MAP[cKey] || CARGOS_MAP.irmao;

                // 1. Busca por Texto
                const matchBusca = normalizar(a.nome).includes(buscaNorm) || normalizar(a.familia || '').includes(buscaNorm) || normalizar(info.pt).includes(buscaNorm) || normalizar(info.es).includes(buscaNorm) || normalizar(a.observacoes || '').includes(buscaNorm);
                if (!matchBusca) return false;

                // 2. Filtro de Status
                if (filtroStatus === 'ativos' && cKey === 'desab') return false;

                // 3. Filtro de Gênero
                if (filtroGenero !== 'todos' && info.gen !== filtroGenero) return false;

                // 4. Filtro de Tipo (Privilégio)
                if (filtrosTiposAtivos.length > 0 && !filtrosTiposAtivos.includes(cKey)) return false;

                // 5. Filtro por partes habilitadas
                if (filtrosPartesAtivas.length > 0) {
                    if (cKey === 'desab') return false;
                    const capacidadesAluno = getAlunoCapabilities(a);
                    if (!filtrosPartesAtivas.every((parteKey) => capacidadesAluno.includes(parteKey))) return false;
                }

                // 6. Filtro Especial
                if (filtroEspecial === 'ausentes' && !verificarAusenciaAtiva(a)) return false;
                if (filtroEspecial === 'atrasados') {
                    const ult = getUltimoRegistro(a, lang);
                    const d = calcularDias(ult.data);
                    if (d === null || d <= 60) return false;
                }

                return true;
            })
            .sort((a, b) => {
                if (ordenacao === 'nome') {
                    const res = (a.nome || '').localeCompare(b.nome || '');
                    return ordemCrescente ? res : res * -1;
                }
                const ultA = getUltimoRegistro(a, lang);
                const ultB = getUltimoRegistro(b, lang);
                const diasA = calcularDias(ultA.data) ?? 999999;
                const diasB = calcularDias(ultB.data) ?? 999999;
                const res = diasA - diasB;
                return ordemCrescente ? res : res * -1;
            });
    }, [alunos, termo, filtroStatus, filtrosTiposAtivos, filtrosPartesAtivas, filtroGenero, filtroEspecial, ordenacao, ordemCrescente, CARGOS_MAP, lang]);

    const familiasOptions = useMemo(() => {
        const familias = new Set();
        (alunos || []).forEach((aluno) => {
            const familia = (aluno?.familia || '').trim();
            if (familia) familias.add(familia);
        });
        return Array.from(familias).sort((a, b) => a.localeCompare(b));
    }, [alunos]);

    // Exportação e Operações
    const baixar = (blob, nome) => {
        const url = URL.createObjectURL(blob);
        const l = document.createElement('a');
        l.href = url; l.download = nome; l.click();
        URL.revokeObjectURL(url);
    };

    const escapeCsvValue = (value) => {
        const text = String(value ?? '');
        if (!/[;"\r\n]/.test(text)) return text;
        return `"${text.replace(/"/g, '""')}"`;
    };

    const handleExport = (tipo) => {
        if (tipo === 'json') {
            // O JSON exporta a lista completa de alunos, sem aplicar os filtros visíveis na tela.
            baixar(new Blob([JSON.stringify({ alunos: alunos }, null, 2)], { type: 'application/json' }), t.exportFiles.json);
        }
        else {
            // Para CSV e TXT, exportamos só o que foi filtrado na tela
            const rows = alunosProcessados.map(a => {
                const ult = getUltimoRegistro(a, lang);
                return {
                    [t.exportFields.nome]: a.nome,
                    [t.exportFields.cargo]: (CARGOS_MAP[getCargoKey(a.tipo, CARGOS_MAP)] || CARGOS_MAP.irmao)[lang],
                    [t.exportFields.whatsapp]: a.telefone || t.exportFields.naoInformado,
                    [t.exportFields.email]: a.email || t.exportFields.naoInformado,
                    [t.exportFields.familia]: a.familia || "",
                    [t.exportFields.observacoes]: a.observacoes || "",
                    [t.exportFields.ultimaData]: ult.data || "-",
                    [t.exportFields.ultimaParte]: ult.parte || "-"
                };
            });

            if (tipo === 'csv') {
                if (rows.length === 0) return;
                // Adicionado BOM para o Excel do Windows abrir os acentos perfeitamente no CSV
                const csv = '\uFEFF' + [
                    Object.keys(rows[0]).map(escapeCsvValue).join(';'),
                    ...rows.map(o => Object.values(o).map(escapeCsvValue).join(';'))
                ].join('\n');
                baixar(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), t.exportFiles.csv);
            }
            else if (tipo === 'txt') {
                baixar(new Blob([rows.map(a => `${t.exportTxt.aluno}: ${a[t.exportFields.nome]}\n${t.exportTxt.cargo}: ${a[t.exportFields.cargo]}\n${t.exportTxt.contato}: ${a[t.exportFields.whatsapp]}\n${t.exportTxt.obs}: ${a[t.exportFields.observacoes] || "-"}\n----------------`).join('\n')], { type: 'text/plain' }), t.exportFiles.txt);
            }
            else {
                window.print();
            }
        }

        setMenuExportOpen(false);
    };

    const openNovo = () => {
        setAlunoEmEdicao({ id: null, nome: '', tipo: 'irma', telefone: '', email: '', familia: '', observacoes: '', historico: [], datasIndisponiveis: [], partesHabilitadas: getLegacyCapabilitiesForTipo('irma'), _partesHabilitadasAuto: true });
        setModalFormOpen(true);
    };

    const openEditar = (aluno) => {
        const tipo = getCargoKey(aluno.tipo, CARGOS_MAP);
        const temHabilitacoesExplicitas = Array.isArray(aluno.partesHabilitadas);
        setAlunoEmEdicao({
            ...aluno,
            tipo,
            telefone: aluno.telefone || '',
            email: aluno.email || '',
            familia: aluno.familia || '',
            observacoes: aluno.observacoes || '',
            historico: Array.isArray(aluno.historico) ? aluno.historico : [],
            datasIndisponiveis: pruneExpiredUnavailableDates(aluno.datasIndisponiveis),
            partesHabilitadas: temHabilitacoesExplicitas
                ? normalizeAssignmentCapabilities(aluno.partesHabilitadas)
                : getLegacyCapabilitiesForTipo(tipo),
            _partesHabilitadasAuto: !temHabilitacoesExplicitas
        });
        setModalFormOpen(true);
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        const isNovoAluno = !alunoEmEdicao?.id;
        const materializarHabilitacoes = isNovoAluno || alunoEmEdicao?._partesHabilitadasAuto === false;
        const alunoForm = { ...alunoEmEdicao };
        delete alunoForm._partesHabilitadasAuto;
        const tipo = alunoForm.tipo || 'irma';
        const clean = {
            ...alunoForm,
            nome: (alunoForm.nome || '').trim(),
            telefone: (alunoForm.telefone || '').trim(),
            email: (alunoForm.email || '').trim(),
            familia: (alunoForm.familia || '').trim(),
            observacoes: (alunoForm.observacoes || '').trim(),
            tipo,
            datasIndisponiveis: pruneExpiredUnavailableDates(alunoForm.datasIndisponiveis)
        };
        if (materializarHabilitacoes) {
            clean.partesHabilitadas = normalizeAssignmentCapabilities(
                Array.isArray(alunoForm.partesHabilitadas)
                    ? alunoForm.partesHabilitadas
                    : getLegacyCapabilitiesForTipo(tipo)
            );
        } else {
            delete clean.partesHabilitadas;
        }
        if (!clean.nome) return;

        try {
            setSalvandoAluno(true);
            const alunoParaSalvar = isNovoAluno
                ? { ...clean, id: String(Math.max(0, ...(alunos || []).map(a => Number(a.id) || 0)) + 1) }
                : clean;

            const salvarAlunoAtual = isNovoAluno
                ? () => (onSalvarAluno
                    ? Promise.resolve(onSalvarAluno(alunoParaSalvar))
                    : Promise.resolve(setAlunos([...(alunos || []), alunoParaSalvar])))
                : () => (onSalvarAluno
                    ? Promise.resolve(onSalvarAluno(alunoParaSalvar))
                    : Promise.resolve(setAlunos((alunos || []).map(a => a.id === clean.id ? clean : a))));

            if (onSalvarAluno) {
                await withSaveTimeout(salvarAlunoAtual(), t.msg.salvarDemorado);
            } else {
                await salvarAlunoAtual();
            }

            setModalFormOpen(false);
            toast.success(isNovoAluno ? t.msg.cadastradoSucesso : t.msg.atualizadoSucesso);
        } catch (error) {
            toast.error(error, isNovoAluno ? t.msg.erroCadastrar : t.msg.erroAtualizar);
        } finally {
            setSalvandoAluno(false);
        }
    };

    const handleExcluir = async (aluno) => {
        if (aluno.tipo !== 'desab') return toast.error(t.msg.erroSoDesabilitados);
        const ok = await dialog.confirm({
            title: 'Excluir Aluno',
            message: t.msg.confirmarExclusao,
            variant: 'danger',
            confirmText: 'Excluir permanentemente',
            cancelText: 'Cancelar'
        });
        if (ok) {
            if (onExcluirAluno) await onExcluirAluno(aluno.id);
            else setAlunos(alunos.filter(a => a.id !== aluno.id));
            toast.success(t.msg.removerSucesso);
        }
    };

    const buildQuadroPessoaUrl = (aluno) => {
        const url = new URL('/quadro', window.location.origin);
        url.searchParams.set('p', aluno?.nome || '');
        return url.toString();
    };

    const handleCopiarLinkQuadro = async (aluno) => {
        const link = buildQuadroPessoaUrl(aluno);
        try {
            await navigator.clipboard.writeText(link);
            toast.success(`Link do quadro copiado para ${aluno.nome}.`);
        } catch {
            await dialog.prompt({
                title: 'Link do Quadro',
                message: `Copie o link individual para ${aluno.nome}:`,
                defaultValue: link,
                isCopyable: true,
                confirmText: 'Fechar',
                cancelText: 'Cancelar'
            });
        }
    };

    return (
        <div className="space-y-4 px-2 py-3 pb-8 sm:p-4 md:p-6">
            <style>{`
            @media print {
                html, body, #root { height: auto !important; overflow: visible !important; }
                .h-screen, .min-h-screen { height: auto !important; }
                .overflow-hidden { overflow: visible !important; }
                .overflow-y-auto, .overflow-auto { overflow: visible !important; height: auto !important; max-height: none !important; }
                aside, header, .no-print, button { display: none !important; }
                body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .print-area { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; padding: 0 !important; }
                .print-card { break-inside: avoid !important; page-break-inside: avoid !important; box-shadow: none !important; border: 1px solid #eee !important; }
            }
            `}</style>

            <div className="bg-white p-3 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 no-print flex flex-col gap-4 sm:gap-5">

                {/* 1. TOPO: Título e Ações Rápidas */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="w-full flex justify-between items-center xl:w-auto">
                        <h2 className="text-xl md:text-2xl font-black text-gray-800 flex items-center gap-2"><UsersRound size={26} className="text-blue-600 shrink-0" /> {t.titulo}</h2>
                        <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-tighter xl:ml-6">{alunosProcessados.length} {t.registros}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                        <div className="flex flex-1 xl:flex-none border border-gray-100 rounded-xl overflow-hidden bg-gray-50/60 min-w-[120px]">
                            <button type="button" onClick={() => setViewMode('grid')} className={`flex-1 flex justify-center py-2.5 xl:py-2 text-[10px] font-black uppercase items-center gap-1.5 transition ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white'}`}><LayoutGrid size={14} /> <span className="hidden sm:inline">{t.visualizacao.grade}</span></button>
                            <button type="button" onClick={() => setViewMode('list')} className={`flex-1 flex justify-center py-2.5 xl:py-2 text-[10px] font-black uppercase items-center gap-1.5 border-l border-gray-100 transition ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white'}`}><List size={14} /> <span className="hidden sm:inline">{t.visualizacao.lista}</span></button>
                        </div>

                        <div className="relative flex-1 xl:flex-none min-w-[120px]">
                            <button onClick={() => setMenuExportOpen(!menuExportOpen)} className="w-full justify-center bg-blue-50 text-blue-600 px-3 py-2.5 xl:py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 transition hover:bg-blue-100"><Download size={14} /> <span>{t.exportar}</span> <ChevronDown size={12} /></button>
                            {menuExportOpen && (
                                <div className="absolute left-0 xl:right-0 xl:left-auto mt-2 w-52 bg-white border rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in duration-150">
                                    <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-3 xl:py-2.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2 border-b"><FileJson size={14} className="text-orange-500" /> {t.exportLabels.json}</button>
                                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-3 xl:py-2.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2 border-b"><FileSpreadsheet size={14} className="text-green-600" /> {t.exportLabels.csv}</button>
                                    <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-3 xl:py-2.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2 border-b"><FileText size={14} className="text-blue-500" /> {t.exportLabels.txt}</button>
                                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 xl:py-2.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2"><Printer size={14} /> {t.exportLabels.pdf}</button>
                                </div>
                            )}
                        </div>

                        <button onClick={openNovo} className="flex-1 xl:flex-none justify-center bg-blue-600 text-white px-4 py-2.5 xl:py-2 rounded-xl font-black text-[10px] flex items-center gap-1.5 uppercase hover:bg-blue-500 transition shadow-sm hover:shadow-md min-w-[120px]"><Plus size={14} /> {t.novo}</button>
                    </div>
                </div>

                <div className="flex gap-2 sm:hidden">
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder={t.buscaPlaceholder}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-9 pr-4 text-xs font-medium outline-none transition focus:border-blue-400 focus:bg-white"
                            value={termo}
                            onChange={e => setTermo(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setMobileFiltersOpen((prev) => !prev)}
                        className={`inline-flex items-center justify-center rounded-xl border px-3 text-xs font-black uppercase shadow-sm transition ${mobileFiltersOpen || hasActiveFilters ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'}`}
                    >
                        {mobileFiltersOpen ? <X size={18} /> : <SlidersHorizontal size={18} />}
                    </button>
                </div>

                {/* 2. DASHBOARD: Cards Estatísticos */}
                <div className={`${mobileFiltersOpen ? 'grid' : 'hidden'} grid-cols-2 sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3`}>
                    <StatCard
                        icon={<UsersRound size={18} />} label={t.estatisticas.total} value={stats.total}
                        isActive={!hasActiveFilters || (hasActiveFilters && filtroStatus === 'ativos' && termo === '' && filtrosTiposAtivos.length === 0 && filtrosPartesAtivas.length === 0 && filtroGenero === 'todos' && filtroEspecial === 'todos')}
                        onClick={() => { limparFiltros(); setFiltroStatus('ativos'); }}
                        colorClass="text-blue-500" activeClass="bg-blue-600 border-blue-600 shadow-lg text-white"
                        customClass="col-span-2 sm:col-span-1"
                    />
                    <StatCard
                        icon={<User size={18} />} label={t.estatisticas.irmaos} value={stats.irmaos}
                        isActive={filtroGenero === 'M' && filtroEspecial === 'todos'}
                        onClick={() => { limparFiltros(); setFiltroGenero('M'); }}
                        colorClass="text-cyan-600" activeClass="bg-cyan-600 border-cyan-600 shadow-lg text-white"
                    />
                    <StatCard
                        icon={<UserRound size={18} />} label={t.estatisticas.irmas} value={stats.irmas}
                        isActive={filtroGenero === 'F' && filtroEspecial === 'todos'}
                        onClick={() => { limparFiltros(); setFiltroGenero('F'); }}
                        colorClass="text-pink-500" activeClass="bg-pink-500 border-pink-500 shadow-lg text-white"
                    />
                    <StatCard
                        icon={<Calendar size={18} />} label={t.estatisticas.ausentes} value={stats.ausentes}
                        isActive={filtroEspecial === 'ausentes'}
                        onClick={() => { limparFiltros(); setFiltroEspecial('ausentes'); }}
                        colorClass="text-orange-500" activeClass="bg-orange-500 border-orange-500 shadow-lg text-white"
                    />
                    <StatCard
                        icon={<AlertCircle size={18} />} label={t.estatisticas.atrasados} value={stats.atrasados}
                        isActive={filtroEspecial === 'atrasados'}
                        onClick={() => { limparFiltros(); setFiltroEspecial('atrasados'); }}
                        colorClass="text-red-500" activeClass="bg-red-500 border-red-500 shadow-lg text-white"
                    />
                </div>

                {/* 3. FILTROS E PESQUISA AVANÇADA */}
                <div className={`${mobileFiltersOpen ? 'flex' : 'hidden'} sm:flex flex-col gap-3`}>
                    <div className="flex flex-col lg:flex-row flex-wrap gap-2">
                        {/* Pesquisa */}
                        <div className="hidden sm:block flex-1 w-full lg:w-auto relative min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input type="text" placeholder={t.buscaPlaceholder} className="w-full pl-9 pr-4 py-3 lg:py-2 border border-gray-200 rounded-xl outline-none text-xs font-medium bg-gray-50 focus:bg-white focus:border-blue-400 transition" value={termo} onChange={e => setTermo(e.target.value)} />
                        </div>

                        {/* Status (Todos vs Ativos) */}
                        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-gray-50 w-full lg:w-auto shrink-0">
                            <button onClick={() => setFiltroStatus('todos')} className={`flex-1 lg:flex-none py-3 lg:py-2 px-3 text-[10px] font-black uppercase transition ${filtroStatus === 'todos' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-white'}`} title={t.acessibilidade.mostrarTodos}>{t.filtros.todos}</button>
                            <button onClick={() => setFiltroStatus('ativos')} className={`flex-1 lg:flex-none py-3 lg:py-2 px-3 border-l border-gray-200 text-[10px] font-black uppercase transition flex items-center justify-center gap-1 ${filtroStatus === 'ativos' ? 'bg-green-500 text-white' : 'text-gray-400 hover:bg-white'}`} title={t.acessibilidade.apenasAtivos}>{t.filtros.ativos}</button>
                        </div>

                        {/* Partes habilitadas */}
                        <div className="relative w-full lg:w-auto shrink-0" ref={partesFilterRef}>
                            <button
                                type="button"
                                onClick={() => setMenuPartesOpen((prev) => !prev)}
                                className={`w-full lg:w-[220px] py-3 lg:py-2 px-3 rounded-xl border text-[10px] font-black uppercase transition flex items-center justify-between gap-2 ${filtrosPartesAtivas.length > 0 ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-white'}`}
                                title={t.acessibilidade.filtrarPorPartes}
                            >
                                <span className="truncate">{partesSelecionadasLabel}</span>
                                <ChevronDown size={14} className={`shrink-0 transition ${menuPartesOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {menuPartesOpen && (
                                <div className="absolute left-0 mt-2 w-full lg:w-[360px] max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-2xl z-[150] p-3 animate-in fade-in zoom-in duration-150">
                                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 mb-2">
                                        <span className="text-[10px] font-black uppercase text-gray-500">{t.filtros.partes}</span>
                                        {filtrosPartesAtivas.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setFiltrosPartesAtivas([])}
                                                className="text-[10px] font-black uppercase text-red-500 hover:text-red-600"
                                            >
                                                {t.filtros.limparPartes}
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {gruposPartes.map((grupo) => (
                                            <div key={grupo.key}>
                                                <p className="px-1 pb-1 text-[10px] font-black uppercase text-gray-400">
                                                    {grupo.labels?.[lang] || grupo.labels?.pt}
                                                </p>
                                                <div className="space-y-1">
                                                    {grupo.capabilities.map((parte) => {
                                                        const checked = filtrosPartesAtivas.includes(parte.key);
                                                        return (
                                                            <button
                                                                key={parte.key}
                                                                type="button"
                                                                onClick={() => toggleFiltroParte(parte.key)}
                                                                className={`w-full min-h-10 rounded-xl border px-3 py-2 text-left text-xs font-bold transition flex items-center gap-2 ${checked ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/60'}`}
                                                            >
                                                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                                                                    <Check size={13} />
                                                                </span>
                                                                <span className="leading-snug">{parte.labels?.[lang] || parte.labels?.pt}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Ordenação */}
                        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-gray-50 w-full lg:w-auto shrink-0">
                            <button onClick={() => setOrdenacao(ordenacao === 'nome' ? 'maisDias' : 'nome')} className="flex-1 lg:flex-none py-3 lg:py-2 px-4 text-[10px] font-black uppercase hover:bg-white transition truncate">{ordenacao === 'nome' ? t.ordem.nome : t.ordem.dias}</button>
                            <button onClick={() => setOrdemCrescente(!ordemCrescente)} className="py-3 lg:py-2 px-4 border-l border-gray-200 hover:bg-white text-gray-500 transition shrink-0 flex items-center justify-center">{ordemCrescente ? <SortAsc size={16} /> : <SortDesc size={16} />}</button>
                        </div>

                        {/* Botão Vermelho Gigante de Limpar Filtros */}
                        {hasActiveFilters && (
                            <button
                                onClick={limparFiltros}
                                className="w-full lg:w-auto py-3 lg:py-2 px-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-red-100 transition shadow-sm animate-in fade-in zoom-in shrink-0"
                            >
                                <FilterX size={14} /> {t.limparFiltros}
                            </button>
                        )}
                    </div>

                    {/* Filtro por Tags de Privilégio */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-1">
                        {Object.keys(CARGOS_MAP).filter(k => (filtroGenero === 'todos' || CARGOS_MAP[k].gen === filtroGenero || CARGOS_MAP[k].gen === 'A')).map(key => (
                            <button key={key} onClick={() => setFiltrosTiposAtivos(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])} className={`px-4 py-2 lg:py-1.5 rounded-lg text-[10px] lg:text-[10px] font-bold whitespace-nowrap border transition-all ${filtrosTiposAtivos.includes(key) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                                {CARGOS_MAP[key][lang]}
                            </button>
                        ))}
                    </div>
                </div>

            </div>

            {/* LISTAGEM DOS ALUNOS */}
            <div className={viewMode === 'grid' ? "print-area grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3" : "print-area space-y-2"}>
                {alunosProcessados.length > 0 ? (
                    alunosProcessados.map(aluno => (
                        viewMode === 'grid' ?
                            <AlunoCard key={aluno.id} aluno={aluno} cargosMap={CARGOS_MAP} lang={lang} t={t} onEdit={openEditar} onHistory={(a) => { setAlunoHistorico(a); setModalHistoryOpen(true); }} onDelete={handleExcluir} onCopyPublicLink={handleCopiarLinkQuadro} />
                            :
                            <AlunoListItem key={aluno.id} aluno={aluno} cargosMap={CARGOS_MAP} lang={lang} t={t} onEdit={openEditar} onHistory={(a) => { setAlunoHistorico(a); setModalHistoryOpen(true); }} onDelete={handleExcluir} onCopyPublicLink={handleCopiarLinkQuadro} />
                    ))
                ) : (
                    <div className="col-span-full py-10 flex flex-col items-center justify-center text-gray-400 no-print">
                        <UsersRound size={48} className="mb-3 opacity-20" />
                        <p className="text-sm font-bold text-center">{t.msg.vazioTitulo}</p>
                        <p className="text-xs mt-1 text-center px-4">{t.msg.vazioDescricao}</p>
                        {hasActiveFilters && (
                            <button onClick={limparFiltros} className="mt-4 px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition">{t.msg.limparTodosFiltros}</button>
                        )}
                    </div>
                )}
            </div>

            <ModalHistorico
                aluno={alunoHistorico}
                isOpen={modalHistoryOpen}
                onClose={() => { setModalHistoryOpen(false); setAlunoHistorico(null); }}
                t={t}
                lang={lang}
                onUpdateAluno={async (alunoAtualizado) => {
                    // Mantem a visualizacao do modal atualizada instantaneamente.
                    setAlunoHistorico(alunoAtualizado);

                    try {
                        if (onSalvarAluno) {
                            await Promise.resolve(onSalvarAluno(alunoAtualizado));
                            return;
                        }

                        const novaLista = alunos.map(a => a.id === alunoAtualizado.id ? alunoAtualizado : a);
                        await Promise.resolve(setAlunos(novaLista));
                    } catch (error) {
                        toast.error(error, t.msg.erroAtualizar);
                    }
                }}
            />
            {modalFormOpen && alunoEmEdicao && (
                <ModalFormulario alunoEmEdicao={alunoEmEdicao} setAlunoEmEdicao={setAlunoEmEdicao} isOpen={modalFormOpen} onClose={() => setModalFormOpen(false)} onSave={handleSalvar} cargosMap={CARGOS_MAP} lang={lang} t={t} familiasOptions={familiasOptions} isSaving={salvandoAluno} />
            )}
        </div>
    );
};

export default ListaAlunos;
