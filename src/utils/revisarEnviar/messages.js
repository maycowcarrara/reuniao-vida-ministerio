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
    config,
    semana,
    dataISO,
    responsavelNome,
    ajudanteNome,
    tituloParte,
    descricaoParte,
    minutosParte,
    isVisita = false,
    incluirLinkAgenda = true
}) => {
    // 2. Formatar data (adicionando aviso se for visita)
    let dataFmt = formatarDataFolha(dataISO, config?.idioma);
    if (isVisita) {
        dataFmt += ` ${t.visitDateLabel}`;
    }

    const bloco = [
        // Se for visita, coloca o destaque antes do título padrão
        isVisita ? t.visitHeaderTag : null,
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

    if (incluirLinkAgenda && linkAgenda) {
        bloco.push('');
        bloco.push(fill(t.msgAgendar, { link: linkAgenda }));
    }

    return bloco.join('\n');
};

export const montarMensagemLembreteSemana = ({
    t,
    config,
    dataISO,
    responsavelNome,
    tituloParte,
    isVisita = false,
    linkConfirmacao = ''
}) => {
    let dataFmt = formatarDataFolha(dataISO, config?.idioma);
    if (isVisita) {
        dataFmt += ` ${t.visitDateLabel}`;
    }

    const bloco = [
        fill(t.msgLembreteSemana, { nome: responsavelNome || '' }),
        fill(t.msgData, { data: dataFmt }),
        fill(t.msgParte, { titulo: tituloParte || '' }),
        t.msgLembreteObservacao,
        linkConfirmacao ? fill(t.msgConfirmar, { link: linkConfirmacao }) : null
    ].filter(Boolean);

    return bloco.join('\n\n');
};
