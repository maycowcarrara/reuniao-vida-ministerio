import { normalizar } from './helpers';
import { getWeekStartISOFromSemana } from '../revisarEnviar/dates';

let cheerioModulePromise;
const loadCheerio = async () => {
    if (!cheerioModulePromise) {
        cheerioModulePromise = import('cheerio');
    }
    return cheerioModulePromise;
};

// --- HELPER FUNCTIONS INTERNAS ---

const getTermos = (lang) =>
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

const limparTexto = (txt) => {
    if (!txt) return '';
    let out = txt.toString();
    out = out.replace(/<[^>]*>?/gm, ' ');
    out = out.replace(/\[([^\]]+)\]\((jwpub|https?):\/\/[^)]+\)/gi, '$1');
    out = out.replace(/\((jwpub|https?):\/\/[^)]+\)/gi, ' ');
    out = out.replace(/^\s{0,3}#{1,6}\s*/gm, '');
    out = out.replace(/[*_`>~]+/g, '');
    out = out.replace(/Sua resposta|Respuesta/gi, ' ');
    out = out.replace(/PERGUNTE-SE:|PREGUNTE-SE:|PREGÚNTESE:|PREGUNTESE:/gi, ' ');
    out = out.replace(/_{3,}/g, ' ');
    out = out.replace(/\s+/g, ' ').trim();
    return out;
};

const shouldIgnoreLine = (linha) => {
    const n = normalizar(linha);
    if (!n) return true;
    const ignores = [
        'pular para conteudo', 'pular para sumario', 'jw.org', 'testemunhas de jeova',
        'selecione o idioma', 'selecionar o idioma', 'log in', 'pesquisar', 'inicio',
        'ensinos biblicos', 'biblioteca', 'noticias', 'quem somos', 'ler em',
        'opcoes de download', 'sumario', 'anterior', 'proximo', 'copyright',
        'termos de uso', 'politica de privacidade', 'configuracoes de aparencia', 'links rapidos',
        'title:', 'url source:', 'published time:', 'markdown content:',
        'gostaria de ler este artigo em', 'sim nao', 'aceitar rejeitar personalizar',
        'copiado', 'copiar link', 'compartilhar por e-mail', 'mostrar tabela de conteudos',
        'this is a modal window', 'beginning of dialog window', 'end of dialog window',
        'saltar al contenido', 'saltar al sumario', 'saltar al indice', 'testigos de jehova',
        'seleccione el idioma', 'iniciar sesion', 'buscar', 'inicio', 'ensenanzas biblicas',
        'biblioteca', 'noticias', 'quienes somos', 'leer en', 'opciones de descarga',
        'sumario', 'anterior', 'siguiente', 'derechos de autor', 'terminos de uso',
        'politica de privacidad', 'configuracion de apariencia', 'enlaces rapidos',
        'le gustaria leer este articulo en', 'si no', 'copiar enlace', 'compartir por correo',
        'mostrar tabla de contenidos',
    ];
    if (ignores.some((x) => n.includes(x))) return true;
    if (/^\d+\.\s+(apostilas|apostila da reuniao vida e ministerio|guias|guia de actividades)/i.test(n)) return true;
    if (/^\d+\.\s+\d{1,2}.*(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i.test(n)) return true;
    const player = [
        'tempo', 'duration', 'reproduzir', 'voltar', 'avancar', 'mudo', 'configuracoes',
        'tiempo', 'duracion', 'reproducir', 'retroceder', 'adelantar', 'silenciar', 'configuracion',
    ];
    if (player.some((x) => n === x || n.startsWith(x + ' '))) return true;
    return false;
};

const extractSemanaLeituraFromText = (rawText) => {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
                const nextClean = (lines[i + 1] || '').replace(/^\[|\]$/g, '').trim();
                const next2 = (lines[i + 2] || '').replace(/^\[|\]$/g, '').trim();
                let fullLeitura = nextClean;
                if (/,\s*$/.test(nextClean) && /^\d{1,3}(?:\s*[-–]\s*\d{1,3})?$/.test(next2)) {
                    fullLeitura = `${nextClean} ${next2}`;
                }
                if (reLeitura.test(fullLeitura.toUpperCase())) leitura = fullLeitura.toUpperCase();
            }
        }
        if (!leitura && reLeitura.test(l.toUpperCase().trim())) leitura = l.toUpperCase().trim();
        if (semana && leitura) break;
    }
    if (!leitura) {
        const m = rawText.toUpperCase().match(/\b[A-ZÀ-ÜÇÃÕÑ]{2,}(?:\s+[A-ZÀ-ÜÇÃÕÑ]{2,})*\s+\d{1,3}(?:\s*(?:[-–]\s*\d{1,3}|,\s*\d{1,3})+)?\b/);
        if (m) leitura = m[0];
    }
    return { semana, leitura };
};

const extrairMioloTextoImportado = (rawText, termos) => {
    const texto = (rawText || '').toString().replace(/\r\n/g, '\n');
    if (!texto) return '';

    const marker = 'Markdown Content:';
    const afterMarker = texto.includes(marker) ? texto.slice(texto.indexOf(marker) + marker.length) : texto;
    const linhas = afterMarker.split('\n');
    const normalizadas = linhas.map((linha) => normalizar(linha));

    const isSectionLine = (n) => (
        termos.tesouros.some((x) => n.includes(x)) ||
        termos.ministerio.some((x) => n.includes(x)) ||
        termos.vida.some((x) => n.includes(x))
    );

    const isWeekHeading = (n) => {
        if (!n) return false;
        if (n.includes('programacao da reuniao vida e ministerio')) return true;
        return /(^| )\d{1,2}\s*(?:[-–]\s*\d{1,2}).*(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/iu.test(n);
    };

    const sectionStart = normalizadas.findIndex((n) => isSectionLine(n) || n.includes('comentarios iniciais') || n.includes('comentarios iniciales'));
    let startIndex = 0;

    if (sectionStart >= 0) {
        for (let i = sectionStart; i >= 0; i--) {
            if (isWeekHeading(normalizadas[i])) {
                startIndex = i;
                break;
            }
        }
    }

    let endIndex = linhas.length;
    for (let i = Math.max(startIndex, 0); i < normalizadas.length; i++) {
        const n = normalizadas[i];
        if (
            n === 'anterior' ||
            n === 'proximo' ||
            n === 'siguiente' ||
            n === 'imprimir' ||
            n.includes('opcoes de download') ||
            n.includes('opciones de descarga') ||
            n.includes('mostrar tabela de conteudos') ||
            n.includes('mostrar tabla de contenidos') ||
            n.includes('copiar link') ||
            n.includes('compartilhar por e-mail') ||
            n.includes('compartir por correo') ||
            n.includes('compartilhar compartilhar')
        ) {
            endIndex = i;
            break;
        }
    }

    return linhas.slice(startIndex, endIndex).join('\n').trim();
};

const extrairTextoDoHtmlJW = async (html) => {
    const cheerio = await loadCheerio();
    const $ = cheerio.load(html);
    const weekHeader = $('article header h1').first().text().trim() || '';
    const leituraHeader = $('article header h2').first().text().replace(/\s+/g, ' ').trim() || '';
    $('script, style, noscript, nav, footer, header').remove();
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
    const breadcrumb = $('ol.breadcrumbMenu span[aria-current="page"]').first().text().trim() || '';
    const pageTitle = $('.synopsis .syn-body h3 a').first().text().trim() ||
        $('.synopsis .syn-body h3').first().text().trim() ||
        $('main h1').first().text().trim() || '';
    const root = $('#regionMain').length ? $('#regionMain') : $('main').length ? $('main') : $('body');
    const blocos = root.find('h1,h2,h3,h4,p,li').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
    let texto = blocos.join('\n');
    if (!texto || texto.trim().length < 50) {
        texto = root.text().replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n');
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

const isSongPrayerText = (n) => {
    return (n.includes('cantico') || n.includes('cancion')) && (n.includes('oracao') || n.includes('oracion'));
};

const extrairTempoETexto = (linha) => {
    const regexTempoInline = /\(?\s*(\d+)\s*min(?:s)?(?:utos)?\.?\s*\)?/i;
    const m = regexTempoInline.exec(linha);
    if (!m || typeof m.index !== 'number') return null;
    return { tempo: m[1] || null, before: linha.slice(0, m.index).trim(), after: linha.slice(m.index + m[0].length).trim() };
};

const findFirstVidaCanticoIndex = (partes) => {
    const list = Array.isArray(partes) ? partes : [];
    for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if ((p?.secao || '').toLowerCase() === 'vida' && (p?.tipo || '').toLowerCase() === 'cantico') return i;
    }
    return -1;
};

// --- FUNÇÕES PRINCIPAIS DE EXPORTAÇÃO ---

export const calcularTotalInfo = (partes) => {
    const list = Array.isArray(partes) ? partes : [];
    const idxCanticoVida = findFirstVidaCanticoIndex(list);
    const isBibleReadingPart = (p) => {
        const titulo = normalizar(p?.titulo || '');
        return titulo.includes('lectura de la biblia') || titulo.includes('leitura da biblia');
    };

    const getMin = (p, idx) => {
        const base = parseInt(p?.tempo, 10) || 0;
        return idx === idxCanticoVida ? 5 : base;
    };

    const totalVisivel = list.reduce((sum, p, idx) => sum + getMin(p, idx), 0);
    const bonusLeituraBiblia = list.some((p) => isBibleReadingPart(p)) ? 1 : 0;
    const ministerioCount = list.reduce((sum, p) => (p?.secao || '').toLowerCase() === 'ministerio' ? sum + 1 : sum, 0);
    const totalEfetivo = totalVisivel + bonusLeituraBiblia + ministerioCount;

    return { totalVisivel, bonusLeituraBiblia, ministerioCount, bonusMinisterio: ministerioCount, totalEfetivo };
};

export const extrairDados = async (conteudo, tipoOrigem, lang) => {
    const termos = getTermos(lang);
    let textoProcessar = conteudo || '';
    let semanaStr = null;
    let leituraSemanal = null;
    let weekHeader = '';
    let breadcrumb = '';
    let pageTitle = '';
    let ogTitle = '';

    if (tipoOrigem === 'html') {
        const extraido = await extrairTextoDoHtmlJW(conteudo);
        const { texto, leituraHeader } = extraido;

        ({ ogTitle, breadcrumb, pageTitle, weekHeader } = extraido);
        textoProcessar = texto;
        semanaStr = (weekHeader && weekHeader.trim()) || extrairSemanaDeString(breadcrumb) ||
            extrairSemanaDeString(pageTitle) || extrairSemanaDeString(ogTitle) || null;
        leituraSemanal = (leituraHeader || '').replace(/\s+/g, ' ').trim();
    } else {
        textoProcessar = extrairMioloTextoImportado(conteudo, termos) || textoProcessar;
    }

    const bruto = (textoProcessar || '').toString();
    const linhas = bruto.split(/\r?\n/).map(limparTexto).filter((l) => l && l.length > 1).filter((l) => !shouldIgnoreLine(l));
    const { semana, leitura } = extractSemanaLeituraFromText(linhas.join('\n'));

    if (!semanaStr) semanaStr = semana || 'Semana a definir';
    if (!leituraSemanal) leituraSemanal = leitura || '';

    const partes = [];
    let secaoAtual = null;
    let parteAtual = null;
    const regexTempoSozinho = /^\(?\s*(\d+)\s*min(?:s)?(?:utos)?\.?\s*\)?$/i;

    const commitParteAtual = () => {
        if (parteAtual) {
            if (parteAtual._ignorarDescricao) parteAtual.descricao = '';
            delete parteAtual._ignorarDescricao;
            delete parteAtual._aguardandoTempoDescricao;
            delete parteAtual._vidaDescricaoBloqueada;
            delete parteAtual._vidaSomenteCurta;
            partes.push(parteAtual);
        }
        parteAtual = null;
    };

    for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        const nLine = normalizar(linha);

        if (linha.toUpperCase().startsWith('PRESIDENTE')) continue;

        if (termos.tesouros.some((x) => nLine.includes(x))) { secaoAtual = 'tesouros'; continue; }
        if (termos.ministerio.some((x) => nLine.includes(x))) { secaoAtual = 'ministerio'; continue; }
        if (termos.vida.some((x) => nLine.includes(x))) { secaoAtual = 'vida'; continue; }

        const tempoSozinho = linha.match(regexTempoSozinho);
        const splitTempo = extrairTempoETexto(linha);
        const looksLikeNumeroTitulo = /^\d+\.\s+/.test(linha.trim());
        const hasCantOrOrac = nLine.includes('cantico') || nLine.includes('cancion') || nLine.includes('oracao') || nLine.includes('oracion');
        const isIniciaisFinais = termos.iniciais.some(x => nLine.includes(x)) || termos.finais.some(x => nLine.includes(x)) || termos.conclusao.some(x => nLine.includes(x));

        // Merge logic
        if (parteAtual && splitTempo && /^\d+\.\s+/.test((parteAtual.titulo || '').trim())) {
            const beforeHasAlphaNum = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test((splitTempo.before || '').trim());
            if (!beforeHasAlphaNum && (parteAtual._aguardandoTempoDescricao || !parteAtual.descricao) && !looksLikeNumeroTitulo) {
                parteAtual.tempo = String(splitTempo.tempo || parteAtual.tempo || '5');
                if (!parteAtual._ignorarDescricao) {
                    const tail = (splitTempo.after || '').trim();
                    if ((parteAtual.secao || '') === 'vida' && parteAtual.tipo !== 'estudo') {
                        if (tail) { parteAtual.descricao = tail; parteAtual._vidaDescricaoBloqueada = true; }
                    } else {
                        parteAtual.descricao = tail;
                    }
                }
                parteAtual._aguardandoTempoDescricao = false;
                continue;
            }
        }

        // AGORA REQUER COMEÇAR COM NÚMERO (ou ser cântico/oração/comentários iniciais e finais)
        if (looksLikeNumeroTitulo || hasCantOrOrac || isIniciaisFinais) {
            commitParteAtual();
            let tempo = null;
            let titulo = linha;
            let tail = '';

            if (splitTempo) {
                tempo = splitTempo.tempo;
                titulo = splitTempo.before || titulo;
                tail = splitTempo.after || '';
            } else if (tempoSozinho) {
                tempo = tempoSozinho[1];
            } else if (linhas[i + 1] && linhas[i + 1].match(regexTempoSozinho)) {
                tempo = linhas[i + 1].match(regexTempoSozinho)[1];
                i++; // Skip next line
            }

            let tipo = 'parte';
            const nTitle = normalizar(titulo).replace(/^\d+\s*\.\s*/g, '').trim();
            if (termos.finais.some((x) => nTitle.includes(x)) || termos.conclusao.some((x) => nTitle.includes(x))) tipo = 'oracao_final';
            else if (termos.iniciais.some((x) => nTitle.includes(x))) tipo = 'oracao_inicial';
            else if (termos.estudo.some((x) => nTitle.includes(x))) tipo = 'estudo';
            else if (termos.cantico.some((x) => nTitle.includes(x))) tipo = 'cantico';

            if (tipo === 'oracao_inicial') { titulo = linha; tail = ''; tempo = '6'; }
            else if (tipo === 'oracao_final') { titulo = linha; tail = ''; tempo = '8'; }

            if (!tempo) tempo = tipo === 'cantico' ? '3' : '5';

            parteAtual = {
                id: Math.random(),
                titulo,
                tempo: String(tempo),
                tipo,
                secao: (tipo === 'oracao_inicial' || tipo === 'oracao_final') ? '' : (secaoAtual || 'tesouros'),
                descricao: '',
                estudante: null, ajudante: null,
                somenteOracao: (tipo === 'oracao_inicial' || tipo === 'oracao_final') ? true : undefined
            };

            // NOVA REGRA: Ignorar descrição das partes 1 e 2 (Discurso e Joias)
            if (/^\s*[12]\./.test(titulo) && (secaoAtual || 'tesouros') === 'tesouros') parteAtual._ignorarDescricao = true;
            if (/^\d+\.\s+/.test(titulo) && !splitTempo) parteAtual._aguardandoTempoDescricao = true;

            if (tail && !parteAtual._ignorarDescricao) {
                if (parteAtual.secao === 'vida' && parteAtual.tipo !== 'estudo') {
                    parteAtual.descricao = tail; parteAtual._vidaDescricaoBloqueada = true;
                } else {
                    parteAtual.descricao = tail;
                }
            }

            if (['oracao_inicial', 'oracao_final', 'cantico'].includes(tipo)) commitParteAtual();
            continue;
        }

        // Descrição solta
        if (parteAtual && !parteAtual._ignorarDescricao) {
            const n = normalizar(linha);
            if (!n || n === 'sua resposta' || n === 'respuesta') continue;

            if (parteAtual.secao === 'vida' && parteAtual.tipo !== 'estudo') {
                if (parteAtual._vidaDescricaoBloqueada || (parteAtual.descricao || '').trim()) { commitParteAtual(); continue; }
                if (linha.trim().length <= 140) parteAtual.descricao = linha;
                commitParteAtual();
                continue;
            }
            parteAtual.descricao = (parteAtual.descricao ? `${parteAtual.descricao} ` : '') + linha;
            commitParteAtual();
        }
    }
    commitParteAtual();

    // Merge Abertura/Encerramento logic
    const merged = [];
    for (let i = 0; i < partes.length; i++) {
        const cur = partes[i];
        const next = partes[i + 1];
        const isSongPrayer = (p) => isSongPrayerText(normalizar(p?.titulo || ''));

        // CORREÇÃO: As mesclagens (Song + Prayer) devem vir antes para não serem engolidas pelos individuais
        if (isSongPrayer(cur) && next?.tipo === 'oracao_inicial') {
            merged.push({ ...next, tempo: '6', titulo: `${cur.titulo} | ${next.titulo}`, secao: '', somenteOracao: true });
            i++; continue;
        }
        if (cur.tipo === 'oracao_inicial' && next && isSongPrayer(next) && i <= 1) {
            merged.push({ ...cur, tempo: '6', titulo: `${next.titulo} | ${cur.titulo}`, secao: '', somenteOracao: true });
            i++; continue;
        }
        if (cur.tipo === 'oracao_final' && next && isSongPrayer(next)) {
            merged.push({ ...cur, tempo: '8', titulo: `${cur.titulo} | ${next.titulo}`, secao: '', somenteOracao: true });
            i++; continue;
        }
        if (isSongPrayer(cur) && next?.tipo === 'oracao_final') {
            merged.push({ ...next, tempo: '8', titulo: `${next.titulo} | ${cur.titulo}`, secao: '', somenteOracao: true });
            i++; continue;
        }

        // Retaguarda caso não tenha mesclagem
        if (cur.tipo === 'oracao_inicial') {
            merged.push({ ...cur, tempo: '6', secao: '', descricao: '', somenteOracao: true });
            continue;
        }
        if (cur.tipo === 'oracao_final') {
            merged.push({ ...cur, tempo: '8', secao: '', descricao: '', somenteOracao: true });
            continue;
        }

        merged.push(cur);
    }

    // Regra Cântico Vida = 5
    const idxVida = findFirstVidaCanticoIndex(merged);
    if (idxVida >= 0) merged[idxVida].tempo = '5';

    if (!merged.length) return null;

    const dataInicio = getWeekStartISOFromSemana({
        semanaStr,
        isoFallback: null,
        textSources: [weekHeader, breadcrumb, pageTitle, ogTitle, bruto, semanaStr]
    });

    return {
        semana: leituraSemanal ? `${semanaStr} - ${leituraSemanal}` : semanaStr,
        dataInicio,
        partes: merged,
        presidente: null,
        leitor: null,
    };
};
