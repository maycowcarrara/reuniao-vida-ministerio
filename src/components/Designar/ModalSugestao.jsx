import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle, AlertCircle, Filter, Info } from 'lucide-react';

// Função auxiliar para normalizar texto (tirar acentos, minúsculas)
const norm = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const T = {
    pt: {
        titulo: "Sugestão Inteligente",
        filtro: "Filtro",
        genero: "Gênero",
        homens: "Homens",
        mulheres: "Mulheres",
        todos: "Todos",
        nunca: "Nunca fez",
        futuro: "Futuro",
        estaFuncao: "esta parte",
        mesesAtras: "meses atrás",
        diasAtras: "dias atrás",
        jaTemParte: "Já tem parte na semana",
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
        futuro: "Futuro",
        estaFuncao: "esta parte",
        mesesAtras: "meses atrás",
        diasAtras: "días atrás",
        jaTemParte: "Ya tiene asignación",
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
    modalKey, // 'estudante', 'ajudante', 'presidente', 'oracao', etc.
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

    // --- 1. DETECTAR O CONTEXTO EXATO DA PARTE CLICADA ---
    const detectarContexto = () => {
        let ctx = { tipo: 'qualquer', labelKey: 'qualquer', gender: 'todos' };

        const tituloNorm = norm(parteAtual?.titulo);
        const secaoNorm = norm(parteAtual?.secao);

        const hasLeitura = tituloNorm.includes('leitura') || tituloNorm.includes('lectura');
        const hasJoias = tituloNorm.includes('joias') || tituloNorm.includes('perlas');
        const hasEstudo = tituloNorm.includes('estudo') || tituloNorm.includes('estudio');
        const hasDiscurso = tituloNorm.includes('discurso');

        // Casos de chaves diretas (Slots fixos)
        if (modalKey === 'presidente') return { tipo: 'presidente', labelKey: 'presidente', gender: 'M' };
        if (modalKey === 'oracao') return { tipo: 'oracao', labelKey: 'oracao', gender: 'M' };
        if (modalKey === 'dirigente') return { tipo: 'dirigente', labelKey: 'dirigente', gender: 'M' };
        if (modalKey === 'leitor') return { tipo: 'leitor', labelKey: 'leitor', gender: 'M' };

        // Casos de Estudante/Ajudante dependendo da seção
        if (secaoNorm.includes('tesouros')) {
            if (hasLeitura && !hasEstudo) return { tipo: 'leitura', labelKey: 'leitura', gender: 'M' };
            if (hasJoias) return { tipo: 'joias', labelKey: 'joias', gender: 'M' };
            return { tipo: 'tesouros', labelKey: 'tesouros', gender: 'M' }; // O Discurso de 10 min
        }

        if (secaoNorm.includes('ministerio')) {
            if (hasDiscurso) return { tipo: 'discurso', labelKey: 'discurso', gender: 'M' };
            return { tipo: 'ministerio', labelKey: 'ministerio', gender: 'todos' };
        }

        if (secaoNorm.includes('vida')) {
            if (hasEstudo) return { tipo: 'estudobiblico', labelKey: 'estudobiblico', gender: 'M' };
            return { tipo: 'vida', labelKey: 'vida', gender: 'todos' }; // Entrevistas/partes normais
        }

        return ctx;
    };

    // --- 2. CALCULAR O HISTÓRICO ISOLADO ---
    const calcularSugestoes = () => {
        const ctx = detectarContexto();
        setContexto(ctx);

        // A. Verifica quem já está ocupado na semana do modal
        const ocupadosNestaSemana = new Set();
        if (semanaAtual && Array.isArray(semanaAtual.partes)) {
            if (semanaAtual.presidente?.id) ocupadosNestaSemana.add(semanaAtual.presidente.id);
            semanaAtual.partes.forEach(p => {
                const addIfObj = (u) => { if (u?.id) ocupadosNestaSemana.add(u.id); };
                addIfObj(p.estudante); addIfObj(p.ajudante); addIfObj(p.leitor); addIfObj(p.dirigente); addIfObj(p.oracao);
            });
        }

        // B. Filtrar os alunos iniciais por Gênero e Status
        let listaFiltrada = alunos.filter(aluno => {
            if (aluno.tipo === 'desab') return false; // Desabilitados nunca entram na sugestão

            const cargoInfo = cargosMap?.[aluno.tipo];
            const generoAluno = cargoInfo?.gen || 'M';

            if (ctx.gender !== 'todos' && generoAluno !== ctx.gender) return false;
            return true;
        });

        // C. Mapear o Histórico exato para cada aluno
        listaFiltrada = listaFiltrada.map(aluno => {
            let ultimaData = null;
            let diasSemFazer = 9999; // 9999 = Nunca fez esta parte específica

            // Varre o histórico (da lista completa) do mais recente (ou futuro) para o mais antigo
            for (let i = historico.length - 1; i >= 0; i--) {
                const semana = historico[i];
                // Aqui removemos a trava do "continue" que ignorava o futuro. Ele agora lê datas futuras normalmente.

                let fezParteEspecifica = false;

                if (ctx.tipo === 'presidente' && semana.presidente?.id === aluno.id) {
                    fezParteEspecifica = true;
                } else if (Array.isArray(semana.partes)) {
                    for (const p of semana.partes) {
                        const isEstud = p.estudante?.id === aluno.id;
                        const isAjud = p.ajudante?.id === aluno.id;
                        const isOrac = p.oracao?.id === aluno.id;
                        const isDirig = p.dirigente?.id === aluno.id;
                        const isLeit = p.leitor?.id === aluno.id;

                        if (!isEstud && !isAjud && !isOrac && !isDirig && !isLeit) continue;

                        const sNorm = norm(p.secao);
                        const tNorm = norm(p.titulo);
                        const hasLeitura = tNorm.includes('leitura') || tNorm.includes('lectura');
                        const hasJoias = tNorm.includes('joias') || tNorm.includes('perlas');
                        const hasEstudo = tNorm.includes('estudo') || tNorm.includes('estudio');
                        const hasDiscurso = tNorm.includes('discurso');

                        // Match cirúrgico baseado no Contexto da aba clicada:
                        if (ctx.tipo === 'oracao' && isOrac) fezParteEspecifica = true;
                        if (ctx.tipo === 'dirigente' && isDirig) fezParteEspecifica = true;
                        if (ctx.tipo === 'leitor' && isLeit) fezParteEspecifica = true;

                        if (ctx.tipo === 'leitura' && isEstud && sNorm.includes('tesouros') && hasLeitura && !hasEstudo) fezParteEspecifica = true;
                        if (ctx.tipo === 'joias' && isEstud && sNorm.includes('tesouros') && hasJoias) fezParteEspecifica = true;
                        if (ctx.tipo === 'tesouros' && isEstud && sNorm.includes('tesouros') && !hasLeitura && !hasJoias) fezParteEspecifica = true;

                        if (ctx.tipo === 'discurso' && isEstud && sNorm.includes('ministerio') && hasDiscurso) fezParteEspecifica = true;
                        if (ctx.tipo === 'ministerio' && (isEstud || isAjud) && sNorm.includes('ministerio') && !hasDiscurso) fezParteEspecifica = true;

                        if (ctx.tipo === 'estudobiblico' && isDirig) fezParteEspecifica = true;
                        if (ctx.tipo === 'vida' && (isEstud || isAjud) && sNorm.includes('vida') && !hasEstudo) fezParteEspecifica = true;

                        if (fezParteEspecifica) break; // Achou a parte exata!
                    }
                }

                // Se fez a exata parte que estamos pedindo, calcula os dias (Inclusive aceitando datas negativas/futuras)
                if (fezParteEspecifica) {
                    ultimaData = semana.dataReuniao;

                    // Tratamento seguro contra fuso horário (Força o cálculo ser exato ao meio dia)
                    const hoje = new Date();
                    hoje.setHours(12, 0, 0, 0);
                    const dataParte = new Date(semana.dataReuniao + 'T12:00:00');

                    const diffTime = hoje.getTime() - dataParte.getTime();
                    diasSemFazer = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    break; // Interrompe pois achou a vez mais recente/futura que o aluno fez esta exata parte
                }
            }

            return {
                ...aluno,
                ultimaData,
                diasSemFazer,
                ocupadoAgora: ocupadosNestaSemana.has(aluno.id)
            };
        });

        // D. Filtrar quem NUNCA fez para não sugerir pessoas fora de qualificação
        listaFiltrada = listaFiltrada.filter(aluno => {
            // Se já fez na vida, o histórico prova que ele é qualificado, passa direto.
            if (aluno.diasSemFazer !== 9999) return true;

            // Se nunca fez, checa se o "Cargo/Privilégio" dele permite fazer esta parte (Evita poluir a lista com Publicadores em partes de Ancião)
            const tipo = aluno.tipo;
            switch (ctx.tipo) {
                case 'presidente': return ['anciao'].includes(tipo);
                case 'tesouros': return ['anciao', 'servo'].includes(tipo);
                case 'joias': return ['anciao', 'servo', 'irmao_hab'].includes(tipo);
                case 'estudobiblico':
                case 'dirigente': return ['anciao', 'servo'].includes(tipo);
                default: return true;
            }
        });

        // E. ORDENAÇÃO MATADORA E INFALÍVEL
        listaFiltrada.sort((a, b) => {
            // 1. Ocupados hoje vão lá pro final
            if (a.ocupadoAgora && !b.ocupadoAgora) return 1;
            if (!a.ocupadoAgora && b.ocupadoAgora) return -1;

            // 2. Quem "Nunca Fez (9999)" vai pro final da lista
            const aNunca = a.diasSemFazer === 9999;
            const bNunca = b.diasSemFazer === 9999;
            if (aNunca && !bNunca) return 1;
            if (!aNunca && bNunca) return -1;

            // 3. Ambos já fizeram. Ordenação DECRESCENTE baseada em dias.
            // Exemplos: 150 dias atrás (vem no topo) -> 10 dias (vem depois) -> -5 dias Futuro (vai pro final)
            if (!aNunca && !bNunca) {
                return b.diasSemFazer - a.diasSemFazer;
            }

            // 4. Se ambos nunca fizeram, desempate alfabético
            return a.nome.localeCompare(b.nome);
        });

        setSugestoes(listaFiltrada);
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

                {/* Lista de Sugestões */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50 custom-scroll relative">
                    {sugestoes.map((aluno, index) => {
                        const meses = aluno.diasSemFazer !== 9999 ? Math.floor(aluno.diasSemFazer / 30) : null;

                        // Linha separadora visual para os que nunca fizeram
                        const mostrarSeparadorNuncaFez = index > 0 && aluno.diasSemFazer === 9999 && sugestoes[index - 1].diasSemFazer !== 9999;

                        return (
                            <React.Fragment key={aluno.id}>
                                {mostrarSeparadorNuncaFez && (
                                    <div className="flex items-center gap-2 py-2 px-1 opacity-50">
                                        <hr className="flex-1 border-gray-300" />
                                        <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Info size={10} /> {t.nunca}</span>
                                        <hr className="flex-1 border-gray-300" />
                                    </div>
                                )}
                                <button
                                    disabled={aluno.ocupadoAgora}
                                    onClick={() => onSelect(aluno)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left group relative
                                    ${aluno.ocupadoAgora
                                            ? 'opacity-60 bg-gray-100 cursor-not-allowed border-gray-200'
                                            : 'bg-white hover:border-blue-500 hover:shadow-md border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm shrink-0 overflow-hidden border
                                            ${aluno.ocupadoAgora ? 'bg-gray-300 text-gray-500 border-gray-300' : 'bg-blue-100 text-blue-700 border-blue-200'}
                                        `}>
                                            {/* Integração com a Foto (Avatar) */}
                                            {aluno.avatar ? (
                                                <img src={aluno.avatar} alt={aluno.nome} className="w-full h-full object-cover" />
                                            ) : (
                                                aluno.nome.charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800">{aluno.nome}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                <span className="px-1.5 py-0.5 bg-gray-100 rounded border text-[9px] font-bold">
                                                    {(cargosMap?.[aluno.tipo]?.[lang] || aluno.tipo)}
                                                </span>
                                                {aluno.ocupadoAgora && <span className="text-red-500 font-bold ml-1 flex items-center gap-1 text-[10px]"><AlertCircle size={10} /> {t.jaTemParte}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        {aluno.diasSemFazer === 9999 ? (
                                            <div className="flex flex-col items-end">
                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold border border-gray-200">
                                                    {t.nunca}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-end">
                                                {/* Se diasSemFazer < 0, significa que a designação é para o futuro! */}
                                                {aluno.diasSemFazer < 0 ? (
                                                    <span className="text-sm font-black text-blue-600">
                                                        {t.futuro || "Futuro"}
                                                    </span>
                                                ) : (
                                                    <span className={`text-sm font-black ${aluno.diasSemFazer > 60 ? 'text-green-600' : 'text-gray-600'}`}>
                                                        {meses > 0 ? `${meses} ${t.mesesAtras}` : `${aluno.diasSemFazer} ${t.diasAtras}`}
                                                    </span>
                                                )}
                                                <span className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5 font-bold">
                                                    <Calendar size={10} /> {new Date(aluno.ultimaData + 'T12:00:00').toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            </React.Fragment>
                        );
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