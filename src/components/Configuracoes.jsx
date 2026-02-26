import React, { useState, useRef } from 'react';
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
    ChevronDown
} from 'lucide-react';

export default function Configuracoes({ dados, salvarAlteracao, t, lang, importarBackup, resetarConta }) {
    const fileInputRef = useRef(null);
    const [processando, setProcessando] = useState(false);

    // --- TRADUÇÕES LOCAIS ---
    const TEXTOS = {
        pt: {
            titulo: "Ajustes do Sistema",
            congregacao: "Nome da Congregação",
            dia: "Dia da Reunião",
            horario: "Horário",
            idioma: "Idioma do Sistema",
            backupTitulo: "Backup e Segurança",
            backupDesc: "Baixe uma cópia completa dos seus dados para o seu dispositivo.",
            btnBaixar: "Baixar Backup (JSON)",
            zonaPerigo: "Zona de Restauração",
            restaurarTitulo: "Restaurar Backup",
            restaurarDesc: "Apaga os dados atuais da sua conta e importa um arquivo de backup do seu dispositivo.",
            btnRestaurar: "Restaurar Arquivo",
            confirmarRestauracao: "⚠️ PERIGO: Isso vai APAGAR todos os dados da sua conta atual e substituir pelo arquivo selecionado.\n\nTem certeza que deseja continuar?",
            sucesso: "✅ Backup restaurado com sucesso!",
            erro: "Erro ao restaurar: ",
            dias: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
        },
        es: {
            titulo: "Ajustes del Sistema",
            congregacao: "Nombre de la Congregación",
            dia: "Día de la Reunión",
            horario: "Horario",
            idioma: "Idioma del Sistema",
            backupTitulo: "Copia de Seguridad",
            backupDesc: "Descargue una copia completa de sus datos a su dispositivo.",
            btnBaixar: "Descargar Respaldo (JSON)",
            zonaPerigo: "Zona de Restauración",
            restaurarTitulo: "Restaurar Respaldo",
            restaurarDesc: "Borra los datos actuales de su cuenta e importa un archivo de respaldo desde su dispositivo.",
            btnRestaurar: "Restaurar Archivo",
            confirmarRestauracao: "⚠️ PELIGRO: Esto BORRARÁ todos los datos de su cuenta actual y los reemplazará con el archivo seleccionado.\n\n¿Está seguro de continuar?",
            sucesso: "✅ ¡Respaldo restaurado con éxito!",
            erro: "Error al restaurar: ",
            dias: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        }
    };

    const T = TEXTOS[lang] || TEXTOS.pt;

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
        if (window.confirm(T.confirmarRestauracao)) {
            fileInputRef.current.click();
        }
    };

    // --- 3. PROCESSAR O ARQUIVO SELECIONADO ---
    const handleArquivoSelecionado = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setProcessando(true);
        try {
            const text = await file.text();
            const jsonImportado = JSON.parse(text);

            if (resetarConta) {
                await resetarConta();
            }

            await importarBackup(jsonImportado);

            alert(T.sucesso);
            e.target.value = '';

        } catch (error) {
            console.error(error);
            alert(T.erro + error.message);
        } finally {
            setProcessando(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 sm:p-6">

            {/* Input Invisível para Arquivo */}
            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleArquivoSelecionado}
            />

            {/* Cabeçalho da Página */}
            <div className="flex items-center gap-3 mb-6 sm:mb-8">
                <div className="bg-blue-600 p-2.5 sm:p-3 rounded-2xl shadow-lg shadow-blue-200 shrink-0">
                    <Settings className="text-white w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{T.titulo}</h2>
                    <p className="text-xs sm:text-sm font-medium text-slate-500">Gerencie as preferências locais</p>
                </div>
            </div>

            {/* BLOCO 1: INFORMAÇÕES DA CONGREGAÇÃO */}
            <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] shadow-sm border border-slate-100 space-y-5 sm:space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>

                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2 sm:mb-4">
                    Preferências Gerais
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
                                placeholder="Ex: Congregação Central"
                                value={dados?.configuracoes?.nome_cong || ''}
                                onChange={(e) => atualizarConfig('nome_cong', e.target.value)}
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
                                    value={dados?.configuracoes?.dia_reuniao || 'Segunda-feira'}
                                    onChange={(e) => atualizarConfig('dia_reuniao', e.target.value)}
                                    className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-800 font-bold appearance-none cursor-pointer text-base sm:text-sm"
                                >
                                    {T.dias.map(d => <option key={d} value={d}>{d}</option>)}
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

            {/* BLOCO 2: IDIOMA */}
            <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4 sm:mb-5">
                    <Globe size={18} className="text-indigo-500" /> {T.idioma}
                </h3>

                <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-row gap-1">
                    <button
                        onClick={() => atualizarConfig('idioma', 'pt')}
                        className={`flex-1 py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${lang === 'pt' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        🇧🇷 Português
                    </button>
                    <button
                        onClick={() => atualizarConfig('idioma', 'es')}
                        className={`flex-1 py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${lang === 'es' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        🇪🇸 Español
                    </button>
                </div>
            </div>

            {/* BLOCO 3: SEGURANÇA E DADOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">

                {/* Exportar */}
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

                {/* Importar */}
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
                                Processando
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