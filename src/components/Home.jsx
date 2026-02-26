import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ShieldCheck, Users } from 'lucide-react';

export default function Home() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full text-center space-y-6">

                {/* Logo / Ícone */}
                <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl mx-auto flex items-center justify-center shadow-lg transform rotate-3">
                    <CalendarDays size={40} className="-rotate-3" />
                </div>

                <div>
                    <h1 className="text-2xl font-black text-gray-800">Reunião Vida e Ministério</h1>
                    <p className="text-gray-500 mt-2">Selecione como deseja acessar o sistema</p>
                </div>

                <div className="space-y-4 pt-4">
                    {/* BOTÃO 1: QUADRO DE ANÚNCIOS (Público) */}
                    <Link
                        to="/quadro"
                        className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group"
                    >
                        <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Users size={24} />
                        </div>
                        <div className="text-left flex-1">
                            <h3 className="font-bold text-gray-800 text-lg">Quadro de Designações</h3>
                            <p className="text-xs text-gray-500">Acesso para publicadores (Requer senha)</p>
                        </div>
                    </Link>

                    {/* BOTÃO 2: ADMINISTRAÇÃO (Restrito) */}
                    <Link
                        to="/admin"
                        className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 hover:border-amber-400 hover:shadow-md transition-all group"
                    >
                        <div className="bg-amber-50 p-3 rounded-xl text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                            <ShieldCheck size={24} />
                        </div>
                        <div className="text-left flex-1">
                            <h3 className="font-bold text-gray-800 text-lg">Superintendente</h3>
                            <p className="text-xs text-gray-500">Acesso restrito (Requer Login Google)</p>
                        </div>
                    </Link>
                </div>

            </div>
        </div>
    );
}