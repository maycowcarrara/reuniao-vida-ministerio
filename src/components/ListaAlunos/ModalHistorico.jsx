import React from 'react';
import { BarChart3, CalendarDays, History, Trash2, X } from 'lucide-react';

const ModalHistorico = ({ aluno, isOpen, onClose, t, onUpdateAluno }) => {
    if (!isOpen || !aluno) return null;

    // Função que é ativada ao clicar na lixeira
    const handleDelete = (indexOriginal) => {
        if (window.confirm(t?.msg?.confirmarRemoverHistorico || 'Tem certeza que deseja remover este registro do histórico?')) {
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

    const resumoHistorico = (() => {
        const validos = historicoOrdenado.filter((h) => h.data);
        const tipos = validos.reduce((acc, item) => {
            const key = item.parte || 'Parte';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const tipoMaisUsado = Object.entries(tipos).sort((a, b) => b[1] - a[1])[0];
        const intervalos = [];

        for (let i = 0; i < validos.length - 1; i += 1) {
            const atual = new Date(`${validos[i].data}T12:00:00`);
            const anterior = new Date(`${validos[i + 1].data}T12:00:00`);
            const dias = Math.abs(Math.round((atual.getTime() - anterior.getTime()) / (1000 * 60 * 60 * 24)));
            if (Number.isFinite(dias)) intervalos.push(dias);
        }

        const mediaIntervalo = intervalos.length
            ? Math.round(intervalos.reduce((sum, item) => sum + item, 0) / intervalos.length)
            : null;

        return {
            total: validos.length,
            ultima: validos[0]?.data || '',
            mediaIntervalo,
            tipoMaisUsado: tipoMaisUsado ? `${tipoMaisUsado[0]} (${tipoMaisUsado[1]})` : '-'
        };
    })();

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="bg-orange-500 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-sm flex items-center gap-2"><History size={18} /> {t?.modal?.historico || 'Histórico'}</h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition-colors"><X size={20} /></button>
                </div>
                <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
                    <p className="font-black text-gray-800 border-b pb-2 mb-2">{aluno.nome}</p>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-orange-600">
                                <History size={13} /> Total
                            </div>
                            <p className="mt-1 text-xl font-black text-orange-900">{resumoHistorico.total}</p>
                        </div>
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-600">
                                <CalendarDays size={13} /> Intervalo médio
                            </div>
                            <p className="mt-1 text-xl font-black text-blue-900">
                                {resumoHistorico.mediaIntervalo ? `${resumoHistorico.mediaIntervalo}d` : '--'}
                            </p>
                        </div>
                        <div className="col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500">
                                <BarChart3 size={13} /> Mais frequente
                            </div>
                            <p className="mt-1 text-sm font-black text-slate-800">{resumoHistorico.tipoMaisUsado}</p>
                        </div>
                    </div>

                    <div className="relative space-y-2 pl-4 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-orange-100">

                    {historicoOrdenado.map((h) => (
                        <div key={h.indexOriginal} className="relative flex justify-between items-center text-xs border-b border-gray-50 pb-2 group hover:bg-gray-50/50 transition-colors px-1 -mx-1 rounded">
                            <span className="absolute -left-[13px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-400 shadow-sm" />
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
                                    title={t?.modal?.excluir || 'Excluir'}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {(!aluno.historico || aluno.historico.length === 0) && (
                        <p className="text-xs text-gray-400 italic py-2 text-center">{t?.msg?.semHistorico || 'Nenhum histórico registrado.'}</p>
                    )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalHistorico;
