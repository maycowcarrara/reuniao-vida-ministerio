import fs from 'node:fs';
import path from 'node:path';
import { closeClients, createAdminClients } from './firebase-migration/common.mjs';

const DEFAULT_KEY = 'rvm-sbssc-firebase-adminsdk-fbsvc-131d05c7d0.json';
const DEFAULT_UID = 'P8B0fY6m8JVjoLFGZEcXQ1uWsWs2';
const DEFAULT_PREVIEW = 'tmp/preview-partes-habilitadas-2026-08-26.json';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    key: DEFAULT_KEY,
    uid: DEFAULT_UID,
    preview: DEFAULT_PREVIEW,
    execute: false,
    yes: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--key') options.key = argv[++index];
    else if (arg === '--uid') options.uid = argv[++index];
    else if (arg === '--preview') options.preview = argv[++index];
    else if (arg === '--execute') options.execute = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--dry-run') options.execute = false;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return options;
}

function ensureApplyAllowed(options) {
  if (options.execute && !options.yes) {
    throw new Error('Para gravar, rode com --execute --yes.');
  }
}

function sortByNumericId(items) {
  return [...items].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
}

async function main() {
  const options = parseArgs();
  ensureApplyAllowed(options);

  const preview = JSON.parse(fs.readFileSync(options.preview, 'utf8'));
  const client = createAdminClients('apply-partes-habilitadas-sbs', options.key);

  try {
    if (preview.projectId !== client.projectId) {
      throw new Error(`Preview é do projeto ${preview.projectId}, mas a chave aponta para ${client.projectId}.`);
    }

    if (preview.path !== `users/${options.uid}/alunos`) {
      throw new Error(`Preview é de ${preview.path}, mas o alvo informado é users/${options.uid}/alunos.`);
    }

    const alunosSnap = await client.db.collection(`users/${options.uid}/alunos`).get();
    const currentByDocId = new Map(alunosSnap.docs.map((doc) => [doc.id, { docId: doc.id, ...doc.data() }]));
    const currentById = new Map([...currentByDocId.values()].map((aluno) => [String(aluno.id), aluno]));

    const backupPath = path.join(
      'tmp',
      `backup-partes-habilitadas-before-apply-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );

    const backup = {
      geradoEm: new Date().toISOString(),
      projectId: client.projectId,
      path: `users/${options.uid}/alunos`,
      alunos: sortByNumericId([...currentByDocId.values()])
    };
    fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`);

    const planned = sortByNumericId((preview.alunos || []).filter((item) => {
      if (item.tipo === 'desab') return false;
      if (!Array.isArray(item.sugeridas) || item.sugeridas.length === 0) return false;
      const current = currentById.get(String(item.id));
      if (!current) return false;
      const atuais = Array.isArray(current.partesHabilitadas) ? current.partesHabilitadas : [];
      const before = JSON.stringify([...atuais].sort());
      const after = JSON.stringify([...item.sugeridas].sort());
      return before !== after;
    }));

    if (options.execute) {
      let batch = client.db.batch();
      let batchCount = 0;
      let committed = 0;

      for (const item of planned) {
        const current = currentById.get(String(item.id));
        const ref = client.db.collection(`users/${options.uid}/alunos`).doc(current.docId);
        batch.set(ref, { partesHabilitadas: item.sugeridas }, { merge: true });
        batchCount += 1;

        if (batchCount >= 450) {
          await batch.commit();
          committed += batchCount;
          batch = client.db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        committed += batchCount;
      }

      console.log(JSON.stringify({
        modo: 'EXECUCAO_REAL',
        projectId: client.projectId,
        path: `users/${options.uid}/alunos`,
        backupPath,
        planejados: planned.length,
        gravados: committed
      }, null, 2));
      return;
    }

    console.log(JSON.stringify({
      modo: 'DRY_RUN',
      projectId: client.projectId,
      path: `users/${options.uid}/alunos`,
      backupPath,
      planejados: planned.length,
      exemplos: planned.slice(0, 10).map((item) => ({
        id: item.id,
        nome: item.nome,
        tipo: item.tipo,
        partesHabilitadas: item.sugeridas
      }))
    }, null, 2));
  } finally {
    await closeClients(client);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
