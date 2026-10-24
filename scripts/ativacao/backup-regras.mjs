import fs from 'node:fs/promises';
import { deleteApp } from 'firebase-admin/app';
import { abrirAlvo } from './inventario-backup.mjs';
const folder = process.argv[2];
if (!folder?.startsWith('tmp/ativacao-privada/')) throw new Error('Pasta privada de backup necessária.');
const target = await abrirAlvo();
try {
    const token = await target.app.options.credential.getAccessToken();
    const read = async path => {
        const res = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`Backup Rules: HTTP ${res.status}.`);
        return res.json();
    };
    const release = await read(`projects/${target.projectId}/releases/cloud.firestore`);
    const ruleset = await read(release.rulesetName);
    await fs.writeFile(`${folder}/rules-anteriores.json`, JSON.stringify({ release, ruleset }, null, 2), { flag: 'wx' });
    console.log('Rules publicadas anteriores preservadas no backup privado.');
} finally { await deleteApp(target.app); }
