// src/utils/revisarEnviar/messages.js
import { formatarDataFolha } from './dates';
import { buildAgendaLink } from './links';

export const fill = (str, vars) => {
    let out = str;
    Object.keys(vars || {}).forEach((k) => {
        out = out.replaceAll(`{${k}}`, (vars[k] ?? '').toString());
    });
    return out;
};

export const montarMensagemDesignacao = ({
    t,
    lang,
    config,
    semana,
    dataISO,
    responsavelNome,
    ajudanteNome,
    tituloParte,
    descricaoParte,
    minutosParte,
    isVisita = false 
}) => {
    // 1. Textos de Visita baseados no idioma
    const textoVisitaData = lang === 'es' ? "(Visita del SC - Martes)" : "(Visita do SC - Terça-feira)";
    const tagVisitaTitulo = lang === 'es' ? "✨ [VISITA DEL SUPERINTENDENTE] ✨" : "✨ [VISITA DO SUPERINTENDENTE] ✨";

    // 2. Formatar data (adicionando aviso se for visita)
    let dataFmt = formatarDataFolha(dataISO, lang);
    if (isVisita) {
        dataFmt += ` ${textoVisitaData}`;
    }

    const bloco = [
        // Se for visita, coloca o destaque antes do título padrão
        isVisita ? tagVisitaTitulo : null,
        isVisita ? '' : null,
        
        t.msgTituloPadrao,
        '',
        fill(t.msgData, { data: dataFmt }),
        '',
        fill(t.msgResponsavel, { nome: responsavelNome || '' }),
        ajudanteNome ? fill(t.msgAjudante, { nome: ajudanteNome }) : null,
        '',
        minutosParte
            ? fill(t.msgParteComMin, { titulo: tituloParte, min: minutosParte })
            : fill(t.msgParte, { titulo: tituloParte }),
        descricaoParte ? fill(t.msgDetalhes, { descricao: descricaoParte }) : null,
        '',
        t.msgObservacao,
    ].filter(Boolean);

    const linkAgenda = buildAgendaLink({
        config,
        semana,
        dataISO,
        tituloParte,
        responsavelNome: responsavelNome || '',
        ajudanteNome: ajudanteNome || '',
    });

    if (linkAgenda) {
        bloco.push('');
        bloco.push(fill(t.msgAgendar, { link: linkAgenda }));
    }

    return bloco.join('\n');
};