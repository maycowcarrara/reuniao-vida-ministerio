import React from 'react';
import {
    Settings,
    Building2,
    Calendar as CalendarIcon,
    Clock,
    Globe,
    ChevronDown
} from 'lucide-react';
import { useSectionMessages } from '../i18n';
import { getWeekdayOptions, normalizeLanguage, normalizeMeetingDay } from '../config/appConfig';
import UserAccessManager from './UserAccessManager';

export default function Configuracoes({ dados, salvarAlteracao, lang }) {
    const T = useSectionMessages('configuracoes');
    const activeLocale = normalizeLanguage(lang);
    const isPortugueseActive = activeLocale === 'pt';
    const isSpanishActive = activeLocale === 'es';
    const meetingDay = normalizeMeetingDay(dados?.configuracoes?.dia_reuniao);
    const weekdayOptions = getWeekdayOptions(lang);
    const atualizarConfig = (campo, valor) => {
        salvarAlteracao({
            ...dados,
            configuracoes: { ...dados.configuracoes, [campo]: valor }
        });
    };

    return (
        <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6 px-3 pt-3 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:p-6">

            <div className="flex items-center gap-3 mb-6 sm:mb-8">
                <div className="bg-blue-600 p-2.5 sm:p-3 rounded-2xl shadow-lg shadow-blue-200 shrink-0">
                    <Settings className="text-white w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{T.titulo}</h2>
                    <p className="text-xs sm:text-sm font-medium text-slate-500">{T.subtitulo}</p>
                </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] shadow-sm border border-slate-100 space-y-5 sm:space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>

                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2 sm:mb-4">
                    {T.preferenciasGerais}
                </h3>

                <div className="space-y-4 sm:space-y-5">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                            {T.congregacao}
                        </label>
                        <div className="relative">
                            <Building2 size={18} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder={T.placeholderCongregacao}
                                key={dados?.configuracoes?.nome_cong || ''}
                                defaultValue={dados?.configuracoes?.nome_cong || ''}
                                onBlur={(e) => atualizarConfig('nome_cong', e.currentTarget.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-800 font-bold text-base sm:text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                                {T.dia}
                            </label>
                            <div className="relative">
                                <CalendarIcon size={18} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                                <select
                                    value={meetingDay}
                                    onChange={(e) => atualizarConfig('dia_reuniao', e.target.value)}
                                    className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-800 font-bold appearance-none cursor-pointer text-base sm:text-sm"
                                >
                                    {weekdayOptions.map((day) => (
                                        <option key={day.value} value={day.value}>
                                            {day.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={18} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                                {T.horario}
                            </label>
                            <div className="relative">
                                <Clock size={18} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    type="time"
                                    value={dados?.configuracoes?.horario || '19:30'}
                                    onChange={(e) => atualizarConfig('horario', e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-800 font-bold cursor-pointer text-base sm:text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <UserAccessManager lang={activeLocale} />

            <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4 sm:mb-5">
                    <Globe size={18} className="text-indigo-500" /> {T.idioma}
                </h3>

                <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-row gap-1">
                    <button
                        onClick={() => atualizarConfig('idioma', 'pt')}
                        className={`flex-1 py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${isPortugueseActive ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        🇧🇷 Português
                    </button>
                    <button
                        onClick={() => atualizarConfig('idioma', 'es')}
                        className={`flex-1 py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${isSpanishActive ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        🇪🇸 Español
                    </button>
                </div>
            </div>
        </div>
    );
}
