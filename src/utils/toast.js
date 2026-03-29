import { getErrorMessage } from './errors';

const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 10000;
const MAX_TOASTS = 5;

let toasts = [];
let nextId = 1;
const listeners = new Set();

const emit = () => {
    listeners.forEach((listener) => listener(toasts));
};

const splitMessage = (message) => {
    const raw = String(message ?? '').trim();
    if (!raw) return { title: '', description: '' };

    const [title, ...rest] = raw.split(/\n+/);
    return {
        title: title.trim(),
        description: rest.join('\n').trim()
    };
};

const show = ({ variant = 'info', title = '', description = '', duration = DEFAULT_DURATION } = {}) => {
    const id = nextId++;
    const toast = { id, variant, title, description, duration };
    toasts = [toast, ...toasts].slice(0, MAX_TOASTS);
    emit();
    return id;
};

const dismiss = (id) => {
    toasts = toasts.filter((toast) => toast.id !== id);
    emit();
};

export const toastStore = {
    subscribe(listener) {
        listeners.add(listener);
        listener(toasts);
        return () => listeners.delete(listener);
    },
    dismiss,
};

export const toast = {
    show,
    dismiss,
    success(message, options = {}) {
        const { title, description } = splitMessage(message);
        return show({
            variant: 'success',
            title,
            description,
            duration: options.duration ?? DEFAULT_DURATION,
        });
    },
    info(message, options = {}) {
        const { title, description } = splitMessage(message);
        return show({
            variant: options.variant ?? 'info',
            title,
            description,
            duration: options.duration ?? DEFAULT_DURATION,
        });
    },
    error(error, fallback = 'Ocorreu um erro.', options = {}) {
        const detail = getErrorMessage(error, fallback);
        return show({
            variant: 'error',
            title: options.title ?? fallback,
            description: options.description ?? (detail !== fallback ? detail : ''),
            duration: options.duration ?? ERROR_DURATION,
        });
    }
};
