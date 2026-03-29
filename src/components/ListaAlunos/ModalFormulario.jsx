import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import { getIniciais } from './utils';

const ModalFormulario = ({ alunoEmEdicao, setAlunoEmEdicao, isOpen, onClose, onSave, cargosMap, lang, t }) => {
    const firstInputRef = useRef(null);
    const [novaDataIndisponivel, setNovaDataIndisponivel] = useState({ inicio: '', fim: '', motivo: '' });

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => firstInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    if (!isOpen || !alunoEmEdicao) return null;

    const adicionarData = () => {
        if (novaDataIndisponivel.inicio && novaDataIndisponivel.fim) {
            setAlunoEmEdicao({
                ...alunoEmEdicao,
                datasIndisponiveis: [...(alunoEmEdicao.datasIndisponiveis || []), novaDataIndisponivel].sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
            });
            setNovaDataIndisponivel({ inicio: '', fim: '', motivo: '' });
        }
    };

    const removerData = (idx) => {
        const newDates = [...alunoEmEdicao.datasIndisponiveis];
        newDates.splice(idx, 1);
        setAlunoEmEdicao({ ...alunoEmEdicao, datasIndisponiveis: newDates });
    };

    // Função para interceptar o CTRL+V (colar imagem) e redimensionar
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        // Comprimir a imagem para um tamanho pequeno (máx 150px)
                        const canvas = document.createElement('canvas');
                        const MAX_SIZE = 150;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                        } else {
                            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Converter para base64 com qualidade de 80%
                        const base64Avatar = canvas.toDataURL('image/jpeg', 0.8);
                        setAlunoEmEdicao(prev => ({ ...prev, avatar: base64Avatar }));
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(blob);
            }
        }
    };

    const iniciais = getIniciais(alunoEmEdicao.nome || '?');

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-5 flex justify-between items-center text-white">
                    <div>
                        <h3 className="font-black text-sm leading-tight">{alunoEmEdicao.id ? t.modal.editar : t.modal.novo}</h3>
                        <p className="text-[10px] opacity-80 mt-1">{alunoEmEdicao.id ? `ID #${alunoEmEdicao.id}` : '—'}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[75vh] custom-scrollbar" onPaste={handlePaste}>
                    
                    {/* ZONA DO AVATAR */}
                    <div className="flex items-center gap-4 mb-5 p-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <div className="w-14 h-14 rounded-full overflow-hidden bg-white border border-gray-200 flex items-center justify-center text-gray-400 font-bold text-lg shrink-0 relative group">
                            {alunoEmEdicao.avatar ? (
                                <>
                                    <img src={alunoEmEdicao.avatar} alt={t.campos.avatarAlt} className="w-full h-full object-cover" />
                                    <button 
                                        type="button" 
                                        onClick={() => setAlunoEmEdicao({ ...alunoEmEdicao, avatar: null })}
                                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        title={t.campos.removerFoto}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            ) : (
                                iniciais
                            )}
                        </div>
                        <div className="text-xs text-gray-500">
                            <p className="font-bold flex items-center gap-1.5 text-gray-700"><ImageIcon size={14} className="text-blue-500" /> {t.campos.foto}</p>
                            <p className="text-[10px] mt-0.5">
                                {t.campos.fotoInstrucao.split('{TECLA}')[0]}
                                <kbd className="bg-white border border-gray-300 rounded px-1.5 py-0.5 font-mono font-bold text-gray-700 shadow-sm mx-0.5">Ctrl+V</kbd>
                                {t.campos.fotoInstrucao.split('{TECLA}')[1]}
                            </p>
                        </div>
                    </div>

                    <form id="form-aluno" onSubmit={onSave} className="space-y-4">
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.nome}</label><input ref={firstInputRef} required type="text" className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold border border-gray-100 focus:border-blue-600 outline-none" value={alunoEmEdicao.nome} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, nome: e.target.value })} /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.tipo}</label><select className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-black text-blue-700 border border-gray-100 outline-none focus:border-blue-600" value={alunoEmEdicao.tipo} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, tipo: e.target.value })}>{Object.keys(cargosMap).map(key => (<option key={key} value={key}>{cargosMap[key][lang]}</option>))}</select></div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.tel}</label><input type="text" className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold border border-gray-100 outline-none focus:border-blue-600" value={alunoEmEdicao.telefone || ""} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, telefone: e.target.value })} placeholder={t.campos.telefonePlaceholder} /></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.mail}</label><input type="email" className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold border border-gray-100 outline-none focus:border-blue-600" value={alunoEmEdicao.email || ""} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, email: e.target.value })} placeholder={t.campos.emailPlaceholder} /></div>
                        </div>
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">{t.campos.obs}</label><textarea rows={2} className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm font-semibold border border-gray-100 outline-none focus:border-blue-600 resize-none" value={alunoEmEdicao.observacoes || ""} onChange={e => setAlunoEmEdicao({ ...alunoEmEdicao, observacoes: e.target.value })} placeholder={t.campos.obsPlaceholder} /></div>

                        <div className="space-y-2 pt-4 border-t border-gray-100 mt-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-1 flex items-center gap-1.5"><Calendar size={12} /> {t.campos.datasIndisponiveis}</label>
                            
                            {(alunoEmEdicao.datasIndisponiveis || []).length > 0 ? (
                                <div className="space-y-1.5 mb-2 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                    {alunoEmEdicao.datasIndisponiveis.map((dt, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-orange-50 border border-orange-100 text-orange-800 text-xs px-2.5 py-1.5 rounded-lg">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{dt.inicio.split('-').reverse().join('/')} {t.campos.ate} {dt.fim.split('-').reverse().join('/')}</span>
                                                {dt.motivo && <span className="text-[9px] opacity-80">{dt.motivo}</span>}
                                            </div>
                                            <button type="button" onClick={() => removerData(idx)} className="text-orange-400 hover:text-red-500 p-1 transition-colors"><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[10px] text-gray-400 italic px-1">{t.campos.semDatas}</p>
                            )}

                            <div className="flex flex-wrap gap-2 items-end bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                <div className="flex-1 min-w-[100px]">
                                    <label className="text-[9px] font-bold text-gray-500 mb-0.5 block">{t.campos.dataInicio}</label>
                                    <input type="date" className="w-full px-2 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 outline-none focus:border-orange-400 bg-white" value={novaDataIndisponivel.inicio} onChange={e => setNovaDataIndisponivel({ ...novaDataIndisponivel, inicio: e.target.value })} />
                                </div>
                                <div className="flex-1 min-w-[100px]">
                                    <label className="text-[9px] font-bold text-gray-500 mb-0.5 block">{t.campos.dataFim}</label>
                                    <input type="date" className="w-full px-2 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 outline-none focus:border-orange-400 bg-white" value={novaDataIndisponivel.fim} onChange={e => setNovaDataIndisponivel({ ...novaDataIndisponivel, fim: e.target.value })} />
                                </div>
                                <div className="w-full flex gap-2 items-end mt-1">
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-gray-500 mb-0.5 block">{t.campos.motivo}</label>
                                        <input type="text" placeholder={t.campos.motivoPlaceholder} className="w-full px-2 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 outline-none focus:border-orange-400 bg-white" value={novaDataIndisponivel.motivo} onChange={e => setNovaDataIndisponivel({ ...novaDataIndisponivel, motivo: e.target.value })} />
                                    </div>
                                    <button type="button" onClick={adicionarData} className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${novaDataIndisponivel.inicio && novaDataIndisponivel.fim ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`} disabled={!novaDataIndisponivel.inicio || !novaDataIndisponivel.fim}>+</button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2 justify-end rounded-b-3xl">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase hover:text-gray-600">{t.modal.cancelar}</button>
                    <button type="submit" form="form-aluno" className="bg-blue-700 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all hover:bg-blue-600">{t.modal.salvar}</button>
                </div>
            </div>
        </div>
    );
};

export default ModalFormulario;
