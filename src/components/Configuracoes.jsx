import React, { useState, useRef, useEffect } from 'react';
import {
    Settings,
    Download,
    Upload,
    AlertTriangle,
    FileJson,
    Building2,
    Calendar as CalendarIcon,
    Clock,
    Globe,
    ChevronDown,
    CheckCircle,
    X
} from 'lucide-react';
import { toast } from '../utils/toast';
import { useSectionMessages } from '../i18n';
import { getWeekdayOptions, normalizeLanguage, normalizeMeetingDay } from '../config/appConfig';

export default function Configuracoes({ dados, salvarAlteracao, lang, importarBackup, resetarConta }) {
    const fileInputRef = useRef(null);
    const [processando, setProcessando] = useState(false);
    const [backupPreview, setBackupPreview] = useState(null);

    // ESTADO LOCAL para o nome da congregação (Evita o "piscar" das letras)
    const [nomeCongLocal, setNomeCongLocal] = useState('');

    // Sincroniza o estado local quando os dados da nuvem chegam
    useEffect(() => {
        if (dados?.configuracoes?.nome_cong) {
            setNomeCongLocal(dados.configuracoes.nome_cong);
        }
    }, [dados?.configuracoes?.nome_cong]);

    const T = useSectionMessages('configuracoes');
    const activeLocale = normalizeLanguage(lang);
    const isPortugueseActive = activeLocale === 'pt';
    const isSpanishActive = activeLocale === 'es';
    const meetingDay = normalizeMeetingDay(dados?.configuracoes?.dia_reuniao);
    const weekdayOptions = getWeekdayOptions(lang);
    const previewTexts = activeLocale === 'es'
        ? {
            titulo: 'Revisar restauración',
            desc: 'Confirma el contenido antes de reemplazar los datos actuales.',
            alunos: 'estudiantes',
            semanas: 'semanas',
            config: 'configuración',
            arquivo: 'archivo',
            cancelar: 'Cancelar',
            confirmar: 'Restaurar ahora',
            semConfig: 'sin configuración'
        }
        : {
            titulo: 'Revisar restauração',
            desc: 'Confira o conteúdo antes de substituir os dados atuais.',
            alunos: 'alunos',
            semanas: 'semanas',
            config: 'configuração',
            arquivo: 'arquivo',
            cancelar: 'Cancelar',
            confirmar: 'Restaurar agora',
            semConfig: 'sem configuração'
        };
    const atualizarConfig = (campo, valor) => {
        salvarAlteracao({
            ...dados,
            configuracoes: { ...dados.configuracoes, [campo]: valor }
        });
    };

    // --- 1. EXPORTAR (DOWNLOAD) ---
    const realizarBackup = () => {
        const dataStr = new Date().toISOString().split('T')[0];
        const nomeArquivo = `backup_congregacao_${dataStr}.json`;

        const backupCompleto = {
            meta_dados: {
                versao: "2.1 (Firebase)",
                data_exportacao: new Date().toISOString(),
                origem: "Sistema Web"
            },
            configuracoes: dados.configuracoes || {},
            alunos: dados.alunos || [],
            historico_reunioes: dados.historico_reunioes || []
        };

        const jsonString = JSON.stringify(backupCompleto, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- 2. GATILHO PARA ABRIR O SELETOR DE ARQUIVOS ---
    const abrirSeletorArquivo = () => {
        fileInputRef.current.click();
    };

    const montarPreviewBackup = (jsonImportado, fileName = '') => {
        const dadosImport = jsonImportado.dadosSistema || jsonImportado;
        const alunos = Array.isArray(dadosImport.alunos) ? dadosImport.alunos : [];
        const programacao = Array.isArray(dadosImport.historico_reunioes) ? dadosImport.historico_reunioes :
            Array.isArray(dadosImport.historicoreunioes) ? dadosImport.historicoreunioes :
                Array.isArray(jsonImportado.listaProgramacoes) ? jsonImportado.listaProgramacoes : [];
        const configuracoes = dadosImport.configuracoes || {};

        return {
            fileName,
            json: jsonImportado,
            alunos: alunos.length,
            semanas: programacao.length,
            configuracoes: Object.keys(configuracoes).length,
            nomeCong: configuracoes.nome_cong || ''
        };
    };

    // --- 3. PROCESSAR O ARQUIVO SELECIONADO ---
    const handleArquivoSelecionado = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const jsonImportado = JSON.parse(text);
            setBackupPreview(montarPreviewBackup(jsonImportado, file.name));
            e.target.value = '';

        } catch (error) {
            console.error(error);
            toast.error(error, T.erro.trim());
        }
    };

    const confirmarRestauracaoPreview = async () => {
        if (!backupPreview?.json) return;

        setProcessando(true);
        try {
            if (resetarConta) {
                await resetarConta();
            }

            await importarBackup(backupPreview.json);

            toast.success(T.sucesso);
            setBackupPreview(null);
        } catch (error) {
            console.error(error);
            toast.error(error, T.erro.trim());
        } finally {
            setProcessando(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6 px-3 pt-3 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:p-6">

            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleArquivoSelecionado}
            />

            {backupPreview && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">{previewTexts.titulo}</h3>
                                <p className="mt-1 text-sm text-slate-500">{previewTexts.desc}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setBackupPreview(null)}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 p-5">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                                <span className="uppercase tracking-widest">{previewTexts.arquivo}</span>
                                <p className="mt-1 truncate text-sm text-slate-800">{backupPreview.fileName}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-center">
                                    <p className="text-2xl font-black text-blue-800">{backupPreview.alunos}</p>
                                    <p className="text-[10px] font-black uppercase text-blue-500">{previewTexts.alunos}</p>
                                </div>
                                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-center">
                                    <p className="text-2xl font-black text-indigo-800">{backupPreview.semanas}</p>
                                    <p className="text-[10px] font-black uppercase text-indigo-500">{previewTexts.semanas}</p>
                                </div>
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                                    <p className="text-2xl font-black text-emerald-800">{backupPreview.configuracoes ? <CheckCircle className="mx-auto mt-1" size={22} /> : '0'}</p>
                                    <p className="text-[10px] font-black uppercase text-emerald-500">{previewTexts.config}</p>
                                </div>
                            </div>

                            <p className="rounded-2xl bg-rose-50 p-3 text-xs font-bold leading-relaxed text-rose-700">
                                {T.confirmarRestauracao}
                            </p>
                        </div>

                        <div className="flex gap-2 border-t border-slate-100 p-5">
                            <button
                                type="button"
                                onClick={() => setBackupPreview(null)}
                                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                            >
                                {previewTexts.cancelar}
                            </button>
                            <button
                                type="button"
                                onClick={confirmarRestauracaoPreview}
                                disabled={processando}
                                className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 disabled:bg-rose-300"
                            >
                                {processando ? T.processando : previewTexts.confirmar}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3 mb-6 sm:mb-8">
                <div className="bg-blue-600 p-2.5 sm:p-3 rounded-2xl shadow-lg shadow-blue-200 shrink-0">
                    <Settings className="text-white w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{T.titulo}</h2>
                    <p className="text-xs sm:text-sm font-medium text-slate-500">{T.subtitulo}</p>
                </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] shadow-sm border border-slate-100 space-y-5 sm:space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>

                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2 sm:mb-4">
                    {T.preferenciasGerais}
                </h3>

                <div className="space-y-4 sm:space-y-5">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                            {T.congregacao}
                        </label>
                        <div className="relative">
                            <Building2 size={18} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder={T.placeholderCongregacao}
                                value={nomeCongLocal}
                                onChange={(e) => setNomeCongLocal(e.target.value)}
                                onBlur={() => atualizarConfig('nome_cong', nomeCongLocal)}
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-800 font-bold text-base sm:text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                                {T.dia}
                            </label>
                            <div className="relative">
                                <CalendarIcon size={18} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                                <select
                                    value={meetingDay}
                                    onChange={(e) => atualizarConfig('dia_reuniao', e.target.value)}
                                    className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-800 font-bold appearance-none cursor-pointer text-base sm:text-sm"
                                >
                                    {weekdayOptions.map((day) => (
                                        <option key={day.value} value={day.value}>
                                            {day.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={18} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                                {T.horario}
                            </label>
                            <div className="relative">
                                <Clock size={18} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    type="time"
                                    value={dados?.configuracoes?.horario || '19:30'}
                                    onChange={(e) => atualizarConfig('horario', e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-800 font-bold cursor-pointer text-base sm:text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4 sm:mb-5">
                    <Globe size={18} className="text-indigo-500" /> {T.idioma}
                </h3>

                <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-row gap-1">
                    <button
                        onClick={() => atualizarConfig('idioma', 'pt')}
                        className={`flex-1 py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${isPortugueseActive ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        🇧🇷 Português
                    </button>
                    <button
                        onClick={() => atualizarConfig('idioma', 'es')}
                        className={`flex-1 py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${isSpanishActive ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        🇪🇸 Español
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-emerald-50 border-2 border-emerald-100 p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] flex flex-col justify-between transition-colors hover:border-emerald-200">
                    <div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
                            <Download size={20} className="sm:w-6 sm:h-6" />
                        </div>
                        <h3 className="font-black text-emerald-900 text-base sm:text-lg mb-1.5">{T.backupTitulo}</h3>
                        <p className="text-xs sm:text-sm text-emerald-700 font-medium mb-6 leading-relaxed">
                            {T.backupDesc}
                        </p>
                    </div>
                    <button
                        onClick={realizarBackup}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-95 text-sm sm:text-base"
                    >
                        <FileJson size={18} /> {T.btnBaixar}
                    </button>
                </div>

                <div className="bg-rose-50 border-2 border-rose-100 p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] flex flex-col justify-between transition-colors hover:border-rose-200">
                    <div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-rose-100 rounded-xl sm:rounded-2xl flex items-center justify-center text-rose-600 mb-4">
                            <AlertTriangle size={20} className="sm:w-6 sm:h-6" />
                        </div>
                        <h3 className="font-black text-rose-900 text-base sm:text-lg mb-1.5">{T.restaurarTitulo}</h3>
                        <p className="text-xs sm:text-sm text-rose-700 font-medium mb-6 leading-relaxed">
                            {T.restaurarDesc}
                        </p>
                    </div>
                    <button
                        onClick={abrirSeletorArquivo}
                        disabled={processando}
                        className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-rose-200 flex items-center justify-center gap-2 transition-all active:scale-95 text-sm sm:text-base"
                    >
                        {processando ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                {T.processando}
                            </span>
                        ) : (
                            <>
                                <Upload size={18} /> {T.btnRestaurar}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
