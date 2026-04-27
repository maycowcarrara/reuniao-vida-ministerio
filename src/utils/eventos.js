import { getCanonicalWeekStartISO, getWeekStartISOFromSemana } from './revisarEnviar/dates';

export const isTipoEventoBloqueante = (tipo) => {
    const evento = (tipo ?? '').toString().toLowerCase();
    return evento.includes('assembleia') || evento.includes('congresso');
};

export const getSemanaStartISO = (sem, config) => {
    if (!sem) return null;
    return getCanonicalWeekStartISO({ sem, config });
};

export const getEventoEspecialDaSemana = (sem, config) => {
    if (!Array.isArray(config?.eventosAnuais)) return null;

    const semanaStartISO = getSemanaStartISO(sem, config);
    if (!semanaStartISO) return null;

    return config.eventosAnuais.find((evento) => evento?.dataInicio === semanaStartISO) || null;
};

export const getEventoEspecialPorSemana = ({ semanaStr, config, isoFallback = null, textSources = [] }) => {
    if (!Array.isArray(config?.eventosAnuais)) return null;

    const semanaStartISO = getWeekStartISOFromSemana({ semanaStr, config, isoFallback, textSources });
    if (!semanaStartISO) return null;

    return config.eventosAnuais.find((evento) => evento?.dataInicio === semanaStartISO) || null;
};

export const getTipoEventoSemana = (sem, config) => {
    const eventoEspecial = getEventoEspecialDaSemana(sem, config);
    return eventoEspecial?.tipo || sem?.evento || 'normal';
};

export const isSemanaBloqueadaPorEvento = (sem, config) => {
    if (isTipoEventoBloqueante(sem?.evento)) return true;
    return isTipoEventoBloqueante(getEventoEspecialDaSemana(sem, config)?.tipo);
};
