export const CARGOS_MAP_FALLBACK = {
    anciao: { pt: "Ancião", es: "Anciano", cor: "bg-blue-100 text-blue-700 border-blue-200", gen: 'M' },
    servo: { pt: "Servo Ministerial", es: "Siervo Ministerial", cor: "bg-indigo-100 text-indigo-700 border-indigo-200", gen: 'M' },
    irmao_hab: { pt: "Varão Habilitado", es: "Varón Habilitado", cor: "bg-cyan-100 text-cyan-700 border-cyan-200", gen: 'M' },
    irmao: { pt: "Irmão", es: "Hermano", cor: "bg-gray-100 text-gray-700 border-gray-200", gen: 'M' },
    irma_exp: { pt: "Irmã Experiente", es: "Hermana Experta", cor: "bg-purple-100 text-purple-700 border-purple-200", gen: 'F' },
    irma_lim: { pt: "Irmã Limitada", es: "Hermana Limitada", cor: "bg-orange-100 text-orange-700 border-orange-200", gen: 'F' },
    irma: { pt: "Irmã", es: "Hermana", cor: "bg-pink-100 text-pink-700 border-pink-200", gen: 'F' },
    desab: { pt: "Desabilitado", es: "Deshabilitado", cor: "bg-gray-200 text-gray-500 border-gray-300", gen: 'A' }
};

export const TRANSLATIONS = {
    pt: {
        titulo: "Lista de Alunos", buscaPlaceholder: "Buscar aluno ou observação...", novo: "Novo Aluno", registros: "registros", exportar: "Exportar",
        visualizacao: { grade: "Grade", lista: "Lista" }, ordem: { nome: "Ordem Alfabética", dias: "Mais tempo sem parte" },
        limparFiltros: "Limpar Filtros",
        estatisticas: { total: "Total Ativos", irmaos: "Irmãos", irmas: "Irmãs", ausentes: "Ausentes Hoje", atrasados: "+60 Dias s/ Parte" },
        campos: { 
            nome: "Nome do Aluno", tipo: "Privilégio / Tipo", tel: "WhatsApp", mail: "E-mail", obs: "Observações", 
            datasIndisponiveis: "Datas Indisponíveis (Férias/Viagem)", dataInicio: "Data de Início", dataFim: "Data de Fim", 
            motivo: "Motivo", motivoPlaceholder: "Ex: Viagem, Trabalho...", semDatas: "Nenhuma data de ausência registrada.",
            foto: "Foto do Aluno", fotoInstrucao: "Clique em qualquer lugar desta tela e pressione {TECLA} para colar uma imagem.",
            removerFoto: "Remover foto"
        },
        card: { nunca: "Estreia", diasAtras: "dias atrás", com: "Com", semObs: "Sem observações", ausente: "Ausência Programada", indisponivel: "Indisponível:" },
        modal: { editar: "Editar Aluno", novo: "Novo Cadastro", salvar: "Salvar", cancelar: "Cancelar", historico: "Histórico Completo", excluir: "Excluir" }, 
        filtros: { todos: "Todos", ativos: "Somente Ativos" },
        msg: { confirmarExclusao: "Tem certeza que deseja excluir este aluno permanentemente?", erroSoDesabilitados: "Apenas alunos marcados como 'Desabilitado' podem ser excluídos." }
    },
    es: {
        titulo: "Lista de Estudiantes", buscaPlaceholder: "Buscar estudiante u observación...", novo: "Nuevo Alumno", registros: "registros", exportar: "Exportar",
        visualizacao: { grade: "Cuadrícula", lista: "Lista" }, ordem: { nome: "Orden Alfabético", dias: "Más tiempo sin parte" },
        limparFiltros: "Limpiar Filtros",
        estatisticas: { total: "Total Activos", irmaos: "Hermanos", irmas: "Hermanas", ausentes: "Ausentes Hoy", atrasados: "+60 Días s/ Parte" },
        campos: { 
            nome: "Nombre del Estudiante", tipo: "Privilegio / Tipo", tel: "WhatsApp", mail: "E-mail", obs: "Observaciones", 
            datasIndisponiveis: "Fechas No Disponibles (Vacaciones/Viaje)", dataInicio: "Fecha de Inicio", dataFim: "Fecha de Fin", 
            motivo: "Motivo", motivoPlaceholder: "Ej: Viaje, Trabajo...", semDatas: "Sin fechas de ausencia registradas.",
            foto: "Foto del Estudiante", fotoInstrucao: "Haga clic en cualquier lugar de esta pantalla y presione {TECLA} para pegar una imagen.",
            removerFoto: "Eliminar foto"
        },
        card: { nunca: "Estreno", diasAtras: "días atrás", com: "Con", semObs: "Sin observaciones", ausente: "Ausencia Programada", indisponivel: "No disponible:" },
        modal: { editar: "Editar Estudiante", novo: "Nuevo Registro", salvar: "Guardar", cancelar: "Cancelar", historico: "Historial Completo", excluir: "Eliminar" }, 
        filtros: { todos: "Todos", activos: "Solo Activos" },
        msg: { confirmarExclusao: "¿Está seguro de que desea eliminar a este estudiante permanentemente?", erroSoDesabilitados: "Solo los estudiantes marcados como 'Deshabilitado' pueden ser eliminados." }
    }
};

export const WHATSAPP_DEFAULT_TEXT = "Olá, {NOME}! Tudo bem?";

export const normalizarIdioma = (idioma) => {
    const v = (idioma || '').toString().trim().toLowerCase();
    if (v.startsWith('pt')) return 'pt';
    if (v.startsWith('es')) return 'es';
    return 'pt';
};

export const normalizar = (texto) => texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

export const getCargoKey = (tipoStr, CARGOS_MAP) => {
    if (CARGOS_MAP[tipoStr]) return tipoStr;
    return Object.keys(CARGOS_MAP).find(k => CARGOS_MAP[k].pt === tipoStr || CARGOS_MAP[k].es === tipoStr) || 'irmao';
};

export const getUltimoRegistro = (aluno) => {
    const hist = Array.isArray(aluno?.historico) ? aluno.historico : [];
    if (hist.length === 0) return { data: null, parte: null, ajudante: null };

    const ordenado = [...hist].sort((a, b) => {
        const da = a?.data ? new Date(a.data).getTime() : 0;
        const db = b?.data ? new Date(b.data).getTime() : 0;
        return db - da; 
    });
    const last = ordenado[0] || {};
    return { data: last.data || null, parte: (last.parte || null)?.replace(/\s*\(com\s+.*\)/i, ""), ajudante: last.ajudante || null };
};

export const calcularDias = (dataISO) => {
    if (!dataISO) return null;
    const d = new Date(dataISO);
    const hoje = new Date();
    return Math.floor((hoje - d) / 86400000);
};

export const verificarAusenciaAtiva = (aluno) => {
    if (!aluno.datasIndisponiveis || !Array.isArray(aluno.datasIndisponiveis) || aluno.datasIndisponiveis.length === 0) return false;
    const hojeISO = new Date().toISOString().split('T')[0];
    return aluno.datasIndisponiveis.some(d => d.inicio <= hojeISO && d.fim >= hojeISO);
};

export const buildWhatsappHref = (telefone, nome) => {
    const raw = (telefone || '').toString();
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const waNumber = (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
    const msg = encodeURIComponent(WHATSAPP_DEFAULT_TEXT.replace('{NOME}', (nome || '').toString().trim()));
    return `https://wa.me/${waNumber}?text=${msg}`;
};

export const getIniciais = (nome) => {
    if (!nome) return '';
    const ignorar = ['de', 'da', 'do', 'dos', 'das'];
    const partes = nome.trim().split(' ').filter(p => p.length > 0 && !ignorar.includes(p.toLowerCase()));
    if (partes.length === 0) return '';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    const primeira = partes[0].charAt(0).toUpperCase();
    const ultima = partes[partes.length - 1].charAt(0).toUpperCase();
    return `${primeira}${ultima}`;
};