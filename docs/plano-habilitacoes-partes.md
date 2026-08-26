# Plano: habilitacoes de partes por aluno

Este documento registra a proposta tecnica para mudar a forma como o sistema
sugere e valida estudantes/designados para as partes. A regra atual usa
principalmente `tipo` do aluno, como `anciao`, `servo`, `irmao_hab`, `irma`,
`irma_exp`, `irma_lim` e `desab`. A nova regra deve usar uma lista explicita de
partes que cada aluno pode fazer.

## Objetivo

- Criar uma secao no cadastro do aluno chamada "Partes que pode fazer".
- Salvar as habilitacoes em cada documento de `users/{uid}/alunos`.
- Fazer o motor de sugestao consultar essas habilitacoes, nao apenas o cargo.
- Manter compatibilidade com alunos antigos que ainda nao tenham o novo campo.
- Preparar a base para a folha da reuniao de fim de semana, detalhada em
  `docs/plano-programacao-fim-de-semana.md`.

## Campo novo

Campo recomendado no documento do aluno:

```js
partesHabilitadas: [
  'discurso_inicial',
  'joias_espirituais',
  'leitura_biblia',
  'ministerio',
  'discurso',
  'vida_crista',
  'estudo_biblico_congregacao',
  'leitor_ebc',
  'oracao',
  'presidente_rvm',

  'presidente_fds',
  'dirigente_sentinela',
  'leitor_sentinela',

  'indicador_entrada',
  'indicador_auditorio',
  'microfones_volantes',
  'audio_video'
]
```

Use array de strings em vez de objeto booleano. O array e mais simples de
salvar, exportar, importar, comparar e migrar. Uma chave ausente significa que o
aluno ainda esta no modelo legado.

## Catalogo oficial

### Reuniao Vida e Ministerio

- `presidente_rvm`: Presidente da Reuniao Vida e Ministerio.
- `discurso_inicial`: Parte 1 de Tesouros.
- `joias_espirituais`: Parte 2, Joias Espirituais.
- `leitura_biblia`: Parte 3, Leitura da Biblia.
- `ministerio`: Todas as partes da secao Faca Seu Melhor no Ministerio, exceto
  discurso de 5 minutos.
- `discurso`: Discurso de 5 minutos no Ministerio.
- `vida_crista`: Todas as partes da secao Nossa Vida Crista, exceto Estudo
  Biblico de Congregacao.
- `estudo_biblico_congregacao`: Dirigente do Estudo Biblico de Congregacao.
- `leitor_ebc`: Leitor do Estudo Biblico de Congregacao.
- `oracao`: Oracao inicial e final.

### Reuniao de fim de semana

- `presidente_fds`: Presidente da reuniao de fim de semana.
- `dirigente_sentinela`: Dirigente do Estudo de A Sentinela.
- `leitor_sentinela`: Leitor de A Sentinela.

Essas chaves alimentam a tela e a folha de fim de semana descritas em
`docs/plano-programacao-fim-de-semana.md`.

### Apoio

- `indicador_entrada`: Indicador da entrada.
- `indicador_auditorio`: Indicador do auditorio.
- `microfones_volantes`: Microfones volantes.
- `audio_video`: Audio e video.

Essas chaves tambem entram no cadastro desde ja para evitar nova migracao de
perfil quando a folha for expandida.

## Mapeamento de slots atuais

O sistema atual precisa mapear cada slot visivel para uma chave de
`partesHabilitadas`:

| Contexto atual | Slot | Chave exigida |
| --- | --- | --- |
| Presidente da RVM | `presidente` | `presidente_rvm` |
| Parte 1 de Tesouros | `estudante` | `discurso_inicial` |
| Joias Espirituais | `estudante` | `joias_espirituais` |
| Leitura da Biblia | `estudante` | `leitura_biblia` |
| Ministerio, sem discurso | `estudante` | `ministerio` |
| Ministerio, sem discurso | `ajudante` | mesma chave do estudante, com genero compativel |
| Discurso no Ministerio | `estudante` | `discurso` |
| Nossa Vida Crista, sem EBC | `estudante` | `vida_crista` |
| Nossa Vida Crista, sem EBC | `ajudante` | mesma chave do estudante, com genero compativel |
| Estudo Biblico de Congregacao | `dirigente` | `estudo_biblico_congregacao` |
| Estudo Biblico de Congregacao | `leitor` | `leitor_ebc` |
| Oracao inicial/final | `oracao` | `oracao` |

Observacao: ajudantes continuam obedecendo a regra de genero do estudante
quando houver estudante ja definido.

## Compatibilidade com o campo `tipo`

O campo `tipo` deve continuar existindo no curto prazo porque hoje ele e usado
para:

- esconder `desab` das sugestoes e listas ativas;
- calcular genero pelo `cargosMap`;
- filtros visuais da lista de alunos;
- exibicao de badges e exportacoes;
- permitir exclusao apenas de alunos desabilitados.

A nova regra nao deve apagar `tipo`. Ela apenas deixa de usar `tipo` como fonte
principal de elegibilidade para partes.

Fallback recomendado para alunos sem `partesHabilitadas`:

```js
if (Array.isArray(aluno.partesHabilitadas)) {
  return aluno.partesHabilitadas.includes(chave);
}

return getPartesHabilitadasLegado(aluno.tipo).includes(chave);
```

Esse fallback permite publicar a mudanca sem obrigar uma migracao imediata de
todos os alunos.

## Helper central

Criar um modulo central, por exemplo:

```text
src/utils/assignmentEligibility.js
```

Responsabilidades:

- exportar o catalogo oficial das habilitacoes;
- inferir a chave exigida por um slot/parte;
- calcular habilitacoes legadas a partir de `tipo`;
- validar se um aluno pode ocupar um slot;
- retornar mensagens curtas para a UI explicar bloqueios.

Funcoes sugeridas:

```js
export const ASSIGNMENT_CAPABILITIES = [...]
export function getAssignmentCapabilityForSlot({ parte, slotKey })
export function getLegacyCapabilitiesForTipo(tipo)
export function getAlunoCapabilities(aluno)
export function isAlunoEligibleForAssignment({ aluno, parte, slotKey, cargosMap })
```

## Superficies de codigo

### Cadastro de alunos

Arquivo principal:

```text
src/components/ListaAlunos/ModalFormulario.jsx
```

Adicionar a secao "Partes que pode fazer" com checkboxes agrupados por:

- Reuniao Vida e Ministerio;
- Reuniao de fim de semana;
- Apoio.

Ao criar aluno novo, iniciar `partesHabilitadas` com o fallback legado do
`tipo` escolhido, para reduzir trabalho manual.

Ao trocar `tipo`, nao substituir automaticamente `partesHabilitadas` se o aluno
ja tiver escolhas explicitas. O ideal e oferecer uma acao manual futuramente,
como "preencher com padrao deste tipo".

### Sugestao inteligente

Arquivo principal:

```text
src/components/Designar/ModalSugestao.jsx
```

Substituir o bloco `allowedRoles` por chamada ao helper central. O modal deve
continuar usando:

- ocupados na semana;
- familia ja usada;
- historico especifico da parte;
- ranking por maior intervalo desde a ultima parte.

O que muda e apenas o filtro de elegibilidade.

### Lateral de alunos e designacao manual

Arquivos principais:

```text
src/components/Designar/index.jsx
src/components/Designar/SidebarAlunos.jsx
```

A lateral deve respeitar a mesma regra quando houver `slotAtivo`.

Recomendacao:

- se nao houver slot ativo, mostrar todos os alunos ativos como hoje;
- se houver slot ativo, ocultar ou desabilitar alunos sem a habilitacao exigida;
- em `atribuirAluno`, validar de novo antes de gravar para impedir bypass por
  arrastar/estado antigo da UI.

### Historico

Arquivo principal:

```text
src/components/RevisarEnviar/index.jsx
```

O historico atual ja grava buckets como `joias`, `leitura`, `ministerio`,
`discurso`, `vidacrista`, `estudobiblico`, `leitor`, `oracao` e `presidente`.

Nao e obrigatorio migrar o historico agora. O ranking pode continuar lendo os
termos atuais, mas a etapa de implementacao deve mapear esses termos para as
novas chaves quando calcular "ultima vez que fez esta parte".

## Migracao de dados

Fase 1: sem escrita em massa.

- Implementar campo novo e fallback legado.
- Publicar em ambiente local/sandbox primeiro.
- Confirmar que alunos sem `partesHabilitadas` continuam aparecendo como antes.

Fase 2: relatorio dry-run.

- Criar script que le `users/{uid}/alunos`.
- Para cada aluno, sugerir `partesHabilitadas` com base em:
  - `tipo` atual;
  - listas/auditorias existentes em `tmp/audit-partes-regras-2026-08-25.json`;
  - excecoes e observacoes confirmadas pelo usuario.
- Gerar JSON/CSV para revisao antes de qualquer escrita.

Fase 3: aplicacao opcional.

- Aplicar somente depois de autorizacao explicita.
- Fazer backup local antes.
- Usar merge por aluno para preservar campos existentes.

## Riscos

- Se a regra ficar apenas no modal de sugestao, a designacao manual ainda pode
  permitir pessoa sem habilitacao.
- Se `leitor` continuar generico, vai misturar leitor do EBC com leitor de A
  Sentinela. Por isso usar `leitor_ebc` e `leitor_sentinela`.
- Se `tipo` for removido cedo demais, quebra filtros, badges, genero e exclusao
  de desabilitados.
- Se a migracao preencher todos automaticamente sem revisao, excecoes locais da
  congregacao podem ser perdidas.

## Validacao

Antes de concluir a implementacao:

1. Rodar `npm.cmd run build`.
2. Rodar `npm.cmd run lint` se o estado atual do lint permitir uma leitura util.
3. Testar localmente:
   - novo aluno com habilitacoes marcadas;
   - aluno legado sem `partesHabilitadas`;
   - sugestao para cada tipo atual de parte;
   - arrastar aluno nao habilitado para um slot;
   - editar `tipo` sem apagar habilitacoes manuais;
   - salvar aluno e confirmar persistencia no Firestore/local state.
4. Conferir que alunos `desab` continuam fora das sugestoes.
5. Conferir que Presidente RVM, EBC dirigente e EBC leitor usam chaves
   diferentes.

## Prompt para iniciar implementacao

```text
Implemente o plano em docs/plano-habilitacoes-partes.md.

Escopo:
- Criar um helper central em src/utils/assignmentEligibility.js com o catalogo de
  habilitacoes, fallback legado por tipo, inferencia de chave por slot/parte e
  validacao de elegibilidade.
- Adicionar no cadastro de alunos uma secao "Partes que pode fazer", salvando
  partesHabilitadas como array de strings.
- Ao criar aluno novo, inicializar partesHabilitadas pelo fallback legado do tipo
  escolhido.
- Manter tipo como campo existente para status, genero, filtros e exibicao.
- Alterar ModalSugestao para usar partesHabilitadas/fallback legado no lugar de
  allowedRoles.
- Alterar a lateral de Designar e a funcao atribuirAluno para respeitarem a
  mesma elegibilidade quando houver slot ativo, impedindo bypass por clique ou
  drag-and-drop.
- Separar leitor_ebc de leitor_sentinela e usar estudo_biblico_congregacao para
  dirigente do EBC.
- Implementar a folha e os slots de fim de semana seguindo
  `docs/plano-programacao-fim-de-semana.md`.
- Nao fazer deploy, nao migrar producao e nao aplicar escrita em massa sem nova
  autorizacao.

Valide com npm.cmd run build e, se fizer sentido no estado atual do repo,
npm.cmd run lint. Preserve arquivos nao rastreados existentes em scripts/ e tmp/.
```
