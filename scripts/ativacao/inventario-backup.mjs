import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { loadEnv } from 'vite';

export function encode(value) {
    if (value instanceof Timestamp) return { __rvmType: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
    if (value instanceof GeoPoint) return { __rvmType: 'geopoint', latitude: value.latitude, longitude: value.longitude };
    if (value instanceof DocumentReference) return { __rvmType: 'reference', path: value.path };
    if (Buffer.isBuffer(value)) return { __rvmType: 'bytes', base64: value.toString('base64') };
    if (value instanceof Date) return { __rvmType: 'date', iso: value.toISOString() };
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, encode(v)]));
    return value;
}
export function decode(value, db) {
    if (value?.__rvmType === 'timestamp') return new Timestamp(value.seconds, value.nanoseconds);
    if (value?.__rvmType === 'geopoint') return new GeoPoint(value.latitude, value.longitude);
    if (value?.__rvmType === 'reference') return db.doc(value.path);
    if (value?.__rvmType === 'bytes') return Buffer.from(value.base64, 'base64');
    if (value?.__rvmType === 'date') return new Date(value.iso);
    if (Array.isArray(value)) return value.map(v => decode(v, db));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, decode(v, db)]));
    return value;
}

export async function abrirAlvo() {
    const env = loadEnv('production', process.cwd(), 'VITE_');
    const rc = JSON.parse(await fs.readFile('.firebaserc', 'utf8'));
    const key = JSON.parse(await fs.readFile('rvm-sbssc-firebase-adminsdk-fbsvc-131d05c7d0.json', 'utf8'));
    if (env.VITE_FIREBASE_PROJECT_ID !== 'rvm-sbssc' || key.project_id !== 'rvm-sbssc' || rc.projects.default !== 'rvm-sbssc') throw new Error('Alvos locais divergentes.');
    const ownerUid = env.VITE_ADMIN_UID;
    if (!ownerUid || ownerUid !== env.VITE_OWNER_UID) throw new Error('Dono precisa ser definido inequivocamente.');
    const app = initializeApp({ credential: cert(key), projectId: key.project_id }, `ativacao-${Date.now()}`);
    return { app, db: getFirestore(app), ownerUid, projectId: key.project_id };
}

export async function inventariar() {
    const target = await abrirAlvo();
    const docs = new Map();
    const add = snap => { if (snap.exists) docs.set(snap.ref.path, { path: snap.ref.path, updateTime: encode(snap.updateTime), data: encode(snap.data()) }); };
    try {
        const root = target.db.doc(`users/${target.ownerUid}`);
        const walk = async ref => {
            add(await ref.get());
            for (const col of await ref.listCollections()) for (const doc of await col.listDocuments()) await walk(doc);
        };
        await walk(root);
        add(await target.db.doc(`quadros_publicos/${target.ownerUid}`).get());
        for (const name of ['confirmacoes_publicas', 'notificacoes']) {
            const snap = await target.db.collection(name).where('ownerUid', '==', target.ownerUid).get();
            snap.docs.forEach(add);
        }
        const data = { format: 'rvm-backup-v1', projectId: target.projectId, ownerUid: target.ownerUid, createdAt: new Date().toISOString(), documents: [...docs.values()] };
        const folder = `tmp/ativacao-privada/${new Date().toISOString().replaceAll(':','-')}`;
        await fs.mkdir(folder, { recursive: true });
        const raw = JSON.stringify(data, null, 2);
        await fs.writeFile(`${folder}/backup.json`, raw, { flag: 'wx' });
        const prefix = `users/${target.ownerUid}/`;
        const collection = name => data.documents.filter(d => d.path.startsWith(prefix + name + '/') && d.path.split('/').length === 4).map(d => ({ ...d.data, id: d.path.split('/').at(-1) }));
        const config = collection('configuracoes').find(d => d.id === 'geral') || {};
        const programs = collection('programacao');
        const summary = { projectId: target.projectId, ownerUid: target.ownerUid, folder, backupSha256: createHash('sha256').update(raw).digest('hex'), documents: docs.size,
            counts: { configuracoes: collection('configuracoes').length, alunos: collection('alunos').length, programacoes: programs.length, confirmacoes: collection('confirmacoes').length,
                publicas: data.documents.filter(d => d.path.startsWith('confirmacoes_publicas/')).length },
            config: { idioma: config.idioma, versaoProgramacao: config.versaoProgramacao || 1, grupoLegadoId: config.grupoLegadoId || null },
            programas: { v2: programs.filter(p => p.grupoId || p.versaoProgramacao >= 2).length, agendaSincronizada: programs.filter(p => p.agendaSincronizadaEm).length,
                semDataExplicita: programs.filter(p => !(p.meioSemana?.data || p.dataReuniao || p.dataExata)).length,
                comTimestamp: JSON.stringify(programs).includes('__rvmType'), arquivadas: programs.filter(p => p.arquivada).length } };
        await fs.writeFile(`${folder}/resumo.json`, JSON.stringify(summary, null, 2));
        console.log(JSON.stringify(summary, null, 2));
        return { data, summary };
    } finally { await deleteApp(target.app); }
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/inventario-backup.mjs')) await inventariar();
