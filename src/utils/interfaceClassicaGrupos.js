import { getProgramacaoWeekStartISO } from './programacoes.js';
import { validarDataReuniao, validarHorarioReuniao } from './agendamentoReunioes.js';
import { getGrupoEfetivoId } from './gruposProgramacao.js';
import { listarSlotsReuniao, avaliarElegibilidadeGrupo } from './designacoesPorGrupo.js';
import { normalizeOcorrenciaReuniao, TIPOS_REUNIAO } from './ocorrenciasReuniao.js';
import { criarFilaGrupo, legacyKeyFromDesignacao } from './integracoesGrupo.js';
import { buildLegacyAssignmentKey } from './assignmentIdentity.js';

// A interface existente continua editando uma lista do grupo; a persistência
// valida somente seus deltas e conserva a fonte completa dos demais grupos.
export function prepararEdicaoClassica({ anteriores, proximas, config, grupoId, alunos, cargosMap }) {
    return proximas.map(next => {
        if (getGrupoEfetivoId(next, config) !== grupoId) throw new Error('Programação pertence a outro grupo.');
        const old = anteriores.find(p => String(p.id) === String(next.id));
        if (!old) throw new Error('Crie a reunião pelo agendamento antes de editá-la.');
        const result = { ...next };
        if (old.publicadaNoQuadro !== next.publicadaNoQuadro) for (const tipo of TIPOS_REUNIAO) {
            if (next[tipo]) result[tipo] = { ...next[tipo], publicadaNoQuadro: next.publicadaNoQuadro === true };
        }
        for (const tipo of TIPOS_REUNIAO) {
            const atual = old[tipo] || {}, bloco = result[tipo] || {};
            if (atual.cancelada && (!bloco.cancelada || bloco.ativo !== atual.ativo)) throw new Error('Ocorrência cancelada deve ser preservada.');
            if (bloco.ativo && (bloco.ativo !== atual.ativo || bloco.data !== atual.data || bloco.horario !== atual.horario)) {
                if (!config.grupos[grupoId]?.ativo || !config.grupos[grupoId]?.[tipo]?.habilitada || bloco.cancelada) throw new Error('Tipo de reunião indisponível.');
                validarDataReuniao(bloco.data); validarHorarioReuniao(bloco.horario);
                if (getProgramacaoWeekStartISO({ dataInicio: bloco.data }) !== getProgramacaoWeekStartISO(old)) throw new Error('A data deve pertencer à semana desta programação.');
            }
            const before = new Map(listarSlotsReuniao(old, tipo).map(s => [s.slotId, s]));
            const after = new Map(listarSlotsReuniao(result, tipo).map(s => [s.slotId, s]));
            for (const id of new Set([...before.keys(), ...after.keys()])) {
                const previous = before.get(id), slot = after.get(id);
                const personId = String(slot?.pessoa?.id || '');
                if (personId === String(previous?.pessoa?.id || '')) continue;
                if (!normalizeOcorrenciaReuniao(result, tipo, config).operacional || result.arquivada) throw new Error('Reunião indisponível para alterar designações.');
                if (!personId) continue;
                const aluno = alunos.find(a => String(a.id) === personId);
                if (!aluno) throw new Error('Pessoa não encontrada no cadastro atual.');
                const eligibility = avaliarElegibilidadeGrupo({ aluno, alunos, programacao: result, tipo, slot, grupoId, config, cargosMap });
                if (!eligibility.eligible) throw new Error(eligibility.reason);
            }
        }
        return result;
    });
}

export function criarReferenciasInterfaceClassica({ programacoes, config, grupoId, confirmacoes }) {
    const fila = criarFilaGrupo({ programacoes, config, grupoId, confirmacoes });
    const porChave = new Map(fila.map(row => [row.assignmentKey, row]));
    const porLegada = new Map(fila.map(row => [legacyKeyFromDesignacao(row.item, config), row]));
    const buildKey = input => {
        const legacyKey = buildLegacyAssignmentKey(input);
        return porLegada.get(legacyKey)?.assignmentKey || legacyKey;
    };
    return { buildKey, porChave };
}

// Recorte exclusivamente de leitura: dados cancelados/desabilitados permanecem
// na fonte privada. Contatos usados no envio vêm do cadastro atual.
export function projetarProgramaOperacionalInterface(programa, config, alunos = []) {
    if (!config?.grupoSelecionadoId) return programa;
    const meio = normalizeOcorrenciaReuniao(programa, 'meioSemana', config).operacional;
    const fim = normalizeOcorrenciaReuniao(programa, 'fimDeSemana', config).operacional;
    const pessoa = p => p ? { ...p, ...(alunos.find(a => String(a.id) === String(p.id)) || {}) } : p;
    const apoios = src => Object.fromEntries(Object.entries(src || {}).map(([key, values]) => [key, Array.isArray(values) ? values.map(pessoa) : values]));
    return { ...programa,
        meioSemana: { ...programa.meioSemana, ativo: meio },
        partes: meio ? (programa.partes || []).map(p => ({ ...p, ...Object.fromEntries(['estudante', 'ajudante', 'dirigente', 'leitor', 'oracao'].filter(k => p[k]).map(k => [k, pessoa(p[k])])) })) : [],
        presidente: meio ? pessoa(programa.presidente) : null, leitor: meio ? pessoa(programa.leitor) : null,
        responsabilidades: meio ? apoios(programa.responsabilidades) : {},
        fimDeSemana: { ...programa.fimDeSemana, ativo: fim,
            presidente: pessoa(programa.fimDeSemana?.presidente), oracaoFinal: pessoa(programa.fimDeSemana?.oracaoFinal),
            estudoSentinela: { ...programa.fimDeSemana?.estudoSentinela, dirigente: pessoa(programa.fimDeSemana?.estudoSentinela?.dirigente), leitor: pessoa(programa.fimDeSemana?.estudoSentinela?.leitor) },
            responsabilidades: apoios(programa.fimDeSemana?.responsabilidades) }
    };
}

export function avaliarSlotClassico({ aluno, alunos, programacao, targetSlot, config, cargosMap }) {
    const tipo = targetSlot.fds ? 'fimDeSemana' : 'meioSemana';
    const slot = listarSlotsReuniao(programacao, tipo).find(s => {
        if (targetSlot.responsabilidadeKey) return s.apoio && s.path.at(-2) === targetSlot.responsabilidadeKey && Number(s.path.at(-1)) === Number(targetSlot.itemIndex);
        if (targetSlot.parteId != null) return String(s.parte?.id) === String(targetSlot.parteId) && s.slotKey === targetSlot.key;
        return !s.parte && !s.apoio && s.slotKey === targetSlot.key;
    });
    if (!slot) return { eligible: false, reason: 'Destino de designação não encontrado.' };
    return avaliarElegibilidadeGrupo({ aluno, alunos, programacao, tipo, slot, grupoId: config.grupoSelecionadoId, config, cargosMap });
}
