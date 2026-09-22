let queue = [];
let currentDialog = null;
let nextId = 1;
const listeners = new Set();

const emit = () => {
    listeners.forEach((listener) => listener(currentDialog));
};

const processQueue = () => {
    if (currentDialog || queue.length === 0) return;
    currentDialog = queue.shift();
    emit();
};

const normalizeOptions = (optionsOrMessage, defaultType = 'confirm') => {
    if (typeof optionsOrMessage === 'string') {
        const raw = optionsOrMessage.trim();
        const [title, ...rest] = raw.split(/\n+/);
        return {
            type: defaultType,
            title: rest.length > 0 ? title.trim() : (defaultType === 'alert' ? 'Aviso' : 'Confirmação'),
            message: rest.length > 0 ? rest.join('\n').trim() : raw,
        };
    }
    return {
        type: defaultType,
        ...optionsOrMessage,
    };
};

const open = (options) => {
    return new Promise((resolve) => {
        const id = nextId++;
        const item = {
            id,
            type: options.type || 'confirm',
            title: options.title || (options.type === 'alert' ? 'Aviso' : options.type === 'prompt' ? 'Informação' : 'Confirmação'),
            message: options.message || options.description || '',
            confirmText: options.confirmText || (options.type === 'alert' ? 'OK' : 'Confirmar'),
            cancelText: options.cancelText || 'Cancelar',
            variant: options.variant || (options.type === 'alert' ? 'info' : 'warning'),
            defaultValue: options.defaultValue ?? '',
            placeholder: options.placeholder ?? '',
            isCopyable: Boolean(options.isCopyable),
            resolve,
        };
        queue.push(item);
        processQueue();
    });
};

const close = (value = false) => {
    if (currentDialog) {
        const resolver = currentDialog.resolve;
        currentDialog = null;
        emit();
        if (typeof resolver === 'function') {
            resolver(value);
        }
        processQueue();
    }
};

export const dialogStore = {
    subscribe(listener) {
        listeners.add(listener);
        listener(currentDialog);
        return () => listeners.delete(listener);
    },
    close,
};

export const dialog = {
    confirm(optionsOrMessage) {
        const opts = normalizeOptions(optionsOrMessage, 'confirm');
        return open({
            ...opts,
            type: 'confirm',
            variant: opts.variant || 'warning',
        });
    },

    prompt(optionsOrMessage) {
        const opts = normalizeOptions(optionsOrMessage, 'prompt');
        return open({
            ...opts,
            type: 'prompt',
            variant: opts.variant || 'info',
        });
    },

    alert(optionsOrMessage) {
        const opts = normalizeOptions(optionsOrMessage, 'alert');
        return open({
            ...opts,
            type: 'alert',
            variant: opts.variant || 'info',
        });
    },

    close,
};
