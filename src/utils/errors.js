export const getErrorMessage = (error, fallback = 'Ocorreu um erro inesperado.') => {
    if (!error) return fallback;

    if (typeof error === 'string') {
        const msg = error.trim();
        return msg || fallback;
    }

    if (error instanceof Error) {
        const msg = error.message?.trim();
        return msg || fallback;
    }

    if (typeof error === 'object') {
        const message = error.message?.trim?.() || error.erro?.trim?.() || error.details?.trim?.();
        const code = error.code?.trim?.();

        if (message && code && !message.includes(code)) {
            return `${message} (${code})`;
        }

        if (message) return message;
        if (code) return code;
    }

    return fallback;
};
