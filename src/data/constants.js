// src/data/constants.js

import { getSectionMessages } from '../i18n';

export const CARGOS_MAP = {
    anciao: { pt: "Ancião", es: "Anciano", cor: "bg-blue-100 text-blue-700", gen: 'M' },
    servo: { pt: "Servo Ministerial", es: "Siervo Ministerial", cor: "bg-indigo-100 text-indigo-700", gen: 'M' },
    irmao_hab: { pt: "Varão Habilitado", es: "Varón Habilitado", cor: "bg-cyan-100 text-cyan-700", gen: 'M' },
    irmao: { pt: "Irmão", es: "Hermano", cor: "bg-gray-100 text-gray-700", gen: 'M' },
    irma_exp: { pt: "Irmã Experiente", es: "Hermana Experta", cor: "bg-purple-100 text-purple-700", gen: 'F' },
    irma_lim: { pt: "Irmã Limitada", es: "Hermana Limitada", cor: "bg-orange-100 text-orange-700", gen: 'F' },
    irma: { pt: "Irmã", es: "Hermana", cor: "bg-pink-100 text-pink-700", gen: 'F' },
    desab: { pt: "Desabilitado", es: "Deshabilitado", cor: "bg-gray-200 text-gray-500", gen: 'A' }
};

export const TRANSLATIONS = {
    pt: getSectionMessages('app', 'pt'),
    es: getSectionMessages('app', 'es')
};
