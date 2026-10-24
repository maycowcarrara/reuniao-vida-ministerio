// Barreira local de desenvolvimento, não um mecanismo de liberação remota.
export const MULTI_GRUPOS_LOCAL = import.meta.env?.DEV === true
    && import.meta.env?.VITE_MULTI_GRUPOS_LOCAL === 'true';
