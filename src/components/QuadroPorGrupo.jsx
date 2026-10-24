import React from 'react';
import { I18nProvider } from '../i18n';
import { normalizeGruposProgramacao } from '../utils/gruposProgramacao.js';
import { gruposPublicadosDisponiveis } from '../utils/quadroPublico.js';
import { selecionarProgramacoesGrupo } from '../utils/programacoesPorGrupo.js';
import { projetarConfigGrupo } from '../utils/grupoAtivo.js';
import { useGrupoAtivo } from '../hooks/useGrupoAtivo.js';
import SeletorGrupo from './SeletorGrupo.jsx';
import QuadroPublico from './QuadroPublico.jsx';

export default function QuadroPorGrupo({ dados, usuario }) {
    const config = normalizeGruposProgramacao(dados.configuracoes);
    const programas = dados.historico_reunioes || [];
    const grupos = gruposPublicadosDisponiveis(programas, config);
    const { grupoId, selecionarGrupo } = useGrupoAtivo({ ownerUid: dados.ownerUid, config: { ...config, grupos } });
    const foco = grupoId ? projetarConfigGrupo(config, grupoId) : config;
    return <I18nProvider lang={foco.idioma}>
        <QuadroPublico key={grupoId || 'vazio'} usuario={usuario} config={foco}
            seletorGrupo={Object.keys(grupos).length > 1 ? <SeletorGrupo grupos={grupos} grupoId={grupoId} onChange={selecionarGrupo} /> : null}
            programacoes={grupoId ? selecionarProgramacoesGrupo(programas, grupoId, config) : []} />
    </I18nProvider>;
}
