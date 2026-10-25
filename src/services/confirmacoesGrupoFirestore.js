import { prepararRespostaConfirmacao } from '../utils/respostasConfirmacao.js';
import { assignmentIdentity, buildAssignmentKey } from '../utils/assignmentIdentity.js';
import { resolverConfirmacaoGrupo } from '../utils/integracoesGrupo.js';
import { gruposRemotosAtivos } from '../utils/compatibilidadeGrupos.js';
export async function garantirParConfirmacao({ db, sdk, ownerUid, safeKey, candidate, dados }) {
    const { lang, semana, dataISO, tituloParte, tituloParteExibicao, pessoaNome, role, congregacaoNome, agendaLink = '', sala = 'Principal', secao = '' } = dados;
    const v2 = dados.identityVersion === 2 ? assignmentIdentity(dados) : null;
    if (v2 && buildAssignmentKey(v2) !== safeKey) throw new Error('Identidade da confirmação divergente.');
    const privateRef = sdk.doc(db, `users/${ownerUid}/confirmacoes/${safeKey}`);
    return sdk.runTransaction(db, async tx => {
        const privateSnap = await tx.get(privateRef);
        const privateData = privateSnap.exists() ? privateSnap.data() : {};
        const token = privateData.token || candidate;
        const publicRef = sdk.doc(db, 'confirmacoes_publicas', token);
        const publicSnap = await tx.get(publicRef);
        const publicData = publicSnap.exists() ? publicSnap.data() : {};
        if (publicSnap.exists() && (publicData.ownerUid !== ownerUid || publicData.assignmentKey !== safeKey)) throw new Error('Conflito de token.');
        if (v2) {
            const cfg = (await tx.get(sdk.doc(db, `users/${ownerUid}/configuracoes/geral`))).data();
            if (!gruposRemotosAtivos(cfg)) throw new Error('Multi-grupos remoto não está ativo.');
            const program = await tx.get(sdk.doc(db, `users/${ownerUid}/programacao/${v2.programacaoId}`));
            const validation = resolverConfirmacaoGrupo({ confirmacao: { ...v2, ownerUid, assignmentKey: safeKey }, config: cfg,
                programacoes: program.exists() ? [{ ...program.data(), id: program.id }] : [] });
            if (validation.isUnavailable) throw new Error('A designação mudou; atualize a tela.');
        }
        const status = publicData.status || privateData.status || 'pendente';
        const baseData = {
            ...(v2 || {}), token, assignmentKey: safeKey, ownerUid,
            lang: lang === 'es' ? 'es' : 'pt', semana: semana || '', dataISO: dataISO || '',
            tituloParte: tituloParte || '', tituloParteExibicao: tituloParteExibicao || '',
            pessoaNome: pessoaNome || '', role: role || '', congregacaoNome: congregacaoNome || '',
            agendaLink, sala, secao, status,
            weekReminderStatus: publicData.weekReminderStatus || privateData.weekReminderStatus || 'nao_enviado',
            createdAt: privateData.createdAt || publicData.createdAt || sdk.serverTimestamp(), updatedAt: sdk.serverTimestamp()
        };
        for (const key of ['responseHistory', 'weekReminderHistory', 'sentChannels']) {
            if (publicData[key] !== undefined || privateData[key] !== undefined) baseData[key] = publicData[key] ?? privateData[key];
        }
        tx.set(publicRef, baseData, { merge: true });
        tx.set(privateRef, baseData, { merge: true });
        return { token, status };
    });
}

export async function registrarCanalConfirmacao({ db, sdk, ownerUid, assignmentKey, channel, lembrete = false }) {
    if (!['wa', 'mail', 'waReminder'].includes(channel)) throw new Error('Canal inválido.');
    const privateRef = sdk.doc(db, `users/${ownerUid}/confirmacoes/${assignmentKey}`);
    const iso = new Date().toISOString();
    return sdk.runTransaction(db, async tx => {
        const priv = await tx.get(privateRef);
        if (!priv.exists() || !priv.data().token) throw new Error('Confirmação não encontrada.');
        const publicRef = sdk.doc(db, 'confirmacoes_publicas', priv.data().token);
        const pub = await tx.get(publicRef);
        if (!pub.exists() || pub.data().assignmentKey !== assignmentKey || pub.data().ownerUid !== ownerUid) throw new Error('Vínculo de confirmação inconsistente.');
        const channels = { ...priv.data().sentChannels, ...pub.data().sentChannels, [channel]: iso };
        // Caminhos de campo preservam canais incluídos por outra sessão.
        const payload = { ...Object.fromEntries(Object.entries(channels).map(([key, value]) => [`sentChannels.${key}`, value])),
            lastNotificationChannel: channel, lastNotificationSentAt: sdk.serverTimestamp(), lastNotificationSentAtIso: iso, updatedAt: sdk.serverTimestamp() };
        const prefix = { wa: 'lastWhatsappSentAt', mail: 'lastEmailSentAt', waReminder: 'lastReminderSentAt' }[channel];
        payload[prefix] = sdk.serverTimestamp(); payload[prefix + 'Iso'] = iso;
        if (lembrete) {
            const current = pub.data().weekReminderStatus || priv.data().weekReminderStatus;
            payload.weekReminderStatus = ['confirmado', 'imprevisto'].includes(current) ? current : 'pendente';
        }
        tx.update(privateRef, payload); tx.update(publicRef, payload);
        return { registrado: true };
    });
}

export async function responderParConfirmacao({ db, sdk, token, mode, status, options = {}, validarDestino, criarTexto }) {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(token || '')) throw new Error('Token de confirmação inválido.');
    const publicRef = sdk.doc(db, 'confirmacoes_publicas', token);
    const nowISO = new Date().toISOString(), requestId = crypto.randomUUID();
    return sdk.runTransaction(db, async tx => {
        const snap = await tx.get(publicRef);
        if (!snap.exists()) throw new Error('Confirmação pública não encontrada.');
        const current = snap.data();
        if (!current.ownerUid || !current.assignmentKey) throw new Error('Vínculo de confirmação ausente.');
        const board = await tx.get(sdk.doc(db, 'quadros_publicos', current.ownerUid));
        if (!board.exists()) throw new Error('Quadro indisponível para conferir a designação.');
        const availability = validarDestino(current, board.data());
        if (availability.isUnavailable) { const error = new Error('A designação vinculada a este link não está disponível.'); error.code = availability.unavailableReason; throw error; }
        const payload = prepararRespostaConfirmacao(current, { ...options, mode, status, nowISO, requestId, timestamp: sdk.serverTimestamp });
        if (!payload) return { changed: false };
        const week = mode === 'week', previousStatus = week ? payload.weekReminderPreviousStatus : payload.previousStatus;
        const type = week ? 'lembrete_semana_status' : 'confirmacao_status';
        const changeKey = week ? payload.lastWeekReminderChangeKey : payload.lastStatusChangeKey;
        const id = `${token}_${type}_${changeKey}`;
        const copy = criarTexto({ current, mode, previousStatus, nextStatus: status });
        tx.update(publicRef, payload);
        tx.set(sdk.doc(db, `users/${current.ownerUid}/confirmacoes/${current.assignmentKey}`), { ...payload,
            ...(current.identityVersion === 2 ? assignmentIdentity(current) : {}), token, assignmentKey: current.assignmentKey, ownerUid: current.ownerUid }, { merge: true });
        tx.set(sdk.doc(db, 'notificacoes', id), { id, ownerUid: current.ownerUid, type, title: String(copy.title || '').slice(0, 120), description: String(copy.description || '').slice(0, 500),
            token, assignmentKey: current.assignmentKey, dataISO: current.dataISO || '', semana: current.semana || '', pessoaNome: current.pessoaNome || '',
            status, previousStatus, meta: { ...(current.identityVersion === 2 ? assignmentIdentity(current) : {}), tituloParte: current.tituloParte || '', congregacaoNome: current.congregacaoNome || '' },
            readAt: null, readAtIso: null, createdAt: sdk.serverTimestamp(), createdAtIso: nowISO });
        return { changed: true };
    });
}
