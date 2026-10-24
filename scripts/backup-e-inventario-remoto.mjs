import fs from 'node:fs/promises';
import path from 'node:path';
import { getFirebaseToolsToken } from './lib/firebaseAdminAuth.mjs';
import { prepararEnsaioMigracao, resumirEnsaio } from '../src/utils/ensaioMigracaoGrupos.js';

function fromFirestoreValue(val) {
    if (!val || typeof val !== 'object') return val;
    if ('stringValue' in val) return val.stringValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return parseFloat(val.doubleValue);
    if ('timestampValue' in val) return val.timestampValue;
    if ('nullValue' in val) return null;
    if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
    if ('mapValue' in val) return fromFirestoreFields(val.mapValue.fields || {});
    return val;
}

function fromFirestoreFields(fields) {
    const result = {};
    for (const [k, v] of Object.entries(fields)) {
        result[k] = fromFirestoreValue(v);
    }
    return result;
}

function parseDoc(doc) {
    if (!doc || !doc.name) return null;
    const parts = doc.name.split('/');
    const id = parts[parts.length - 1];
    return {
        id,
        ...fromFirestoreFields(doc.fields || {})
    };
}

async function fetchCollection(baseRestUrl, collectionPath, token) {
    const items = [];
    let pageToken = null;
    do {
        const url = new URL(`${baseRestUrl}/${collectionPath}`);
        url.searchParams.set('pageSize', '300');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 404) return [];
            const text = await res.text();
            throw new Error(`Erro ao listar ${collectionPath}: ${res.status} ${text}`);
        }

        const data = await res.json();
        const docs = (data.documents || []).map(parseDoc).filter(Boolean);
        items.push(...docs);
        pageToken = data.nextPageToken || null;
    } while (pageToken);

    return items;
}

async function fetchDoc(baseRestUrl, docPath, token) {
    const res = await fetch(`${baseRestUrl}/${docPath}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        if (res.status === 404) return null;
        const text = await res.text();
        throw new Error(`Erro ao buscar ${docPath}: ${res.status} ${text}`);
    }
    const data = await res.json();
    return parseDoc(data);
}

async function main() {
    console.log('== BACKUP E INVENTÁRIO DO BANCO REAL ==');
    const { accessToken, userEmail } = await getFirebaseToolsToken();
    console.log(`Autenticado: ${userEmail}`);

    const projectId = 'rvm-sbssc';
    const ownerUid = 'P8B0fY6m8JVjoLFGZEcXQ1uWsWs2';
    const baseRestUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    console.log(`Projeto: ${projectId}`);
    console.log(`Dono: ${ownerUid}\n`);

    console.log('1. Baixando configuracoes/geral...');
    const configGeral = await fetchDoc(baseRestUrl, `users/${ownerUid}/configuracoes/geral`, accessToken);

    console.log('2. Baixando lista de alunos/participantes...');
    const alunos = await fetchCollection(baseRestUrl, `users/${ownerUid}/alunos`, accessToken);
    console.log(`   -> ${alunos.length} alunos encontrados.`);

    console.log('3. Baixando programacoes...');
    const programacoes = await fetchCollection(baseRestUrl, `users/${ownerUid}/programacao`, accessToken);
    console.log(`   -> ${programacoes.length} semanas de programação encontradas.`);

    console.log('4. Baixando confirmacoes privadas...');
    const confirmacoes = await fetchCollection(baseRestUrl, `users/${ownerUid}/confirmacoes`, accessToken);
    console.log(`   -> ${confirmacoes.length} confirmações privadas encontradas.`);

    console.log('5. Baixando confirmacoes publicas...');
    const confirmacoesPublicas = await fetchCollection(baseRestUrl, 'confirmacoes_publicas', accessToken);
    const confirmacoesPublicasDono = confirmacoesPublicas.filter(c => c.ownerUid === ownerUid);
    console.log(`   -> ${confirmacoesPublicas.length} confirmações públicas totais (${confirmacoesPublicasDono.length} deste dono).`);

    console.log('6. Baixando quadro publico...');
    const quadroPublico = await fetchDoc(baseRestUrl, `quadros_publicos/${ownerUid}`, accessToken);
    console.log(`   -> Quadro público: ${quadroPublico ? 'encontrado' : 'não encontrado'}.`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(backupDir, { recursive: true });

    const backupFile = path.join(backupDir, `backup-${projectId}-${timestamp}.json`);
    const snapshot = {
        projectId,
        ownerUid,
        exportedAt: new Date().toISOString(),
        configuracoes: configGeral || {},
        alunos,
        historico_reunioes: programacoes,
        confirmacoes,
        confirmacoes_publicas: confirmacoesPublicasDono,
        quadro_publico: quadroPublico
    };

    await fs.writeFile(backupFile, JSON.stringify(snapshot, null, 2));
    console.log(`\n✅ Backup gravado com sucesso: ${backupFile}`);

    console.log('\n7. Executando inventário e análise de migração...');
    const plano = await prepararEnsaioMigracao(snapshot);
    const resumo = resumirEnsaio(plano);

    const relatorioFile = path.join(backupDir, `inventario-${projectId}-${timestamp}.json`);
    await fs.writeFile(relatorioFile, JSON.stringify({
        resumo,
        estatisticas: {
            totalAlunos: alunos.length,
            totalProgramacoes: programacoes.length,
            totalConfirmacoes: confirmacoes.length,
            programacoesPorGrupo: programacoes.reduce((acc, p) => {
                const g = p.grupoId || '(sem grupo / legado)';
                acc[g] = (acc[g] || 0) + 1;
                return acc;
            }, {}),
            alunosComGrupo: alunos.filter(a => Array.isArray(a.gruposParticipantes)).length,
            alunosSemCampoGrupo: alunos.filter(a => a.gruposParticipantes === undefined).length
        },
        bloqueios: plano.erros,
        avisos: plano.avisos,
        passosPendentes: plano.passos.length
    }, null, 2));

    console.log(`✅ Relatório de inventário gravado: ${relatorioFile}`);
    console.log('\n--- RESUMO DO INVENTÁRIO ---');
    console.log(`- Bloqueios críticos: ${plano.erros.length} ${plano.erros.length ? '(' + plano.erros.join(', ') + ')' : ''}`);
    console.log(`- Avisos informativos: ${plano.avisos.length} ${plano.avisos.length ? '(' + plano.avisos.join(', ') + ')' : ''}`);
    console.log(`- Passos necessários para migração: ${plano.passos.length}`);
    console.log(`- Aplicável com segurança: ${plano.aplicavelLocalmente ? 'SIM' : 'NÃO'}`);
}

main().catch(err => {
    console.error('Falha na operação:', err);
    process.exit(1);
});
