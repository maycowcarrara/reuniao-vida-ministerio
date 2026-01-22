import { useCallback, useMemo, useState } from 'react';
import { buildMailtoHref, buildWhatsappHref } from './links';

/**
 * Mantém estado em runtime do que foi "enviado" (clicado) e expõe ações de envio.
 * Observação: isso NÃO grava em histórico; é só marcação visual em tempo de execução.
 */
export const useNotificacoesRuntime = (t) => {
    const [sentMap, setSentMap] = useState({});

    const enviarZap = useCallback(
        (aluno, msg) => {
            const href = buildWhatsappHref(aluno?.telefone, msg);
            if (!href) return alert(t.alunoSemTelefone);
            window.open(href, '_blank');
        },
        [t]
    );

    const enviarEmail = useCallback(
        (aluno, assunto, msg) => {
            const href = buildMailtoHref(aluno?.email, assunto, msg);
            if (!href) return alert(t.alunoSemEmail);
            window.open(href, '_blank');
        },
        [t]
    );

    const buildMsgKey = useCallback(({ dataISO, semana, parteId, pessoaId, role }) => {
        return [dataISO || '', semana || '', parteId || '', pessoaId || '', role || ''].join('|');
    }, []);

    const markSent = useCallback((key, channel) => {
        setSentMap((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                [channel]: Date.now(),
            },
        }));
    }, []);

    const isSent = useCallback((key, channel) => Boolean(sentMap?.[key]?.[channel]), [sentMap]);

    return useMemo(
        () => ({
            sentMap,
            enviarZap,
            enviarEmail,
            buildMsgKey,
            markSent,
            isSent,
            resetSentMap: () => setSentMap({}),
        }),
        [sentMap, enviarZap, enviarEmail, buildMsgKey, markSent, isSent]
    );
};
