import React from 'react';
import { User, Clock, MessageCircle } from 'lucide-react';

const ListaAlunos = ({ alunos }) => {
    const calcularDias = (data) => {
        const diff = new Date() - new Date(data);
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    return (
        <div className="grid grid-cols-1 gap-4">
            {alunos.sort((a, b) => new Date(a.ultimaParte) - new Date(b.ultimaParte)).map(aluno => (
                <div key={aluno.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center hover:border-jw-blue transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${aluno.genero === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                            <User size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800">{aluno.nome}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock size={12} /> Última parte: {calcularDias(aluno.ultimaParte)} dias atrás
                            </p>
                        </div>
                    </div>
                    <button className="text-green-500 hover:bg-green-50 p-2 rounded-full">
                        <MessageCircle size={20} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ListaAlunos;