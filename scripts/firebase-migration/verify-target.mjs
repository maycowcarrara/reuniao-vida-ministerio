import {
  assertDifferentProjects,
  closeClients,
  createAdminClients,
  logHeader,
  parseArgs
} from './common.mjs';

const options = parseArgs();
const source = createAdminClients('source-verify', options.sourceKey);
const target = createAdminClients('target-verify', options.targetKey);

assertDifferentProjects(source, target);
logHeader('Verificacao de migracao', source, target, { ...options, execute: false });

async function countAuthUsers(auth) {
  let count = 0;
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    count += page.users.length;
    pageToken = page.pageToken;
  } while (pageToken);
  return count;
}

async function countCollection(collectionRef) {
  let documentsWithData = 0;
  let missingDocumentsWithSubcollections = 0;
  let collections = 1;
  const documentRefs = await collectionRef.listDocuments();

  for (const documentRef of documentRefs) {
    const snapshot = await documentRef.get();
    if (snapshot.exists) {
      documentsWithData += 1;
    } else {
      missingDocumentsWithSubcollections += 1;
    }

    const subcollections = await documentRef.listCollections();
    for (const subcollection of subcollections) {
      const child = await countCollection(subcollection);
      documentsWithData += child.documentsWithData;
      missingDocumentsWithSubcollections += child.missingDocumentsWithSubcollections;
      collections += child.collections;
    }
  }

  return { collections, documentsWithData, missingDocumentsWithSubcollections };
}

async function countFirestore(db) {
  const rootCollections = await db.listCollections();
  const totals = {
    rootCollections: rootCollections.length,
    collections: 0,
    documentsWithData: 0,
    missingDocumentsWithSubcollections: 0
  };

  for (const collectionRef of rootCollections) {
    const child = await countCollection(collectionRef);
    totals.collections += child.collections;
    totals.documentsWithData += child.documentsWithData;
    totals.missingDocumentsWithSubcollections += child.missingDocumentsWithSubcollections;
  }

  return totals;
}

try {
  const [sourceAuthCount, targetAuthCount, sourceFirestore, targetFirestore] = await Promise.all([
    countAuthUsers(source.auth),
    countAuthUsers(target.auth),
    countFirestore(source.db),
    countFirestore(target.db)
  ]);

  console.log('\nAuth:');
  console.table({
    origem: { users: sourceAuthCount },
    destino: { users: targetAuthCount },
    diferenca: { users: targetAuthCount - sourceAuthCount }
  });

  console.log('\nFirestore:');
  console.table({
    origem: sourceFirestore,
    destino: targetFirestore,
    diferenca: {
      rootCollections: targetFirestore.rootCollections - sourceFirestore.rootCollections,
      collections: targetFirestore.collections - sourceFirestore.collections,
      documentsWithData: targetFirestore.documentsWithData - sourceFirestore.documentsWithData,
      missingDocumentsWithSubcollections:
        targetFirestore.missingDocumentsWithSubcollections - sourceFirestore.missingDocumentsWithSubcollections
    }
  });
} finally {
  await closeClients(source, target);
}
