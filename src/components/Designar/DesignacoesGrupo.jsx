import React, { useEffect, useRef, useState } from 'react';
import { listarSlotsReuniao, prepararAtribuicaoGrupo, classificarCandidatosGrupo, avaliarConflitosGrupo, avaliarElegibilidadeGrupo } from '../../utils/designacoesPorGrupo.js';
import { getGrupoEfetivoId, participaDoGrupo } from '../../utils/gruposProgramacao.js';
import { normalizeOcorrenciaReuniao, TIPOS_REUNIAO } from '../../utils/ocorrenciasReuniao.js';
import { getAssignmentCapabilityForSlot, getAssignmentCapabilityLabel } from '../../utils/assignmentEligibility.js';
import { useSectionMessages } from '../../i18n';
import { dialog } from '../../utils/dialog';
import { useProtecaoTrocaGrupo } from '../../hooks/useProtecaoTrocaGrupo.js';
import CelebracaoEditor from '../Celebracao.jsx';

// Designar operacional do ensaio. Todos os caminhos usam a mesma preparação;
// o Designar legado permanece isolado até a adaptação pública/de integrações.
export default function DesignacoesGrupo({ programacoes, alunos, config, grupoId, cargosMap, onExecutar, busy, onCadastro }) {
    const T = useSectionMessages('operacaoGrupo');
    const G = useSectionMessages('gruposProgramacao');
    const lang = config.grupos[grupoId].idioma;
    const [alvo, setAlvo] = useState(null);
    const [pessoaId, setPessoaId] = useState('');
    const [erro, setErro] = useState('');
    const [salvo, setSalvo] = useState(false);
    const [pendente, setPendente] = useState(false);
    const pendingRef = useRef(false);
    const dragRef = useRef(null);
    useProtecaoTrocaGrupo(async () => !pendingRef.current && (!alvo || await dialog.confirm({ title: G.sairTitulo,
        message: G.sairMensagem, confirmText: G.sairConfirmar, cancelText: G.continuarEditando })));
    useEffect(() => {
        if (!alvo) return;
        const proteger = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', proteger);
        return () => window.removeEventListener('beforeunload', proteger);
    }, [alvo]);
    const escolher = (programacao, tipo, slot) => { setAlvo({ programacaoId: programacao.id, tipo, slotId: slot.slotId, pessoaAnteriorId: String(slot.pessoa?.id ?? '') }); setPessoaId(''); setErro(''); };
    const programacao = programacoes.find(item => item.id === alvo?.programacaoId);
    const slot = programacao && listarSlotsReuniao(programacao, alvo.tipo, { config }).find(item => item.slotId === alvo.slotId);
    const candidatos = slot ? classificarCandidatosGrupo({ alunos, programacoes, config, grupoId, programacao,
        tipo: alvo.tipo, slot, cargosMap, lang }) : [];
    const atribuir = async (destino, alunoId) => {
        if (pendingRef.current || busy) return;
        pendingRef.current = true; setPendente(true); setErro(''); setSalvo(false);
        try {
            const reuniao = programacoes.find(item => item.id === destino.programacaoId);
            const conflitos = alunoId == null ? [] : avaliarConflitosGrupo({ programacoes, config, programacao: reuniao,
                tipo: destino.tipo, slotId: destino.slotId, alunoId });
            const avisos = conflitos.filter(item => item.nivel !== 'bloqueio');
            let confirmarAvisos = false;
            if (avisos.length) confirmarAvisos = await dialog.confirm({ title: T.avisos, message: avisos.map(item =>
                `${item.principalIncompativel ? T.principalIncompativel : T[item.nivel]}: ${G[config.grupos[item.grupoId]?.idioma] || item.grupoId} — ${item.reuniao.data} ${item.reuniao.horario} (${item.slotKey})`).join('\n'),
                confirmText: T.confirmarAvisos, cancelText: G.continuarEditando });
            if (avisos.length && !confirmarAvisos) return;
            await onExecutar({ grupoId, preparar: estado => prepararAtribuicaoGrupo({ ...estado, ...destino, alunoId,
                cargosMap, lang, confirmarAvisos }) });
            setAlvo(null); setPessoaId(''); setSalvo(true);
        } catch (error) { setErro(error.message); }
        finally { pendingRef.current = false; setPendente(false); }
    };
    const doGrupo = programacoes.filter(item => getGrupoEfetivoId(item, config) === grupoId);
    const participantes = alunos.filter(aluno => participaDoGrupo(aluno, grupoId, config));
    return <section className="p-3 sm:p-6 space-y-4 border-t">
        <h2 className="font-bold text-xl">{T.titulo}</h2>
        <p>{T.limite}</p>
        {!participantes.length && <div role="status" className="p-3 bg-amber-50 rounded-xl">{T.semParticipantes} <button onClick={onCadastro} className="underline">{T.cadastro}</button></div>}
        {erro && <p role="alert" className="p-3 bg-red-50 text-red-800 rounded-xl">{erro}</p>}
        {salvo && <p role="status">{T.salvo}</p>}
        <fieldset disabled={busy || pendente} className="space-y-4">
            {doGrupo.map(semana => <article key={semana.id} className="border bg-white rounded-xl p-4 space-y-4">
                <h3 className="font-bold">{semana.semana}</h3>
                {TIPOS_REUNIAO.map(tipo => {
                    const reuniao = normalizeOcorrenciaReuniao(semana, tipo, config);
                    if (reuniao.celebracao) return <CelebracaoEditor key={tipo} programa={semana} programacoes={programacoes} config={config} alunos={alunos} cargosMap={cargosMap} onExecutar={onExecutar} busy={busy} />;
                    if (!reuniao.operacional || semana.arquivada) return <p key={tipo} className="text-sm text-slate-500">{G[tipo]} — {reuniao.cancelada ? T.cancelada : reuniao.bloqueadaPorEvento ? T.eventoBloqueante : T.inativa}</p>;
                    return <div key={tipo} className="border rounded-xl p-3 space-y-2">
                        <h4 className="font-bold">{G[tipo]} — {reuniao.data} {reuniao.horario}</h4>
                        {listarSlotsReuniao(semana, tipo, { config }).map(s => {
                            const label = getAssignmentCapabilityLabel(getAssignmentCapabilityForSlot({ parte: s.parte, slotKey: s.slotKey }), lang);
                            const pessoa = alunos.find(item => String(item.id) === String(s.pessoa?.id));
                            const aviso = s.pessoa && (!pessoa || !avaliarElegibilidadeGrupo({ aluno: pessoa, alunos, programacao: semana, tipo,
                                slot: s, grupoId, config, cargosMap, lang }).eligible);
                            const destino = { programacaoId: semana.id, tipo, slotId: s.slotId, pessoaAnteriorId: String(s.pessoa?.id ?? '') };
                            return <div key={s.slotId} className="border p-3 rounded-lg space-y-1" onDragOver={event => event.preventDefault()} onDrop={event => {
                                event.preventDefault(); const id = dragRef.current; dragRef.current = null; if (id != null) atribuir(destino, id);
                            }}>
                                <p className="text-sm">{s.parte?.titulo} — {s.slotKey === 'ajudante' ? T.ajudante : label}</p>
                                <p className="font-semibold">{s.pessoa?.nome || T.vago}</p>
                                {aviso && <p role="status" className="text-amber-800">{T.revisarExistente}</p>}
                                <div className="flex gap-3 text-sm">
                                    <button type="button" onClick={() => escolher(semana, tipo, s)}>{s.pessoa ? T.substituir : T.designar}</button>
                                    {s.pessoa && <button type="button" onClick={() => atribuir(destino, null)}>{T.remover}</button>}
                                </div>
                            </div>;
                        })}
                    </div>;
                })}
            </article>)}
            {alvo && slot && <div className="border-2 border-blue-300 rounded-xl p-4 bg-white space-y-3">
                <h3 className="font-bold">{T.escolher}</h3>
                {!candidatos.length && <p>{T.semElegiveis}</p>}
                <label>{T.manual}<select className="block border rounded-lg p-2 w-full" value={pessoaId} onChange={event => setPessoaId(event.target.value)}>
                    <option value="">{T.escolher}</option>{candidatos.map(({ aluno }) => <option key={aluno.id} value={String(aluno.id)}>{aluno.nome}</option>)}
                </select></label>
                <button disabled={!pessoaId} onClick={() => atribuir(alvo, pessoaId)} className="border rounded-lg p-2">{T.aplicar}</button>
                <h4 className="font-bold">{T.sugestoes}</h4>
                <ul className="space-y-2">{candidatos.map(item => <li key={item.aluno.id} draggable onDragStart={event => { dragRef.current = item.aluno.id; event.dataTransfer.setData('text/plain', String(item.aluno.id)); }} onDragEnd={() => { dragRef.current = null; }} className="border rounded-lg p-2">
                    <button type="button" onClick={() => atribuir(alvo, item.aluno.id)}>{item.aluno.nome}</button>
                    <p className="text-xs">{T.ultima}: {item.ultimaData || T.estreia} · {T.cargaSemana}: {item.cargaSemana} · {T.cargaTotal}: {item.cargaTotal}{item.familiaOcupada ? ` · ${T.familia}` : ''}</p>
                    {item.conflitos.map((conflito, index) => <p key={index} className="text-xs text-amber-800">{T[conflito.nivel]} — {conflito.grupoId}, {conflito.reuniao.data} {conflito.reuniao.horario}</p>)}
                </li>)}</ul>
                <button type="button" onClick={() => setAlvo(null)}>{G.cancelar}</button>
            </div>}
        </fieldset>
    </section>;
}
