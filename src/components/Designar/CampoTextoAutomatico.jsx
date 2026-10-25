import { useEffect, useRef } from 'react';

// Mantém a digitação no próprio campo, sem persistir a programação a cada tecla.
export default function CampoTextoAutomatico({ value, onChange, ...props }) {
    const inputRef = useRef(null);
    const timerRef = useRef(null);
    const pendingRef = useRef(null);

    const salvar = () => {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) pending.onChange(pending.value);
    };

    useEffect(() => {
        if (!pendingRef.current && inputRef.current) {
            inputRef.current.value = value ?? '';
        }
    }, [value]);

    useEffect(() => {
        // Ao trocar semana, idioma ou tela, entrega o último texto ao destino
        // capturado na edição, antes de descartar o campo e seu timer.
        return () => {
            clearTimeout(timerRef.current);
            const pending = pendingRef.current;
            pendingRef.current = null;
            if (pending) pending.onChange(pending.value);
        };
    }, []);

    return <input
        {...props}
        ref={inputRef}
        defaultValue={value ?? ''}
        onChange={event => {
            clearTimeout(timerRef.current);
            pendingRef.current = { value: event.target.value, onChange };
            timerRef.current = setTimeout(salvar, 2000);
        }}
        onBlur={salvar}
    />;
}
