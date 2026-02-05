export const TRANSLATIONS = {
    pt: {
        revisar: 'Revisar Importação',
        confirmar: 'Confirmar',
        cancelar: 'Cancelar',
        voltar: 'Voltar',
        tituloSemana: 'Título da Semana (Data + Leitura)',
        addLinha: 'Adicionar Linha Manualmente',
        novaProg: 'Nova Programação',
        instrucao: 'Importe a programação da Apostila (JW.ORG)',

        metodoCatalogo: 'Escolher',
        metodoTexto: 'Texto',
        metodoLink: 'Link',
        processar: 'Processar Apostila',

        msgErro: 'Erro ao acessar o link. Verifique a URL.',
        erroVazio: 'Cole um texto ou informe um link.',
        erroUrl: 'Use um link válido do jw.org (https://www.jw.org/...).',
        erroConteudo: 'Não foi possível reconhecer a programação nesse conteúdo. Tente colar mais texto (ou use o link).',
        colar: 'Colar',
        limpar: 'Limpar',

        dicasTitulo: 'Como importar',
        dicasTexto: [
            'Preferencial: use “Escolher” para selecionar uma apostila e uma semana.',
            'Alternativa: use “Link” e cole a URL da semana no jw.org.',
            'Se precisar: use “Texto” e cole o texto do JW Library, o texto da página, ou o HTML (view source).',
            'Se algo vier errado, revise abaixo e ajuste manualmente.',
        ],
        exemplo: 'Ex.: https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/…',
        rotulos: {
            titulo: 'Título da Parte',
            tempo: 'Minutos',
            secao: 'Seção',
            detalhes: 'Detalhes / Matéria',
        },

        dicaRevisao: 'Dica: todos os campos abaixo são editáveis. Clique para ajustar título, minutos, seção e detalhes.',
        secaoTesouros: 'TESOUROS',
        secaoMinisterio: 'MINISTÉRIO',
        secaoVida: 'VIDA',
        secaoNA: 'N/A',

        placeholderTexto: 'Cole aqui o texto (ou HTML) da página da apostila…',
        placeholderLink: 'Cole aqui o link do jw.org…',
        placeholderDetalhes: 'Ex.: matéria, vídeo, perguntas, etc.',

        // Catálogo
        catalogTitulo: 'Apostilas (JW.org)',
        catalogSub: 'Escolha uma apostila e depois selecione uma semana para importar.',
        catalogAtualizar: 'Atualizar lista',
        catalogCarregando: 'Carregando apostilas…',
        catalogErro: 'Não foi possível carregar a lista automática. Use Link/Texto como alternativa.',
        catalogBuscar: 'Buscar apostila…',
        catalogSemResultados: 'Nenhuma apostila encontrada.',
        semanasTitulo: 'Semanas desta apostila',
        semanasSub: 'Selecione uma semana para importar.',
        semanasCarregando: 'Carregando semanas…',
        semanasErro: 'Não foi possível carregar as semanas dessa apostila.',
        semanasVazio: 'Não encontrei as semanas nessa apostila.',
        abrirNoJw: 'Abrir no JW.org',
        importarSemana: 'Importar',

        // Total tempo
        totalTempoLabel: 'Tempo total',
        totalTempoEsperado: 'Esperado',
        totalTempoAviso: 'A soma das partes deve ficar entre 1:40 e 1:45. Ajuste os minutos para bater com o total.',

        // Transparência do total
        totalTempoSomaPartes: 'Soma das partes (sem conselhos)',
        totalTempoDetalhes: 'Conselhos somados no total:',
        totalTempoLeituraBiblia: '+1 min: conselhos na Leitura da Bíblia (parte 3).',
        totalTempoMinisterioTpl: 'Ministério: +{n} min (1 por parte).',
    },
    es: {
        revisar: 'Revisar Importación',
        confirmar: 'Confirmar',
        cancelar: 'Cancelar',
        voltar: 'Volver',
        tituloSemana: 'Título de la Semana (Fecha + Lectura)',
        addLinha: 'Añadir Línea Manualmente',
        novaProg: 'Nueva Programación',
        instrucao: 'Importe el programa de la Guía (JW.ORG)',

        metodoCatalogo: 'Elegir',
        metodoTexto: 'Texto',
        metodoLink: 'Enlace',
        processar: 'Procesar Guía',

        msgErro: 'Error al acceder al enlace. Verifique la URL.',
        erroVazio: 'Pegue un texto o informe un enlace.',
        erroUrl: 'Use un enlace válido de jw.org (https://www.jw.org/...).',
        erroConteudo: 'No se pudo reconocer el programa en este contenido. Intenta pegar más texto (o usa el enlace).',
        colar: 'Pegar',
        limpar: 'Limpiar',

        dicasTitulo: 'Cómo importar',
        dicasTexto: [
            'Preferible: usa “Elegir” para seleccionar una guía y una semana.',
            'Alternativa: usa “Enlace” y pega la URL de la semana en jw.org.',
            'Si lo necesitas: usa “Texto” y pega el texto de JW Library, el texto de la página o el HTML (view source).',
            'Si algo sale mal, revisa abajo y ajusta manualmente.',
        ],
        exemplo: 'Ej.: https://www.jw.org/es/biblioteca/guia-actividades-reunion-testigos-jehova/…',
        rotulos: {
            titulo: 'Título de la Parte',
            tempo: 'Minutos',
            secao: 'Sección',
            detalhes: 'Detalles / Materia',
        },

        dicaRevisao: 'Consejo: todos los campos abajo son editables. Haz clic para ajustar título, minutos, sección y detalles.',
        secaoTesouros: 'TESOROS',
        secaoMinisterio: 'MINISTERIO',
        secaoVida: 'VIDA',
        secaoNA: 'N/A',

        placeholderTexto: 'Pega aquí el texto (o HTML) de la guía…',
        placeholderLink: 'Pega aquí el enlace de jw.org…',
        placeholderDetalhes: 'Ej.: materia, video, preguntas, etc.',

        // Catálogo
        catalogTitulo: 'Guías (JW.org)',
        catalogSub: 'Elige una guía y luego selecciona una semana para importar.',
        catalogAtualizar: 'Actualizar lista',
        catalogCarregando: 'Cargando guías…',
        catalogErro: 'No se pudo cargar la lista automática. Usa Enlace/Texto como alternativa.',
        catalogBuscar: 'Buscar guía…',
        catalogSemResultados: 'No se encontró ninguna guía.',
        semanasTitulo: 'Semanas de esta guía',
        semanasSub: 'Selecciona una semana para importar.',
        semanasCarregando: 'Cargando semanas…',
        semanasErro: 'No se pudo cargar las semanas de esta guía.',
        semanasVazio: 'No encontré semanas en esta guía.',
        abrirNoJw: 'Abrir en JW.org',
        importarSemana: 'Importar',

        // Total tempo
        totalTempoLabel: 'Tiempo total',
        totalTempoEsperado: 'Esperado',
        totalTempoAviso: 'La suma de las partes debe quedar entre 1:40 y 1:45. Ajusta los minutos para que coincida con el total.',

        // Transparencia del total
        totalTempoSomaPartes: 'Suma de las partes (sin consejos)',
        totalTempoDetalhes: 'Consejos incluidos en el total:',
        totalTempoLeituraBiblia: '+1 min: consejos en la Lectura de la Biblia (parte 3).',
        totalTempoMinisterioTpl: 'Ministerio: +{n} min (1 por parte).',
    },
};

export const SECAO_UI = {
    tesouros: {
        chip: 'bg-slate-100 text-slate-900 border-slate-200',
        wrap: 'border-slate-200 bg-slate-50/60',
        left: 'border-l-slate-500',
        focus: 'focus:ring-slate-200 focus:border-slate-300',
    },
    ministerio: {
        chip: 'bg-amber-100 text-amber-900 border-amber-200',
        wrap: 'border-amber-200 bg-amber-50/40',
        left: 'border-l-amber-400',
        focus: 'focus:ring-amber-200 focus:border-amber-300',
    },
    vida: {
        chip: 'bg-rose-100 text-rose-900 border-rose-200',
        wrap: 'border-rose-200 bg-rose-50/40',
        left: 'border-l-rose-400',
        focus: 'focus:ring-rose-200 focus:border-rose-300',
    },
    na: {
        chip: 'bg-gray-100 text-gray-700 border-gray-200',
        wrap: 'border-gray-200 bg-gray-50/70',
        left: 'border-l-gray-300',
        focus: 'focus:ring-gray-200 focus:border-gray-300',
    },
};