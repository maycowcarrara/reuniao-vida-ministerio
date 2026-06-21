import {
  assertDifferentProjects,
  assertExecuteAllowed,
  closeClients,
  createAdminClients,
  firestoreTypes,
  logHeader,
  parseArgs
} from './common.mjs';

const options = parseArgs();
const source = createAdminClients('source-firestore', options.sourceKey);
const target = createAdminClients('target-firestore', options.targetKey);

assertDifferentProjects(source, target);
assertExecuteAllowed(options, 'a migracao do Firestore');
logHeader('Migracao Firestore', source, target, options);

const stats = {
  collections: 0,
  documentsWithData: 0,
  missingDocumentsWithSubcollections: 0,
  writeOps: 0,
  referencesRewritten: 0
};

const writer = options.execute ? target.db.bulkWriter() : null;

if (writer) {
  writer.onWriteError((error) => {
    if (error.failedAttempts < 3) {
      console.warn(`Retry Firestore (${error.failedAttempts}) em ${error.documentRef.path}: ${error.message}`);
      return true;
    }
    console.error(`Falha definitiva em ${error.documentRef.path}: ${error.message}`);
    return false;
  });
}

function mapValueForTarget(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof firestoreTypes.DocumentReference) {
    stats.referencesRewritten += 1;
    return target.db.doc(value.path);
  }
  if (
    value instanceof firestoreTypes.Timestamp ||
    value instanceof firestoreTypes.GeoPoint ||
    Buffer.isBuffer(value) ||
    value instanceof Date
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(mapValueForTarget);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [key, mapValueForTarget(childValue)])
    );
  }
  return value;
}

async function listRootCollections() {
  if (options.rootCollections.length > 0) {
    return options.rootCollections.map((collectionId) => source.db.collection(collectionId));
  }
  return source.db.listCollections();
}

async function migrateCollection(sourceCollectionRef, targetCollectionRef, depth = 0) {
  stats.collections += 1;
  if (options.verbose) {
    console.log(`${'  '.repeat(depth)}Colecao: ${sourceCollectionRef.path}`);
  }

  const sourceDocumentRefs = await sourceCollectionRef.listDocuments();
  for (const sourceDocumentRef of sourceDocumentRefs) {
    const sourceSnapshot = await sourceDocumentRef.get();
    const targetDocumentRef = targetCollectionRef.doc(sourceDocumentRef.id);

    if (sourceSnapshot.exists) {
      stats.documentsWithData += 1;
      stats.writeOps += 1;

      if (options.execute) {
        writer.set(targetDocumentRef, mapValueForTarget(sourceSnapshot.data()), { merge: false });
      } else if (options.verbose) {
        console.log(`${'  '.repeat(depth + 1)}Documento: ${sourceDocumentRef.path}`);
      }
    } else {
      stats.missingDocumentsWithSubcollections += 1;
    }

    const subcollections = await sourceDocumentRef.listCollections();
    for (const sourceSubcollectionRef of subcollections) {
      await migrateCollection(
        sourceSubcollectionRef,
        targetDocumentRef.collection(sourceSubcollectionRef.id),
        depth + 1
      );
    }
  }
}

try {
  const rootCollections = await listRootCollections();
  console.log(`Colecoes raiz encontradas: ${rootCollections.map((item) => item.id).join(', ') || '(nenhuma)'}`);

  for (const sourceCollectionRef of rootCollections) {
    await migrateCollection(
      sourceCollectionRef,
      target.db.collection(sourceCollectionRef.id)
    );
  }

  if (writer) {
    await writer.close();
  }

  console.log('\nResumo Firestore:');
  console.table(stats);

  if (!options.execute) {
    console.log('\nNada foi gravado. Para migrar de verdade: npm run migrate:firestore');
  }
} finally {
  await closeClients(source, target);
}
