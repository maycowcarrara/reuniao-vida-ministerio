// =====================
// Importador.jsx (1/3)
// =====================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ClipboardList,
    Link as LinkIcon,
    Loader2,
    CheckCircle,
    Edit,
    Plus,
    ArrowUp,
    ArrowDown,
    Trash2,
    AlertTriangle,
    Info,
    RefreshCcw,
    ExternalLink,
    ChevronLeft,
    Search,
} from 'lucide-react';
import * as cheerio from 'cheerio';

const TRANSLATIONS = {
    pt: {
        revisar: 'Revisar Importação',
        confirmar: 'Confirmar',
        cancelar: 'Cancelar',
        voltar: 'Voltar',
        tituloSemana: 'Título da Semana (Data + Leitura)',
        addLinha: 'Adicionar Linha Manualmente',
        novaProg: 'Nova Programação',
        instrucao: 'Importe a programação da Apostila (JW.ORG)',

        metodoCatalogo: 'Escolher',
        metodoTexto: 'Texto',
        metodoLink: 'Link',
        processar: 'Processar Apostila',

        msgErro: 'Erro ao acessar o link. Verifique a URL.',
        erroVazio: 'Cole um texto ou informe um link.',
        erroUrl: 'Use um link válido do jw.org (https://www.jw.org/...).',
        erroConteudo:
            'Não foi possível reconhecer a programação nesse conteúdo. Tente colar mais texto (ou use o link).',
        colar: 'Colar',
        limpar: 'Limpar',

        dicasTitulo: 'Como importar',
        dicasTexto: [
            'Preferencial: use “Escolher” para selecionar uma apostila e uma semana.',
            'Alternativa: use “Link” e cole a URL da semana no jw.org.',
            'Se precisar: use “Texto” e cole o texto do JW Library, o texto da página, ou o HTML (view source).',
            'Se algo vier errado, revise abaixo e ajuste manualmente.',
        ],
        exemplo: 'Ex.: https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/…',
        rotulos: {
            titulo: 'Título da Parte',
            tempo: 'Minutos',
            secao: 'Seção',
            detalhes: 'Detalhes / Matéria',
        },

        dicaRevisao:
            'Dica: todos os campos abaixo são editáveis. Clique para ajustar título, minutos, seção e detalhes.',
        secaoTesouros: 'TESOUROS',
        secaoMinisterio: 'MINISTÉRIO',
        secaoVida: 'VIDA',
        secaoNA: 'N/A',

        placeholderTexto: 'Cole aqui o texto (ou HTML) da página da apostila…',
        placeholderLink: 'Cole aqui o link do jw.org…',
        placeholderDetalhes: 'Ex.: matéria, vídeo, perguntas, etc.',

        // Catálogo
        catalogTitulo: 'Apostilas (JW.org)',
        catalogSub: 'Escolha uma apostila e depois selecione uma semana para importar.',
        catalogAtualizar: 'Atualizar lista',
        catalogCarregando: 'Carregando apostilas…',
        catalogErro: 'Não foi possível carregar a lista automática. Use Link/Texto como alternativa.',
        catalogBuscar: 'Buscar apostila…',
        catalogSemResultados: 'Nenhuma apostila encontrada.',
        semanasTitulo: 'Semanas desta apostila',
        semanasSub: 'Selecione uma semana para importar.',
        semanasCarregando: 'Carregando semanas…',
        semanasErro: 'Não foi possível carregar as semanas dessa apostila.',
        semanasVazio: 'Não encontrei as semanas nessa apostila.',
        abrirNoJw: 'Abrir no JW.org',
        importarSemana: 'Importar',

        // Total tempo
        totalTempoLabel: 'Tempo total',
        totalTempoEsperado: 'Esperado',
        totalTempoAviso: 'A soma das partes deve ficar entre 1:40 e 1:45. Ajuste os minutos para bater com o total.',

        // Transparência do total (nova regra)
        totalTempoSomaPartes: 'Soma das partes (sem conselhos)',
        totalTempoDetalhes: 'Conselhos somados no total:',
        totalTempoLeituraBiblia: '+1 min: conselhos na Leitura da Bíblia (parte 3).',
        totalTempoMinisterioTpl: 'Ministério: +{n} min (1 por parte).',
    },
    es: {
        revisar: 'Revisar Importación',
        confirmar: 'Confirmar',
        cancelar: 'Cancelar',
        voltar: 'Volver',
        tituloSemana: 'Título de la Semana (Fecha + Lectura)',
        addLinha: 'Añadir Línea Manualmente',
        novaProg: 'Nueva Programación',
        instrucao: 'Importe el programa de la Guía (JW.ORG)',

        metodoCatalogo: 'Elegir',
        metodoTexto: 'Texto',
        metodoLink: 'Enlace',
        processar: 'Procesar Guía',

        msgErro: 'Error al acceder al enlace. Verifique la URL.',
        erroVazio: 'Pegue un texto o informe un enlace.',
        erroUrl: 'Use un enlace válido de jw.org (https://www.jw.org/...).',
        erroConteudo:
            'No se pudo reconocer el programa en este contenido. Intenta pegar más texto (o usa el enlace).',
        colar: 'Pegar',
        limpar: 'Limpiar',

        dicasTitulo: 'Cómo importar',
        dicasTexto: [
            'Preferible: usa “Elegir” para seleccionar una guía y una semana.',
            'Alternativa: usa “Enlace” y pega la URL de la semana en jw.org.',
            'Si lo necesitas: usa “Texto” y pega el texto de JW Library, el texto de la página o el HTML (view source).',
            'Si algo sale mal, revisa abajo y ajusta manualmente.',
        ],
        exemplo: 'Ej.: https://www.jw.org/es/biblioteca/guia-actividades-reunion-testigos-jehova/…',
        rotulos: {
            titulo: 'Título de la Parte',
            tempo: 'Minutos',
            secao: 'Sección',
            detalhes: 'Detalles / Materia',
        },

        dicaRevisao:
            'Consejo: todos los campos abajo son editables. Haz clic para ajustar título, minutos, sección y detalles.',
        secaoTesouros: 'TESOROS',
        secaoMinisterio: 'MINISTERIO',
        secaoVida: 'VIDA',
        secaoNA: 'N/A',

        placeholderTexto: 'Pega aquí el texto (o HTML) de la guía…',
        placeholderLink: 'Pega aquí el enlace de jw.org…',
        placeholderDetalhes: 'Ej.: materia, video, preguntas, etc.',

        // Catálogo
        catalogTitulo: 'Guías (JW.org)',
        catalogSub: 'Elige una guía y luego selecciona una semana para importar.',
        catalogAtualizar: 'Actualizar lista',
        catalogCarregando: 'Cargando guías…',
        catalogErro: 'No se pudo cargar la lista automática. Usa Enlace/Texto como alternativa.',
        catalogBuscar: 'Buscar guía…',
        catalogSemResultados: 'No se encontró ninguna guía.',
        semanasTitulo: 'Semanas de esta guía',
        semanasSub: 'Selecciona una semana para importar.',
        semanasCarregando: 'Cargando semanas…',
        semanasErro: 'No se pudo cargar las semanas de esta guía.',
        semanasVazio: 'No encontré semanas en esta guía.',
        abrirNoJw: 'Abrir en JW.org',
        importarSemana: 'Importar',

        // Total tempo
        totalTempoLabel: 'Tiempo total',
        totalTempoEsperado: 'Esperado',
        totalTempoAviso:
            'La suma de las partes debe quedar entre 1:40 y 1:45. Ajusta los minutos para que coincida con el total.',

        // Transparencia del total (nueva regla)
        totalTempoSomaPartes: 'Suma de las partes (sin consejos)',
        totalTempoDetalhes: 'Consejos incluidos en el total:',
        totalTempoLeituraBiblia: '+1 min: consejos en la Lectura de la Biblia (parte 3).',
        totalTempoMinisterioTpl: 'Ministerio: +{n} min (1 por parte).',
    },
};

const normalizar = (s) =>
    (s || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

const isLikelyUrl = (v) => /^https?:\/\/\S+/i.test((v || '').trim());
const isLikelyHtml = (v) => /^\s*<!doctype html|^\s*<html[\s>]/i.test((v || '').trim());

const formatHm = (mins) => {
    const m = Math.max(0, parseInt(mins, 10) || 0);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}:${String(mm).padStart(2, '0')}`;
};

// Cores ajustadas: TESOUROS azul/cinza; N/A cinza claro.
const SECAO_UI = {
    tesouros: {
        chip: 'bg-slate-100 text-slate-900 border-slate-200',
        wrap: 'border-slate-200 bg-slate-50/60',
        left: 'border-l-slate-500',
        focus: 'focus:ring-slate-200 focus:border-slate-300',
    },
    ministerio: {
        chip: 'bg-amber-100 text-amber-900 border-amber-200',
        wrap: 'border-amber-200 bg-amber-50/40',
        left: 'border-l-amber-400',
        focus: 'focus:ring-amber-200 focus:border-amber-300',
    },
    vida: {
        chip: 'bg-rose-100 text-rose-900 border-rose-200',
        wrap: 'border-rose-200 bg-rose-50/40',
        left: 'border-l-rose-400',
        focus: 'focus:ring-rose-200 focus:border-rose-300',
    },
    na: {
        chip: 'bg-gray-100 text-gray-700 border-gray-200',
        wrap: 'border-gray-200 bg-gray-50/70',
        left: 'border-l-gray-300',
        focus: 'focus:ring-gray-200 focus:border-gray-300',
    },
};

const Importador = ({ onImportComplete, idioma }) => {
    const lang = (idioma || 'pt').toLowerCase().startsWith('es') ? 'es' : 'pt';
    const t = TRANSLATIONS[lang];

    const [input, setInput] = useState('');
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);

    // 'catalogo' | 'texto' | 'link'
    const [metodoAtivo, setMetodoAtivo] = useState('catalogo');

    const [dadosParaEdicao, setDadosParaEdicao] = useState(null);
    const [erro, setErro] = useState('');
    const inputRef = useRef(null);

    // ======= Catálogo =======
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogErro, setCatalogErro] = useState('');
    const [apostilas, setApostilas] = useState([]);
    const [buscaApostila, setBuscaApostila] = useState('');

    const [apostilaSelecionada, setApostilaSelecionada] = useState(null);
    const [semanasLoading, setSemanasLoading] = useState(false);
    const [semanasErro, setSemanasErro] = useState('');
    const [semanas, setSemanas] = useState([]);

    const langPath = lang === 'es' ? 'es' : 'pt';

    // ✅ base do catálogo por idioma
    const CATALOG_BASE =
        lang === 'es' ? 'guia-actividades-reunion-testigos-jehova' : 'jw-apostila-do-mes';

    const CATALOG_SEGMENT = `/biblioteca/${CATALOG_BASE}/`;
    const CATALOG_URL = `https://www.jw.org/${langPath}${CATALOG_SEGMENT}`;
    const CACHE_KEY = `jw_mwb_catalog_${langPath}_${CATALOG_BASE}`;
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

    // =========================
    // REGRAS DE TEMPO (e total com conselhos)
    // =========================
    const expectedTotalMinMin = 100; // 1:40
    const expectedTotalMinMax = 105; // 1:45

    const isBibleReadingPart = (p) => {
        const titulo = normalizar(p?.titulo || '');
        if (lang === 'es') return titulo.includes('lectura de la biblia');
        return titulo.includes('leitura da biblia');
    };

    const findFirstVidaCanticoIndex = (partes) => {
        const list = Array.isArray(partes) ? partes : [];
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            const sec = (p?.secao || '').toString().trim().toLowerCase();
            const tipo = (p?.tipo || '').toString().trim().toLowerCase();
            if (sec === 'vida' && tipo === 'cantico') return i;
        }
        return -1;
    };

    // Regra: 1º cântico da VIDA = 5
    const aplicarRegraCanticoVida = (partes) => {
        const list = Array.isArray(partes) ? partes : [];
        const idx = findFirstVidaCanticoIndex(list);
        if (idx < 0) return list;

        return list.map((p, i) => {
            if (i !== idx) return p;
            return { ...p, tempo: '5' };
        });
    };

    // Total efetivo:
    // - Soma das partes
    // - +1 min: conselhos na Leitura da Bíblia
    // - +1 min por parte do Ministério (conselhos por parte)
    const calcularTotalInfo = (partes) => {
        const list = Array.isArray(partes) ? partes : [];
        const idxCanticoVida = findFirstVidaCanticoIndex(list);

        const getMin = (p, idx) => {
            const base = parseInt(p?.tempo, 10) || 0;
            if (idx === idxCanticoVida) return 5;
            return base;
        };

        const totalVisivel = list.reduce((sum, p, idx) => sum + getMin(p, idx), 0);

        const bonusLeituraBiblia = list.some((p) => isBibleReadingPart(p)) ? 1 : 0;

        const ministerioCount = list.reduce((sum, p) => {
            const sec = (p?.secao || '').toString().trim().toLowerCase();
            return sec === 'ministerio' ? sum + 1 : sum;
        }, 0);

        const bonusMinisterio = ministerioCount;
        const totalEfetivo = totalVisivel + bonusLeituraBiblia + bonusMinisterio;

        return {
            totalVisivel,
            bonusLeituraBiblia,
            ministerioCount,
            bonusMinisterio,
            totalEfetivo,
        };
    };

    const totalInfo = useMemo(() => {
        if (!dadosParaEdicao?.partes?.length) {
            return {
                totalVisivel: 0,
                bonusLeituraBiblia: 0,
                ministerioCount: 0,
                bonusMinisterio: 0,
                totalEfetivo: 0,
            };
        }
        return calcularTotalInfo(dadosParaEdicao.partes);
    }, [dadosParaEdicao]);

    const totalMin = totalInfo.totalEfetivo;
    const totalOk = !dadosParaEdicao
        ? true
        : totalMin >= expectedTotalMinMin && totalMin <= expectedTotalMinMax;

    const proxyUrl = (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`;

    const fetchHtmlViaProxy = async (u, { signal } = {}) => {
        const resp = await fetch(proxyUrl(u), { signal });
        const text = await resp.text();
        return { ok: resp.ok, status: resp.status, text };
    };

    const slugToLabel = (slug) => {
        const s = (slug || '').replace(/\/+$/, '').trim();
        const m = /^([a-z\-]+)-(\d{4})-mwb$/i.exec(s);
        if (!m) return slug;

        const monthsPart = m[1];
        const year = m[2];
        const parts = monthsPart.split('-').filter(Boolean);
        if (parts.length < 2) return `${monthsPart} ${year}`;

        const a = parts[0];
        const b = parts[1];

        if (lang === 'es') return `${a}–${b} de ${year}`;
        return `${a}–${b} de ${year}`.replace('marco', 'março');
    };

    // Ordenação por data via slug (ex.: maio-junho-2026-mwb)
    const slugDateKey = (slug) => {
        const s = normalizar((slug || '').replace(/\/+$/, '').trim());
        const m = /^([a-z\-]+)-(\d{4})-mwb$/i.exec(s);
        if (!m) return 0;

        const monthsPart = m[1] || '';
        const year = parseInt(m[2], 10) || 0;

        const parts = monthsPart.split('-').filter(Boolean);
        const firstMonth = parts[0] || '';

        const monthMapPt = {
            janeiro: 1,
            fevereiro: 2,
            marco: 3,
            março: 3,
            abril: 4,
            maio: 5,
            junho: 6,
            julho: 7,
            agosto: 8,
            setembro: 9,
            outubro: 10,
            novembro: 11,
            dezembro: 12,
        };

        const monthMapEs = {
            enero: 1,
            febrero: 2,
            marzo: 3,
            abril: 4,
            mayo: 5,
            junio: 6,
            julio: 7,
            agosto: 8,
            septiembre: 9,
            setiembre: 9,
            octubre: 10,
            noviembre: 11,
            diciembre: 12,
        };

        const mm = (lang === 'es' ? monthMapEs : monthMapPt)[firstMonth] || 0;
        return year * 100 + mm;
    };

    const parseApostilasFromCatalogHtml = (html) => {
        const $ = cheerio.load(html);
        const out = [];

        $('a[href]').each((_, el) => {
            const href = ($(el).attr('href') || '').trim();
            if (!href) return;

            if (!href.includes(CATALOG_SEGMENT)) return;

            try {
                const abs = new URL(href, 'https://www.jw.org').toString();
                const re = new RegExp(
                    `${CATALOG_SEGMENT.replace(/\//g, '\\/')}` + `([^\\/]+-mwb)\\/`,
                    'i'
                );
                const m = re.exec(abs);
                const slug = m?.[1] || null;
                if (!slug) return;

                out.push({
                    slug,
                    titulo: slugToLabel(slug),
                    url: `https://www.jw.org/${langPath}${CATALOG_SEGMENT}${slug}/`,
                });
            } catch (e) { }
        });

        const map = new Map();
        out.forEach((x) => map.set(x.url, x));
        return [...map.values()];
    };

    const generateFallbackApostilas = (count = 18) => {
        const pairs =
            lang === 'es'
                ? [
                    ['enero', 'febrero'],
                    ['marzo', 'abril'],
                    ['mayo', 'junio'],
                    ['julio', 'agosto'],
                    ['septiembre', 'octubre'],
                    ['noviembre', 'diciembre'],
                ]
                : [
                    ['janeiro', 'fevereiro'],
                    ['marco', 'abril'],
                    ['maio', 'junho'],
                    ['julho', 'agosto'],
                    ['setembro', 'outubro'],
                    ['novembro', 'dezembro'],
                ];

        const now = new Date();
        const month = now.getMonth();
        const yearNow = now.getFullYear();

        let pairIndex = Math.floor(month / 2);
        let year = yearNow;

        const out = [];
        for (let i = 0; i < count; i++) {
            const p = pairs[pairIndex];
            const slug = `${p[0]}-${p[1]}-${year}-mwb`;
            out.push({
                slug,
                titulo: slugToLabel(slug),
                url: `https://www.jw.org/${langPath}${CATALOG_SEGMENT}${slug}/`,
            });

            pairIndex -= 1;
            if (pairIndex < 0) {
                pairIndex = pairs.length - 1;
                year -= 1;
            }
        }
        return out;
    };

    const mapLimit = async (arr, limit, fn) => {
        const ret = [];
        const executing = [];
        for (const item of arr) {
            const p = Promise.resolve().then(() => fn(item));
            ret.push(p);

            if (limit <= arr.length) {
                const e = p.then(() => executing.splice(executing.indexOf(e), 1));
                executing.push(e);
                if (executing.length >= limit) await Promise.race(executing);
            }
        }
        return Promise.all(ret);
    };

    const validateApostilaUrl = async (item) => {
        try {
            const { ok, text } = await fetchHtmlViaProxy(item.url);
            if (!ok) return null;

            const hay = (text || '').toLowerCase();
            const okPt = hay.includes('apostila da reuni') || hay.includes('vida e minist');
            const okEs = hay.includes('guía de actividades') || hay.includes('vida y ministerio');

            if (lang === 'es') return okEs ? item : null;
            return okPt ? item : null;
        } catch (e) {
            return null;
        }
    };

    const carregarCatalogo = async ({ force = false } = {}) => {
        setCatalogErro('');

        if (!force) {
            try {
                const raw = localStorage.getItem(CACHE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed?.at && Array.isArray(parsed?.items)) {
                        const age = Date.now() - parsed.at;
                        if (age < CACHE_TTL_MS && parsed.items.length) {
                            setApostilas(parsed.items);
                            return;
                        }
                    }
                }
            } catch (e) { }
        }

        setCatalogLoading(true);
        try {
            const { ok, text } = await fetchHtmlViaProxy(CATALOG_URL);
            let items = ok ? parseApostilasFromCatalogHtml(text) : [];

            if (!items || items.length < 2) {
                const candidates = generateFallbackApostilas(18);
                const validated = await mapLimit(candidates, 3, async (it) => await validateApostilaUrl(it));
                items = validated.filter(Boolean);
            }

            // ✅ Ordena por data (mais recente primeiro)
            items.sort((a, b) => {
                const kb = slugDateKey(b.slug);
                const ka = slugDateKey(a.slug);
                if (kb !== ka) return kb - ka;
                return (b.slug || '').localeCompare(a.slug || '');
            });

            setApostilas(items);

            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
            } catch (e) { }
        } catch (e) {
            setCatalogErro(t.catalogErro);
        } finally {
            setCatalogLoading(false);
        }
    };

    const parseSemanasFromApostilaHtml = (html) => {
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
            const isProgramLink =
                lang === 'es'
                    ? hrefLower.includes('vida-y-ministerio-cristianos')
                    : hrefLower.includes('programa') ||
                    hrefLower.includes('programa%c3%a7') ||
                    hrefLower.includes('programa%C3%A7') ||
                    hrefLower.includes('programa%C3%A7%C3%A3') ||
                    hrefLower.includes('programa%C3%A7%C3%A3o');

            if (!isProgramLink) return;

            try {
                const abs = new URL(href, 'https://www.jw.org').toString();
                out.push({ titulo: txt, url: abs });
            } catch (e) { }
        });

        const map = new Map();
        out.forEach((x) => map.set(x.url, x));
        return [...map.values()];
    };

    const abrirApostila = async (item) => {
        setErro('');
        setSemanasErro('');
        setSemanas([]);
        setApostilaSelecionada(item);

        setSemanasLoading(true);
        try {
            const { ok, text } = await fetchHtmlViaProxy(item.url);
            if (!ok) {
                setSemanasErro(t.semanasErro);
                return;
            }
            const semanasList = parseSemanasFromApostilaHtml(text);
            setSemanas(semanasList);
            if (!semanasList.length) setSemanasErro(t.semanasVazio);
        } catch (e) {
            setSemanasErro(t.semanasErro);
        } finally {
            setSemanasLoading(false);
        }
    };

    const importarSemanaByUrl = async (weekUrl) => {
        setErro('');
        setLoading(true);
        try {
            const { ok, text } = await fetchHtmlViaProxy(weekUrl);
            if (!ok) throw new Error('fetch fail');
            extrairDados(text, 'html');
        } catch (e) {
            setErro(t.msgErro);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (metodoAtivo !== 'catalogo') return;
        if (apostilas.length) return;
        carregarCatalogo({ force: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metodoAtivo, lang]);

    useEffect(() => {
        const trimmed = (input || '').trim();
        if (metodoAtivo === 'texto' && isLikelyUrl(trimmed) && trimmed.includes('jw.org')) {
            setMetodoAtivo('link');
            setUrl(trimmed);
            setErro('');
        }
    }, [input, metodoAtivo]);

    const limparTexto = (txt) => {
        if (!txt) return '';
        let out = txt.toString();

        out = out.replace(/<[^>]*>?/gm, ' ');
        out = out.replace(/\[([^\]]+)\]\((jwpub|https?):\/\/[^\)]+\)/gi, '$1');
        out = out.replace(/\((jwpub|https?):\/\/[^\)]+\)/gi, ' ');

        out = out.replace(/Sua resposta|Respuesta/gi, ' ');
        out = out.replace(/PERGUNTE-SE:|PREGUNTE-SE:|PREGÚNTESE:|PREGUNTESE:/gi, ' ');
        out = out.replace(/_{3,}/g, ' ');

        out = out.replace(/\s+/g, ' ').trim();
        return out;
    };

    const getTermos = () =>
    ({
        pt: {
            tesouros: ['tesouros da palavra de deus'],
            ministerio: ['faca seu melhor no ministerio'],
            vida: ['nossa vida crista'],
            estudo: ['estudo biblico de congregacao'],
            cantico: ['cantico'],
            oracao: ['oracao'],
            iniciais: ['comentarios iniciais'],
            finais: ['comentarios finais'],
            conclusao: ['conclusao'],
        },
        es: {
            tesouros: ['tesoros de la biblia', 'tesoros de la palabra'],
            ministerio: ['seamos mejores maestros', 'sea mejor maestro'],
            vida: ['nuestra vida cristiana'],
            estudo: ['estudio biblico de la congregacion'],
            cantico: ['cancion'],
            oracao: ['oracion'],
            iniciais: ['palabras de introduccion', 'comentarios iniciales', 'comentarios inicial'],
            finais: ['palabras de conclusion', 'comentarios finales'],
            conclusao: ['conclusion'],
        },
    }[lang]);

    const termos = useMemo(() => getTermos(), [lang]);

    const shouldIgnoreLine = (linha) => {
        const n = normalizar(linha);
        if (!n) return true;

        const ignores = [
            'pular para conteudo',
            'pular para sumario',
            'jw.org',
            'testemunhas de jeova',
            'selecione o idioma',
            'selecionar o idioma',
            'log in',
            'pesquisar',
            'inicio',
            'ensinos biblicos',
            'biblioteca',
            'noticias',
            'quem somos',
            'ler em',
            'opcoes de download',
            'sumario',
            'anterior',
            'proximo',
            'copyright',
            'termos de uso',
            'politica de privacidade',
            'configuracoes de aparencia',
            'links rapidos',

            'saltar al contenido',
            'saltar al sumario',
            'saltar al indice',
            'testigos de jehova',
            'seleccione el idioma',
            'iniciar sesion',
            'buscar',
            'inicio',
            'ensenanzas biblicas',
            'biblioteca',
            'noticias',
            'quienes somos',
            'leer en',
            'opciones de descarga',
            'sumario',
            'anterior',
            'siguiente',
            'derechos de autor',
            'terminos de uso',
            'politica de privacidad',
            'configuracion de apariencia',
            'enlaces rapidos',
        ];

        if (ignores.some((x) => n.includes(x))) return true;

        const player = [
            'tempo',
            'duration',
            'reproduzir',
            'voltar',
            'avancar',
            'mudo',
            'configuracoes',
            'tiempo',
            'duracion',
            'reproducir',
            'retroceder',
            'adelantar',
            'silenciar',
            'configuracion',
        ];
        if (player.some((x) => n === x || n.startsWith(x + ' '))) return true;

        return false;
    };

    const extractSemanaLeituraFromText = (rawText) => {
        const lines = rawText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

        let semana = null;
        let leitura = null;

        const reSemanaGeneric = /^(\d{1,2}\s*[-–]\s*\d{1,2})\s+(?:de\s+)?([\p{L}]+)(?:\s+de\s+\d{4})?$/iu;
        const reSemanaCapsGeneric = /^(\d{1,2}\s*[-–]\s*\d{1,2})\s+DE\s+([\p{L}]+)(?:\s+\d{4})?$/iu;
        const reLeitura = /^[A-ZÀ-ÜÇÃÕÑ]{2,}(\s+[A-ZÀ-ÜÇÃÕÑ]{2,})*\s+\d{1,3}(?:\s*(?:[-–]\s*\d{1,3}|,\s*\d{1,3})+)?[,]?$/;


        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];

            if (!semana) {
                const lc = l.replace(/\s+/g, ' ').trim();
                if (reSemanaCapsGeneric.test(lc) || reSemanaGeneric.test(lc)) {
                    semana = lc;
                    const next = lines[i + 1] || '';
                    const next2 = lines[i + 2] || '';
                    let nextClean = next.replace(/^\[|\]$/g, '').trim();

                    // Suporte: leitura quebrada em 2 linhas (ex.: "ISAÍAS 65," + "66")
                    if (/,\s*$/.test(nextClean)) {
                        const n2 = next2.replace(/^\[|\]$/g, '').trim();
                        if (/^\d{1,3}(?:\s*[-–]\s*\d{1,3})?$/.test(n2)) {
                            nextClean = `${nextClean} ${n2}`;
                        }
                    }

                    if (reLeitura.test(nextClean.toUpperCase())) leitura = nextClean.toUpperCase();
                }
            }

            if (!leitura) {
                const u = l.toUpperCase().trim();
                if (reLeitura.test(u)) leitura = u;
            }

            if (semana && leitura) break;
        }

        if (!leitura) {
            const m = rawText
                .toUpperCase()
                .match(/\b[A-ZÀ-ÜÇÃÕÑ]{2,}(?:\s+[A-ZÀ-ÜÇÃÕÑ]{2,})*\s+\d{1,3}(?:\s*(?:[-–]\s*\d{1,3}|,\s*\d{1,3})+)?\b/);
            if (m) leitura = m[0];
        }

        return { semana, leitura };
    };

    const extrairTextoDoHtmlJW = (html) => {
        const $ = cheerio.load(html);

        const weekHeader = $('article header h1').first().text().trim() || '';
        const leituraHeader =
            $('article header h2')
                .first()
                .text()
                .replace(/\s+/g, ' ')
                .trim() || '';

        $('script, style, noscript, nav, footer').remove();
        $('header').remove();

        const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
        const breadcrumb = $('ol.breadcrumbMenu span[aria-current="page"]').first().text().trim() || '';

        const pageTitle =
            $('.synopsis .syn-body h3 a').first().text().trim() ||
            $('.synopsis .syn-body h3').first().text().trim() ||
            $('main h1').first().text().trim() ||
            '';

        const root = $('#regionMain').length ? $('#regionMain') : $('main').length ? $('main') : $('body');

        const blocos = root
            .find('h1,h2,h3,h4,p,li')
            .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
            .get()
            .filter(Boolean);

        let texto = blocos.join('\n');

        if (!texto || texto.trim().length < 50) {
            texto = root.text();
            texto = texto.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n');
        }

        return { texto, ogTitle, breadcrumb, pageTitle, weekHeader, leituraHeader };
    };

    const extrairSemanaDeString = (s) => {
        const raw = (s || '').toString().replace(/\s+/g, ' ').trim();
        if (!raw) return null;

        const re = /(\d{1,2}\s*[-–]\s*\d{1,2})\s+(?:de\s+)?([\p{L}]+)(?:\s+de\s+\d{4})?/iu;
        const m = re.exec(raw);
        if (!m) return null;

        const end = m.index + m[0].length;
        return raw.slice(m.index, end).trim();
    };

    // =========================================
    // Parser
    // =========================================
    const extrairDados = (conteudo, tipoOrigem) => {
        setErro('');

        let textoProcessar = conteudo || '';
        let semanaStr = null;
        let leituraSemanal = null;

        if (tipoOrigem === 'html') {
            const { texto, ogTitle, breadcrumb, pageTitle, weekHeader, leituraHeader } = extrairTextoDoHtmlJW(conteudo);
            textoProcessar = texto;

            semanaStr =
                (weekHeader && weekHeader.trim()) ||
                extrairSemanaDeString(breadcrumb) ||
                extrairSemanaDeString(pageTitle) ||
                extrairSemanaDeString(ogTitle) ||
                null;

            leituraSemanal = (leituraHeader || '').replace(/\s+/g, ' ').trim();
        }

        const bruto = (textoProcessar || '').toString();
        const linhasBrutas = bruto.split(/\r?\n/);

        const linhas = linhasBrutas
            .map((l) => limparTexto(l))
            .filter((l) => l && l.length > 1)
            .filter((l) => !shouldIgnoreLine(l));

        const textoParaDeteccaoSemana = linhas.join('\n');
        const { semana, leitura } = extractSemanaLeituraFromText(textoParaDeteccaoSemana);

        if (!semanaStr) semanaStr = semana || 'Semana a definir';
        if (!leituraSemanal) leituraSemanal = leitura || '';

        const partes = [];
        let secaoAtual = null;
        let parteAtual = null;

        const regexTempoInline = /\(?\s*(\d+)\s*min(?:s)?(?:utos)?\.?\s*\)?/i;
        const regexTempoSozinho = /^\(?\s*(\d+)\s*min(?:s)?(?:utos)?\.?\s*\)?$/i;

        const isHeaderSecao = (l) => {
            const n = normalizar(l);
            if (termos.tesouros.some((x) => n.includes(x))) return 'tesouros';
            if (termos.ministerio.some((x) => n.includes(x))) return 'ministerio';
            if (termos.vida.some((x) => n.includes(x))) return 'vida';
            return null;
        };

        const isSongPrayerText = (n) => {
            const hasSong = n.includes('cantico') || n.includes('cancion');
            const hasPrayer = n.includes('oracao') || n.includes('oracion');
            return hasSong && hasPrayer;
        };

        const classifyTipo = (titulo) => {
            const n = normalizar(titulo).replace(/^\d+\s*\.\s*/g, '').trim();
            if (termos.finais.some((x) => n.includes(x)) || termos.conclusao.some((x) => n.includes(x)))
                return 'oracao_final';
            if (termos.iniciais.some((x) => n.includes(x))) return 'oracao_inicial';
            if (termos.estudo.some((x) => n.includes(x))) return 'estudo';
            if (termos.cantico.some((x) => n.includes(x))) return 'cantico';
            return 'parte';
        };

        const secaoDefault = () => secaoAtual || 'tesouros';

        const commitParteAtual = () => {
            if (parteAtual) {
                if (parteAtual._ignorarDescricao) parteAtual.descricao = '';
                delete parteAtual._ignorarDescricao;
                delete parteAtual._aguardandoTempoDescricao;
                partes.push(parteAtual);
            }
            parteAtual = null;
        };

        // =====================
        // Importador.jsx (2/3)
        // =====================

        const isVidaShortLine = (txt) => {
            const s = (txt || '').toString().trim();
            if (!s) return false;
            // Heurística simples: linha curta (tipo “Análisis con el auditorio.”)
            return s.length <= 140;
        };

        const extrairTempoETexto = (linha) => {
            const m = regexTempoInline.exec(linha);
            if (!m || typeof m.index !== 'number') return null;
            const tempo = m[1] || null;
            const before = linha.slice(0, m.index).trim();
            const after = linha.slice(m.index + m[0].length).trim();
            return { tempo, before, after };
        };

        const mergeAberturaEncerramento = (lista) => {
            const out = [];
            const isOracaoTipo = (tipo) => tipo === 'oracao_inicial' || tipo === 'oracao_final';

            for (let i = 0; i < lista.length; i++) {
                const cur = lista[i];
                const next = lista[i + 1];

                const curN = normalizar(cur?.titulo);
                const nextN = normalizar(next?.titulo);

                const curIsSongPrayer = isSongPrayerText(curN);
                const nextIsSongPrayer = isSongPrayerText(nextN);

                if (cur && isOracaoTipo(cur.tipo)) {
                    out.push({ ...cur, tempo: '5', secao: '', descricao: '', somenteOracao: true });
                    continue;
                }

                if (curIsSongPrayer && next && next.tipo === 'oracao_inicial') {
                    out.push({
                        ...next,
                        tempo: '5',
                        tipo: 'oracao_inicial',
                        titulo: `${cur.titulo} | ${next.titulo}`,
                        secao: '',
                        descricao: '',
                        somenteOracao: true,
                    });
                    i++;
                    continue;
                }

                if (cur && cur.tipo === 'oracao_inicial' && nextIsSongPrayer && i <= 1) {
                    out.push({
                        ...cur,
                        tempo: '5',
                        tipo: 'oracao_inicial',
                        titulo: `${next.titulo} | ${cur.titulo}`,
                        secao: '',
                        descricao: '',
                        somenteOracao: true,
                    });
                    i++;
                    continue;
                }

                if (cur && cur.tipo === 'oracao_final' && nextIsSongPrayer && i >= lista.length - 2) {
                    out.push({
                        ...cur,
                        tempo: '5',
                        tipo: 'oracao_final',
                        titulo: `${cur.titulo} | ${next.titulo}`,
                        secao: '',
                        descricao: '',
                        somenteOracao: true,
                    });
                    i++;
                    continue;
                }

                if (curIsSongPrayer && next && next.tipo === 'oracao_final' && i >= lista.length - 2) {
                    out.push({
                        ...next,
                        tempo: '5',
                        tipo: 'oracao_final',
                        titulo: `${next.titulo} | ${cur.titulo}`,
                        secao: '',
                        descricao: '',
                        somenteOracao: true,
                    });
                    i++;
                    continue;
                }

                out.push(cur);
            }
            return out;
        };

        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i];
            const linhaOriginal = linha.trim();
            const upper = linha.toUpperCase();

            if (upper.startsWith('PRESIDENTE')) continue;

            const sec = isHeaderSecao(linha);
            if (sec) {
                secaoAtual = sec;
                continue;
            }

            const tempoSozinho = linha.match(regexTempoSozinho);
            const nLine = normalizar(linha);

            const hasCantOrOrac =
                nLine.includes('cantico') ||
                nLine.includes('cancion') ||
                nLine.includes('oracao') ||
                nLine.includes('oracion');

            const looksLikeNumeroTitulo = /^\d+\.\s+/.test(linha.trim());

            const prox = linhas[i + 1] || '';
            const proxTempo = prox.match(regexTempoSozinho);

            const splitTempo = extrairTempoETexto(linha);

            // Merge do tempo quando ele vem numa linha separada (ou com “tail”) logo após o título numerado
            if (parteAtual && splitTempo && /^\d+\.\s+/.test((parteAtual.titulo || '').trim())) {
                const before = (splitTempo.before || '').trim();
                const beforeHasAlphaNum = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(before);
                const podeMesclar =
                    !beforeHasAlphaNum &&
                    (parteAtual._aguardandoTempoDescricao || !parteAtual.descricao) &&
                    !looksLikeNumeroTitulo;

                if (podeMesclar) {
                    parteAtual.tempo = String(splitTempo.tempo || parteAtual.tempo || '5');

                    if (!parteAtual._ignorarDescricao) {
                        const tail = (splitTempo.after || '').trim();

                        // NOVO: regra VIDA (exceto estudo) — permite só tail curto e bloqueia o parágrafo grande abaixo
                        const secParte = (parteAtual?.secao || '').toString().trim().toLowerCase();
                        if (secParte === 'vida' && parteAtual.tipo !== 'estudo') {
                            if (tail) parteAtual.descricao = tail;
                            parteAtual._vidaDescricaoBloqueada = true;
                            parteAtual._vidaSomenteCurta = true;
                        } else {
                            parteAtual.descricao = tail;
                        }
                    }

                    parteAtual._aguardandoTempoDescricao = false;
                    continue;
                }
            }

            const deveAbrirParte = looksLikeNumeroTitulo || !!splitTempo || hasCantOrOrac;

            if (deveAbrirParte) {
                commitParteAtual();

                let tempo = null;
                let titulo = linhaOriginal;
                let tail = '';

                if (splitTempo) {
                    tempo = splitTempo.tempo;

                    const tipoLinha = classifyTipo(linhaOriginal);
                    if (tipoLinha === 'oracao_inicial' || tipoLinha === 'oracao_final') {
                        titulo = linhaOriginal;
                        tail = '';
                    } else {
                        titulo = splitTempo.before || titulo;
                        tail = splitTempo.after || '';
                    }
                } else if (proxTempo) {
                    tempo = proxTempo[1];
                    i = i + 1; // pula a linha do tempo
                    titulo = linhaOriginal;
                } else if (tempoSozinho) {
                    tempo = tempoSozinho[1];
                }

                const tipo = classifyTipo(titulo);

                let secaoDaParte = secaoDefault();
                if (tipo === 'oracao_inicial' || tipo === 'oracao_final') secaoDaParte = '';

                if (!tempo) {
                    if (tipo === 'oracao_inicial' || tipo === 'oracao_final') tempo = '5';
                    else if (tipo === 'cantico') tempo = '3';
                    else tempo = '5';
                }

                if (tipo === 'oracao_inicial' || tipo === 'oracao_final') tempo = '5';

                parteAtual = {
                    id: Math.random(),
                    titulo,
                    tempo: String(tempo),
                    tipo,
                    secao: secaoDaParte,
                    descricao: '',
                    estudante: null,
                    ajudante: null,
                    somenteOracao: tipo === 'oracao_inicial' || tipo === 'oracao_final' ? true : undefined,
                };

                // Parte 1 (TESOUROS) ignora descrição
                const mNum = /^\s*(\d+)\./.exec(titulo);
                if (mNum && String(mNum[1]) === '1') {
                    parteAtual._ignorarDescricao = true;
                }

                if (tail && parteAtual && !parteAtual._ignorarDescricao) {
                    const secParte = (parteAtual?.secao || '').toString().trim().toLowerCase();

                    // NOVO: regra VIDA (exceto estudo) — permite tail curto e bloqueia o parágrafo grande abaixo
                    if (secParte === 'vida' && parteAtual.tipo !== 'estudo') {
                        parteAtual.descricao = tail;
                        parteAtual._vidaDescricaoBloqueada = true;
                        parteAtual._vidaSomenteCurta = true;
                    } else {
                        parteAtual.descricao = tail;
                    }
                }

                // Se abriu só o título numerado e o tempo vai vir depois, marca pra tentar “mesclar”
                if (/^\d+\.\s+/.test((parteAtual.titulo || '').trim()) && !splitTempo && !proxTempo) {
                    parteAtual._aguardandoTempoDescricao = true;
                }

                // Oracoes e cânticos são “auto-fechados”
                if (tipo === 'oracao_inicial' || tipo === 'oracao_final' || tipo === 'cantico') {
                    commitParteAtual();
                }

                continue;
            }

            // Linhas “soltas” viram descrição (1 linha) da parte atual
            if (parteAtual) {
                if (parteAtual._ignorarDescricao) continue;

                const n = normalizar(linha);
                if (!n || n === 'sua resposta' || n === 'respuesta') continue;

                const secParte = (parteAtual?.secao || '').toString().trim().toLowerCase();

                // NOVO: regra VIDA (exceto estudo)
                if (secParte === 'vida' && parteAtual.tipo !== 'estudo') {
                    // Se já pegou tail (ou já bloqueou), não adiciona mais nada (evita o parágrafo grande)
                    if (parteAtual._vidaDescricaoBloqueada || (parteAtual.descricao || '').trim()) {
                        commitParteAtual();
                        continue;
                    }

                    // Se não tem descrição ainda, aceita somente uma linha curta; caso contrário ignora
                    if (isVidaShortLine(linhaOriginal)) {
                        parteAtual.descricao = linhaOriginal;
                    }
                    commitParteAtual();
                    continue;
                }

                // Regra antiga (demais seções e estudo): 1 linha de descrição e fecha
                parteAtual.descricao = (parteAtual.descricao ? `${parteAtual.descricao} ` : '') + linhaOriginal;
                commitParteAtual();
                continue;
            }
        }

        const partesMerged = mergeAberturaEncerramento(partes);

        // aplica regra do cântico da VIDA = 5 no dado importado
        const partesFinal = aplicarRegraCanticoVida(partesMerged);

        if (!partesFinal || partesFinal.length === 0) {
            setErro(t.erroConteudo);
            return;
        }

        const semanaFinal = leituraSemanal ? `${semanaStr} - ${leituraSemanal}` : semanaStr;

        setDadosParaEdicao({
            semana: semanaFinal,
            partes: partesFinal,
            presidente: null,
            leitor: null,
        });
    };

    const handleImportar = async () => {
        setErro('');

        if (metodoAtivo === 'catalogo') return;

        if (metodoAtivo === 'texto') {
            const raw = (input || '').trim();
            if (!raw) return setErro(t.erroVazio);

            if (isLikelyHtml(raw)) {
                extrairDados(raw, 'html');
                return;
            }

            extrairDados(raw, 'texto');
            return;
        }

        const u = (url || '').trim();
        if (!u) return setErro(t.erroVazio);
        if (!isLikelyUrl(u) || !u.includes('jw.org')) return setErro(t.erroUrl);

        setLoading(true);
        try {
            const response = await fetch(proxyUrl(u));
            const html = await response.text();
            extrairDados(html, 'html');
        } catch (e) {
            setErro(t.msgErro);
        } finally {
            setLoading(false);
        }
    };

    const handleColar = async () => {
        setErro('');
        try {
            const clip = await navigator.clipboard.readText();
            if (!clip) return;

            if (isLikelyUrl(clip) && clip.includes('jw.org')) {
                setMetodoAtivo('link');
                setUrl(clip.trim());
                return;
            }

            setMetodoAtivo('texto');
            setInput(clip);
            setTimeout(() => inputRef.current?.focus?.(), 50);
        } catch (e) { }
    };

    const handleLimpar = () => {
        setErro('');
        setInput('');
        setUrl('');
        setBuscaApostila('');
        setApostilaSelecionada(null);
        setSemanas([]);
        setSemanasErro('');
    };

    const moverParte = (index, direcao) => {
        const n = [...dadosParaEdicao.partes];
        const target = direcao === 'cima' ? index - 1 : index + 1;
        if (target < 0 || target >= n.length) return;
        [n[index], n[target]] = [n[target], n[index]];
        setDadosParaEdicao({ ...dadosParaEdicao, partes: n });
    };

    const deletarParte = (id) => {
        setDadosParaEdicao({
            ...dadosParaEdicao,
            partes: dadosParaEdicao.partes.filter((p) => p.id !== id),
        });
    };

    const labelSecao = (secao) => {
        if (secao === 'tesouros') return t.secaoTesouros;
        if (secao === 'ministerio') return t.secaoMinisterio;
        if (secao === 'vida') return t.secaoVida;
        return t.secaoNA;
    };

    const uiSecaoKey = (p) => {
        const key = (p?.secao || '').trim();
        if (key === 'tesouros' || key === 'ministerio' || key === 'vida') return key;
        return 'na';
    };

    const apostilasFiltradas = useMemo(() => {
        const q = normalizar(buscaApostila);
        if (!q) return apostilas;
        return apostilas.filter(
            (a) => normalizar(a?.titulo || '').includes(q) || normalizar(a?.slug || '').includes(q)
        );
    }, [apostilas, buscaApostila]);

    // (continua na parte 3/3)

    // =====================
    // Importador.jsx (3/3)
    // =====================

    // ======= TELA DE REVISÃO =======
    if (dadosParaEdicao) {
        // Transparência: soma “visível” (sem conselhos) vs total efetivo (com conselhos)
        const somaPartes = totalInfo.totalVisivel;
        const bonusLeitura = totalInfo.bonusLeituraBiblia;
        const bonusMin = totalInfo.bonusMinisterio;
        const ministerioCount = totalInfo.ministerioCount;

        const ministerioTxt = (t.totalTempoMinisterioTpl || '').replace('{n}', String(bonusMin));

        return (
            <div className="max-w-4xl mx-auto space-y-6 bg-white p-6 rounded-3xl shadow-2xl border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 mb-2 pb-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Edit className="text-blue-600" />
                            {t.revisar}
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">
                            Idioma: <span className="font-bold text-blue-500 uppercase">{lang}</span>
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                        <button
                            onClick={() => {
                                setDadosParaEdicao(null);
                                setErro('');
                            }}
                            className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition"
                        >
                            {t.cancelar}
                        </button>

                        <button
                            onClick={() => {
                                setDadosParaEdicao(null);
                                setInput('');
                                setUrl('');
                                setErro('');
                                setMetodoAtivo('catalogo');
                                setApostilaSelecionada(null);
                                setSemanas([]);
                                setSemanasErro('');
                            }}
                            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition active:scale-95"
                            title={t.novaProg}
                        >
                            <span className="inline-flex items-center gap-2">
                                <Plus size={16} />
                                {t.novaProg}
                            </span>
                        </button>

                        <button
                            onClick={() => {
                                onImportComplete(dadosParaEdicao);
                                setDadosParaEdicao(null);
                                setInput('');
                                setUrl('');
                                setErro('');
                            }}
                            className="px-8 py-2 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition active:scale-95"
                        >
                            {t.confirmar}
                        </button>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs flex gap-2 items-start">
                    <Info className="mt-0.5 shrink-0" size={16} />
                    <div className="leading-snug">{t.dicaRevisao}</div>
                </div>

                <div
                    className={[
                        'rounded-xl p-3 text-xs border flex gap-2 items-start',
                        totalOk ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-800',
                    ].join(' ')}
                >
                    {totalOk ? (
                        <CheckCircle className="mt-0.5 shrink-0" size={16} />
                    ) : (
                        <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                    )}

                    <div className="leading-snug w-full">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <div className="font-extrabold">{t.totalTempoLabel}: {formatHm(totalMin)}</div>
                            <div className="text-[11px] opacity-80">{t.totalTempoEsperado}: 1:40–1:45 (100–105 min)</div>
                        </div>

                        {!totalOk ? <div className="text-[11px] mt-1">{t.totalTempoAviso}</div> : null}

                        <details className="mt-2">
                            <summary className="cursor-pointer select-none text-[11px] opacity-80">
                                {t.totalTempoDetalhes}
                            </summary>
                            <div className="mt-1 text-[11px] opacity-90 space-y-1">
                                <div>{t.totalTempoSomaPartes}: {formatHm(somaPartes)}</div>
                                {bonusLeitura > 0 ? <div>{t.totalTempoLeituraBiblia}</div> : null}
                                {ministerioCount > 0 ? <div>{ministerioTxt}</div> : null}
                            </div>
                        </details>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-inner">
                        <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">
                            {t.tituloSemana}
                        </label>
                        <input
                            type="text"
                            value={dadosParaEdicao.semana}
                            onChange={(e) =>
                                setDadosParaEdicao({
                                    ...dadosParaEdicao,
                                    semana: e.target.value,
                                })
                            }
                            className="w-full bg-white/60 border border-blue-100 rounded-xl px-3 py-2 font-bold text-lg text-blue-900 outline-none focus:ring-4 focus:ring-blue-100"
                        />
                    </div>

                    <div className="space-y-3">
                        {dadosParaEdicao.partes.map((p, idx) => {
                            const secKey = uiSecaoKey(p);
                            const ui = SECAO_UI[secKey];
                            const isOracao = p.tipo === 'oracao_inicial' || p.tipo === 'oracao_final';

                            return (
                                <div
                                    key={p.id}
                                    className={[
                                        'relative border p-4 pt-8 rounded-2xl flex gap-4 items-start hover:shadow-sm transition-all group',
                                        'border-l-4',
                                        ui.wrap,
                                        ui.left,
                                    ].join(' ')}
                                >
                                    <div
                                        className={[
                                            'absolute left-4 top-3 text-[10px] px-2 py-0.5 border rounded-full font-extrabold tracking-wide',
                                            ui.chip,
                                        ].join(' ')}
                                    >
                                        {labelSecao(p.secao)}
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => moverParte(idx, 'cima')}
                                            className="text-gray-300 hover:text-blue-500 p-1"
                                            title="Mover para cima"
                                        >
                                            <ArrowUp size={18} />
                                        </button>
                                        <button
                                            onClick={() => moverParte(idx, 'baixo')}
                                            className="text-gray-300 hover:text-blue-500 p-1"
                                            title="Mover para baixo"
                                        >
                                            <ArrowDown size={18} />
                                        </button>
                                    </div>

                                    <div className="flex-1 grid grid-cols-12 gap-3 items-end">
                                        <div className="col-span-12 md:col-span-8">
                                            <div className="flex items-center justify-between gap-2">
                                                <label className="text-[9px] font-bold text-gray-500 uppercase">
                                                    {t.rotulos.titulo}
                                                </label>
                                            </div>

                                            <input
                                                type="text"
                                                value={p.titulo}
                                                onChange={(e) => {
                                                    const n = [...dadosParaEdicao.partes];
                                                    n[idx].titulo = e.target.value;
                                                    setDadosParaEdicao({ ...dadosParaEdicao, partes: n });
                                                }}
                                                className={[
                                                    'w-full h-10 font-bold text-sm outline-none border rounded-xl px-3 py-2 bg-white/70',
                                                    'focus:ring-4',
                                                    ui.focus,
                                                ].join(' ')}
                                            />
                                        </div>

                                        <div className="col-span-6 md:col-span-2">
                                            <label className="text-[9px] font-bold text-gray-500 uppercase text-center block leading-none mb-1">
                                                {t.rotulos.tempo}
                                            </label>

                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={p.tempo}
                                                onChange={(e) => {
                                                    const n = [...dadosParaEdicao.partes];
                                                    n[idx].tempo = (e.target.value || '').replace(/[^\d]/g, '');
                                                    setDadosParaEdicao({ ...dadosParaEdicao, partes: n });
                                                }}
                                                className={[
                                                    'w-full h-10 text-center font-mono text-sm border rounded-xl px-3 py-2 bg-white/70 outline-none',
                                                    'focus:ring-4',
                                                    ui.focus,
                                                ].join(' ')}
                                            />
                                        </div>

                                        <div className="col-span-6 md:col-span-2">
                                            <label className="text-[9px] font-bold text-gray-500 uppercase block leading-none mb-1">
                                                {t.rotulos.secao}
                                            </label>

                                            <select
                                                value={p.secao}
                                                onChange={(e) => {
                                                    const n = [...dadosParaEdicao.partes];
                                                    n[idx].secao = e.target.value;
                                                    setDadosParaEdicao({ ...dadosParaEdicao, partes: n });
                                                }}
                                                className={[
                                                    'w-full h-10 text-[10px] font-extrabold bg-white/70 border rounded-xl px-3 py-2 outline-none',
                                                    'focus:ring-4',
                                                    ui.focus,
                                                ].join(' ')}
                                            >
                                                <option value="tesouros">{t.secaoTesouros}</option>
                                                <option value="ministerio">{t.secaoMinisterio}</option>
                                                <option value="vida">{t.secaoVida}</option>
                                                <option value="">{t.secaoNA}</option>
                                            </select>
                                        </div>

                                        <div className="col-span-12">
                                            <label className="text-[9px] font-bold text-gray-500 uppercase">
                                                {t.rotulos.detalhes}
                                            </label>

                                            <textarea
                                                value={p.descricao}
                                                onChange={(e) => {
                                                    const n = [...dadosParaEdicao.partes];
                                                    n[idx].descricao = e.target.value;
                                                    setDadosParaEdicao({ ...dadosParaEdicao, partes: n });
                                                }}
                                                className={[
                                                    'w-full text-xs text-gray-700 outline-none resize-y h-14 max-h-56 border rounded-xl p-3 bg-white/70',
                                                    'focus:ring-4',
                                                    ui.focus,
                                                ].join(' ')}
                                                placeholder={t.placeholderDetalhes}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => deletarParte(p.id)}
                                        className="text-gray-300 hover:text-red-600 p-2 rounded-xl hover:bg-white/50 transition"
                                        title="Excluir"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => {
                                const nova = {
                                    id: Math.random(),
                                    titulo: '',
                                    tempo: '5',
                                    tipo: 'parte',
                                    secao: 'tesouros',
                                    descricao: '',
                                    estudante: null,
                                    ajudante: null,
                                };
                                setDadosParaEdicao({
                                    ...dadosParaEdicao,
                                    partes: [...dadosParaEdicao.partes, nova],
                                });
                            }}
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition active:scale-[0.99] inline-flex items-center justify-center gap-2"
                        >
                            <Plus size={18} />
                            {t.addLinha}
                        </button>

                        <button
                            onClick={() => {
                                onImportComplete(dadosParaEdicao);
                                setDadosParaEdicao(null);
                                setInput('');
                                setUrl('');
                                setErro('');
                            }}
                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-2xl font-bold shadow hover:bg-green-700 transition active:scale-[0.99] inline-flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={18} />
                            {t.confirmar}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ======= TELA DE IMPORTAÇÃO =======
    return (
        <div className="max-w-3xl mx-auto space-y-6 bg-white p-6 rounded-3xl shadow-2xl border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <ClipboardList className="text-blue-600" />
                        Importador
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">{t.instrucao}</p>
                </div>

                <div className="text-xs text-gray-400 uppercase font-bold">{lang}</div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    className={[
                        'flex-1 px-4 py-2 rounded-xl font-bold border transition inline-flex items-center justify-center gap-2',
                        metodoAtivo === 'catalogo'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
                    ].join(' ')}
                    onClick={() => setMetodoAtivo('catalogo')}
                >
                    <Search size={18} />
                    {t.metodoCatalogo}
                </button>

                <button
                    className={[
                        'flex-1 px-4 py-2 rounded-xl font-bold border transition inline-flex items-center justify-center gap-2',
                        metodoAtivo === 'texto'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
                    ].join(' ')}
                    onClick={() => setMetodoAtivo('texto')}
                >
                    <ClipboardList size={18} />
                    {t.metodoTexto}
                </button>

                <button
                    className={[
                        'flex-1 px-4 py-2 rounded-xl font-bold border transition inline-flex items-center justify-center gap-2',
                        metodoAtivo === 'link'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
                    ].join(' ')}
                    onClick={() => setMetodoAtivo('link')}
                >
                    <LinkIcon size={18} />
                    {t.metodoLink}
                </button>
            </div>

            {/* Conteúdo: Escolher */}
            {metodoAtivo === 'catalogo' ? (
                <div className="space-y-4">
                    {!apostilaSelecionada ? (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-extrabold text-gray-800">{t.catalogTitulo}</div>
                                    <div className="text-xs text-gray-500">{t.catalogSub}</div>
                                </div>

                                <button
                                    onClick={() => carregarCatalogo({ force: true })}
                                    disabled={catalogLoading}
                                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    title={t.catalogAtualizar}
                                >
                                    <RefreshCcw size={16} className={catalogLoading ? 'animate-spin' : ''} />
                                    {t.catalogAtualizar}
                                </button>
                            </div>

                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    value={buscaApostila}
                                    onChange={(e) => setBuscaApostila(e.target.value)}
                                    placeholder={t.catalogBuscar}
                                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/60 pl-9 pr-3 py-2 text-sm text-gray-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200"
                                />
                            </div>

                            {catalogErro ? (
                                <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex gap-2 items-start">
                                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                                    <div className="leading-snug">{catalogErro}</div>
                                </div>
                            ) : null}

                            {catalogLoading ? (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 inline-flex items-center gap-2">
                                    <Loader2 className="animate-spin" size={16} />
                                    {t.catalogCarregando}
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    {apostilasFiltradas.map((a) => (
                                        <button
                                            key={a.url}
                                            onClick={() => abrirApostila(a)}
                                            className="text-left border border-gray-200 bg-white hover:bg-gray-50 rounded-2xl p-4 transition"
                                        >
                                            <div className="font-extrabold text-gray-800">{a.titulo}</div>
                                            <div className="text-xs text-gray-500">{a.slug}</div>
                                        </button>
                                    ))}

                                    {!catalogErro && apostilasFiltradas.length === 0 ? (
                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                                            {t.catalogSemResultados}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    onClick={() => {
                                        setApostilaSelecionada(null);
                                        setSemanas([]);
                                        setSemanasErro('');
                                        setErro('');
                                    }}
                                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition inline-flex items-center gap-2"
                                >
                                    <ChevronLeft size={16} />
                                    {t.voltar}
                                </button>

                                <a
                                    href={apostilaSelecionada.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition inline-flex items-center gap-2"
                                    title={t.abrirNoJw}
                                >
                                    <ExternalLink size={16} />
                                    {t.abrirNoJw}
                                </a>
                            </div>

                            <div>
                                <div className="text-sm font-extrabold text-gray-800">{t.semanasTitulo}</div>
                                <div className="text-xs text-gray-500">{t.semanasSub}</div>
                            </div>

                            {semanasErro ? (
                                <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex gap-2 items-start">
                                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                                    <div className="leading-snug">{semanasErro}</div>
                                </div>
                            ) : null}

                            {semanasLoading ? (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 inline-flex items-center gap-2">
                                    <Loader2 className="animate-spin" size={16} />
                                    {t.semanasCarregando}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {semanas.map((w) => (
                                        <div
                                            key={w.url}
                                            className="border border-gray-200 bg-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="font-extrabold text-gray-800">{w.titulo}</div>
                                                <div className="text-xs text-gray-500 truncate">{w.url}</div>
                                            </div>

                                            <div className="flex gap-2 justify-end">
                                                <a
                                                    href={w.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition inline-flex items-center gap-2"
                                                    title={t.abrirNoJw}
                                                >
                                                    <ExternalLink size={16} />
                                                </a>

                                                <button
                                                    onClick={() => importarSemanaByUrl(w.url)}
                                                    disabled={loading}
                                                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 transition inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={18} />}
                                                    {t.importarSemana}
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {!semanasErro && semanas.length === 0 ? (
                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                                            {t.semanasVazio}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : null}

            {/* Conteúdo: Texto/Link */}
            {metodoAtivo !== 'catalogo' ? (
                <div className="space-y-4">
                    {metodoAtivo === 'texto' ? (
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={t.placeholderTexto}
                            className="w-full h-56 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200 resize-none"
                        />
                    ) : (
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder={t.placeholderLink}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200"
                        />
                    )}

                    {erro ? (
                        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex gap-2 items-start">
                            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                            <div className="leading-snug">{erro}</div>
                        </div>
                    ) : null}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={handleColar}
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition active:scale-[0.99]"
                        >
                            {t.colar}
                        </button>

                        <button
                            onClick={handleLimpar}
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition active:scale-[0.99]"
                        >
                            {t.limpar}
                        </button>

                        <button
                            onClick={handleImportar}
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow hover:bg-blue-700 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={18} />}
                            {t.processar}
                        </button>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="text-xs font-extrabold text-gray-700 uppercase tracking-wide mb-2">
                            {t.dicasTitulo}
                        </div>
                        <ul className="text-xs text-gray-600 space-y-1 list-disc pl-5">
                            {t.dicasTexto.map((d, i) => (
                                <li key={i}>{d}</li>
                            ))}
                        </ul>
                        <div className="text-xs text-gray-500 mt-3">{t.exemplo}</div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default Importador;
