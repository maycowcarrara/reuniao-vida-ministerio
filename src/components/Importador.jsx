import React, { useState } from 'react';
import { ClipboardList, Link as LinkIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import * as cheerio from 'cheerio';

const Importador = ({ onImportComplete }) => {
    const [input, setInput] = useState('');
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);

    // (Mantenha a lógica de processarTexto igual, focando aqui no JSX do layout)
    const processarTexto = (texto) => {
        const linhas = texto.split('\n');
        let semanaEncontrada = "";
        const partes = [];
        const regexTempo = /\((\d+)\s+min\)/;
        const regexLicao = /\((th|imd|Iff)\s+lição\s+(\d+.*?)?\)/i;

        linhas.forEach(linha => {
            const l = linha.trim();
            if (!l) return;
            if (l.match(/\d+.*DE\s+[A-Z]+/)) semanaEncontrada = l;
            if (regexTempo.test(l)) {
                const tituloLimpo = l.split('(')[0].trim().replace(/^\d+\.\s*/, '');
                partes.push({
                    titulo: tituloLimpo,
                    tempo: l.match(regexTempo)[1],
                    licao: l.match(regexLicao) ? l.match(regexLicao)[0] : null,
                    tipo: l.toLowerCase().includes('leitura') ? 'estudante' : 'parte'
                });
            }
        });

        return { semana: semanaEncontrada || "Semana não identificada", partes: partes };
    };

    const handleImportarTexto = () => {
        if (!input) return;
        const resultado = processarTexto(input);
        onImportComplete(resultado);
    };

    const handleImportarLink = async () => {
        if (!url) return;
        setLoading(true);
        try {
            const proxyUrl = "https://cors-anywhere.herokuapp.com/";
            const response = await fetch(proxyUrl + url);
            const html = await response.text();
            const $ = cheerio.load(html);
            const tituloSemana = $('.pub-mwb h2').first().text();
            const resultadoSimulado = {
                semana: tituloSemana || "Semana Importada do Site",
                partes: [{ titulo: "Joias Espirituais", tempo: "10", tipo: "parte" }]
            };
            onImportComplete(resultadoSimulado);
        } catch (error) {
            alert("Erro CORS. Use o método Copiar e Colar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Título da Seção */}
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-100 p-3 rounded-lg text-jw-blue">
                    <ClipboardList size={28} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Módulo de Importação</h2>
                    <p className="text-gray-500 text-sm">Escolha como deseja carregar a programação da semana.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* CARD 1: Copiar e Colar (Destaque Principal) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col">
                    <div className="mb-4">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                            <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            Colar Texto
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Copie todo o texto da apostila no site JW.org e cole aqui.</p>
                    </div>

                    <textarea
                        className="flex-1 w-full min-h-[200px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jw-blue focus:border-transparent outline-none bg-gray-50 text-sm font-mono text-gray-700 resize-none"
                        placeholder="12-18 DE JANEIRO&#10;TESOUROS DA PALAVRA DE DEUS&#10;1. O que aprendemos..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />

                    <button
                        onClick={handleImportarTexto}
                        disabled={!input}
                        className={`mt-4 w-full py-3 rounded-lg font-bold text-white transition-colors shadow-sm flex items-center justify-center gap-2
              ${input ? 'bg-jw-blue hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}
            `}
                    >
                        <CheckCircle size={18} />
                        Processar Programação
                    </button>
                </div>

                {/* CARD 2: Importar Link */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col">
                    <div className="mb-4">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                            <span className="bg-gray-200 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                            Via Link (URL)
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Cole o link direto da página da apostila.</p>
                    </div>

                    <div className="flex-1 flex flex-col justify-center gap-4">
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                type="url"
                                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jw-blue focus:border-transparent outline-none text-sm"
                                placeholder="https://www.jw.org/pt/biblioteca/..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                            <h4 className="text-blue-800 font-bold text-xs uppercase mb-1 flex items-center gap-1">
                                <AlertCircle size={12} /> Nota Importante
                            </h4>
                            <p className="text-blue-700 text-xs leading-relaxed">
                                Para uso 100% offline ou se o link falhar, recomendamos usar a opção <strong>"Colar Texto"</strong> ao lado.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleImportarLink}
                        disabled={loading || !url}
                        className="mt-4 w-full bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50 hover:border-gray-300 transition-colors flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin text-jw-blue" size={20} /> : "Buscar no Site"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Importador;