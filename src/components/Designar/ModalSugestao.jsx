import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle, AlertCircle, Filter, Info } from 'lucide-react';
import { formatText, useSectionMessages } from '../../i18n';
import { dialog } from '../../utils/dialog';
import {
    getAssignmentContextForSlot,
    isAlunoEligibleForAssignment,
} from '../../utils/assignmentEligibility';
import {
    calcularOcupacaoReuniao,
    calcularRecenciaDesignacao,
    getTipoReuniaoSlot,
} from '../../utils/sugestoesDesignacao.js';

export default function ModalSugestao({
    isOpen,
    onClose,
    onSelect,
    alunos,
    historico,
    parteAtual,
    semanaAtual,
    modalKey, // 'estudante', 'ajudante', 'presidente', 'oracao', 'dirigente', 'leitor'
    slotAtual = null,
    tipoReuniao = null,
    cargosMap,
    lang = 'pt',
    modo = 'sugestao',
    pessoaAtual = null,
    avaliarCandidato = null,
    config = {}
}) {
    const [sugestoes, setSugestoes] = useState([]);
    const [contexto, setContexto] = useState({ labelKey: 'qualquer', gender: 'todos', tipo: 'qualquer', isAjudante: false });

    const t = useSectionMessages('designarSuggest');
    const tipoReuniaoEfetivo = tipoReuniao || getTipoReuniaoSlot(slotAtual || { key: modalKey });

    useEffect(() => {
        if (!isOpen) return;
        calcularSugestoes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isOpen,
        parteAtual,
        modalKey,
        tipoReuniaoEfetivo,
        slotAtual?.parteId,
        slotAtual?.fds,
        slotAtual?.meioSemana,
        slotAtual?.responsabilidadeKey,
        slotAtual?.itemIndex,
        lang,
        semanaAtual,
        historico,
        alunos,
    ]);

    // --- 1. DETECTAR O CONTEXTO EXATO DA PARTE CLICADA ---
    const detectarContexto = () => {
        const ctx = getAssignmentContextForSlot({
            parte: parteAtual,
            slotKey: modalKey,
            cargosMap,
            assignedStudent: parteAtual?.estudante,
        });

        return {
            tipo: ctx.capabilityKey || 'qualquer',
            capabilityKey: ctx.capabilityKey,
            labelKey: ctx.labelKey,
            gender: ctx.gender,
            isAjudante: ctx.isAjudante,
            slotKey: modalKey,
        };
    };

    // --- 2. CALCULAR O HISTÓRICO ISOLADO COM BLINDAGEM DE PRIVILÉGIOS ---
    const calcularSugestoes = () => {
        const ctx = detectarContexto();
        setContexto(ctx);

        // A. Verifica quem já está ocupado somente nesta reunião (meio de semana ou fim de semana)
        const ocupacao = calcularOcupacaoReuniao({
            semana: semanaAtual,
            tipoReuniao: tipoReuniaoEfetivo,
            targetSlot: slotAtual,
            alunos,
            config,
            lang,
        });

        // B. FILTRO DE PRIVILÉGIOS (O MOTOR DE REGRAS)
        let listaFiltrada = alunos.filter(aluno => {
            if (modo === 'substituicao') {
                const atualKey = pessoaAtual?.id || pessoaAtual?.nome;
                const alunoKey = aluno?.id || aluno?.nome;
                if (atualKey && alunoKey && String(atualKey) === String(alunoKey)) return false;
            }

            if (aluno.tipo === 'desab') return false; // Desabilitados nunca entram

            const eligibility = isAlunoEligibleForAssignment({
                aluno,
                parte: parteAtual,
                slotKey: modalKey,
                cargosMap,
                assignedStudent: parteAtual?.estudante,
                lang,
            });
            if (!eligibility.eligible || (avaliarCandidato && !avaliarCandidato(aluno).eligible)) return false;

            return true;
        });

        // C. Mapear o Histórico exato para cada aluno que passou nos filtros
        listaFiltrada = listaFiltrada.map(aluno => {
            const { ultimaData, diasSemFazer } = calcularRecenciaDesignacao({
                alunoId: aluno.id, historico, contexto: ctx, config,
            });

            return {
                ...aluno,
                ultimaData,
                diasSemFazer,
                ocupadoAgora: ocupacao.isAlunoOcupado(aluno),
                partesOcupadas: ocupacao.getPartesOcupadas(aluno),
                familiaOcupadaAgora: ocupacao.isFamiliaOcupada(aluno),
            };
        });

        // D. ORDENAÇÃO
        listaFiltrada.sort((a, b) => {
            if (a.ocupadoAgora && !b.ocupadoAgora) return 1;
            if (!a.ocupadoAgora && b.ocupadoAgora) return -1;
            if (!a.ocupadoAgora && !b.ocupadoAgora) {
                if (a.familiaOcupadaAgora && !b.familiaOcupadaAgora) return 1;
                if (!a.familiaOcupadaAgora && b.familiaOcupadaAgora) return -1;
            }

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

    const reuniaoLabel = tipoReuniaoEfetivo === 'fimDeSemana'
        ? (t.reuniaoFimDeSemana || 'Fim de semana')
        : (t.reuniaoMeioSemana || 'Meio de semana');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-4 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <CheckCircle size={20} className="text-green-300" /> {modo === 'substituicao' ? t.substituirDesignado : t.titulo}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-blue-100 text-xs">
                            <Filter size={12} />
                            <span>{t.filtro}: <strong>{t.labels[contexto.labelKey] || contexto.labelKey}</strong></span>
                            <span className="opacity-50">|</span>
                            <span>{t.reuniaoLabel || 'Reunião'}: <strong>{reuniaoLabel}</strong></span>
                            <span className="opacity-50">|</span>
                            <span>{t.genero}: <strong>{getGenderLabel()}</strong></span>
                            {modo === 'substituicao' && pessoaAtual?.nome && (
                                <>
                                    <span className="opacity-50">|</span>
                                    <span>{t.atual}: <strong>{pessoaAtual.nome}</strong></span>
                                </>
                            )}
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
                        const motivos = [
                            aluno.diasSemFazer === 9999
                                ? { label: t.nuncaFezParte || 'Nunca fez esta parte', tone: 'green' }
                                : aluno.diasSemFazer < 0
                                    ? { label: t.jaTemParteFutura || 'Já tem parte futura', tone: 'blue' }
                                    : { label: formatText(t.diasDesdeUltimaTpl || '{DIAS} dias desde a última vez', { DIAS: aluno.diasSemFazer }), tone: 'green' },
                            {
                                label: contexto.gender === 'todos'
                                    ? (t.perfilCompativel || 'Perfil compatível')
                                    : (t.generoCompativel || 'Gênero compatível'),
                                tone: 'blue',
                            },
                            aluno.ocupadoAgora
                                ? { label: t.jaUsadoReuniao || 'Já usado nesta reunião', tone: 'red' }
                                : { label: t.livreReuniao || 'Livre nesta reunião', tone: 'blue' },
                        ];
                        if (aluno.familiaOcupadaAgora && !aluno.ocupadoAgora) {
                            motivos.push({ label: t.familiaJaUsada, tone: 'amber' });
                        }

                        const mostrarSeparadorNuncaFez = index > 0
                            && aluno.diasSemFazer === 9999
                            && sugestoes[index - 1].diasSemFazer !== 9999
                            && !!aluno.ocupadoAgora === !!sugestoes[index - 1].ocupadoAgora;

                        const partesOcupadasResumo = (aluno.partesOcupadas || []).join(', ');

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
                                    onClick={async () => {
                                        if (aluno.familiaOcupadaAgora && !aluno.ocupadoAgora) {
                                            const confirmacao = await dialog.confirm({
                                                title: 'Membro da Família Já Designado',
                                                message: t.confirmarFamilia,
                                                variant: 'warning',
                                                confirmText: 'Continuar',
                                                cancelText: 'Cancelar'
                                            });
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
                                    <div className="flex items-center gap-3 min-w-0">
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
                                        <div className="min-w-0">
                                            <div className="font-bold text-gray-800">{aluno.nome}</div>
                                            <div className="text-xs text-gray-500 flex flex-wrap items-center gap-1 mt-0.5">
                                                <span className="px-1.5 py-0.5 bg-gray-100 rounded border text-[9px] font-bold">
                                                    {(cargosMap?.[aluno.tipo]?.[lang] || aluno.tipo)}
                                                </span>
                                                {aluno.ocupadoAgora && (
                                                    <span
                                                        className="text-red-500 font-bold ml-1 flex items-center gap-1 text-[10px]"
                                                        title={partesOcupadasResumo || t.jaTemParte}
                                                    >
                                                        <AlertCircle size={10} className="shrink-0" />
                                                        <span>
                                                            {t.jaTemParte}
                                                            {partesOcupadasResumo ? ` • ${partesOcupadasResumo}` : ''}
                                                        </span>
                                                    </span>
                                                )}
                                                {aluno.familiaOcupadaAgora && !aluno.ocupadoAgora && <span className="text-amber-600 font-bold ml-1 flex items-center gap-1 text-[10px]"><AlertCircle size={10} /> {t.familiaJaUsada}</span>}
                                            </div>
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                {motivos.map((motivo) => (
                                                    <span
                                                        key={motivo.label}
                                                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${motivo.tone === 'red'
                                                            ? 'bg-red-50 text-red-600'
                                                            : motivo.tone === 'amber'
                                                                ? 'bg-amber-50 text-amber-700'
                                                                : motivo.tone === 'green'
                                                                    ? 'bg-green-50 text-green-700'
                                                                    : 'bg-blue-50 text-blue-700'
                                                            }`}
                                                    >
                                                        {motivo.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0 ml-2">
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
