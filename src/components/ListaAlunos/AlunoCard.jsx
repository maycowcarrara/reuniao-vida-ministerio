import React from 'react';
import { Copy, Edit2, History, Trash2, Phone, Mail, StickyNote, Calendar, Clock, UserPlus } from 'lucide-react';
import { getCargoKey, getUltimoRegistro, calcularDias, verificarAusenciaAtiva, buildWhatsappHref, getIniciais } from './utils';

const AlunoCard = ({ aluno, cargosMap, lang, t, onEdit, onHistory, onDelete, onCopyPublicLink }) => {
    const cKey = getCargoKey(aluno.tipo, cargosMap);
    const info = cargosMap[cKey] || cargosMap.irmao;
    const ult = getUltimoRegistro(aluno);
    const d = calcularDias(ult.data);
    const whatsappHref = buildWhatsappHref(aluno.telefone, aluno.nome);
    const podeExcluir = aluno.tipo === 'desab';
    const estaAusente = verificarAusenciaAtiva(aluno);
    
    // Obter as iniciais usando a nossa nova função
    const iniciais = getIniciais(aluno.nome);

    return (
        <div className="print-card bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${info.gen === 'F' ? 'bg-pink-400' : 'bg-blue-500'}`} />
            
            <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 pr-1 flex-1 flex gap-2.5 items-center">
                    
                    {/* AVATAR DO ALUNO */}
                    <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-black border overflow-hidden ${info.cor}`}>
                        {aluno.avatar ? (
                            <img src={aluno.avatar} alt={aluno.nome} className="w-full h-full object-cover" />
                        ) : (
                            <span>{iniciais}</span>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-gray-800 text-sm leading-tight break-words">{aluno.nome}</h3>
                            {estaAusente && (
                                <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 border border-orange-200" title={t.card.ausente}>
                                    <Calendar size={8} /> {t.card.ausenteBadge}
                                </span>
                            )}
                        </div>
                        <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md border mt-1 inline-block tracking-tighter ${info.cor}`}>{info[lang]}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all no-print">
                    <button onClick={() => onEdit(aluno)} className="p-1.5 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-lg border shadow-sm" title={t.modal.editar}><Edit2 size={12} /></button>
                    <button onClick={() => onHistory(aluno)} className="p-1.5 bg-gray-50 text-gray-400 hover:text-orange-500 rounded-lg border shadow-sm" title={t.modal.historico}><History size={12} /></button>
                    <button onClick={() => onCopyPublicLink?.(aluno)} className="p-1.5 bg-gray-50 text-gray-400 hover:text-emerald-600 rounded-lg border shadow-sm" title="Copiar link do quadro"><Copy size={12} /></button>
                    <button onClick={() => onDelete(aluno)} className={`p-1.5 rounded-lg border shadow-sm transition-colors ${podeExcluir ? "bg-white text-red-500 hover:bg-red-50 border-red-100" : "bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed"}`} title={podeExcluir ? t.modal.excluir : t.msg.erroSoDesabilitados}>
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            <div className="space-y-1 mb-3 text-[11px] font-medium text-gray-500 pl-1">
                {aluno.telefone && (whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="flex items-center gap-1.5" title={t.campos.tel}><Phone size={11} className="text-green-500" /> {aluno.telefone}</a> : <div className="flex items-center gap-1.5"><Phone size={11} className="text-green-500" /> {aluno.telefone}</div>)}
                {aluno.email && <a href={`mailto:${aluno.email}`} className="flex items-center gap-2 text-[10px] truncate" title={t.campos.mail}><Mail size={11} className="text-blue-400" /> {aluno.email}</a>}
                <div className="flex items-start gap-1.5 text-[10px] text-gray-500"><StickyNote size={11} className="text-gray-400 mt-[1px]" /><p className={`leading-snug ${aluno.observacoes ? 'text-gray-600' : 'text-gray-300 italic'} line-clamp-2`}>{aluno.observacoes ? aluno.observacoes : t.card.semObs}</p></div>
                
                {aluno.datasIndisponiveis && aluno.datasIndisponiveis.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-50">
                        <span className="text-[9px] font-bold text-orange-500 uppercase flex items-center gap-1 mb-1"><Calendar size={10} /> {t.card.indisponivel}</span>
                        <div className="space-y-1">
                            {aluno.datasIndisponiveis.map((dt, idx) => (
                                <div key={idx} className="bg-orange-50 text-orange-700 text-[9px] px-1.5 py-0.5 rounded flex justify-between items-center border border-orange-100">
                                    <span>{dt.inicio.split('-').reverse().join('/')} - {dt.fim.split('-').reverse().join('/')}</span>
                                    {dt.motivo && <span className="opacity-70 truncate max-w-[60px]" title={dt.motivo}>{dt.motivo}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-auto pt-2 border-t border-gray-50 bg-gray-50/30 -mx-3 px-3">
                <div className="flex justify-between items-center text-[10px] mb-0.5">
                    <span className={`font-bold flex items-center gap-1 ${d === null ? 'text-gray-300' : d < 60 ? 'text-green-600' : 'text-red-500'}`}><Clock size={10} /> {d !== null ? `${d}d` : t.card.nunca}</span>
                    <span className="text-gray-400 font-mono text-[9px] font-bold">{ult.data ? ult.data.split('-').reverse().slice(0, 2).join('/') : '--/--'}</span>
                </div>
                <p className="text-[10px] font-bold text-gray-600 truncate leading-tight">{ult.parte || t.card.nunca}</p>
                {ult.ajudante && <p className="text-[9px] text-blue-500 mt-1 italic flex items-center gap-1 font-bold"><UserPlus size={9} /> {t.card.com}: {ult.ajudante}</p>}
            </div>
        </div>
    );
};

export default AlunoCard;
