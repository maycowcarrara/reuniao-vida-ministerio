// src/data/constants.js

export const CARGOS_MAP = {
    anciao: { pt: "Ancião", es: "Anciano", cor: "bg-blue-100 text-blue-700", gen: 'M' },
    servo: { pt: "Servo Ministerial", es: "Siervo Ministerial", cor: "bg-indigo-100 text-indigo-700", gen: 'M' },
    irmao_hab: { pt: "Varão Habilitado", es: "Varón Habilitado", cor: "bg-cyan-100 text-cyan-700", gen: 'M' },
    irmao: { pt: "Irmão", es: "Hermano", cor: "bg-gray-100 text-gray-700", gen: 'M' },
    irma_exp: { pt: "Irmã Experiente", es: "Hermana Experta", cor: "bg-purple-100 text-purple-700", gen: 'F' },
    irma_lim: { pt: "Irmã Limitada", es: "Hermana Limitada", cor: "bg-orange-100 text-orange-700", gen: 'F' },
    irma: { pt: "Irmã", es: "Hermana", cor: "bg-pink-100 text-pink-700", gen: 'F' },
    desab: { pt: "Desabilitado", es: "Deshabilitado", cor: "bg-gray-200 text-gray-500", gen: 'A' }
};

export const TRANSLATIONS = {
    pt: {
        importar: "Importar",
        designar: "Designar",
        alunos: "Alunos",
        revisar: "Revisar & Enviar",
        ajustes: "Ajustes",
        presidente: "Presidente",
        leitor: "Leitor",
        dirigente: "Dirigente",
        ajudante: "Ajudante",
        designado: "Designado",
        estudante: "Estudante",
        semana: "Semana",
        cliquePara: "Clique para designar",
        arquivar: "Finalizar e Arquivar",
        backup: "Banco de Dados",
        carregar: "Abrir Banco",
        salvar: "Exportar Banco",
        infoBackup:
            "Salve ou restaure todas as suas informações (Alunos, Designações e Histórico) em um arquivo JSON único.",
        registros: "registros",
        info: { nunca: "Estreia", dias: "dias" },
        ordem: { nome: "Nome", dias: "Tempo" }
    },
    es: {
        importar: "Importar",
        designar: "Asignar",
        alunos: "Estudiantes",
        revisar: "Revisar y Enviar",
        ajustes: "Ajustes",
        presidente: "Presidente",
        leitor: "Lector",
        dirigente: "Conductor",
        ajudante: "Ayudante",
        designado: "Asignado",
        estudante: "Estudiante",
        semana: "Semana",
        cliquePara: "Haz clic para asignar",
        arquivar: "Finalizar y Archivar",
        backup: "Base de Datos",
        carregar: "Abrir Base",
        salvar: "Exportar Base",
        infoBackup:
            "Guarde o restaure toda su información (Estudiantes, Asignaciones e Historial) en un solo archivo JSON.",
        registros: "registros",
        info: { nunca: "Estreno", dias: "días" },
        ordem: { nome: "Nombre", dias: "Tiempo" }
    }
};
