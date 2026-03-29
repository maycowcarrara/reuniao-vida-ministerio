import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Link as LinkIcon, Loader2, CheckCircle, AlertTriangle, RefreshCcw, ExternalLink, ChevronLeft, Search, Ban } from 'lucide-react';
import { TRANSLATIONS, getImportadorCatalogConfig } from '../../utils/importador/constants';
import { isLikelyUrl, fetchHtmlViaProxy } from '../../utils/importador/helpers';
import { extrairDados } from '../../utils/importador/parser';
import RevisarImportacao from './RevisarImportacao';
// 🔥 IMPORTANDO O HOOK PARA VERIFICAR EVENTOS DO DASHBOARD
import { useGerenciadorDados } from '../../hooks/useGerenciadorDados';
import { getEventoEspecialPorSemana, isTipoEventoBloqueante } from '../../utils/eventos';
import { formatText } from '../../i18n';

let cheerioModulePromise;
const loadCheerio = async () => {
    if (!cheerioModulePromise) {
        cheerioModulePromise = import('cheerio');
    }
    return cheerioModulePromise;
};

export default function Importador({ onImportComplete, idioma = 'pt' }) {
    const lang = (idioma || 'pt').toLowerCase().startsWith('es') ? 'es' : 'pt';
    const t = TRANSLATIONS[lang];
    const catalogConfig = getImportadorCatalogConfig(lang);

    // Puxando os eventos salvos no Dashboard
    const { dados: appDados } = useGerenciadorDados();

    const [input, setInput] = useState('');
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [metodoAtivo, setMetodoAtivo] = useState('catalogo');
    const [dadosParaEdicao, setDadosParaEdicao] = useState(null);
    const [erro, setErro] = useState('');

    // --- CATÁLOGO STATE ---
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogErro, setCatalogErro] = useState('');
    const [apostilas, setApostilas] = useState([]);
    const [apostilaSelecionada, setApostilaSelecionada] = useState(null);
    const [semanasLoading, setSemanasLoading] = useState(false);
    const [semanasErro, setSemanasErro] = useState('');
    const [semanas, setSemanas] = useState([]);

    const CATALOG_BASE = catalogConfig.catalogBase;
    const CATALOG_URL = `https://www.jw.org/${catalogConfig.languagePath}/biblioteca/${CATALOG_BASE}/`;

    // --- 🔥 HELPER INTELIGENTE DE BLOQUEIO DE ASSEMBLEIA ---
    const verificarBloqueioAssembleia = ({ titulo, dataInicio } = {}) => {
        const evento = getEventoEspecialPorSemana({
            semanaStr: titulo,
            config: appDados?.configuracoes,
            isoFallback: dataInicio || null,
            textSources: [titulo]
        });

        return isTipoEventoBloqueante(evento?.tipo);
    };

    // --- EFEITOS E HANDLERS ---

    const parseSemanas = useCallback(async (html) => {
        const cheerio = await loadCheerio();
        const $ = cheerio.load(html);
        const out = [];
        const reStart = /^(\d{1,2})(\s*de\s+[\p{L}]+)?\s*[-–]\s*(\d{1,2})(\s*de\s+[\p{L}]+)?/iu;
        const reShort = /^(\d{1,2}\s*[-–]\s*\d{1,2})/;

        $('a[href]').each((_, el) => {
            const href = ($(el).attr('href') || '').trim();
            const txt = ($(el).text() || '').replace(/\s+/g, ' ').trim();
            if (!href || !txt) return;
            const looksWeek = reStart.test(txt) || reShort.test(txt);
            if (!looksWeek) return;
            
            const hrefLower = href.toLowerCase();
            const isProgramLink = catalogConfig.weekLinkMatcher(hrefLower);

            if (isProgramLink) {
                out.push({ titulo: txt, url: new URL(href, 'https://www.jw.org').toString() });
            }
        });
        return [...new Map(out.map(x => [x.url, x])).values()]; // Unique
    }, [catalogConfig]);

    const parseApostilas = useCallback(async (html) => {
        const cheerio = await loadCheerio();
        const $ = cheerio.load(html);
        const out = [];
        $('a[href]').each((_, el) => {
            const href = ($(el).attr('href') || '').trim();
            if (href.includes(CATALOG_BASE) && href.includes('-mwb')) {
               const abs = new URL(href, 'https://www.jw.org').toString();
               const slug = abs.split('/').filter(Boolean).pop();
               out.push({ slug, titulo: slug, url: abs }); 
            }
        });
        return [...new Map(out.map(x => [x.url, x])).values()];
    }, [CATALOG_BASE]);

    const carregarCatalogo = useCallback(async () => {
        setCatalogLoading(true);
        setCatalogErro('');
        try {
            const { ok, text } = await fetchHtmlViaProxy(CATALOG_URL);
            if (ok) {
                setApostilas(await parseApostilas(text));
            } else {
                setCatalogErro(t.catalogErro);
            }
        } catch {
            setCatalogErro(t.catalogErro);
        }
        finally { setCatalogLoading(false); }
    }, [CATALOG_URL, parseApostilas, t.catalogErro]);

    const abrirApostila = async (item) => {
        setApostilaSelecionada(item);
        setSemanasLoading(true);
        setSemanasErro('');
        try {
            const { ok, text } = await fetchHtmlViaProxy(item.url);
            if(ok) setSemanas(await parseSemanas(text));
            else setSemanasErro(t.semanasErro);
        } catch {
            setSemanasErro(t.semanasErro);
        }
        finally { setSemanasLoading(false); }
    };

    const processarImportacao = async (conteudo, tipo) => {
        setLoading(true);
        setErro('');
        try {
            let html = conteudo;
            if (tipo === 'url') {
                const res = await fetchHtmlViaProxy(conteudo);
                if (!res.ok) throw new Error('Fetch Error');
                html = res.text;
            }
            const dados = await extrairDados(html, 'html', lang);
            if (!dados) throw new Error('Parse Error');

            // 🔥 Trava de bloqueio para colar URL/Texto! Impede abrir a Revisão
            const tituloSemana = dados.semana || '';
            if (verificarBloqueioAssembleia({ titulo: tituloSemana, dataInicio: dados.dataInicio || dados.dataExata })) {
                alert(formatText(t.bloqueioSegurancaSemanaTpl, { titulo: tituloSemana }));
                setLoading(false);
                return; 
            }

            setDadosParaEdicao(dados);
        } catch {
            setErro(tipo === 'url' ? t.msgErro : t.erroConteudo);
        } finally {
            setLoading(false);
        }
    };

    const handleColar = async () => {
        try {
            const clip = await navigator.clipboard.readText();
            if (isLikelyUrl(clip) && clip.includes('jw.org')) {
                setMetodoAtivo('link'); setUrl(clip.trim());
            } else {
                setMetodoAtivo('texto'); setInput(clip);
            }
        } catch {
            setErro(t.erroConteudo);
        }
    };

    useEffect(() => {
        if (metodoAtivo === 'catalogo' && !apostilas.length) carregarCatalogo();
    }, [metodoAtivo, apostilas.length, carregarCatalogo]);

    if (dadosParaEdicao) {
        return (
            <RevisarImportacao 
                dados={dadosParaEdicao} 
                setDados={setDadosParaEdicao} 
                onConfirm={(d) => { onImportComplete(d); setDadosParaEdicao(null); }} 
                onCancel={() => setDadosParaEdicao(null)} 
                lang={lang}
            />
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 bg-white p-3 sm:p-6 m-2 sm:m-6 rounded-3xl shadow-2xl border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><ClipboardList className="text-blue-600" /> {t.titulo}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t.instrucao}</p>
                </div>
                <div className="text-xs text-gray-400 uppercase font-bold">{lang}</div>
            </div>

            <div className="flex gap-2">
                {[
                    { id: 'catalogo', icon: Search, label: t.metodoCatalogo },
                    { id: 'texto', icon: ClipboardList, label: t.metodoTexto },
                    { id: 'link', icon: LinkIcon, label: t.metodoLink }
                ].map(m => (
                    <button key={m.id} onClick={() => setMetodoAtivo(m.id)} className={`flex-1 px-4 py-2 rounded-xl font-bold border transition inline-flex items-center justify-center gap-2 ${metodoAtivo === m.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                        <m.icon size={18} /> {m.label}
                    </button>
                ))}
            </div>

            {metodoAtivo === 'catalogo' && (
                <div className="space-y-4">
                    {!apostilaSelecionada ? (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <div><div className="text-sm font-extrabold text-gray-800">{t.catalogTitulo}</div><div className="text-xs text-gray-500">{t.catalogSub}</div></div>
                                <button onClick={carregarCatalogo} disabled={catalogLoading} className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition inline-flex items-center gap-2 disabled:opacity-60"><RefreshCcw size={16} className={catalogLoading ? 'animate-spin' : ''} /> {t.catalogAtualizar}</button>
                            </div>
                            {catalogErro && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex gap-2 items-start"><AlertTriangle size={16} />{catalogErro}</div>}
                            {catalogLoading ? <div className="text-center p-4"><Loader2 className="animate-spin mx-auto" /></div> : (
                                <div className="grid gap-2">
                                    {apostilas.map(a => (
                                        <button key={a.url} onClick={() => abrirApostila(a)} className="text-left border border-gray-200 bg-white hover:bg-gray-50 rounded-2xl p-4 transition">
                                            <div className="font-extrabold text-gray-800">{a.titulo}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <button onClick={() => setApostilaSelecionada(null)} className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition inline-flex items-center gap-2"><ChevronLeft size={16} /> {t.voltar}</button>
                                <a href={apostilaSelecionada.url} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition inline-flex items-center gap-2"><ExternalLink size={16} /> {t.abrirNoJw}</a>
                            </div>
                            {semanasErro && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex gap-2 items-start"><AlertTriangle size={16} />{semanasErro}</div>}
                            {semanasLoading ? <div className="text-center p-4"><Loader2 className="animate-spin mx-auto" /></div> : (
                                <div className="space-y-2">
                                    {semanas.map(w => {
                                        // 🔥 Verificador Atuando na Renderização da Lista
                                        const isBloqueado = verificarBloqueioAssembleia({ titulo: w.titulo });

                                        return (
                                            <div key={w.url} className={`border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${isBloqueado ? 'border-yellow-200 bg-yellow-50/50' : 'border-gray-200 bg-white'}`}>
                                                <div className="font-extrabold text-gray-800">
                                                    {w.titulo}
                                                    {isBloqueado && (
                                                        <span className="flex items-center gap-1 mt-1 text-[10px] text-yellow-700 bg-yellow-200/50 px-2 py-0.5 rounded-full w-fit">
                                                            <Ban size={10} /> {t.bloqueadoBadge}
                                                        </span>
                                                    )}
                                                </div>
                                                <button 
                                                    onClick={() => processarImportacao(w.url, 'url')} 
                                                    disabled={loading || isBloqueado} 
                                                    className={`px-4 py-2 rounded-xl text-white font-extrabold transition inline-flex items-center gap-2 ${isBloqueado ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                                >
                                                    {loading ? <Loader2 className="animate-spin" size={16} /> : isBloqueado ? <Ban size={18} /> : <CheckCircle size={18} />} 
                                                    {isBloqueado ? t.bloqueado : t.importarSemana}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {metodoAtivo !== 'catalogo' && (
                <div className="space-y-4">
                    {metodoAtivo === 'texto' ? (
                        <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholderTexto} className="w-full h-56 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 text-sm outline-none focus:ring-4 focus:ring-blue-100 resize-none" />
                    ) : (
                        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.placeholderLink} className="w-full rounded-2xl border border-gray-200 bg-gray-50/60 p-4 text-sm outline-none focus:ring-4 focus:ring-blue-100" />
                    )}
                    {erro && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex gap-2 items-start"><AlertTriangle size={16} />{erro}</div>}
                    <div className="flex gap-3">
                        <button onClick={handleColar} className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-50">{t.colar}</button>
                        <button onClick={() => processarImportacao(metodoAtivo === 'texto' ? input : url, metodoAtivo === 'texto' ? 'texto' : 'url')} disabled={loading} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={18} />} {t.processar}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
