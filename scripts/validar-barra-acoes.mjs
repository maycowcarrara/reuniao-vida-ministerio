import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mayco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out = 'tmp/barra-acoes'; await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5198, strictPort: true, hmr: false },
    define: { 'import.meta.env.VITE_MULTI_GRUPOS_LOCAL': JSON.stringify('true') },
    plugins: [{ name: 'qa-barra-local', enforce: 'pre', transform(code, id) {
        const path = id.replaceAll('\\', '/');
        if (path.endsWith('/src/App.jsx')) return { code: code.replace('const usarInterfaceIndependente = MULTI_GRUPOS_LOCAL;', 'const usarInterfaceIndependente = false;'), map: null };
        if (path.endsWith('/src/utils/progressoOperacoes.js')) return { code: code.replace('try { return await executar(); }', `try {
            if (tipo === 'salvarConfiguracoes') await new Promise(resolve => setTimeout(resolve, 1400));
            return await executar();
        }`), map: null };
    } }] });
let browser, page;
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:5198/admin');
    await page.locator('aside').getByRole('button', { name: 'Configurações', exact: true }).click();
    await page.evaluate(() => {
        window.__ciclosBarra = [];
        new MutationObserver(() => {
            const barra = document.querySelector('.rvm-progresso-topo');
            if (!barra) return;
            window.__ciclosBarra.push({ ciclo: barra.dataset.ciclo, fase: barra.dataset.fase,
                largura: parseFloat(barra.firstElementChild.style.width) });
        }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'data-fase', 'data-ciclo'] });
    });
    await page.locator('#config-grupos label').filter({ hasText: 'Identificação' }).first().locator('input').fill('Identificação fictícia da barra');
    await page.getByRole('button', { name: 'Salvar configuração', exact: true }).click();
    const barra = page.getByRole('progressbar');
    await barra.waitFor();
    const box = await barra.boundingBox(); assert.equal(box.y, 0); assert.equal(box.height, 3);
    const largura = () => barra.locator('div').evaluate(element => element.getBoundingClientRect().width);
    const inicio = await largura();
    await page.waitForTimeout(450);
    assert.ok(await largura() > inicio);
    await page.screenshot({ path: `${out}/salvando-desktop.png` });
    await page.getByText('Configuração salva.', { exact: true }).waitFor();
    await barra.waitFor({ state: 'detached' });
    const configTrace = await page.evaluate(() => window.__ciclosBarra);
    assert.equal(new Set(configTrace.map(item => item.ciclo)).size, 1);
    assert.equal(configTrace.filter((item, i) => item.fase === 'concluido' && configTrace[i - 1]?.fase !== 'concluido').length, 1);
    // Duas etapas com uma pausa entre elas não reiniciam a linha nem chegam
    // ao fim antes de a segunda etapa concluir.
    await page.evaluate(async () => {
        window.__ciclosBarra = [];
        const m = await import('/src/utils/progressoOperacoes.js');
        window.__etapasBarra = (async () => {
            await m.acompanharOperacao('salvarProgramacoes', () => new Promise(resolve => setTimeout(resolve, 200)));
            await new Promise(resolve => setTimeout(resolve, 40));
            await m.acompanharOperacao('publicar', () => new Promise(resolve => setTimeout(resolve, 300)));
        })();
    });
    await barra.waitFor();
    await page.evaluate(() => window.__etapasBarra);
    await barra.waitFor({ state: 'detached' });
    const etapasTrace = await page.evaluate(() => window.__ciclosBarra);
    assert.equal(new Set(etapasTrace.map(item => item.ciclo)).size, 1);
    for (let i = 1; i < etapasTrace.length; i++) assert.ok(etapasTrace[i].largura >= etapasTrace[i - 1].largura);
    assert.equal(etapasTrace.filter((item, i) => item.fase === 'concluido' && etapasTrace[i - 1]?.fase !== 'concluido').length, 1);
    // Operação instantânea continua produzindo uma conclusão breve, sem
    // prolongar a gravação nem impedir novos cliques após o término.
    await page.evaluate(async () => {
        const m = await import('/src/utils/progressoOperacoes.js');
        await m.acompanharOperacao('salvarCadastro', async () => {});
    });
    await barra.waitFor();
    await page.locator('.rvm-progresso-topo[data-fase="concluido"]').waitFor();
    await barra.waitFor({ state: 'detached' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => {
        const m = await import('/src/utils/progressoOperacoes.js');
        window.__barraTeste = m.acompanharOperacao('salvarCadastro', () => new Promise(resolve => { window.__concluirBarra = resolve; }));
    });
    await barra.waitFor();
    const mobile = await barra.boundingBox(); assert.equal(mobile.y, 0); assert.equal(mobile.height, 3); assert.equal(mobile.width, 390);
    await page.screenshot({ path: `${out}/salvando-mobile.png` });
    await page.evaluate(() => window.__concluirBarra());
    await barra.waitFor({ state: 'detached' });
    await fs.writeFile(`${out}/resultado.json`, JSON.stringify({ fixtureLocal: true, barraTopo3px: true, avancoVisual: true, acaoRapida: true, desktopEMobile: true,
        cicloUnicoConfiguracao: true, cicloUnicoSalvarPublicar: true, semRecuoDaLinha: true, configTrace, etapasTrace, escritaReal: false }, null, 2));
    console.log('PASSOU: ciclo único em configuração e salvar/publicar, linha sem recuo, ação rápida e tela móvel.');
} catch (error) {
    if (page) await page.screenshot({ path: `${out}/falha.png` }).catch(() => {});
    throw error;
} finally { await browser?.close(); await server.close(); }
