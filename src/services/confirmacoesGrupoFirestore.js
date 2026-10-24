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
