import React from 'react';
import { History, X, Trash2 } from 'lucide-react';

const ModalHistorico = ({ aluno, isOpen, onClose, t, onUpdateAluno, lang = 'pt' }) => {
    if (!isOpen || !aluno) return null;

    // Função que é ativada ao clicar na lixeira
    const handleDelete = (indexOriginal) => {
        const msg = lang === 'es'
            ? "¿Desea eliminar este registro del historial?"
            : "Tem certeza que deseja remover este registro do histórico?";

        if (window.confirm(msg)) {
            // Clona o histórico atual e remove apenas o item selecionado
            const novoHistorico = [...(aluno.historico || [])];
            novoHistorico.splice(indexOriginal, 1);

            // Envia o aluno com o histórico limpo de volta para a ListaAlunos salvar
            if (onUpdateAluno) {
                onUpdateAluno({ ...aluno, historico: novoHistorico });
            }
        }
    };

    // Salva o índice original da matriz ANTES de ordenar por data.
    // Isto garante que ao apagar, apagamos o registo certo lá no Firebase.
    const historicoOrdenado = (aluno.historico || [])
        .map((h, indexOriginal) => ({ ...h, indexOriginal }))
        .sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="bg-orange-500 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-sm flex items-center gap-2"><History size={18} /> {t?.modal?.historico || 'Histórico'}</h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition-colors"><X size={20} /></button>
                </div>
                <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
                    <p className="font-black text-gray-800 border-b pb-2 mb-2">{aluno.nome}</p>

                    {historicoOrdenado.map((h) => (
                        <div key={h.indexOriginal} className="flex justify-between items-center text-xs border-b border-gray-50 pb-2 group hover:bg-gray-50/50 transition-colors px-1 -mx-1 rounded">
                            <div className="pr-4 flex-1">
                                <p className="font-bold text-gray-700">{h.parte}</p>
                                {h.ajudante && <p className="text-[10px] text-blue-500 italic font-bold mt-0.5">{t?.card?.com || 'com'}: {h.ajudante}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                    {h.data ? h.data.split('-').reverse().join('/') : '--/--'}
                                </span>

                                {/* Botão Lixeira - Fica mais visível ao passar o rato (hover) na linha */}
                                <button
                                    onClick={() => handleDelete(h.indexOriginal)}
                                    className="text-red-300 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all opacity-50 group-hover:opacity-100"
                                    title={lang === 'es' ? "Eliminar" : "Excluir"}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {(!aluno.historico || aluno.historico.length === 0) && (
                        <p className="text-xs text-gray-400 italic py-2 text-center">Nenhum histórico registrado.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalHistorico;