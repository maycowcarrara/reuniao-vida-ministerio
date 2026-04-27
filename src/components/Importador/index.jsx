import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Link as LinkIcon, Loader2, CheckCircle, AlertTriangle, RefreshCcw, ExternalLink, ChevronLeft, Search, Ban } from 'lucide-react';
import { TRANSLATIONS, getImportadorCatalogConfig } from '../../utils/importador/constants';
import { isLikelyHtml, isLikelyUrl, fetchHtmlViaProxy } from '../../utils/importador/helpers';
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

const FALLBACK_MESSAGES = {
    pt: {
        catalogCache: 'A lista automática está indisponível no momento. Exibindo a última versão salva neste navegador.',
        catalogVazio: 'Não encontrei apostilas automaticamente agora. Tente atualizar ou use Link/Texto.',
        semanasCache: 'Não foi possível consultar o JW.org agora. Exibindo semanas salvas anteriormente.',
        semanasVazio: 'Não encontrei semanas dessa apostila automaticamente. Abra no JW.org ou use o modo Link.'
    },
    es: {
        catalogCache: 'La lista automática no está disponible ahora. Se muestra la última versión guardada en este navegador.',
        catalogVazio: 'No encontré guías automáticamente ahora. Intenta actualizar o usa Enlace/Texto.',
        semanasCache: 'No fue posible consultar JW.org ahora. Se muestran semanas guardadas anteriormente.',
        semanasVazio: 'No encontré semanas de esta guía automáticamente. Ábrela en JW.org o usa el modo Enlace.'
    }
};

const formatCatalogSlugTitle = (slug) => (
    decodeURIComponent((slug || '').replace(/[-_]+/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
);

const parseMarkdownLinks = (text) => {
    const matches = [];
    const regex = /\[([^\]]+)\]\((https:\/\/www\.jw\.org\/[^)\s]+)\)/g;
    let match;
    while ((match = regex.exec(text || '')) !== null) {
        matches.push({
            titulo: match[1].replace(/[*_`#]+/g, '').replace(/\s+/g, ' ').trim(),
            url: match[2].trim(),
        });
    }
    return matches;
};

export default function Importador({ onImportComplete, idioma = 'pt' }) {
    const lang = (idioma || 'pt').toLowerCase().startsWith('es') ? 'es' : 'pt';
    const t = TRANSLATIONS[lang];
    const catalogConfig = getImportadorCatalogConfig(lang);
    const fallbackText = FALLBACK_MESSAGES[lang] || FALLBACK_MESSAGES.pt;

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
    const [catalogAviso, setCatalogAviso] = useState('');
    const [apostilas, setApostilas] = useState([]);
    const [apostilaSelecionada, setApostilaSelecionada] = useState(null);
    const [semanasLoading, setSemanasLoading] = useState(false);
    const [semanasErro, setSemanasErro] = useState('');
    const [semanasAviso, setSemanasAviso] = useState('');
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
        if (!isLikelyHtml(html)) {
            const reStart = /^(\d{1,2})(\s*de\s+[\p{L}]+)?\s*[-–]\s*(\d{1,2})(\s*de\s+[\p{L}]+)?/iu;
            const reShort = /^(\d{1,2}\s*[-–]\s*\d{1,2})/;
            const parsed = parseMarkdownLinks(html)
                .filter(({ titulo, url }) => {
                    const hrefLower = url.toLowerCase();
                    const looksWeek = reStart.test(titulo) || reShort.test(titulo);
                    return looksWeek && catalogConfig.weekLinkMatcher(hrefLower);
                });

            return [...new Map(parsed.map((item) => [item.url, item])).values()];
        }

        const cheerio = await loadCheerio();
        const $ = cheerio.load(html);
        const out = [];
        const reStart = /^(\d{1,2})(\s*de\s+[\p{L}]+)?\s*[-–]\s*(\d{1,2})(\s*de\s+[\p{L}]+)?/iu;
        const reShort = /^(\d{1,2}\s*[-–]\s*\d{1,2})/;

        $('a[href]').each((_, el) => {
            const href = ($(el).attr('href') || '').trim();
            const txt = (
                $(el).text() ||
                $(el).attr('title') ||
                $(el).attr('aria-label') ||
                ''
            ).replace(/\s+/g, ' ').trim();
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
        if (!isLikelyHtml(html)) {
            const parsed = parseMarkdownLinks(html)
                .filter(({ url }) => {
                    const absLower = url.toLowerCase();
                    return (
                        absLower.includes(`/biblioteca/${CATALOG_BASE}/`.toLowerCase()) &&
                        absLower !== CATALOG_URL.toLowerCase() &&
                        !catalogConfig.weekLinkMatcher(absLower) &&
                        !absLower.includes('/mwbr')
                    );
                })
                .map(({ titulo, url }) => {
                    const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
                    const slug = pathSegments[pathSegments.length - 1] || '';
                    return {
                        slug,
                        titulo: titulo || formatCatalogSlugTitle(slug),
                        url
                    };
                });

            return [...new Map(parsed.map((item) => [item.url, item])).values()];
        }

        const cheerio = await loadCheerio();
        const $ = cheerio.load(html);
        const out = [];
        const catalogRoot = `/biblioteca/${CATALOG_BASE}/`;

        $('a[href]').each((_, el) => {
            const href = ($(el).attr('href') || '').trim();
            if (!href) return;

            const abs = new URL(href, 'https://www.jw.org').toString();
            const absLower = abs.toLowerCase();

            if (!absLower.includes(catalogRoot.toLowerCase())) return;
            if (absLower === CATALOG_URL.toLowerCase()) return;
            if (catalogConfig.weekLinkMatcher(absLower)) return;

            const pathSegments = new URL(abs).pathname.split('/').filter(Boolean);
            const slug = pathSegments[pathSegments.length - 1] || '';
            if (!slug) return;

            const tituloRaw = (
                $(el).text() ||
                $(el).attr('title') ||
                $(el).attr('aria-label') ||
                ''
            ).replace(/\s+/g, ' ').trim();

            out.push({
                slug,
                titulo: tituloRaw || formatCatalogSlugTitle(slug),
                url: abs
            });
        });
        return [...new Map(out.map(x => [x.url, x])).values()];
    }, [CATALOG_BASE, CATALOG_URL, catalogConfig]);

    const carregarCatalogo = useCallback(async () => {
        setCatalogLoading(true);
        setCatalogErro('');
        setCatalogAviso('');
        try {
            const { ok, text, stale } = await fetchHtmlViaProxy(CATALOG_URL);
            if (!ok) throw new Error('catalog-fetch');

            const lista = await parseApostilas(text);
            if (!lista.length) throw new Error('catalog-empty');

            setApostilas(lista);
            if (stale) setCatalogAviso(fallbackText.catalogCache);
        } catch {
            setCatalogErro(t.catalogErro);
            setApostilas([]);
        } 
        finally { setCatalogLoading(false); }
    }, [CATALOG_URL, fallbackText.catalogCache, parseApostilas, t.catalogErro]);

    const abrirApostila = async (item) => {
        setApostilaSelecionada(item);
        setSemanasLoading(true);
        setSemanasErro('');
        setSemanasAviso('');
        setSemanas([]);
        try {
            const { ok, text, stale } = await fetchHtmlViaProxy(item.url);
            if (!ok) throw new Error('weeks-fetch');

            const lista = await parseSemanas(text);
            if (!lista.length) throw new Error('weeks-empty');

            setSemanas(lista);
            if (stale) setSemanasAviso(fallbackText.semanasCache);
        } catch {
            setSemanasErro(t.semanasErro);
            setSemanas([]);
        }
        finally { setSemanasLoading(false); }
    };

    const processarImportacao = async (conteudo, tipo) => {
        const conteudoLimpo = (conteudo || '').trim();
        if (!conteudoLimpo) {
            setErro(tipo === 'url' ? t.erroUrl : t.erroVazio);
            return;
        }

        if (tipo === 'url' && (!isLikelyUrl(conteudoLimpo) || !conteudoLimpo.includes('jw.org'))) {
            setErro(t.erroUrl);
            return;
        }

        setLoading(true);
        setErro('');
        try {
            let html = conteudoLimpo;
            let tipoOrigem = isLikelyHtml(conteudoLimpo) ? 'html' : 'texto';
            if (tipo === 'url') {
                const res = await fetchHtmlViaProxy(conteudoLimpo);
                if (!res.ok) throw new Error('Fetch Error');
                html = res.text;
                tipoOrigem = res.contentKind === 'html' ? 'html' : 'texto';
            }
            const dados = await extrairDados(html, tipoOrigem, lang);
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
        <div className="w-full flex justify-center px-2 py-2 sm:px-6 sm:py-6">
            <div className="w-full max-w-3xl space-y-6 bg-white p-3 sm:p-6 rounded-3xl shadow-2xl border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                                {catalogErro && (
                                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex flex-col gap-3">
                                        <div className="flex gap-2 items-start"><AlertTriangle size={16} />{catalogErro}</div>
                                        <a href={CATALOG_URL} target="_blank" rel="noreferrer" className="w-fit px-3 py-2 rounded-xl border border-red-200 bg-white text-red-700 font-bold hover:bg-red-50 transition inline-flex items-center gap-2">
                                            <ExternalLink size={14} /> {t.abrirNoJw}
                                        </a>
                                    </div>
                                )}
                                {catalogAviso && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs flex gap-2 items-start"><AlertTriangle size={16} />{catalogAviso}</div>}
                                {catalogLoading ? <div className="text-center p-4"><Loader2 className="animate-spin mx-auto" /></div> : (
                                    <div className="grid gap-2">
                                        {apostilas.map(a => (
                                            <button key={a.url} onClick={() => abrirApostila(a)} className="text-left border border-gray-200 bg-white hover:bg-gray-50 rounded-2xl p-4 transition">
                                                <div className="font-extrabold text-gray-800">{a.titulo}</div>
                                            </button>
                                        ))}
                                        {!apostilas.length && !catalogErro && (
                                            <div className="border border-dashed border-gray-300 bg-gray-50 text-gray-600 rounded-2xl p-4 text-sm">
                                                {fallbackText.catalogVazio}
                                            </div>
                                        )}
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
                                {semanasAviso && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs flex gap-2 items-start"><AlertTriangle size={16} />{semanasAviso}</div>}
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
                                        {!semanas.length && !semanasErro && (
                                            <div className="border border-dashed border-gray-300 bg-gray-50 text-gray-600 rounded-2xl p-4 text-sm">
                                                {fallbackText.semanasVazio}
                                            </div>
                                        )}
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
        </div>
    );
}
