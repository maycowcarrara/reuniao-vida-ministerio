import { createContext, useContext, useEffect } from 'react';

export const GRUPO_EDICAO_CONTEXT = createContext(null);
export const useProtecaoTrocaGrupo = guard => {
    const registrar = useContext(GRUPO_EDICAO_CONTEXT);
    useEffect(() => registrar?.(guard), [registrar, guard]);
};
