import React from 'react';
import { Edit2, History, Trash2, Phone, Mail, StickyNote, Calendar, Clock } from 'lucide-react';
import { getCargoKey, getUltimoRegistro, calcularDias, verificarAusenciaAtiva, buildWhatsappHref, getIniciais } from './utils';

const AlunoListItem = ({ aluno, cargosMap, lang, t, onEdit, onHistory, onDelete }) => {
    const cKey = getCargoKey(aluno.tipo, cargosMap);
    const info = cargosMap[cKey] || cargosMap.irmao;
    const ult = getUltimoRegistro(aluno);
    const d = calcularDias(ult.data);
    const whatsappHref = buildWhatsappHref(aluno.telefone, aluno.nome);
    const podeExcluir = aluno.tipo === 'desab';
    const estaAusente = verificarAusenciaAtiva(aluno);
    
    // Obter as iniciais
    const iniciais = getIniciais(aluno.nome);

    return (
        <div className="print-card bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden group">
            <div className={`w-1.5 self-stretch rounded-full ${info.gen === 'F' ? 'bg-pink-400' : 'bg-blue-500'}`} />
            <div className="flex-1 min-w-0 flex gap-3">
                
                {/* AVATAR DO ALUNO (LISTA) */}
                <div className={`mt-0.5 w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-black border overflow-hidden ${info.cor}`}>
                    {aluno.avatar ? (
                        <img src={aluno.avatar} alt={aluno.nome} className="w-full h-full object-cover" />
                    ) : (
                        <span>{iniciais}</span>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-gray-800 text-sm truncate">{aluno.nome}</h3>
                                {estaAusente && (
                                    <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 border border-orange-200" title={t.card.ausente}>
                                        <Calendar size={8} /> Ausente
                                    </span>
                                )}
                                <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md border inline-block tracking-tighter ${info.cor}`}>{info[lang]}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                                {aluno.telefone && (whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="flex items-center gap-1" title="WhatsApp"><Phone size={12} className="text-green-500" /> {aluno.telefone}</a> : <span className="flex items-center gap-1"><Phone size={12} className="text-green-500" /> {aluno.telefone}</span>)}
                                {aluno.email && <a href={`mailto:${aluno.email}`} className="flex items-center gap-1 truncate" title="E-mail"><Mail size={12} className="text-blue-400" /> {aluno.email}</a>}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-black flex items-center gap-1 ${d === null ? 'text-gray-300' : d < 60 ? 'text-green-600' : 'text-red-500'}`}><Clock size={12} /> {d !== null ? `${d}d` : t.card.nunca}</span>
                            <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-all no-print">
                                <button onClick={() => onEdit(aluno)} className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl border shadow-sm" title={t.modal.editar}><Edit2 size={14} /></button>
                                <button onClick={() => onHistory(aluno)} className="p-2 bg-gray-50 text-gray-400 hover:text-orange-500 rounded-xl border shadow-sm" title={t.modal.historico}><History size={14} /></button>
                                <button onClick={() => onDelete(aluno)} className={`p-2 rounded-xl border shadow-sm transition-colors ${podeExcluir ? "bg-white text-red-500 hover:bg-red-50 border-red-100" : "bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed"}`} title={podeExcluir ? t.modal.excluir : t.msg.erroSoDesabilitados}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-2 flex items-start gap-2 text-[11px]"><StickyNote size={14} className="text-gray-400 mt-[1px]" /><p className={`${aluno.observacoes ? 'text-gray-700' : 'text-gray-300 italic'} leading-snug line-clamp-2`}>{aluno.observacoes ? aluno.observacoes : t.card.semObs}</p></div>
                    
                    {aluno.datasIndisponiveis && aluno.datasIndisponiveis.length > 0 && (
                        <div className="mt-2 flex gap-2 flex-wrap">
                            {aluno.datasIndisponiveis.map((dt, idx) => (
                                <div key={idx} className="bg-orange-50 text-orange-700 text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1.5 border border-orange-100" title={dt.motivo}>
                                    <Calendar size={10} />
                                    <span className="font-bold">{dt.inicio.split('-').reverse().join('/')} até {dt.fim.split('-').reverse().join('/')}</span>
                                    {dt.motivo && <span className="opacity-70">- {dt.motivo}</span>}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-gray-50 text-[11px] text-gray-600"><span className="font-bold">{ult.parte || t.card.nunca}</span>{ult.data && <span className="ml-2 font-mono text-[10px] text-gray-400">({ult.data.split('-').reverse().slice(0, 2).join('/')})</span>}{ult.ajudante && <span className="ml-2 text-blue-500 italic font-bold">• {t.card.com}: {ult.ajudante}</span>}</div>
                    <div className="flex sm:hidden gap-2 mt-3 no-print">
                        <button onClick={() => onEdit(aluno)} className="flex-1 py-2 rounded-xl border bg-gray-50 text-gray-700 font-black text-[10px] uppercase">{t.modal.editar}</button>
                        <button onClick={() => onHistory(aluno)} className="flex-1 py-2 rounded-xl border bg-orange-50 text-orange-700 font-black text-[10px] uppercase">{t.modal.historico}</button>
                        <button onClick={() => onDelete(aluno)} className={`flex-1 py-2 rounded-xl border font-black text-[10px] uppercase ${podeExcluir ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}>{t.modal.excluir}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AlunoListItem;