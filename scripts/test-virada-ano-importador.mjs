import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    extractWeekRangeText,
    isExactWeekHeading,
    isWeekTitle,
} from '../src/utils/importador/helpers.js';
import { extrairDados } from '../src/utils/importador/parser.js';
import {
    getCanonicalMeetingDateISO,
    getCanonicalWeekStartISO,
    getMeetingDateISOFromSemana,
    getSemanaSortTimestamp,
    getWeekStartISOFromSemana,
    parseSemanaRange,
} from '../src/utils/revisarEnviar/dates.js';
import { getEventoEspecialPorSemana } from '../src/utils/eventos.js';
import { normalizeGruposProgramacao } from '../src/utils/gruposProgramacao.js';
import { prepararImportacaoSemanal } from '../src/utils/agendamentoReunioes.js';
import { aplicarOperacoesProgramacao } from '../src/utils/programacoesPorGrupo.js';

const cfgPt = { dia_reuniao: 'quinta-feira', dia_reuniao_fds: 'domingo' };

test('importador reconhece titulos de semana PT e ES que cruzam mes e ano', () => {
    const validTitles = [
        '2-8 de novembro',
        '30 de novembro–6 de dezembro',
        '26 de outubro–1.º de novembro',
        '28 de dezembro de 2026–3 de janeiro de 2027',
        '28 de dezembro–3 de janeiro de 2027',
        '2-8 de noviembre',
        '30 de noviembre a 6 de diciembre',
        '28 de diciembre de 2026 a 3 de enero de 2027',
        '1.º-7 de março',
    ];
    for (const title of validTitles) {
        assert.equal(isWeekTitle(title), true, `isWeekTitle deveria aceitar: ${title}`);
        assert.equal(isExactWeekHeading(title), true, `isExactWeekHeading deveria aceitar: ${title}`);
    }

    for (const invalid of [
        'Novembro–dezembro de 2026',
        'Noviembre y diciembre de 2026',
        '<img src="https://example.com/a.jpg" alt="1. Foto"/>',
        'Programação da Reunião',
    ]) {
        assert.equal(isWeekTitle(invalid), false, `isWeekTitle deveria rejeitar: ${invalid}`);
    }

    assert.equal(
        extractWeekRangeText('Programação da Reunião Vida e Ministério 28\u00a0de dezembro–3 de Janeiro de 2027'),
        '28 de dezembro–3 de Janeiro de 2027'
    );
    assert.equal(
        extractWeekRangeText('Vida y Ministerio Cristianos: 28 de diciembre de 2026 a 3 de enero de 2027'),
        '28 de diciembre de 2026 a 3 de enero de 2027'
    );
});

test('dates.js interpreta semana que cruza ano sem confundir final do ano com dia', () => {
    const ptRange = parseSemanaRange('28 de dezembro de 2026–3 de janeiro de 2027 - EZEQUIEL 9-10');
    assert.deepEqual(ptRange, {
        startDay: 28,
        startMonthName: 'dezembro',
        startYear: 2026,
        endDay: 3,
        endMonthName: 'janeiro',
        endYear: 2027,
    });

    const esRange = parseSemanaRange('28 de diciembre de 2026 a 3 de enero de 2027 - EZEQUIEL 9, 10');
    assert.deepEqual(esRange, {
        startDay: 28,
        startMonthName: 'diciembre',
        startYear: 2026,
        endDay: 3,
        endMonthName: 'enero',
        endYear: 2027,
    });

    for (const label of [
        '28 de dezembro de 2026–3 de janeiro de 2027',
        '28 de dezembro de 2026–3 de janeiro de 2027 - EZEQUIEL 9-10',
        '28 de diciembre de 2026 a 3 de enero de 2027',
        '28 de dezembro–3 de janeiro de 2027',
    ]) {
        assert.equal(getWeekStartISOFromSemana({ semanaStr: label, config: cfgPt, textSources: [label] }), '2026-12-28');
        assert.equal(getMeetingDateISOFromSemana({ semanaStr: label, config: cfgPt, textSources: [label] }), '2026-12-31');
        assert.equal(
            getMeetingDateISOFromSemana({ semanaStr: label, config: { dia_reuniao: 'sexta-feira' }, textSources: [label] }),
            '2027-01-01'
        );
        assert.equal(
            getMeetingDateISOFromSemana({ semanaStr: label, config: cfgPt, overrideDia: 'domingo', textSources: [label] }),
            '2027-01-03'
        );
    }

    // Sem anos explícitos no texto, mas com isoFallback caindo em janeiro (sexta/domingo) ou dezembro
    assert.equal(
        getWeekStartISOFromSemana({ semanaStr: '28 de dezembro–3 de janeiro', isoFallback: '2027-01-01' }),
        '2026-12-28'
    );
    assert.equal(
        getWeekStartISOFromSemana({ semanaStr: '28 de dezembro–3 de janeiro', isoFallback: '2027-01-03' }),
        '2026-12-28'
    );
    assert.equal(
        getMeetingDateISOFromSemana({ semanaStr: '28 de dezembro–3 de janeiro', config: { dia_reuniao: 'sexta-feira' }, isoFallback: '2027-01-01' }),
        '2027-01-01'
    );
});

test('datas canonicas e ordenacao preservam ano salvo ao cruzar 2026 -> 2027', () => {
    const semDez21 = { semana: '21-27 de dezembro - EZEQUIEL 7-8', dataInicio: '2026-12-21' };
    const semVirada = { semana: '28 de dezembro de 2026–3 de janeiro de 2027 - EZEQUIEL 9-10', dataInicio: '2026-12-28' };
    const semJan04 = { semana: '4-10 de janeiro - EZEQUIEL 11-12', dataInicio: '2027-01-04' };

    assert.equal(getCanonicalWeekStartISO({ sem: semJan04, config: cfgPt }), '2027-01-04');
    assert.equal(getCanonicalMeetingDateISO({ sem: semJan04, config: cfgPt }), '2027-01-07');
    assert.equal(getCanonicalMeetingDateISO({ sem: semJan04, config: cfgPt, overrideDia: 'domingo' }), '2027-01-10');

    assert.equal(getCanonicalWeekStartISO({ sem: semVirada, config: cfgPt }), '2026-12-28');
    assert.equal(getCanonicalMeetingDateISO({ sem: semVirada, config: cfgPt }), '2026-12-31');
    assert.equal(getCanonicalMeetingDateISO({ sem: semVirada, config: cfgPt, overrideDia: 'domingo' }), '2027-01-03');

    const sorted = [semJan04, semVirada, semDez21]
        .sort((a, b) => getSemanaSortTimestamp(a, cfgPt) - getSemanaSortTimestamp(b, cfgPt))
        .map((s) => s.dataInicio);
    assert.deepEqual(sorted, ['2026-12-21', '2026-12-28', '2027-01-04']);
});

test('parser extrai corretamente HTML e texto para virada de ano PT/ES e semanas de 2027', async () => {
    const htmlPt = `<!doctype html><html><head>
        <meta property="og:title" content="Programação da Reunião Vida e Ministério 28\u00a0de dezembro–3 de Janeiro de 2027">
        <link rel="canonical" href="https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/novembro-dezembro-2026-mwb/Programa%C3%A7%C3%A3o-da-Reuni%C3%A3o-Vida-e-Minist%C3%A9rio-para-28-de-dezembro-de-2026-3-de-janeiro-de-2027/">
    </head><body><article><header>
        <h1>28 de dezembro de 2026–3 de janeiro de 2027</h1>
        <h2>EZEQUIEL 9-10</h2>
    </header><main>
        <p>Cântico 1 e oração</p>
        <p>Comentários iniciais (1 min)</p>
        <h2>TESOUROS DA PALAVRA DE DEUS</h2>
        <h3>1. Discurso teste (10 min)</h3>
        <h2>FAÇA SEU MELHOR NO MINISTÉRIO</h2>
        <h3>4. Iniciando conversas (3 min)</h3>
        <h2>NOSSA VIDA CRISTÃ</h2>
        <p>Cântico 2</p>
        <h3>7. Estudo bíblico de congregação (30 min)</h3>
        <p>Comentários finais (3 min)</p>
        <p>Cântico 3 e oração</p>
    </main></article></body></html>`;

    const parsedPt = await extrairDados(htmlPt, 'html', 'pt');
    assert.equal(parsedPt.semana, '28 de dezembro de 2026–3 de janeiro de 2027 - EZEQUIEL 9-10');
    assert.equal(parsedPt.dataInicio, '2026-12-28');

    const textoPt = [
        '28 de dezembro de 2026–3 de janeiro de 2027',
        'EZEQUIEL 9-10',
        'Cântico 1 e oração',
        'Comentários iniciais (1 min)',
        'TESOUROS DA PALAVRA DE DEUS',
        '1. Discurso teste (10 min)',
        'Comentários finais (3 min)',
        'Cântico 3 e oração',
    ].join('\n');
    const parsedTextoPt = await extrairDados(textoPt, 'texto', 'pt');
    assert.equal(parsedTextoPt.semana, '28 de dezembro de 2026–3 de janeiro de 2027 - EZEQUIEL 9-10');
    assert.equal(parsedTextoPt.dataInicio, '2026-12-28');

    const textoEs = [
        '28 de diciembre de 2026 a 3 de enero de 2027',
        'EZEQUIEL 9, 10',
        'Canción 1 y oración',
        'Palabras de introducción (1 min.)',
        'TESOROS DE LA BIBLIA',
        '1. Discurso prueba (10 mins.)',
        'Palabras de conclusión (3 mins.)',
        'Canción 3 y oración',
    ].join('\n');
    const parsedTextoEs = await extrairDados(textoEs, 'texto', 'es');
    assert.equal(parsedTextoEs.semana, '28 de diciembre de 2026 a 3 de enero de 2027 - EZEQUIEL 9, 10');
    assert.equal(parsedTextoEs.dataInicio, '2026-12-28');

    // Semana de 2027 cujo corpo cita um ano antigo (ex.: 2022), mas metadados indicam 2027
    const html2027 = `<!doctype html><html><head>
        <meta property="og:title" content="Programação da Reunião Vida e Ministério 4-10\u00a0de janeiro de 2027">
        <link rel="canonical" href="https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/janeiro-fevereiro-2027-mwb/Programa-4-10-de-janeiro-de-2027/">
    </head><body><article><header>
        <h1>4-10 de janeiro</h1>
        <h2>EZEQUIEL 11-12</h2>
    </header><main>
        <h2>TESOUROS DA PALAVRA DE DEUS</h2>
        <h3>1. Discurso (10 min)</h3>
        <p>Veja A Sentinela de 2022 para mais detalhes.</p>
    </main></article></body></html>`;
    const parsed2027 = await extrairDados(html2027, 'html', 'pt');
    assert.equal(parsed2027.dataInicio, '2027-01-04');
});

test('bloqueio de eventos e agendamento semanal funcionam na virada de ano e em 2027', () => {
    const configEventos = {
        eventosAnuais: [
            { dataInicio: '2026-12-28', dataInput: '2027-01-02', tipo: 'assembleia_circuito' },
            { dataInicio: '2027-02-08', dataInput: '2027-02-13', tipo: 'assembleia_circuito' },
        ],
    };

    const evVirada = getEventoEspecialPorSemana({
        semanaStr: '28 de dezembro de 2026–3 de janeiro de 2027',
        config: configEventos,
        textSources: ['28 de dezembro de 2026–3 de janeiro de 2027'],
    });
    assert.equal(evVirada?.dataInicio, '2026-12-28');

    const ev2027 = getEventoEspecialPorSemana({
        semanaStr: '8-14 de fevereiro',
        config: configEventos,
        textSources: [
            '8-14 de fevereiro',
            'https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/janeiro-fevereiro-2027-mwb/Programa-8-14-de-fevereiro-de-2027/',
        ],
    });
    assert.equal(ev2027?.dataInicio, '2027-02-08');

    const grupoCfg = normalizeGruposProgramacao({
        idioma: 'pt',
        dia_reuniao: 'friday',
        horario: '19:45',
        dia_reuniao_fds: 'sunday',
        horario_fds: '18:30',
    });
    const dadosVirada = {
        semana: '28 de dezembro de 2026–3 de janeiro de 2027 - EZEQUIEL 9-10',
        dataInicio: '2026-12-28',
        partes: [{ id: 'p1', titulo: '1. Discurso', secao: 'tesouros', tipo: 'parte', tempo: '10' }],
    };
    const [prog] = aplicarOperacoesProgramacao({
        programacoes: [],
        config: grupoCfg,
        grupoId: 'grupo-portugues',
        operacoes: prepararImportacaoSemanal({
            programacoes: [],
            config: grupoCfg,
            grupoId: 'grupo-portugues',
            dados: dadosVirada,
        }).operacoes,
    });
    assert.equal(prog.id, 'prog-grupo-portugues-2026-12-28');
    assert.equal(prog.dataInicio, '2026-12-28');
    assert.equal(prog.meioSemana.data, '2027-01-01');
    assert.equal(prog.fimDeSemana.data, '2027-01-03');
});

test('parser nao descarta partes cujas descricoes citam Testemunhas de Jeova, conversa anterior ou termos do menu', async () => {
    const htmlPt = `<!doctype html><html><body>
        <nav><a>Início</a><a>Biblioteca</a><a>Testemunhas de Jeová</a></nav>
        <article id="article"><header>
            <h1>7-13 de dezembro</h1>
            <h2>EZEQUIEL 3-4</h2>
        </header>
            <p>Cântico 71 e oração | Comentários iniciais (1 min)</p>
            <h2>FAÇA SEU MELHOR NO MINISTÉRIO</h2>
            <h3>4. Iniciando conversas</h3>
            <p>(3 min) DE CASA EM CASA. Mostre o site jw.org no início da conversa.</p>
            <h3>5. Iniciando conversas</h3>
            <p>(4 min) TESTEMUNHO PÚBLICO. A pessoa ouviu dizer que as Testemunhas de Jeová são uma seita. (lmd lição 4 ponto 4)</p>
            <h3>6. Cultivando o interesse</h3>
            <p>(4 min) TESTEMUNHO INFORMAL. Responda uma pergunta que foi feita na conversa anterior. (lmd lição 9 ponto 5)</p>
            <p>Comentários finais (3 min) | Cântico 7 e oração</p>
        </article>
    </body></html>`;

    const dadosPt = await extrairDados(htmlPt, 'html', 'pt');
    const p4 = dadosPt.partes.find((p) => p.titulo.startsWith('4.'));
    const p5 = dadosPt.partes.find((p) => p.titulo.startsWith('5.'));
    const p6 = dadosPt.partes.find((p) => p.titulo.startsWith('6.'));
    assert.equal(p4?.tempo, '3');
    assert.match(p4?.descricao || '', /jw\.org/);
    assert.equal(p5?.tempo, '4');
    assert.equal(p5?.descricao, 'TESTEMUNHO PÚBLICO. A pessoa ouviu dizer que as Testemunhas de Jeová são uma seita. (lmd lição 4 ponto 4)');
    assert.equal(p6?.tempo, '4');
    assert.match(p6?.descricao || '', /conversa anterior/);

    const textoEs = [
        'Testigos de Jehová',
        'Biblioteca',
        'Anterior',
        '7-13 de diciembre',
        'EZEQUIEL 3-4',
        'SEAMOS MEJORES MAESTROS',
        '5. Empecemos conversaciones',
        '(4 mins.) PREDICACIÓN PÚBLICA. La persona ha oído que los testigos de Jehová son una secta (lmd lección 4 punto 4).',
        '6. Hagamos revisitas',
        '(4 mins.) DE CASA EN CASA. Retoma el tema de la visita anterior (lmd lección 9 punto 4).',
    ].join('\n');

    const dadosEs = await extrairDados(textoEs, 'texto', 'es');
    const es5 = dadosEs.partes.find((p) => p.titulo.startsWith('5.'));
    const es6 = dadosEs.partes.find((p) => p.titulo.startsWith('6.'));
    assert.equal(es5?.tempo, '4');
    assert.match(es5?.descricao || '', /testigos de Jehová/);
    assert.equal(es6?.tempo, '4');
    assert.match(es6?.descricao || '', /visita anterior/);
});
