import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    envFile: fs.existsSync(path.join(ROOT_DIR, '.env.local')) ? '.env.local' : '.env',
    rulesFile: 'firestore.rules',
    packageFile: 'package.json',
    firebasercFile: '.firebaserc'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--env') {
      options.envFile = argv[++index];
    } else if (arg === '--rules') {
      options.rulesFile = argv[++index];
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  return options;
}

function resolveFromRoot(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT_DIR, filePath);
}

function readTextIfExists(filePath) {
  const fullPath = resolveFromRoot(filePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

function readJsonIfExists(filePath) {
  const text = readTextIfExists(filePath);
  return text ? JSON.parse(text) : null;
}

function parseEnv(text) {
  const env = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function extractRuleFunctionReturn(rulesText, functionName) {
  const pattern = new RegExp(`function\\s+${functionName}\\s*\\(\\)\\s*{\\s*return\\s+"([^"]*)"\\s*;\\s*}`);
  return pattern.exec(rulesText)?.[1] || '';
}

function extractProjectIdsFromPackage(packageJson) {
  const scripts = packageJson?.scripts || {};
  const ids = new Set();
  for (const script of Object.values(scripts)) {
    const matches = String(script).matchAll(/--project\s+([^\s"]+)/g);
    for (const match of matches) ids.add(match[1]);
  }
  return [...ids].sort();
}

function formatList(items) {
  return items.length ? items.join(', ') : '(nenhum)';
}

const options = parseArgs();
const issues = [];
const warnings = [];

const envText = readTextIfExists(options.envFile);
if (!envText) {
  issues.push(`Arquivo de ambiente nao encontrado: ${options.envFile}`);
}

const env = parseEnv(envText || '');
const projectId = env.VITE_FIREBASE_PROJECT_ID || '';
const dataOwnerUid = env.VITE_ADMIN_UID || '';
const ownerUid = env.VITE_OWNER_UID || dataOwnerUid;
const ownerEmail = env.VITE_OWNER_EMAIL || '';

for (const key of [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_ADMIN_UID'
]) {
  if (!env[key]) issues.push(`Variavel ausente em ${options.envFile}: ${key}`);
}

if (!ownerUid) issues.push(`Variavel ausente em ${options.envFile}: VITE_OWNER_UID ou VITE_ADMIN_UID`);
if (!ownerEmail) warnings.push(`VITE_OWNER_EMAIL vazio em ${options.envFile}; o app ainda funciona, mas a gestao de acesso fica menos clara.`);

const rulesText = readTextIfExists(options.rulesFile);
if (!rulesText) {
  issues.push(`Arquivo de regras nao encontrado: ${options.rulesFile}`);
} else {
  const rulesDataOwnerUid = extractRuleFunctionReturn(rulesText, 'dataOwnerUid');
  const rulesPrimaryOwnerUid = extractRuleFunctionReturn(rulesText, 'primaryOwnerUid');

  if (!rulesDataOwnerUid) {
    issues.push('Nao consegui ler dataOwnerUid() em firestore.rules.');
  } else if (dataOwnerUid && rulesDataOwnerUid !== dataOwnerUid) {
    issues.push(`firestore.rules dataOwnerUid()=${rulesDataOwnerUid}, mas ${options.envFile} VITE_ADMIN_UID=${dataOwnerUid}.`);
  }

  if (!rulesPrimaryOwnerUid) {
    issues.push('Nao consegui ler primaryOwnerUid() em firestore.rules.');
  } else if (ownerUid && rulesPrimaryOwnerUid !== ownerUid) {
    issues.push(`firestore.rules primaryOwnerUid()=${rulesPrimaryOwnerUid}, mas ${options.envFile} owner UID=${ownerUid}.`);
  }
}

const firebaserc = readJsonIfExists(options.firebasercFile);
const firebasercProjects = Object.values(firebaserc?.projects || {}).filter(Boolean);
if (projectId && firebasercProjects.length > 0 && !firebasercProjects.includes(projectId)) {
  warnings.push(`.firebaserc nao contem o projeto ${projectId}. Projetos atuais: ${formatList(firebasercProjects)}.`);
}

const packageJson = readJsonIfExists(options.packageFile);
const packageProjectIds = extractProjectIdsFromPackage(packageJson);
if (projectId && packageProjectIds.length > 0 && !packageProjectIds.includes(projectId)) {
  issues.push(`package.json tem scripts de deploy fixos para ${formatList(packageProjectIds)}, nao para ${projectId}. Ajuste o ambiente ou os scripts antes de publicar.`);
}

if (!env.VITE_JW_PROXY_URL) {
  warnings.push('VITE_JW_PROXY_URL vazio; a importacao automatica tentara fallbacks publicos e o proxy padrao antigo do codigo.');
}

console.log('\n== Conferencia de nova congregacao ==');
console.log(`Env: ${options.envFile}`);
console.log(`Projeto Firebase: ${projectId || '(nao definido)'}`);
console.log(`UID de dados (VITE_ADMIN_UID): ${dataOwnerUid || '(nao definido)'}`);
console.log(`UID dono principal: ${ownerUid || '(nao definido)'}`);
console.log(`Projetos em package.json: ${formatList(packageProjectIds)}`);

if (warnings.length > 0) {
  console.log('\nAvisos:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (issues.length > 0) {
  console.log('\nPendencias criticas:');
  for (const issue of issues) console.log(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('\nOK: ambiente e regras parecem alinhados para este alvo.');
}
