import fs from 'node:fs/promises';
import { deleteApp } from 'firebase-admin/app';
import { abrirAlvo } from './inventario-backup.mjs';
const folder = process.argv[2];
if (!folder?.startsWith('tmp/ativacao-privada/')) throw new Error('Pasta privada necessária.');
const target = await abrirAlvo();
try {
    const { access_token } = await target.app.options.credential.getAccessToken();
    const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${target.projectId}/releases?pageSize=1`, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!response.ok) throw new Error(`Inventário Hosting recusado (${response.status}).`);
    const data = await response.json();
    if (!data.releases?.[0]?.version?.name) throw new Error('Versão anterior ausente.');
    await fs.writeFile(`${folder}/hosting-anterior.json`, JSON.stringify(data, null, 2));
    for (const [url, filename] of [['/', 'hosting-anterior.html'], ['/sw.js', 'sw-anterior.js.txt']]) {
        const r = await fetch(`https://${target.projectId}.web.app${url}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`Backup público recusado (${r.status}).`);
        await fs.writeFile(`${folder}/${filename}`, await r.text());
    }
    console.log('Versão anterior de Hosting e shell público preservados para rollback.');
} finally { await deleteApp(target.app); }
