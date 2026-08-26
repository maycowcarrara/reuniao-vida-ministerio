import fs from 'node:fs';
import path from 'node:path';
import { closeClients, createAdminClients } from './firebase-migration/common.mjs';

const DEFAULT_KEY = 'rvm-sbssc-firebase-adminsdk-fbsvc-131d05c7d0.json';
const DEFAULT_UID = 'P8B0fY6m8JVjoLFGZEcXQ1uWsWs2';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    key: DEFAULT_KEY,
    uid: DEFAULT_UID,
    list: '',
    out: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--key') options.key = argv[++index];
    else if (arg === '--uid') options.uid = argv[++index];
    else if (arg === '--list') options.list = argv[++index];
    else if (arg === '--out') options.out = argv[++index];
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return options;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function firstLastKey(value) {
  const parts = normalizeName(value).split(' ').filter(Boolean);
  if (parts.length <= 1) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function tokenSet(value) {
  return new Set(normalizeName(value).split(' ').filter((part) => part.length > 1));
}

function scoreNames(sourceName, candidateName) {
  const sourceTokens = tokenSet(sourceName);
  const candidateTokens = tokenSet(candidateName);
  if (sourceTokens.size === 0 || candidateTokens.size === 0) return 0;

  let shared = 0;
  for (const token of sourceTokens) {
    if (candidateTokens.has(token)) shared += 1;
  }

  return shared / Math.max(sourceTokens.size, candidateTokens.size);
}

function splitDelimitedLine(line) {
  const separators = [';', '\t', ','];
  const separator = separators.find((item) => line.includes(item));
  if (!separator) return [line];
  return line.split(separator).map((part) => part.trim());
}

function parseTextList(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : parsed.itens || parsed.items || parsed.partes || parsed.lista || [];
    if (!Array.isArray(rows)) {
      throw new Error('JSON precisa ser um array ou conter uma chave array: itens, items, partes ou lista.');
    }

    return rows.map((row, index) => {
      if (typeof row === 'string') return { sourceLine: index + 1, nome: row, parte: '' };
      return {
        sourceLine: index + 1,
        nome: row.nome || row.aluno || row.publicador || row.pessoa || row.name || '',
        parte: row.parte || row.designacao || row.assignment || row.tipoParte || ''
      };
    }).filter((row) => row.nome);
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  if (lines.length === 0) return [];

  const firstCells = splitDelimitedLine(lines[0]).map((cell) => normalizeName(cell));
  const hasHeader = firstCells.some((cell) => ['nome', 'aluno', 'publicador', 'pessoa', 'name'].includes(cell));
  const header = hasHeader ? splitDelimitedLine(lines.shift()).map((cell) => normalizeName(cell)) : [];
  const nameIndex = header.findIndex((cell) => ['nome', 'aluno', 'publicador', 'pessoa', 'name'].includes(cell));
  const partIndex = header.findIndex((cell) => ['parte', 'designacao', 'assignment', 'tipo parte', 'tipoparte'].includes(cell));

  return lines.map((line, index) => {
    const cells = splitDelimitedLine(line);
    if (hasHeader) {
      return {
        sourceLine: index + 2,
        nome: cells[nameIndex] || '',
        parte: partIndex >= 0 ? cells[partIndex] || '' : ''
      };
    }

    return {
      sourceLine: index + 1,
      nome: cells[0] || '',
      parte: cells.slice(1).join(' | ')
    };
  }).filter((row) => row.nome);
}

function summarizeAlunos(alunos) {
  const byTipo = {};
  const byName = new Map();
  const byFirstLast = new Map();

  for (const aluno of alunos) {
    byTipo[aluno.tipo || '(vazio)'] = (byTipo[aluno.tipo || '(vazio)'] || 0) + 1;

    const fullKey = normalizeName(aluno.nome);
    const shortKey = firstLastKey(aluno.nome);
    if (!byName.has(fullKey)) byName.set(fullKey, []);
    if (!byFirstLast.has(shortKey)) byFirstLast.set(shortKey, []);
    byName.get(fullKey).push(aluno);
    byFirstLast.get(shortKey).push(aluno);
  }

  const duplicatedFullNames = [...byName.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({ key, nomes: items.map((item) => item.nome) }));

  const duplicatedFirstLast = [...byFirstLast.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({ key, nomes: items.map((item) => item.nome) }));

  return { byTipo, duplicatedFullNames, duplicatedFirstLast, byName, byFirstLast };
}

function compareList(inputRows, alunos, summary) {
  return inputRows.map((row) => {
    const normalized = normalizeName(row.nome);
    const shortKey = firstLastKey(row.nome);
    const exact = summary.byName.get(normalized) || [];
    const firstLast = summary.byFirstLast.get(shortKey) || [];

    if (exact.length === 1) return { ...row, status: 'encontrado_exato', match: exact[0] };
    if (exact.length > 1) return { ...row, status: 'ambiguo_exato', matches: exact };
    if (firstLast.length === 1) return { ...row, status: 'encontrado_primeiro_ultimo', match: firstLast[0] };
    if (firstLast.length > 1) return { ...row, status: 'ambiguo_primeiro_ultimo', matches: firstLast };

    const candidates = alunos
      .map((aluno) => ({ aluno, score: scoreNames(row.nome, aluno.nome) }))
      .filter((item) => item.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      ...row,
      status: candidates.length ? 'possivel_correspondencia' : 'nao_cadastrado',
      candidates
    };
  });
}

function publicAluno(aluno) {
  if (!aluno) return null;
  return {
    id: aluno.id,
    nome: aluno.nome,
    tipo: aluno.tipo || '',
    familia: aluno.familia || '',
    observacoes: aluno.observacoes || ''
  };
}

async function main() {
  const options = parseArgs();
  const client = createAdminClients('audit-partes-alunos', options.key);

  try {
    const alunosSnap = await client.db.collection(`users/${options.uid}/alunos`).get();
    const alunos = alunosSnap.docs
      .map((doc) => ({ docId: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));

    const summary = summarizeAlunos(alunos);
    const report = {
      geradoEm: new Date().toISOString(),
      projectId: client.projectId,
      path: `users/${options.uid}/alunos`,
      totais: {
        alunos: alunos.length,
        tipos: summary.byTipo,
        duplicadosNomeCompleto: summary.duplicatedFullNames.length,
        duplicadosPrimeiroUltimo: summary.duplicatedFirstLast.length
      },
      duplicadosNomeCompleto: summary.duplicatedFullNames,
      duplicadosPrimeiroUltimo: summary.duplicatedFirstLast,
      alunos: alunos.map(publicAluno)
    };

    if (options.list) {
      const inputRows = parseTextList(options.list);
      const compared = compareList(inputRows, alunos, summary);
      report.lista = {
        arquivo: options.list,
        total: inputRows.length,
        porStatus: compared.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {}),
        resultados: compared.map((item) => ({
          sourceLine: item.sourceLine,
          nome: item.nome,
          parte: item.parte,
          status: item.status,
          match: publicAluno(item.match),
          matches: item.matches?.map(publicAluno),
          candidates: item.candidates?.map(({ aluno, score }) => ({
            score: Number(score.toFixed(2)),
            ...publicAluno(aluno)
          }))
        }))
      };
    }

    if (options.out) {
      fs.mkdirSync(path.dirname(options.out), { recursive: true });
      fs.writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
    }

    console.log(JSON.stringify({
      geradoEm: report.geradoEm,
      projectId: report.projectId,
      path: report.path,
      totais: report.totais,
      lista: report.lista ? {
        arquivo: report.lista.arquivo,
        total: report.lista.total,
        porStatus: report.lista.porStatus
      } : null,
      out: options.out || null
    }, null, 2));
  } finally {
    await closeClients(client);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
