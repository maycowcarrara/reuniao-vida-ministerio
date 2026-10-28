import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esperarAtivacao, refreshAppVersion, limparMarcadoresAtualizacao, registerServiceWorkerRegistration } from '../src/services/appUpdater.js';

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));
function worker(state = 'installing') {
    const alvo = new EventTarget();
    alvo.state = state;
    alvo.mensagens = [];
    alvo.mudar = proxima => { alvo.state = proxima; alvo.dispatchEvent(new Event('statechange')); };
    alvo.postMessage = mensagem => { alvo.mensagens.push(mensagem.type); alvo.mudar('activated'); };
    return alvo;
}

async function ambiente(executar, { sw = worker('installed'), entry = '/assets/antigo.js', online = true, metadata = { version: '6.1.999', entry: '/assets/novo.js' }, semWorker = false } = {}) {
    const originalWindow = globalThis.window;
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const destinos = [], requisicoes = [], historico = [], removidos = [];
    const registration = { active: worker('activated'), installing: sw?.state === 'installing' ? sw : null,
        waiting: sw?.state === 'installed' ? sw : null, scope: 'https://fixture.invalid/', updates: 0,
        update: async () => { registration.updates++; } };
    const navigator = { onLine: online, ...(!semWorker ? { serviceWorker: { getRegistrations: async () => [registration] } } : {}) };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
    globalThis.window = {
        location: { href: 'https://fixture.invalid/admin?aba=alunos', replace: url => destinos.push(url) },
        document: { querySelector: () => ({ src: 'https://fixture.invalid' + entry }) },
        fetch: async (url, options) => { requisicoes.push({ url, options }); return { ok: true, json: async () => metadata }; },
        history: { state: { preservar: true }, replaceState: (...args) => historico.push(args) },
        caches: { keys: async () => ['precache-atual'], delete: async key => removidos.push(key) },
        setTimeout, clearTimeout,
    };
    registerServiceWorkerRegistration(undefined);
    try { await executar({ sw, registration, destinos, requisicoes, historico, removidos }); }
    finally {
        if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
        if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;
    }
}

test('Instalação que passa de 900ms não recarrega antes de ativar nem apaga caches', async () => {
    await ambiente(async ({ sw, destinos, requisicoes, removidos }) => {
        const tarefa = refreshAppVersion('versao-antiga-da-tela');
        await esperar(950);
        assert.deepEqual(destinos, []); assert.deepEqual(sw.mensagens, []);
        sw.mudar('installed');
        const resultado = await tarefa;
        assert.equal(resultado.version, '6.1.999');
        assert.deepEqual(sw.mensagens, ['SKIP_WAITING']);
        const url = new URL(destinos[0]);
        assert.equal(url.searchParams.get('appv'), '6.1.999');
        assert.equal(url.searchParams.get('aba'), 'alunos');
        assert.ok(url.searchParams.has('appUpdate'));
        assert.deepEqual(removidos, []);
        assert.equal(requisicoes[0].options.cache, 'no-store');
        assert.ok(new URL(requisicoes[0].url).searchParams.has('check'));
    }, { sw: worker() });
});

test('Worker em espera ativa sem depender de controllerchange e cliques simultâneos usam uma operação', async () => {
    await ambiente(async ({ registration, destinos }) => {
        const uma = refreshAppVersion(), outra = refreshAppVersion();
        assert.equal(uma, outra);
        await uma;
        assert.equal(registration.updates, 1); assert.equal(destinos.length, 1);
    });
});

test('Quando já está na versão publicada informa no-op em vez de recarregar a mesma página', async () => {
    await ambiente(async ({ destinos }) => {
        assert.deepEqual(await refreshAppVersion(), { atualizado: false, version: '6.1.999' });
        assert.deepEqual(destinos, []);
    }, { sw: null, entry: '/assets/novo.js' });
});

test('Sem service worker também busca a versão publicada e navega sem cache', async () => {
    await ambiente(async ({ destinos }) => {
        assert.equal((await refreshAppVersion()).atualizado, true);
        assert.ok(destinos[0].includes('appUpdate='));
    }, { semWorker: true });
});

test('Sem internet não tenta instalar e mantém a página atual', async () => {
    await ambiente(async ({ destinos, requisicoes, registration }) => {
        await assert.rejects(refreshAppVersion(), { code: 'atualizacaoSemConexao' });
        assert.deepEqual(destinos, []); assert.deepEqual(requisicoes, []); assert.equal(registration.updates, 0);
    }, { online: false });
});

test('Falha na atualização e manifesto inválido não viram recarga silenciosa', async () => {
    await ambiente(async ({ registration, destinos }) => {
        registration.update = async () => { throw new Error('rede indisponível'); };
        await assert.rejects(refreshAppVersion(), { code: 'atualizacaoFalhou' });
        assert.deepEqual(destinos, []);
    });
    await ambiente(async ({ registration, destinos }) => {
        await assert.rejects(refreshAppVersion(), { code: 'versaoIndisponivel' });
        assert.equal(registration.updates, 0); assert.deepEqual(destinos, []);
    }, { metadata: { version: '6.1.999', entry: 'https://outro.invalid/app.js' } });
});

test('Instalação descartada e tempo excedido são erros recuperáveis', async () => {
    await ambiente(async () => {
        await assert.rejects(esperarAtivacao(worker('redundant')), { code: 'atualizacaoFalhou' });
        await assert.rejects(esperarAtivacao(worker(), 5), { code: 'atualizacaoDemorada' });
    });
});

test('Limpar marcador após a atualização preserva rota, parâmetros e histórico para o próximo offline', async () => {
    await ambiente(async ({ historico }) => {
        window.location.href = 'https://fixture.invalid/c/token-ficticio?r=a&f=w&appUpdate=123&appv=6.1.999&ts=456';
        limparMarcadoresAtualizacao();
        assert.deepEqual(historico[0][0], { preservar: true });
        assert.equal(historico[0][2], 'https://fixture.invalid/c/token-ficticio?r=a&f=w');
    });
});
