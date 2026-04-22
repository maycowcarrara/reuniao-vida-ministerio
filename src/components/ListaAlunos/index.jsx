import React, { useEffect, useMemo, useState } from 'react';
import { Search, UsersRound, User, UserRound, FilterX, FileJson, Download, FileText, FileSpreadsheet, Printer, ChevronDown, LayoutGrid, List, SortAsc, SortDesc, Calendar, AlertCircle, Plus, SlidersHorizontal, X } from 'lucide-react';
import AlunoCard from './AlunoCard';
import AlunoListItem from './AlunoListItem';
import ModalHistorico from './ModalHistorico';
import ModalFormulario from './ModalFormulario';
import { CARGOS_MAP_FALLBACK, TRANSLATIONS, normalizarIdioma, normalizar, getCargoKey, getUltimoRegistro, calcularDias, verificarAusenciaAtiva } from './utils';
import { toast } from '../../utils/toast';

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

const ListaAlunos = ({ alunos, setAlunos, onExcluirAluno, config, cargosMap }) => {
    const CARGOS_MAP = cargosMap || CARGOS_MAP_FALLBACK;
    const lang = normalizarIdioma(config?.idioma);
    const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;

    // Estados de Filtro
    const [termo, setTermo] = useState('');
    const [filtrosTiposAtivos, setFiltrosTiposAtivos] = useState([]);
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
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    // Dados em Edição/Visualização
    const [alunoEmEdicao, setAlunoEmEdicao] = useState(null);
    const [alunoHistorico, setAlunoHistorico] = useState(null);

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
                if (modalHistoryOpen) setModalHistoryOpen(false);
                if (modalFormOpen) setModalFormOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menuExportOpen, modalHistoryOpen, modalFormOpen]);

    // Calcular Estatísticas Iniciais (Ignorando Filtros)
    const stats = useMemo(() => {
        const ativos = (alunos || []).filter(a => a.tipo !== 'desab');
        let irmaos = 0, irmas = 0, ausentes = 0, atrasados = 0;

        ativos.forEach(a => {
            const gen = CARGOS_MAP[getCargoKey(a.tipo, CARGOS_MAP)]?.gen;
            if (gen === 'M') irmaos++;
            if (gen === 'F') irmas++;
            if (verificarAusenciaAtiva(a)) ausentes++;

            const ult = getUltimoRegistro(a);
            const d = calcularDias(ult.data);
            if (d !== null && d > 60) atrasados++;
        });

        return { total: ativos.length, irmaos, irmas, ausentes, atrasados };
    }, [alunos, CARGOS_MAP]);

    // Lógica para saber se há NENHUM filtro ativo
    const hasActiveFilters = termo !== '' || filtrosTiposAtivos.length > 0 || filtroGenero !== 'todos' || filtroEspecial !== 'todos' || filtroStatus !== 'todos';

    const limparFiltros = () => {
        setTermo('');
        setFiltrosTiposAtivos([]);
        setFiltroGenero('todos');
        setFiltroEspecial('todos');
        setFiltroStatus('todos');
    };

    // Processamento da Lista Final Baseada nos Filtros
    const alunosProcessados = useMemo(() => {
        const buscaNorm = normalizar(termo);
        return (alunos || [])
            .filter(a => {
                const cKey = getCargoKey(a.tipo, CARGOS_MAP);
                const info = CARGOS_MAP[cKey] || CARGOS_MAP.irmao;

                // 1. Busca por Texto
                const matchBusca = normalizar(a.nome).includes(buscaNorm) || normalizar(info.pt).includes(buscaNorm) || normalizar(info.es).includes(buscaNorm) || normalizar(a.observacoes || '').includes(buscaNorm);
                if (!matchBusca) return false;

                // 2. Filtro de Status
                if (filtroStatus === 'ativos' && cKey === 'desab') return false;

                // 3. Filtro de Gênero
                if (filtroGenero !== 'todos' && info.gen !== filtroGenero) return false;

                // 4. Filtro de Tipo (Privilégio)
                if (filtrosTiposAtivos.length > 0 && !filtrosTiposAtivos.includes(cKey)) return false;

                // 5. Filtro Especial
                if (filtroEspecial === 'ausentes' && !verificarAusenciaAtiva(a)) return false;
                if (filtroEspecial === 'atrasados') {
                    const ult = getUltimoRegistro(a);
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
                const ultA = getUltimoRegistro(a);
                const ultB = getUltimoRegistro(b);
                const diasA = calcularDias(ultA.data) ?? 999999;
                const diasB = calcularDias(ultB.data) ?? 999999;
                const res = diasA - diasB;
                return ordemCrescente ? res : res * -1;
            });
    }, [alunos, termo, filtroStatus, filtrosTiposAtivos, filtroGenero, filtroEspecial, ordenacao, ordemCrescente, CARGOS_MAP]);

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
            // AQUI É A GRANDE SACADA: 
            // O Backup JSON ignora `alunosProcessados` (os visíveis na tela) e força a exportação de `alunos` (o banco de dados bruto e completo, com todos os dados e imagens intactas).
            baixar(new Blob([JSON.stringify({ alunos: alunos }, null, 2)], { type: 'application/json' }), t.exportFiles.json);
        }
        else {
            // Para CSV e TXT, exportamos só o que foi filtrado na tela
            const rows = alunosProcessados.map(a => {
                const ult = getUltimoRegistro(a);
                return {
                    [t.exportFields.nome]: a.nome,
                    [t.exportFields.cargo]: (CARGOS_MAP[getCargoKey(a.tipo, CARGOS_MAP)] || CARGOS_MAP.irmao)[lang],
                    [t.exportFields.whatsapp]: a.telefone || t.exportFields.naoInformado,
                    [t.exportFields.email]: a.email || t.exportFields.naoInformado,
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
        setAlunoEmEdicao({ id: null, nome: '', tipo: 'irma', telefone: '', email: '', observacoes: '', historico: [], datasIndisponiveis: [] });
        setModalFormOpen(true);
    };

    const openEditar = (aluno) => {
        setAlunoEmEdicao({ ...aluno, tipo: getCargoKey(aluno.tipo, CARGOS_MAP), telefone: aluno.telefone || '', email: aluno.email || '', observacoes: aluno.observacoes || '', historico: Array.isArray(aluno.historico) ? aluno.historico : [], datasIndisponiveis: Array.isArray(aluno.datasIndisponiveis) ? aluno.datasIndisponiveis : [] });
        setModalFormOpen(true);
    };

    const handleSalvar = async (e) => {
        e.preventDefault();
        const clean = { ...alunoEmEdicao, nome: (alunoEmEdicao.nome || '').trim(), telefone: (alunoEmEdicao.telefone || '').trim(), email: (alunoEmEdicao.email || '').trim(), observacoes: (alunoEmEdicao.observacoes || '').trim(), tipo: alunoEmEdicao.tipo || 'irma', datasIndisponiveis: alunoEmEdicao.datasIndisponiveis || [] };
        if (!clean.nome) return;
        const isNovoAluno = !clean.id;

        try {
            if (isNovoAluno) {
                const maxId = Math.max(0, ...(alunos || []).map(a => Number(a.id) || 0));
                await Promise.resolve(setAlunos([...(alunos || []), { ...clean, id: String(maxId + 1) }]));
            } else {
                await Promise.resolve(setAlunos((alunos || []).map(a => a.id === clean.id ? clean : a)));
            }

            setModalFormOpen(false);
            toast.success(isNovoAluno ? t.msg.cadastradoSucesso : t.msg.atualizadoSucesso);
        } catch (error) {
            toast.error(error, isNovoAluno ? t.msg.erroCadastrar : t.msg.erroAtualizar);
        }
    };

    const handleExcluir = async (aluno) => {
        if (aluno.tipo !== 'desab') return alert(t.msg.erroSoDesabilitados);
        if (window.confirm(t.msg.confirmarExclusao)) {
            if (onExcluirAluno) await onExcluirAluno(aluno.id);
            setAlunos(alunos.filter(a => a.id !== aluno.id));
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
            window.prompt('Copie o link do quadro:', link);
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
                        isActive={!hasActiveFilters || (hasActiveFilters && filtroStatus === 'ativos' && termo === '' && filtrosTiposAtivos.length === 0 && filtroGenero === 'todos' && filtroEspecial === 'todos')}
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
                onUpdateAluno={(alunoAtualizado) => {
                    // Atualiza a lista principal e manda salvar no banco de dados
                    const novaLista = alunos.map(a => a.id === alunoAtualizado.id ? alunoAtualizado : a);
                    setAlunos(novaLista);
                    // Mantém a visualização do modal atualizada instantaneamente
                    setAlunoHistorico(alunoAtualizado);
                }}
            />
            {modalFormOpen && alunoEmEdicao && (
                <ModalFormulario alunoEmEdicao={alunoEmEdicao} setAlunoEmEdicao={setAlunoEmEdicao} isOpen={modalFormOpen} onClose={() => setModalFormOpen(false)} onSave={handleSalvar} cargosMap={CARGOS_MAP} lang={lang} t={t} />
            )}
        </div>
    );
};

export default ListaAlunos;
