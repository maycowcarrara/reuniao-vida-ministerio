import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../public/sw-confirmacao.js', import.meta.url), 'utf8');
const hosting = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8')).hosting;
const criarWorker = (urls, { existente = true, falharNavegacao = false, aguardarAtivacao = false } = {}) => {
    const listeners = {}, navegacoes = [], comandos = [];
    const self = {
        registration: { active: existente ? {} : null },
        location: { origin: 'https://fixture.invalid' },
        clients: { matchAll: async () => urls.map(url => ({ url, navigate: async destino => {
            navegacoes.push(destino);
            if (falharNavegacao) throw new Error('aba fechada');
            if (aguardarAtivacao) return new Promise(() => {});
        } })) },
        skipWaiting: async () => comandos.push('SKIP_WAITING'),
        addEventListener: (tipo, listener) => { listeners[tipo] = listener; },
    };
    runInNewContext(source, { self, URL });
    return { navegacoes, comandos, emitir: async tipo => {
        const pendentes = [];
        listeners[tipo]({ waitUntil: promise => pendentes.push(promise) });
        await Promise.all(pendentes);
    } };
};

test('Link antigo: instalação atualiza automaticamente e preserva token, resposta e lembrete', async () => {
    const link = 'https://fixture.invalid/c/token-ficticio?r=a&f=w';
    const worker = criarWorker([link, 'https://fixture.invalid/admin', 'https://fixture.invalid/quadro']);
    await worker.emitir('install');
    assert.deepEqual(worker.comandos, ['SKIP_WAITING']);
    await worker.emitir('activate');
    assert.deepEqual(worker.navegacoes, [link]);
});

test('Admin e quadro continuam aguardando atualização manual sem recarregamento', async () => {
    const worker = criarWorker(['https://fixture.invalid/admin', 'https://fixture.invalid/quadro', 'https://outro.invalid/c/token']);
    await worker.emitir('install');
    await worker.emitir('activate');
    assert.deepEqual(worker.comandos, []);
    assert.deepEqual(worker.navegacoes, []);
});

test('Primeira instalação não recarrega a confirmação já atual', async () => {
    const worker = criarWorker(['https://fixture.invalid/c/token'], { existente: false });
    await worker.emitir('install');
    await worker.emitir('activate');
    assert.deepEqual(worker.navegacoes, []);
});

test('Fechar uma aba durante a ativação não impede a atualização', async () => {
    const worker = criarWorker(['https://fixture.invalid/c/token'], { falharNavegacao: true });
    await worker.emitir('activate');
    assert.equal(worker.navegacoes.length, 1);
});

test('Ativação termina mesmo quando a navegação espera pelo novo worker', { timeout: 500 }, async () => {
    const worker = criarWorker(['https://fixture.invalid/c/token'], { aguardarAtivacao: true });
    await worker.emitir('activate');
    assert.equal(worker.navegacoes.length, 1);
});

test('Hosting não armazena a página de confirmação nem congela o atualizador', () => {
    assert.match(hosting.headers.find(regra => regra.source === '/c/**').headers[0].value, /no-store/);
    assert.match(hosting.headers.find(regra => regra.source === '/sw-confirmacao.js').headers[0].value, /no-cache/);
});
