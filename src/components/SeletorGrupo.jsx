import React from 'react';
import { useSectionMessages } from '../i18n';

export default function SeletorGrupo({ grupos, grupoId, onChange, disabled = false }) {
    const T = useSectionMessages('gruposProgramacao');
    return <div role="group" aria-label={T.seletor} className="flex rounded-xl border border-indigo-200 bg-indigo-50 p-1 gap-1">
        {Object.values(grupos).filter(grupo => grupo.ativo).map(grupo => <button
            key={grupo.id} type="button" disabled={disabled} aria-pressed={grupoId === grupo.id}
            aria-label={`${T.seletor}: ${T[grupo.idioma]} — ${grupo.nome}`} title={grupo.nome}
            onClick={() => onChange(grupo.id)}
            className={`min-h-10 px-2 sm:px-3 rounded-lg text-xs font-bold disabled:opacity-50 ${grupoId === grupo.id ? 'bg-indigo-700 text-white' : 'text-indigo-800'}`}>
            <span className="sm:hidden">{grupo.idioma.toUpperCase()}</span><span className="hidden sm:inline">{T[grupo.idioma]}</span>
        </button>)}
    </div>;
}
