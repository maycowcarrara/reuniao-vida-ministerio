# Plano: programacao de fim de semana

Este documento registra o plano final para incluir a programacao da reuniao de
fim de semana no sistema. A referencia visual recebida deve ser usada apenas
como checklist de informacoes necessarias, nao como guia de estilo.

## Objetivo

- Permitir cadastrar designacoes da reuniao de fim de semana na mesma semana da
  Reuniao Vida e Ministerio.
- Evitar repeticao involuntaria de irmaos entre meio de semana, fim de semana e
  responsabilidades.
- Incluir a programacao do fim de semana opcionalmente no layout de 1 pagina.
- Manter os layouts compactos de 2, 4 e 5 semanas sem mudancas.
- Nao fazer deploy, migracao ou escrita em massa sem autorizacao explicita.

## Decisao de produto

Usar a mesma tela de Designacoes, com duas areas dentro de cada semana:

- Meio de semana.
- Fim de semana.

Nao criar uma segunda tela independente neste momento. O motivo principal e que
o sistema precisa calcular a carga da semana inteira para reduzir repeticoes. Se
as designacoes ficarem em telas separadas, a regra de "irmao ja usado nesta
semana" fica mais facil de duplicar, divergir ou esquecer.

## Modelo de dados

Adicionar um bloco opcional dentro de cada documento de programacao:

```js
fimDeSemana: {
  ativo: false,
  data: '',
  horario: '',
  presidente: null,
  oracaoFinal: null,

  reuniaoPublica: {
    temaDiscurso: '',
    oradorNomeManual: '',
    congregacaoOrador: ''
  },

  estudoSentinela: {
    dirigente: null,
    leitor: null
  },

  responsabilidades: {
    videoZoomSom: [],
    indicadoresEntrada: [],
    indicadoresAuditorio: [],
    microfonesVolantes: []
  }
}
```

Notas:

- `ativo` controla se a programacao de fim de semana deve aparecer na semana.
- `oradorNomeManual` e a fonte unica para o orador do discurso publico.
- As listas em `responsabilidades` devem aceitar varios designados.
- Salvar somente quando o usuario preencher ou ativar a secao; semanas antigas
  sem `fimDeSemana` continuam validas.

## Informacoes necessarias

A programacao de fim de semana precisa suportar:

- Data e dia da semana.
- Horario.
- Presidente.
- Tema do discurso publico.
- Orador do discurso publico.
- Congregacao do orador.
- Dirigente do Estudo de A Sentinela.
- Leitor do Estudo de A Sentinela.
- Oracao final.
- Responsaveis por video, Zoom e som.
- Indicadores da entrada.
- Indicadores do auditorio.
- Microfones volantes.

## Habilitacoes

Reutilizar as habilitacoes ja previstas:

- `presidente_fds`
- `dirigente_sentinela`
- `leitor_sentinela`
- `indicador_entrada`
- `indicador_auditorio`
- `microfones_volantes`
- `audio_video`

Nao existe habilitacao para orador do discurso publico, pois esse campo e
sempre manual.

## UX/UI da tela de Designacoes

Cada card de semana deve continuar com o cabecalho atual. Abaixo dele, incluir
um controle discreto para alternar a area exibida:

- Meio de semana.
- Fim de semana.

A area "Fim de semana" deve ser recolhivel ou em aba, e deve ficar desativada
por padrao quando a semana ainda nao tiver dados de fim de semana.

Estrutura sugerida da area:

1. Cabecalho do fim de semana
   - Toggle "Ativar fim de semana".
   - Campos de data e horario.

2. Bloco principal
   - Presidente.
   - Oracao final.

3. Reuniao publica
   - Tema do discurso.
   - Orador.
   - Nome manual do orador.
   - Congregacao do orador.

4. Estudo de A Sentinela
   - Dirigente.
   - Leitor.

5. Responsabilidades
   - Video, Zoom e som.
   - Indicadores da entrada.
   - Indicadores do auditorio.
   - Microfones volantes.

Para responsabilidades, usar slots multiplos com botao de adicionar, remover
individualmente e sugestao inteligente por funcao.

## Regras de repeticao

O motor de sugestao deve olhar a semana inteira:

- Presidente da RVM.
- Partes da RVM.
- Oracoes.
- Dirigente e leitor do EBC.
- Presidente do fim de semana.
- Dirigente e leitor da Sentinela.
- Oracao final do fim de semana.
- Responsabilidades.

Severidade sugerida:

- Bloqueio forte: mesma pessoa em dois slots incompativeis no mesmo evento do
  fim de semana.
- Aviso forte: pessoa ja tem parte no meio de semana e esta recebendo parte ou
  responsabilidade no fim de semana.
- Aviso leve: pessoa ja tem uma responsabilidade simples, mas pode ser usada de
  novo se confirmado.

Permitir excecao manual com confirmacao. O objetivo e evitar repeticao
involuntaria, nao impedir ajustes necessarios.

## Historico e sugestao

Atualizar o calculo de sugestao para considerar historico especifico por tipo
de funcao:

- `presidente_fds`
- `dirigente_sentinela`
- `leitor_sentinela`
- `oracao_fds`
- `indicador_entrada`
- `indicador_auditorio`
- `microfones_volantes`
- `audio_video`

Se o historico de fim de semana ainda nao existir, iniciar com leitura dos dados
salvos em `fimDeSemana` dentro das programacoes anteriores. A gravacao formal no
historico dos alunos pode ser implementada junto com a rotina de sincronizar
historico, mantendo compatibilidade com os buckets atuais.

## Revisar e Enviar

No layout de impressao:

- Mostrar fim de semana somente no layout `1 Semana (Grande)`.
- Adicionar no cabecalho um toggle "Incluir fim de semana".
- Manter o toggle desligado por padrao.
- Se o toggle estiver desligado, a folha continua exatamente como hoje.
- Se o toggle estiver ligado, renderizar um bloco de fim de semana abaixo da
  programacao do meio de semana.
- Nao alterar os layouts `2 Semanas`, `4 Semanas` e `5 Semanas`.

Conteudo do bloco impresso:

- Data e horario do fim de semana.
- Presidente.
- Discurso publico: tema, orador e congregacao.
- Estudo de A Sentinela: dirigente e leitor.
- Oracao final.
- Responsabilidades.

Campos vazios devem ser omitidos ou exibidos de forma discreta. A folha precisa
continuar cabendo em uma pagina A4.

## Arquivos principais

- `src/components/Designar/index.jsx`
  - Adicionar a area de fim de semana.
  - Editar e salvar `fimDeSemana`.
  - Integrar os novos slots com sugestao.
  - Validar repeticoes considerando a semana inteira.

- `src/components/Designar/ModalSugestao.jsx`
  - Aceitar contexto dos slots de fim de semana.
  - Ordenar sugestoes considerando carga e historico de fim de semana.

- `src/components/Designar/SidebarAlunos.jsx`
  - Filtrar alunos por habilitacao nos novos slots.
  - Mostrar avisos de repeticao da semana quando aplicavel.

- `src/utils/assignmentEligibility.js`
  - Manter o orador do discurso publico como campo manual.
  - Mapear slots de fim de semana para habilitacoes.
  - Preservar fallback legado para alunos sem `partesHabilitadas`.

- `src/components/RevisarEnviar/index.jsx`
  - Renderizar bloco opcional do fim de semana no layout de 1 pagina.

- `src/components/RevisarEnviar/RevisarEnviarHeader.jsx`
  - Adicionar toggle "Incluir fim de semana" apenas quando `qtdSemanas === 1`.

- `src/i18n/index.js`
  - Adicionar textos em PT e ES.

## Plano de implementacao

1. Atualizar `assignmentEligibility`.
2. Criar helpers locais para ler e normalizar `fimDeSemana`.
3. Adicionar UI de fim de semana na tela de Designacoes.
4. Integrar slots novos com `ModalSugestao` e `SidebarAlunos`.
5. Adicionar validacao/avisos de repeticao na semana inteira.
6. Adicionar toggle de impressao no Revisar/Enviar.
7. Renderizar o bloco opcional no layout de 1 pagina.
8. Atualizar textos PT/ES.
9. Validar build e fluxo manual.

## Validacao

Rodar:

```powershell
npm.cmd run build
```

Se o estado atual do lint permitir uma leitura util, rodar tambem:

```powershell
npm.cmd run lint
```

Validar manualmente:

- Ativar fim de semana em uma semana.
- Preencher data, horario, presidente, discurso publico, Sentinela e
  responsabilidades.
- Usar sugestao inteligente nos slots novos.
- Tentar repetir um irmao ja usado no meio de semana.
- Confirmar que a excecao manual funciona.
- Imprimir o layout de 1 semana com "Incluir fim de semana" ligado.
- Imprimir/ver o layout de 1 semana com o toggle desligado.
- Confirmar que 2, 4 e 5 semanas por pagina nao mudaram.
- Confirmar que nao houve deploy, migracao ou escrita em massa.

## Prompt para iniciar implementacao

```text
Implemente o plano em docs/plano-programacao-fim-de-semana.md.

Escopo:
- Usar a mesma tela de Designacoes, adicionando uma area/aba recolhivel de
  "Fim de semana" dentro de cada semana.
- Salvar os dados em um bloco opcional `fimDeSemana` no documento da programacao.
- Incluir campos para data, horario, presidente, oracao final, reuniao publica,
  Estudo de A Sentinela e responsabilidades.
- Permitir orador do discurso publico somente por nome manual, pois sera sempre
  informado manualmente.
- Mapear os slots de fim de semana para as habilitacoes corretas:
  `presidente_fds`, `dirigente_sentinela`, `leitor_sentinela`,
  `indicador_entrada`, `indicador_auditorio`, `microfones_volantes` e
  `audio_video`.
- Fazer a sugestao inteligente e a lateral de alunos considerarem tambem a carga
  da semana inteira, incluindo meio de semana, fim de semana e responsabilidades.
- Evitar repeticoes involuntarias com avisos/bloqueios conforme o plano, mas
  permitir excecao manual com confirmacao.
- No Revisar/Enviar, adicionar o toggle "Incluir fim de semana" somente quando o
  layout for `1 Semana (Grande)`, desligado por padrao.
- Renderizar a programacao de fim de semana somente no layout de 1 pagina quando
  o toggle estiver ligado.
- Nao copiar o estilo da imagem de referencia; ela serve apenas como checklist
  dos campos necessarios.
- Nao alterar os layouts de 2, 4 e 5 semanas por pagina.
- Nao fazer deploy, migracao, publicacao ou escrita em massa sem nova
  autorizacao explicita.

Valide com `npm.cmd run build` e, se fizer sentido no estado atual do repo,
`npm.cmd run lint`. Preserve alteracoes nao relacionadas ja existentes no
worktree, especialmente `package.json`, `package-lock.json` e
`.firebase/hosting.ZGlzdA.cache` se elas nao fizerem parte desta tarefa.
```
