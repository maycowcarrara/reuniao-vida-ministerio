import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mayco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out = 'tmp/e7-impressao';
await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5188, strictPort: true, hmr: false },
    define: { 'import.meta.env.VITE_MULTI_GRUPOS_LOCAL': JSON.stringify('true') } });
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage();
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:5188/quadro');
    await page.locator('a[href="/admin"]').first().waitFor();
    // Fixtures preparadas na memória antes de montar o admin, sem recarga.
    await page.evaluate(async () => {
        const { createDadosEnsaioGrupos, guardarDadosSessaoEnsaio } = await import('/src/data/ensaioGrupos.js');
        const dados = createDadosEnsaioGrupos();
        dados.historico_reunioes = Array.from({ length: 5 }, (_, i) => {
            const date = new Date('2026-11-02T12:00:00Z'); date.setUTCDate(date.getUTCDate() + i * 7);
            return { ...dados.historico_reunioes[0], id: `pt-print-${i}`, semana: `Semana PT de ensaio ${i + 1}`,
                dataInicio: date.toISOString().slice(0, 10), dataReuniao: date.toISOString().slice(0, 10),
                presidente: { id: 'fixture', nome: 'Presidente fictício' },
                partes: Array.from({ length: 8 }, (_, j) => ({ id: `parte-${j}`, secao: j < 3 ? 'tesouros' : j < 6 ? 'ministerio' : 'vida',
                    titulo: `Parte de ensaio ${j + 1}`, tempo: '5', estudante: { id: 'fixture', nome: 'Pessoa de ensaio' } })) };
        });
        guardarDadosSessaoEnsaio(dados);
    });
    await page.locator('a[href="/admin"]').first().click();
    await page.locator('aside').waitFor();
    await page.locator('aside').getByRole('button').filter({ hasText: /Revisar.*Enviar/ }).click();
    for (const n of [1, 2, 4, 5]) {
        await page.emulateMedia({ media: 'screen' });
        await page.getByLabel('Layout', { exact: true }).selectOption(String(n));
        const caixas = page.locator('label').filter({ hasText: /^Semana PT de ensaio \d$/ }).locator('input');
        for (let i = 0; i < 5; i++) await caixas.nth(i).setChecked(i < n);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.emulateMedia({ media: 'print' });
        await page.pdf({ path: `${out}/pt-${n}.pdf`, preferCSSPageSize: true, printBackground: true });
        await fs.writeFile(`${out}/pt-${n}.txt`, await page.locator('#print-root').innerText());
        console.log(`Layout PT ${n} renderizado pelo componente na aplicação local.`);
    }
} catch (error) { await fs.writeFile(`${out}/falha.txt`, error.stack || error.message); throw error; }
finally { await browser?.close(); await server.close(); }
