import React, { useEffect, useRef, useState } from 'react';
import { getCelebracao, textosCelebracao } from '../utils/celebracao.js';
import { MEIO_SEMANA_RESPONSABILIDADES } from '../utils/fimDeSemana.js';
import { getGrupoEfetivoId, getGrupoProgramacao } from '../utils/gruposProgramacao.js';
import { listarSlotsReuniao, classificarCandidatosGrupo, prepararAtribuicaoGrupo } from '../utils/designacoesPorGrupo.js';
import { prepararEdicaoCelebracao } from '../utils/agendamentoReunioes.js';
import { useProtecaoTrocaGrupo } from '../hooks/useProtecaoTrocaGrupo.js';
import { dialog } from '../utils/dialog';

export function CelebracaoResumo({ programa, config, lang = 'pt', busca = '', agenda = false }) {
    const c = getCelebracao(programa, config);
    if (!c) return null;
    const T = textosCelebracao(lang);
    const normal = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const filtro = normal(busca);
    const data = new Date(`${c.data}T12:00:00Z`).toLocaleDateString(lang === 'es' ? 'es-ES' : 'pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const linkAgenda = pessoa => {
        const inicio = `${c.data.replaceAll('-', '')}T${c.horario.replace(':', '')}00`;
        const fim = new Date(`${c.data}T${c.horario}:00Z`); fim.setUTCMinutes(fim.getUTCMinutes() + 60);
        return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: `${T.titulo} — ${pessoa.nome}`, dates: `${inicio}/${fim.toISOString().replace(/[-:]/g, '').slice(0, 15)}`, details: T.apoio })}`;
    };
    return <section data-celebracao="true" className="rounded-xl border border-amber-200 p-3 space-y-2 break-inside-avoid">
        <h3 className="font-bold">{T.titulo}</h3>
        <p>{data}{c.horario ? ` • ${c.horario}` : ''}</p>
        {(!filtro || normal(c.oradorNomeManual).includes(filtro) || normal(T.titulo).includes(filtro)) && <p><strong>{T.discurso}: </strong>{c.oradorNomeManual || '—'}</p>}
        {MEIO_SEMANA_RESPONSABILIDADES.map(({ storageKey, labels }) => {
            const pessoas = c.responsabilidades[storageKey].filter(p => !filtro || normal(p?.nome).includes(filtro) || normal(labels[lang]).includes(filtro) || normal(T.titulo).includes(filtro));
            return pessoas.length > 0 && <p key={storageKey}><strong>{labels[lang] || labels.pt}: </strong>{pessoas.map((p, i) => <React.Fragment key={p.id || i}>{i > 0 && ', '}{p.nome}{agenda && c.horario && <a className="ml-2 underline" target="_blank" rel="noreferrer" href={linkAgenda(p)}>Agenda</a>}</React.Fragment>)}</p>;
        })}
    </section>;
}

export default function CelebracaoEditor({ programa, programacoes, config, alunos, cargosMap, onExecutar, busy = false }) {
    const c = getCelebracao(programa, config);
    const grupoId = getGrupoEfetivoId(programa, config);
    const lang = getGrupoProgramacao(grupoId, config)?.idioma || 'pt';
    const T = textosCelebracao(lang);
    const [status, setStatus] = useState('');
    const [pendente, setPendente] = useState(false);
    const dirty = useRef(false);
    const pending = useRef(false);
    useEffect(() => {
        const proteger = event => { if (dirty.current || pending.current) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', proteger);
        return () => window.removeEventListener('beforeunload', proteger);
    }, []);
    useProtecaoTrocaGrupo(async () => !pending.current && (!dirty.current || await dialog.confirm({ title: T.titulo, message: lang === 'es' ? '¿Descartar el texto sin guardar?' : 'Descartar o texto sem salvar?' })));
    if (!c) return null;
    const executar = async (preparar, salvarTexto = false) => {
        if (busy || pending.current) return;
        pending.current = true; setPendente(true); setStatus('');
        try { await onExecutar({ grupoId, preparar }); if (salvarTexto) dirty.current = false; setStatus(T.salvo); }
        catch (error) { setStatus(error.message); }
        finally { pending.current = false; setPendente(false); }
    };
    const atribuir = async (slot, alunoId) => {
        const candidato = classificarCandidatosGrupo({ alunos, programacoes, config, grupoId, programacao: programa, tipo: c.tipoReuniao, slot, cargosMap, lang }).find(item => String(item.aluno.id) === String(alunoId));
        const conflitos = candidato?.conflitos || [];
        if (conflitos.length && !await dialog.confirm({ title: T.avisos, message: conflitos.map(item => `${item.pessoa.nome} — ${item.reuniao.data} ${item.reuniao.horario} (${item.grupoId})`).join('\n'), confirmText: T.confirmar })) return;
        await executar(estado => prepararAtribuicaoGrupo({ ...estado, programacaoId: programa.id, tipo: c.tipoReuniao,
            slotId: slot.slotId, alunoId, pessoaAnteriorId: String(slot.pessoa?.id ?? ''), cargosMap, lang, confirmarAvisos: true }));
    };
    return <section className="border border-amber-300 rounded-xl bg-amber-50/50 p-4 space-y-3" data-celebracao-editor="true">
        <h3 className="font-bold">{T.titulo} — {c.data}</h3>
        <fieldset disabled={busy || pendente || programa.arquivada} className="space-y-3">
            <form key={`${programa.id}-${c.horario}-${c.oradorNomeManual}`} className="flex flex-wrap gap-3 items-end" onChange={() => { dirty.current = true; }} onSubmit={event => {
                event.preventDefault(); const valores = Object.fromEntries(new FormData(event.currentTarget));
                executar(estado => prepararEdicaoCelebracao({ ...estado, programacaoId: programa.id, valores }), true);
            }}>
                <label className="text-sm">{T.horario}<input name="horario" type="time" defaultValue={c.horario} className="block border rounded-lg p-2 bg-white" /></label>
                <label className="text-sm flex-1 min-w-48">{T.discurso} — {T.orador}<input name="oradorNomeManual" type="text" defaultValue={c.oradorNomeManual} className="block border rounded-lg p-2 bg-white w-full" /></label>
                <button className="border rounded-lg p-2 bg-white" type="submit">{T.salvar}</button>
            </form>
            <h4 className="font-semibold">{T.apoio}</h4>
            {listarSlotsReuniao(programa, c.tipoReuniao, { config }).map(slot => {
                const def = MEIO_SEMANA_RESPONSABILIDADES.find(item => item.slotKey === slot.slotKey);
                const candidatos = classificarCandidatosGrupo({ alunos, programacoes, config, grupoId, programacao: programa, tipo: c.tipoReuniao, slot, cargosMap, lang });
                return <div key={slot.slotId} className="flex flex-wrap gap-2 items-center text-sm">
                    <span className="w-48 font-semibold">{def.labels[lang] || def.labels.pt}</span>
                    {slot.pessoa && <><span>{slot.pessoa.nome}</span><button type="button" className="underline" onClick={() => atribuir(slot, null)}>{T.remover}</button></>}
                    <select aria-label={`${def.labels[lang]} ${slot.path.at(-1) + 1}`} value="" className="border rounded-lg p-2 bg-white max-w-full" onChange={event => { if (event.target.value) atribuir(slot, event.target.value); }}>
                        <option value="">{T.escolher}</option>{candidatos.map(item => <option key={item.aluno.id} value={String(item.aluno.id)}>{item.aluno.nome}{item.conflitos.length ? ' ⚠' : ''}{item.ultimaData ? ` (${item.ultimaData})` : ''}</option>)}
                    </select>
                </div>;
            })}
        </fieldset>
        {programa.agendaPendenteSync && <p className="text-xs text-amber-900">{T.agenda}</p>}
        {status && <p role="status" className="text-sm">{status}</p>}
    </section>;
}
