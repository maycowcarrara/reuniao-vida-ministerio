import fs from 'node:fs';
import path from 'node:path';
import { cert, deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  Blob,
  DocumentReference,
  GeoPoint,
  getFirestore,
  Timestamp
} from 'firebase-admin/firestore';

export const ROOT_DIR = process.cwd();

export const DEFAULT_SOURCE_KEY = 'vidaeministerio-firebase-adminsdk-fbsvc-175535c784.json';
export const DEFAULT_TARGET_KEY = 'rvm-palmas-pr-firebase-adminsdk-fbsvc-8b2962008e.json';

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    execute: false,
    yes: false,
    verbose: false,
    sourceKey: DEFAULT_SOURCE_KEY,
    targetKey: DEFAULT_TARGET_KEY,
    rootCollections: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--yes') {
      options.yes = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--source-key') {
      options.sourceKey = argv[++index];
    } else if (arg === '--target-key') {
      options.targetKey = argv[++index];
    } else if (arg === '--root-collection') {
      options.rootCollections.push(argv[++index]);
    } else if (arg === '--dry-run') {
      options.execute = false;
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  return options;
}

export function resolveFromRoot(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT_DIR, filePath);
}

export function readServiceAccount(filePath) {
  const fullPath = resolveFromRoot(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Arquivo de service account nao encontrado: ${fullPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  for (const key of ['project_id', 'client_email', 'private_key']) {
    if (!serviceAccount[key]) {
      throw new Error(`Service account invalida em ${fullPath}: campo ausente ${key}`);
    }
  }

  return { fullPath, serviceAccount };
}

export function createAdminClients(name, keyPath) {
  const { fullPath, serviceAccount } = readServiceAccount(keyPath);
  const appName = `${name}-${serviceAccount.project_id}`;
  const existingApp = getApps().find((app) => app?.name === appName);
  const app = existingApp || initializeApp({
    credential: cert(serviceAccount)
  }, appName);

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    fullPath,
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email
  };
}

export function assertDifferentProjects(source, target) {
  if (source.projectId === target.projectId) {
    throw new Error(`Projeto de origem e destino sao iguais (${source.projectId}). Abortando.`);
  }
}

export function assertExecuteAllowed(options, actionDescription) {
  if (options.execute && !options.yes) {
    throw new Error(
      `Para executar ${actionDescription}, rode novamente com --execute --yes. ` +
      'Sem esses parametros o script fica em modo dry-run.'
    );
  }
}

export function formatMode(options) {
  return options.execute ? 'EXECUCAO REAL' : 'DRY-RUN';
}

export function logHeader(title, source, target, options) {
  console.log(`\n== ${title} ==`);
  console.log(`Modo: ${formatMode(options)}`);
  console.log(`Origem: ${source.projectId} (${source.clientEmail})`);
  console.log(`Destino: ${target.projectId} (${target.clientEmail})`);
}

export async function closeClients(...clients) {
  await Promise.allSettled(clients.map((client) => deleteApp(client.app)));
}

export const firestoreTypes = {
  Blob,
  DocumentReference,
  GeoPoint,
  Timestamp
};
