import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
    runTransaction
} from 'firebase/firestore';

import { normalizeLanguage, normalizeSystemConfig } from '../config/appConfig';
import { db, auth } from './firebase';
import { getMeetingDateISOFromSemana } from '../utils/revisarEnviar/dates';
import { getEventoEspecialDaSemana, getTipoEventoSemana } from '../utils/eventos';
import { isBibleStudyPart, isPrayerPart } from '../utils/meetingParts';
import {
    FIM_DE_SEMANA_RESPONSABILIDADES,
    MEIO_SEMANA_RESPONSABILIDADES,
    normalizeFimDeSemana,
    normalizeResponsabilidades
} from '../utils/fimDeSemana';
import { resolveDataOwnerUid } from './adminAccess';

import { buildAssignmentKey, assignmentIdentity } from '../utils/assignmentIdentity.js';
import { resolverConfirmacaoGrupo } from '../utils/integracoesGrupo.js';
import { normalizeOcorrenciaReuniao } from '../utils/ocorrenciasReuniao.js';
import { MULTI_GRUPOS_LOCAL } from '../config/multiGruposLocal.js';
import { garantirParConfirmacao, registrarCanalConfirmacao, responderParConfirmacao } from './confirmacoesGrupoFirestore.js';
import { integracoesLocais } from './integracoesLocais.js';

const PRIVATE_COLLECTION = 'confirmacoes';
const PUBLIC_COLLECTION = 'confirmacoes_publicas';
const TOKEN_LENGTH = 10;
const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const getCurrentOwnerUid = () => {
    const user = auth.currentUser;
    if (!user?.uid) {
        throw new Error('Usuário autenticado não encontrado para gerar confirmação.');
    }
    return resolveDataOwnerUid(user);
};

const randomIndex = (max) => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const buffer = new Uint32Array(1);
        crypto.getRandomValues(buffer);
        return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
};

const createShortToken = () => {
    let token = '';
    for (let i = 0; i < TOKEN_LENGTH; i += 1) {
        token += TOKEN_ALPHABET[randomIndex(TOKEN_ALPHABET.length)];
    }
    return token;
};

const buildPrivateRef = (uid, assignmentKey) =>
    doc(db, `users/${uid}/${PRIVATE_COLLECTION}`, String(assignmentKey || '').trim());

const buildPublicRef = (token) =>
    doc(db, PUBLIC_COLLECTION, String(token || '').trim());

const STATUS_LABELS = {
    pt: {
        pendente: 'Pendente',
        confirmado: 'Aceito',
        nao_pode: 'Não poderá cumprir',
        nao_enviado: 'Lembrete não enviado',
        imprevisto: 'Teve imprevisto'
    },
    es: {
        pendente: 'Pendiente',
        confirmado: 'Aceptado',
        nao_pode: 'No podrá cumplir',
        nao_enviado: 'Recordatorio no enviado',
        imprevisto: 'Tuvo un imprevisto'
    }
};

const getStatusLabel = (status, lang = 'pt') => {
    const labels = STATUS_LABELS[normalizeLanguage(lang)] || STATUS_LABELS.pt;
    return labels[status] || status;
};

const buildNotificationCopy = ({ lang, pessoaNome, tituloParte, previousStatus, nextStatus }) => {
    const safeLang = normalizeLanguage(lang);

    if (safeLang === 'es') {
        return {
            title: 'Respuesta de asignación actualizada',
            description: `${pessoaNome || 'Alguien'} cambió "${tituloParte || 'la asignación'}" de ${getStatusLabel(previousStatus, safeLang)} a ${getStatusLabel(nextStatus, safeLang)}.`
        };
    }

    return {
        title: 'Resposta de designação atualizada',
        description: `${pessoaNome || 'Alguém'} mudou "${tituloParte || 'a designação'}" de ${getStatusLabel(previousStatus, safeLang)} para ${getStatusLabel(nextStatus, safeLang)}.`
    };
};

const buildWeekReminderNotificationCopy = ({ lang, pessoaNome, tituloParte, previousStatus, nextStatus }) => {
    const safeLang = normalizeLanguage(lang);

    if (safeLang === 'es') {
        return {
            title: 'Recordatorio semanal actualizado',
            description: `${pessoaNome || 'Alguien'} cambió el recordatorio de "${tituloParte || 'la asignación'}" de ${getStatusLabel(previousStatus, safeLang)} a ${getStatusLabel(nextStatus, safeLang)}.`
        };
    }

    return {
        title: 'Lembrete semanal atualizado',
        description: `${pessoaNome || 'Alguém'} mudou o lembrete de "${tituloParte || 'a designação'}" de ${getStatusLabel(previousStatus, safeLang)} para ${getStatusLabel(nextStatus, safeLang)}.`
    };
};

const getProgramacaoCollectionRef = (uid) =>
    collection(db, `users/${String(uid || '').trim()}/programacao`);

const getConfigRef = (uid) =>
    doc(db, `users/${String(uid || '').trim()}/configuracoes`, 'geral');

const getPublicBoardRef = (uid) =>
    doc(db, 'quadros_publicos', String(uid || '').trim());

const getMeetingDateForWeek = (week, config) => {
    if (week.meioSemana?.data) return week.meioSemana.data;
    const eventoEspecial = getEventoEspecialDaSemana(week, config);
    const tipoEvento = getTipoEventoSemana(week, config);
    const isVisita = tipoEvento === 'visita';
    const fallbackStr = week?.dataReuniao || week?.dataExata || week?.dataInicio || week?.data || null;

    if (eventoEspecial?.dataInput && !isVisita) {
        return eventoEspecial.dataInput;
    }

    let dataCalculada = getMeetingDateISOFromSemana({
        semanaStr: week?.semana,
        config,
        isoFallback: fallbackStr,
        overrideDia: isVisita ? 'terça-feira' : null,
        textSources: [week?.semana]
    });

    if (!dataCalculada) {
        dataCalculada = fallbackStr;
    }

    if (isVisita && dataCalculada) {
        const [ano, mes, dia] = dataCalculada.split('-').map(Number);
        const d = new Date(ano, mes - 1, dia, 12, 0, 0);

        if (d.getDay() !== 2) {
            const diff = 2 - d.getDay();
            d.setDate(d.getDate() + diff);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }

    return dataCalculada;
};

const getWeekendDateForWeek = (week, config) => {
    if (week.fimDeSemana?.data) return week.fimDeSemana.data;
    const fallbackStr = week?.fimDeSemana?.data || week?.dataReuniao || week?.dataExata || week?.dataInicio || week?.data || null;
    return getMeetingDateISOFromSemana({
        semanaStr: week?.semana,
        config,
        isoFallback: fallbackStr,
        overrideDia: config?.dia_reuniao_fds || config?.diaReuniaoFds || 'saturday',
        textSources: [week?.semana]
    }) || fallbackStr || '';
};

const collectAssignmentKeysForWeek = (week, config = {}) => {
    const keys = new Set();
    if (week?.arquivada) return keys;
    const dataISO = getMeetingDateForWeek(week, config);
    const semana = String(week?.semana || '').trim();

    const addAssignment = (pessoa, role, parteId) => {
        const pessoaId = pessoa?.id || pessoa?.nome;
        if (!pessoaId) return;

        keys.add(buildAssignmentKey({
            dataISO,
            semana,
            parteId,
            pessoaId,
            role
        }));
    };

    if (normalizeOcorrenciaReuniao(week, 'meioSemana', config).operacional) {
    if (week?.presidente) {
        addAssignment(week.presidente, 'presidente', 'presidente');
    }

    (Array.isArray(week?.partes) ? week.partes : []).forEach((parte) => {
        if (isPrayerPart(parte)) {
            addAssignment(parte?.oracao || parte?.estudante, 'oracao', parte?.id);
            return;
        }

        if (isBibleStudyPart(parte)) {
            addAssignment(parte?.dirigente || parte?.estudante, 'dirigente', parte?.id);
            addAssignment(parte?.leitor || week?.leitor, 'leitor', parte?.id);
            return;
        }

        addAssignment(parte?.estudante, 'resp', parte?.id);
        addAssignment(parte?.ajudante, 'ajud', parte?.id);
    });

    const responsabilidadesMeioSemana = normalizeResponsabilidades(week?.responsabilidades, MEIO_SEMANA_RESPONSABILIDADES);
    MEIO_SEMANA_RESPONSABILIDADES.forEach(({ storageKey, slotKey }) => {
        (responsabilidadesMeioSemana[storageKey] || []).forEach((pessoa, itemIndex) => {
            addAssignment(pessoa, slotKey, `meio_${storageKey}_${itemIndex}`);
        });
    });

    }
    const fds = normalizeFimDeSemana(week?.fimDeSemana);
    if (normalizeOcorrenciaReuniao(week, 'fimDeSemana', config).operacional) {
        const dataFds = getWeekendDateForWeek(week, config) || dataISO;
        const addWeekendAssignment = (pessoa, role, parteId) => {
            const pessoaId = pessoa?.id || pessoa?.nome;
            if (!pessoaId) return;

            keys.add(buildAssignmentKey({
                dataISO: dataFds,
                semana,
                parteId,
                pessoaId,
                role
            }));
        };

        addWeekendAssignment(fds.presidente, 'presidente_fds', 'fds_presidente');
        addWeekendAssignment(fds.oracaoFinal, 'oracao_fds', 'fds_oracao_final');
        addWeekendAssignment(fds.estudoSentinela?.dirigente, 'dirigente_sentinela', 'fds_dirigente_sentinela');
        addWeekendAssignment(fds.estudoSentinela?.leitor, 'leitor_sentinela', 'fds_leitor_sentinela');

        FIM_DE_SEMANA_RESPONSABILIDADES.forEach(({ storageKey, slotKey }) => {
            (fds.responsabilidades?.[storageKey] || []).forEach((pessoa, itemIndex) => {
                addWeekendAssignment(pessoa, slotKey, `fds_${storageKey}_${itemIndex}`);
            });
        });
    }

    return keys;
};

const validateConfirmationTarget = async (confirmationData = {}) => {
    const ownerUid = String(confirmationData?.ownerUid || '').trim();
    const assignmentKey = String(confirmationData?.assignmentKey || '').trim();
    const semana = String(confirmationData?.semana || '').trim();

    if (!ownerUid || !assignmentKey || (confirmationData.identityVersion !== 2 && !semana)) {
        return { isUnavailable: true, unavailableReason: 'missing_reference' };
    }

    const findAssignmentInWeeks = (weeks = [], config = {}) => resolverConfirmacaoGrupo({
        confirmacao: confirmationData, programacoes: Array.isArray(weeks) ? weeks : [], config, collectLegacyKeys: collectAssignmentKeysForWeek,
    });

    const publicBoardSnap = await getDoc(getPublicBoardRef(ownerUid));
    if (publicBoardSnap.exists()) {
        const publicBoard = publicBoardSnap.data() || {};
        const config = normalizeSystemConfig(publicBoard.configuracoes || {});
        return findAssignmentInWeeks(publicBoard.historico_reunioes, config);
    }

    const canReadPrivateProgram = resolveDataOwnerUid(auth.currentUser) === ownerUid;
    if (!canReadPrivateProgram) {
        return { isUnavailable: true, unavailableReason: 'validation_unavailable' };
    }

    const [configSnap, weeksSnap] = await Promise.all([
        getDoc(getConfigRef(ownerUid)),
        getDocs(query(getProgramacaoCollectionRef(ownerUid), where(confirmationData.identityVersion === 2 ? 'id' : 'semana', '==', confirmationData.identityVersion === 2 ? confirmationData.programacaoId : semana)))
    ]);

    const config = normalizeSystemConfig(configSnap.exists() ? configSnap.data() : {});
    return findAssignmentInWeeks(weeksSnap.docs.map((weekDoc) => weekDoc.data()), config);
};

const ensureUniqueToken = async () => {
    for (let i = 0; i < 7; i += 1) {
        const token = createShortToken();
        const tokenSnap = await getDoc(buildPublicRef(token));
        if (!tokenSnap.exists()) {
            return token;
        }
    }
    throw new Error('Não foi possível gerar um token exclusivo de confirmação.');
};

export const buildConfirmationUrl = (token, responseCode = '', flow = '') => {
    if (!token || typeof window === 'undefined') return '';

    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    const path = `${base || ''}/c/${token}`;
    const url = new URL(path.startsWith('/') ? path : `/${path}`, window.location.origin);
    if (responseCode) {
        url.searchParams.set('r', responseCode);
    }
    if (flow) {
        url.searchParams.set('f', flow);
    }
    return url.toString();
};

export const ensurePublicConfirmation = async ({
    assignmentKey,
    lang,
    semana,
    dataISO,
    tituloParte,
    tituloParteExibicao,
    pessoaNome,
    role,
    congregacaoNome,
    agendaLink = '',
    sala = 'Principal',
    secao = '',
    ...identity
}) => {
    if (MULTI_GRUPOS_LOCAL) {
        const c = integracoesLocais.ensure({ ...identity, assignmentKey });
        return { ...c, link: buildConfirmationUrl(c.token), acceptLink: buildConfirmationUrl(c.token, 'a'), declineLink: buildConfirmationUrl(c.token, 'n'), weekLink: buildConfirmationUrl(c.token, '', 'w') };
    }
    const ownerUid = getCurrentOwnerUid();
    const safeKey = String(assignmentKey || '').trim();
    if (!safeKey) throw new Error('Chave da designação ausente.');
    const v2 = identity.identityVersion === 2 ? assignmentIdentity(identity) : null;
    if (v2 && buildAssignmentKey(v2) !== safeKey) throw new Error('Identidade da confirmação divergente.');
    // Candidato gerado fora da transação. Uma transação concorrente sempre
    // reutiliza o token já persistido, sem regenerar seus vínculos.
    const candidate = await ensureUniqueToken();
    const result = await garantirParConfirmacao({ db, sdk: { doc, runTransaction, serverTimestamp }, ownerUid, safeKey, candidate,
        dados: { ...identity, lang, semana, dataISO, tituloParte, tituloParteExibicao, pessoaNome, role, congregacaoNome, agendaLink, sala, secao } });
    const { token, status } = result;

    return {
        token,
        link: buildConfirmationUrl(token),
        acceptLink: buildConfirmationUrl(token, 'a'),
        declineLink: buildConfirmationUrl(token, 'n'),
        weekLink: buildConfirmationUrl(token, '', 'w'),
        status
    };
};

export const getPublicConfirmation = async (token) => {
    if (MULTI_GRUPOS_LOCAL) return integracoesLocais.get(token);
    const safeToken = String(token || '').trim();
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(safeToken)) return null;

    const snap = await getDoc(buildPublicRef(safeToken));
    if (!snap.exists()) return null;

    const data = {
        id: snap.id,
        ...snap.data()
    };
    const availability = await validateConfirmationTarget(data);

    return {
        ...data,
        ...availability
    };
};

const updateConfirmationState = async (token, mode, status, options = {}) => {
    if (MULTI_GRUPOS_LOCAL) return integracoesLocais.update(token, mode, status);
    const safeToken = String(token || '').trim();
    await responderParConfirmacao({ db, sdk: { doc, runTransaction, serverTimestamp }, token: safeToken, mode, status, options,
        validarDestino: (confirmacao, board) => resolverConfirmacaoGrupo({ confirmacao,
            programacoes: board.historico_reunioes || [], config: board.configuracoes || {}, collectLegacyKeys: collectAssignmentKeysForWeek }),
        criarTexto: ({ current, mode: tipo, previousStatus, nextStatus }) => (tipo === 'week' ? buildWeekReminderNotificationCopy : buildNotificationCopy)({
            lang: current.lang, pessoaNome: current.pessoaNome, tituloParte: current.tituloParte, previousStatus, nextStatus }) });
    return getPublicConfirmation(safeToken);
};

export const respondToPublicConfirmation = async (token, status, options = {}) =>
    updateConfirmationState(token, 'primary', status, options);

export const respondToPublicWeekReminder = async (token, status, options = {}) =>
    updateConfirmationState(token, 'week', status, options);

export const respondToConfirmationByAssignment = async (assignmentKey, status, options = {}) => {
    if (MULTI_GRUPOS_LOCAL) { const c = integracoesLocais.snapshot().confirmacoes.find(item => item.assignmentKey === assignmentKey); return integracoesLocais.update(c?.token, 'primary', status); }
    const ownerUid = getCurrentOwnerUid();
    const safeKey = String(assignmentKey || '').trim();
    if (!safeKey) {
        throw new Error('Chave da designação inválida.');
    }

    const privateSnap = await getDoc(buildPrivateRef(ownerUid, safeKey));
    if (!privateSnap.exists()) {
        throw new Error('Confirmação ainda não foi preparada para esta designação.');
    }

    const token = privateSnap.data()?.token;
    if (!token) {
        throw new Error('Token de confirmação não encontrado para esta designação.');
    }

    return respondToPublicConfirmation(token, status, options);
};

export const respondToWeekReminderByAssignment = async (assignmentKey, status, options = {}) => {
    if (MULTI_GRUPOS_LOCAL) { const c = integracoesLocais.snapshot().confirmacoes.find(item => item.assignmentKey === assignmentKey); return integracoesLocais.update(c?.token, 'week', status); }
    const ownerUid = getCurrentOwnerUid();
    const safeKey = String(assignmentKey || '').trim();
    if (!safeKey) {
        throw new Error('Chave da designação inválida.');
    }

    const privateSnap = await getDoc(buildPrivateRef(ownerUid, safeKey));
    if (!privateSnap.exists()) {
        throw new Error('Confirmação ainda não foi preparada para esta designação.');
    }

    const token = privateSnap.data()?.token;
    if (!token) {
        throw new Error('Token de confirmação não encontrado para esta designação.');
    }

    return respondToPublicWeekReminder(token, status, options);
};

export const registerConfirmationReminder = async assignmentKey => {
    if (MULTI_GRUPOS_LOCAL) return integracoesLocais.channel(assignmentKey, 'waReminder');
    return registrarCanalConfirmacao({ db, sdk: { doc, runTransaction, serverTimestamp }, ownerUid: getCurrentOwnerUid(), assignmentKey, channel: 'waReminder', lembrete: true });
};

export const registerNotificationChannelByAssignment = async (assignmentKey, channel) => {
    if (MULTI_GRUPOS_LOCAL) return integracoesLocais.channel(assignmentKey, channel);
    return registrarCanalConfirmacao({ db, sdk: { doc, runTransaction, serverTimestamp }, ownerUid: getCurrentOwnerUid(), assignmentKey, channel });
};

export const markConfirmationAlertSeen = async (token) => {
    const safeToken = String(token || '').trim();
    if (!safeToken) return;

    await updateDoc(buildPublicRef(safeToken), {
        alertPending: false,
        alertSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};
