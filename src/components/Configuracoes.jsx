import React, { useState, useRef } from 'react';
import { Settings, Download, Upload, AlertTriangle, FileJson, Trash2 } from 'lucide-react';

export default function Configuracoes({ dados, salvarAlteracao, t, lang, importarBackup, resetarConta }) {

    const fileInputRef = useRef(null);
    const [processando, setProcessando] = useState(false);

    // --- TRADUÇÕES LOCAIS (Para garantir que tudo fique traduzido) ---
    const TEXTOS = {
        pt: {
            titulo: "Ajustes do Sistema",
            congregacao: "Nome da Congregação",
            dia: "Dia da Reunião",
            horario: "Horário",
            idioma: "Idioma do Sistema",
            backupTitulo: "Backup e Segurança",
            backupDesc: "Baixe uma cópia completa dos seus dados para o seu computador.",
            btnBaixar: "Baixar Backup (JSON)",
            zonaPerigo: "Zona de Restauração",
            restaurarTitulo: "Restaurar Backup do Computador",
            restaurarDesc: "Apaga os dados atuais da sua conta e importa um arquivo de backup (.json) do seu computador.",
            btnRestaurar: "Selecionar Arquivo e Restaurar",
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
            backupDesc: "Descargue una copia completa de sus datos a su computadora.",
            btnBaixar: "Descargar Respaldo (JSON)",
            zonaPerigo: "Zona de Restauración",
            restaurarTitulo: "Restaurar Respaldo desde PC",
            restaurarDesc: "Borra los datos actuales de su cuenta e importa un archivo de respaldo (.json) desde su computadora.",
            btnRestaurar: "Seleccionar Archivo y Restaurar",
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

            // 1. Limpa a conta do usuário atual
            if (resetarConta) {
                await resetarConta(); 
            }

            // 2. Importa os novos dados
            await importarBackup(jsonImportado);
            
            alert(T.sucesso);
            // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
            e.target.value = ''; 

        } catch (error) {
            console.error(error);
            alert(T.erro + error.message);
        } finally {
            setProcessando(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-lg mx-auto space-y-8 animate-in fade-in zoom-in duration-300 mb-10">
            {/* Input Invisível para Arquivo */}
            <input 
                type="file" 
                ref={fileInputRef}
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleArquivoSelecionado}
            />

            <h3 className="font-bold border-b pb-2 flex items-center gap-2 text-jw-blue">
                <Settings size={18} /> {T.titulo}
            </h3>

            {/* --- CONFIGURAÇÕES GERAIS --- */}
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{T.congregacao}</label>
                    <input
                        type="text"
                        value={dados?.configuracoes?.nome_cong || ''}
                        onChange={(e) => atualizarConfig('nome_cong', e.target.value)}
                        className="w-full p-2.5 border rounded-lg mt-1 outline-none focus:ring-2 focus:ring-blue-100"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{T.dia}</label>
                        <select
                            value={dados?.configuracoes?.dia_reuniao || 'Segunda-feira'}
                            onChange={(e) => atualizarConfig('dia_reuniao', e.target.value)}
                            className="w-full p-2.5 border rounded-lg mt-1 bg-white outline-none"
                        >
                            {T.dias.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{T.horario}</label>
                        <input
                            type="time"
                            value={dados?.configuracoes?.horario || '19:30'}
                            onChange={(e) => atualizarConfig('horario', e.target.value)}
                            className="w-full p-2.5 border rounded-lg mt-1 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t">
                <label className="text-[10px] font-black text-gray-400 uppercase">{T.idioma}</label>
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => atualizarConfig('idioma', 'pt')}
                        className={`flex-1 p-3 rounded-lg border font-bold ${lang === 'pt' ? 'bg-blue-600 text-white shadow-lg border-blue-600' : 'bg-gray-50'}`}
                    >
                        Português
                    </button>

                    <button
                        onClick={() => atualizarConfig('idioma', 'es')}
                        className={`flex-1 p-3 rounded-lg border font-bold ${lang === 'es' ? 'bg-blue-600 text-white shadow-lg border-blue-600' : 'bg-gray-50'}`}
                    >
                        Español
                    </button>
                </div>
            </div>

            {/* --- EXPORTAR --- */}
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2 text-green-800">
                    <Download size={18} />
                    <h3 className="font-bold">{T.backupTitulo}</h3>
                </div>
                <p className="text-sm text-green-700 mb-4">
                    {T.backupDesc}
                </p>
                <button
                    onClick={realizarBackup}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow flex items-center justify-center gap-2 transition-colors"
                >
                    <FileJson size={18} />
                    {T.btnBaixar}
                </button>
            </div>

            {/* --- IMPORTAR / RESTAURAR --- */}
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2 text-red-800">
                    <AlertTriangle size={18} />
                    <h3 className="font-bold">{T.restaurarTitulo}</h3>
                </div>
                <p className="text-sm text-red-700 mb-4">
                    {T.restaurarDesc}
                </p>
                <button
                    onClick={abrirSeletorArquivo}
                    disabled={processando}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow flex items-center justify-center gap-2 transition-colors"
                >
                    {processando ? (
                        <span>Carregando...</span>
                    ) : (
                        <>
                            <Upload size={18} />
                            {T.btnRestaurar}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}