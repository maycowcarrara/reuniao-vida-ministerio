import fs from 'node:fs';
import path from 'node:path';
import { closeClients, createAdminClients } from './firebase-migration/common.mjs';

const DEFAULT_KEY = 'rvm-sbssc-firebase-adminsdk-fbsvc-131d05c7d0.json';
const DEFAULT_UID = 'P8B0fY6m8JVjoLFGZEcXQ1uWsWs2';
const DEFAULT_AUDIT = 'tmp/audit-partes-regras-2026-08-25.json';
const DEFAULT_OUT = 'tmp/preview-partes-habilitadas-2026-08-26.json';
const DEFAULT_CSV = 'tmp/preview-partes-habilitadas-2026-08-26.csv';

const CAPABILITY_BY_PARTE = {
  presidente_meio_semana: 'presidente_rvm',
  discurso_inicial: 'discurso_inicial',
  joias_espirituais: 'joias_espirituais',
  leitura_biblia: 'leitura_biblia',
  nossa_vida_crista: 'vida_crista',
  estudo_biblico: 'estudo_biblico_congregacao',
  demonstracao: 'ministerio',
  oracao: 'oracao',
  discurso_5_min: 'discurso'
};

const CAPABILITY_LABELS = {
  presidente_rvm: 'Presidente RVM',
  discurso_inicial: 'Discurso inicial',
  joias_espirituais: 'Joias espirituais',
  leitura_biblia: 'Leitura da Bíblia',
  ministerio: 'Ministério',
  discurso: 'Discurso 5 min',
  vida_crista: 'Nossa Vida Cristã',
  estudo_biblico_congregacao: 'Estudo Bíblico de Congregação',
  leitor_ebc: 'Leitor EBC',
  oracao: 'Oração',
  presidente_fds: 'Presidente fim de semana',
  dirigente_sentinela: 'Dirigente Sentinela',
  leitor_sentinela: 'Leitor Sentinela',
  indicador_entrada: 'Indicador entrada',
  indicador_auditorio: 'Indicador auditório',
  microfones_volantes: 'Microfones volantes',
  audio_video: 'Áudio e vídeo'
};

const ORDER = Object.keys(CAPABILITY_LABELS);
const EXTRAS_BY_TIPO = {
  anciao: ['leitor_ebc', 'leitor_sentinela', 'indicador_entrada', 'indicador_auditorio'],
  servo: ['leitor_ebc', 'leitor_sentinela', 'indicador_entrada', 'indicador_auditorio']
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    key: DEFAULT_KEY,
    uid: DEFAULT_UID,
    audit: DEFAULT_AUDIT,
    out: DEFAULT_OUT,
    csv: DEFAULT_CSV
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--key') options.key = argv[++index];
    else if (arg === '--uid') options.uid = argv[++index];
    else if (arg === '--audit') options.audit = argv[++index];
    else if (arg === '--out') options.out = argv[++index];
    else if (arg === '--csv') options.csv = argv[++index];
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return options;
}

function sortCapabilities(items = []) {
  const unique = Array.from(new Set(items.filter(Boolean)));
  return unique.sort((a, b) => {
    const aIndex = ORDER.indexOf(a);
    const bIndex = ORDER.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function diffArrays(before = [], after = []) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    adicionar: after.filter((item) => !beforeSet.has(item)),
    remover: before.filter((item) => !afterSet.has(item))
  };
}

function csvValue(value) {
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  if (!/[;"\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function labelList(keys = []) {
  return keys.map((key) => CAPABILITY_LABELS[key] || key);
}

function getExtraCapabilitiesForTipo(tipo = '') {
  return EXTRAS_BY_TIPO[String(tipo || '').trim()] || [];
}

function buildAlunoCapabilityMap(audit) {
  const map = new Map();

  for (const item of audit.resultados || []) {
    const aluno = item.aluno;
    if (!aluno?.id || aluno.tipo === 'desab') continue;

    const capability = CAPABILITY_BY_PARTE[item.parte];
    if (!capability) continue;

    if (!map.has(aluno.id)) {
      map.set(aluno.id, {
        aluno,
        partesNaLista: new Set(),
        capabilities: new Set()
      });
    }

    const target = map.get(aluno.id);
    target.partesNaLista.add(item.parteLabel || item.parte);
    target.capabilities.add(capability);
  }

  return map;
}

async function main() {
  const options = parseArgs();
  const audit = JSON.parse(fs.readFileSync(options.audit, 'utf8'));
  const client = createAdminClients('preview-partes-habilitadas-sbs', options.key);

  try {
    const alunosSnap = await client.db.collection(`users/${options.uid}/alunos`).get();
    const alunos = alunosSnap.docs
      .map((doc) => ({ docId: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));

    const listaMap = buildAlunoCapabilityMap(audit);

    const alunosPreview = alunos.map((aluno) => {
      const itemLista = listaMap.get(String(aluno.id));
      const atuais = sortCapabilities(Array.isArray(aluno.partesHabilitadas) ? aluno.partesHabilitadas : []);
      const sugeridas = aluno.tipo === 'desab'
        ? []
        : sortCapabilities([
            ...(itemLista ? Array.from(itemLista.capabilities) : atuais),
            ...getExtraCapabilitiesForTipo(aluno.tipo)
          ]);
      const diff = diffArrays(atuais, sugeridas);

      let acao = 'sem_alteracao';
      if (aluno.tipo === 'desab' && atuais.length > 0) acao = 'limpar_desabilitado';
      else if (diff.adicionar.length || diff.remover.length) acao = atuais.length ? 'substituir' : 'preencher';
      else if (aluno.tipo !== 'desab' && !itemLista) acao = 'manter_sem_lista';

      return {
        id: aluno.id,
        docId: aluno.docId,
        nome: aluno.nome,
        tipo: aluno.tipo || '',
      observacoes: aluno.observacoes || '',
      citadoNaLista: Boolean(itemLista),
      partesNaLista: itemLista ? Array.from(itemLista.partesNaLista).sort((a, b) => a.localeCompare(b, 'pt-BR')) : [],
      extrasPorTipo: getExtraCapabilitiesForTipo(aluno.tipo),
      atuais,
      sugeridas,
        adicionar: diff.adicionar,
        remover: diff.remover,
        acao
      };
    });

    const report = {
      geradoEm: new Date().toISOString(),
      projectId: client.projectId,
      path: `users/${options.uid}/alunos`,
      regra: 'Preview read-only. Sugeridas derivadas das listas validadas de 2026-08-25; anciaos e servos recebem leitor_ebc, leitor_sentinela, indicador_entrada e indicador_auditorio; alunos ativos nao citados mantem habilitacoes atuais.',
      totais: {
        alunos: alunosPreview.length,
        citadosNaLista: alunosPreview.filter((item) => item.citadoNaLista).length,
        naoCitadosAtivos: alunosPreview.filter((item) => item.tipo !== 'desab' && !item.citadoNaLista).length,
        desabilitados: alunosPreview.filter((item) => item.tipo === 'desab').length,
        preencher: alunosPreview.filter((item) => item.acao === 'preencher').length,
        substituir: alunosPreview.filter((item) => item.acao === 'substituir').length,
        limparDesabilitado: alunosPreview.filter((item) => item.acao === 'limpar_desabilitado').length,
        semAlteracao: alunosPreview.filter((item) => item.acao === 'sem_alteracao').length,
        manterSemLista: alunosPreview.filter((item) => item.acao === 'manter_sem_lista').length
      },
      porAcao: alunosPreview.reduce((acc, item) => {
        acc[item.acao] ||= [];
        acc[item.acao].push(item);
        return acc;
      }, {}),
      alunos: alunosPreview
    };

    fs.mkdirSync(path.dirname(options.out), { recursive: true });
    fs.writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);

    const csvRows = [
      ['id', 'nome', 'tipo', 'acao', 'citadoNaLista', 'partesNaLista', 'atuais', 'sugeridas', 'adicionar', 'remover', 'observacoes'],
      ...alunosPreview.map((item) => [
        item.id,
        item.nome,
        item.tipo,
        item.acao,
        item.citadoNaLista ? 'sim' : 'nao',
        item.partesNaLista,
        labelList(item.atuais),
        labelList(item.sugeridas),
        labelList(item.adicionar),
        labelList(item.remover),
        item.observacoes
      ])
    ];
    fs.writeFileSync(options.csv, `\uFEFF${csvRows.map((row) => row.map(csvValue).join(';')).join('\n')}\n`);

    console.log(JSON.stringify({
      geradoEm: report.geradoEm,
      projectId: report.projectId,
      path: report.path,
      totais: report.totais,
      out: options.out,
      csv: options.csv
    }, null, 2));
  } finally {
    await closeClients(client);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
