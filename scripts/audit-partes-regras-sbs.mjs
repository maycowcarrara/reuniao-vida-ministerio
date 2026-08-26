import fs from 'node:fs';
import path from 'node:path';
import { closeClients, createAdminClients } from './firebase-migration/common.mjs';

const DEFAULT_KEY = 'rvm-sbssc-firebase-adminsdk-fbsvc-131d05c7d0.json';
const DEFAULT_UID = 'P8B0fY6m8JVjoLFGZEcXQ1uWsWs2';
const DEFAULT_LIST = 'tmp/listas-partes-2026-08-25.json';
const DEFAULT_OUT = 'tmp/audit-partes-regras-2026-08-25.json';

const PART_LABELS = {
  presidente_meio_semana: 'Presidente meio de semana',
  discurso_inicial: 'Discurso inicial',
  joias_espirituais: 'Joias espirituais',
  leitura_biblia: 'Leitura da Bíblia',
  nossa_vida_crista: 'Nossa vida cristã',
  estudo_biblico: 'Estudo bíblico',
  demonstracao: 'Demonstração',
  oracao: 'Oração',
  discurso_5_min: 'Discurso 5 min'
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    key: DEFAULT_KEY,
    uid: DEFAULT_UID,
    list: DEFAULT_LIST,
    out: DEFAULT_OUT
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

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isOneOf(aluno, nomes) {
  const nome = normalize(aluno?.nome);
  return nomes.map(normalize).includes(nome);
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

function getCandidates(alunos, nome) {
  const norm = normalize(nome);
  const tokens = norm.split(' ').filter(Boolean);
  if (!tokens.length) return [];

  return alunos
    .map((aluno) => {
      const alunoNorm = normalize(aluno.nome);
      const alunoTokens = alunoNorm.split(' ').filter(Boolean);
      const score = tokens.filter((token) => alunoTokens.includes(token)).length / Math.max(tokens.length, alunoTokens.length);
      const startsWith = alunoTokens.some((token) => token.startsWith(norm));
      const exactToken = alunoTokens.includes(norm);
      return { aluno, score: exactToken ? 0.9 : startsWith ? Math.max(score, 0.75) : score };
    })
    .filter((item) => item.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function resolveEntry(entry, alunos, byName) {
  if (entry.semInferencia) {
    return { ...entry, statusCadastro: 'precisa_confirmar_sem_inferencia', aluno: null, candidatos: getCandidates(alunos, entry.nome) };
  }

  if (entry.matchNome) {
    const match = byName.get(normalize(entry.matchNome));
    return match
      ? { ...entry, statusCadastro: 'cadastrado', aluno: match, candidatos: [] }
      : { ...entry, statusCadastro: 'match_informado_nao_encontrado', aluno: null, candidatos: getCandidates(alunos, entry.matchNome) };
  }

  const candidates = getCandidates(alunos, entry.nome);
  if (candidates.length === 1) {
    return { ...entry, statusCadastro: 'cadastrado_por_inferencia', aluno: candidates[0].aluno, candidatos: [] };
  }

  return {
    ...entry,
    statusCadastro: candidates.length ? 'ambiguo_ou_precisa_confirmar' : 'nao_cadastrado',
    aluno: null,
    candidatos: candidates
  };
}

function validateEligibility(entry) {
  const aluno = entry.aluno;
  if (!aluno) return { ok: false, motivo: 'Sem cadastro confirmado' };

  const tipo = aluno.tipo || '';
  const nome = normalize(aluno.nome);
  const obs = normalize(aluno.observacoes);

  if (tipo === 'desab') return { ok: false, motivo: 'Cadastro está desabilitado' };

  switch (entry.parte) {
    case 'presidente_meio_semana':
      return tipo === 'anciao'
        ? { ok: true, motivo: 'Ancião habilitado para presidir' }
        : { ok: false, motivo: 'Presidente deve estar como ancião' };

    case 'discurso_inicial':
      if (isOneOf(aluno, ['Pedro Rodrigues', 'Nelson Salça'])) {
        return { ok: false, motivo: 'Exceção informada: Pedro e Nelson não fazem discurso inicial' };
      }
      return ['anciao', 'servo'].includes(tipo)
        ? { ok: true, motivo: 'Ancião/servo habilitado' }
        : { ok: false, motivo: 'Discurso inicial deve ser ancião ou servo' };

    case 'joias_espirituais':
      return ['anciao', 'servo'].includes(tipo)
        ? { ok: true, motivo: 'Ancião/servo habilitado' }
        : { ok: false, motivo: 'Joias deve ser ancião ou servo' };

    case 'nossa_vida_crista':
    case 'estudo_biblico':
      if (tipo === 'anciao') return { ok: true, motivo: 'Ancião habilitado' };
      if (tipo === 'servo' && isOneOf(aluno, ['Jhoyner Quintero', 'Marcelo Miranda', 'Josuel Laurentino'])) {
        return { ok: true, motivo: 'Servo na lista permitida para esta parte' };
      }
      return { ok: false, motivo: 'Somente anciãos ou os servos Jhoyner, Miranda e Josuel' };

    case 'leitura_biblia':
      return ['irmao_hab', 'irmao'].includes(tipo)
        ? { ok: true, motivo: 'Varão habilitado/irmão habilitado para leitura' }
        : { ok: false, motivo: 'Leitura deve estar como varão habilitado ou irmão' };

    case 'demonstracao':
      return ['irma', 'irma_exp', 'irma_lim'].includes(tipo)
        ? { ok: true, motivo: 'Irmã cadastrada para demonstração' }
        : { ok: false, motivo: 'Demonstração desta lista deveria estar com tipo de irmã' };

    case 'oracao':
      if (isOneOf(aluno, ['Rubens Martin'])) return { ok: false, motivo: 'Exceção informada: Rubens não faz oração' };
      return ['anciao', 'servo', 'irmao_hab', 'irmao'].includes(tipo)
        ? { ok: true, motivo: 'Irmão habilitado para oração' }
        : { ok: false, motivo: 'Oração deve ser feita por irmão cadastrado ativo' };

    case 'discurso_5_min':
      return tipo === 'irmao_hab' || isOneOf(aluno, ['Rubens Martin'])
        ? { ok: true, motivo: tipo === 'irmao_hab' ? 'Varão habilitado' : 'Exceção marcada na lista/cadastro' }
        : { ok: false, motivo: 'Discurso de 5 min deve estar como varão habilitado' };

    default:
      return { ok: false, motivo: `Parte sem regra: ${entry.parte}` };
  }
}

async function main() {
  const options = parseArgs();
  const list = JSON.parse(fs.readFileSync(options.list, 'utf8'));
  const client = createAdminClients('audit-partes-regras-sbs', options.key);

  try {
    const snap = await client.db.collection(`users/${options.uid}/alunos`).get();
    const alunos = snap.docs.map((doc) => ({ docId: doc.id, ...doc.data() }));
    const byName = new Map(alunos.map((aluno) => [normalize(aluno.nome), aluno]));

    const resultados = list.map((entry) => {
      const resolved = resolveEntry(entry, alunos, byName);
      const regra = validateEligibility(resolved);
      return {
        parte: entry.parte,
        parteLabel: PART_LABELS[entry.parte] || entry.parte,
        nomeLista: entry.nome,
        notaLista: entry.notaLista || '',
        statusCadastro: resolved.statusCadastro,
        regraOk: regra.ok,
        motivo: regra.motivo,
        aluno: publicAluno(resolved.aluno),
        candidatos: resolved.candidatos.map(({ aluno, score }) => ({ score: Number(score.toFixed(2)), ...publicAluno(aluno) }))
      };
    });

    const uniqueByAluno = new Map();
    for (const item of resultados) {
      if (item.aluno?.id) uniqueByAluno.set(item.aluno.id, item.aluno);
    }

    const report = {
      geradoEm: new Date().toISOString(),
      projectId: client.projectId,
      path: `users/${options.uid}/alunos`,
      totais: {
        entradasLista: resultados.length,
        pessoasUnicasConfirmadas: uniqueByAluno.size,
        cadastradosConfirmados: resultados.filter((item) => item.aluno).length,
        naoCadastrados: resultados.filter((item) => item.statusCadastro === 'nao_cadastrado').length,
        ambiguosOuConfirmar: resultados.filter((item) => item.statusCadastro === 'ambiguo_ou_precisa_confirmar').length,
        ajustesDeRegra: resultados.filter((item) => item.aluno && !item.regraOk).length,
        observacoesDaLista: resultados.filter((item) => item.notaLista).length
      },
      porParte: Object.values(resultados.reduce((acc, item) => {
        acc[item.parte] ||= {
          parte: item.parte,
          parteLabel: item.parteLabel,
          total: 0,
          ok: 0,
          revisar: 0,
          naoCadastrados: 0,
          ambiguosOuConfirmar: 0
        };
        acc[item.parte].total += 1;
        if (item.regraOk) acc[item.parte].ok += 1;
        else acc[item.parte].revisar += 1;
        if (item.statusCadastro === 'nao_cadastrado') acc[item.parte].naoCadastrados += 1;
        if (item.statusCadastro === 'ambiguo_ou_precisa_confirmar') acc[item.parte].ambiguosOuConfirmar += 1;
        return acc;
      }, {})),
      revisar: resultados.filter((item) => !item.regraOk || item.statusCadastro !== 'cadastrado'),
      resultados
    };

    fs.mkdirSync(path.dirname(options.out), { recursive: true });
    fs.writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);

    console.log(JSON.stringify({
      geradoEm: report.geradoEm,
      projectId: report.projectId,
      path: report.path,
      totais: report.totais,
      porParte: report.porParte,
      out: options.out
    }, null, 2));
  } finally {
    await closeClients(client);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
