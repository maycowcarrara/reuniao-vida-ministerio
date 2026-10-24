import { normalizeMeetingDay, normalizeSystemConfig } from '../config/appConfig.js';

export const GRUPO_PORTUGUES_ID = 'grupo-portugues';
export const GRUPO_ESPANHOL_ID = 'grupo-espanhol';

// O principal é preferência de navegação, nunca o dono implícito dos dados antigos.
export const getGrupoLegadoId = (config = {}) => config?.grupoLegadoId || GRUPO_PORTUGUES_ID;
export const getGrupoEfetivoId = (registro, config = {}) => registro?.grupoId || getGrupoLegadoId(config);
export const isProgramacaoV2 = (programacao) =>
    programacao?.versaoProgramacao >= 2 || !!programacao?.grupoId;

// Projeção de leitura opt-in. Não conectar ao normalizador usado pelos escritores
// antigos: E2-E7 precisam estar prontas antes da ativação/persistência do modelo.
export const normalizeGruposProgramacao = (config = {}) => {
    const src = config || {};
    const geral = normalizeSystemConfig(src);
    if (geral.idioma === 'es' && !src.grupoLegadoId) {
        throw new Error('Origem legada em espanhol exige definição explícita de grupoLegadoId.');
    }
    const legadoId = getGrupoLegadoId(src);
    const defaults = {
        [GRUPO_PORTUGUES_ID]: {
            id: GRUPO_PORTUGUES_ID, ativo: true, nome: geral.nome_cong,
            idioma: 'pt', identificacao: 'Congregação',
            meioSemana: { habilitada: true, frequencia: 'semanal', dia: geral.dia_reuniao, horario: geral.horario },
            fimDeSemana: { habilitada: true, frequencia: 'semanal', dia: geral.dia_reuniao_fds, horario: geral.horario_fds },
            eventosAnuais: [],
        },
        [GRUPO_ESPANHOL_ID]: {
            id: GRUPO_ESPANHOL_ID, ativo: true, nome: 'Pré-grupo / Grupo de espanhol',
            idioma: 'es', identificacao: 'Pré-grupo / Grupo',
            meioSemana: { habilitada: false, frequencia: 'semanal', dia: null, horario: '' },
            fimDeSemana: { habilitada: true, frequencia: 'datas', dia: null, horario: '' },
            eventosAnuais: [],
        },
    };
    if (!defaults[legadoId] && !src.grupos?.[legadoId]) {
        throw new Error('grupoLegadoId sem configuração correspondente.');
    }
    const grupos = {};
    for (const id of new Set([...Object.keys(defaults), ...Object.keys(src.grupos || {})])) {
        const base = defaults[id] || {};
        const grupo = src.grupos?.[id] || {};
        const tipos = {};
        for (const tipo of ['meioSemana', 'fimDeSemana']) {
            const reuniao = { ...base[tipo], ...grupo[tipo] };
            tipos[tipo] = { ...reuniao, dia: reuniao.dia ? normalizeMeetingDay(reuniao.dia) : null };
        }
        grupos[id] = {
            ...base, ...grupo, id, ...tipos,
            eventosAnuais: Array.isArray(grupo.eventosAnuais)
                ? [...grupo.eventosAnuais]
                : id === legadoId ? [...geral.eventosAnuais] : [],
        };
    }
    return {
        ...geral, versaoProgramacao: 2, grupoLegadoId: legadoId,
        grupoPrincipalId: src.grupoPrincipalId || GRUPO_PORTUGUES_ID, grupos,
    };
};

export const getGrupoProgramacao = (grupoId, config = {}) =>
    normalizeGruposProgramacao(config).grupos[grupoId] || null;

export const getGruposParticipantes = (aluno, config = {}) => {
    if (aluno?.gruposParticipantes === undefined) return [getGrupoLegadoId(config)];
    // Campo inválido falha fechado; um array vazio é uma escolha explícita.
    if (!Array.isArray(aluno.gruposParticipantes)) return [];
    return [...new Set(aluno.gruposParticipantes.filter(id => typeof id === 'string' && id.trim()))];
};

export const normalizeParticipacaoAluno = (aluno = {}, config = {}) => ({
    ...aluno, gruposParticipantes: getGruposParticipantes(aluno, config),
});

// Novo cadastro começa em português mesmo se a interface/principal for espanhol.
export const createParticipacaoAlunoDefault = () => [GRUPO_PORTUGUES_ID];
export const participaDoGrupo = (aluno, grupoId, config = {}) =>
    getGruposParticipantes(aluno, config).includes(grupoId);
