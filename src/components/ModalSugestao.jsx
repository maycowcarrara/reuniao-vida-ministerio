import React, { useState, useEffect } from 'react';
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
            estudobiblico: "Estudo Bíblico (Dirigente)",
            dirigente: "Dirigente (EBC)",
            leitor: "Leitor (EBC)",
            estudante: "Parte de Estudante",
            ministerio: "Parte de Estudante",
            discurso: "Discurso (Ministério)"
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
            estudobiblico: "Estudio Bíblico (Director)",
            dirigente: "Director (EBC)",
            leitor: "Lector (EBC)",
            estudante: "Parte de Estudiante",
            ministerio: "Parte de Estudiante",
            discurso: "Discurso (Ministerio)"
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
    modalKey, // 'estudante', 'ajudante', 'presidente', etc.
    cargosMap,
    lang = 'pt'
}) {
    const [sugestoes, setSugestoes] = useState([]);
    const [contexto, setContexto] = useState({ labelKey: 'qualquer', gender: 'todos', tipo: 'qualquer' });

    const t = T[lang] || T.pt;

    useEffect(() => {
        if (!isOpen) return;
        calcularSugestoes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, parteAtual, modalKey, lang]);

    // --- 1. DETECTAR O QUE ESTAMOS PROCURANDO (CONTEXTO) ---
    const detectarContexto = () => {
        // Padrão
        let ctx = { tipo: 'qualquer', labelKey: 'qualquer', gender: 'todos' };

        const titulo = (parteAtual?.titulo || '').toLowerCase();
        const secao = (parteAtual?.secao || '').toLowerCase();

        // Helpers de palavras-chave (bilingue)
        const kw = {
            leitura: ['leitura', 'lectura'],
            joias: ['joias', 'jóias', 'perlas'],
            estudo: ['estudo', 'estudio'],
            discurso: ['discurso']
        };

        // --- Casos Específicos do ModalKey ---
        if (modalKey === 'presidente') return { tipo: 'presidente', labelKey: 'presidente', gender: 'M' };
        if (modalKey === 'oracao') return { tipo: 'oracao', labelKey: 'oracao', gender: 'M' };
        if (modalKey === 'dirigente') return { tipo: 'dirigente', labelKey: 'dirigente', gender: 'M' }; // EBC Dirigente
        if (modalKey === 'leitor') return { tipo: 'leitor', labelKey: 'leitor', gender: 'M' }; // EBC Leitor

        // --- Casos Baseados na Parte (Titulo/Secao) ---

        // 1. TESOUROS
        if (kw.leitura.some(k => titulo.includes(k)) && !kw.estudo.some(k => titulo.includes(k))) {
            return { tipo: 'leitura', labelKey: 'leitura', gender: 'M' };
        }
        if (kw.joias.some(k => titulo.includes(k))) {
            return { tipo: 'joias', labelKey: 'joias', gender: 'M' };
        }
        if (secao.includes('tesouros')) {
            // Se é tesouros e não é leitura nem joias, é a parte 1 (Discurso)
            return { tipo: 'tesouros', labelKey: 'tesouros', gender: 'M' };
        }

        // 2. MINISTÉRIO
        if (secao.includes('ministerio') || secao.includes('ministério')) {
            if (kw.discurso.some(k => titulo.includes(k))) {
                return { tipo: 'discurso', labelKey: 'discurso', gender: 'M' };
            }
            // Estudante normal
            return { tipo: 'ministerio', labelKey: 'ministerio', gender: 'todos' };
        }

        // 3. VIDA CRISTÃ
        if (secao.includes('vida')) {
            if (kw.estudo.some(k => titulo.includes(k))) {
                return { tipo: 'estudobiblico', labelKey: 'estudobiblico', gender: 'M' };
            }
            return { tipo: 'vida', labelKey: 'vida', gender: 'M' };
        }

        return ctx;
    };

    // --- 2. CALCULAR HISTÓRICO ---
    const calcularSugestoes = () => {
        const ctx = detectarContexto();
        setContexto(ctx);

        // A. Quem já está ocupado nesta semana?
        const ocupadosNestaSemana = new Set();
        if (semanaAtual && Array.isArray(semanaAtual.partes)) {
            // Presidente
            if (semanaAtual.presidente?.nome) ocupadosNestaSemana.add(semanaAtual.presidente.nome);
            if (semanaAtual.presidente?.id) ocupadosNestaSemana.add(semanaAtual.presidente.id);

            // Partes
            semanaAtual.partes.forEach(p => {
                const addIfObj = (u) => { if (u?.nome) ocupadosNestaSemana.add(u.nome); if (u?.id) ocupadosNestaSemana.add(u.id); };
                addIfObj(p.estudante);
                addIfObj(p.ajudante);
                addIfObj(p.leitor);
                addIfObj(p.dirigente);
                addIfObj(p.oracao);
            });
        }

        // B. Função auxiliar para classificar uma parte do histórico
        // Retorna o "tipo" daquela parte antiga, para compararmos com o ctx.tipo
        const classificarParteHistorica = (p) => {
            const tLower = (p.titulo || '').toLowerCase();
            const sLower = (p.secao || '').toLowerCase();

            // Keywords helpers
            const has = (arr) => arr.some(k => tLower.includes(k));
            const kRead = ['leitura', 'lectura'];
            const kGems = ['joias', 'jóias', 'perlas'];
            const kDisc = ['discurso'];
            const kStudy = ['estudo', 'estudio'];

            // 1. Orações
            if (p.oracao) return 'oracao';

            // 2. Tesouros
            if (sLower.includes('tesouros')) {
                if (has(kRead)) return 'leitura';
                if (has(kGems)) return 'joias';
                return 'tesouros'; // Discurso 10min
            }

            // 3. Ministério
            if (sLower.includes('ministerio') || sLower.includes('ministério')) {
                if (has(kDisc)) return 'discurso';
                return 'ministerio'; // Partes de estudante
            }

            // 4. Vida Cristã / Estudo
            if (sLower.includes('vida') || has(kStudy)) {
                // Se foi dirigente de estudo
                if (p.dirigente) return 'estudobiblico'; // ou 'dirigente'
                // Se foi leitor de estudo
                if (p.leitor && has(kStudy)) return 'leitor';
                // Parte comum de Vida Cristã
                return 'vida';
            }

            return 'desconhecido';
        };

        // C. Filtrar alunos elegíveis pelo gênero
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

                // Loop reverso no histórico (do mais recente para o antigo)
                // historico deve vir ordenado cronologicamente. Se vier do mais antigo pro novo, inverta o loop.
                // Assumindo que listaProgramacoes vem ordenada por data.
                for (let i = historico.length - 1; i >= 0; i--) {
                    const semana = historico[i];
                    // Ignora reuniões futuras
                    if (new Date(semana.dataReuniao) > new Date()) continue;

                    let fezParteCompativel = false;

                    // Verifica Presidente
                    if (ctx.tipo === 'presidente') {
                        const pres = semana.presidente;
                        if ((pres?.id === aluno.id) || (pres?.nome === aluno.nome)) fezParteCompativel = true;
                    }
                    // Verifica Partes
                    else if (Array.isArray(semana.partes)) {
                        for (const p of semana.partes) {
                            // O aluno participou dessa parte?
                            const participou =
                                (p.estudante?.nome === aluno.nome) ||
                                (p.ajudante?.nome === aluno.nome) || // Se for ministério, ajudante conta como ter feito parte
                                (p.leitor?.nome === aluno.nome) ||
                                (p.dirigente?.nome === aluno.nome) ||
                                (p.oracao?.nome === aluno.nome);

                            if (participou) {
                                // Se participou, qual era o tipo daquela parte?
                                const tipoDaParteAntiga = classificarParteHistorica(p);

                                // Verifica compatibilidade
                                if (tipoDaParteAntiga === ctx.tipo) {
                                    fezParteCompativel = true;
                                    break; // Encontrou nessa semana
                                }

                                // Caso especial: EBC Dirigente vs 'dirigente' do modal
                                if (ctx.tipo === 'dirigente' && (tipoDaParteAntiga === 'estudobiblico' || tipoDaParteAntiga === 'dirigente')) {
                                    fezParteCompativel = true; break;
                                }
                            }
                        }
                    }

                    if (fezParteCompativel) {
                        ultimaData = semana.dataReuniao;
                        const diff = Math.abs(new Date() - new Date(semana.dataReuniao));
                        diasSemFazer = Math.ceil(diff / (1000 * 60 * 60 * 24));
                        break; // Encontrou a última, para de procurar
                    }
                }

                return {
                    ...aluno,
                    ultimaData,
                    diasSemFazer,
                    ocupadoAgora: ocupadosNestaSemana.has(aluno.id) || ocupadosNestaSemana.has(aluno.nome)
                };
            });

        // D. Ordenar: Quem não está ocupado primeiro, depois quem faz tempo que não faz
        listaAnalise.sort((a, b) => {
            if (a.ocupadoAgora && !b.ocupadoAgora) return 1;
            if (!a.ocupadoAgora && b.ocupadoAgora) return -1;
            return b.diasSemFazer - a.diasSemFazer; // Decrescente de dias (quem fez há mais tempo aparece primeiro)
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