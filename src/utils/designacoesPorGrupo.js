import { getGrupoEfetivoId, getGrupoProgramacao, getGrupoLegadoId, participaDoGrupo } from './gruposProgramacao.js';
import { normalizeOcorrenciaReuniao, TIPOS_REUNIAO } from './ocorrenciasReuniao.js';
import { getProgramacaoWeekStartISO, createProgramacaoId } from './programacoes.js';
import { getAssignmentCapabilityForSlot, isAlunoEligibleForAssignment } from './assignmentEligibility.js';
import { isBibleStudyPart, isPrayerPart, isSongOnlyPart, isWhatWouldYouSayPart } from './meetingParts.js';
import { MEIO_SEMANA_RESPONSABILIDADES } from './fimDeSemana.js';
import { addHistorico } from './revisarEnviar/historico.js';
import { identityFromDesignacao, buildAssignmentKey } from './assignmentIdentity.js';
import { getCelebracao, slotsCelebracao, tipoReuniaoCelebracao } from './celebracao.js';

const idPessoa = pessoa => pessoa?.id == null ? '' : String(pessoa.id);
const bucket = { presidente_rvm: 'presidente', discurso_inicial: 'tesouros', joias_espirituais: 'joias',
    leitura_biblia: 'leitura', vida_crista: 'vidacrista', estudo_biblico_congregacao: 'estudobiblico', leitor_ebc: 'leitor' };
const getPath = (obj, path) => path.reduce((value, key) => value?.[key], obj);

// Identifica o slot dentro da reunião. A identidade completa de designação é
// serializada exclusivamente por assignmentIdentity.js.
export const listarSlotsReuniao = (programacao, tipo, { incluirVagos = true, config = {} } = {}) => {
    const celebracao = getCelebracao(programacao, config);
    if (celebracao?.tipoReuniao === tipo) return slotsCelebracao(programacao, incluirVagos, celebracao.data);
    const slots = [];
    const add = (path, slotKey, parte = null, extra = {}) => {
        const pessoa = getPath(programacao, path);
        if (!incluirVagos && !idPessoa(pessoa)) return;
        slots.push({ slotId: JSON.stringify(parte?.id != null ? ['parte', String(parte.id), slotKey] : path), path, slotKey, parte, pessoa, ...extra });
    };
    if (tipo === 'meioSemana') {
        add(['presidente'], 'presidente');
        (programacao.partes || []).forEach((parte, index) => {
            const base = ['partes', index];
            if (isSongOnlyPart(parte)) return;
            if (isPrayerPart(parte)) add([...base, 'oracao'], 'oracao', parte);
            else if (isBibleStudyPart(parte)) {
                add([...base, 'dirigente'], 'dirigente', parte);
                add(parte.leitor || !programacao.leitor ? [...base, 'leitor'] : ['leitor'], 'leitor', parte);
            } else {
                add([...base, 'estudante'], 'estudante', parte);
                if (getAssignmentCapabilityForSlot({ parte, slotKey: 'estudante' }) === 'ministerio' && !isWhatWouldYouSayPart(parte)) add([...base, 'ajudante'], 'ajudante', parte);
            }
            // Dados antigos fora do formato atual continuam visíveis para revisão
            // e remoção, inclusive ajudante indevido em "O que você diria?".
            for (const papel of ['estudante', 'ajudante', 'dirigente', 'leitor', 'oracao']) {
                const slotId = JSON.stringify(['parte', String(parte.id), papel]);
                if (parte[papel] && !slots.some(item => item.slotId === slotId)) add([...base, papel], papel, parte);
            }
        });
    } else if (tipo === 'fimDeSemana') {
        add(['fimDeSemana', 'presidente'], 'presidente_fds');
        add(['fimDeSemana', 'oracaoFinal'], 'oracao_fds');
        add(['fimDeSemana', 'estudoSentinela', 'dirigente'], 'dirigente_sentinela');
        add(['fimDeSemana', 'estudoSentinela', 'leitor'], 'leitor_sentinela');
    } else throw new Error('Tipo de reunião inválido.');
    MEIO_SEMANA_RESPONSABILIDADES.forEach(({ storageKey, slotKey }) => {
        const path = tipo === 'fimDeSemana' ? ['fimDeSemana', 'responsabilidades', storageKey] : ['responsabilidades', storageKey];
        const pessoas = getPath(programacao, path) || [];
        for (let index = 0; index < pessoas.length + (incluirVagos ? 1 : 0); index++) add([...path, index], slotKey, null, { apoio: true });
    });
    return slots;
};

export const selecionarDesignacoes = ({ programacoes = [], config, apenasOperacionais = true, incluirArquivadas = false }) => programacoes.flatMap(programacao =>
    TIPOS_REUNIAO.flatMap(tipo => {
        const reuniao = normalizeOcorrenciaReuniao(programacao, tipo, config);
        if (apenasOperacionais && (!reuniao.operacional || (programacao.arquivada && !incluirArquivadas))) return [];
        return listarSlotsReuniao(programacao, tipo, { incluirVagos: false, config }).map(slot => ({ ...slot,
            programacao, programacaoId: createProgramacaoId(programacao), grupoId: getGrupoEfetivoId(programacao, config), tipoReuniao: tipo, reuniao }));
    }));

export const avaliarElegibilidadeGrupo = ({ aluno, alunos = [], programacao, tipo, slot, grupoId, config, cargosMap = {}, lang = 'pt' }) => {
    const es = lang === 'es';
    const recusar = (pt, espanhol) => ({ eligible: false, reason: es ? espanhol : pt });
    if (!programacao || getGrupoEfetivoId(programacao, config) !== grupoId) return recusar('Destino de outro grupo.', 'Destino de otro grupo.');
    const reuniao = normalizeOcorrenciaReuniao(programacao, tipo, config);
    if (!reuniao.operacional || programacao.arquivada) return recusar('Reunião inativa, cancelada ou bloqueada por evento.', 'Reunión inactiva, cancelada o bloqueada por evento.');
    if (reuniao.celebracao && !listarSlotsReuniao(programacao, tipo, { config }).some(s => s.slotId === slot?.slotId)) return recusar('A celebração substitui esta designação.', 'La Conmemoración sustituye esta asignación.');
    if (!participaDoGrupo(aluno, grupoId, config)) return recusar('Pessoa não participa deste grupo.', 'La persona no participa en este grupo.');
    if (!slot || !getAssignmentCapabilityForSlot({ parte: slot.parte, slotKey: slot.slotKey })) return recusar('Slot sem habilitação reconhecida.', 'Asignación sin habilitación reconocida.');
    const estudante = alunos.find(item => idPessoa(item) === idPessoa(slot.parte?.estudante)) || slot.parte?.estudante;
    if (slot.slotKey === 'ajudante' && estudante && !estudante.tipo) return recusar('Revise o cadastro do estudante antes de escolher o ajudante.', 'Revisa el registro del estudiante antes de elegir ayudante.');
    const eligibility = isAlunoEligibleForAssignment({ aluno, parte: slot.parte, slotKey: slot.slotKey, cargosMap, lang, assignedStudent: estudante });
    if (!eligibility.eligible) return eligibility;
    const ajudante = alunos.find(item => idPessoa(item) === idPessoa(slot.parte?.ajudante));
    if (slot.slotKey === 'estudante' && ajudante && cargosMap?.[ajudante.tipo]?.gen !== cargosMap?.[aluno.tipo]?.gen) return recusar('Gênero incompatível com o ajudante existente; revise a dupla.', 'Género incompatible con el ayudante existente; revisa la pareja.');
    if (!reuniao.data) return recusar('Defina a data antes de designar.', 'Define la fecha antes de asignar.');
    if ((aluno.datasIndisponiveis || []).some(range => range.inicio && range.fim && String(range.inicio).slice(0, 10) <= reuniao.data && reuniao.data <= String(range.fim).slice(0, 10))) return recusar('Pessoa indisponível nesta data.', 'Persona no disponible en esta fecha.');
    return eligibility;
};

const minutos = horario => /^([01]\d|2[0-3]):[0-5]\d$/.test(horario || '') ? Number(horario.slice(0, 2)) * 60 + Number(horario.slice(3)) : null;
// Só declara sobreposição quando há duração explícita em ambas as reuniões.
// Duração de uma parte não é a duração da reunião inteira.
export const avaliarConflitosGrupo = ({ programacoes, config, programacao, tipo, slotId, alunoId }) => {
    const destino = normalizeOcorrenciaReuniao(programacao, tipo, config);
    const semana = getProgramacaoWeekStartISO(programacao);
    return selecionarDesignacoes({ programacoes, config }).filter(item => {
        if (idPessoa(item.pessoa) !== String(alunoId)) return false;
        if (item.programacaoId === createProgramacaoId(programacao) && item.tipoReuniao === tipo && item.slotId === slotId) return false;
        return true;
    }).map(item => {
        const mesmaReuniao = item.programacaoId === createProgramacaoId(programacao) && item.tipoReuniao === tipo;
        const inicio = minutos(destino.horario), outroInicio = minutos(item.reuniao.horario);
        const duracao = Number(destino.duracaoMinutos), outraDuracao = Number(item.reuniao.duracaoMinutos);
        const temIntervalos = inicio !== null && outroInicio !== null && duracao > 0 && outraDuracao > 0;
        const mesmaData = destino.data === item.reuniao.data;
        const inicioAbsoluto = Date.parse(`${destino.data}T00:00:00Z`) / 60000 + inicio;
        const outroAbsoluto = Date.parse(`${item.reuniao.data}T00:00:00Z`) / 60000 + outroInicio;
        const sobreposicao = !mesmaReuniao && temIntervalos && inicioAbsoluto < outroAbsoluto + outraDuracao && outroAbsoluto < inicioAbsoluto + duracao;
        if (!sobreposicao && getProgramacaoWeekStartISO(item.programacao) !== semana) return null;
        const principalIncompativel = mesmaReuniao && tipo === 'fimDeSemana' && !item.apoio && !listarSlotsReuniao(programacao, tipo, { config }).find(s => s.slotId === slotId)?.apoio;
        return { ...item, principalIncompativel, nivel: sobreposicao ? 'bloqueio'
            : !mesmaReuniao && mesmaData && !temIntervalos ? 'possivel' : 'aviso' };
    }).filter(Boolean);
};

export const prepararAtribuicaoGrupo = ({ programacoes = [], alunos = [], config, grupoId, programacaoId, tipo, slotId, alunoId = null, cargosMap, lang, confirmarAvisos = false, pessoaAnteriorId }) => {
    const programacao = programacoes.find(item => createProgramacaoId(item) === programacaoId && getGrupoEfetivoId(item, config) === grupoId);
    const reuniao = normalizeOcorrenciaReuniao(programacao, tipo, config);
    if (!programacao || !reuniao.operacional || programacao.arquivada) throw new Error('Reunião indisponível.');
    const slots = listarSlotsReuniao(programacao, tipo, { config }).filter(item => item.slotId === slotId);
    const slot = slots[0];
    if (slots.length !== 1) throw new Error('Slot inválido ou alterado.');
    if (pessoaAnteriorId !== undefined && idPessoa(slot.pessoa) !== String(pessoaAnteriorId)) throw new Error('Designação mudou desde a seleção; revise o slot.');
    const aluno = alunoId == null ? null : alunos.find(item => idPessoa(item) === String(alunoId));
    if (alunoId != null) {
        const eligibility = avaliarElegibilidadeGrupo({ aluno, alunos, programacao, tipo, slot, grupoId, config, cargosMap, lang });
        if (!aluno || !eligibility.eligible) throw new Error(eligibility.reason || 'Pessoa não encontrada.');
        const conflitos = avaliarConflitosGrupo({ programacoes, config, programacao, tipo, slotId, alunoId });
        if (conflitos.some(item => item.nivel === 'bloqueio')) throw new Error('Conflito de designações incompatíveis ou sobreposição confirmada.');
        if (conflitos.length && !confirmarAvisos) throw new Error('Revise e confirme os avisos de carga/conflito.');
    }
    if (idPessoa(slot.pessoa) === idPessoa(aluno)) return { operacoes: [] };
    const proxima = structuredClone(programacao);
    let pai = proxima;
    slot.path.slice(0, -1).forEach((key, index) => { pai[key] ??= typeof slot.path[index + 1] === 'number' ? [] : {}; pai = pai[key]; });
    const key = slot.path.at(-1);
    const valor = aluno ? { id: aluno.id, nome: aluno.nome } : null;
    if (Array.isArray(pai) && !aluno) pai.splice(key, 1); else pai[key] = valor;
    const substituicoes = slot.pessoa ? [...(programacao.substituicoes || []), { grupoId, programacaoId, tipoReuniao: tipo, slotId,
        de: { id: slot.pessoa.id, nome: slot.pessoa.nome }, para: valor, origem: 'ensaio-local', criadoEm: new Date().toISOString() }] : programacao.substituicoes;
    const alteracoes = slot.celebracao ? { celebracao: proxima.celebracao } : tipo === 'fimDeSemana' ? { fimDeSemana: proxima.fimDeSemana } : slot.path[0] === 'partes' ? { partes: proxima.partes } : { [slot.path[0]]: proxima[slot.path[0]] };
    return { operacoes: [{ tipo: 'patch', programacaoId, alteracoes: { ...alteracoes,
        ...(substituicoes ? { substituicoes } : {}), historicoPendenteSync: true } }] };
};

export const classificarCandidatosGrupo = ({ alunos = [], programacoes, config, grupoId, programacao, tipo, slot, cargosMap, lang }) => {
    const designacoes = selecionarDesignacoes({ programacoes, config });
    const anteriores = selecionarDesignacoes({ programacoes, config, incluirArquivadas: true });
    const capability = getAssignmentCapabilityForSlot({ parte: slot.parte, slotKey: slot.slotKey });
    return alunos.filter(aluno => avaliarElegibilidadeGrupo({ aluno, alunos, programacao, tipo, slot, grupoId, config, cargosMap, lang }).eligible).map(aluno => {
        const minhas = designacoes.filter(item => idPessoa(item.pessoa) === idPessoa(aluno));
        const mesmaSemana = minhas.filter(item => getProgramacaoWeekStartISO(item.programacao) === getProgramacaoWeekStartISO(programacao));
        const historicoGrupo = (aluno.historico || []).filter(item => (item.grupoId || getGrupoLegadoId(config)) === grupoId && item.parte === (bucket[capability] || capability));
        const datas = [...historicoGrupo.map(item => item.data), ...anteriores.filter(item => idPessoa(item.pessoa) === idPessoa(aluno) && item.grupoId === grupoId && getAssignmentCapabilityForSlot({ parte: item.parte, slotKey: item.slotKey }) === capability).map(item => item.reuniao.data)]
            .filter(data => data && data < normalizeOcorrenciaReuniao(programacao, tipo, config).data).sort();
        const familias = designacoes.some(item => getProgramacaoWeekStartISO(item.programacao) === getProgramacaoWeekStartISO(programacao)
            && idPessoa(item.pessoa) !== idPessoa(aluno) && String(alunos.find(pessoa => idPessoa(pessoa) === idPessoa(item.pessoa))?.familia || '').trim().toLowerCase() === String(aluno.familia || '').trim().toLowerCase() && aluno.familia);
        return { aluno, ultimaData: datas.at(-1) || '', cargaTotal: minhas.length, cargaSemana: mesmaSemana.length, familiaOcupada: !!familias,
            conflitos: avaliarConflitosGrupo({ programacoes, config, programacao, tipo, slotId: slot.slotId, alunoId: aluno.id }) };
    }).filter(item => !item.conflitos.some(conflito => conflito.nivel === 'bloqueio'))
        .sort((a, b) => a.cargaSemana - b.cargaSemana || Number(a.familiaOcupada) - Number(b.familiaOcupada)
            || (a.ultimaData && b.ultimaData ? a.ultimaData.localeCompare(b.ultimaData) : a.ultimaData ? -1 : b.ultimaData ? 1 : 0) || a.aluno.nome.localeCompare(b.aluno.nome));
};

export const reconstruirHistoricoGrupo = ({ alunos = [], programacoes = [], config, grupoId, programacaoIds, tipos }) => {
    if (!getGrupoProgramacao(grupoId, config) || !programacaoIds?.length || !tipos?.length || tipos.some(tipo => !TIPOS_REUNIAO.includes(tipo))) throw new Error('Selecione grupo, programações e tipos.');
    const selecionadas = programacoes.filter(item => programacaoIds.includes(createProgramacaoId(item)) && getGrupoEfetivoId(item, config) === grupoId);
    if (new Set(programacaoIds).size !== selecionadas.length) throw new Error('Programação fora do grupo ou inexistente.');
    const alvos = new Set(selecionadas.flatMap(item => tipos.filter(tipo => normalizeOcorrenciaReuniao(item, tipo, config).operacional && !item.arquivada)
        .map(tipo => JSON.stringify([createProgramacaoId(item), tipo]))));
    // Ausência de IDs de escopo em histórico antigo é ambígua: preserva, nunca
    // presume que todo registro da mesma data pertence à seleção.
    let next = alunos.map(aluno => ({ ...aluno, historico: (aluno.historico || []).filter(h => {
        const noEscopo = (h.grupoId || getGrupoLegadoId(config)) === grupoId && h.programacaoId
            && alvos.has(JSON.stringify([String(h.programacaoId), h.tipoReuniao]));
        return !noEscopo;
    }) }));
    selecionarDesignacoes({ programacoes: selecionadas, config }).filter(item => tipos.includes(item.tipoReuniao)).forEach(item => {
        const capability = getAssignmentCapabilityForSlot({ parte: item.parte, slotKey: item.slotKey });
        const parte = item.slotKey === 'ajudante' ? 'ajudante' : item.slotKey === 'oracao_fds' ? 'oracao_fds' : bucket[capability] || capability;
        if (!parte || !item.reuniao.data) return;
        const identity = identityFromDesignacao(item);
        next = addHistorico(next, item.pessoa.id, { ...identity, assignmentKey: buildAssignmentKey(identity), grupoId, programacaoId: item.programacaoId, tipoReuniao: item.tipoReuniao,
            slotId: item.slotId, papel: item.slotKey, data: item.reuniao.data, parte,
            ajudante: item.slotKey === 'ajudante' ? item.parte?.estudante?.nome || '' : item.parte?.ajudante?.nome || '' });
    });
    return next;
};

export const prepararEventoGrupo = ({ config, grupoId, data, tipo }) => {
    const grupo = getGrupoProgramacao(grupoId, config);
    if (!grupo?.ativo || !['normal', 'visita', 'assembleia', 'assembleia_betel', 'assembleia_circuito', 'congresso', 'celebracao'].includes(tipo)) throw new Error('Evento ou grupo inválido.');
    if (!tipoReuniaoCelebracao(data)) throw new Error('Data inválida.');
    const semana = getProgramacaoWeekStartISO({ dataInicio: data });
    const eventosAnuais = grupo.eventosAnuais.filter(item => item.dataInicio !== semana);
    if (tipo !== 'normal') eventosAnuais.push({ dataInicio: semana, dataInput: data, tipo });
    return { ...config, grupos: { ...config.grupos, [grupoId]: { ...grupo, eventosAnuais } },
        ...(grupoId === getGrupoLegadoId(config) ? { eventosAnuais } : {}) };
};
