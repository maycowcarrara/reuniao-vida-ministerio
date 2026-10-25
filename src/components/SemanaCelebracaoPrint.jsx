import React from 'react';
import { CelebracaoResumo } from './Celebracao.jsx';
import { normalizeOcorrenciaReuniao, TIPOS_REUNIAO } from '../utils/ocorrenciasReuniao.js';
import { MEIO_SEMANA_RESPONSABILIDADES } from '../utils/fimDeSemana.js';

export default function SemanaCelebracaoPrint({ programa, config, lang }) {
    const es = lang === 'es';
    const nomes = (...pessoas) => [...new Set(pessoas.filter(Boolean).map(p => p.nome).filter(Boolean))].join(' / ');
    return <article className="print-block p-3 space-y-3 text-sm" data-semana-celebracao="true">
        <h2 className="text-center text-lg font-bold">{config.nome_cong} — {programa.semana}</h2>
        {TIPOS_REUNIAO.map(tipo => {
            const r = normalizeOcorrenciaReuniao(programa, tipo, config);
            if (!r.operacional) return null;
            if (r.celebracao) return <CelebracaoResumo key={tipo} programa={programa} config={config} lang={lang} />;
            const fds = programa.fimDeSemana || {};
            const apoios = tipo === 'fimDeSemana' ? fds.responsabilidades : programa.responsabilidades;
            const linha = (titulo, valor, key = titulo) => <p key={key} className="border-b border-slate-100 py-1"><strong>{titulo}: </strong>{valor || '—'}</p>;
            return <section key={tipo} className="rounded-xl border p-3 space-y-1 break-inside-avoid">
                <h3 className="font-bold">{tipo === 'meioSemana' ? (es ? 'Reunión de entre semana' : 'Reunião de meio de semana') : (es ? 'Reunión de fin de semana' : 'Reunião de fim de semana')}</h3>
                <p>{r.data} • {r.horario}</p>
                {linha(es ? 'Presidente' : 'Presidente', nomes(tipo === 'meioSemana' ? programa.presidente : fds.presidente))}
                {tipo === 'meioSemana' ? (programa.partes || []).map((p, i) => linha([p.tempo && `${p.tempo} min`, p.titulo].filter(Boolean).join(' — '), nomes(p.estudante, p.dirigente, p.ajudante, p.leitor, p.oracao), p.id || i)) : <>
                    {linha(es ? 'Discurso público' : 'Discurso público', [fds.reuniaoPublica?.temaDiscurso, fds.reuniaoPublica?.oradorNomeManual, fds.reuniaoPublica?.congregacaoOrador].filter(Boolean).join(' — '))}
                    {linha(es ? 'Estudio de La Atalaya' : 'Estudo de A Sentinela', nomes(fds.estudoSentinela?.dirigente, fds.estudoSentinela?.leitor))}
                    {linha(es ? 'Oración final' : 'Oração final', nomes(fds.oracaoFinal))}
                </>}
                {MEIO_SEMANA_RESPONSABILIDADES.map(({ storageKey, labels }) => linha(labels[lang] || labels.pt, nomes(...(apoios?.[storageKey] || []))))}
            </section>;
        })}
    </article>;
}
