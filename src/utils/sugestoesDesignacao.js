import { getAssignmentCapabilityForSlot } from './assignmentEligibility.js';
import { getCelebracao } from './celebracao.js';
import {
    FIM_DE_SEMANA_RESPONSABILIDADES,
    MEIO_SEMANA_RESPONSABILIDADES,
    getFimDeSemanaAssignedPeople,
    getMeioSemanaAssignedPeople,
} from './fimDeSemana.js';
import {
    getMeetingPartTitleNormalized,
    getMeetingPartTypeNormalized,
    isBibleStudyPart,
    isPrayerPart,
    isSongOnlyPart,
    isWhatWouldYouSayPart,
} from './meetingParts.js';
import { normalizeOcorrenciaReuniao } from './ocorrenciasReuniao.js';
import { getMeetingDateISOFromSemana, parseFlexibleDateToISO } from './revisarEnviar/dates.js';

const FDS_SLOT_KEYS = new Set([
    'presidente_fds',
    'oracao_fds',
    'dirigente_sentinela',
    'leitor_sentinela',
]);

const DEFAULT_SLOT_LABELS = {
    pt: {
        presidente: 'Presidente',
        oracao: 'Oração',
        dirigente: 'Dirigente',
        leitor: 'Leitor',
        estudante: 'Estudante',
        ajudante: 'Ajudante',
        presidente_fds: 'Presidente',
        oracao_fds: 'Oração final',
        dirigente_sentinela: 'Dirigente da Sentinela',
        leitor_sentinela: 'Leitor da Sentinela',
        videoZoomSom: 'Vídeo, Zoom e som',
        indicadoresEntrada: 'Indicadores da entrada',
        indicadoresAuditorio: 'Indicadores do auditório',
        microfonesVolantes: 'Microfones volantes',
    },
    es: {
        presidente: 'Presidente',
        oracao: 'Oración',
        dirigente: 'Conductor',
        leitor: 'Lector',
        estudante: 'Estudiante',
        ajudante: 'Ayudante',
        presidente_fds: 'Presidente',
        oracao_fds: 'Oración final',
        dirigente_sentinela: 'Conductor de La Atalaya',
        leitor_sentinela: 'Lector de La Atalaya',
        videoZoomSom: 'Video, Zoom y sonido',
        indicadoresEntrada: 'Acomodadores de entrada',
        indicadoresAuditorio: 'Acomodadores del auditorio',
        microfonesVolantes: 'Micrófonos',
    },
};

const hasPessoa = (pessoa) => !!(
    (pessoa?.id != null && String(pessoa.id).trim() !== '')
    || (pessoa?.nome != null && String(pessoa.nome).trim() !== '')
);

const normalizarSecaoParte = (secao) => {
    const value = String(secao ?? '').toLowerCase();
    if (value.includes('tesou')) return 'tesouros';
    if (value.includes('minist')) return 'ministerio';
    return 'vida';
};

const parteExigeAjudante = (parte) => {
    if (normalizarSecaoParte(parte?.secao) !== 'ministerio') return false;
    const titulo = getMeetingPartTitleNormalized(parte);
    const tipo = getMeetingPartTypeNormalized(parte);
    const isDiscurso = titulo.includes('discurso') || tipo.includes('discurso');
    return !isDiscurso && !isWhatWouldYouSayPart(parte);
};

export function getTipoReuniaoSlot(slot = null) {
    if (!slot) return 'meioSemana';
    if (slot.tipoReuniao === 'fimDeSemana' || slot.fds) return 'fimDeSemana';
    const key = String(slot.key || slot.slotKey || '').toLowerCase();
    if (FDS_SLOT_KEYS.has(key)) return 'fimDeSemana';
    return 'meioSemana';
}

export function isSameDesignacaoSlot(item, targetSlot) {
    if (!item || !targetSlot) return false;
    const ctx = item.context || {};
    const targetKey = targetSlot.key || targetSlot.slotKey;
    const sameParte = (ctx.parteId ?? null) === (targetSlot.parteId ?? null)
        || (ctx.parteId != null && targetSlot.parteId != null && String(ctx.parteId) === String(targetSlot.parteId));
    const sameResp = (ctx.responsabilidadeKey ?? null) === (targetSlot.responsabilidadeKey ?? null);
    const sameIdx = (ctx.itemIndex ?? null) === (targetSlot.itemIndex ?? null)
        || (ctx.itemIndex != null && targetSlot.itemIndex != null && Number(ctx.itemIndex) === Number(targetSlot.itemIndex));

    return item.slotKey === targetKey
        && sameParte
        && !!ctx.fds === !!targetSlot.fds
        && !!ctx.meioSemana === !!targetSlot.meioSemana
        && sameResp
        && sameIdx;
}

export function getDesignacoesDaReuniao(semana, tipoReuniao = 'meioSemana', { config = {}, lang = 'pt', labels = {} } = {}) {
    if (!semana) return [];
    const tipo = tipoReuniao === 'fimDeSemana' ? 'fimDeSemana' : 'meioSemana';
    const baseLabels = { ...(DEFAULT_SLOT_LABELS[lang] || DEFAULT_SLOT_LABELS.pt), ...(labels || {}) };
    const celebracao = getCelebracao(semana, config);

    if (celebracao?.tipoReuniao === tipo) {
        if (celebracao.ativo === false) return [];
        const assigned = [];
        MEIO_SEMANA_RESPONSABILIDADES.forEach(({ storageKey, slotKey }) => {
            (celebracao.responsabilidades?.[storageKey] || []).forEach((pessoa, itemIndex) => {
                if (!hasPessoa(pessoa)) return;
                assigned.push({
                    pessoa,
                    slotKey,
                    label: baseLabels[storageKey] || slotKey,
                    context: {
                        celebracao: true,
                        fds: tipo === 'fimDeSemana',
                        meioSemana: tipo === 'meioSemana',
                        responsabilidadeKey: storageKey,
                        itemIndex,
                        responsabilidade: true,
                    },
                });
            });
        });
        return assigned;
    }

    if (tipo === 'fimDeSemana') {
        if (config?.grupoSelecionadoId && !normalizeOcorrenciaReuniao(semana, 'fimDeSemana', config).operacional) {
            return [];
        }
        return getFimDeSemanaAssignedPeople(semana).map((item) => {
            const respKey = item?.context?.responsabilidadeKey;
            const respDef = respKey ? FIM_DE_SEMANA_RESPONSABILIDADES.find((def) => def.storageKey === respKey) : null;
            const label = (respKey && baseLabels[respKey])
                || baseLabels[item.slotKey]
                || respDef?.labels?.[lang]
                || item.label
                || item.slotKey;
            return { ...item, label };
        });
    }

    if (config?.grupoSelecionadoId && !normalizeOcorrenciaReuniao(semana, 'meioSemana', config).operacional) {
        return [];
    }
    if (semana?.meioSemana?.ativo === false) {
        return [];
    }

    const assigned = [];
    const add = (pessoa, slotKey, label, extra = {}) => {
        if (!hasPessoa(pessoa)) return;
        assigned.push({ pessoa, slotKey, label, context: extra });
    };

    add(semana?.presidente, 'presidente', baseLabels.presidente);

    if (Array.isArray(semana?.partes)) {
        semana.partes.forEach((parte) => {
            if (!parte || isSongOnlyPart(parte)) return;

            if (isPrayerPart(parte)) {
                add(parte.oracao, 'oracao', parte.titulo || baseLabels.oracao, { parteId: parte.id });
                return;
            }

            if (isBibleStudyPart(parte)) {
                add(parte.dirigente, 'dirigente', baseLabels.dirigente, { parteId: parte.id });
                add(parte.leitor, 'leitor', baseLabels.leitor, { parteId: parte.id });
                return;
            }

            add(parte.estudante, 'estudante', parte.titulo || baseLabels.estudante, { parteId: parte.id });
            if (parteExigeAjudante(parte)) {
                add(parte.ajudante, 'ajudante', baseLabels.ajudante, { parteId: parte.id });
            }
        });
    }

    getMeioSemanaAssignedPeople(semana).forEach((item) => {
        const respKey = item?.context?.responsabilidadeKey;
        const respDef = respKey ? MEIO_SEMANA_RESPONSABILIDADES.find((def) => def.storageKey === respKey) : null;
        const label = (respKey && baseLabels[respKey])
            || respDef?.labels?.[lang]
            || item.label
            || item.slotKey;
        assigned.push({ ...item, label });
    });

    return assigned;
}

export function calcularOcupacaoReuniao({
    semana,
    tipoReuniao,
    targetSlot = null,
    alunos = [],
    config = {},
    lang = 'pt',
    labels = {},
} = {}) {
    const tipo = tipoReuniao || getTipoReuniaoSlot(targetSlot);
    const designacoes = getDesignacoesDaReuniao(semana, tipo, { config, lang, labels })
        .filter((item) => !targetSlot || !isSameDesignacaoSlot(item, targetSlot));

    const familiaPorPessoa = new Map();
    for (const aluno of alunos || []) {
        const familia = String(aluno?.familia || '').trim().toLowerCase();
        if (!familia) continue;
        const idStr = aluno?.id != null ? String(aluno.id).trim() : '';
        const nomeStr = String(aluno?.nome || '').trim().toLowerCase();
        if (idStr) familiaPorPessoa.set(`id:${idStr}`, familia);
        if (nomeStr) familiaPorPessoa.set(`nome:${nomeStr}`, familia);
    }

    const ocupadosPorId = new Map();
    const ocupadosPorNome = new Map();
    const pessoasPorFamilia = new Map();

    for (const item of designacoes) {
        const pessoa = item?.pessoa;
        if (!hasPessoa(pessoa)) continue;
        const idStr = pessoa?.id != null ? String(pessoa.id).trim() : '';
        const nomeStr = String(pessoa?.nome || '').trim().toLowerCase();
        const label = String(item?.label || item?.slotKey || '').trim();

        if (idStr) {
            const lista = ocupadosPorId.get(idStr) || [];
            if (label && !lista.includes(label)) lista.push(label);
            ocupadosPorId.set(idStr, lista);
        }
        if (nomeStr) {
            const lista = ocupadosPorNome.get(nomeStr) || [];
            if (label && !lista.includes(label)) lista.push(label);
            ocupadosPorNome.set(nomeStr, lista);
        }

        const familia = String(
            pessoa?.familia
            || (idStr && familiaPorPessoa.get(`id:${idStr}`))
            || (nomeStr && familiaPorPessoa.get(`nome:${nomeStr}`))
            || ''
        ).trim().toLowerCase();
        const personKey = idStr ? `id:${idStr}` : (nomeStr ? `nome:${nomeStr}` : '');
        if (familia && personKey) {
            const pessoas = pessoasPorFamilia.get(familia) || new Set();
            pessoas.add(personKey);
            pessoasPorFamilia.set(familia, pessoas);
        }
    }

    const getPartesOcupadas = (aluno) => {
        if (!aluno) return [];
        const idStr = aluno?.id != null ? String(aluno.id).trim() : '';
        if (idStr && ocupadosPorId.has(idStr)) return ocupadosPorId.get(idStr);
        if (!idStr) {
            const nomeStr = String(aluno?.nome || '').trim().toLowerCase();
            if (nomeStr && ocupadosPorNome.has(nomeStr)) return ocupadosPorNome.get(nomeStr);
        }
        return [];
    };

    const isAlunoOcupado = (aluno) => {
        if (!aluno) return false;
        const idStr = aluno?.id != null ? String(aluno.id).trim() : '';
        if (idStr) return ocupadosPorId.has(idStr);
        const nomeStr = String(aluno?.nome || '').trim().toLowerCase();
        return !!nomeStr && ocupadosPorNome.has(nomeStr);
    };

    const isFamiliaOcupada = (aluno) => {
        const familia = String(aluno?.familia || '').trim().toLowerCase();
        if (!familia) return false;
        const pessoas = pessoasPorFamilia.get(familia);
        if (!pessoas || pessoas.size === 0) return false;
        const idStr = aluno?.id != null ? String(aluno.id).trim() : '';
        const nomeStr = String(aluno?.nome || '').trim().toLowerCase();
        const selfKey = idStr ? `id:${idStr}` : (nomeStr ? `nome:${nomeStr}` : '');
        for (const key of pessoas) {
            if (key !== selfKey) return true;
        }
        return false;
    };

    return {
        tipoReuniao: tipo,
        designacoes,
        ocupadosPorId,
        isAlunoOcupado,
        getPartesOcupadas,
        isFamiliaOcupada,
    };
}
import { projetarConfigGrupo } from './grupoAtivo.js';

const dataValida = value => {
    const iso = parseFlexibleDateToISO(value);
    if (!iso) return null;
    const date = new Date(`${iso}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
};

export function getDataDesignacao(semana, tipo = 'meioSemana', config = {}) {
    // As programacoes novas possuem datas por reuniao, mesmo antes do historico.
    for (const value of [semana?.[tipo]?.data, ...(tipo === 'meioSemana' ? [semana?.dataReuniao, semana?.dataExata] : [])]) {
        const iso = dataValida(value);
        if (iso) return iso;
    }
    const fallback = [semana?.dataInicio, semana?.dataReuniao, semana?.dataExata, semana?.data].map(dataValida).find(Boolean);
    const grupo = config.grupos?.[semana?.grupoId || config.grupoLegadoId];
    return dataValida(getMeetingDateISOFromSemana({
        semanaStr: semana?.semana, isoFallback: fallback, config: grupo ? projetarConfigGrupo(config, grupo.id || semana.grupoId || config.grupoLegadoId) : config,
        tipoReuniao: tipo,
        overrideDia: semana?.evento === 'visita' && tipo === 'meioSemana' ? 'tuesday' : null,
        textSources: [semana?.semana],
    }));
}

export function calcularRecenciaDesignacao({ alunoId, historico = [], contexto, config = {}, hoje = new Date() }) {
    let ultimaData = null;
    const mesmaPessoa = pessoa => pessoa?.id != null && String(pessoa.id) === String(alunoId);
    const registrar = (semana, tipo) => {
        const data = getDataDesignacao(semana, tipo, config);
        if (data && (!ultimaData || data > ultimaData)) ultimaData = data;
    };

    for (const semana of historico) {
        if (getMeioSemanaAssignedPeople(semana).some(item => mesmaPessoa(item.pessoa) && item.slotKey === contexto.capabilityKey)) {
            registrar(semana, 'meioSemana');
        }
        if (getFimDeSemanaAssignedPeople(semana).some(item => mesmaPessoa(item.pessoa)
            && item.slotKey === (contexto.slotKey === 'oracao_fds' ? 'oracao_fds' : contexto.capabilityKey))) {
            registrar(semana, 'fimDeSemana');
        }
        if (contexto.capabilityKey === 'presidente_rvm' && mesmaPessoa(semana.presidente)) registrar(semana, 'meioSemana');
        if ((semana.partes || []).some(parte => ['estudante', 'ajudante', 'oracao', 'dirigente', 'leitor'].some(slotKey =>
            mesmaPessoa(parte[slotKey]) && getAssignmentCapabilityForSlot({ parte, slotKey }) === contexto.capabilityKey))) {
            registrar(semana, 'meioSemana');
        }
    }

    // Datas ausentes ou invalidas nao entram no calculo nem impedem buscar outra semana.
    const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
    return { ultimaData, diasSemFazer: ultimaData
        ? Math.round((hojeUTC - Date.parse(`${ultimaData}T12:00:00Z`)) / 86400000)
        : 9999 };
}
