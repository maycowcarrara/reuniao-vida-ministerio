import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDadosEnsaioGrupos } from '../src/data/ensaioGrupos.js';
import { projetarConfigGrupo } from '../src/utils/grupoAtivo.js';

// Validação de impressão com fixtures SSR e assets locais, sem requisições remotas.
const out = 'tmp/e5-render';
const somenteHtml = process.argv.includes('--somente-html');
await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
let browser;
try {
    const { default: Revisar } = await server.ssrLoadModule('/src/components/RevisarEnviar/index.jsx');
    const d = createDadosEnsaioGrupos();
    const p = d.historico_reunioes[1];
    p.fimDeSemana.presidente = { id: 'fixture', nome: 'Presidente fictício' };
    p.fimDeSemana.reuniaoPublica = { temaDiscurso: 'Un futuro de paz', oradorNomeManual: 'Orador fictício', congregacaoOrador: 'Congregación de prueba' };
    p.fimDeSemana.estudoSentinela = { dirigente: { nome: 'Dirigente fictício' }, leitor: { nome: 'Leitor fictício' } };
    const html = renderToStaticMarkup(createElement(Revisar, { somenteImpressao: true, historico: [p], alunos: [], config: projetarConfigGrupo(d.configuracoes, p.grupoId) }));
    const files = (await fs.readdir('dist/assets')).filter(f => f.endsWith('.css'));
    const css = (await Promise.all(files.map(f => fs.readFile(`dist/assets/${f}`, 'utf8')))).join('\n');
    await fs.writeFile(`${out}/fim-isolado.html`, `<!doctype html><html lang="es"><meta charset="utf-8"><title>E5 - Fim de semana isolado (fixture)</title><style>${css}</style><body>${html}</body></html>`);
    if (somenteHtml) {
        console.log('HTML preparado para conferência manual (nenhum navegador aberto): ' + out + '/fim-isolado.html');
    } else {
    const { chromium } = await import('file:///C:/Users/mayco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent(await fs.readFile(`${out}/fim-isolado.html`, 'utf8'));
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: `${out}/fim-isolado.pdf`, preferCSSPageSize: true, printBackground: true });
    await page.screenshot({ path: `${out}/fim-isolado.png`, fullPage: true });
    console.log('Impressão local renderizada: ' + out);
    }
} finally { await browser?.close(); await server.close(); }
