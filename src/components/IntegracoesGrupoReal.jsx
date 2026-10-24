import React, { useState } from 'react';
import { criarFilaGrupo, lerAgendaGrupo, salvarAgendaGrupo } from '../utils/integracoesGrupo.js';
import { ensurePublicConfirmation, registerNotificationChannelByAssignment, registerConfirmationReminder, respondToConfirmationByAssignment, buildConfirmationUrl } from '../services/confirmacoesPublicas.js';
import { buildWhatsappHref } from '../utils/revisarEnviar/links.js';
import { enviarEmailAutomatico } from '../utils/revisarEnviar/enviadorEmail.js';
import { iniciarSincronizacao } from '../services/calendarSync.js';
import { sincronizarAgendaGrupo } from '../services/agendaGrupos.js';

const storage = () => { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } };

export default function IntegracoesGrupoReal({ config, grupoId, ownerUid, programacoes, confirmacoes, alunos = [], programacaoFoco = '' }) {
    const es = config.grupos[grupoId].idioma === 'es';
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [oauth, setOauth] = useState(null);
    const [agenda, setAgenda] = useState(() => lerAgendaGrupo(storage(), ownerUid, grupoId, config));
    const fila = criarFilaGrupo({ config, grupoId, programacoes, confirmacoes });
    const executar = async fn => {
        if (busy) return;
        setBusy(true); setStatus('');
        try { await fn(); } catch (error) { setStatus(error.message); }
        finally { setBusy(false); }
    };
    const preparar = row => {
        if (!row.item.reuniao.publica) throw new Error(es ? 'Publica esta reunión antes de generar o enviar su confirmación.' : 'Publique esta reunião antes de gerar ou enviar a confirmação.');
        return ensurePublicConfirmation(row.confirmation);
    };
    const contato = row => alunos.find(a => String(a.id) === String(row.pessoaId)) || {};
    const email = row => executar(async () => {
        const pessoa = contato(row);
        if (!pessoa.email) throw new Error(es ? 'Falta el correo de la persona.' : 'A pessoa não tem e-mail cadastrado.');
        const c = await preparar(row);
        const ok = await enviarEmailAutomatico({ email_destino: pessoa.email, Nome: row.item.pessoa.nome,
            Data: row.item.reuniao.data, Desig: row.titulo, LinkConfirmacao: c.link, LinkConfirmar: c.acceptLink, LinkRecusar: c.declineLink });
        if (!ok) throw new Error(es ? 'El proveedor no confirmó el envío.' : 'O provedor não confirmou o envio.');
        try { await registerNotificationChannelByAssignment(row.assignmentKey, 'mail'); }
        catch { throw new Error(es ? 'Correo enviado; falló el registro. No repitas el envío; actualiza y registra el canal.' : 'E-mail enviado; falhou o registro. Não reenvie; atualize e registre o canal.'); }
        setStatus(es ? 'Correo enviado.' : 'E-mail enviado.');
    });
    const whatsapp = (row, lembrete = false) => {
        // Abrir sincronicamente mantém a ação vinculada ao clique e evita bloqueio de popup.
        const win = window.open('about:blank', '_blank');
        if (!win) { setStatus(es ? 'Permite abrir WhatsApp en el navegador.' : 'Permita abrir o WhatsApp no navegador.'); return; }
        win.opener = null;
        executar(async () => {
            try {
                const telefone = String(contato(row).telefone || contato(row).whatsapp || '').replace(/\D/g, '');
                if (!telefone) throw new Error(es ? 'Falta el teléfono.' : 'Telefone não cadastrado.');
                const c = await preparar(row);
                const link = lembrete ? c.weekLink : c.link;
                win.location.href = buildWhatsappHref(telefone, row.preview + '\n' + link);
                setStatus(es ? 'WhatsApp abierto. Marca el envío después de enviarlo.' : 'WhatsApp aberto. Marque o envio depois de enviar a mensagem.');
            } catch (error) { win.close(); throw error; }
        });
    };
    return <section className="no-print p-4 border rounded-xl my-4">
        <h3 className="font-bold">{es ? 'Envíos y Google Calendar' : 'Envios e Google Agenda'}</h3>
        <fieldset disabled={busy}>
            <button className="border p-2" onClick={() => executar(async () => {
                const r = await iniciarSincronizacao();
                if (!r.sucesso) throw new Error(r.erro);
                if (r.ownerUid !== ownerUid) throw new Error('A conta conectada não pertence a este ambiente.');
                setOauth(r);
            })}>{es ? 'Conectar Google Calendar' : 'Conectar Google Agenda'}</button>
            {oauth && <><select aria-label={es ? 'Calendario del grupo' : 'Agenda do grupo'} value={agenda} onChange={e => {
                setAgenda(e.target.value); salvarAgendaGrupo(storage(), ownerUid, grupoId, e.target.value);
            }}><option value="">—</option>{oauth.calendarios.map(c => <option value={c.id} key={c.id}>{c.nome}</option>)}</select>
                <button className="border p-2" onClick={() => executar(async () => {
                    if (!agenda) throw new Error(es ? 'Elige un calendario.' : 'Escolha uma agenda.');
                    const r = await sincronizarAgendaGrupo({ token: oauth.token, calendarId: agenda, programacoes, config, grupoId, alunos });
                    setStatus(`${r.resultados.filter(x => x.ok).length} eventos. ${r.resultados.filter(x => !x.ok).map(x => x.erro).join('; ')}`);
                })}>{es ? 'Sincronizar este grupo' : 'Sincronizar este grupo'}</button></>}
            {!fila.length && <p>{es ? 'Ninguna asignación operativa.' : 'Nenhuma designação operacional.'}</p>}
            {fila.map(row => <article data-programacao-id={row.programacaoId} className={`p-3 my-2 border rounded ${row.programacaoId === programacaoFoco ? 'bg-amber-50' : ''}`} key={row.assignmentKey}>
                <p>{row.preview}</p><p>{row.confirmation.status} / {row.confirmation.weekReminderStatus} · {Object.keys(row.confirmation.sentChannels || {}).join(', ') || '—'}</p>
                <button className="border p-2" onClick={() => email(row)}>{es ? 'Enviar correo' : 'Enviar e-mail'}</button>
                <button className="border p-2" onClick={() => whatsapp(row)}>WhatsApp</button>
                <button className="border p-2" onClick={() => whatsapp(row, true)}>{es ? 'Abrir recordatorio' : 'Abrir lembrete'}</button>
                <button className="border p-2" onClick={() => executar(async () => { await preparar(row); await registerNotificationChannelByAssignment(row.assignmentKey, 'wa'); setStatus(es ? 'Envío registrado.' : 'Envio registrado.'); })}>{es ? 'Marcar WhatsApp enviado' : 'Marcar WhatsApp enviado'}</button>
                <button className="border p-2" onClick={() => executar(async () => { await preparar(row); await registerConfirmationReminder(row.assignmentKey); setStatus(es ? 'Recordatorio registrado.' : 'Lembrete registrado.'); })}>{es ? 'Marcar recordatorio enviado' : 'Marcar lembrete enviado'}</button>
                <select aria-label={es ? 'Respuesta manual' : 'Resposta manual'} value="" onChange={e => { const value = e.target.value; if (value) executar(async () => { await preparar(row); await respondToConfirmationByAssignment(row.assignmentKey, value, { source: 'admin_manual', actorType: 'admin' }); setStatus(es ? 'Respuesta guardada.' : 'Resposta salva.'); }); }}>
                    <option value="">{es ? 'Registrar respuesta' : 'Registrar resposta'}</option><option value="confirmado">{es ? 'Aceptado' : 'Aceito'}</option><option value="nao_pode">{es ? 'No podrá cumplir' : 'Não poderá cumprir'}</option><option value="pendente">{es ? 'Pendiente' : 'Pendente'}</option>
                </select>
                {row.confirmation.token && <a className="underline m-3" href={buildConfirmationUrl(row.confirmation.token)} target="_blank" rel="noreferrer">{es ? 'Abrir confirmación' : 'Abrir confirmação'}</a>}
            </article>)}
        </fieldset><p role="status" className="break-words">{status}</p>
    </section>;
}
