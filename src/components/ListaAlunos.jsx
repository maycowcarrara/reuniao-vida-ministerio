import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Search, Edit2, Clock, User, Phone, Mail,
    X, History, UserPlus, SortAsc, SortDesc, Globe, UsersRound, UserRound,
    FilterX, FileJson, Download, FileText, FileSpreadsheet, Printer, ChevronDown,
    LayoutGrid, List, StickyNote, Trash2
} from 'lucide-react';

// --- MAPEADOR DE CARGOS ---
const CARGOS_MAP_FALLBACK = {
    anciao: { pt: "Ancião", es: "Anciano", cor: "bg-blue-100 text-blue-700 border-blue-200", gen: 'M' },
    servo: { pt: "Servo Ministerial", es: "Siervo Ministerial", cor: "bg-indigo-100 text-indigo-700 border-indigo-200", gen: 'M' },
    irmao_hab: { pt: "Varão Habilitado", es: "Varón Habilitado", cor: "bg-cyan-100 text-cyan-700 border-cyan-200", gen: 'M' },
    irmao: { pt: "Irmão", es: "Hermano", cor: "bg-gray-100 text-gray-700 border-gray-200", gen: 'M' },
    irma_exp: { pt: "Irmã Experiente", es: "Hermana Experta", cor: "bg-purple-100 text-purple-700 border-purple-200", gen: 'F' },
    irma_lim: { pt: "Irmã Limitada", es: "Hermana Limitada", cor: "bg-orange-100 text-orange-700 border-orange-200", gen: 'F' },
    irma: { pt: "Irmã", es: "Hermana", cor: "bg-pink-100 text-pink-700 border-pink-200", gen: 'F' },
    desab: { pt: "Desabilitado", es: "Deshabilitado", cor: "bg-gray-200 text-gray-500 border-gray-300", gen: 'A' }
};

const TRANSLATIONS = {
    pt: {
        titulo: "Lista de Alunos",
        buscaPlaceholder: "Nome ou cargo...",
        novo: "Novo",
        registros: "registros",
        exportar: "Exportar",
        visualizacao: { grade: "Grade", lista: "Lista" },
        ordem: { nome: "Nome", dias: "Tempo" },
        campos: {
            nome: "Nome do Aluno",
            tipo: "Privilégio / Tipo",
            tel: "WhatsApp",
            mail: "E-mail",
            obs: "Observações"
        },
        card: { nunca: "Estreia", diasAtras: "dias atrás", com: "Com", semObs: "Sem observações" },
        modal: { editar: "Editar Aluno", novo: "Novo Cadastro", salvar: "Salvar", cancelar: "Cancelar", historico: "Histórico Completo", excluir: "Excluir" },
        filtros: { todos: "Todos" },
        msg: {
            confirmarExclusao: "Tem certeza que deseja excluir este aluno permanentemente?",
            erroSoDesabilitados: "Apenas alunos marcados como 'Desabilitado' podem ser excluídos."
        }
    },
    es: {
        titulo: "Lista de Estudiantes",
        buscaPlaceholder: "Nombre o cargo...",
        novo: "Nuevo",
        registros: "registros",
        exportar: "Exportar",
        visualizacao: { grade: "Cuadrícula", lista: "Lista" },
        ordem: { nome: "Nombre", dias: "Tiempo" },
        campos: {
            nome: "Nombre del Estudiante",
            tipo: "Privilegio / Tipo",
            tel: "WhatsApp",
            mail: "E-mail",
            obs: "Observaciones"
        },
        card: { nunca: "Estreno", diasAtras: "días atrás", com: "Con", semObs: "Sin observaciones" },
        modal: { editar: "Editar Estudiante", novo: "Nuevo Registro", salvar: "Guardar", cancelar: "Cancelar", historico: "Historial Completo", excluir: "Eliminar" },
        filtros: { todos: "Todos" },
        msg: {
            confirmarExclusao: "¿Está seguro de que desea eliminar a este estudiante permanentemente?",
            erroSoDesabilitados: "Solo los estudiantes marcados como 'Deshabilitado' pueden ser eliminados."
        }
    }
};

const normalizarIdioma = (idioma) => {
    const v = (idioma || '').toString().trim().toLowerCase();
    if (v.startsWith('pt')) return 'pt';
    if (v.startsWith('es')) return 'es';
    return 'pt';
};

const WHATSAPP_DEFAULT_TEXT = "Olá, {NOME}! Tudo bem?";

const ListaAlunos = ({ alunos, setAlunos, onExcluirAluno, config, cargosMap }) => {
    const CARGOS_MAP = cargosMap || CARGOS_MAP_FALLBACK;

    const lang = normalizarIdioma(config?.idioma);
    const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;

    const [termo, setTermo] = useState('');
    const [filtrosTiposAtivos, setFiltrosTiposAtivos] = useState([]);
    const [filtroGenero, setFiltroGenero] = useState('todos');
    const [ordenacao, setOrdenacao] = useState('nome');
    const [ordemCrescente, setOrdemCrescente] = useState(true);
    const [modalFormOpen, setModalFormOpen] = useState(false);
    const [modalHistoryOpen, setModalHistoryOpen] = useState(false);
    const [menuExportOpen, setMenuExportOpen] = useState(false);
    const [alunoEmEdicao, setAlunoEmEdicao] = useState(null);
    const [alunoHistorico, setAlunoHistorico] = useState(null);

    const [viewMode, setViewMode] = useState(() => {
        try { return localStorage.getItem('jw_alunos_view') || 'grid'; } catch { return 'grid'; }
    });

    const firstInputRef = useRef(null);

    useEffect(() => {
        try { localStorage.setItem('jw_alunos_view', viewMode); } catch { }
    }, [viewMode]);

    useEffect(() => {
        if (modalFormOpen) {
            setTimeout(() => firstInputRef.current?.focus(), 50);
        }
    }, [modalFormOpen]);

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

    // --- FUNÇÕES DE SUPORTE ---
    const normalizar = (texto) => texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

    const getCargoKey = (tipoStr) => {
        if (CARGOS_MAP[tipoStr]) return tipoStr;
        return Object.keys(CARGOS_MAP).find(k =>
            CARGOS_MAP[k].pt === tipoStr || CARGOS_MAP[k].es === tipoStr
        ) || 'irmao';
    };

    const getUltimoRegistro = (aluno) => {
        const hist = Array.isArray(aluno?.historico) ? aluno.historico : [];
        if (hist.length === 0) return { data: null, parte: null, ajudante: null };

        const ordenado = [...hist].sort((a, b) => {
            const da = a?.data ? new Date(a.data).getTime() : 0;
            const db = b?.data ? new Date(b.data).getTime() : 0;
            return db - da;
        });

        const last = ordenado[0] || {};
        return {
            data: last.data || null,
            parte: (last.parte || null)?.replace(/\s*\(com\s+.*\)/i, ""),
            ajudante: last.ajudante || null
        };
    };

    const calcularDias = (dataISO) => {
        if (!dataISO) return null;
        const d = new Date(dataISO);
        const hoje = new Date();
        const diff = hoje - d;
        return Math.floor(diff / 86400000);
    };

    const buildWhatsappHref = (telefone, nome) => {
        const raw = (telefone || '').toString();
        const digits = raw.replace(/\D/g, '');
        if (!digits) return null;
        const waNumber = (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
        const msg = encodeURIComponent(
            WHATSAPP_DEFAULT_TEXT.replace('{NOME}', (nome || '').toString().trim())
        );
        return `https://wa.me/${waNumber}?text=${msg}`;
    };

    const alunosProcessados = useMemo(() => {
        const buscaNorm = normalizar(termo);

        return (alunos || [])
            .filter(a => {
                const cKey = getCargoKey(a.tipo);
                const info = CARGOS_MAP[cKey] || CARGOS_MAP.irmao;

                const matchBusca =
                    normalizar(a.nome).includes(buscaNorm) ||
                    normalizar(info.pt).includes(buscaNorm) ||
                    normalizar(info.es).includes(buscaNorm) ||
                    normalizar(a.observacoes || '').includes(buscaNorm);

                if (!matchBusca) return false;
                if (filtroGenero !== 'todos' && info.gen !== filtroGenero) return false;
                if (filtrosTiposAtivos.length > 0 && !filtrosTiposAtivos.includes(cKey)) return false;

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
    }, [alunos, termo, filtrosTiposAtivos, filtroGenero, ordenacao, ordemCrescente]);

    // --- EXPORTAÇÃO ---
    const baixar = (blob, nome) => {
        const url = URL.createObjectURL(blob);
        const l = document.createElement('a');
        l.href = url;
        l.download = nome;
        l.click();
        URL.revokeObjectURL(url);
    };

    const handleExport = (tipo) => {
        const rows = alunosProcessados.map(a => {
            const ult = getUltimoRegistro(a);
            return {
                Nome: a.nome,
                Cargo: (CARGOS_MAP[getCargoKey(a.tipo)] || CARGOS_MAP.irmao)[lang],
                WhatsApp: a.telefone || "N/A",
                Email: a.email || "N/A",
                Observacoes: a.observacoes || "",
                Ult_Data: ult.data || "-",
                Ult_Parte: ult.parte || "-"
            };
        });

        if (tipo === 'json') {
            baixar(new Blob([JSON.stringify({ alunos: alunosProcessados }, null, 2)], { type: 'application/json' }), 'backup_alunos.json');
        } else if (tipo === 'csv') {
            if (rows.length === 0) return;
            const csv = [Object.keys(rows[0]).join(';'), ...rows.map(o => Object.values(o).join(';'))].join('\n');
            baixar(new Blob([csv], { type: 'text/csv' }), 'lista_alunos.csv');
        } else if (tipo === 'txt') {
            baixar(new Blob([rows.map(a => `ALUNO: ${a.Nome}\nCARGO: ${a.Cargo}\nCONTATO: ${a.WhatsApp}\nOBS: ${a.Observacoes || "-"}\n----------------`).join('\n')], { type: 'text/plain' }), 'relatorio.txt');
        } else {
            window.print();
        }
        setMenuExportOpen(false);
    };

    const openNovo = () => {
        const base = { id: null, nome: '', tipo: 'irma', telefone: '', email: '', observacoes: '', historico: [] };
        setAlunoEmEdicao(base);
        setModalFormOpen(true);
    };

    const openEditar = (aluno) => {
        const cKey = getCargoKey(aluno.tipo);
        setAlunoEmEdicao({
            ...aluno,
            tipo: cKey,
            telefone: aluno.telefone || '',
            email: aluno.email || '',
            observacoes: aluno.observacoes || '',
            historico: Array.isArray(aluno.historico) ? aluno.historico : []
        });
        setModalFormOpen(true);
    };

    const handleSalvar = (e) => {
        e.preventDefault();
        const clean = {
            ...alunoEmEdicao,
            nome: (alunoEmEdicao.nome || '').trim(),
            telefone: (alunoEmEdicao.telefone || '').trim(),
            email: (alunoEmEdicao.email || '').trim(),
            observacoes: (alunoEmEdicao.observacoes || '').trim(),
            tipo: alunoEmEdicao.tipo || 'irma'
        };

        if (!clean.nome) return;

        if (!clean.id) {
            const maxId = Math.max(0, ...(alunos || []).map(a => Number(a.id) || 0));
            const novo = { ...clean, id: maxId + 1 };
            setAlunos([...(alunos || []), novo]);
            setModalFormOpen(false);
            return;
        }

        setAlunos((alunos || []).map(a => a.id === clean.id ? clean : a));
        setModalFormOpen(false);
    };

    // --- LÓGICA DE EXCLUSÃO (Modificada para exigir status 'desab') ---
    const handleExcluir = async (aluno) => {
        // Verifica se é desabilitado
        if (aluno.tipo !== 'desab') {
            alert(t.msg.erroSoDesabilitados);
            return;
        }

        if (window.confirm(t.msg.confirmarExclusao)) {
            if (onExcluirAluno) await onExcluirAluno(aluno.id);
            const novaLista = alunos.filter(a => a.id !== aluno.id);
            setAlunos(novaLista);
        }
    };

    return (
        <div className="space-y-4 pb-10">
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
                .group-hover\\:opacity-100, .hover\\:shadow-md, .hover\\:shadow-lg { opacity: 1 !important; box-shadow: none !important; }
            }
            `}</style>

            {/* BARRA DE FILTROS */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-3 no-print">
                <div className="flex justify-between items-center gap-2">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <UsersRound size={20} className="text-blue-600" /> {t.titulo}
                        </h2>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                            {alunosProcessados.length} {t.registros}
                        </span>
                    </div>

                    <div className="flex gap-2 items-center">
                        <div className="flex border border-gray-100 rounded-xl overflow-hidden bg-gray-50/60">
                            <button type="button" onClick={() => setViewMode('grid')} className={`px-3 py-2 text-[10px] font-black uppercase flex items-center gap-1.5 transition ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white'}`} title={t.visualizacao.grade}>
                                <LayoutGrid size={14} /> {t.visualizacao.grade}
                            </button>
                            <button type="button" onClick={() => setViewMode('list')} className={`px-3 py-2 text-[10px] font-black uppercase flex items-center gap-1.5 border-l border-gray-100 transition ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white'}`} title={t.visualizacao.lista}>
                                <List size={14} /> {t.visualizacao.lista}
                            </button>
                        </div>

                        <button onClick={openNovo} className="bg-blue-600 text-white px-3 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-blue-500 transition" title={t.novo}>
                            {t.novo}
                        </button>

                        <div className="relative">
                            <button onClick={() => setMenuExportOpen(!menuExportOpen)} className="bg-blue-50 text-blue-600 px-3 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2">
                                <Download size={14} /> {t.exportar} <ChevronDown size={12} />
                            </button>
                            {menuExportOpen && (
                                <div className="absolute right-0 mt-2 w-52 bg-white border rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in duration-150">
                                    <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2 border-b"><FileJson size={14} className="text-orange-500" /> JSON (Backup)</button>
                                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2 border-b"><FileSpreadsheet size={14} className="text-green-600" /> Excel (CSV)</button>
                                    <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2 border-b"><FileText size={14} className="text-blue-500" /> Texto Simples</button>
                                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 flex items-center gap-2"><Printer size={14} /> Imprimir Todos</button>
                                </div>
                            )}
                        </div>

                        <button onClick={() => { setTermo(''); setFiltrosTiposAtivos([]); setFiltroGenero('todos'); }} className="bg-gray-100 text-gray-400 p-2 rounded-xl hover:text-red-500 transition-colors" title="Limpar filtros">
                            <FilterX size={18} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 md:col-span-6 relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input type="text" placeholder={t.buscaPlaceholder} className="w-full pl-9 pr-4 py-2 border border-gray-100 rounded-xl outline-none text-xs bg-gray-50/50" value={termo} onChange={e => setTermo(e.target.value)} />
                    </div>
                    <div className="col-span-6 md:col-span-3 flex border border-gray-100 rounded-xl overflow-hidden bg-gray-50/50">
                        <button onClick={() => setOrdenacao(ordenacao === 'nome' ? 'maisDias' : 'nome')} className="flex-1 text-[10px] font-black uppercase hover:bg-white">{ordenacao === 'nome' ? t.ordem.nome : t.ordem.dias}</button>
                        <button onClick={() => setOrdemCrescente(!ordemCrescente)} className="px-2 border-l border-gray-100 hover:bg-white" title="Inverter ordem">{ordemCrescente ? <SortAsc size={14} /> : <SortDesc size={14} />}</button>
                    </div>
                    <div className="col-span-6 md:col-span-3 flex border border-gray-100 rounded-xl overflow-hidden bg-gray-50/50">
                        <button onClick={() => setFiltroGenero('M')} className={`flex-1 flex justify-center py-2 ${filtroGenero === 'M' ? 'bg-blue-500 text-white' : 'text-gray-400'}`} title="Masculino"><User size={16} /></button>
                        <button onClick={() => setFiltroGenero('F')} className={`flex-1 flex justify-center py-2 border-l border-gray-100 ${filtroGenero === 'F' ? 'bg-pink-500 text-white' : 'text-gray-400'}`} title="Feminino"><UserRound size={16} /></button>
                        <button onClick={() => setFiltroGenero('todos')} className={`flex-1 flex justify-center py-2 border-l border-gray-100 ${filtroGenero === 'todos' ? 'bg-gray-200 text-gray-700' : 'text-gray-400'}`} title="Todos"><Globe size={16} /></button>
                    </div>
                </div>

                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-gray-50">
                    {Object.keys(CARGOS_MAP)
                        .filter(k => (filtroGenero === 'todos' || CARGOS_MAP[k].gen === filtroGenero || CARGOS_MAP[k].gen === 'A'))
                        .map(key => (
                            <button key={key} onClick={() => setFiltrosTiposAtivos(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all ${filtrosTiposAtivos.includes(key) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-100'}`}>
                                {CARGOS_MAP[key][lang]}
                            </button>
                        ))}
                </div>
            </div>

            {/* LISTAGEM */}
            {viewMode === 'grid' ? (
                <div className="print-area grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {alunosProcessados.map(aluno => {
                        const cKey = getCargoKey(aluno.tipo);
                        const info = CARGOS_MAP[cKey] || CARGOS_MAP.irmao;
                        const ult = getUltimoRegistro(aluno);
                        const d = calcularDias(ult.data);
                        const whatsappHref = buildWhatsappHref(aluno.telefone, aluno.nome);
                        // Verifica se pode excluir (apenas desabilitados)
                        const podeExcluir = aluno.tipo === 'desab';

                        return (
                            <div key={aluno.id} className="print-card bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden group">
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${info.gen === 'F' ? 'bg-pink-400' : 'bg-blue-500'}`} />
                                <div className="flex justify-between items-start mb-2">
                                    <div className="min-w-0 pr-1 flex-1">
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight break-words pr-5">{aluno.nome}</h3>
                                        <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md border mt-1.5 inline-block tracking-tighter ${info.cor}`}>{info[lang]}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all no-print">
                                        <button onClick={() => openEditar(aluno)} className="p-1.5 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-lg border shadow-sm" title={t.modal.editar}><Edit2 size={12} /></button>
                                        <button onClick={() => { setAlunoHistorico(aluno); setModalHistoryOpen(true); }} className="p-1.5 bg-gray-50 text-gray-400 hover:text-orange-500 rounded-lg border shadow-sm" title={t.modal.historico}><History size={12} /></button>

                                        {/* BOTÃO EXCLUIR CONDICIONAL (Grade) */}
                                        <button
                                            onClick={() => handleExcluir(aluno)}
                                            className={`p-1.5 rounded-lg border shadow-sm transition-colors ${podeExcluir ? "bg-white text-red-500 hover:bg-red-50 border-red-100" : "bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed"}`}
                                            title={podeExcluir ? t.modal.excluir : t.msg.erroSoDesabilitados}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                {/* Resto do card (contatos, obs, data) */}
                                <div className="space-y-1 mb-3 text-[11px] font-medium text-gray-500 pl-1">
                                    {aluno.telefone && (whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="flex items-center gap-1.5" title="WhatsApp"><Phone size={11} className="text-green-500" /> {aluno.telefone}</a> : <div className="flex items-center gap-1.5"><Phone size={11} className="text-green-500" /> {aluno.telefone}</div>)}
                                    {aluno.email && <a href={`mailto:${aluno.email}`} className="flex items-center gap-2 text-[10px] truncate" title="E-mail"><Mail size={11} className="text-blue-400" /> {aluno.email}</a>}
                                    <div className="flex items-start gap-1.5 text-[10px] text-gray-500"><StickyNote size={11} className="text-gray-400 mt-[1px]" /><p className={`leading-snug ${aluno.observacoes ? 'text-gray-600' : 'text-gray-300 italic'} line-clamp-2`}>{aluno.observacoes ? aluno.observacoes : t.card.semObs}</p></div>
                                </div>
                                <div className="mt-auto pt-2 border-t border-gray-50 bg-gray-50/30 -mx-3 px-3">
                                    <div className="flex justify-between items-center text-[10px] mb-0.5">
                                        <span className={`font-bold flex items-center gap-1 ${d === null ? 'text-gray-300' : d < 60 ? 'text-green-600' : 'text-red-500'}`}><Clock size={10} /> {d !== null ? `${d}d` : t.card.nunca}</span>
                                        <span className="text-gray-400 font-mono text-[9px] font-bold">{ult.data ? ult.data.split('-').reverse().slice(0, 2).join('/') : '--/--'}</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-600 truncate leading-tight">{ult.parte || t.card.nunca}</p>
                                    {ult.ajudante && <p className="text-[9px] text-blue-500 mt-1 italic flex items-center gap-1 font-bold"><UserPlus size={9} /> {t.card.com}: {ult.ajudante}</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="print-area space-y-2">
                    {alunosProcessados.map(aluno => {
                        const cKey = getCargoKey(aluno.tipo);
                        const info = CARGOS_MAP[cKey] || CARGOS_MAP.irmao;
                        const ult = getUltimoRegistro(aluno);
                        const d = calcularDias(ult.data);
                        const whatsappHref = buildWhatsappHref(aluno.telefone, aluno.nome);
                        // Verifica se pode excluir (apenas desabilitados)
                        const podeExcluir = aluno.tipo === 'desab';

                        return (
                            <div key={aluno.id} className="print-card bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden group">
                                <div className={`w-1.5 self-stretch rounded-full ${info.gen === 'F' ? 'bg-pink-400' : 'bg-blue-500'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-gray-800 text-sm truncate">{aluno.nome}</h3>
                                                <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md border inline-block tracking-tighter ${info.cor}`}>{info[lang]}</span>
                                            </div>
                                            <div className="mt-1 text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                                                {aluno.telefone && (whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="flex items-center gap-1" title="WhatsApp"><Phone size={12} className="text-green-500" /> {aluno.telefone}</a> : <span className="flex items-center gap-1"><Phone size={12} className="text-green-500" /> {aluno.telefone}</span>)}
                                                {aluno.email && <a href={`mailto:${aluno.email}`} className="flex items-center gap-1 truncate" title="E-mail"><Mail size={12} className="text-blue-400" /> {aluno.email}</a>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-[10px] font-black flex items-center gap-1 ${d === null ? 'text-gray-300' : d < 60 ? 'text-green-600' : 'text-red-500'}`}><Clock size={12} /> {d !== null ? `${d}d` : t.card.nunca}</span>
                                            <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-all no-print">
                                                <button onClick={() => openEditar(aluno)} className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl border shadow-sm" title={t.modal.editar}><Edit2 size={14} /></button>
                                                <button onClick={() => { setAlunoHistorico(aluno); setModalHistoryOpen(true); }} className="p-2 bg-gray-50 text-gray-400 hover:text-orange-500 rounded-xl border shadow-sm" title={t.modal.historico}><History size={14} /></button>

                                                {/* BOTÃO EXCLUIR CONDICIONAL (Lista) */}
                                                <button
                                                    onClick={() => handleExcluir(aluno)}
                                                    className={`p-2 rounded-xl border shadow-sm transition-colors ${podeExcluir ? "bg-white text-red-500 hover:bg-red-50 border-red-100" : "bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed"}`}
                                                    title={podeExcluir ? t.modal.excluir : t.msg.erroSoDesabilitados}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-start gap-2 text-[11px]"><StickyNote size={14} className="text-gray-400 mt-[1px]" /><p className={`${aluno.observacoes ? 'text-gray-700' : 'text-gray-300 italic'} leading-snug line-clamp-2`}>{aluno.observacoes ? aluno.observacoes : t.card.semObs}</p></div>
                                    <div className="mt-2 pt-2 border-t border-gray-50 text-[11px] text-gray-600"><span className="font-bold">{ult.parte || t.card.nunca}</span>{ult.data && <span className="ml-2 font-mono text-[10px] text-gray-400">({ult.data.split('-').reverse().slice(0, 2).join('/')})</span>}{ult.ajudante && <span className="ml-2 text-blue-500 italic font-bold">• {t.card.com}: {ult.ajudante}</span>}</div>
                                    <div className="flex sm:hidden gap-2 mt-3 no-print">
                                        <button onClick={() => openEditar(aluno)} className="flex-1 py-2 rounded-xl border bg-gray-50 text-gray-700 font-black text-[10px] uppercase">{t.modal.editar}</button>
                                        <button onClick={() => { setAlunoHistorico(aluno); setModalHistoryOpen(true); }} className="flex-1 py-2 rounded-xl border bg-orange-50 text-orange-700 font-black text-[10px] uppercase">{t.modal.historico}</button>

                                        {/* BOTÃO EXCLUIR CONDICIONAL (Mobile) */}
                                        <button
                                            onClick={() => handleExcluir(aluno)}
                                            className={`flex-1 py-2 rounded-xl border font-black text-[10px] uppercase ${podeExcluir ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
                                        >
                                            {t.modal.excluir}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL HISTÓRICO */}
            {modalHistoryOpen && alunoHistorico && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalHistoryOpen(false); }}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-orange-500 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-sm flex items-center gap-2"><History size={18} /> {t.modal.historico}</h3>
                            <button onClick={() => setModalHistoryOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
                            <p className="font-black text-gray-800 border-b pb-2 mb-2">{alunoHistorico.nome}</p>
                            {(alunoHistorico.historico || []).map((h, i) => (
                                <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                                    <div className="pr-4"><p className="font-bold text-gray-700">{h.parte}</p>{h.ajudante && <p className="text-[10px] text-blue-500 italic font-bold mt-1">{t.card.com}: {h.ajudante}</p>}</div>
                                    <span className="text-[10px] font-bold font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{h.data?.split('-').reverse().join('/')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EDITAR/NOVO */}
            {modalFormOpen && alunoEmEdicao && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalFormOpen(false); }}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-5 flex justify-between items-center text-white">
                            <div><h3 className="font-black text-sm leading-tight">{alunoEmEdicao.id ? t.modal.editar : t.modal.novo}</h3><p className="text-[10px] opacity-80 mt-1">{alunoEmEdicao.id ? `ID #${alunoEmEdicao.id}` : '—'}</p></div>
                            <button onClick={() => setModalFormOpen(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSalvar} className="p-6 space-y-4">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.nome}</label><input ref={firstInputRef} required type="text" className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold border border-gray-100 focus:border-blue-600 outline-none" value={alunoEmEdicao.nome} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, nome: e.target.value })} /></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.tipo}</label><select className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-black text-blue-700 border border-gray-100 outline-none focus:border-blue-600" value={alunoEmEdicao.tipo} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, tipo: e.target.value })}>{Object.keys(CARGOS_MAP).map(key => (<option key={key} value={key}>{CARGOS_MAP[key][lang]}</option>))}</select></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.tel}</label><input type="text" className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold border border-gray-100 outline-none focus:border-blue-600" value={alunoEmEdicao.telefone || ""} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, telefone: e.target.value })} placeholder="(xx) xxxxx-xxxx" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.mail}</label><input type="email" className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold border border-gray-100 outline-none focus:border-blue-600" value={alunoEmEdicao.email || ""} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, email: e.target.value })} placeholder="email@exemplo.com" /></div>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.obs}</label><textarea rows={3} className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-semibold border border-gray-100 outline-none focus:border-blue-600 resize-none" value={alunoEmEdicao.observacoes || ""} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, observacoes: e.target.value })} placeholder={lang === 'pt' ? 'Ex.: horários, limitações, preferências...' : 'Ej.: horarios, limitaciones, preferencias...'} /></div>
                            <div className="flex gap-2 justify-end pt-2"><button type="button" onClick={() => setModalFormOpen(false)} className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase hover:text-gray-600">{t.modal.cancelar}</button><button type="submit" className="bg-blue-700 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all hover:bg-blue-600">{t.modal.salvar}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ListaAlunos;