import React from 'react';
import { Settings } from 'lucide-react';

export default function Configuracoes({ dados, salvarAlteracao, t, lang }) {

    const atualizarConfig = (campo, valor) => {
        salvarAlteracao({
            ...dados,
            configuracoes: { ...dados.configuracoes, [campo]: valor }
        });
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-lg mx-auto space-y-8 animate-in fade-in zoom-in duration-300">
            <h3 className="font-bold border-b pb-2 flex items-center gap-2 text-jw-blue">
                <Settings size={18} /> {t.ajustes}
            </h3>

            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Congregação</label>
                    <input
                        type="text"
                        value={dados?.configuracoes?.nome_cong || ''}
                        onChange={(e) => atualizarConfig('nome_cong', e.target.value)}
                        className="w-full p-2.5 border rounded-lg mt-1 outline-none focus:ring-2 focus:ring-blue-100"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dia</label>
                        <select
                            value={dados?.configuracoes?.dia_reuniao || 'Segunda-feira'}
                            onChange={(e) => atualizarConfig('dia_reuniao', e.target.value)}
                            className="w-full p-2.5 border rounded-lg mt-1 bg-white outline-none"
                        >
                            {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'].map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Horário</label>
                        <input
                            type="time"
                            value={dados?.configuracoes?.horario || '19:30'}
                            onChange={(e) => atualizarConfig('horario', e.target.value)}
                            className="w-full p-2.5 border rounded-lg mt-1 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t">
                <label className="text-[10px] font-black text-gray-400 uppercase">Idioma Global</label>
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => atualizarConfig('idioma', 'pt')}
                        className={`flex-1 p-3 rounded-lg border font-bold ${lang === 'pt' ? 'bg-blue-600 text-white shadow-lg border-blue-600' : 'bg-gray-50'}`}
                    >
                        Português
                    </button>

                    <button
                        onClick={() => atualizarConfig('idioma', 'es')}
                        className={`flex-1 p-3 rounded-lg border font-bold ${lang === 'es' ? 'bg-blue-600 text-white shadow-lg border-blue-600' : 'bg-gray-50'}`}
                    >
                        Español
                    </button>
                </div>
            </div>
        </div>
    );
}