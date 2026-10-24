import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { clientId, clientSecret, googleOrigin } from 'firebase-tools/lib/api.js';

const FIREBASE_TOOLS_PATH = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');

export async function getFirebaseToolsToken() {
    const raw = await fs.readFile(FIREBASE_TOOLS_PATH, 'utf8');
    const config = JSON.parse(raw);
    const tokens = config.tokens;
    if (!tokens) throw new Error('Nenhum token encontrado em firebase-tools.json. Faça login via firebase login.');

    let accessToken = tokens.access_token;
    const expiresAt = tokens.expires_at || 0;

    // Se o token estiver expirado ou perto de expirar, renova usando o refresh_token
    if (Date.now() >= expiresAt - 60000 && tokens.refresh_token) {
        const res = await fetch(`${googleOrigin()}/oauth2/v3/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId(),
                client_secret: clientSecret(),
                refresh_token: tokens.refresh_token,
                grant_type: 'refresh_token'
            })
        });

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Falha ao renovar token OAuth do Firebase CLI: ${res.status} ${errBody}`);
        }

        const data = await res.json();
        accessToken = data.access_token;
        tokens.access_token = data.access_token;
        tokens.expires_at = Date.now() + (data.expires_in * 1000);

        // Salva token renovado
        config.tokens = tokens;
        await fs.writeFile(FIREBASE_TOOLS_PATH, JSON.stringify(config, null, 2));
    }

    return {
        accessToken,
        userEmail: config.user?.email
    };
}

export async function createAdminDb(projectId = 'rvm-sbssc') {
    const appName = `admin-${projectId}`;
    const existing = getApps().find(a => a.name === appName);
    if (existing) return getFirestore(existing);

    const { accessToken } = await getFirebaseToolsToken();

    const app = initializeApp({
        projectId,
        credential: {
            getAccessToken: async () => {
                const { accessToken: currentToken } = await getFirebaseToolsToken();
                return {
                    access_token: currentToken,
                    expires_in: 3600
                };
            }
        }
    }, appName);

    return getFirestore(app);
}
