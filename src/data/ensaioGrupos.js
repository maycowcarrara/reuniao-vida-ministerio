import { normalizeGruposProgramacao, GRUPO_ESPANHOL_ID } from '../utils/gruposProgramacao.js';

export const USUARIO_ENSAIO_GRUPOS = Object.freeze({ uid: 'ensaio-local-e2', email: 'ensaio@local.invalid' });
export const createDadosEnsaioGrupos = () => ({
    configuracoes: normalizeGruposProgramacao({ nome_cong: 'Congregação de ensaio local' }),
    alunos: [{ id: 'pessoa-fixture-001', nome: 'Pessoa de ensaio', tipo: 'servo', historico: [], partesHabilitadas: ['presidente_rvm'] }],
    historico_reunioes: [
        { id: 'semana-legada-fixture', semana: '2-8 de novembro de 2026', dataInicio: '2026-11-02',
            dataReuniao: '2026-11-02', partes: [], publicadaNoQuadro: false, fixtureDesconhecida: 'preservar' },
        { id: 'prog-grupo-espanhol-2026-11-02', grupoId: GRUPO_ESPANHOL_ID, versaoProgramacao: 2,
            semana: '2-8 de noviembre de 2026', dataInicio: '2026-11-02', meioSemana: { ativo: false },
            fimDeSemana: { ativo: true, data: '2026-11-08', horario: '09:30' }, partes: [], publicadaNoQuadro: false },
    ],
});

// Cenários adicionais da E3, separados para conservar as fixtures-base da E2.
export const createDadosEnsaioReunioes = () => {
    const dados = createDadosEnsaioGrupos();
    dados.configuracoes.grupos[GRUPO_ESPANHOL_ID].eventosAnuais = [
        { dataInicio: '2026-11-23', dataInput: '2026-11-29', tipo: 'assembleia' },
    ];
    dados.historico_reunioes.push({
        id: 'fixture-es-cancelada', grupoId: GRUPO_ESPANHOL_ID, versaoProgramacao: 2,
        dataInicio: '2026-11-09', semana: '9-15 de noviembre de 2026', partes: [],
        meioSemana: { ativo: false }, publicadaNoQuadro: false,
        fimDeSemana: { ativo: false, cancelada: true, data: '2026-11-15', horario: '10:30',
            reuniaoPublica: { temaDiscurso: 'Exemplo cancelado', oradorNomeManual: 'Orador fictício' } },
    });
    return dados;
};

// Navegar entre admin/quadro/confirmação não é recarregar a página. Compartilha
// somente a sessão DEV em memória; reload/HMR ainda podem restaurar fixtures.
let dadosDaSessao;
export const lerDadosSessaoEnsaio = () => dadosDaSessao ??= createDadosEnsaioReunioes();
export const guardarDadosSessaoEnsaio = dados => { dadosDaSessao = dados; };
