import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import {
    getAlunoCapabilities,
    getAssignmentCapabilityForSlot,
    getAssignmentCapabilityLabel,
    getAssignmentContextForSlot,
    getLegacyCapabilitiesForTipo,
    isAlunoEligibleForAssignment,
    normalizeAssignmentCapabilities,
} from '../src/utils/assignmentEligibility.js';
import { isWhatWouldYouSayPart } from '../src/utils/meetingParts.js';
import { inferMeetingSection } from '../src/utils/meetingSections.js';

const capabilityKey = 'o_que_voce_diria';
const cargosMap = {
    anciao: { gen: 'M' }, servo: { gen: 'M' }, irmao_hab: { gen: 'M' },
    irmao: { gen: 'M' }, irma: { gen: 'F' }, irma_exp: { gen: 'F' },
    irma_lim: { gen: 'F' }, desab: { gen: 'A' },
};
const parte = { titulo: '6. O que você diria?', tipo: 'parte', secao: 'ministerio' };
const eligible = (aluno, currentPart = parte, slotKey = 'estudante') =>
    isAlunoEligibleForAssignment({ aluno, parte: currentPart, slotKey, cargosMap });

for (const titulo of [
    '6. O que você diria?', 'O que voce diria?', '6. ¿Qué dirías?',
    '¿Qué diría?', 'QUE DIRIAS?',
]) {
    test(`recognizes heading without relying on language/section: ${titulo}`, () => {
        const imported = { titulo, tipo: 'parte' };
        assert.equal(isWhatWouldYouSayPart(imported), true);
        assert.equal(inferMeetingSection({ text: titulo }), 'ministerio');
        assert.equal(getAssignmentCapabilityForSlot({ parte: imported, slotKey: 'estudante' }), capabilityKey);
    });
}

test('recognizes explicit type and keeps questions in descriptions out of classification', () => {
    assert.equal(isWhatWouldYouSayPart({ type: capabilityKey }), true);
    const conversation = { titulo: '4. Iniciando conversas', descricao: 'O que você diria?', secao: 'ministerio' };
    assert.equal(isWhatWouldYouSayPart(conversation), false);
    assert.equal(getAssignmentCapabilityForSlot({ parte: conversation, slotKey: 'estudante' }), 'ministerio');
});

for (const tipo of ['anciao', 'servo']) {
    test(`${tipo} requires explicit opt-in, including legacy students`, () => {
        assert.equal(getLegacyCapabilitiesForTipo(tipo).includes(capabilityKey), false);
        assert.equal(getAlunoCapabilities({ tipo }).includes(capabilityKey), false);
        assert.equal(eligible({ tipo }).eligible, false);
        assert.equal(eligible({ tipo, partesHabilitadas: ['ministerio', 'discurso'] }).eligible, false);
        assert.equal(eligible({ tipo, partesHabilitadas: [capabilityKey] }).eligible, true);
        assert.equal(eligible({ tipo, partesHabilitadas: [capabilityKey] }, parte, 'ajudante').eligible, false);
    });
}

for (const tipo of ['irmao_hab', 'irmao', 'irma', 'irma_exp', 'irma_lim', 'desab']) {
    test(`${tipo} is excluded even if the capability was stored/imported`, () => {
        assert.equal(eligible({ tipo, partesHabilitadas: [capabilityKey, 'discurso', 'ministerio'] }).eligible, false);
    });
}

test('capability round-trips and has Portuguese and Spanish labels for selection', () => {
    assert.deepEqual(normalizeAssignmentCapabilities([capabilityKey, capabilityKey, 'invalid']), [capabilityKey]);
    const restored = JSON.parse(JSON.stringify({ tipo: 'servo', partesHabilitadas: [capabilityKey] }));
    assert.equal(eligible(restored).eligible, true);
    assert.match(getAssignmentCapabilityLabel(capabilityKey, 'pt'), /O que você diria/);
    assert.match(getAssignmentCapabilityLabel(capabilityKey, 'es'), /¿Qué dirías/);
    assert.equal(getAssignmentContextForSlot({ parte, slotKey: 'estudante' }).labelKey, capabilityKey);
});

test('ordinary ministry assignments and talks retain their existing eligibility', () => {
    assert.equal(eligible({ tipo: 'irma' }, { titulo: 'Iniciando conversas', secao: 'ministerio' }).eligible, true);
    assert.equal(eligible({ tipo: 'irmao_hab' }, { titulo: 'Discurso', secao: 'ministerio' }).eligible, true);
    assert.equal(eligible({ tipo: 'servo', partesHabilitadas: [capabilityKey] }, { titulo: 'Discurso', secao: 'ministerio' }).eligible, false);
});

// Vite resolves the importer's existing extensionless imports, as in the application.
const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
});
after(() => server.close());
const { extrairDados } = await server.ssrLoadModule('/src/utils/importador/parser.js');

for (const [lang, heading, section, description] of [
    ['pt', '6. O que você diria?', 'FAÇA SEU MELHOR NO MINISTÉRIO', 'Consideração. DE CASA EM CASA.'],
    ['es', '6. ¿Qué dirías?', 'SEAMOS MEJORES MAESTROS', 'Análisis con el auditorio. DE CASA EN CASA.'],
    ['es', '6. ¿Qué diría?', 'SEAMOS MEJORES MAESTROS', 'Análisis con el auditorio. DE CASA EN CASA.'],
]) {
    for (const source of ['texto', 'html']) {
        test(`import ${source}: ${heading}`, async () => {
            const lines = [section, heading, `(6 min) ${description}`];
            const content = source === 'html'
                ? `<html><body><main><h2>${section}</h2><h3>${heading}</h3><p>${lines[2]}</p></main></body></html>`
                : lines.join('\n');
            const data = await extrairDados(content, source, lang);
            assert.ok(data);
            const importedPart = data.partes.find(isWhatWouldYouSayPart);
            assert.ok(importedPart);
            assert.equal(importedPart.secao, 'ministerio');
            assert.equal(importedPart.tempo, '6');
            assert.equal(eligible({ tipo: 'servo', partesHabilitadas: [capabilityKey] }, importedPart).eligible, true);
            assert.equal(eligible({ tipo: 'servo', partesHabilitadas: ['ministerio', 'discurso'] }, importedPart).eligible, false);
        });
    }
}
