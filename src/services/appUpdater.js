let latestRegistration;
let manualUpdate;

export const registerServiceWorkerRegistration = (registration) => {
    latestRegistration = registration ?? undefined;
};

const getServiceWorkerRegistrations = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return latestRegistration ? [latestRegistration] : [];
    }

    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const matching = registrations.filter(r => !r.scope || window.location.href.startsWith(r.scope));
        if (matching.length > 0) return matching.sort((a, b) => (b.scope?.length || 0) - (a.scope?.length || 0)).slice(0, 1);
    } catch {
        // Fallback below.
    }

    return latestRegistration ? [latestRegistration] : [];
};

const clearAppCaches = async () => {
    if (typeof window === 'undefined' || !('caches' in window)) return;

    try {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
    } catch {
        // Ignore cache cleanup failures and keep reloading.
    }
};

let automaticReloadStarted = false;

export const reloadAppWithCacheBust = async (reason = 'asset-error') => {
    if (automaticReloadStarted || typeof window === 'undefined') return;
    automaticReloadStarted = true;

    try {
        const key = `rvm_auto_reload_${reason}`;
        const now = Date.now();
        const previous = Number(window.sessionStorage?.getItem(key) || 0);

        if (previous && now - previous < 10000) return;
        window.sessionStorage?.setItem(key, String(now));
    } catch {
        // Continue with the reload even if sessionStorage is unavailable.
    }

    await clearAppCaches();

    const url = new URL(window.location.href);
    url.searchParams.set('assetReload', String(Date.now()));
    window.location.replace(url.toString());
};

const updateError = code => Object.assign(new Error(code), { code });

export const esperarAtivacao = (worker, timeoutMs = 30000) => new Promise((resolve, reject) => {
    let enviado = false;
    let encerrado = false;
    const terminar = error => {
        if (encerrado) return;
        encerrado = true;
        window.clearTimeout(timer);
        worker.removeEventListener('statechange', conferir);
        if (error) reject(error); else resolve(true);
    };
    const conferir = () => {
        if (worker.state === 'activated') return terminar();
        if (worker.state === 'redundant') return terminar(updateError('atualizacaoFalhou'));
        if (worker.state === 'installed' && !enviado) {
            enviado = true;
            try { worker.postMessage({ type: 'SKIP_WAITING' }); }
            catch { terminar(updateError('atualizacaoFalhou')); }
        }
    };
    const timer = window.setTimeout(() => terminar(updateError('atualizacaoDemorada')), timeoutMs);
    // Ouvir antes de enviar evita perder uma ativação rápida. clientsClaim=false
    // não emite controllerchange nesta aba: esperamos o worker ficar activated.
    worker.addEventListener('statechange', conferir);
    conferir();
});

const entradaAtual = () => {
    const src = window.document?.querySelector('script[type="module"][src]')?.src;
    return src ? new URL(src, window.location.href).pathname : '';
};

const buscarVersaoPublicada = async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
        const url = new URL('/version.json', window.location.href);
        url.searchParams.set('check', String(Date.now()));
        const response = await window.fetch(url.toString(), { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw updateError('versaoIndisponivel');
        const data = await response.json();
        if (typeof data.version !== 'string' || typeof data.entry !== 'string' || !/^\/assets\/[^/]+\.js$/.test(data.entry)) throw updateError('versaoIndisponivel');
        return data;
    } catch (error) {
        if (error.code === 'versaoIndisponivel') throw error;
        throw updateError('versaoIndisponivel');
    } finally { window.clearTimeout(timer); }
};

const executarAtualizacao = async () => {
    if (navigator.onLine === false) throw updateError('atualizacaoSemConexao');
    const [publicada, registrations] = await Promise.all([buscarVersaoPublicada(), getServiceWorkerRegistrations()]);
    let ativou = false;
    for (const registration of registrations) {
        const anterior = registration.active;
        try { await registration.update(); }
        catch { throw updateError('atualizacaoFalhou'); }
        const worker = registration.installing || registration.waiting
            || (registration.active?.state === 'activating' ? registration.active : null);
        if (worker) { await esperarAtivacao(worker); ativou = true; }
        else if (registration.active !== anterior) ativou = true;
    }
    if (!ativou && entradaAtual() === publicada.entry) return { atualizado: false, version: publicada.version };
    // A ativação preserva o novo precache. Só esta navegação ignora o shell
    // offline; o marcador é removido no bootstrap para manter o próximo offline.
    const url = new URL(window.location.href);
    url.searchParams.set('appUpdate', String(Date.now()));
    url.searchParams.set('appv', publicada.version);
    window.location.replace(url.toString());
    return { atualizado: true, version: publicada.version };
};

export const refreshAppVersion = () => {
    if (!manualUpdate) manualUpdate = executarAtualizacao().finally(() => { manualUpdate = undefined; });
    return manualUpdate;
};

export const limparMarcadoresAtualizacao = () => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('appUpdate')) return;
    for (const key of ['appUpdate', 'appv', 'ts']) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, '', url.toString());
};
