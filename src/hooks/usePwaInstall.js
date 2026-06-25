import { useEffect, useState } from 'react';

let deferredInstallPrompt = null;
let listenerAttached = false;
const subscribers = new Set();

const hasWindow = () => typeof window !== 'undefined';

const getStandaloneDisplay = () => {
    if (!hasWindow()) return false;
    return window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.navigator?.standalone === true;
};

const getDeviceInfo = () => {
    if (!hasWindow()) {
        return { isAndroid: false, isIos: false, isInstalled: false };
    }

    const userAgent = window.navigator?.userAgent || '';
    const platform = window.navigator?.platform || '';
    const isAndroid = /Android/i.test(userAgent);
    const isIpadOs = platform === 'MacIntel' && window.navigator?.maxTouchPoints > 1;
    const isIos = /iPhone|iPad|iPod/i.test(userAgent) || isIpadOs;

    return {
        isAndroid,
        isIos,
        isInstalled: getStandaloneDisplay()
    };
};

const emitChange = () => {
    subscribers.forEach((listener) => listener());
};

export const ensurePwaInstallListener = () => {
    if (!hasWindow() || listenerAttached) return;
    listenerAttached = true;

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        emitChange();
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        emitChange();
    });
};

const getSnapshot = () => {
    const { isAndroid, isIos, isInstalled } = getDeviceInfo();
    const installMode = isIos ? 'ios' : (deferredInstallPrompt ? 'prompt' : null);

    return {
        isAndroid,
        isIos,
        hasPrompt: !!deferredInstallPrompt,
        isInstalled,
        installMode,
        canInstall: !isInstalled && !!installMode
    };
};

export const promptPwaInstall = async () => {
    if (!deferredInstallPrompt) return { outcome: 'unavailable' };

    const promptEvent = deferredInstallPrompt;
    promptEvent.prompt();

    const choice = await promptEvent.userChoice;
    deferredInstallPrompt = null;
    emitChange();

    return choice;
};

export function usePwaInstall() {
    const [snapshot, setSnapshot] = useState(() => getSnapshot());

    useEffect(() => {
        if (!hasWindow()) return undefined;

        ensurePwaInstallListener();

        const update = () => setSnapshot(getSnapshot());
        subscribers.add(update);

        const standaloneMedia = window.matchMedia?.('(display-mode: standalone)');
        standaloneMedia?.addEventListener?.('change', update);
        update();

        return () => {
            subscribers.delete(update);
            standaloneMedia?.removeEventListener?.('change', update);
        };
    }, []);

    return {
        ...snapshot,
        promptInstall: promptPwaInstall
    };
}

ensurePwaInstallListener();
