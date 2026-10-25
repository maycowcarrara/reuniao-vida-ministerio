import * as firestore from 'firebase/firestore';
import { gruposRemotosAtivos } from '../utils/compatibilidadeGrupos.js';
import { getGrupoEfetivoId, validarParticipacaoAluno } from '../utils/gruposProgramacao.js';
import { hashEnsaio } from '../utils/ensaioMigracaoGrupos.js';
import { projetarQuadroPublico } from '../utils/quadroPublico.js';

export const limparIndefinidos = value => {
    if (Array.isArray(value)) return value.map(v => v === undefined ? null : limparIndefinidos(v));
    if (!value || Object.getPrototypeOf(value) !== Object.prototype) return value;
    return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k, limparIndefinidos(v)]));
};
const same = async (a,b) => await hashEnsaio(a) === await hashEnsaio(b);
const registro = snap => snap.exists() ? { ...snap.data(), id: snap.id } : null;

export function createRemoteGroupAdapter({ db, getOwnerUid, getEstado, sdk = firestore }) {
    let estadoAtual;
    const obterEstado = () => getEstado ? getEstado() : estadoAtual;
    const { doc, collection, getDocsFromServer, getDocFromServer, runTransaction, increment, serverTimestamp } = sdk;
    const refs = () => {
        const ownerUid = getOwnerUid();
        if (!ownerUid) throw new Error('Autenticação necessária.');
        return { ownerUid, config: doc(db, `users/${ownerUid}/configuracoes/geral`), base: `users/${ownerUid}` };
    };
    const requireActive = config => { if (!gruposRemotosAtivos(config)) throw new Error('Ativação multi-grupos remota não está habilitada.'); };
    const salvarLote = async ({ grupoId, upserts, excluirIds, anteriores = [] }) => {
        if (excluirIds.length > 8) throw new Error("Exclua no máximo oito programações por operação.");
        if (upserts.length + excluirIds.length > 400) throw new Error('Divida a operação em até 400 programações.');
        const r = refs();
        const ids = [...new Set([...upserts.map(p => p.id), ...excluirIds])];
        const esperados = new Map(anteriores.map(p => [String(p.id), p]));
        const configTela = obterEstado().configuracoes;
        await runTransaction(db, async tx => {
            const configSnap = await tx.get(r.config), config = configSnap.data();
            requireActive(config);
            if (!await same(config.grupos, configTela.grupos)) throw new Error('Configuração mudou; atualize a tela antes de salvar.');
            const destinos = ids.map(id => doc(db, `${r.base}/programacao/${id}`));
            const snapshots = await Promise.all(destinos.map(ref => tx.get(ref)));
            for (let i=0; i<ids.length; i++) {
                const atual = registro(snapshots[i]), expected = esperados.get(String(ids[i])) || null;
                if (!await same(atual, expected)) throw new Error('Programação mudou em outra sessão; atualize antes de salvar.');
                if (atual && getGrupoEfetivoId(atual, config) !== grupoId) throw new Error('Destino pertence a outro grupo.');
            }
            for (const p of upserts) {
                if (getGrupoEfetivoId(p, config) !== grupoId) throw new Error('Grupo do documento inválido.');
                tx.set(doc(db, `${r.base}/programacao/${p.id}`), limparIndefinidos(p));
            }
            for (const id of excluirIds) {
                tx.set(doc(db, `${r.base}/operacoes_programacao/${id}`), { versaoProgramacao: 2, ownerUid: r.ownerUid, grupoId,
                    programacaoId: id, tipo: 'excluir', at: serverTimestamp() });
                tx.delete(doc(db, `${r.base}/programacao/${id}`));
            }
            tx.update(r.config, { revisionProgramacoes: increment(1) });
        });
    };
    const salvarConfig = async config => {
        const r = refs(), esperado = obterEstado().configuracoes;
        await runTransaction(db, async tx => {
            const snap = await tx.get(r.config), atual = snap.data(); requireActive(atual);
            const semRevision = c => Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'revisionProgramacoes'));
            if (!await same(semRevision(atual), semRevision(esperado))) throw new Error('Configuração mudou em outra sessão; atualize a tela.');
            if (config.grupoLegadoId !== atual.grupoLegadoId) throw new Error('Grupo legado é imutável.');
            tx.set(r.config, { ...limparIndefinidos(config), revisionProgramacoes: increment(1) }, { merge: true });
        });
    };
    const salvarHistoricos = async (alunos, escopo) => {
        if (!escopo?.grupoId || !escopo.programacaoIds?.length) throw new Error('Histórico exige escopo explícito.');
        const r = refs(), estado = obterEstado();
        const alterados = [];
        for (const aluno of alunos) if (!await same(aluno.historico || [], estado.alunos.find(a => String(a.id) === String(aluno.id))?.historico || [])) alterados.push(aluno);
        if (alterados.length + escopo.programacaoIds.length > 400) throw new Error('Divida a sincronização em lotes menores.');
        if (!alterados.length) return;
        await runTransaction(db, async tx => {
            requireActive((await tx.get(r.config)).data());
            const programs = await Promise.all(escopo.programacaoIds.map(id => tx.get(doc(db, `${r.base}/programacao/${id}`))));
            for (const p of programs) if (!p.exists() || getGrupoEfetivoId(p.data(), estado.configuracoes) !== escopo.grupoId || !await same(registro(p), estado.historico_reunioes.find(x => String(x.id) === p.id))) throw new Error('Programação mudou durante a sincronização.');
            const people = await Promise.all(alterados.map(a => tx.get(doc(db, `${r.base}/alunos/${a.id}`))));
            for (const p of people) if (!await same(p.data()?.historico || [], estado.alunos.find(a => String(a.id) === p.id)?.historico || [])) throw new Error('Histórico mudou em outra sessão.');
            for (const aluno of alterados) tx.update(doc(db, `${r.base}/alunos/${aluno.id}`), { historico: limparIndefinidos(aluno.historico) });
        });
    };
    const salvarAluno = async (aluno, { original = null, historico = false } = {}) => {
        if (!aluno?.id) throw new Error('Identificador da pessoa ausente.');
        const r = refs(), ref = doc(db, `${r.base}/alunos/${aluno.id}`);
        const fields = historico ? ['historico'] : ['avatar', 'nome', 'tipo', 'telefone', 'email', 'familia', 'observacoes', 'datasIndisponiveis', 'partesHabilitadas', 'gruposParticipantes'];
        const patch = {};
        for (const field of fields) if (aluno[field] !== undefined && (!original || !await same(aluno[field], original[field] ?? null))) patch[field] = limparIndefinidos(aluno[field]);
        await runTransaction(db, async tx => {
            const configAtual = (await tx.get(r.config)).data();
            requireActive(configAtual);
            const snap = await tx.get(ref), atual = snap.data();
            if (!historico) validarParticipacaoAluno(aluno, configAtual, atual || null);
            if (!original) {
                const novo = { ...limparIndefinidos(aluno), historico: aluno.historico || [] };
                if (snap.exists()) {
                    if (await same(atual, novo)) return;
                    throw new Error('Identificador já cadastrado; a pessoa existente foi preservada.');
                }
                tx.set(ref, novo);
                return;
            }
            if (!snap.exists()) throw new Error('Pessoa removida em outra sessão.');
            for (const field of Object.keys(patch)) if (!await same(atual[field] ?? null, original[field] ?? null)) throw new Error('Este campo mudou em outra sessão; atualize antes de salvar.');
            if (Object.keys(patch).length) tx.update(ref, patch);
        });
    };
    const excluirAluno = async id => {
        const r = refs(), ref = doc(db, `${r.base}/alunos/${id}`);
        await runTransaction(db, async tx => {
            requireActive((await tx.get(r.config)).data());
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            if (snap.data().tipo !== 'desab') throw new Error('Somente pessoas desabilitadas podem ser excluídas. O cadastro atual foi preservado.');
            tx.delete(ref);
        });
    };
    const publicar = async () => {
        const r = refs();
        for (let tentativa=0; tentativa<3; tentativa++) {
            const configInicial = (await getDocFromServer(r.config)).data(); requireActive(configInicial);
            const lista = await getDocsFromServer(collection(db, `${r.base}/programacao`));
            try {
                return await runTransaction(db, async tx => {
                    const config = (await tx.get(r.config)).data(); requireActive(config);
                    if (config.revisionProgramacoes !== configInicial.revisionProgramacoes) throw new Error('quadro-obsoleto');
                    const snaps = await Promise.all(lista.docs.map(p => tx.get(p.ref)));
                    const payload = projetarQuadroPublico({ ownerUid: r.ownerUid, configuracoes: config,
                        historico_reunioes: snaps.filter(p => p.exists()).map(registro) });
                    tx.set(doc(db, `quadros_publicos/${r.ownerUid}`), limparIndefinidos(payload));
                    return { publicado: true };
                });
            } catch (error) { if (error.message !== 'quadro-obsoleto' || tentativa === 2) throw error; }
        }
    };
    return { salvarLote, salvarConfig, salvarHistoricos, salvarAluno, excluirAluno, publicar, atualizarEstado: estado => { estadoAtual = estado; } };
}
