import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle, AlertCircle, Filter, Info } from 'lucide-react';
import { formatText, useSectionMessages } from '../../i18n';

// Função auxiliar para normalizar texto (tirar acentos, minúsculas)
const norm = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function ModalSugestao({
    isOpen,
    onClose,
    onSelect,
    alunos,
    historico,
    parteAtual,
    semanaAtual,
    modalKey, // 'estudante', 'ajudante', 'presidente', 'oracao', 'dirigente', 'leitor'
    cargosMap,
    lang = 'pt'
}) {
    const [sugestoes, setSugestoes] = useState([]);
    const [contexto, setContexto] = useState({ labelKey: 'qualquer', gender: 'todos', tipo: 'qualquer', isAjudante: false });

    const t = useSectionMessages('designarSuggest');

    useEffect(() => {
        if (!isOpen) return;
        calcularSugestoes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, parteAtual, modalKey, lang]);

    // --- 1. DETECTAR O CONTEXTO EXATO DA PARTE CLICADA ---
    const detectarContexto = () => {
        let ctx = { tipo: 'qualquer', labelKey: 'qualquer', gender: 'todos', isAjudante: false };

        const tituloNorm = norm(parteAtual?.titulo);
        const secaoNorm = norm(parteAtual?.secao);

        const hasLeitura = tituloNorm.includes('leitura') || tituloNorm.includes('lectura');
        const hasJoias = tituloNorm.includes('joias') || tituloNorm.includes('perlas');
        const hasEstudo = tituloNorm.includes('estudo') || tituloNorm.includes('estudio');
        const hasDiscurso = tituloNorm.includes('discurso');

        // MÁGICA 1: Forçar gênero do ajudante para ser igual ao do estudante
        let forceGender = null;
        if (modalKey === 'ajudante') {
            ctx.isAjudante = true;
            ctx.labelKey = 'ajudante';
            if (parteAtual?.estudante) {
                const tipoEstudante = parteAtual.estudante.tipo;
                forceGender = cargosMap?.[tipoEstudante]?.gen || null;
            }
        }

        // Casos de chaves diretas (Slots fixos)
        if (modalKey === 'presidente') { ctx.tipo = 'presidente'; ctx.labelKey = 'presidente'; ctx.gender = 'M'; }
        else if (modalKey === 'oracao') { ctx.tipo = 'oracao'; ctx.labelKey = 'oracao'; ctx.gender = 'M'; }
        else if (modalKey === 'dirigente') { ctx.tipo = 'dirigente'; ctx.labelKey = 'dirigente'; ctx.gender = 'M'; }
        else if (modalKey === 'leitor') { ctx.tipo = 'leitor'; ctx.labelKey = 'leitor'; ctx.gender = 'M'; }

        // Casos de Estudante/Ajudante dependendo da seção
        else if (secaoNorm.includes('tesouros')) {
            if (hasLeitura && !hasEstudo) { ctx.tipo = 'leitura'; ctx.labelKey = 'leitura'; ctx.gender = 'M'; }
            else if (hasJoias) { ctx.tipo = 'joias'; ctx.labelKey = 'joias'; ctx.gender = 'M'; }
            else { ctx.tipo = 'tesouros'; ctx.labelKey = 'tesouros'; ctx.gender = 'M'; }
        }
        else if (secaoNorm.includes('ministerio')) {
            if (hasDiscurso) { ctx.tipo = 'discurso'; ctx.labelKey = 'discurso'; ctx.gender = 'M'; }
            else { ctx.tipo = 'ministerio'; ctx.labelKey = 'ministerio'; ctx.gender = 'todos'; }
        }
        else if (secaoNorm.includes('vida')) {
            if (hasEstudo) { ctx.tipo = 'estudobiblico'; ctx.labelKey = 'estudobiblico'; ctx.gender = 'M'; }
            else { ctx.tipo = 'vida'; ctx.labelKey = 'vida'; ctx.gender = 'todos'; }
        }

        // Se for ajudante, aplicamos o gênero forçado do estudante
        if (forceGender) {
            ctx.gender = forceGender;
        }

        return ctx;
    };

    // --- 2. CALCULAR O HISTÓRICO ISOLADO COM BLINDAGEM DE PRIVILÉGIOS ---
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

        // B. FILTRO DE PRIVILÉGIOS (O MOTOR DE REGRAS)
        let listaFiltrada = alunos.filter(aluno => {
            if (aluno.tipo === 'desab') return false; // Desabilitados nunca entram

            const cargoInfo = cargosMap?.[aluno.tipo];
            const generoAluno = cargoInfo?.gen || 'M';

            if (ctx.gender !== 'todos' && generoAluno !== ctx.gender) return false;

            // REGRAS RIGOROSAS
            let allowedRoles = [];

            if (ctx.isAjudante) {
                // Ajudantes: Todos, inclui irmãs limitadas
                allowedRoles = ['anciao', 'servo', 'irmao_hab', 'irmao', 'irma_exp', 'irma', 'irma_lim'];
            } else {
                switch (ctx.tipo) {
                    case 'presidente':
                    case 'tesouros':
                    case 'joias':
                    case 'estudobiblico':
                    case 'dirigente':
                    case 'vida':
                        // Vida Cristã, Tesouros, Joias, Dirigente e Presidente: Somente Anciãos e Servos
                        allowedRoles = ['anciao', 'servo'];
                        break;
                    case 'oracao':
                    case 'leitor':
                    case 'discurso':
                        // Oração, Leitor e Discurso(Ministério): Varão Hab, Ancião e Servo
                        allowedRoles = ['anciao', 'servo', 'irmao_hab'];
                        break;
                    case 'leitura':
                        // Leitura: Todos os varões, mesmo não batizados (irmao)
                        allowedRoles = ['anciao', 'servo', 'irmao_hab', 'irmao'];
                        break;
                    case 'ministerio':
                        // Ministério principal: Todos, menos irmãs limitadas
                        allowedRoles = ['anciao', 'servo', 'irmao_hab', 'irmao', 'irma_exp', 'irma'];
                        break;
                    default:
                        allowedRoles = ['anciao', 'servo', 'irmao_hab', 'irmao', 'irma_exp', 'irma', 'irma_lim'];
                        break;
                }
            }

            // Se o cargo atual do irmão não estiver na lista permitida, ele é desclassificado.
            if (!allowedRoles.includes(aluno.tipo)) return false;

            return true;
        });

        // C. Mapear o Histórico exato para cada aluno que passou nos filtros
        listaFiltrada = listaFiltrada.map(aluno => {
            let ultimaData = null;
            let diasSemFazer = 9999;

            for (let i = historico.length - 1; i >= 0; i--) {
                const semana = historico[i];
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

                        if (fezParteEspecifica) break;
                    }
                }

                if (fezParteEspecifica) {
                    ultimaData = semana.dataReuniao;

                    const hoje = new Date();
                    hoje.setHours(12, 0, 0, 0);
                    const dataParte = new Date(semana.dataReuniao + 'T12:00:00');

                    const diffTime = hoje.getTime() - dataParte.getTime();
                    diasSemFazer = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    break;
                }
            }

            return {
                ...aluno,
                ultimaData,
                diasSemFazer,
                ocupadoAgora: ocupadosNestaSemana.has(aluno.id)
            };
        });

        // D. ORDENAÇÃO
        listaFiltrada.sort((a, b) => {
            if (a.ocupadoAgora && !b.ocupadoAgora) return 1;
            if (!a.ocupadoAgora && b.ocupadoAgora) return -1;

            const aNunca = a.diasSemFazer === 9999;
            const bNunca = b.diasSemFazer === 9999;
            if (aNunca && !bNunca) return 1;
            if (!aNunca && bNunca) return -1;

            if (!aNunca && !bNunca) {
                return b.diasSemFazer - a.diasSemFazer;
            }

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
                                    onClick={() => {
                                        // MÁGICA: Permite seleção mesmo ocupado, mediante confirmação
                                        if (aluno.ocupadoAgora) {
                                            const confirmacao = window.confirm(t.confirmarDuplicado);
                                            if (!confirmacao) return;
                                        }
                                        onSelect(aluno);
                                    }}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left group relative hover:shadow-md
                                    ${aluno.ocupadoAgora
                                            ? 'bg-red-50/30 border-red-100 hover:border-red-400'
                                            : 'bg-white border-gray-200 hover:border-blue-500'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm shrink-0 overflow-hidden border
                                            ${aluno.ocupadoAgora ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}
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
                                                {/* Dias no Futuro legíveis */}
                                                {aluno.diasSemFazer < 0 ? (
                                                    <span className="text-[13px] font-black text-blue-600">
                                                        {formatText(t.daquiAdias, { DIAS: Math.abs(aluno.diasSemFazer) })}
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
                        <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                            <Info size={40} className="mb-3 opacity-20" />
                            <p className="font-bold text-sm">{t.semResultados}</p>
                            <p className="text-xs opacity-60 max-w-[250px] mx-auto mt-2">{formatText(t.semResultadosDescricaoTpl, { label: t.labels[contexto.labelKey] || contexto.labelKey })}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
