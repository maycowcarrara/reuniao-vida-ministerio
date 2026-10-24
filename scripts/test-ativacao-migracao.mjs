import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepararEscritas } from './ativacao/executar-migracao.mjs';
import { prepararEnsaioMigracao, hashEnsaio } from '../src/utils/ensaioMigracaoGrupos.js';
const ownerUid = 'fixture-owner';
async function fixture() {
    const snapshot = { configuracoes: { id: 'geral', idioma: 'pt' }, historico_reunioes: [{ id: 'fixture', semana: '2-8 de novembro de 2026',
        dataReuniao: '2026-11-05', partes: [], presidente: { id: 'f', nome: 'Fictício' }, desconhecido: { preservar: true }, fimDeSemana: { ativo: false } }], alunos: [], confirmacoes: [] };
    const plano = await prepararEnsaioMigracao(snapshot);
    for (const step of plano.passos) {
        if (step.colecao === 'configuracoes') { step.after.ativacaoMultiGrupos = { status: 'preparada', contrato: 2, autorizadaEm: '2026-10-24T17:00:00Z' }; step.after.revisionProgramacoes = 0; }
        if (step.colecao === 'historico_reunioes') step.after.identidadeLegada = { versao: 1, programacaoId: 'fixture', dataMeioSemana: '2026-11-05', partes: {} };
        step.afterHash = await hashEnsaio(step.after);
    }
    const { planHash: _hash, aplicavelLocalmente: _ok, ...conteudo } = plano; plano.planHash = await hashEnsaio(conteudo);
    const backup = { projectId: 'rvm-sbssc', ownerUid, documents: [ { path: `users/${ownerUid}/configuracoes/geral`, data: snapshot.configuracoes },
        { path: `users/${ownerUid}/programacao/fixture`, data: snapshot.historico_reunioes[0] } ] };
    return { snapshot, plano, backup };
}
test('Executor: plano completo conserva conteúdo, fixa ativação e inclui quadro na mesma transação', async () => {
    const input = await fixture(), result = await prepararEscritas(input);
    assert.equal(result.writes.length, 3); assert.equal(result.config.ativacaoMultiGrupos.status, 'ativa');
    assert.equal(result.config.ativacaoMultiGrupos.planHash, input.plano.planHash);
    assert.deepEqual(result.programs[0].desconhecido, { preservar: true });
    assert.equal(result.preservados.idsAgenda, 1);
});
test('Executor: adulteração de plano, conteúdo ou alvo falha antes de qualquer gravação', async () => {
    for (const mutate of [i => i.plano.planHash = 'adulterado', i => i.plano.passos[0].after.id = 'outro', i => i.backup.projectId = 'outro', i => i.snapshot.alunos.push({ id: 'novo' })]) {
        const input = await fixture(); mutate(input); await assert.rejects(prepararEscritas(input));
    }
});
