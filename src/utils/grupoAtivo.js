export const getGrupoPreferenceKey = ownerUid => `rvm_grupo_ativo:v2:${ownerUid}`;
export const lerPreferenciaGrupo = (storage, ownerUid) => {
    if (!ownerUid) return null;
    try { return storage?.getItem(getGrupoPreferenceKey(ownerUid)) || null; } catch { return null; }
};
export const salvarPreferenciaGrupo = (storage, ownerUid, grupoId) => {
    if (!ownerUid || !grupoId) return;
    try { storage?.setItem(getGrupoPreferenceKey(ownerUid), grupoId); } catch { /* Storage é opcional. */ }
};
export const escolherGrupoAtivo = ({ grupos, grupoPrincipalId, preferencia }) => {
    const ativos = Object.values(grupos || {}).filter(grupo => grupo.ativo);
    return ativos.find(grupo => grupo.id === preferencia)?.id
        || ativos.find(grupo => grupo.id === grupoPrincipalId)?.id || ativos[0]?.id || null;
};

// Somente recortes de apresentação. Nunca persistir esta projeção como configuração geral.
export const projetarConfigGrupo = (config, grupoId) => {
    const grupo = config.grupos[grupoId];
    return { ...config, grupoSelecionadoId: grupoId, idioma: grupo.idioma, nome_cong: grupo.nome,
        dia_reuniao: grupo.meioSemana.dia, horario: grupo.meioSemana.horario,
        dia_reuniao_fds: grupo.fimDeSemana.dia, horario_fds: grupo.fimDeSemana.horario,
        eventosAnuais: grupo.eventosAnuais };
};
