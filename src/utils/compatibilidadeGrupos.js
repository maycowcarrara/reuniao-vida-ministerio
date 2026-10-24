export const gruposRemotosAtivos = config => config?.versaoProgramacao === 2
    && config?.ativacaoMultiGrupos?.status === 'ativa' && config?.ativacaoMultiGrupos?.contrato === 2;

export function exigirEscritaCompativel(config, objeto = {}) {
    if (!(config?.versaoProgramacao >= 2 || objeto?.versaoProgramacao >= 2 || objeto?.grupoId)) return;
    if (gruposRemotosAtivos(config)) return;
    const es = config?.idioma === 'es';
    const error = new Error(es
        ? 'Programa v2 protegido: escritura remota aún no habilitada en este cliente. Usa Versión del Sistema para actualizar; la activación requiere revisión y autorización.'
        : 'Programação v2 protegida: escrita remota ainda não habilitada neste cliente. Use Versão do Sistema para atualizar; a ativação exige revisão e autorização.');
    error.code = 'client-update-required';
    throw error;
}
