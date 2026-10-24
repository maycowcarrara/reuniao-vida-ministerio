import { Link } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';
import { criarFilaGrupo, planejarAgendaGrupo, lerAgendaGrupo, salvarAgendaGrupo } from '../utils/integracoesGrupo.js';
import { integracoesLocais } from '../services/integracoesLocais.js';

export default function IntegracoesGrupo({ config, grupoId, programacoes, confirmacoes, programacaoFoco = '' }) {
    const [status, setStatus] = useState('');
    const [falhar, setFalhar] = useState(false);
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const root = useRef(null);
    useEffect(() => {
        if (!programacaoFoco) return;
        const alvo = [...(root.current?.querySelectorAll('[data-programacao-id]') || [])].find(el => el.dataset.programacaoId === programacaoFoco);
        alvo?.scrollIntoView({ block: 'center' });
        alvo?.focus({ preventScroll: true });
    }, [programacaoFoco]);
    const es = config.grupos[grupoId].idioma === 'es';
    const storage = () => { try { return window.localStorage; } catch { return null; } };
    const [agenda, setAgenda] = useState(() => lerAgendaGrupo(storage(), 'ensaio-local-e2', grupoId, config));
    const fila = criarFilaGrupo({ programacoes, config, grupoId, confirmacoes });
    const executar = async fn => {
        if (pending.current) return;
        pending.current = true; setBusy(true);
        try { await fn(); } catch (error) { setStatus(error.message); }
        finally { pending.current = false; setBusy(false); }
    };
    const enviar = row => executar(async () => {
        await integracoesLocais.send({ data: { ...row.confirmation, grupoId: row.grupoId }, channel: 'mail',
            transport: async () => ({ sucesso: !falhar, erro: es ? 'Fallo simulado; canal sin marcar.' : 'Falha simulada; canal não marcado.' }) });
        setStatus(es ? 'Envío simulado; ningún mensaje real.' : 'Envio simulado; nenhuma mensagem real.');
    });
    const sincronizar = () => executar(async () => {
        if (!agenda) throw new Error(es ? 'Elige una agenda ficticia.' : 'Escolha uma agenda fictícia.');
        const eventos = await planejarAgendaGrupo({ programacoes, config, grupoId });
        const resultado = await integracoesLocais.syncCalendar({ calendarId: agenda, eventos });
        const ok = resultado.resultados.filter(r => r.ok).length;
        const erros = resultado.resultados.filter(r => !r.ok).map(r => r.erro).join('; ');
        setStatus(`${ok} eventos simulados. ${erros}`);
    });
    return <section ref={root} className="no-print p-4 border rounded-xl my-4">
        <h3 className="font-bold">{es ? 'Integraciones simuladas' : 'Integrações simuladas'}</h3>
        <p>{es ? 'Solo reuniones operativas del grupo. Sin OAuth ni proveedores reales.' : 'Somente reuniões operacionais do grupo. Sem OAuth ou provedores reais.'}</p>
        <fieldset disabled={busy}>
            <label><input type="checkbox" checked={falhar} onChange={e => setFalhar(e.target.checked)} />{es ? 'Simular fallo del envío' : 'Simular falha do envio'}</label>
            <label className="m-3">{es ? 'Agenda ficticia' : 'Agenda fictícia'} <select value={agenda} onChange={e => { setAgenda(e.target.value); salvarAgendaGrupo(storage(), 'ensaio-local-e2', grupoId, e.target.value); }}>
                <option value="">—</option><option value="agenda-fixture-1">Agenda de ensaio 1</option><option value="agenda-fixture-2">Agenda de ensaio 2</option>
            </select></label>
            <button className="border p-2" type="button" onClick={sincronizar}>Sincronizar agenda simulada</button>
            {!fila.length && <p>{es ? 'Ninguna asignación operativa.' : 'Nenhuma designação operacional.'}</p>}
            {fila.map(row => <article tabIndex={-1} data-programacao-id={row.programacaoId} className={`p-3 my-2 border rounded ${row.programacaoId === programacaoFoco ? 'bg-amber-50' : ''}`} key={row.assignmentKey}>
                <p>{row.preview}</p>
                <p>{row.confirmation.status} / {row.confirmation.weekReminderStatus} · {es ? 'Canales' : 'Canais'}: {Object.keys(row.confirmation.sentChannels || {}).join(', ') || '—'}</p>
                <button className="border p-2" onClick={() => enviar(row)}>{es ? 'Simular email' : 'Simular e-mail'}</button>
                <button className="border p-2" onClick={() => executar(async () => { const c = integracoesLocais.ensure({ ...row.confirmation, grupoId }); integracoesLocais.update(c.token, 'primary', 'confirmado'); setStatus(es ? 'Aceptado en el ensayo.' : 'Aceito no ensaio.'); })}>{es ? 'Simular aceptación' : 'Simular aceite'}</button>
                <button className="border p-2" onClick={() => executar(async () => { const c = integracoesLocais.ensure({ ...row.confirmation, grupoId }); integracoesLocais.channel(c.assignmentKey, 'waReminder'); setStatus(es ? 'Recordatorio simulado.' : 'Lembrete simulado.'); })}>{es ? 'Simular recordatorio' : 'Simular lembrete'}</button>
                {row.confirmation.token && <Link className="underline m-3" to={`/c/${row.confirmation.token}`}>{es ? 'Abrir confirmación local' : 'Abrir confirmação local'}</Link>}
            </article>)}
        </fieldset>
        <p role="status" className="break-all">{status}</p>
    </section>;
}
