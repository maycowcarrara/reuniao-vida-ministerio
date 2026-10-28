import http from 'node:http';
import fs from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mayco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

// Harness PWA: SW real do build + appUpdater real, shell totalmente fictício.
// Não executa o bootstrap Firebase do bundle nem representa instalação física.
const out = 'tmp/e7-pwa'; await fs.mkdir(out, { recursive: true });
const root = resolve('dist');
const sw = await fs.readFile(resolve(root, 'sw.js'), 'utf8');
assert.match(sw, /url:"index\.html",revision:"[^"]+"/);
let revision = 'A';
const shell = () => `<!doctype html><html lang="pt"><meta charset="utf-8"><title>Ensaio PWA ${revision}</title><link rel="manifest" href="/manifest.webmanifest"><body><h1>Fixture PWA ${revision}</h1><p>Dados fictícios. Nenhuma autenticação ou escrita.</p><button id="update">Atualizar explicitamente</button><script type="module">
window.controllerChanges=0;
navigator.serviceWorker.addEventListener('controllerchange',()=>window.controllerChanges++);
window.updater=await import('/e7-appUpdater.js');
window.updater.limparMarcadoresAtualizacao();
window.registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
window.updater.registerServiceWorkerRegistration(window.registration);
window.ready=await navigator.serviceWorker.ready;
document.querySelector('#update').onclick=()=>window.updater.refreshAppVersion('fixture-B');
</script></body></html>`;
const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://127.0.0.1:5189');
        const path = url.pathname;
        res.setHeader('Cache-Control', 'no-store');
        if (path === '/' || path === '/index.html') {
            if (revision === 'B' && url.searchParams.has('__WB_REVISION__')) await new Promise(done => setTimeout(done, 1600));
            res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(shell()); return;
        }
        if (path === '/version.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ version: `fixture-${revision}`, entry: `/assets/fixture-${revision}.js` })); return; }
        if (path === '/sw.js') {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(sw.replace(/(url:"index\.html",revision:")[^"]+/, `$1e7-fixture-${revision}`)); return;
        }
        if (path === '/e7-appUpdater.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(await fs.readFile('src/services/appUpdater.js')); return; }
        const target = resolve(root, '.' + decodeURIComponent(path));
        if (!target.startsWith(root + sep)) { res.writeHead(403).end(); return; }
        const mime = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
        res.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
        res.end(await fs.readFile(target));
    } catch { res.writeHead(404).end(); }
});
let browser;
try {
    await new Promise((done, fail) => { server.once('error', fail); server.listen(5189, '127.0.0.1', done); });
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const one = await context.newPage();
    await one.goto('http://127.0.0.1:5189/');
    await one.waitForFunction(() => !!window.ready);
    // Navegação deliberada do cenário de instalação, não retry de falha.
    await one.reload(); await one.waitForFunction(() => !!navigator.serviceWorker.controller && !!window.ready);
    const two = await context.newPage(); await two.goto('http://127.0.0.1:5189/');
    await two.waitForFunction(() => !!window.ready);
    assert.equal(await one.locator('h1').innerText(), 'Fixture PWA A');
    assert.equal(await two.locator('h1').innerText(), 'Fixture PWA A');
    assert.equal(await one.evaluate(() => window.controllerChanges), 0);
    await context.setOffline(true); await two.reload();
    await two.getByRole('heading', { name: 'Fixture PWA A', exact: true }).waitFor();
    await context.setOffline(false);
    revision = 'B';
    await one.getByRole('button', { name: 'Atualizar explicitamente', exact: true }).click();
    await one.waitForTimeout(1000);
    assert.equal(await one.locator('h1').innerText(), 'Fixture PWA A');
    await one.getByRole('heading', { name: 'Fixture PWA B', exact: true }).waitFor();
    assert.equal(new URL(one.url()).searchParams.has('appUpdate'), false);
    assert.equal(await two.locator('h1').innerText(), 'Fixture PWA A');
    await two.reload(); await two.getByRole('heading', { name: 'Fixture PWA B', exact: true }).waitFor();
    await context.setOffline(true); await one.reload();
    await one.getByRole('heading', { name: 'Fixture PWA B', exact: true }).waitFor();
    await context.setOffline(false);
    await fs.writeFile(`${out}/resultado.json`, JSON.stringify({ origem: 'shell-ficticio-local', sw: 'dist/sw.js', updater: 'src/services/appUpdater.js',
        duasAbas: true, instalacaoAcimaDe900ms: true, atualizacaoAguardouAcao: true, offlineVersaoA: true, offlineVersaoB: true, segundaAbaSemReloadForcado: true,
        aceitePwaInstaladoFisico: false }, null, 2));
    await one.screenshot({ path: `${out}/versao-b.png` });
    console.log('SW gerado: duas abas, waiting, atualização explícita e offline A/B verificados no harness local.');
} catch (error) { await fs.writeFile(`${out}/falha.txt`, error.stack || error.message); throw error; }
finally { await browser?.close(); await new Promise(done => server.close(done)); }
