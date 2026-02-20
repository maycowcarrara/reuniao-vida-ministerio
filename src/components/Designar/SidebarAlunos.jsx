import React from 'react';
import { X, FilterX, Search, SortAsc, SortDesc, User, UserRound, UsersRound, AlertTriangle, Clock } from 'lucide-react';

const SidebarAlunos = ({
    TT, buildSlotLabel, alunosFiltrados, slotAtivo, setSlotAtivo, 
    termoBusca, setTermoBusca, ordenacaoChave, setOrdenacaoChave, 
    ordemCrescente, setOrdemCrescente, filtroGenero, handleMudarGenero, 
    cargosMap, filtrosTiposAtivos, toggleFiltroTipo, lang, 
    atribuirAluno, calcularDiasDesdeUltimaParte, getHistoricoRecente, 
    isAlunoDuplicadoBySemanaKey, getSemanaKeyByFilteredIndex, getSemanaIndexContexto, getCargoInfo
}) => {
    return (
        <div className="lg:w-80 shrink-0 w-full lg:sticky lg:top-28 self-start">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
                <div className="p-4 bg-blue-700 text-white text-xs font-bold uppercase tracking-widest flex justify-between items-center shrink-0">
                    <div className="flex flex-col">
                        <span>{buildSlotLabel()}</span>
                        <span className="text-[9px] opacity-60 font-normal">
                            {alunosFiltrados.length} {TT.registros}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {slotAtivo && (
                            <button type="button" onClick={() => setSlotAtivo(null)} className="hover:bg-white/20 rounded p-1 transition" title="Cancelar">
                                <X size={16} />
                            </button>
                        )}
                        <button type="button" onClick={() => { setTermoBusca(''); handleMudarGenero('todos'); }} className="hover:bg-white/20 rounded p-1 transition" title="Limpar">
                            <FilterX size={16} />
                        </button>
                    </div>
                </div>

                {!slotAtivo ? (
                    <div className="px-4 py-2 bg-blue-50 text-blue-800 text-[11px] font-semibold border-b border-blue-100 shrink-0">
                        {TT.selecioneCampo}
                    </div>
                ) : (
                    <div className="px-3 pt-3 pb-2 border-b border-gray-200 bg-gray-50 shrink-0">
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                atribuirAluno(null); // Limpa o campo designado
                            }}
                            className="w-full py-2 px-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition flex items-center justify-center gap-2 shadow-sm"
                        >
                            <X size={14} /> Remover Designação Atual
                        </button>
                    </div>
                )}

                <div className="p-3 border-b bg-gray-50 space-y-3 shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Nome, cargo..."
                            className="w-full pl-8 pr-4 py-1.5 text-xs border rounded-md outline-none focus:ring-1 focus:ring-blue-400"
                            value={termoBusca}
                            onChange={(e) => setTermoBusca(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1 flex border rounded overflow-hidden">
                            <button type="button" onClick={() => setOrdenacaoChave(ordenacaoChave === 'nome' ? 'dias' : 'nome')} className="px-2 py-1 bg-white hover:bg-gray-100 flex-1 text-[10px] font-bold border-r">
                                {ordenacaoChave === 'nome' ? TT.ordem.nome : TT.ordem.dias}
                            </button>
                            <button type="button" onClick={() => setOrdemCrescente(!ordemCrescente)} className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-600">
                                {ordemCrescente ? <SortAsc size={14} /> : <SortDesc size={14} />}
                            </button>
                        </div>

                        <div className="flex border rounded overflow-hidden">
                            <button type="button" onClick={() => handleMudarGenero('M')} className={`px-2 py-1 transition ${filtroGenero === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-400'}`}>
                                <User size={14} />
                            </button>
                            <button type="button" onClick={() => handleMudarGenero('F')} className={`px-2 py-1 border-l transition ${filtroGenero === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-white text-gray-400'}`}>
                                <UserRound size={14} />
                            </button>
                            <button type="button" onClick={() => handleMudarGenero('todos')} className={`px-2 py-1 border-l transition ${filtroGenero === 'todos' ? 'bg-gray-200 text-gray-700' : 'bg-white text-gray-400'}`}>
                                <UsersRound size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                        {Object.keys(cargosMap || {}).filter(key => key !== 'desab').filter(key => (filtroGenero === 'todos' ? true : (cargosMap?.[key]?.gen === filtroGenero))).map((cKey) => (
                            <button
                                type="button"
                                key={cKey}
                                onClick={() => toggleFiltroTipo(cKey)}
                                className={["px-2 py-1 rounded-full text-[9px] font-bold border transition-all whitespace-nowrap", filtrosTiposAtivos.includes(cKey) ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-400 border-gray-100"].join(" ")}
                            >
                                {(cargosMap?.[cKey]?.[lang] || cargosMap?.[cKey]?.pt || cargosMap?.[cKey]?.es || cKey)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scroll bg-gray-50/20">
                    {alunosFiltrados.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Search size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-xs">Nenhum aluno encontrado</p>
                        </div>
                    ) : (
                        alunosFiltrados.map((aluno) => {
                            const semanaIdxFiltrado = getSemanaIndexContexto();
                            const semanaKey = getSemanaKeyByFilteredIndex(semanaIdxFiltrado);
                            const ja = semanaKey ? isAlunoDuplicadoBySemanaKey(aluno?.id, semanaKey) : false;
                            const dias = calcularDiasDesdeUltimaParte(aluno);
                            const historicoRecente = getHistoricoRecente(aluno, 6);
                            const cargoKey = aluno?.tipo;
                            const cargoInfo = getCargoInfo(cargoKey);
                            const podeClicar = !!slotAtivo;

                            return (
                                <button
                                    key={aluno?.id || aluno?.nome}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (!podeClicar) return;
                                        if (ja) {
                                            const ok = window.confirm(TT.confirmarDuplicado);
                                            if (!ok) return;
                                        }
                                        atribuirAluno(aluno);
                                    }}
                                    disabled={!podeClicar}
                                    className={[
                                        "w-full text-left p-2.5 rounded-xl border transition relative group shadow-sm flex flex-col gap-1",
                                        podeClicar ? "bg-white hover:shadow-md hover:border-blue-200" : "bg-gray-50 cursor-not-allowed",
                                        ja ? "border-amber-200" : "border-gray-200"
                                    ].join(" ")}
                                    title={!slotAtivo ? TT.selecioneCampo : ja ? TT.duplicadoTooltip : TT.cliquePara}
                                >
                                    <div className="flex items-start justify-between gap-2 w-full">
                                        <div className="min-w-0">
                                            <div className="font-bold text-xs text-gray-800 truncate flex items-center gap-1.5">
                                                <span className="truncate">{aluno?.nome || TT.semNome}</span>
                                                {ja && <AlertTriangle size={12} className="text-amber-600 shrink-0" />}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1 shrink-0">
                                            <span className={["text-[9px] font-black px-1.5 py-0.5 rounded-full border", cargoInfo?.cor || "bg-gray-100 text-gray-700 border-gray-200"].join(" ")}>
                                                {cargoInfo?.[lang] || cargoInfo?.pt || cargoInfo?.es || cargoKey || "—"}
                                            </span>
                                            {typeof dias === 'number' ? (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 inline-flex items-center gap-0.5">
                                                    <Clock size={10} /> {dias} {TT.dias}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 inline-flex items-center gap-0.5">
                                                    <Clock size={10} /> {TT.info.nunca}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {!!aluno?.observacoes && (
                                        <div className="bg-yellow-50 border border-yellow-100 rounded px-1.5 py-1 text-[10px] text-yellow-800 leading-tight italic w-full">
                                            {aluno.observacoes}
                                        </div>
                                    )}

                                    {historicoRecente.length > 0 && (
                                        <div className="mt-1.5 border-t border-gray-100 pt-1.5 w-full space-y-0.5">
                                            {historicoRecente.map((hist, i) => (
                                                <div key={i} className="flex justify-between items-center text-[9px] text-gray-400">
                                                    <span className="shrink-0 mr-2">{hist.data ? new Date(hist.data).toLocaleDateString() : '--/--'}</span>
                                                    <span className="truncate text-right font-medium text-gray-500" title={`${hist.parte || "—"}${hist.ajudante ? ` (${TT.com} ${hist.ajudante})` : ''}`}>
                                                        {hist.parte || "—"}
                                                        {hist.ajudante && <span className="text-gray-400 font-normal opacity-80"> ({TT.com} {hist.ajudante})</span>}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!slotAtivo && <div className="absolute inset-0 rounded-xl bg-white/40" />}
                                    <div className="absolute inset-y-0 right-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-xl" />
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default SidebarAlunos;