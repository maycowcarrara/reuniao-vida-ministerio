let updateServiceWorker;
let latestRegistration;

const wait = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

export const registerAppUpdater = (updater) => {
    updateServiceWorker = typeof updater === 'function' ? updater : undefined;
};

export const registerServiceWorkerRegistration = (registration) => {
    latestRegistration = registration ?? undefined;
};

const getServiceWorkerRegistrations = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return latestRegistration ? [latestRegistration] : [];
    }

    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) return registrations;
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

const waitForControllerChange = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    await new Promise((resolve) => {
        let settled = false;

        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        const timeoutId = window.setTimeout(finish, 1200);

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.clearTimeout(timeoutId);
            finish();
        }, { once: true });
    });
};

export const refreshAppVersion = async (versionTag) => {
    const registrations = await getServiceWorkerRegistrations();

    await Promise.all(registrations.map(async (registration) => {
        if (!registration) return;

        try {
            await registration.update();
        } catch {
            // Keep going even if a specific registration fails to update.
        }

        try {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        } catch {
            // Some browsers may not accept this transition in all states.
        }
    }));

    if (typeof updateServiceWorker === 'function') {
        try {
            await updateServiceWorker(true);
        } catch {
            // Fallback to cache busting reload below.
        }
    }

    await Promise.race([waitForControllerChange(), wait(900)]);
    await clearAppCaches();

    const url = new URL(window.location.href);
    url.searchParams.set('appv', versionTag || String(Date.now()));
    url.searchParams.set('ts', String(Date.now()));
    window.location.replace(url.toString());
};
