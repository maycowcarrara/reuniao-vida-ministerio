import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, CheckCircle, AlertCircle, Filter } from 'lucide-react';

// Dicionário de Traduções Interno
const T = {
    pt: {
        titulo: "Sugestão Inteligente",
        filtro: "Filtro",
        genero: "Gênero",
        homens: "Homens",
        mulheres: "Mulheres",
        todos: "Todos",
        nunca: "Nunca fez",
        estaFuncao: "esta função",
        mesesAtras: "meses atrás",
        diasAtras: "dias atrás",
        jaTemParte: "Já tem parte hoje",
        semResultados: "Nenhum aluno encontrado para este perfil.",
        labels: {
            qualquer: "Qualquer Parte",
            presidente: "Presidente",
            oracao: "Oração",
            leitura: "Leitura da Bíblia",
            joias: "Joias Espirituais",
            tesouros: "Discurso (Tesouros)",
            vida: "Parte (Vida Cristã)",
            dirigente: "Dirigente (EBC)",
            leitor: "Leitor (EBC)",
            estudante: "Parte de Estudante"
        }
    },
    es: {
        titulo: "Sugerencia Inteligente",
        filtro: "Filtro",
        genero: "Género",
        homens: "Hombres",
        mulheres: "Mujeres",
        todos: "Todos",
        nunca: "Nunca hizo",
        estaFuncao: "esta función",
        mesesAtras: "meses atrás",
        diasAtras: "días atrás",
        jaTemParte: "Ya tiene asignación hoy",
        semResultados: "Ningún estudiante encontrado para este perfil.",
        labels: {
            qualquer: "Cualquier Parte",
            presidente: "Presidente",
            oracao: "Oración",
            leitura: "Lectura de la Biblia",
            joias: "Perlas Escondidas",
            tesouros: "Discurso (Tesoros)",
            vida: "Parte (Vida Cristiana)",
            dirigente: "Director (EBC)",
            leitor: "Lector (EBC)",
            estudante: "Parte de Estudiante"
        }
    }
};

export default function ModalSugestao({
    isOpen,
    onClose,
    onSelect,
    alunos,
    historico,
    parteAtual,
    semanaAtual,
    modalKey,
    cargosMap,
    lang = 'pt' // Recebe o idioma (padrão pt)
}) {
    const [sugestoes, setSugestoes] = useState([]);
    const [contexto, setContexto] = useState({ labelKey: 'qualquer', gender: 'todos' });

    // Seleciona o pacote de tradução
    const t = T[lang] || T.pt;

    useEffect(() => {
        if (!isOpen) return;
        calcularSugestoes();
    }, [isOpen, parteAtual, modalKey, lang]);

    // --- 1. DEFINIR O QUE ESTAMOS PROCURANDO ---
    const detectarContexto = () => {
        let ctx = {
            tipo: 'qualquer',
            labelKey: 'qualquer',
            gender: 'todos',
            strict: false
        };

        const titulo = (parteAtual?.titulo || '').toLowerCase();
        const secao = (parteAtual?.secao || '').toLowerCase();

        // Palavras-chave (PT e ES)
        const kw = {
            leitura: ['leitura', 'lectura'],
            joias: ['joias', 'jóias', 'perlas'],
            estudo: ['estudo', 'estudio']
        };

        // A) PRESIDENTE
        if (modalKey === 'presidente') {
            return { tipo: 'presidente', labelKey: 'presidente', gender: 'M', strict: true };
        }

        // B) ORAÇÃO
        if (modalKey === 'oracao') {
            return { tipo: 'oracao', labelKey: 'oracao', gender: 'M', strict: true };
        }

        // C) LEITURA DA BÍBLIA
        if (kw.leitura.some(k => titulo.includes(k)) && !kw.estudo.some(k => titulo.includes(k))) {
            return { tipo: 'leitura', labelKey: 'leitura', gender: 'M', strict: false };
        }

        // D) JOIAS ESPIRITUAIS
        if (kw.joias.some(k => titulo.includes(k))) {
            return { tipo: 'joias', labelKey: 'joias', gender: 'M', strict: false };
        }

        // E) TESOUROS (Discurso de 10 min)
        if (secao === 'tesouros' && !kw.leitura.some(k => titulo.includes(k)) && !kw.joias.some(k => titulo.includes(k))) {
            return { tipo: 'tesouros', labelKey: 'tesouros', gender: 'M', strict: false };
        }

        // F) NOSSA VIDA CRISTÃ (Discursos/Partes, exceto estudo)
        if (secao === 'vida' && !kw.estudo.some(k => titulo.includes(k)) && !modalKey.includes('leitor')) {
            return { tipo: 'vida', labelKey: 'vida', gender: 'M', strict: false };
        }

        // G) ESTUDO BÍBLICO DE CONGREGAÇÃO
        if (modalKey === 'dirigente') return { tipo: 'dirigente', labelKey: 'dirigente', gender: 'M', strict: true };
        if (modalKey === 'leitor') return { tipo: 'leitor', labelKey: 'leitor', gender: 'M', strict: true };

        // H) ESTUDANTE (Faça seu Melhor)
        if (modalKey === 'estudante' || modalKey === 'ajudante') {
            return { tipo: 'estudante', labelKey: 'estudante', gender: 'todos', strict: false };
        }

        return ctx;
    };

    const calcularSugestoes = () => {
        const ctx = detectarContexto();
        setContexto(ctx);

        // 1. Mapear ocupados
        const ocupadosNestaSemana = new Set();
        if (semanaAtual && Array.isArray(semanaAtual.partes)) {
            if (semanaAtual.presidente?.nome) ocupadosNestaSemana.add(semanaAtual.presidente.nome);
            if (semanaAtual.presidente?.id) ocupadosNestaSemana.add(semanaAtual.presidente.id);

            semanaAtual.partes.forEach(p => {
                if (p.estudante?.nome) ocupadosNestaSemana.add(p.estudante.nome);
                if (p.ajudante?.nome) ocupadosNestaSemana.add(p.ajudante.nome);
                if (p.leitor?.nome) ocupadosNestaSemana.add(p.leitor.nome);
                if (p.dirigente?.nome) ocupadosNestaSemana.add(p.dirigente.nome);
                if (p.oracao?.nome) ocupadosNestaSemana.add(p.oracao.nome);

                if (typeof p.estudante === 'string') ocupadosNestaSemana.add(p.estudante);
                if (typeof p.ajudante === 'string') ocupadosNestaSemana.add(p.ajudante);
            });
        }

        // 2. Filtrar e Calcular
        const listaAnalise = alunos
            .filter(aluno => {
                if (ctx.gender === 'todos') return true;
                const cargoKey = aluno.tipo;
                const cargoInfo = cargosMap?.[cargoKey];
                const generoAluno = cargoInfo?.gen || 'M';
                return generoAluno === ctx.gender;
            })
            .map(aluno => {
                let ultimaData = null;
                let diasSemFazer = 9999;

                for (let i = historico.length - 1; i >= 0; i--) {
                    const semana = historico[i];
                    if (new Date(semana.dataReuniao) > new Date()) continue;

                    let fezParteRelevante = false;

                    // Validação flexível PT/ES
                    const checkTitle = (txt, keys) => {
                        const t = (txt || '').toLowerCase();
                        return keys.some(k => t.includes(k));
                    }

                    if (ctx.tipo === 'presidente') {
                        const pres = semana.presidente;
                        if ((pres?.id === aluno.id) || (pres?.nome === aluno.nome) || (pres === aluno.nome)) fezParteRelevante = true;
                    }
                    else if (Array.isArray(semana.partes)) {
                        const partesDoAluno = semana.partes.filter(p => {
                            const est = typeof p.estudante === 'object' ? p.estudante?.nome : p.estudante;
                            const aju = typeof p.ajudante === 'object' ? p.ajudante?.nome : p.ajudante;
                            const lei = typeof p.leitor === 'object' ? p.leitor?.nome : p.leitor;
                            const dir = typeof p.dirigente === 'object' ? p.dirigente?.nome : p.dirigente;
                            const ora = typeof p.oracao === 'object' ? p.oracao?.nome : p.oracao;
                            return (est === aluno.nome) || (aju === aluno.nome) || (lei === aluno.nome) || (dir === aluno.nome) || (ora === aluno.nome);
                        });

                        for (const p of partesDoAluno) {
                            const tLower = (p.titulo || '').toLowerCase();
                            const sLower = (p.secao || '').toLowerCase();

                            // Regras robustas para PT/ES
                            if (ctx.tipo === 'oracao' && p.oracao) { fezParteRelevante = true; break; }
                            if (ctx.tipo === 'leitura' && checkTitle(tLower, ['leitura', 'lectura'])) { fezParteRelevante = true; break; }
                            if (ctx.tipo === 'joias' && checkTitle(tLower, ['joias', 'jóias', 'perlas'])) { fezParteRelevante = true; break; }
                            if (ctx.tipo === 'tesouros' && sLower === 'tesouros' && !checkTitle(tLower, ['leitura', 'lectura', 'joias', 'perlas'])) { fezParteRelevante = true; break; }
                            if (ctx.tipo === 'vida' && sLower === 'vida' && !checkTitle(tLower, ['estudo', 'estudio'])) { fezParteRelevante = true; break; }
                            if (ctx.tipo === 'estudante' && sLower === 'ministerio') { fezParteRelevante = true; break; }
                            if (ctx.tipo === 'leitor' && p.leitor) { fezParteRelevante = true; break; }
                            if (ctx.tipo === 'dirigente' && p.dirigente) { fezParteRelevante = true; break; }
                        }
                    }

                    if (fezParteRelevante) {
                        ultimaData = semana.dataReuniao || semana.semana;
                        const diff = Math.abs(new Date() - new Date(semana.dataReuniao));
                        diasSemFazer = Math.ceil(diff / (1000 * 60 * 60 * 24));
                        break;
                    }
                }

                return {
                    ...aluno,
                    ultimaData,
                    diasSemFazer,
                    ocupadoAgora: ocupadosNestaSemana.has(aluno.id) || ocupadosNestaSemana.has(aluno.nome)
                };
            });

        listaAnalise.sort((a, b) => {
            if (a.ocupadoAgora && !b.ocupadoAgora) return 1;
            if (!a.ocupadoAgora && b.ocupadoAgora) return -1;
            return b.diasSemFazer - a.diasSemFazer;
        });

        setSugestoes(listaAnalise);
    };

    const getGenderLabel = () => {
        if (contexto.gender === 'M') return t.homens;
        if (contexto.gender === 'F') return t.mulheres;
        return t.todos;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-4 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <CheckCircle size={20} className="text-green-300" /> {t.titulo}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-blue-100 text-xs">
                            <Filter size={12} />
                            <span>{t.filtro}: <strong>{t.labels[contexto.labelKey] || contexto.labelKey}</strong></span>
                            <span className="opacity-50">|</span>
                            <span>{t.genero}: <strong>{getGenderLabel()}</strong></span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50 custom-scroll">
                    {sugestoes.map((aluno) => {
                        const meses = aluno.diasSemFazer !== 9999 ? Math.floor(aluno.diasSemFazer / 30) : null;

                        return (
                            <button
                                key={aluno.id}
                                disabled={aluno.ocupadoAgora}
                                onClick={() => onSelect(aluno)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left group relative
                  ${aluno.ocupadoAgora
                                        ? 'opacity-60 bg-gray-100 cursor-not-allowed border-gray-200'
                                        : 'bg-white hover:border-blue-500 hover:shadow-md border-gray-200'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm shrink-0
                    ${aluno.ocupadoAgora ? 'bg-gray-300 text-gray-500' : 'bg-blue-100 text-blue-700'}
                  `}>
                                        {aluno.nome.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800">{aluno.nome}</div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                            <span className="px-1.5 py-0.5 bg-gray-100 rounded border">{aluno.tipo}</span>
                                            {aluno.ocupadoAgora && <span className="text-red-500 font-bold ml-1 flex items-center gap-1"><AlertCircle size={10} /> {t.jaTemParte}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    {aluno.diasSemFazer === 9999 ? (
                                        <div className="flex flex-col items-end">
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold shadow-sm">
                                                {t.nunca}
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-1">{t.estaFuncao}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end">
                                            <span className={`text-sm font-bold ${aluno.diasSemFazer > 60 ? 'text-green-600' : 'text-gray-600'}`}>
                                                {meses > 0 ? `${meses} ${t.mesesAtras}` : `${aluno.diasSemFazer} ${t.diasAtras}`}
                                            </span>
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                <Calendar size={10} /> {new Date(aluno.ultimaData).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        )
                    })}

                    {sugestoes.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            <p>{t.semResultados}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}