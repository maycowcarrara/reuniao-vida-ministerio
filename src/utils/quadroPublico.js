import { normalizeGruposProgramacao, getGrupoEfetivoId } from './gruposProgramacao.js';
import { getReunioesAtivas } from './ocorrenciasReuniao.js';
import { selecionarDesignacoes } from './designacoesPorGrupo.js';
import { identityFromDesignacao, buildAssignmentKey } from './assignmentIdentity.js';

const pick = (src, keys) => Object.fromEntries(keys.filter(key => src?.[key] !== undefined && ['string', 'number', 'boolean'].includes(typeof src[key])).map(key => [key, src[key]]));
const pessoa = src => src ? pick(src, ['id', 'nome']) : null;
const responsabilidades = src => Object.fromEntries(['videoZoomSom', 'indicadoresEntrada', 'indicadoresAuditorio', 'microfonesVolantes']
    .map(key => [key, (src?.[key] || []).map(pessoa)]));
const partes = src => (src || []).map(parte => ({ ...pick(parte, ['id', 'titulo', 'descricao', 'secao', 'tempo', 'tipo', 'numero']),
    ...Object.fromEntries(['estudante', 'ajudante', 'dirigente', 'leitor', 'oracao'].map(key => [key, pessoa(parte[key])])) }));

// Documento inteiro, incluindo envelope. Margem para overhead de armazenamento
// do Firestore (1 MiB); nunca truncar um grupo para caber.
export const LIMITE_QUADRO_BYTES = 900_000;
export const medirPayloadPublico = payload => new TextEncoder().encode(JSON.stringify(payload)).byteLength;
export function projetarQuadroPublico({ configuracoes = {}, historico_reunioes = [], ownerUid = '', updatedAtIso = new Date().toISOString() }, limite = LIMITE_QUADRO_BYTES) {
    const config = normalizeGruposProgramacao(configuracoes);
    const grupos = Object.fromEntries(Object.values(config.grupos).map(grupo => [grupo.id, {
        ...pick(grupo, ['id', 'nome', 'idioma', 'identificacao', 'ativo']),
        ...Object.fromEntries(['meioSemana', 'fimDeSemana'].map(tipo => [tipo, pick(grupo[tipo], ['habilitada', 'dia', 'horario'])])),
        eventosAnuais: grupo.eventosAnuais.map(evento => pick(evento, ['dataInicio', 'dataInput', 'tipo'])),
    }]));
    const programas = historico_reunioes.flatMap(programa => {
        const reunioes = getReunioesAtivas(programa, config, { apenasPublicas: true });
        if (!reunioes.length) return [];
        const meio = reunioes.find(item => item.tipoReuniao === 'meioSemana');
        const fim = reunioes.find(item => item.tipoReuniao === 'fimDeSemana');
        const fds = programa.fimDeSemana;
        return [{ ...pick(programa, ['id', 'semana', 'dataInicio', 'dataReuniao', 'dataExata', 'data', 'evento', 'tipo', 'dataEventoEspecial']),
            grupoId: getGrupoEfetivoId(programa, config), versaoProgramacao: 2, publicadaNoQuadro: true,
            meioSemana: meio ? { ativo: true, data: meio.data, horario: meio.horario } : { ativo: false },
            partes: meio ? partes(programa.partes) : [],
            presidente: meio ? pessoa(programa.presidente) : null, leitor: meio ? pessoa(programa.leitor) : null,
            responsabilidades: meio ? responsabilidades(programa.responsabilidades) : {},
            fimDeSemana: fim ? { ativo: true, data: fim.data, horario: fim.horario,
                presidente: pessoa(fds.presidente), oracaoFinal: pessoa(fds.oracaoFinal),
                reuniaoPublica: pick(fds.reuniaoPublica, ['temaDiscurso', 'oradorNomeManual', 'congregacaoOrador']),
                estudoSentinela: { dirigente: pessoa(fds.estudoSentinela?.dirigente), leitor: pessoa(fds.estudoSentinela?.leitor) },
                visitaSuperintendente: pick(fds.visitaSuperintendente, ['discursoFinal']), responsabilidades: responsabilidades(fds.responsabilidades),
            } : { ativo: false },
        }];
    });
    // Índice público mínimo para as Rules verificarem um alvo v2 sem abrir
    // leitura da programação/alunos privados nem buscar por data ou título.
    const destinosConfirmacao = {};
    for (const item of selecionarDesignacoes({ programacoes: historico_reunioes, config })) {
        if (!item.reuniao.publica) continue;
        const identity = identityFromDesignacao(item);
        destinosConfirmacao[buildAssignmentKey(identity)] = identity;
    }
    const payload = { ownerUid, updatedAtIso, configuracoes: {
        ...pick(config, ['nome_cong', 'idioma', 'dia_reuniao', 'horario', 'dia_reuniao_fds', 'horario_fds', 'grupoLegadoId', 'grupoPrincipalId']),
        versaoProgramacao: 2, publicacaoContrato: 2, revisionProgramacoes: config.revisionProgramacoes || 0, grupos, destinosConfirmacao,
    }, historico_reunioes: programas };
    const bytes = medirPayloadPublico(payload);
    if (bytes > limite) throw new Error(`Quadro completo excede o limite: ${bytes} de ${limite} bytes. Nenhum grupo foi publicado.`);
    return payload;
}

export const gruposPublicadosDisponiveis = (programacoes, config) => {
    const normal = normalizeGruposProgramacao(config);
    return Object.fromEntries(Object.values(normal.grupos).filter(grupo => grupo.ativo && programacoes.some(programa =>
        getGrupoEfetivoId(programa, normal) === grupo.id && getReunioesAtivas(programa, normal, { apenasPublicas: true }).length))
        .map(grupo => [grupo.id, grupo]));
};
