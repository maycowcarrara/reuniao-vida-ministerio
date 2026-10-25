import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mayco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out = 'tmp/adendo-a';
await fs.mkdir(out, { recursive: true });

const server = await createServer({
    server: { host: '127.0.0.1', port: 5196, strictPort: true, hmr: false },
    define: { 'import.meta.env.VITE_MULTI_GRUPOS_LOCAL': JSON.stringify('true') },
    plugins: [{
        name: 'qa-interface-estabelecida',
        enforce: 'pre',
        transform(code, id) {
            if (!id.replaceAll('\\', '/').endsWith('/src/App.jsx')) return null;
            const source = 'const usarInterfaceIndependente = MULTI_GRUPOS_LOCAL;';
            if (!code.includes(source)) throw new Error('Harness não reconhece a seleção de interface.');
            return {
                code: code
                    .replace(source, 'const usarInterfaceIndependente = false;')
                    .replace('mostrarAcessos={!MULTI_GRUPOS_LOCAL}', 'mostrarAcessos={true}'),
                map: null
            };
        }
    }]
});

let browser;
try {
    await server.listen();
    console.log('Vite server running on http://127.0.0.1:5196/admin');

    browser = await chromium.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true
    });

    const fecharModalAluno = async (p) => {
        await p.keyboard.press('Escape');
        await p.waitForTimeout(300);
        const btnDescartar = p.locator('button:has-text("Descartar")').first();
        if (await btnDescartar.isVisible()) {
            await btnDescartar.click();
            await p.waitForTimeout(300);
        }
        await p.waitForSelector('div.fixed.z-\\[200\\]', { state: 'detached', timeout: 3000 }).catch(() => {});
    };

    // ==========================================
    // 1. Desktop Viewport (1280x900)
    // ==========================================
    const contextDesktop = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1
    });
    const page = await contextDesktop.newPage();
    page.setDefaultTimeout(10000);

    await page.goto('http://127.0.0.1:5196/admin');
    await page.waitForSelector('nav', { state: 'visible' });

    // Navegar para Configurações (em PT)
    await page.locator('button[title*="Configuraç"], button[title*="Ajustes"]').first().click();
    await page.waitForTimeout(600);

    // Captura Desktop - Configurações PT
    await page.screenshot({ path: `${out}/config-pt-desktop.png`, fullPage: true });
    console.log('Capturado: config-pt-desktop.png');

    // Trocar para Espanhol no seletor superior
    const seletorEs = page.locator('button:has-text("Español")').first();
    if (await seletorEs.isVisible()) {
        await seletorEs.click();
        await page.waitForTimeout(600);
    }
    // Captura Desktop - Configurações ES
    await page.screenshot({ path: `${out}/config-es-desktop.png`, fullPage: true });
    console.log('Capturado: config-es-desktop.png');

    // Clicar em "Ir a Asignar → Programar reunión"
    const btnIrAgendar = page.locator('button:has-text("Ir a Asignar"), button:has-text("Ir para Designar")').first();
    if (await btnIrAgendar.isVisible()) {
        await btnIrAgendar.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${out}/designar-es-desktop.png`, fullPage: true });
        console.log('Capturado: designar-es-desktop.png');
    }

    // Ir para Alunos / Estudiantes e abrir Novo Cadastro
    await page.locator('button[title*="Alunos"], button[title*="Estudiantes"]').first().click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("Novo"), button:has-text("Nuevo")').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/novo-cadastro-pt-desktop.png` });
    console.log('Capturado: novo-cadastro-pt-desktop.png');

    // Fechar modal de aluno
    await fecharModalAluno(page);

    // Testar Cenário Somente ES:
    // Voltar para Configurações, desmarcar PT, marcar ES como principal, salvar
    await page.locator('button[title*="Configuraç"], button[title*="Ajustes"]').first().click();
    await page.waitForTimeout(600);

    // Selecionar select principal para grupo-espanhol
    const selectPrincipal = page.locator('select[form="config-grupos"]').first();
    await selectPrincipal.selectOption('grupo-espanhol');

    // Desmarcar checkbox "Grupo ativo" do cartão Português
    const detailsPT = page.locator('details').first();
    const checkboxAtivoPT = detailsPT.locator('input[type="checkbox"]').first();
    await checkboxAtivoPT.uncheck();
    await page.waitForTimeout(300);

    // Clicar em Salvar / Guardar
    const btnSalvar = page.locator('button[type="submit"]:has-text("Guardar"), button[type="submit"]:has-text("Salvar")').first();
    await btnSalvar.click();
    await page.waitForTimeout(800);

    // Ir para Alunos / Estudiantes e abrir Novo Cadastro no cenário Somente ES
    await page.locator('button[title*="Alunos"], button[title*="Estudiantes"]').first().click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("Novo"), button:has-text("Nuevo")').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/novo-cadastro-somente-es.png` });
    console.log('Capturado: novo-cadastro-somente-es.png');

    await fecharModalAluno(page);

    // ==========================================
    // 2. Mobile Viewport (390x844)
    // ==========================================
    const contextMobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    });
    const pageMobile = await contextMobile.newPage();
    pageMobile.setDefaultTimeout(10000);

    await pageMobile.goto('http://127.0.0.1:5196/admin');
    await pageMobile.waitForSelector('header', { state: 'visible' });

    // Abrir menu mobile e ir para Configurações
    const menuBtn = pageMobile.locator('header button.md\\:hidden').first();
    if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await pageMobile.waitForTimeout(400);
        await pageMobile.locator('button[title*="Configuraç"], button[title*="Ajustes"]').first().click();
        await pageMobile.waitForTimeout(600);
    }

    // Captura Mobile - Configurações PT
    await pageMobile.screenshot({ path: `${out}/config-pt-mobile.png`, fullPage: true });
    console.log('Capturado: config-pt-mobile.png');

    // Trocar para ES no header mobile
    const seletorEsMobile = pageMobile.locator('header button:has-text("ES")').first();
    if (await seletorEsMobile.isVisible()) {
        await seletorEsMobile.click();
        await pageMobile.waitForTimeout(600);
        await pageMobile.screenshot({ path: `${out}/config-es-mobile.png`, fullPage: true });
        console.log('Capturado: config-es-mobile.png');
    }

    // Ir para Alunos no Mobile
    if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await pageMobile.waitForTimeout(400);
        await pageMobile.locator('button[title*="Alunos"], button[title*="Estudiantes"]').first().click();
        await pageMobile.waitForTimeout(600);
    }
    await pageMobile.locator('button:has-text("Novo"), button:has-text("Nuevo")').first().click();
    await pageMobile.waitForTimeout(500);
    await pageMobile.screenshot({ path: `${out}/novo-cadastro-mobile.png` });
    console.log('Capturado: novo-cadastro-mobile.png');

    await fecharModalAluno(pageMobile);

    console.log('Todas as evidências visuais capturadas com sucesso!');
} finally {
    if (browser) await browser.close();
    await server.close();
}
