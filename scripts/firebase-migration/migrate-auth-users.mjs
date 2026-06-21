import {
  assertDifferentProjects,
  assertExecuteAllowed,
  closeClients,
  createAdminClients,
  logHeader,
  parseArgs
} from './common.mjs';

const options = parseArgs();
const source = createAdminClients('source-auth', options.sourceKey);
const target = createAdminClients('target-auth', options.targetKey);

assertDifferentProjects(source, target);
assertExecuteAllowed(options, 'a migracao dos usuarios do Auth');
logHeader('Migracao Auth', source, target, options);

const stats = {
  sourceUsers: 0,
  targetUsersBefore: 0,
  alreadyPresentByUid: 0,
  emailConflictsDifferentUid: 0,
  passwordUsersWithoutHash: 0,
  plannedImports: 0,
  imported: 0,
  importErrors: 0
};

async function listAllUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

function toImportRecord(user) {
  const providers = user.providerData.map((provider) => ({
    uid: provider.uid,
    email: provider.email,
    displayName: provider.displayName,
    photoURL: provider.photoURL,
    providerId: provider.providerId
  })).filter((provider) => provider.providerId && provider.uid);

  const record = {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    photoURL: user.photoURL,
    phoneNumber: user.phoneNumber,
    disabled: user.disabled,
    providerData: providers
  };

  if (user.customClaims && Object.keys(user.customClaims).length > 0) {
    record.customClaims = user.customClaims;
  }
  if (user.passwordHash) {
    record.passwordHash = user.passwordHash;
  }
  if (user.passwordSalt) {
    record.passwordSalt = user.passwordSalt;
  }

  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null)
  );
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

try {
  const [sourceUsers, targetUsers] = await Promise.all([
    listAllUsers(source.auth),
    listAllUsers(target.auth)
  ]);

  stats.sourceUsers = sourceUsers.length;
  stats.targetUsersBefore = targetUsers.length;

  const targetUids = new Set(targetUsers.map((user) => user.uid));
  const targetEmails = new Map(
    targetUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user.uid])
  );

  const records = [];
  for (const user of sourceUsers) {
    if (targetUids.has(user.uid)) {
      stats.alreadyPresentByUid += 1;
      continue;
    }

    const targetUidForEmail = user.email ? targetEmails.get(user.email.toLowerCase()) : null;
    if (targetUidForEmail && targetUidForEmail !== user.uid) {
      stats.emailConflictsDifferentUid += 1;
      console.warn(
        `Conflito de email: ${user.email} ja existe no destino com UID ${targetUidForEmail}; ` +
        `origem usa UID ${user.uid}. Nao vou apagar usuario automaticamente.`
      );
      continue;
    }

    const hasPasswordProvider = user.providerData.some((provider) => provider.providerId === 'password');
    if (hasPasswordProvider && !user.passwordHash) {
      stats.passwordUsersWithoutHash += 1;
      console.warn(
        `Usuario ${user.uid} parece usar senha, mas o hash nao veio no listUsers(). ` +
        'Ele sera importado sem senha; use firebase auth:export/auth:import se precisar preservar login por senha.'
      );
    }

    records.push(toImportRecord(user));
  }

  stats.plannedImports = records.length;

  if (options.execute && records.length > 0) {
    for (const batch of chunk(records, 1000)) {
      const result = await target.auth.importUsers(batch);
      stats.imported += result.successCount;
      stats.importErrors += result.failureCount;
      for (const error of result.errors) {
        const failedRecord = batch[error.index];
        console.error(`Erro ao importar UID ${failedRecord?.uid}: ${error.error?.message || error.reason}`);
      }
    }
  }

  console.log('\nResumo Auth:');
  console.table(stats);

  if (!options.execute) {
    console.log('\nNada foi gravado. Para migrar de verdade: npm run migrate:auth');
  }
} finally {
  await closeClients(source, target);
}
