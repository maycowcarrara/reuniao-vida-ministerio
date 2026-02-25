import React from 'react';
import { History, X } from 'lucide-react';

const ModalHistorico = ({ aluno, isOpen, onClose, t }) => {
    if (!isOpen || !aluno) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="bg-orange-500 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-sm flex items-center gap-2"><History size={18} /> {t.modal.historico}</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
                    <p className="font-black text-gray-800 border-b pb-2 mb-2">{aluno.nome}</p>

                    {(aluno.historico || [])
                        .slice()
                        .sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime())
                        .map((h, i) => (
                            <div key={i} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                                <div className="pr-4">
                                    <p className="font-bold text-gray-700">{h.parte}</p>
                                    {h.ajudante && <p className="text-[10px] text-blue-500 italic font-bold mt-1">{t.card.com}: {h.ajudante}</p>}
                                </div>
                                <span className="text-[10px] font-bold font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                                    {h.data ? h.data.split('-').reverse().join('/') : '--/--'}
                                </span>
                            </div>
                        ))
                    }

                    {(!aluno.historico || aluno.historico.length === 0) && (
                        <p className="text-xs text-gray-400 italic py-2">Nenhum histórico registrado.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalHistorico;