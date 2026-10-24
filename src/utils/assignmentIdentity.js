// Chaves legadas são um contrato público: não normalizar, traduzir ou regravar.
export const buildLegacyAssignmentKey = ({ dataISO, semana, parteId, pessoaId, role }) =>
    [dataISO || '', semana || '', parteId || '', pessoaId || '', role || ''].join('|');

const fields = ['grupoId', 'programacaoId', 'tipoReuniao', 'slotId', 'pessoaId', 'papel'];
export function assignmentIdentity(src) {
    const result = { identityVersion: 2 };
    for (const key of fields) {
        const value = src[key];
        if (!['string', 'number'].includes(typeof value) || String(value) === '') throw new Error(`Identidade incompleta: ${key}.`);
        result[key] = String(value);
    }
    if (!['meioSemana', 'fimDeSemana'].includes(result.tipoReuniao)) throw new Error('Tipo de reunião inválido.');
    return result;
}
export const canonicalAssignment = src => JSON.stringify([2, ...fields.map(key => assignmentIdentity(src)[key])]);
const hex = value => Array.from(new TextEncoder().encode(value), byte => byte.toString(16).padStart(2, '0')).join('');
export function buildAssignmentKey(src) {
    if (src.identityVersion !== 2) return buildLegacyAssignmentKey(src);
    const key = `v2-${hex(canonicalAssignment(src))}`;
    if (key.length > 1400) throw new Error('Identidade excede o limite seguro do documento.');
    return key;
}
export const sameAssignment = (a, b) => canonicalAssignment(a) === canonicalAssignment(b);
export const identityFromDesignacao = item => assignmentIdentity({ ...item, pessoaId: item.pessoa?.id, papel: item.slotKey });
export const historyAssignmentKey = (entry, pessoaId) => {
    if (!(entry.grupoId || entry.programacaoId || entry.tipoReuniao || entry.slotId)) return '';
    try { return buildAssignmentKey({ ...entry, identityVersion: 2, pessoaId }); }
    catch {
        // Entradas antigas parcialmente identificadas continuam distintas das
        // entradas v1 sem escopo; não inventar os vínculos que estão ausentes.
        return `legacy-scope:${JSON.stringify([entry.grupoId || '', entry.programacaoId || '', entry.tipoReuniao || '', entry.slotId || '', entry.papel || ''])}`;
    }
};
export const parseAssignmentReference = data => {
    if (data?.identityVersion === 2) return { ...assignmentIdentity(data), role: data.papel, parteId: data.slotId, dataISO: data.dataISO, semana: data.semana };
    const [dataISO, semana, parteId, pessoaId, role] = String(data?.assignmentKey || '').split('|');
    return { dataISO, semana, parteId, pessoaId, role };
};

// Agenda identifica o slot, mantendo o ID ao substituir a pessoa designada.
// SHA-256 em hexadecimal satisfaz o alfabeto base32hex do Google.
export async function calendarEventId(src) {
    const id = assignmentIdentity(src);
    const canonical = JSON.stringify([2, id.grupoId, id.programacaoId, id.tipoReuniao, id.slotId]);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return `rvm2${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
