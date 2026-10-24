import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDadosEnsaioReunioes } from '../src/data/ensaioGrupos.js';
import { prepararEnsaioMigracao, executarEnsaioMigracao, resumirEnsaio, verificarPreparacaoAtivacao } from '../src/utils/ensaioMigracaoGrupos.js';

const args = process.argv.slice(2);
if (args.length % 2 || args.some((arg, i) => i % 2 === 0 && (!['--input', '--output'].includes(arg) || args.indexOf(arg) !== i))) throw new Error('Uso: node scripts/ensaio-multi-idiomas-e7.mjs [--input export-local.json] [--output relatorio.json]');
const input = args.includes('--input') ? args[args.indexOf('--input') + 1] : '';
const output = args.includes('--output') ? args[args.indexOf('--output') + 1] : 'tmp/e7-ensaio.json';
if (input && await fs.realpath(input) === await fs.realpath(output).catch(() => resolve(output))) throw new Error('Relatório não pode substituir a exportação de entrada.');
const snapshot = input ? JSON.parse(await fs.readFile(input, 'utf8')) : createDadosEnsaioReunioes();
if (!snapshot.configuracoes || !Array.isArray(snapshot.alunos) || !Array.isArray(snapshot.historico_reunioes)) throw new Error('Formato de exportação local inválido.');
const plano = await prepararEnsaioMigracao(snapshot);
const primeira = plano.aplicavelLocalmente ? await executarEnsaioMigracao({ snapshot, plano, pararDepois: 1 }) : null;
const resultado = primeira ? await executarEnsaioMigracao({ snapshot: primeira.estado, plano, checkpoint: primeira.checkpoint }) : null;
const repeticao = resultado ? await prepararEnsaioMigracao(resultado.estado) : null;
const relatorio = { origem: input ? 'arquivo-local-explicito' : 'fixtures-ficticias', operacao: 'somente-ensaio-em-memoria',
    ...resumirEnsaio(plano), retomadaCompleta: resultado?.completo || false, passosAposRepetir: repeticao?.passos.length ?? null,
    ativacao: verificarPreparacaoAtivacao({}) };
await fs.writeFile(output, JSON.stringify(relatorio, null, 2) + '\n');
console.log(`Relatório local: ${output}. Bloqueios: ${plano.erros.length}. Nenhuma conexão remota ou alteração no arquivo de entrada.`);
