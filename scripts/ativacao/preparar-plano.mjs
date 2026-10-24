import fs from 'node:fs/promises';
import { hashEnsaio, prepararEnsaioMigracao, resumirEnsaio } from '../../src/utils/ensaioMigracaoGrupos.js';
import { criarFilaGrupo, planejarAgendaGrupo } from '../../src/utils/integracoesGrupo.js';
import { projetarQuadroPublico, medirPayloadPublico } from '../../src/utils/quadroPublico.js';

const folder = process.argv[2];
if (!folder?.startsWith('tmp/ativacao-privada/')) throw new Error('Pasta privada necessária.');
const backup = JSON.parse(await fs.readFile(`${folder}/backup.json`, 'utf8'));
const base = `users/${backup.ownerUid}/`;
const docs = name => backup.documents.filter(d => d.path.startsWith(base+name+'/') && d.path.split('/').length===4).map(d=>({...d.data,id:d.path.split('/').at(-1)}));
const configuracoes = docs('configuracoes').find(d=>d.id==='geral');
const programacoes = docs('programacao');
const privadas = docs('confirmacoes');
const publicas = backup.documents.filter(d=>d.path.startsWith('confirmacoes_publicas/')).map(d=>d.data);
const confirmacoes = [...new Map([...publicas, ...privadas].map(c=>[c.assignmentKey,c])).values()];
const snapshot = { configuracoes, alunos: docs('alunos'), historico_reunioes: programacoes, confirmacoes,
    vinculosAgenda: programacoes.map(p=>({programacaoId:p.id,grupoId:'grupo-portugues',origem:'contrato-IDs-v1-preservado'})) };
const plano = await prepararEnsaioMigracao(snapshot);
for (const passo of plano.passos) {
    if (passo.colecao === 'configuracoes') {
        passo.after.ativacaoMultiGrupos = { status: 'preparada', contrato: 2, autorizadaEm: new Date().toISOString() };
        passo.after.revisionProgramacoes = 0;
    }
    if (passo.colecao === 'historico_reunioes') {
        const original = programacoes.find(p=>p.id===passo.registroId);
        passo.after.identidadeLegada = { versao: 1, programacaoId: original.id,
            dataMeioSemana: original.dataExata || original.dataReuniao,
            ...(original.fimDeSemana?.data ? {dataFimDeSemana:original.fimDeSemana.data}:{}),
            partes: Object.fromEntries((original.partes||[]).map((p,i)=>[String(p.id),`parte${i}`])) };
    }
    passo.afterHash = await hashEnsaio(passo.after);
}
const {planHash:_hash,aplicavelLocalmente:_aplicavel,...conteudo}=plano;
plano.planHash=await hashEnsaio(conteudo);
const configFinal = plano.passos.find(p=>p.colecao==='configuracoes')?.after || configuracoes;
const programsFinal = programacoes.map(p=>plano.passos.find(s=>s.colecao==='historico_reunioes'&&s.registroId===p.id)?.after || p);
const fila = criarFilaGrupo({programacoes:programsFinal,config:configFinal,grupoId:'grupo-portugues',confirmacoes});
const agendaAntes = await planejarAgendaGrupo({programacoes:programacoes,config:configuracoes,grupoId:'grupo-portugues'});
const payload=projetarQuadroPublico({ownerUid:backup.ownerUid,configuracoes:configFinal,historico_reunioes:programsFinal});
const resumo = {...resumirEnsaio(plano), counts:{passos:plano.passos.length,confirmacoesPrivadas:privadas.length,confirmacoesPublicas:publicas.length,
    vinculosLegadosAtivosReusados:fila.filter(r=>r.confirmation.token).length,alvosAtivos:fila.length,idsAgendaAtivos:agendaAntes.length,payloadPublicoBytes:medirPayloadPublico(payload)},
    agenda:'IDs do contrato v1 inventariados e preservados; nenhum OAuth ou evento Google consultado/alterado',provedorRealValidado:false};
await fs.writeFile(`${folder}/snapshot-plano.json`,JSON.stringify(snapshot,null,2));
await fs.writeFile(`${folder}/plano.json`,JSON.stringify(plano,null,2));
await fs.writeFile(`${folder}/payload-publico-proposto.json`,JSON.stringify(payload,null,2));
await fs.writeFile(`${folder}/resumo-plano.json`,JSON.stringify(resumo,null,2));
console.log(JSON.stringify(resumo,null,2));
