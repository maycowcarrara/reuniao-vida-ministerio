import React from 'react';
import { useSectionMessages } from '../i18n';

export default function SeletorGrupo({ grupos, grupoId, onChange, disabled = false }) {
    const T = useSectionMessages('gruposProgramacao');
    return <div role="group" aria-label={T.seletor} className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 p-0.5 gap-0.5 shrink-0">
        {Object.values(grupos).filter(grupo => grupo.ativo).map(grupo => <button
            key={grupo.id} type="button" disabled={disabled} aria-pressed={grupoId === grupo.id}
            aria-label={`${T.seletor}: ${T[grupo.idioma]} — ${grupo.nome}`} title={grupo.nome}
            onClick={() => onChange(grupo.id)}
            className={`h-7 px-2 sm:px-2.5 flex items-center justify-center rounded-md text-xs font-bold transition-colors disabled:opacity-50 ${grupoId === grupo.id ? 'bg-indigo-700 text-white shadow-xs' : 'text-indigo-800 hover:bg-indigo-100/70'}`}>
            <span className="sm:hidden">{grupo.idioma.toUpperCase()}</span><span className="hidden sm:inline">{T[grupo.idioma]}</span>
        </button>)}
    </div>;
}
