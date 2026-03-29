import React, { useMemo } from 'react';
import { X, FilterX, Search, SortAsc, SortDesc, User, UserRound, UsersRound, AlertTriangle, Clock, GripVertical, CalendarX } from 'lucide-react';
import { useSectionMessages } from '../../i18n';

// Função para gerar as iniciais caso não tenha foto
const getIniciais = (nome) => {
    if (!nome) return '';
    const ignorar = ['de', 'da', 'do', 'dos', 'das'];
    const partes = nome.trim().split(' ').filter(p => p.length > 0 && !ignorar.includes(p.toLowerCase()));
    if (partes.length === 0) return '';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    const primeira = partes[0].charAt(0).toUpperCase();
    const ultima = partes[partes.length - 1].charAt(0).toUpperCase();
    return `${primeira}${ultima}`;
};

const SidebarAlunos = ({
    TT, buildSlotLabel, alunosFiltrados, slotAtivo, setSlotAtivo,
    termoBusca, setTermoBusca, ordenacaoChave, setOrdenacaoChave,
    ordemCrescente, setOrdemCrescente, filtroGenero, handleMudarGenero,
    cargosMap, filtrosTiposAtivos, toggleFiltroTipo, setFiltrosTiposAtivos, lang, // <-- Adicionado setFiltrosTiposAtivos aqui
    atribuirAluno, calcularDiasDesdeUltimaParte, getHistoricoRecente,
    isAlunoDuplicadoBySemanaKey, getSemanaKeyByFilteredIndex, getSemanaIndexContexto, getCargoInfo,
    setDraggedAluno, semanasSelecionadas
}) => {

    const localTx = useSectionMessages('designarSidebar');

    const getBadgeDiasColor = (dias) => {
        if (dias === null || dias === undefined) return "bg-red-50 text-red-700 border-red-200";
        if (dias < 0) return "bg-blue-50 text-blue-700 border-blue-200";
        if (dias > 90) return "bg-red-50 text-red-700 border-red-200";
        if (dias > 50) return "bg-orange-50 text-orange-700 border-orange-200";
        return "bg-gray-100 text-gray-700 border-gray-200";
    };

    const verificarIndisponibilidade = (aluno, semanaKey) => {
        if (!semanaKey || !aluno?.datasIndisponiveis || !Array.isArray(aluno.datasIndisponiveis) || aluno.datasIndisponiveis.length === 0) return null;

        try {
            let dataBaseStr = null;
            const key = String(semanaKey).toLowerCase();

            if (/^\d{4}-\d{2}-\d{2}/.test(key)) {
                dataBaseStr = key.substring(0, 10);
            } else {
                const matchDia = key.match(/^(\d{1,2})/);
                const matchMes = key.match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/);

                if (matchDia && matchMes) {
                    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
                    const dia = parseInt(matchDia[1], 10);
                    const mesIdx = meses.indexOf(matchMes[1]);

                    let ano = new Date().getFullYear();
                    const mesAtual = new Date().getMonth();

                    if (mesAtual === 11 && mesIdx === 0) ano++;
                    if (mesAtual === 0 && mesIdx === 11) ano--;

                    dataBaseStr = `${ano}-${String(mesIdx + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                }
            }

            if (!dataBaseStr) return null;

            const [sAno, sMes, sDia] = dataBaseStr.split('-');

            const dFimSemana = new Date(Date.UTC(sAno, sMes - 1, sDia));
            dFimSemana.setUTCDate(dFimSemana.getUTCDate() + 6);

            const strFimSemana = `${dFimSemana.getUTCFullYear()}-${String(dFimSemana.getUTCMonth() + 1).padStart(2, '0')}-${String(dFimSemana.getUTCDate()).padStart(2, '0')}`;

            for (const dt of aluno.datasIndisponiveis) {
                if (!dt.inicio || !dt.fim) continue;

                const vInicio = String(dt.inicio).substring(0, 10);
                const vFim = String(dt.fim).substring(0, 10);

                if (dataBaseStr <= vFim && strFimSemana >= vInicio) {
                    return dt;
                }
            }
        } catch (e) {
            console.error("Erro ao validar datas de indisponibilidade:", e);
            return null;
        }
        return null;
    };

    const semanaIdxCtx = typeof getSemanaIndexContexto === 'function' ? getSemanaIndexContexto() : null;
    const currentSemanaKey = typeof getSemanaKeyByFilteredIndex === 'function' ? getSemanaKeyByFilteredIndex(semanaIdxCtx) : null;

    const alunosProcessados = useMemo(() => {
        return [...alunosFiltrados].sort((a, b) => {
            const indA = (slotAtivo && verificarIndisponibilidade(a, currentSemanaKey)) ? 1 : 0;
            const indB = (slotAtivo && verificarIndisponibilidade(b, currentSemanaKey)) ? 1 : 0;
            return indA - indB;
        });
    }, [alunosFiltrados, currentSemanaKey, slotAtivo]);

    // LÓGICA CONSOLIDADA PARA LIMPAR TODOS OS FILTROS
    const handleLimparFiltros = () => {
        if (setTermoBusca) setTermoBusca('');
        if (handleMudarGenero) handleMudarGenero('todos');

        // Se o componente pai enviou a função de setFiltrosTiposAtivos
        if (typeof setFiltrosTiposAtivos === 'function') {
            setFiltrosTiposAtivos([]);
        }
        // Fallback: se não tiver enviado, usamos o próprio toggle para desligar um por um
        else if (typeof toggleFiltroTipo === 'function' && Array.isArray(filtrosTiposAtivos)) {
            filtrosTiposAtivos.forEach(cKey => toggleFiltroTipo(cKey));
        }
    };

    const hasActiveFilters = termoBusca !== '' || filtroGenero !== 'todos' || (filtrosTiposAtivos && filtrosTiposAtivos.length > 0);

    return (
        <div className="lg:w-80 shrink-0 w-full lg:sticky lg:top-45 self-start">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
                <div className="p-4 bg-blue-700 text-white text-xs font-bold uppercase tracking-widest flex justify-between items-center shrink-0">
                    <div className="flex flex-col">
                        <span>{buildSlotLabel()}</span>
                        <span className="text-[9px] opacity-60 font-normal">
                            {alunosProcessados.length} {TT.registros}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {slotAtivo && (
                            <button type="button" onClick={() => setSlotAtivo(null)} className="hover:bg-white/20 rounded p-1 transition" title={localTx.cancelar}>
                                <X size={16} />
                            </button>
                        )}
                        <button type="button" onClick={handleLimparFiltros} className="hover:bg-white/20 rounded p-1 transition" title={localTx.limpar}>
                            <FilterX size={16} />
                        </button>
                    </div>
                </div>

                {!slotAtivo ? (
                    <div className="px-4 py-2 bg-blue-50 text-blue-800 text-[11px] font-semibold border-b border-blue-100 shrink-0">
                        {TT.selecioneCampo} {localTx.ouArraste}
                    </div>
                ) : (
                    <div className="px-3 pt-3 pb-2 border-b border-gray-200 bg-gray-50 shrink-0">
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                atribuirAluno(null);
                            }}
                            className="w-full py-2 px-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition flex items-center justify-center gap-2 shadow-sm"
                        >
                            <X size={14} /> {localTx.removerDesignacao}
                        </button>
                    </div>
                )}

                <div className="p-3 border-b bg-gray-50 space-y-3 shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder={localTx.buscaPlaceholder}
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
                    {alunosProcessados.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                            <Search size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-xs mb-3">{localTx.nenhumAluno}</p>
                            {hasActiveFilters && (
                                <button
                                    onClick={handleLimparFiltros}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold hover:bg-gray-300 transition flex items-center gap-1.5"
                                >
                                    <FilterX size={14} /> {localTx.limparTodos}
                                </button>
                            )}
                        </div>
                    ) : (
                        alunosProcessados.map((aluno) => {
                            let duplicadoMesmaSemana = false;
                            let duplicadoOutraSemana = false;

                            const indisponivel = slotAtivo ? verificarIndisponibilidade(aluno, currentSemanaKey) : null;

                            if (!indisponivel) {
                                if (currentSemanaKey && isAlunoDuplicadoBySemanaKey(aluno?.id, currentSemanaKey)) {
                                    duplicadoMesmaSemana = true;
                                }

                                if (semanasSelecionadas) {
                                    const chavesAtivas = Object.keys(semanasSelecionadas).filter(k => semanasSelecionadas[k] && k !== currentSemanaKey);
                                    for (const k of chavesAtivas) {
                                        if (isAlunoDuplicadoBySemanaKey(aluno?.id, k)) {
                                            duplicadoOutraSemana = true;
                                            break;
                                        }
                                    }
                                }
                            }

                            const dias = calcularDiasDesdeUltimaParte(aluno);
                            const historicoRecente = getHistoricoRecente(aluno, 4);
                            const cargoKey = aluno?.tipo;
                            const cargoInfo = getCargoInfo(cargoKey);

                            const isClickable = !!slotAtivo && !indisponivel;

                            let borderColor = "border-gray-200";
                            if (indisponivel) borderColor = "border-gray-200";
                            else if (duplicadoMesmaSemana) borderColor = "border-red-300";
                            else if (duplicadoOutraSemana) borderColor = "border-orange-300";

                            return (
                                <div
                                    key={aluno?.id || aluno?.nome}
                                    className={[
                                        "w-full text-left rounded-xl border transition relative group shadow-sm flex",
                                        indisponivel ? "bg-gray-100/60 opacity-60 grayscale-[30%]" : "bg-white hover:shadow-md hover:border-blue-300",
                                        borderColor
                                    ].join(" ")}
                                    title={indisponivel ? localTx.indisponivel : ''}
                                >
                                    {/* ALÇA DE ARRASTAR */}
                                    {!indisponivel ? (
                                        <div
                                            className="w-8 flex items-center justify-center bg-gray-50 border-r border-gray-100 rounded-l-xl cursor-grab active:cursor-grabbing hover:bg-gray-100 shrink-0"
                                            draggable={true}
                                            onDragStart={() => setDraggedAluno && setDraggedAluno(aluno)}
                                            onDragEnd={() => setDraggedAluno && setDraggedAluno(null)}
                                            title={localTx.arrasteAqui}
                                        >
                                            <GripVertical size={16} className="text-gray-400" />
                                        </div>
                                    ) : (
                                        <div className="w-8 flex items-center justify-center bg-gray-100 border-r border-gray-200 rounded-l-xl cursor-not-allowed shrink-0">
                                            <CalendarX size={16} className="text-gray-300" />
                                        </div>
                                    )}

                                    {/* CORPO CLICÁVEL DO CARD */}
                                    <button
                                        type="button"
                                        className={`flex-1 p-2 flex flex-col gap-1 text-left ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!isClickable) return;

                                            if (duplicadoMesmaSemana) {
                                                const ok = window.confirm(TT.confirmarDuplicado);
                                                if (!ok) return;
                                            }
                                            atribuirAluno(aluno);
                                        }}
                                        title={indisponivel ? localTx.indisponivel : duplicadoMesmaSemana ? localTx.duplicadoMesma : duplicadoOutraSemana ? localTx.duplicadoOutra : TT.cliquePara}
                                    >

                                        {/* CONTAINER PRINCIPAL DO NOME + AVATAR */}
                                        <div className="flex items-start gap-2.5 w-full">

                                            {/* AVATAR DO ALUNO */}
                                            <div className={`mt-0.5 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black border overflow-hidden ${cargoInfo?.cor || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                                                {aluno.avatar ? (
                                                    <img src={aluno.avatar} alt={aluno.nome} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{getIniciais(aluno.nome)}</span>
                                                )}
                                            </div>

                                            {/* INFORMAÇÕES DE NOME E TAGS UNIFICADAS */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                                                <div className="flex items-center w-full">
                                                    <span className="font-bold text-xs text-gray-800 truncate" title={aluno?.nome}>{aluno?.nome || TT.semNome}</span>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                                    <span className={["text-[8px] font-black px-1.5 py-0.5 rounded-full border", cargoInfo?.cor || "bg-gray-100 text-gray-700 border-gray-200"].join(" ")}>
                                                        {cargoInfo?.[lang] || cargoInfo?.pt || cargoInfo?.es || cargoKey || "—"}
                                                    </span>

                                                    {/* LÓGICA UNIFICADA */}
                                                    {duplicadoMesmaSemana ? (
                                                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-0.5" title={localTx.duplicadoMesma}>
                                                            <AlertTriangle size={8} /> {localTx.nestaSemana}
                                                        </span>
                                                    ) : duplicadoOutraSemana ? (
                                                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 inline-flex items-center gap-0.5" title={localTx.duplicadoOutra}>
                                                            <AlertTriangle size={8} /> {localTx.outraSemana}
                                                        </span>
                                                    ) : typeof dias === 'number' ? (
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border inline-flex items-center gap-0.5 ${getBadgeDiasColor(dias)}`}>
                                                            <Clock size={8} />
                                                            {dias < 0 ? localTx.futuro || TT.futuro : `${dias} ${TT.dias}`}
                                                        </span>
                                                    ) : (
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border inline-flex items-center gap-0.5 ${getBadgeDiasColor(null)}`}>
                                                            <Clock size={8} /> {TT.info.nunca}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* TAG DE INDISPONÍVEL */}
                                        {indisponivel && (
                                            <div className="mt-0.5 w-full">
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200 inline-flex items-center gap-0.5">
                                                    <CalendarX size={10} /> {localTx.ausente}{indisponivel.motivo ? `: ${indisponivel.motivo}` : ''}
                                                </span>
                                            </div>
                                        )}

                                        {/* OBSERVAÇÕES */}
                                        {!!aluno?.observacoes && (
                                            <div className="bg-yellow-50 border border-yellow-100 rounded px-1.5 py-1 text-[10px] text-yellow-800 leading-tight italic w-full mt-0.5">
                                                {aluno.observacoes}
                                            </div>
                                        )}

                                        {/* HISTÓRICO RECENTE */}
                                        {!indisponivel && historicoRecente.length > 0 && (
                                            <div className="mt-1 border-t border-gray-100 pt-1 w-full space-y-0.5">
                                                {historicoRecente.map((hist, i) => (
                                                    <div key={i} className="flex justify-between items-center text-[9px] text-gray-400">
                                                        <span className="shrink-0 mr-2">
                                                            {hist.data
                                                                ? (hist.data.includes('-')
                                                                    ? hist.data.split('T')[0].split('-').reverse().join('/')
                                                                    : hist.data)
                                                                : '--/--'}
                                                        </span>
                                                        <span className="truncate text-right font-medium text-gray-500" title={`${hist.parte || "—"}${hist.ajudante ? ` (${TT.com} ${hist.ajudante})` : ''}`}>
                                                            {hist.parte || "—"}
                                                            {hist.ajudante && <span className="text-gray-400 font-normal opacity-80"> ({TT.com} {hist.ajudante})</span>}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {!indisponivel && (
                                            <div className="absolute inset-y-0 right-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-xl" />
                                        )}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default SidebarAlunos;
