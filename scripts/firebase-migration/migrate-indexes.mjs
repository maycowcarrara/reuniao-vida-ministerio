import {
  assertDifferentProjects,
  assertExecuteAllowed,
  closeClients,
  createAdminClients,
  logHeader,
  parseArgs
} from './common.mjs';

const options = parseArgs();
const source = createAdminClients('source-indexes', options.sourceKey);
const target = createAdminClients('target-indexes', options.targetKey);

assertDifferentProjects(source, target);
assertExecuteAllowed(options, 'a migracao de indices compostos');
logHeader('Migracao de indices compostos', source, target, options);

const DATABASE_ID = '(default)';

const stats = {
  sourceCompositeIndexes: 0,
  targetCompositeIndexesBefore: 0,
  alreadyPresent: 0,
  plannedCreates: 0,
  created: 0,
  createErrors: 0,
  fieldOverridesDetected: 0
};

async function getAccessToken(client) {
  const token = await client.app.options.credential.getAccessToken();
  return token.access_token;
}

function firestoreAdminBase(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${DATABASE_ID}`;
}

async function requestJson(token, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = body?.error?.message || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }

  return body;
}

async function listPaged(token, initialUrl, itemKey) {
  const items = [];
  let pageToken = '';
  do {
    const separator = initialUrl.includes('?') ? '&' : '?';
    const url = pageToken ? `${initialUrl}${separator}pageToken=${encodeURIComponent(pageToken)}` : initialUrl;
    const body = await requestJson(token, url);
    items.push(...(body[itemKey] || []));
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return items;
}

function collectionGroupFromName(name) {
  const match = String(name || '').match(/\/collectionGroups\/([^/]+)\/indexes\//);
  return match ? decodeURIComponent(match[1]) : null;
}

function indexSignature(index) {
  const collectionGroup = index.collectionGroup || collectionGroupFromName(index.name);
  const fields = (index.fields || [])
    .map((field) => [
      field.fieldPath,
      field.order || '',
      field.arrayConfig || '',
      field.vectorConfig ? JSON.stringify(field.vectorConfig) : ''
    ].join(':'))
    .join('|');
  return `${collectionGroup}|${index.queryScope || ''}|${index.apiScope || ''}|${fields}`;
}

function sanitizeIndex(index) {
  const body = {
    queryScope: index.queryScope,
    apiScope: index.apiScope,
    fields: index.fields
  };
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined && value !== null)
  );
}

async function listCompositeIndexes(client, token) {
  const url = `${firestoreAdminBase(client.projectId)}/collectionGroups/-/indexes?pageSize=100`;
  return listPaged(token, url, 'indexes');
}

async function listFieldOverrides(client, token) {
  const url = `${firestoreAdminBase(client.projectId)}/collectionGroups/-/fields?pageSize=100`;
  const fields = await listPaged(token, url, 'fields');
  return fields.filter((field) => field.indexConfig && field.indexConfig.usesAncestorConfig === false);
}

try {
  const [sourceToken, targetToken] = await Promise.all([
    getAccessToken(source),
    getAccessToken(target)
  ]);

  const [sourceIndexes, targetIndexes, fieldOverrides] = await Promise.all([
    listCompositeIndexes(source, sourceToken),
    listCompositeIndexes(target, targetToken),
    listFieldOverrides(source, sourceToken)
  ]);

  stats.sourceCompositeIndexes = sourceIndexes.length;
  stats.targetCompositeIndexesBefore = targetIndexes.length;
  stats.fieldOverridesDetected = fieldOverrides.length;

  const targetSignatures = new Set(targetIndexes.map(indexSignature));
  const toCreate = sourceIndexes.filter((index) => {
    const exists = targetSignatures.has(indexSignature(index));
    if (exists) {
      stats.alreadyPresent += 1;
    }
    return !exists;
  });

  stats.plannedCreates = toCreate.length;

  if (fieldOverrides.length > 0) {
    console.warn(
      `Foram detectados ${fieldOverrides.length} field overrides/single-field indexes no projeto antigo. ` +
      'Este script recria apenas indices compostos; field overrides devem ser conferidos manualmente no console Firebase.'
    );
  }

  if (options.execute) {
    for (const index of toCreate) {
      const collectionGroup = collectionGroupFromName(index.name);
      if (!collectionGroup) {
        stats.createErrors += 1;
        console.error(`Nao consegui identificar collectionGroup do indice: ${index.name}`);
        continue;
      }

      const url = `${firestoreAdminBase(target.projectId)}/collectionGroups/${encodeURIComponent(collectionGroup)}/indexes`;
      try {
        await requestJson(targetToken, url, {
          method: 'POST',
          body: JSON.stringify(sanitizeIndex(index))
        });
        stats.created += 1;
      } catch (error) {
        stats.createErrors += 1;
        console.error(`Erro ao criar indice em ${collectionGroup}: ${error.message}`);
      }
    }
  }

  console.log('\nResumo indices:');
  console.table(stats);

  if (!options.execute) {
    console.log('\nNada foi gravado. Para migrar de verdade: npm run migrate:indexes');
  }
} finally {
  await closeClients(source, target);
}
