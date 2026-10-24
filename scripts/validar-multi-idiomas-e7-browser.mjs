import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mayco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

// Sem login, dados reais ou rede externa. Correções/revalidação locais foram
// autorizadas pelo usuário sem novas perguntas; registrar qualquer falha.
const out = 'tmp/e7-browser';
await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5187, strictPort: true, hmr: false },
    define: { 'import.meta.env.VITE_MULTI_GRUPOS_LOCAL': JSON.stringify('true') } });
let browser, page;
const errosPagina = [];
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    page = await browser.newPage();
    page.on('pageerror', error => errosPagina.push(error.stack || error.message));
    page.setDefaultTimeout(8000);
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:5187/admin');
    await page.getByRole('button', { name: 'Programação em foco: Español', exact: false }).waitFor();
    await fs.writeFile(`${out}/inicio.json`, JSON.stringify({ text: await page.locator('body').innerText(), buttons: await page.getByRole('button').allTextContents() }, null, 2));
    await page.screenshot({ path: `${out}/inicio.png`, fullPage: true });
    console.log('Início do ensaio capturado.');
    await page.getByRole('button', { name: 'Programação em foco: Español', exact: false }).click();
    await page.locator('aside').getByRole('button').filter({ hasText: /Asignar|Designar/ }).click();
    await page.getByLabel('Fecha elegida', { exact: true }).fill('2026-12-06');
    await page.getByLabel('Horario', { exact: true }).fill('10:45');
    await page.getByRole('button', { name: 'Ver vista previa', exact: true }).click();
    const error = await page.getByRole('alert').allTextContents();
    if (error.length) throw new Error('Prévia E3: ' + error.join('; '));
    await page.getByRole('button', { name: 'Confirmar borradores', exact: true }).click();
    await page.locator('article').filter({ hasText: '2026-12-06 10:45' }).waitFor();
    await fs.writeFile(`${out}/e3-criada.json`, JSON.stringify({ text: await page.locator('body').innerText(), buttons: await page.getByRole('button').allTextContents() }, null, 2));
    await page.screenshot({ path: `${out}/e3-criada.png`, fullPage: true });
    console.log('E3: data/horário preenchidos, prévia e gravação local confirmadas.');
    const es = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Asignaciones del grupo', exact: true }) });
    await es.getByRole('button', { name: 'Asignar', exact: true }).first().click();
    await es.getByText('Ninguna persona elegible para esta asignación.', { exact: true }).waitFor();
    await es.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
    await page.getByRole('button', { name: /Programa seleccionado: Português/ }).click();
    const pt = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Designações do grupo', exact: true }) });
    await pt.getByRole('button', { name: 'Designar', exact: true }).first().click();
    await pt.getByRole('button', { name: 'Pessoa de ensaio', exact: true }).click();
    await pt.getByRole('button', { name: 'Remover designado', exact: true }).waitFor();
    await page.screenshot({ path: `${out}/e4-pt-designado.png`, fullPage: true });
    await page.locator('aside').getByRole('button').filter({ hasText: /Revisar.*Enviar/ }).click();
    await page.getByRole('button', { name: 'Simular e-mail', exact: true }).click();
    await page.getByText('Envio simulado; nenhuma mensagem real.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Simular aceite', exact: true }).click();
    await page.getByText('Aceito no ensaio.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Simular lembrete', exact: true }).click();
    await page.screenshot({ path: `${out}/e6-revisar.png`, fullPage: true });
    await page.getByRole('link', { name: 'Abrir confirmação local', exact: true }).click();
    await page.waitForURL('**/c/fixture-token-*');
    // Não aceitar elementos do admin anterior enquanto o lazy route carrega.
    await page.locator('aside').waitFor({ state: 'detached' });
    await page.getByRole('heading', { name: 'Confirmação de Designação', exact: true }).waitFor();
    await page.getByText('Pessoa de ensaio', { exact: false }).first().waitFor();
    await fs.writeFile(`${out}/e6-confirmacao.json`, JSON.stringify({ text: await page.locator('body').innerText() }, null, 2));
    await page.screenshot({ path: `${out}/e6-confirmacao.png`, fullPage: true });
    console.log('E4/E6: seleção ES vazia, atribuição PT, envio/aceite/lembrete simulados e link local verificados.');
    await page.getByRole('button', { name: 'Alterar para não poderei', exact: true }).click();
    await page.getByRole('button', { name: 'Já marquei que não poderei', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Alterar para aceito', exact: true }).click();
    await page.getByRole('button', { name: 'Já está confirmado', exact: true }).waitFor();
    await page.goBack();
    await page.locator('aside').waitFor();
    await page.locator('aside').getByRole('button').filter({ hasText: /Revisar.*Enviar/ }).click();
    await page.locator('label').filter({ hasText: 'Meio de semana: 2026-11-02' }).locator('input').check();
    await page.getByText('Quadro simulado atualizado na memória.', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Programação em foco: Español/ }).click();
    await page.locator('label').filter({ hasText: 'Fin de semana: 2026-11-08' }).locator('input').check();
    await page.getByText('Tablero simulado actualizado en memoria.', { exact: true }).waitFor();
    await page.getByRole('link', { name: /Ver Tablero/ }).click();
    await page.locator('aside').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: /Programa seleccionado: Español/ }).waitFor();
    await page.screenshot({ path: `${out}/e5-quadro-es.png`, fullPage: true });
    await page.getByRole('button', { name: /Programa seleccionado: Português/ }).click();
    await page.getByText('Pessoa de ensaio', { exact: false }).first().waitFor();
    await page.screenshot({ path: `${out}/e5-quadro-pt.png`, fullPage: true });
    console.log('Publicação simulada preserva PT/ES; seletor público e alteração de resposta verificados.');
    await page.locator('a[href="/admin"]').first().click();
    await page.locator('aside').waitFor();
    await page.getByRole('button', { name: /Programação em foco: Español/ }).click();
    await page.getByRole('button', { name: /Notifica/ }).click();
    await page.getByRole('button', { name: 'Abrir programa', exact: true }).first().click();
    await page.getByRole('button', { name: /Programação em foco: Português/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Programação em foco: Português/ }).getAttribute('aria-pressed'), 'true');
    await page.locator('[data-programacao-id="semana-legada-fixture"]').waitFor();
    await page.screenshot({ path: `${out}/e6-alerta-grupo.png`, fullPage: true });
    await page.locator('aside').getByRole('button', { name: 'Início', exact: true }).click();
    await page.getByLabel('2-8 de novembro de 2026', { exact: true }).check();
    await page.getByRole('button', { name: 'Sincronizar histórico local selecionado', exact: true }).click();
    await page.waitForFunction(async () => {
        const { lerDadosSessaoEnsaio } = await import('/src/data/ensaioGrupos.js');
        return lerDadosSessaoEnsaio().alunos[0].historico.some(h => h.grupoId === 'grupo-portugues' && h.programacaoId === 'semana-legada-fixture');
    });
    await page.getByLabel('Data do evento', { exact: true }).fill('2026-11-02');
    await page.locator('label').filter({ hasText: 'Tipo do evento' }).locator('select').selectOption('assembleia');
    await page.getByRole('button', { name: 'Salvar evento local', exact: true }).click();
    await page.getByText('Participantes: 1 · Reuniões ativas: 0', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sincronizar histórico local selecionado', exact: true }).click();
    assert.equal(await page.evaluate(async () => (await import('/src/data/ensaioGrupos.js')).lerDadosSessaoEnsaio().alunos[0].historico.length), 1);
    await page.getByLabel('Data do evento', { exact: true }).fill('2026-11-02');
    await page.locator('label').filter({ hasText: 'Tipo do evento' }).locator('select').selectOption('normal');
    await page.getByRole('button', { name: 'Salvar evento local', exact: true }).click();
    await page.getByText('Participantes: 1 · Reuniões ativas: 1', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Programação em foco: Español/ }).click();
    await page.locator('aside').getByRole('button').filter({ hasText: /Asignar|Designar/ }).click();
    const novembro = page.locator('article').filter({ hasText: '2026-11-08 09:30' }).first();
    await novembro.getByRole('button', { name: 'Cancelar reunión', exact: true }).click();
    await page.locator('[aria-modal="true"]').getByRole('button', { name: 'Cancelar reunión', exact: true }).click();
    await novembro.getByText(/Cancelada/).waitFor();
    await page.locator('aside').getByRole('button').filter({ hasText: /Revisar.*Enviar/ }).click();
    await page.getByRole('button', { name: 'Volver a publicar conjunto completo (simulado)', exact: true }).click();
    await page.getByText('Tablero simulado actualizado en memoria.', { exact: true }).waitFor();
    await page.getByRole('link', { name: /Ver Tablero/ }).click();
    await page.locator('aside').waitFor({ state: 'detached' });
    await page.getByText('Pessoa de ensaio', { exact: false }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: /Programação em foco|Programa seleccionado/ }).count(), 0);
    await page.screenshot({ path: `${out}/e5-fallback-pt.png`, fullPage: true });
    await fs.writeFile(`${out}/resultado.json`, JSON.stringify({ agendamento: true, designacao: true, respostaEAlteracao: true,
        publicacaoAmbos: true, seletor: true, alertaComGrupo: true, historico: true, eventoBloqueantePreservaHistorico: true,
        cancelamentoEsPreservaPt: true, fallbackPublico: true }, null, 2));
    console.log('Eventos/histórico, navegação de alerta, cancelamento ES e fallback público PT verificados.');
} catch (error) {
    await fs.writeFile(`${out}/falha.txt`, error.stack || error.message);
    if (page) {
        const dados = await page.evaluate(async () => ({
            source: (await import('/src/data/ensaioGrupos.js')).lerDadosSessaoEnsaio(),
            quadro: (await import('/src/services/quadroLocal.js')).lerQuadroLocal(),
        }));
        await fs.writeFile(`${out}/falha-estado.json`, JSON.stringify({ url: page.url(), errosPagina, dados, text: await page.locator('body').innerText() }, null, 2));
        await page.screenshot({ path: `${out}/falha.png`, fullPage: true });
    }
    throw error;
} finally { await browser?.close(); await server.close(); }
