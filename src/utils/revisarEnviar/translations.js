// src/utils/revisarEnviar/translations.js
export const TRANSLATIONS = {
    pt: {
        btnImprimir: "IMPRIMIR AGORA",
        abaVisualizar: "Visualizar Folhas",
        abaNotificar: "Notificar",
        labelInicio: "Começar na semana:",
        labelLayout: "Folha com:",
        layoutOpcoes: [
            "1 Semana (Grande)",
            "2 Semanas (Médio)",
            "4 Semanas (Lista)",
            "5 Semanas (Lista compacta)",
        ],
        labelSemanas: "Semanas:",
        filtroAtivas: "Ativas",
        filtroArquivadas: "Arquivadas",
        filtroTodas: "Todas",
        selecionadas: "selecionada(s)",
        btnTodas: "Todas",
        btnLimpar: "Limpar",
        titleSelecionarTodas: "Selecionar todas",
        titleLimparSelecao: "Limpar seleção",
        badgeArquivada: "Arquivada",
        nenhumaSemanaFiltro: "Nenhuma semana para este filtro.",

        presidente: "Presidente",
        leitor: "Leitor",
        ajudante: "Ajudante",
        dirigente: "Dirigente",
        oracao: "Oração",

        secoes: {
            tesouros: "TESOUROS DA PALAVRA DE DEUS",
            ministerio: "FAÇA SEU MELHOR NO MINISTÉRIO",
            vida: "NOSSA VIDA CRISTÃ",
        },

        notificarTitulo: "Notificações Pendentes",
        notificarAviso: "As mensagens abaixo serão enviadas individualmente via WhatsApp ou E-mail.",
        btnEnviar: "Enviar WhatsApp",
        btnEnviarAjudante: "Enviar ao ajudante",
        btnEnviarEmail: "Enviar E-mail",
        alunoSemTelefone: "Aluno sem telefone!",
        alunoSemEmail: "Aluno sem e-mail!",

        // Mensagens (modelo novo)
        msgSaudacaoResp: "Olá *{nome}*, sua parte na reunião de *{semana}* é: *{titulo}*.",
        msgSaudacaoAjud: "Olá *{nome}*, você será *Ajudante* na reunião de *{semana}* na parte: *{titulo}*.",
        msgTituloPadrao: "*DESIGNAÇÃO PARA A REUNIÃO NOSSA VIDA E MINISTÉRIO CRISTÃO*",
        msgData: "*Data:* {data}",
        msgResponsavel: "*Responsável:* {nome}",
        msgAjudante: "*Ajudante:* {nome}",
        msgParte: "*Parte:* _{titulo}_",
        msgParteComMin: "*Parte:* _{titulo} ({min} min)_",
        msgDetalhes: "_{descricao}_",
        msgObservacao:
            "_*Observação:* Veja as instruções para a parte que estão nas Instruções para a Reunião Nossa Vida e Ministério Cristão S-38 (jw.org/finder?wtlocale=T&docid=1201038)._",
        msgAgendar: "_> Agendar:_ {link}",

        // Gravar histórico
        btnGravarHistorico: "GRAVAR HISTÓRICO",
        confirmarGravar:
            "Confirma gravar no histórico dos alunos as designações das semanas selecionadas?\n\n(A ação evita duplicar lançamentos.)",
        erroSemCallback: "Não foi possível gravar: falta onAlunosChange no RevisarEnviar.",
        okGravou: "Histórico gravado com sucesso!",
        nadaParaGravar: "Nenhuma designação encontrada para gravar.",
    },

    es: {
        btnImprimir: "IMPRIMIR AHORA",
        abaVisualizar: "Vista Previa",
        abaNotificar: "Enviar Mensajes",
        labelInicio: "Empezar en la semana:",
        labelLayout: "Hojas con:",
        layoutOpcoes: [
            "1 Semana (Grande)",
            "2 Semanas (Medio)",
            "4 Semanas (Lista)",
            "5 Semanas (Lista compacta)",
        ],
        labelSemanas: "Semanas:",
        filtroAtivas: "Activas",
        filtroArquivadas: "Archivadas",
        filtroTodas: "Todas",
        selecionadas: "seleccionada(s)",
        btnTodas: "Todas",
        btnLimpar: "Limpiar",
        titleSelecionarTodas: "Seleccionar todas",
        titleLimparSelecao: "Limpiar selección",
        badgeArquivada: "Archivada",
        nenhumaSemanaFiltro: "No hay semanas para este filtro.",

        presidente: "Presidente",
        leitor: "Lector",
        ajudante: "Ayudante",
        dirigente: "Conductor",
        oracao: "Oración",

        secoes: {
            tesouros: "TESOROS DE LA BIBLIA",
            ministerio: "SEAMOS MEJORES MAESTROS",
            vida: "NUESTRA VIDA CRISTIANA",
        },

        notificarTitulo: "Notificaciones Pendientes",
        notificarAviso: "Los siguientes mensajes se enviarán individualmente por WhatsApp o E-mail.",
        btnEnviar: "Enviar WhatsApp",
        btnEnviarAjudante: "Enviar al ayudante",
        btnEnviarEmail: "Enviar E-mail",
        alunoSemTelefone: "¡Estudiante sin teléfono!",
        alunoSemEmail: "¡Estudiante sin e-mail!",

        // Mensajes (modelo nuevo)
        msgSaudacaoResp: "Hola *{nome}*, tu asignación en la reunión de *{semana}* es: *{titulo}*.",
        msgSaudacaoAjud: "Hola *{nome}*, serás *Ayudante* en la reunión de *{semana}* en la parte: *{titulo}*.",
        msgTituloPadrao: "*ASIGNACIÓN PARA LA REUNIÓN NUESTRA VIDA Y MINISTERIO CRISTIANO*",
        msgData: "*Fecha:* {data}",
        msgResponsavel: "*Responsable:* {nome}",
        msgAjudante: "*Ayudante:* {nome}",
        msgParte: "*Parte:* _{titulo}_",
        msgParteComMin: "*Parte:* _{titulo} ({min} min)_",
        msgDetalhes: "_{descricao}_",
        msgObservacao:
            "_*Observación:* Consulta las instrucciones en Instrucciones para la Reunión Nuestra Vida y Ministerio Cristiano S-38 (jw.org/finder?wtlocale=T&docid=1201038)._",
        msgAgendar: "_> Agendar:_ {link}",

        // Guardar historial
        btnGravarHistorico: "GUARDAR HISTORIAL",
        confirmarGravar:
            "¿Confirmas guardar en el historial de los estudiantes las asignaciones de las semanas seleccionadas?\n\n(La acción evita duplicados.)",
        erroSemCallback: "No se pudo guardar: falta onAlunosChange en RevisarEnviar.",
        okGravou: "¡Historial guardado con éxito!",
        nadaParaGravar: "No hay asignaciones para guardar.",
    },
};

export const normalizarIdioma = (v) => {
    const s = (v ?? "").toString().trim().toLowerCase();
    if (s.startsWith("es")) return "es";
    if (s.startsWith("pt")) return "pt";
    return "pt";
};

export const getI18n = (config) => {
    const lang = normalizarIdioma(config?.idioma);
    const t = TRANSLATIONS[lang] || TRANSLATIONS.pt;
    return { lang, t };
};
