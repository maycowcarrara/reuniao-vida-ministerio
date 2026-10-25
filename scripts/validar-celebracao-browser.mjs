import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mayco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

// Um único ensaio, sem retries: qualquer falha encerra a validação no navegador.
// Interface real, adaptadores DEV em memória e todas as requisições externas bloqueadas.
const out = 'tmp/celebracao-browser';
await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5197, strictPort: true, hmr: false },
    define: { 'import.meta.env.VITE_MULTI_GRUPOS_LOCAL': JSON.stringify('true') },
    plugins: [{ name: 'ensaio-celebracao-interface-atual', enforce: 'pre', transform(code, id) {
        const path = id.replaceAll('\\', '/');
        if (path.endsWith('/src/App.jsx')) {
            const source = 'const usarInterfaceIndependente = MULTI_GRUPOS_LOCAL;';
            if (!code.includes(source)) throw new Error('Seleção de interface mudou; revise o ensaio.');
            return { code: code.replace(source, 'const usarInterfaceIndependente = false;'), map: null };
        }
        if (path.endsWith('/src/data/ensaioGrupos.js')) {
            const source = 'export const lerDadosSessaoEnsaio = () => dadosDaSessao ??= createDadosEnsaioReunioes();';
            if (!code.includes(source)) throw new Error('Inicializador do ensaio mudou.');
            return { code: code.replace(source, `export const lerDadosSessaoEnsaio = () => {
                if (dadosDaSessao) return dadosDaSessao;
                const dados = createDadosEnsaioReunioes();
                const grupo = dados.configuracoes.grupos['grupo-portugues'];
                grupo.meioSemana = { habilitada: true, frequencia: 'semanal', dia: 'wednesday', horario: '19:30' };
                grupo.fimDeSemana = { habilitada: true, frequencia: 'semanal', dia: 'sunday', horario: '10:00' };
                dados.alunos[0].partesHabilitadas.push('audio_video', 'indicador_entrada', 'indicador_auditorio', 'microfones_volantes');
                Object.assign(dados.historico_reunioes[0], { publicadaNoQuadro: true,
                    meioSemana: { ativo: true, data: '2026-11-04', horario: '19:30' },
                    partes: [{ id: 'parte-normal-qa', titulo: 'Parte normal preservada', tempo: '5', secao: 'tesouros' }],
                    fimDeSemana: { ativo: true, data: '2026-11-08', horario: '10:00',
                        reuniaoPublica: { temaDiscurso: 'Tema do ensaio', oradorNomeManual: 'Orador público do ensaio' } } });
                return dadosDaSessao = dados;
            };`), map: null };
        }
    } }] });
let browser, page;
const errors = [];
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    page = await browser.newPage({ viewport: { width: 1365, height: 960 } });
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:5197/admin');
    const tipoEvento = page.locator('select').filter({ has: page.locator('option[value="celebracao"]') });
    await tipoEvento.selectOption('celebracao');
    await page.locator('input[type="date"]').fill('2026-11-06');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[type="date"]')?.value === '');
    await page.locator('aside').getByRole('button').filter({ hasText: /Designar/ }).click();
    const editor = page.locator('[data-celebracao-editor]');
    await editor.waitFor();
    assert.equal(await page.getByText('Parte normal preservada', { exact: true }).count(), 0);
    await editor.locator('input[name="horario"]').fill('18:30');
    await editor.locator('input[name="oradorNomeManual"]').fill('Orador da celebração no ensaio');
    await editor.getByRole('button', { name: 'Salvar', exact: true }).click();
    await editor.getByRole('status').filter({ hasText: 'Celebração salva.' }).waitFor();
    await editor.locator('select').first().selectOption('pessoa-fixture-001');
    await editor.locator('span').filter({ hasText: /^Pessoa de ensaio$/ }).waitFor();
    await page.screenshot({ path: `${out}/meio-semana-designar.png`, fullPage: true });
    console.log('Dia útil: discurso manual e apoio salvos; partes normais substituídas ocultas.');
    // Troca de idioma pelo seletor real; a celebração PT não pode aparecer em ES.
    await page.getByRole('button', { name: /Español/ }).first().click();
    assert.equal(await page.locator('[data-celebracao-editor]').count(), 0);
    await page.getByRole('button', { name: /Português/ }).first().click();
    await editor.waitFor();
    await page.locator('aside').getByRole('button').filter({ hasText: /Início/ }).click();
    await tipoEvento.selectOption('celebracao');
    await page.locator('input[type="date"]').fill('2026-11-08');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[type="date"]')?.value === '');
    await page.locator('aside').getByRole('button').filter({ hasText: /Designar/ }).click();
    await editor.waitFor();
    assert.equal(await editor.locator('input[name="oradorNomeManual"]').inputValue(), 'Orador da celebração no ensaio');
    await page.getByText('Parte normal preservada', { exact: true }).waitFor();
    assert.equal(await page.locator('input[value="Orador público do ensaio"]').count(), 0);
    await page.screenshot({ path: `${out}/fim-semana-designar.png`, fullPage: true });
    await page.locator('aside').getByRole('button').filter({ hasText: /Revisar.*Enviar/ }).click();
    await page.locator('[data-semana-celebracao]').waitFor();
    await page.screenshot({ path: `${out}/impressao.png`, fullPage: true });
    await page.pdf({ path: `${out}/programacao-celebracao.pdf`, format: 'A4', printBackground: true });
    assert.deepEqual(errors, []);
    await fs.writeFile(`${out}/resultado.json`, JSON.stringify({ sucesso: true, errors, cenarios: ['dia-util', 'orador-manual', 'apoio-habilitado', 'isolamento-ES', 'fim-de-semana', 'preservacao-designacoes', 'impressao'] }, null, 2));
    console.log('Fim de semana: meio de semana preservado; celebração e impressão verificadas.');
} catch (error) {
    await fs.writeFile(`${out}/falha.txt`, `${error.stack || error}\n${errors.join('\n')}`);
    if (page) await page.screenshot({ path: `${out}/falha.png`, fullPage: true }).catch(() => {});
    throw error;
} finally {
    await browser?.close();
    await server.close();
}
