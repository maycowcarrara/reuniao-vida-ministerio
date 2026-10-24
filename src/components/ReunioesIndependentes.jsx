import React, { useEffect, useRef, useState } from 'react';
import { getGrupoProgramacao } from '../utils/gruposProgramacao.js';
import { normalizeOcorrenciaReuniao } from '../utils/ocorrenciasReuniao.js';
import { prepararAgendamento, prepararGeracaoReunioes, prepararImportacaoMeioSemana, prepararEstadoOcorrencia, prepararEdicaoDiscurso, temOcorrencia } from '../utils/agendamentoReunioes.js';
import { extrairDados } from '../utils/importador/parser';
import { isLikelyHtml } from '../utils/importador/helpers';
import { useProtecaoTrocaGrupo } from '../hooks/useProtecaoTrocaGrupo.js';
import { dialog } from '../utils/dialog';
import { useSectionMessages } from '../i18n';

// Somente montado na barreira DEV da E2. Não importa serviços de dados/remotos.
export default function ReunioesIndependentes({ config, grupoId, programacoes, onExecutar, busy = false, importar = false }) {
    const T = useSectionMessages('reunioesIndependentes');
    const G = useSectionMessages('gruposProgramacao');
    const grupo = getGrupoProgramacao(grupoId, config);
    const [tipo, setTipo] = useState(importar || !grupo.fimDeSemana.habilitada ? 'meioSemana' : 'fimDeSemana');
    const [data, setData] = useState('');
    const [horario, setHorario] = useState('');
    const [inicio, setInicio] = useState('');
    const [fim, setFim] = useState('');
    const [texto, setTexto] = useState('');
    const [conteudo, setConteudo] = useState(null);
    const [previa, setPrevia] = useState(null);
    const [erro, setErro] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [processando, setProcessando] = useState(false);
    const pendente = useRef(false);
    const [edicao, setEdicao] = useState(null);
    const dirty = !!(data || horario || inicio || fim || texto || edicao || previa);
    const bloqueado = busy || processando;
    useProtecaoTrocaGrupo(async () => !pendente.current && (!dirty || await dialog.confirm({
        title: G.sairTitulo, message: G.sairMensagem, confirmText: G.sairConfirmar, cancelText: G.continuarEditando,
    })));
    useEffect(() => {
        if (!dirty) return;
        const proteger = e => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', proteger);
        return () => window.removeEventListener('beforeunload', proteger);
    }, [dirty]);
    const executar = async acao => {
        if (pendente.current) return;
        pendente.current = true; setProcessando(true); setErro(''); setMensagem('');
        try { await acao(); }
        catch (error) { setErro(error.message); }
        finally { pendente.current = false; setProcessando(false); }
    };
    const confirmar = preparar => executar(async () => {
        await onExecutar({ grupoId, preparar });
        setPrevia(null); setMensagem(T.salvo);
        setData(''); setHorario(''); setTexto(''); setConteudo(null); setInicio(''); setFim('');
    });
    const contexto = { programacoes, config, grupoId };
    const prepararManual = estado => {
        const resultado = prepararAgendamento({ ...estado, tipo, data, horario });
        if (resultado.status !== 'criar') throw new Error(T[resultado.status]);
        return resultado;
    };
    const prepararImport = estado => prepararImportacaoMeioSemana({ ...estado, dados: conteudo, data, horario });
    const campo = (label, type, value, setter) => <label className="block text-sm">{label}
        <input required type={type} value={value} onChange={e => { setter(e.target.value); setPrevia(null); }} className="block w-full border rounded-lg p-2 mt-1" />
    </label>;
    const mostrarPrevia = preparar => executar(async () => setPrevia(preparar(contexto)));
    return <section className="p-3 sm:p-6 space-y-4 max-w-4xl mx-auto">
        <h2 className="font-bold text-xl">{importar ? T.importar : T.titulo}</h2>
        <p className="text-sm">{grupo.nome} — {T.limite}</p>
        {erro && <p role="alert" className="p-3 bg-red-50 text-red-800 rounded-lg">{erro}</p>}
        {mensagem && <p role="status" className="p-3 bg-green-50 rounded-lg">{mensagem}</p>}
        <fieldset disabled={bloqueado} className="space-y-4 min-w-0">
            {(!importar || grupo.meioSemana.habilitada) && grupo.ativo && <>
                {!importar && <label className="block">{T.tipo}<select className="border rounded-lg p-2 ml-2" value={tipo} onChange={e => { setTipo(e.target.value); setPrevia(null); }}>
                    {['fimDeSemana', 'meioSemana'].filter(key => grupo[key].habilitada).map(key => <option key={key} value={key}>{G[key]}</option>)}
                </select></label>}
                {grupo[tipo].habilitada && <div className="bg-white border rounded-xl p-4 space-y-3">
                    <h3 className="font-bold">{importar ? T.importar : T.agendar}</h3>
                    <div className="grid sm:grid-cols-2 gap-3">{campo(T.data, 'date', data, setData)}{campo(G.horario, 'time', horario, setHorario)}</div>
                    {importar && <>
                        <label className="block">{T.texto}<textarea className="block border w-full rounded-lg p-2 h-36" value={texto} onChange={e => { setTexto(e.target.value); setConteudo(null); setPrevia(null); }} /></label>
                        <button type="button" onClick={() => executar(async () => {
                            const extraido = await extrairDados(texto, isLikelyHtml(texto) ? 'html' : 'texto', grupo.idioma);
                            if (!extraido?.partes?.length) throw new Error(T.semConteudo);
                            setConteudo(extraido); setPrevia(null);
                        })}>{T.extrair}</button>
                        {conteudo && <div className="space-y-1"><p>{conteudo.semana}</p><ol className="list-decimal pl-6">{conteudo.partes.map((parte, index) => <li key={index}>{parte.titulo}</li>)}</ol></div>}
                    </>}
                    <button type="button" className="border rounded-lg p-2" disabled={importar && !conteudo} onClick={() => mostrarPrevia(importar ? prepararImport : prepararManual)}>{T.prever}</button>
                    {previa && !previa.previa && <div className="border rounded-lg p-3 space-y-2"><p>{data} {horario} — {T.rascunho} {previa.evento?.tipo}</p>
                        <button type="button" className="bg-blue-600 text-white rounded-lg p-2" onClick={() => confirmar(importar ? prepararImport : prepararManual)}>{T.confirmar}</button></div>}
                </div>}
                {!importar && grupo[tipo].habilitada && grupo[tipo].frequencia === 'semanal' && <div className="border bg-white rounded-xl p-4 space-y-3">
                    <h3 className="font-bold">{T.gerar} — {G[tipo]}</h3>
                    <p>{grupo[tipo].dia} {grupo[tipo].horario}</p>
                    <div className="grid sm:grid-cols-2 gap-3">{campo(T.inicio, 'date', inicio, setInicio)}{campo(T.fim, 'date', fim, setFim)}</div>
                    <button type="button" className="border rounded-lg p-2" onClick={() => mostrarPrevia(estado => prepararGeracaoReunioes({ ...estado, tipo, inicio, fim }))}>{T.prever}</button>
                    {previa?.previa && <><ul className="space-y-1">{previa.previa.map(item => <li key={item.data}>{item.data} {item.horario} — {T[item.status]} {item.evento?.tipo}</li>)}</ul>
                        {!previa.previa.length && <p>{T.semDatas}</p>}
                        <button type="button" disabled={!previa.operacoes.length} className="bg-blue-600 text-white rounded-lg p-2" onClick={() => confirmar(estado => prepararGeracaoReunioes({ ...estado, tipo, inicio, fim }))}>{T.confirmar}</button></>}
                </div>}
            </>}
            {importar && !grupo.meioSemana.habilitada && <p>{T.desabilitada}</p>}
            {!importar && programacoes.map(programacao => <article key={programacao.id} className="border rounded-xl bg-white p-4 space-y-3">
                <h3 className="font-bold">{programacao.semana}</h3>
                {['meioSemana', 'fimDeSemana'].filter(key => temOcorrencia(programacao, key)).map(key => {
                    const ocorrencia = normalizeOcorrenciaReuniao(programacao, key, config);
                    return <div key={key} className="border rounded-lg p-3 space-y-2">
                        <p>{G[key]}: {ocorrencia.data} {ocorrencia.horario} — {ocorrencia.cancelada ? T.cancelada : ocorrencia.ativo ? T.ativa : T.rascunho}</p>
                        <p className="text-sm">{ocorrencia.publicada ? T.publicada : T.naoPublicada}</p>
                        {!grupo[key].habilitada && <p>{T.desabilitada}</p>}
                        {grupo.ativo && grupo[key].habilitada && !ocorrencia.cancelada && !programacao.arquivada && <div className="flex flex-wrap gap-3">
                            {!ocorrencia.ativo && <button type="button" onClick={() => confirmar(estado => prepararEstadoOcorrencia({ ...estado, programacaoId: programacao.id, tipo: key }))}>{T.ativar}</button>}
                            <button type="button" onClick={() => executar(async () => {
                                if (await dialog.confirm({ title: T.cancelar, message: T.confirmarCancelamento, confirmText: T.cancelar, cancelText: G.continuarEditando })) {
                                    await onExecutar({ grupoId, preparar: estado => prepararEstadoOcorrencia({ ...estado, programacaoId: programacao.id, tipo: key, cancelar: true }) });
                                }
                            })}>{T.cancelar}</button>
                            {key === 'fimDeSemana' && <button type="button" onClick={() => setEdicao({ id: programacao.id, ...programacao.fimDeSemana?.reuniaoPublica })}>{T.editar}</button>}
                        </div>}
                        {key === 'fimDeSemana' && <p className="text-sm">{programacao.fimDeSemana?.reuniaoPublica?.temaDiscurso} {programacao.fimDeSemana?.reuniaoPublica?.oradorNomeManual}</p>}
                    </div>;
                })}
            </article>)}
            {edicao && <div className="border bg-white rounded-xl p-4 space-y-3">
                {[['temaDiscurso', T.tema], ['oradorNomeManual', T.orador], ['congregacaoOrador', T.congregacao]].map(([key, label]) => <React.Fragment key={key}>{campo(label, 'text', edicao[key] || '', value => setEdicao({ ...edicao, [key]: value }))}</React.Fragment>)}
                <button type="button" onClick={() => executar(async () => {
                    await onExecutar({ grupoId, preparar: estado => {
                        return prepararEdicaoDiscurso({ ...estado, programacaoId: edicao.id, valores: edicao });
                    } }); setEdicao(null); setMensagem(T.salvo);
                })}>{G.salvar}</button>
                <button type="button" onClick={() => setEdicao(null)} className="ml-4">{G.cancelar}</button>
            </div>}
        </fieldset>
    </section>;
}
