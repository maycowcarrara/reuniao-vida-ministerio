# Plano técnico: programações simultâneas em português e espanhol

Data: 24/10/2026. Estado histórico: E1–E7 implementadas e ativação remota executada no ambiente rvm-sbssc. A comparação posterior com o pedido original encontrou pendências de clareza em Configurações e de operação somente em espanhol. O ponto de continuação atual é o **Adendo A — Adequação ao pedido original**, ao final deste documento. A conclusão técnica das etapas não significa aceite integral da experiência de uso.

Este documento consolida a conversa e as correções do usuário. É a referência para continuar a implementação. As seções anteriores ao Adendo A registram decisões e autorizações das etapas em que foram escritas, incluindo a autorização inicial restrita a planejamento/implementação local e a posterior ativação remota. Para a próxima correção, prevalecem o escopo e os critérios do Adendo A; registros antigos não devem ser interpretados como etapas pendentes nem como instruções para repetir migração/publicação.

## 1. Resultado esperado e decisões de produto

O sistema administrará duas programações dentro da mesma congregação e com um cadastro compartilhado de pessoas. O usuário escolhe Português ou Español; a escolha altera a interface e a programação em foco. Os dados de uma programação não se confundem com os da outra.

| Aspecto | Português inicialmente | Espanhol inicialmente |
| --- | --- | --- |
| Identificação | Nome atual da congregação | Pré-grupo / Grupo de espanhol |
| Meio de semana | Preservar funcionamento atual | Desabilitado |
| Fim de semana | Preservar funcionamento atual | Habilitado; criação sem apostila |
| Frequência | Preservar funcionamento atual | Datas escolhidas, uma ou duas por mês |
| Pessoas existentes | Todas participantes | Nenhuma participante até marcação manual |
| Novas pessoas | Marcado por padrão | Desmarcado por padrão |

Decisões obrigatórias:

1. Não vincular frequência ou tipos de reunião à condição de pré-grupo, grupo ou congregação. Essa condição é identificação; reuniões têm configurações independentes.
2. O espanhol poderá realizar fim de semana semanal ainda como grupo. Também poderá habilitar meio de semana e importar sua própria programação antes de virar congregação.
3. Uma pessoa pode participar das duas programações. Marcar espanhol não desmarca português.
4. Reutilizar `partesHabilitadas` e as regras atuais de elegibilidade. Participação no grupo é um filtro adicional, não uma nova habilitação de função.
5. Nenhuma regra fixa do tipo `idioma === 'es' => ocultar meio de semana`.
6. Escolher idioma/programação não grava a configuração geral, não publica o quadro e não muda a interface de outras pessoas.
7. Meio de semana desabilitado não participa de designação, sugestões, quadro, impressão, envios, confirmações operacionais ou Google Agenda. Dados anteriormente importados são preservados e ficam inativos.
8. O cadastro e o histórico são compartilhados, mas cada designação nova identifica seu grupo e sua reunião.

Não fazem parte deste trabalho: separar instalações ou contas Firebase para cada grupo, transferir o futuro grupo para outro projeto, adicionar outros idiomas, criar permissões administrativas por grupo, automatizar envios ou alterar a regra específica de uma parte teocrática.

## 2. Diagnóstico do código e trabalho concorrente

Inspeção realizada no checkout local, sem navegador e sem consultar ou alterar dados remotos.

| Local | Situação observada | Consequência |
| --- | --- | --- |
| `src/config/appConfig.js` | Idioma único; dia/horário de ambas as reuniões no nível geral; persistência local `app_lang` | Separar configuração dos grupos, preferência local e compatibilidade legada |
| `src/i18n/index.js` | Provider e dicionários PT/ES centralizados | Reutilizar; evitar um segundo sistema de tradução |
| `src/App.jsx` | Idioma vem de `configuracoes.idioma`; lista geral alimenta telas, gravações e quadro | Introduzir escopo de grupo sem substituir a lista completa por uma lista filtrada |
| `src/utils/programacoes.js` | Identidade e reconciliação usam data, assinatura e título sem grupo | Evitar colisões entre PT e ES na mesma semana |
| `src/utils/fimDeSemana.js` | `fimDeSemana` é bloco de uma programação semanal | Manter esse contrato inicialmente, permitindo semana apenas com fim de semana |
| `src/components/QuadroPublico.jsx` | Produz entrada de meio de semana a partir da data, sem um indicador próprio de reunião ativa | Uma programação vazia de fim de semana pode gerar meio de semana indevido |
| `src/components/Importador/index.jsx` | Idioma determina a fonte; usa outro `useGerenciadorDados()` para eventos | Passar explicitamente grupo/configuração; evitar contexto geral divergente |
| `src/components/RevisarEnviar/index.jsx` | Chaves próprias para mensagens; reconstrução de histórico por intervalo semanal; fim de semana impresso apenas em layout específico | Centralizar identidade e impedir limpeza do histórico do outro grupo |
| `src/services/confirmacoesPublicas.js` | Chave sem grupo; validação por título da semana; tokens públicos existentes | Preservar vínculos antigos e validar novas confirmações pelo grupo e programação |
| `src/services/calendarSync.js` | IDs derivados da data; processamento exige campos de meio de semana antes de chegar ao fim de semana | Permitir fim de semana isolado e impedir atualização de evento do outro grupo |
| `src/hooks/useGerenciadorDados.js` | Programação é gravada com substituição do documento; quadro também é substituído integralmente | Não gravar um recorte como se fosse o documento ou quadro completo |
| `src/utils/revisarEnviar/historico.js` | Deduplicação usa data/parte/ajudante; persistência descarta outros campos da entrada | Preservar metadados novos e diferenciar designações entre grupos |
| `firestore.rules` | Allowlist para campos de confirmação e campos superiores do quadro; leitura pública de configuração/programação conforme regras atuais | Adaptar os contratos necessários sem ampliar acesso público |

Na inspeção de 24/10 havia alterações locais pré-existentes em `package.json`, `package-lock.json`, `docs/plano-habilitacoes-partes.md`, Dashboard, Designar, formulário/utilitários de alunos, RevisarEnviar, i18n e utilitários de partes/habilitações; também havia `scripts/test-o-que-voce-diria.mjs` não rastreado. Elas incluem a habilitação específica “O que você diria?”.

Essas mudanças não pertencem a este plano. Antes de implementar, reler `git status --short` e os hunks atuais; não reverter, sobrescrever ou incorporar versões antigas desses arquivos. O estado pode ter mudado desde esta inspeção.

Ler também `docs/plano-programacao-fim-de-semana.md` e `docs/plano-habilitacoes-partes.md`. Este plano estende o primeiro: mantém as reuniões no mesmo conjunto semanal, mas permite um conjunto somente com fim de semana e acrescenta escopo de grupo.

## 3. Arquitetura proposta

### 3.1 Três conceitos separados

- `grupoId`: identidade estável da programação. Não depende do rótulo, idioma principal atual ou estágio organizacional.
- `idioma`: idioma dos conteúdos e mensagens do grupo, inicialmente `pt` ou `es`.
- `grupoSelecionadoId`: preferência local de navegação. Seu idioma alimenta o provider e os textos da interface.

IDs iniciais propostos: `grupo-portugues` e `grupo-espanhol`. São chaves internas permanentes, mesmo se o nome visível mudar. Não criar uma infraestrutura genérica de múltiplas organizações.

### 3.2 Configuração versionada

Manter a coleção e o documento existentes: `users/{ownerUid}/configuracoes/geral`. Estrutura proposta, com valores de horários/dias apenas ilustrativos; o português herda os valores efetivamente existentes:

```js
{
  versaoProgramacao: 2,
  grupoPrincipalId: 'grupo-portugues',
  grupoLegadoId: 'grupo-portugues',
  grupos: {
    'grupo-portugues': {
      id: 'grupo-portugues',
      ativo: true,
      nome: '<nome atual da congregação>',
      idioma: 'pt',
      identificacao: 'Congregação',
      meioSemana: {
        habilitada: true,
        frequencia: 'semanal',
        dia: 'monday',
        horario: '19:30'
      },
      fimDeSemana: {
        habilitada: true,
        frequencia: 'semanal',
        dia: 'saturday',
        horario: '18:00'
      },
      eventosAnuais: []
    },
    'grupo-espanhol': {
      id: 'grupo-espanhol',
      ativo: true,
      nome: 'Pré-grupo / Grupo de espanhol',
      idioma: 'es',
      identificacao: 'Pré-grupo / Grupo',
      meioSemana: {
        habilitada: false,
        frequencia: 'semanal',
        dia: null,
        horario: ''
      },
      fimDeSemana: {
        habilitada: true,
        frequencia: 'datas',
        dia: null,
        horario: ''
      },
      eventosAnuais: []
    }
  }
  // Demais campos existentes preservados durante a transição.
}
```

Regras:

- Não inventar dia/horário do espanhol. Solicitar os dados no agendamento ou na configuração da recorrência.
- `frequencia: 'datas'` significa cadastrar ocorrências explicitamente. Não impor limite de uma reunião mensal nem regra automática de primeiro/terceiro domingo.
- Configurar frequência semanal não cria conteúdo, designados ou publicações automaticamente.
- `grupoLegadoId` é fixado na ativação do modelo; registros sem grupo pertencem a ele. Não usar `grupoPrincipalId` como fallback permanente, pois o principal poderá mudar.
- Campos gerais legados permanecem compatíveis com o grupo legado enquanto houver consumidores antigos; não espelhar neles o grupo em foco.
- Alterar o grupo principal muda o padrão para novos acessos, não reatribui os dados nem as participações existentes.
- Eventos especiais passam a ter escopo por grupo. Eventos existentes são do grupo legado; não aplicar uma visita/assembleia automaticamente ao outro grupo. Uma ação futura para aplicar aos dois deve ser explícita, não presumida.
- A normalização de leitura é pura: não escreve no Firestore nem ativa a migração ao abrir uma tela.

### 3.3 Pessoas

Novo campo em `users/{ownerUid}/alunos/{alunoId}`:

```js
gruposParticipantes: ['grupo-portugues']
```

- Campo ausente: interpretar como participação no grupo legado, que nesta implantação é português.
- Array vazio explícito: pessoa sem participação; não reintroduzir português por fallback.
- Novo cadastro: português marcado e espanhol desmarcado, inclusive quando aberto na interface em espanhol.
- Rótulo: “Participa das programações”, com Português e Espanhol. Exibir opções também para cadastro em espanhol vazio, permitindo ao administrador marcar os primeiros participantes.
- Não replicar pessoa ou histórico; não alterar `partesHabilitadas`, cargo, telefone, ausências ou família ao marcar grupo.
- Desmarcar um grupo não apaga designações existentes. Elas continuam visíveis e recebem aviso para revisão; novas atribuições/sugestões exigem participação.
- Não criar exceção silenciosa que permita arrastar pessoa não participante. O cadastro pode ser ajustado explicitamente antes da atribuição.

### 3.4 Programação semanal compatível

Manter `users/{ownerUid}/programacao/{programacaoId}` e o bloco `fimDeSemana`. Acrescentar grupo e controle explícito de meio de semana, sem converter toda a base para outra coleção:

```js
{
  id: 'prog-grupo-espanhol-2026-11-02',
  versaoProgramacao: 2,
  grupoId: 'grupo-espanhol',
  dataInicio: '2026-11-02', // segunda-feira que identifica a semana
  semana: '<rótulo de apresentação>',
  meioSemana: { ativo: false, data: '', horario: '' },
  partes: [],
  fimDeSemana: {
    ativo: true,
    data: '2026-11-08',
    horario: '09:30'
    // Demais campos e slots já existentes.
  },
  publicadaNoQuadro: false
}
```

- Novas programações começam como rascunho. Ativar uma reunião e publicá-la são ações diferentes.
- O agregado suporta inicialmente até uma reunião de cada tipo por grupo/semana, atendendo o uso descrito. Se houver tentativa de cadastrar uma segunda do mesmo tipo na mesma semana, apresentar o conflito; não sobrescrever. Suportar múltiplas do mesmo tipo na mesma semana exigirá extensão posterior.
- Datas novas são ISO locais `YYYY-MM-DD`; dias são canônicos; títulos traduzidos nunca identificam registros.
- Ocorrência com data/horário explícitos tem precedência sobre o padrão do grupo. Mudanças de padrão não devem mover silenciosamente ocorrências já definidas/publicadas.
- `meioSemana.ativo` ausente no legado preserva o comportamento de meio de semana existente. No novo modelo é sempre explícito; não inferir atividade de `partes.length`, porque um evento especial pode não ter partes.
- A reunião operacional é utilizável quando grupo está ativo, tipo está habilitado e ocorrência está ativa/não cancelada. Publicidade exige também publicação e ausência de arquivamento.
- Desabilitar um tipo preserva seus dados, mas remove seu uso operacional e público. Histórico realizado permanece consultável; reabilitar não publica ocorrências que estavam em rascunho.
- Importar meio de semana em semana que já tenha fim de semana atualiza somente o conteúdo correspondente. Preservar fim de semana, identidade, publicação e demais metadados; não usar um spread cego que substitua blocos existentes.
- Se a importação estiver desabilitada para o grupo, ocultar a ação e recusar a operação no domínio. Importações/backup legados podem carregar conteúdo inativo, que não deve ser utilizado enquanto a configuração estiver desabilitada.

## 4. Identidade, seleção e gravação segura

### 4.1 Identidade da programação

- Novos documentos: ID determinístico com grupo e segunda-feira da semana.
- IDs existentes são preservados. Não renomear documentos em massa para adequá-los ao novo formato.
- Comparações por data, assinatura ou título só podem ocorrer dentro do mesmo grupo efetivo.
- Um ID explícito existente não autoriza mudar seu grupo. Validar que a operação aponta para o grupo correto.
- Usar a mesma identidade em importação, deduplicação, arquivamento, seleção, histórico, confirmação, notificações e agenda.
- Mudança de data para outra semana deve verificar colisão e manter uma política explícita de movimentação e atualização dos vínculos; nunca mesclar duas programações por acidente.

### 4.2 Separar lista completa e lista da tela

Hoje `setListaProgramacoes` e `salvarAlteracao` recebem arrays amplos. A implementação deve introduzir operações por ID ou aplicar mudanças a um mapa completo, com validação de grupo.

Contrato desejado:

```js
upsertProgramacao({ grupoId, programacao })
patchProgramacao({ grupoId, programacaoId, alteracoes })
arquivarProgramacoes({ grupoId, ids })
excluirProgramacoes({ grupoId, ids })
```

A UI pode receber `programacoesDoGrupo`, mas gravações e republicações devem partir da fonte completa. Uma edição em espanhol não pode remover, arquivar, substituir ou deixar de publicar as semanas em português. Não reconstruir o documento completo a partir de props filtradas.

Preservar campos desconhecidos. Como a gravação de `programacao` hoje substitui o documento, não passar projeções de UI/públicas como payload de persistência. Tratar falhas de salvamento e de republicação separadamente: informar se dados foram salvos mas o quadro precisa ser republicado; não anunciar sucesso completo após falha parcial.

### 4.3 Estado de interface e operações assíncronas

- Seletor no topo, próximo de Ver quadro; versão compacta PT/ES no celular, com nome acessível completo. Sem bandeiras.
- Preferência proposta: `rvm_grupo_ativo:v2:{ownerUid}`, compartilhada entre administrativo e quadro no mesmo navegador/origem. Não persistir informações pessoais nessa chave.
- Ordem de escolha no administrativo: preferência válida e ativa; depois grupo principal; depois primeiro grupo ativo.
- Quadro: preferência válida entre grupos com reuniões publicadas disponíveis; principal disponível; primeiro disponível. Sem reuniões, usar idioma padrão e estado vazio.
- Se espanhol ainda tiver programação publicada mas nenhuma reunião futura, conservar a escolha e mostrar estado vazio. Se deixar de ser uma opção disponível, aplicar o fallback e atualizar a preferência.
- A disponibilidade do seletor público usa ocorrências publicadas, não exige todos os slots preenchidos e não depende apenas de reuniões futuras. Rascunhos e grupos desativados não criam opção.
- `app_lang` pode continuar como cache de tradução, mas não determina grupo nem configurações persistidas.
- `localStorage` indisponível não pode impedir o uso da aplicação.
- Seleção de semanas, expansão de cartões e filtros devem ser isolados por grupo ou reinicializados ao trocar. Ações de envio nunca reaproveitam seleção oculta do outro grupo.
- Formulário com alterações não salvas usa a proteção já existente antes de trocar de contexto.
- Ações em andamento capturam o grupo/IDs no início; a mudança de seleção não altera o destino de uma operação pendente. Prevenir cliques duplicados durante gravações.
- Revisar helpers que consultam `config.idioma` ou `document.lang`: o idioma da mensagem/confirmação vem da reunião de destino, mesmo que a preferência do administrador mude depois.

## 5. Agendamento manual, semanal e eventos especiais

### 5.1 Primeiro uso: pré-grupo

Ação “Agendar reunião de fim de semana” em Designar, disponível mesmo sem nenhuma semana importada. Informar data e horário; abrir slots existentes, incluindo tema, orador manual, congregação do orador, presidente, dirigente/leitor, oração e apoios.

Criar apenas as datas escolhidas. Uma ou duas reuniões mensais são decisões dos responsáveis, não limites rígidos do sistema. Se a semana já existir no mesmo grupo, acrescentar/editar seu fim de semana de forma explícita.

### 5.2 Frequência semanal

Entregar a configuração e um gerador local de rascunhos por intervalo finito escolhido pelo administrador, com prévia das datas. Não implementar cron, Worker, geração infinita ou publicação automática.

- Usar dia/horário configurados e calendário local.
- Gerar somente ocorrências faltantes; repetir a ação é idempotente.
- Nunca duplicar, sobrescrever designações ou reabrir ocorrência cancelada.
- Cancelamento preserva a ocorrência inativa como registro, impedindo que a próxima geração a recrie sem intenção explícita.
- Aplicar eventos especiais do próprio grupo; conflitos/eventos impeditivos aparecem na prévia.
- Ao habilitar meio de semana, permitir importar sua programação em espanhol. Gerar uma ocorrência vazia não equivale a importar o conteúdo oficial.
- Mudança de dia padrão vale para novas ocorrências. Ajustar as existentes exige seleção e revisão das consequências, inclusive confirmações/agenda.

### 5.3 Transições organizacionais

| Transição | Alteração de configuração | Dados que permanecem |
| --- | --- | --- |
| Pré-grupo para grupo semanal | Fim de semana passa de datas para semanal | Pessoas, IDs, designações, tokens e histórico |
| Grupo passa a ter meio de semana | Habilitar tipo, definir dia/horário e importar ES | Programações PT e fins de semana ES |
| Espanhol passa a ser principal | Alterar grupo principal e identificação | Grupo legado fixo e histórico de ambos |

Desativar o grupo português, se desejado no futuro, será uma decisão explícita e não uma consequência automática da última transição.

## 6. Designações, elegibilidade e histórico

Compor a regra: participação no grupo + habilitação existente + gênero/cargo quando exigidos + disponibilidade + regras de repetição/conflito já existentes.

- Aplicar em sugestões, drag and drop, atribuição direta, substituição e seletores de pessoas. Não limitar apenas a sidebar.
- Estado vazio em espanhol informa que ninguém foi marcado para o grupo e oferece acesso ao cadastro; não sugerir automaticamente todos os participantes portugueses.
- Preservar a regra atual de “O que você diria?” e os novos testes locais.
- Calcular ocupação usando todas as programações relevantes da pessoa, inclusive o outro grupo. Repetição semanal é aviso conforme regra atual; sobreposição real é conflito. Não bloquear toda participação em ambos os grupos só por ocorrer na mesma semana.
- Se faltarem dados de duração para afirmar sobreposição, mostrar possível conflito e não apresentar precisão inexistente. Não introduzir restrição nova irreversível sem registrar a decisão.
- Histórico novo inclui `grupoId`, `programacaoId`, `tipoReuniao`, identidade do slot e campos atuais. Leituras legadas atribuem grupo legado.
- Corrigir `addHistorico` e seus chamadores para preservar esses campos; auditar coerção numérica de IDs de pessoas, pois IDs de Firestore não devem colidir por conversão para número.
- Reconstruir/remover histórico somente para grupo, programações e tipos de reunião selecionados. Não apagar por intervalo de datas sem escopo, nem remover eventos antigos de outro grupo.
- Deduplicação deve identificar a designação, não apenas data/parte/ajudante. Duas funções equivalentes PT/ES na mesma data são entradas diferentes.
- Rodízio considera o grupo em foco para a distribuição de funções e mantém visível a carga total da pessoa; preservar critérios atuais onde não precisarem mudar.

## 7. Quadro público e impressão

### 7.1 Projeção e acesso

Manter inicialmente `quadros_publicos/{ownerUid}` e as chaves superiores atuais (`ownerUid`, `updatedAtIso`, `configuracoes`, `historico_reunioes`). Acrescentar metadados dentro dessas estruturas e controlar o tamanho do documento; medir o payload com os dois grupos antes da liberação. Se ultrapassar o limite aplicável, a publicação deve falhar de forma visível, sem truncar silenciosamente um grupo; particionamento será uma decisão explícita caso necessário.

O publicador continua com o mesmo link e o fluxo atual de PIN/acesso. Não criar uma segunda página pública nem outro cadastro de congregação.

Substituir cópia integral por projeção explícita dos campos públicos necessários. Incluir grupo/IDs, datas, títulos e nomes das pessoas designadas; excluir contato, e-mail, telefone, avatar privado, ausências, habilitações, participação dos alunos e metadados internos de envio. A configuração pública contém somente dados de apresentação/agenda necessários, nunca uma cópia irrestrita da configuração administrativa.

Esta projeção preserva os IDs/campos necessários à validação pública de confirmações. Não resolver consultas anônimas abrindo listagem de `users/.../programacao` ou de alunos. Revisar o fallback atual de `useQuadroPublico`, sem ampliar suas permissões para fazer o novo fluxo funcionar.

### 7.2 Exibição

- Filtrar grupo antes de produzir entradas de meio de semana e fim de semana.
- Reunião somente de fim de semana não produz cabeçalho, data, agenda, contagem regressiva ou cartão de meio de semana.
- Preservar ordenação cronológica, busca de nomes, modo ao vivo e geração de links de agenda para os dois idiomas.
- Datas e horários específicos da ocorrência prevalecem sobre o padrão; corrigir o uso atual em que o padrão pode ganhar do horário de fim de semana preenchido.
- O seletor mostra Português e Español, com estado selecionado acessível e área de toque adequada. Uma única opção não exige seletor público.

### 7.3 Impressão

- Tornar funcional a folha de uma reunião apenas de fim de semana, sem área vazia de meio de semana e sem depender da opção “Incluir fim de semana” destinada à folha combinada.
- Preservar os layouts PT existentes de 1/2/4/5 semanas quando a entrada não mudar.
- Para seleção somente de fim de semana, imprimir as reuniões selecionadas no layout próprio, inicialmente uma por página. Não permitir que selecionar 2/4/5 semanas resulte em PDF vazio por causa das condições atuais.
- Expandir layouts compactos específicos de fim de semana fica fora da primeira entrega; mostrar claramente as opções aplicáveis ao tipo selecionado.
- Títulos, idioma e identificação devem vir do grupo da programação; conferir que não vaze nome/horário do outro grupo.

## 8. Mensagens, confirmações e notificações

### 8.1 Uma identidade compartilhada

Criar helper único para chaves e metadados de designação, utilizado por RevisarEnviar, helpers de envio, confirmação, histórico e notificações. Evitar versões concorrentes de `buildMsgKey` e `buildAssignmentKey`.

Novas identidades devem conter, de forma canônica, ao menos: versão, grupo, ID da programação, tipo de reunião, slot/parte, pessoa e papel. A serialização precisa ser determinística e segura para o identificador de documento. Não usar rótulo traduzido da semana como chave.

Adicionar aos novos documentos de confirmação os campos necessários à resolução inequívoca, como `identityVersion`, `grupoId`, `programacaoId`, `tipoReuniao`, `parteId`/slot e `pessoaId`. Ajustar allowlists de criação e regras para que identidade, dono e token sejam imutáveis nas respostas públicas.

### 8.2 Compatibilidade com confirmações existentes

- Não recalcular `assignmentKey`, renomear documentos privados ou regenerar tokens já publicados só por introduzir grupos.
- Identidade v1 continua válida no grupo legado; nova identidade não pode adotar confirmação v1 de outro grupo por data/título.
- Para designações legadas, resolver primeiro o vínculo existente e continuar usando sua chave/token. Criar v2 para novas designações; não produzir confirmação paralela para a mesma designação antiga.
- Validação v2 usa grupo/programação/tipo/slot e pessoa atuais; v1 continua com caminho compatível limitado ao grupo legado.
- Alterar nome visível, idioma da interface ou grupo principal não invalida links. Substituição/cancelamento real segue a semântica de indisponibilidade já existente.
- Se a reunião/tipo estiver desativado, o link informa indisponibilidade e não pode confirmar outra reunião com a mesma data.
- Manter resposta inicial e lembrete semanal separados, sem perder status, histórico ou checks de canais enviados.
- Projeção pública deve permitir validar o alvo sem expor dados de contato nem depender da preferência local do visitante.

### 8.3 Envios e notificações

- Fila de e-mail, WhatsApp, lembretes e prévias contém somente reuniões habilitadas do grupo selecionado.
- Idioma da mensagem e do link de confirmação vem da programação, não de um `document.lang` global mutável.
- Manter o texto de contexto do grupo para diferenciar mensagens das duas programações.
- Carimbar novos alertas com escopo de grupo em estrutura compatível com as regras. Preservar a central geral; ao navegar de um alerta para uma semana, selecionar o grupo do alerta antes de focar a programação.
- Não enviar mensagens reais para validar. Usar prévias, fixtures e adaptadores simulados.

## 9. Google Agenda

- Remover a dependência de `dataExata`/`partes` de meio de semana para processar uma reunião só de fim de semana.
- Cada evento novo deve ter identidade determinística que distinga grupo, programação, tipo e slot, com formato aceito pelo provedor. Pode-se usar hash hexadecimal determinístico do conjunto canônico, validado na implementação.
- Guardar metadados de identidade em mecanismo compatível com o serviço; não usar nome traduzido como referência técnica.
- Preservar IDs de eventos existentes no grupo legado. Não criar um novo evento PT para cada evento antigo apenas porque o novo esquema entrou em vigor.
- Mapeamento da agenda escolhida passa a ser por dono/grupo. A chave global antiga `rvm_saved_calendar_id` pode servir apenas ao grupo legado; não selecionar automaticamente a mesma agenda para espanhol.
- Os grupos podem usar a mesma agenda se o administrador escolher isso. Eventos continuam distintos.
- Atualização, cancelamento e eventual remoção atuam somente em eventos pertencentes à designação/grupo alvo. Não limpar a agenda inteira nem eventos de toda a semana por faixa de datas.
- Trocar grupo na interface não aciona OAuth nem sincronização automaticamente.
- Testar com respostas simuladas, incluindo conflito de ID/atualização. Integração real e escrita no Google dependem de autorização específica posterior.

## 10. Compatibilidade, ativação, migração e retorno

### 10.1 Implantação aditiva

1. Implementar normalizadores puros e testes de legado. Não disparar escrita ao ler dados antigos.
2. Entregar consumidores e escritores conscientes do grupo antes de ativar dois grupos em um ambiente real.
3. Preparar ferramenta de inventário/ensaio para medir documentos sem grupo, referências existentes e mudanças propostas, usando inicialmente fixtures/exportação local.
4. Na ativação autorizada, fixar `grupoLegadoId`, preservar configurações portuguesas e criar configuração espanhola sem inventar reuniões ou participantes.
5. Campo ausente de participação já produz PT marcado/ES desmarcado em leitura. Uma eventual materialização em massa é opcional, separada e explicitamente autorizada; salvar um cadastro deve preservar os valores existentes.
6. Regravar programas antigos apenas conforme a estratégia aprovada, preservando IDs, dados e referências. Migração deve ser idempotente, resumível e não resetar seleções espanholas já feitas.
7. Republicar projeção completa dos dois grupos somente após validação e autorização para o ambiente alvo.

Se o inventário encontrar uma instalação legada somente em espanhol ou registros cuja origem seja ambígua, não reclassificar silenciosamente como português; registrar a inconsistência e obter a definição para esses dados. Para o cenário desta conversa, o contrato inicial é todos os cadastros PT e nenhum ES.

### 10.2 Clientes antigos e consistência

A substituição integral de programações por clientes antigos pode apagar campos novos. O PWA não atualiza automaticamente todos os clientes. Antes de ativar o novo modelo remoto, estabelecer uma barreira compatível: clientes antigos devem ser impedidos de gravar documentos v2 sem preservar identidade/campos obrigatórios, com regras revisadas e fluxo visível para atualizar o app.

Testar atualização do PWA, duas abas, erro de publicação e reconexão sem presumir que o cache atual oferece garantias de persistência offline. Nenhuma gravação offline antiga pode reclassificar ou substituir um programa do outro grupo. Bloquear ativação real se essa condição ainda não tiver solução validada.

### 10.3 Segurança e regras

- Participação em grupo é regra de negócio para administradores autorizados, não um novo mecanismo de autenticação.
- Não ampliar os leitores públicos das coleções existentes.
- Ajustar listas de campos para identidade v2, preservando criação/resposta v1 quando necessário.
- Validar grupo/identidade imutáveis nas operações cabíveis e impedir escrita v2 degradada por cliente antigo.
- Exercitar regras no emulador para leitura do quadro, confirmação pública válida, tentativas de mudar identidade/dono/grupo e acesso privado indevido.
- Se Rules novas forem necessárias, publicação de Hosting sozinha não comprova funcionamento do fluxo completo.

### 10.4 Retorno seguro

- Backup/exportação e ensaio precedem qualquer migração remota autorizada.
- Cancelar a ativação preserva dados adicionados; não excluir espanhol nem seus vínculos para simular retorno.
- Não reverter para bundle antigo que desconhece e sobrescreve o esquema novo. O retorno deve usar versão compatível, com a funcionalidade desativada, ou restauração controlada dos dados afetados.
- Guardar inventário de IDs antigos, marcadores de versão e referências de confirmação/agenda. Mudança de grupo principal nunca serve como ferramenta de migração ou retorno.

## 11. Organização sugerida do código

Os nomes abaixo são proposta de implementação; ajustar ao padrão real do checkout sem criar abstrações duplicadas.

| Módulo | Responsabilidade |
| --- | --- |
| `src/config/appConfig.js` | Configuração versionada, compatibilidade e metadados de idioma |
| `src/utils/gruposProgramacao.js` (novo) | Grupo efetivo, participação, configuração do grupo e seletores puros |
| `src/utils/ocorrenciasReuniao.js` (novo) | Reuniões ativas, datas/horários, geração finita e cancelamentos |
| `src/utils/assignmentIdentity.js` (novo) | Identidade compartilhada v1/v2 e metadados de designação |
| `src/hooks/useGrupoAtivo.js` (novo) | Preferência local, fallback e troca de contexto |
| `src/components/SeletorGrupo.jsx` (novo) | Controle reutilizado no topo e no quadro |
| `src/App.jsx` | Orquestração do grupo, lista completa e ações de persistência |
| `src/hooks/useGerenciadorDados.js` | Persistência preservando escopo, identidade e campos |
| `src/components/Configuracoes.jsx` | Grupos, principal, identificação e configuração independente das reuniões |
| `src/components/ListaAlunos/*` | Participação e filtro sem duplicação de cadastro |
| `src/components/Designar/*` | Agendamento sem importação, rascunhos, reuniões habilitadas e elegibilidade |
| `src/components/Importador/*` | Fonte do grupo, escopo e atualização parcial segura |
| `src/components/Dashboard.jsx` | Indicadores/eventos do grupo e links de navegação com escopo |
| `src/components/Sidebar.jsx`, `NotificationBell.jsx` | Navegação e contexto correto de alertas |
| `src/components/QuadroPublico.jsx`, `useQuadroPublico.js` | Seleção pública e consumo da projeção |
| `src/components/RevisarEnviar/*`, `src/utils/revisarEnviar/*` | Impressão, mensagens, histórico e seleção por grupo |
| `src/services/confirmacoesPublicas.js`, `ConfirmacaoPublica.jsx` | Tokens compatíveis e idioma/identidade do alvo |
| `src/services/calendarSync.js` | Ocorrências independentes e identidade da agenda |
| `src/i18n/index.js` | Novos textos PT/ES sem strings estruturais traduzidas |
| `firestore.rules` | Contratos v1/v2, espelhos e proteção de identidade |
| `scripts/test-multi-idiomas.mjs` (novo, ou suíte equivalente) | Regressões de domínio sem banco real |

Não introduzir novas dependências apenas para executar os testes de helpers se os recursos do projeto/Node forem suficientes. Não tocar no Worker de importação sem evidência de necessidade; a mudança principal é de domínio/frontend, não uma tarefa de infraestrutura Cloudflare.

## 12. Etapas e critérios de conclusão

Implementar em entregas pequenas. Em cada etapa, registrar arquivos alterados, comandos executados, resultados e limitações neste documento. Uma etapa não termina só porque os componentes renderizam; seus critérios devem estar atendidos. Não publicar nem migrar remotamente para demonstrar progresso local.

| Etapa | Escopo | Critério para concluir |
| --- | --- | --- |
| E1 — Fundação compatível | Normalização de grupos/participação, grupo legado fixo, reuniões ativas, identidade por grupo e testes puros | Legado PT permanece válido; mesmo período PT/ES tem identidades diferentes; fallback não produz ES participante; normalização não escreve |
| E2 — Dados e contexto administrativo | Escritas por ID/escopo, configuração de grupos, seletor, proteção de seleção e cadastro de participação | Editar um grupo preserva integralmente o outro; troca não salva configuração nem publica; formulários e ações assíncronas mantêm destino |
| E3 — Reuniões independentes | Criar fim de semana, frequências por tipo, gerador de rascunhos e importação compatível | ES funciona sem apostila; repetição da geração não duplica; cancelamento persiste; importar meio de semana preserva fim de semana |
| E4 — Operação das designações | Elegibilidade em todos os caminhos, indicadores/eventos, conflitos e histórico com escopo | Ninguém ES até marcação; habilitações mantidas; histórico PT não some ao sincronizar ES |
| E5 — Quadro e impressão | Projeção explícita, seletor público, preferência e impressão de fim de semana isolado | Sem reunião fantasma; duas programações no mesmo link; sem contatos privados; PDF de fim de semana útil |
| E6 — Integrações e Rules | Identidade central de mensagens, confirmação v1/v2, alertas e agenda com adaptadores simulados | Links antigos mantidos; tokens ES não resolvem PT; agenda não sobrescreve outro grupo; testes de regras passam |
| E7 — Aceite e preparação de ativação | Regressão integrada, ensaio de migração, proteção de clientes antigos, evidências e roteiro de liberação | Matriz abaixo atendida e riscos pendentes explícitos; nenhuma operação remota executada sem autorização |

E1 deve estabelecer os contratos para E2–E6 sem migrar a interface ou ativar os dois grupos automaticamente. E2 não libera uso remoto do recurso antes de E6/E7. Durante etapas intermediárias, manter o caminho atual funcional e não expor ações incompletas como prontas para produção.

### Estado de execução

- [x] Plano consolidado em 24/10/2026.
- [x] E1 — Fundação compatível (local; limitações abaixo).
- [x] E2 — Dados e contexto administrativo (ensaio local; liberação remota bloqueada).
- [x] E3 — Reuniões independentes (local; aceite visual parcial, descrito abaixo).
- [x] E4 — Operação das designações (ensaio local; evidência visual parcial descrita abaixo).
- [x] E5 — Quadro e impressão (local; PDF renderizado conferido).
- [x] E6 — Integrações e Rules (simuladores locais; Rules no emulador demonstrativo).
- [x] E7 — Regressão, ensaio de migração e preparação local concluídos.
- [x] Ativação remota em rvm-sbssc — Backup integral, inventário real, migração atômica de 15 escritas, deploy de Rules e Hosting, e verificação de endpoints públicos concluídos.

### Resultado da E1 — 24/10/2026

Inspeção anterior à edição: plano completo, planos de fim de semana e habilitações, `git status --short`, diffs de trabalho e index. Não foram encontrados arquivos `AGENTS.md` no repositório ou nos diretórios ancestrais; aplica-se a instrução fornecida pelo usuário sobre interromper a validação no primeiro erro do navegador. O status inicial continha somente este plano não rastreado, sem hunks rastreados ou staged. O código de habilitações e `scripts/test-o-que-voce-diria.mjs` já estavam presentes e foram preservados sem alterações.

Arquivos da entrega:

| Arquivo | Resultado |
| --- | --- |
| `src/utils/gruposProgramacao.js` | Projeção pura e opt-in da configuração versionada, grupo efetivo/legado fixo, defaults PT/ES, eventos por grupo e normalização de participação. Preserva campos desconhecidos e escolhas explícitas; array vazio não recebe fallback. Novo cadastro tem helper de padrão PT, independentemente do idioma/principal. |
| `src/utils/ocorrenciasReuniao.js` | Normalização de ocorrência e seleção operacional/pública por grupo, habilitação do tipo, atividade e cancelamento. Meio de semana legado continua ativo sem depender de partes; v2 exige atividade explícita. Rascunho v2 não é público; ocorrência explícita prevalece sobre horário padrão. Fim de semana pode ser analisado sem partes/apostila. |
| `src/utils/programacoes.js` | Identidade v2 determinística por grupo e segunda-feira ISO; IDs explícitos e formato/hash legados preservados. Reconciliação e comparador limitados ao grupo efetivo; ID explícito pertencente a outro grupo é recusado. |
| `src/App.jsx` | Substitui apenas o comparador duplicado do importador pelo helper central, mantendo o fluxo atual de confirmação de duplicidade. |
| `scripts/test-multi-idiomas.mjs` | 21 regressões locais com fixtures congeladas, snapshots e expectativas de compatibilidade, sem Firebase ou dependências novas. |
| `docs/plano-multi-idiomas-simultaneos.md` | Estado, evidências, decisões e continuação da E1. |

Decisões técnicas da fundação:

- `normalizeSystemConfig` e o hook de dados atuais não passam a materializar grupos. `normalizeGruposProgramacao` é uma projeção de leitura separada; **não deve ser gravada automaticamente** por consumidores antigos. Nenhuma tela ativa dois grupos por causa desta entrega.
- Registro sem grupo continua no `grupoLegadoId`, com padrão fixo português, nunca no principal. Instalação legada em espanhol sem definição explícita de `grupoLegadoId` é recusada pelo novo normalizador, sem reclassificação silenciosa. Esse inventário/decisão permanece obrigatório antes de eventual ativação.
- Novo formato de ID é usado quando existe `grupoId` explícito ou `versaoProgramacao >= 2`. O caminho antigo sem esses campos mantém seus IDs, inclusive o hash anterior para registros sem data. Semana v2 sem ID exige data ISO válida; somente no cálculo da identidade, a data é reduzida à segunda-feira usando UTC, sem alterar as datas armazenadas. Pode usar a data explícita do fim de semana se não houver data semanal.
- Duplicata de ID explícito ou ID v2 gera conflito, em vez de renomear silenciosamente um documento e perder seus vínculos. A compatibilidade de IDs aleatórios para cópias legadas sem identidade explícita continua existente. A proteção não constitui a API de escrita por escopo da E2.
- `ativo` descreve a ocorrência; `operacional` acrescenta grupo/tipo habilitados e cancelamento; `publica` acrescenta publicação e ausência de arquivamento. Arquivamento preserva os dados para consulta histórica. O helper não infere atividade de `partes.length`, não gera recorrências e não calcula datas a partir de títulos traduzidos.

Verificação executada com Node `v24.11.1`:

| Comando | Evidência |
| --- | --- |
| `node --test scripts/test-multi-idiomas.mjs` | **21/21 passaram**: PT inicial, vazio explícito, participação simultânea sem ampliar habilitações, legado fixo mesmo com troca do principal, defaults espanhóis, tipos/frequência independentes, fim de semana sem importação, inatividade/publicidade, identidade PT/ES e proteção de IDs/vínculos. |
| `node --test scripts/test-o-que-voce-diria.mjs` | **22/22 passaram**, incluindo importações de texto/HTML PT e ES e as restrições existentes da parte. |
| `npm.cmd run lint` | Falha **preexistente**, reproduzida antes e depois com saída idêntica: 2 erros `react-hooks/immutability` em `src/components/DialogModal.jsx` (uso de `handleCancel`/`handleConfirm` antes da declaração) e 1 aviso `react-hooks/exhaustive-deps`. Fora do escopo; arquivo preservado. |
| `npx.cmd --no-install eslint src/utils/gruposProgramacao.js src/utils/ocorrenciasReuniao.js src/utils/programacoes.js src/App.jsx` | Passou, sem erros ou avisos nos arquivos JS/JSX da E1. |
| `npm.cmd run build` | Passou, incluindo geração local do service worker/PWA. Versão mantida em `6.0.304`. |
| `git diff --check` | Passou. |

Limitações e fronteira de aceite: somente evidência de domínio/testes e build locais. Não houve validação no navegador, emulador, Android ou ambiente publicado. Os helpers de participação e reuniões ainda não são filtros de todos os consumidores: telas, escritas, quadro, impressão, histórico, mensagens, confirmações e agenda serão adaptados nas respectivas etapas. A existência das fixtures v2 **não autoriza usar/ativar dados v2 no ambiente real**. Vínculos legados foram preservados nas fixtures e nos helpers de identidade; resolução ponta a ponta de tokens/agenda pertence à E6. Não foram executados deploy, migração, acesso/escrita remota, envios reais, commit/push ou incremento de versão.

**Ponto de continuação registrado ao concluir a E1 (atendido pela E2 abaixo):** introduzir operações por ID/grupo sobre a lista completa, com preservação de campos/identidade e do outro grupo; depois integrar configuração, contexto administrativo e participação nos cadastros. Reutilizar os helpers da E1, proteger seleção/formulários e capturar o destino das ações assíncronas. Não persistir a projeção de leitura pelo escritor antigo nem ativar uso remoto antes das proteções de E6/E7.

### Resultado da E2 — 24/10/2026

O usuário autorizou seguir após a conclusão da E1. O checkout foi novamente conferido antes das edições: continha apenas os arquivos da E1 e o plano não rastreado; suas alterações foram preservadas. A E2 não equivale à ativação de dois grupos no Firebase ou à liberação de operações das etapas seguintes.

| Arquivo | Entrega da E2 |
| --- | --- |
| `src/utils/programacoesPorGrupo.js` | Operações por ID/grupo sobre a fonte completa: upsert, patch, arquivamento/restauração e exclusão explícita; validação de identidade, colisão semanal e movimentação entre semanas. Merge de objetos preserva campos desconhecidos; arrays são substituições explícitas. Adaptador da lista visível nunca interpreta omissão como exclusão. Controller com adaptadores injetáveis serializa gravações e distingue falha de gravação de falha posterior de publicação. |
| `src/utils/grupoAtivo.js`, `src/hooks/useGrupoAtivo.js` | Preferência por dono em `rvm_grupo_ativo:v2:{ownerUid}`; fallback preferência ativa → principal ativo → primeiro ativo; armazenamento opcional. Projeção de configuração para apresentação, separada da configuração persistida. |
| `src/components/SeletorGrupo.jsx` | PT/ES compacto no celular e nomes completos/acessíveis, sem bandeiras, próximo de Ver quadro. Selecionar altera contexto/idioma, sem salvar configuração nem publicar. |
| `src/components/ConfiguracoesGrupos.jsx` | Formulário com salvar/descartar explícitos para principal, nome, identificação e configurações independentes de cada tipo de reunião. Valida dia/horário na frequência semanal. Mudar o padrão não recalcula ocorrências. Espelhos gerais são atualizados somente para o grupo legado, nunca para o grupo em foco. |
| `src/hooks/useProtecaoTrocaGrupo.js`, `src/App.jsx` | Proteção de troca de contexto, seleção/expansão/filtros reiniciados por grupo e destino capturado pelos callbacks. Bloqueio de novas operações enquanto outra está pendente. Lista visível separada da lista completa; persistência e republicação explícita do ensaio partem da fonte completa. |
| `src/components/ListaAlunos/index.jsx`, `ModalFormulario.jsx` | Cadastro compartilhado, filtro opcional de participação e checkboxes independentes. Novos alunos começam PT mesmo em ES; edição respeita ausência legada e array vazio. Mantém habilitações e a proteção existente de salvar/descartar ao sair; bloqueia submit duplicado. O cadastro continua acessível em ES sem participantes. |
| `src/components/Designar/index.jsx` | Registra proteção dos editores na troca de contexto; aguarda a gravação antes de republicar e de fechar editores de parte/semana. Mantém o formulário aberto quando a gravação falha. Nenhuma regra de elegibilidade/habilitação foi ampliada. |
| `src/config/multiGruposLocal.js`, `src/data/ensaioGrupos.js` | Barreira `DEV` + flag explícita e fixtures descartáveis de configuração, aluno PT e semanas PT/ES no mesmo período. |
| `src/hooks/useGerenciadorDados.js`, `src/services/firebase.js` | Adaptador de dados em memória para o ensaio, sem listeners de Auth/Firestore nem escritas remotas; instância Firebase fictícia separada das credenciais/sessões reais. Lote multi-grupos remoto permanece bloqueado. Fora do ensaio, a fonte e a autenticação atuais permanecem no caminho legado. |
| `src/i18n/index.js` | Textos novos PT/ES no provider existente. |
| `scripts/test-multi-idiomas-e2.mjs` | 15 testes de operações, preservação, configuração, armazenamento, falhas, concorrência e renderização SSR de seletor/configuração/cadastro PT/ES. |

Decisões e limites técnicos:

- A E2 é testável com **dados fictícios em memória**, restaurados ao recarregar ou reiniciar o componente durante HMR; somente a preferência de grupo é persistida no navegador. Essa persistência em memória não é garantia de durabilidade/offline. Nenhum cadastro real foi lido ou alterado para testar.
- O ensaio requer `import.meta.env.DEV` e `VITE_MULTI_GRUPOS_LOCAL=true`. `build`/`preview` não habilitam o ensaio, mesmo recebendo a flag. Não há novo bypass de autenticação no bundle publicado. Essa barreira local não substitui as Rules, o inventário e a proteção de clientes antigos de E6/E7.
- Quadro, confirmação pública, importação e Revisar/Enviar ficam indisponíveis no ensaio. Dashboard/Designar ES informam a continuação pendente em E3/E4, sem apresentar as operações incompletas ou reunião fantasma como prontas. O caminho legado desses componentes permanece disponível fora do ensaio. O cadastro e a configuração por grupo são utilizáveis no ensaio.
- Participação é apenas cadastro nesta etapa; aplicar elegibilidade em todos os caminhos, avisar sobre atribuições de quem saiu do grupo e reconstruir histórico com escopo continua na E4. Os consumidores públicos e integrações ainda não foram adaptados para uso real com grupos.
- IDs existentes, inclusive documentos legados sem `grupoId`, não são renomeados. Se uma operação explícita acrescentar identidade v2 a um registro legado, preserva a atividade anterior de meio de semana e sua semântica de publicação. Exclusão explícita do ensaio não faz limpeza de histórico por intervalo; isso evita apagar histórico de outro grupo e mantém a adaptação definitiva na E4.
- A API de domínio e os testes de publicação usam snapshots completos. A projeção pública com allowlist e a persistência remota transacional precisam das etapas futuras; não se deve conectar esses snapshots ao publicador real antes delas. Falha posterior de publicação retorna `salvo: true`, `publicado: false` e o erro, sem anunciar sucesso completo nem descartar os dados salvos.
- No cadastro, tentar sair com alterações aciona o diálogo já existente. Depois de salvar ou descartar o cadastro, a troca de grupo pode ser solicitada novamente. A configuração tem confirmação própria antes de trocar e proteção ao fechar/recarregar a página.

Para abrir o ensaio local em outro terminal PowerShell, sem alterar arquivos `.env`:

```powershell
$env:VITE_MULTI_GRUPOS_LOCAL = 'true'
npm.cmd run dev -- --host 127.0.0.1 --port 5177 --strictPort
```

Abrir `http://127.0.0.1:5177/admin`. Para voltar ao modo normal, encerrar esse servidor e remover a variável do terminal com `Remove-Item Env:\VITE_MULTI_GRUPOS_LOCAL` antes de iniciar novamente. Nenhuma credencial ou configuração real é necessária no ensaio.

| Verificação da E2 | Resultado |
| --- | --- |
| `node --test scripts/test-multi-idiomas.mjs scripts/test-multi-idiomas-e2.mjs scripts/test-o-que-voce-diria.mjs` | **58/58 passaram**: E1 21 + E2 15 + habilitações 22. Adaptadores simulados provam preservação de PT ao editar/arquivar/excluir ES, campos desconhecidos, IDs/vínculos, publicação do conjunto completo, falha sem publicação, falha parcial e operação pendente com grupo/IDs fixos e clique duplicado recusado. |
| `npm.cmd run lint` | Mantém somente os mesmos **2 erros e 1 aviso preexistentes** em `DialogModal.jsx`, com saída idêntica ao baseline da E1. Nenhum novo problema. |
| ESLint nos arquivos JS/JSX alterados da E2 | Passou sem erros/avisos. |
| `npm.cmd run build` com a flag de ensaio definida | Passou; geração local PWA/service worker; versão mantida em `6.0.304`. Projeto/chave fictícios do ensaio ausentes dos assets de produção. |
| `git diff --check`; diffs de `package.json`/`package-lock.json` | Sem problemas de whitespace; manifest/lock inalterados. |
| Navegador local em `127.0.0.1:5177` | Primeira tentativa exibiu tela vazia: validação interrompida e ajuda solicitada. O usuário informou que abriu ao lado; a inspeção continuou na mesma aba, sem recarregar/trocar navegador/redimensionar. Confirmados seletor PT/ES e tradução, confirmação de saída de configuração (cancelar preserva edição; descartar troca), edição ES preservando configuração PT, novo cadastro na interface ES com PT marcado/ES desmarcado, marcação simultânea, salvar/reabrir ambas e salvar/reabrir array vazio, além do diálogo de saída do cadastro. |

Evidências visuais locais: `C:/Users/mayco/.codex/visualizations/2026/10/24/01a16d8e-340a-7c43-ac54-1430c7170433/e2-cadastro-espanhol.png` (padrão de participação) e `e2-configuracao-espanhol.png` no mesmo diretório (configuração ES). O viewport existente era estreito, com seletor compacto PT/ES; não foi redimensionado. Isso não comprova aceite Android/WebView/dispositivo físico, PWA publicado, Rules ou integrações reais.

**Ponto exato de continuação — E3, somente após nova solicitação:** implementar criação manual de fim de semana sem apostila, frequência por tipo e geração finita/idempotente de rascunhos, cancelamentos e importação de meio de semana com preservação do fim de semana/identidade/publicação. Reutilizar o controller por grupo da E2 e seu adaptador local; remover os bloqueios de interface somente conforme os consumidores fiquem prontos. Preservar datas explícitas e recusar conflitos em vez de sobrescrever. Não iniciar E4–E7 ou conectar uso remoto automaticamente.

Não houve deploy/publicação de Rules, migração/escrita remota, envio real, commit/push ou incremento de versão nesta etapa. O servidor de ensaio local foi deixado disponível para inspeção.

### Resultado da E3 — 24/10/2026

Autorização explícita para implementar somente a E3 localmente. Antes de editar, foram relidos integralmente este plano e os planos de fim de semana/habilitações, conferidos status, diffs/hunks e index. Não foram encontrados `AGENTS.md` no repositório ou ancestrais; respeitada a instrução direta de parar no primeiro erro de validação no navegador. O checkout continha E1/E2 locais, inclusive arquivos não rastreados. Os arquivos de cadastro, Designar legado, Firebase, identidade E1 e os testes de habilitação foram preservados; não houve reset/stash/reversão das alterações anteriores.

| Arquivo | Entrega específica da E3 |
| --- | --- |
| `src/utils/agendamentoReunioes.js` | Preparação pura de agendamento por data/horário, prévia/geração semanal finita, importação parcial de meio de semana, ativação explícita, cancelamento inativo e edição dos campos manuais do discurso. Uma ocorrência de cada tipo por grupo/semana; conflitos recusados. |
| `src/utils/programacoesPorGrupo.js` | Controller E2 aceita preparação avaliada dentro do bloqueio de gravação, usando a fonte completa e a configuração atual. A confirmação não reaplica operações calculadas a partir de uma prévia obsoleta. Demais contratos da E2 preservados. |
| `src/utils/ocorrenciasReuniao.js` | Marca opcional `publicadaNoQuadro: false` no bloco impede que uma ocorrência nova herde publicação de uma semana já publicada. Ausência desse campo mantém a semântica anterior. Expõe o estado `publicada` além de `publica` operacional. |
| `src/components/ReunioesIndependentes.jsx` | Área de agendamento em Designar no ensaio: data/horário explícitos, frequência semanal configurada com intervalo/prévia, estados existentes/conflitos/eventos/cancelamentos, ativação, cancelamento confirmado e tema/orador manual/congregação. Área de importação local com texto/HTML colado e lista de partes para revisão. Usa parser atual no idioma do destino; sem catálogo, fetch externo ou hook de dados próprio. Proteção de saída e cliques duplicados. |
| `src/App.jsx`, `src/components/Sidebar.jsx` | Montam somente as ações E3 completas atrás da barreira DEV + flag da E2. Importação oculta se meio de semana estiver desabilitado. Dashboard e Designar operacional legados não são expostos no ensaio de nenhum grupo; quadro, impressão e integrações continuam bloqueados. Fora do ensaio, o caminho legado é mantido. |
| `src/components/Importador/index.jsx`, `RevisarImportacao.jsx` | Removidos hooks próprios que liam o contexto geral. Recebem configuração e programações explicitamente do pai; revisão aguarda a conclusão do callback. O importador de catálogo continua no caminho legado; o ensaio usa somente extração local. |
| `src/data/ensaioGrupos.js`, `src/hooks/useGerenciadorDados.js` | Fixtures-base da E2 inalteradas; fábrica adicional E3 inclui cancelamento e assembleia ES. Adaptador em memória da E2 usa essa fábrica no ensaio, mantendo a barreira contra acesso remoto. |
| `src/i18n/index.js` | Textos de agendamento/prévia/rascunhos/cancelamento/importação em PT/ES no provider existente. Identificação espanhola continua “Pré-grupo / Grupo de espanhol”. |
| `scripts/test-multi-idiomas-e3.mjs` | 20 regressões adicionais, incluindo parser real PT/ES, fonte congelada, preservação de documento/vínculos, grupo legado fixo, prévia obsoleta, publicação por ocorrência e renderização SSR das ações disponíveis. |

Decisões e limites:

- Datas são ISO locais, tratadas como datas civis com aritmética de calendário em UTC, sem conversão do horário da reunião para o fuso do computador. Horário exige `HH:mm`. Nenhum padrão espanhol foi inventado. A identificação não impõe frequência nem habilitação; o formulário de configuração E2 já permite semanal/datas independentemente em ambos os tipos.
- Agendar manualmente funciona sem apostila nem meio de semana. A geração aceita intervalo inclusivo de até **367 dias por lote** como limite técnico de prévia, sem teto mensal de reuniões. Novos lotes podem continuar o intervalo; não há cron, geração infinita ou publicação automática.
- Novos documentos e blocos são rascunhos inativos. Ativação é uma ação separada e não publica. Adicionar um tipo a uma semana publicada mantém o campo superior e a publicação anterior; o bloco novo recebe `publicadaNoQuadro: false`. E5 deverá respeitar esse campo e definir a publicação explícita por ocorrência, sem degradar documentos legados.
- Geração só acrescenta datas faltantes. Ocorrências existentes, com designações, canceladas ou arquivadas são preservadas; outra data do mesmo tipo na mesma semana aparece como conflito e não gera operação. Os demais itens válidos do lote podem ser confirmados. Repetir o lote não modifica os já existentes. Cancelamento mantém bloco, data, conteúdo e vínculos, com `ativo: false` e `cancelada: true`; não há ação de reabrir nesta etapa.
- Eventos vêm somente de `grupos[grupoId].eventosAnuais` após normalização E1. Assembleia/congresso bloqueia a criação/importação/ativação no destino; visita acompanha a ocorrência em `eventoEspecial` e aparece na prévia semanal. Datas/horários explicitamente informados não são movidos automaticamente por visita ou por alteração de configuração. E4 ainda adaptará indicadores/eventos operacionais.
- Importar preenche conteúdo de uma ocorrência vazia do destino, preservando `fimDeSemana` completo, ID, publicação, campos desconhecidos e metadados/designados superiores. Datas/horários explícitos existentes prevalecem. Payload não pode trocar grupo/ID/semana nem restaurar cancelada/arquivada. O domínio recusa importação desabilitada, além de ocultá-la na interface.
- Reimportação de partes exatamente iguais é no-op. Conteúdo diferente em uma ocorrência já preenchida é recusado para revisão explícita, evitando descartar designações ou vínculos por novos IDs de parser. Não foi criado modo de sobrescrita silenciosa, cópia da segunda reunião na mesma semana ou movimentação de ocorrências entre semanas.
- Os slots de pessoas/apoio existentes são reutilizados no bloco de dados e preservados. A E3 libera edição de tema, orador manual e congregação; seleção/sugestão/arrastar pessoas, revisão de elegibilidade, carga entre grupos e histórico aguardam E4. Nenhuma habilitação foi acrescentada ou alterada; os padrões de participação PT marcado/ES desmarcado e a participação simultânea da E2 continuam válidos.
- O ensaio permanece descartável em memória, sem garantia de durabilidade/offline. Nenhum dado real foi lido ou escrito para validá-lo. Produção, Rules, integrações e consumidores públicos ainda não estão liberados para grupos.

| Comando/verificação | Resultado E3 |
| --- | --- |
| `node --test scripts/test-multi-idiomas.mjs scripts/test-multi-idiomas-e2.mjs scripts/test-o-que-voce-diria.mjs` antes de editar | **58/58 passaram**, reconfirmando E1/E2/habilitações. |
| `node --test scripts/test-multi-idiomas.mjs scripts/test-multi-idiomas-e2.mjs scripts/test-multi-idiomas-e3.mjs scripts/test-o-que-voce-diria.mjs` | **78/78 passaram**: E1 21 + E2 15 + E3 20 + habilitações 22. |
| `npm.cmd run lint` antes/depois, comparado com `Compare-Object` | Saídas idênticas: somente **2 erros e 1 aviso preexistentes** em `DialogModal.jsx` (`react-hooks/immutability`, `react-hooks/exhaustive-deps`). Arquivo preservado. |
| `npx.cmd --no-install eslint` nos arquivos JS/JSX específicos alterados da E3 e no novo script | Passou sem erros/avisos. |
| `npm.cmd run build` com `VITE_MULTI_GRUPOS_LOCAL=true` | Passou; build/PWA gerados localmente. Versão continua **6.0.304**. A flag não habilita o ensaio no build de produção. |
| Busca nos assets por `fake-api-key-ensaio-local`, `demo-rvm-ensaio-e2`, `fixture-es-cancelada` | Ausentes; fixtures/credenciais fictícias não ativadas no bundle de produção. Textos de tradução podem permanecer no dicionário comum. |
| `git diff --check`; diffs de manifest/lock, plano de habilitações e código/testes de “O que você diria?” | Sem problemas de whitespace; esses arquivos permanecem inalterados em relação ao checkout inicial. |
| Navegador local `http://127.0.0.1:5178/admin` | Abertura funcionou. Confirmados seletor/contexto ES, rótulo espanhol, importação oculta, formulário data/horário, ocorrência existente e cancelamento fictício. Na primeira tentativa de preenchimento automático (`2026-12-06`, `10:45`), a prévia retornou “Informe horário válido (HH:mm)”. Validação imediatamente interrompida e ajuda solicitada; sem recarregar/trocar navegador/redimensionar ou insistir. Fluxo visual de gravação/geração/importação permanece **sem aceite**, apesar das regressões de domínio/SSR passarem. Não foi atribuída causa ao erro sem comprovação. |

Durante as regressões, um teste novo detectou que a importação num agregado apenas de fim de semana herdava indevidamente a segunda-feira como data do meio de semana. Corrigido para usar a data explicitamente informada quando ainda não existe aquela ocorrência; o caso permanece coberto pelo teste de preservação da importação ES.

Servidor de desenvolvimento E3 deixado em `127.0.0.1:5178`, com `VITE_MULTI_GRUPOS_LOCAL=true`, para assistência manual. Início reproduzível: `$env:VITE_MULTI_GRUPOS_LOCAL='true'` e `npm.cmd run dev -- --host 127.0.0.1 --port 5178 --strictPort`. Recarregar restaura as fixtures; apenas preferência local de grupo persiste. Nenhum aceite Android/WebView, dispositivo físico, ambiente publicado, Rules ou provedor foi obtido.

**Ponto exato de continuação — E4, somente após nova solicitação:** manter o controller E2, as preparações E3 e as barreiras locais. Primeiro fechar a pendência visual com ajuda do usuário, sem retomar automaticamente a tentativa interrompida. Em seguida, adaptar Designar/sugestões/arrastar/substituições para participação + habilitação existente, preservando “O que você diria?”, incluir carga/conflitos entre grupos e indicadores/eventos do destino, e reconstruir histórico com escopo de grupo/programação/tipo. Só liberar esses caminhos no ensaio à medida que ficarem completos. E5 deverá consumir a marca de rascunho por ocorrência. Não iniciar quadro/impressão/integrações/Rules/ativação remota como parte da E4 sem seu escopo próprio. **E4 não implementada nesta entrega.**

Não houve deploy, migração/escrita remota, publicação de Rules, envio real, commit/push ou incremento de versão.

### Resultado da E4 — 24/10/2026

O usuário autorizou explicitamente “pode seguir para o e4”. Status e contratos foram novamente conferidos no checkout, que ainda continha E1/E2/E3 locais. Nenhuma alteração anterior foi revertida. A instrução de interrupção da validação no primeiro erro continua válida. E5 não foi iniciada; nenhum consumidor público, impressão, envio, confirmação ou agenda por grupo foi liberado.

| Arquivo | Entrega específica da E4 |
| --- | --- |
| `src/utils/designacoesPorGrupo.js` | Catálogo dos slots existentes por tipo, elegibilidade composta com cadastro atual/participação/habilitação/gênero/disponibilidade, preparação única de atribuição/substituição/remoção, conflitos e classificação dos candidatos. Reconstrução de histórico por grupo/programação/tipo e eventos com escopo de grupo. |
| `src/components/Designar/DesignacoesGrupo.jsx` | Operação por grupo dentro de Designar no ensaio: seleção manual, clique em sugestão, arrastar e substituição passam pela mesma preparação de domínio. Slots existentes sem participação/habilitação/disponibilidade atual permanecem visíveis com aviso para revisão. Mostra carga na semana e carga ativa total entre grupos e data anterior no grupo/função. Seleção vazia ES oferece cadastro, sem fallback para participantes PT. |
| `src/components/PainelGrupo.jsx` | Início do ensaio com participantes do grupo, reuniões operacionais, datas/horários explícitos e slots preenchidos. Cadastro de evento da semana somente do grupo em foco. Sincronização local de histórico com escolha explícita de programações e tipos. Sem contagem de meio de semana fantasma para grupo só de fim de semana. |
| `src/utils/ocorrenciasReuniao.js` | Assembleia/congresso do próprio grupo (ou impedimento já presente na programação) remove a ocorrência da seleção operacional, preservando bloco/atividade/designados/datas e histórico. Visita é informação contextual; não move ocorrências existentes. |
| `src/utils/revisarEnviar/historico.js` | `addHistorico` compara IDs como strings exatas, sem coerção numérica; preserva metadados da entrada; deduplica considerando identidade de grupo/programação/tipo/slot/papel quando presente, além dos campos anteriores. O contrato v1 sem metadados permanece compatível. |
| `src/utils/programacoesPorGrupo.js` | Preparação no controller recebe também os alunos atuais. Uma pessoa retirada do grupo ou com habilitação alterada depois da seleção é revalidada no momento da gravação. Exclusão mútua e preservação da fonte completa da E2 mantidas. |
| `src/hooks/useGerenciadorDados.js`, `src/App.jsx` | Adaptador de histórico estritamente local em memória, protegido pela barreira DEV/flag da E2; mantém os demais campos dos alunos. Orquestra painel, eventos e Designar E4 com destino capturado e proteção de operações pendentes. Lista completa continua fonte de gravações e cálculo de carga entre grupos. |
| `src/i18n/index.js` | Mensagens de operação, avisos, carga, eventos e histórico em PT/ES, mantendo o provider existente. |
| `scripts/test-multi-idiomas-e4.mjs` | 22 regressões de domínio/controller/SSR, somadas às 78 anteriores. |

Decisões de implementação:

- O antigo `Designar/index.jsx`, seu modal/sidebar e o Dashboard legado ainda contêm ações acopladas à publicação, agenda e limpeza de histórico por datas. Para não liberar E5/E6 antecipadamente nem degradar o caminho atual, a operação multi-grupos foi implementada em **`Designar/DesignacoesGrupo.jsx`**, montada somente no ensaio e reutilizando o catálogo de habilitações, classificadores de partes e contratos dos slots existentes. O componente E3 de agendamento permanece na mesma aba. Não se trata da liberação do Designar legado para dados v2 remotos.
- `prepararAtribuicaoGrupo` é a única preparação usada por seleção manual, sugestões, arrastar, substituição e remoção no ensaio. Ela recebe o cadastro completo atual do controller, valida identidade do destino e do slot e grava por ID/grupo. O nome/ID armazenados no slot são compactos; habilitações e gênero sempre vêm do cadastro atual. O orador continua exclusivamente manual, fora do catálogo de designados.
- IDs de slots de partes usam o ID da parte e o papel, sem depender da posição do array. Reordenar partes não redireciona uma seleção para outra parte. Substituição/remoção valida também a pessoa anterior esperada, recusando uma seleção obsoleta. Campos desconhecidos, publicação e vínculos anteriores são preservados; registros novos de substituição têm escopo local de grupo/programação/tipo/slot, sem regenerar tokens.
- Participação não amplia habilitações. “O que você diria?” mantém habilitação explícita, ancião/servo e ausência de ajudante; registros antigos indevidos continuam visíveis para revisão/remoção. A dupla de estudante/ajudante respeita gênero mesmo com ID/nome compactos, tanto ao escolher ajudante quanto ao trocar o estudante. Indisponibilidade é verificada na data exata da ocorrência, sem bloquear uma semana inteira por ausência em outro dia.
- Ocupação considera todas as reuniões operacionais da pessoa, em ambos os grupos. Repetição semanal é aviso confirmável. Funções principais no mesmo fim de semana mantêm a possibilidade anterior de exceção explícita confirmada. Sobreposição entre reuniões só é afirmada quando ambas possuem horário e `duracaoMinutos` explícitos; nesse caso é recusada, inclusive atravessando domingo/segunda. Sem duração suficiente, o mesmo dia produz **possível conflito**, sem duração presumida. A UI E3 não inventa durações; podem estar ausentes.
- Sugestões usam participação, habilitação, gênero/cargo, disponibilidade e conflitos do domínio. Preservam a prioridade de menor carga semanal, família não usada e maior intervalo no grupo/função, mantendo estreantes após quem tem histórico conforme o critério anterior. Para função de fim de semana sem histórico sincronizado, também consultam designações anteriores salvas, inclusive arquivadas. A carga ativa total entre grupos é exibida separadamente.
- O histórico novo identifica `grupoId`, `programacaoId`, `tipoReuniao`, `slotId` e `papel`, além de data/parte/ajudante. Reconstruir só remove registros com vínculo exato no grupo/programação/tipo selecionados e só para reuniões operacionais não arquivadas. Canceladas, desabilitadas, arquivadas e histórico realizado associado a elas são preservados. Remover um designado de uma reunião ativa e reconstruir o escopo remove o respectivo registro identificado, sem tocar no outro grupo/tipo.
- Histórico antigo sem `grupoId` é interpretado no grupo legado para rodízio. Sem `programacaoId`/tipo, o vínculo de limpeza é ambíguo: **preserva o registro**, mesmo que esteja na mesma data. A materialização/reconciliação desses vínculos exige o inventário posterior; não foi feita limpeza heurística por faixa de datas. Pode coexistir uma entrada v1 ambígua com uma entrada v2 identificada; as entradas v2 são idempotentes e distintas entre PT/ES.
- Eventos ficam em `grupos[grupoId].eventosAnuais`. Só o grupo legado atualiza também o espelho geral. Assembleia/congresso bloqueia operação sem apagar designados ou mover datas; remover o evento configurado restaura a disponibilidade apenas se não houver impedimento próprio da ocorrência. Visita não aplica mudança automática de dia. `grupoLegadoId`, identificação e configurações dos demais grupos permanecem intactos.
- Novos cadastros continuam PT marcado/ES desmarcado; fixtures não ganharam participantes ES automaticamente. O ensaio continua em memória, sem leitura/escrita de dados reais e sem durabilidade/offline prometida. Quadro, impressão, Revisar/Enviar, confirmações e agenda permanecem bloqueados.

| Verificação | Resultado E4 |
| --- | --- |
| Suítes E1/E2/E3/habilitações reconfirmadas | **78/78 passaram**. |
| `node --test scripts/test-multi-idiomas.mjs scripts/test-multi-idiomas-e2.mjs scripts/test-multi-idiomas-e3.mjs scripts/test-multi-idiomas-e4.mjs scripts/test-o-que-voce-diria.mjs` | **100/100 passaram**: 21 E1 + 15 E2 + 20 E3 + 22 E4 + 22 habilitações. |
| `npm.cmd run lint`, comparado via `Compare-Object` ao baseline | Saída idêntica: somente **2 erros e 1 aviso preexistentes em `DialogModal.jsx`**. Arquivo preservado. |
| `npx.cmd --no-install eslint` nos arquivos JS/JSX específicos alterados da E4 e no novo script | Passou sem erros/avisos. |
| `npm.cmd run build` com `VITE_MULTI_GRUPOS_LOCAL=true` | Passou, incluindo geração local PWA. Versão **6.0.304** mantida. |
| Busca nos assets por credenciais/projeto fictício e fixture cancelada | Ausentes do build de produção. Nenhum bypass novo foi ativado em produção. |
| `git diff --check`; manifest/lock e arquivos de habilitações/teste “O que você diria?” | Sem problemas de whitespace; manifest/lock e habilitações preservados. |
| Nova tentativa de navegador após autorização “abra de novo para testar” | Abertura em `127.0.0.1:5178/admin` funcionou. Confirmados painel ES com **0 participantes/1 reunião ativa**, sem meio de semana operacional; slots de fim de semana e cancelamento preservado; sugestão ES vazia/seleção manual sem opções; troca para PT; sugestão “Pessoa de ensaio” elegível para presidente RVM; atribuição pela sugestão gravada em memória e visível como presidente PT, com opção de substituir/remover. |
| Captura visual após atribuir PT | A ferramenta retornou “Unable to capture screenshot”. Validação imediatamente interrompida; nenhuma repetição, recarga, troca de navegador ou redimensionamento. Ajuda manual solicitada; aba mantida aberta. Não há arquivo de imagem produzido. Evidência acima é de estado acessível/DOM, **não de captura visual ou aceite ponta a ponta**. |

Limitações de validação: seleção manual, arrastar/substituição, eventos e sincronização de histórico têm regressões de domínio/SSR, mas não tiveram seus fluxos completos executados no navegador nesta etapa. O erro anterior de preenchimento de data/horário da E3 continua sem causa/solução visual comprovada; não foi tratado como resolvido por este teste de atribuição. Nenhum teste Android/WebView/dispositivo físico, PWA publicado, Rules, confirmação ou provedor foi realizado.

**Conferência adicional autorizada pelo usuário (“não consegui ver isso, veja vc”):** a aba estava novamente nas fixtures, sem presidente PT. Foi refeita a atribuição fictícia de “Pessoa de ensaio”; após navegar para Início, o painel contou 1 slot preenchido, e ao voltar a Designar o presidente continuava atribuído. A captura pela API `getScreenshot` funcionou nesta tentativa e a aba foi deixada na seção visível de designações, sem recarregar/redimensionar. Evidência: `C:/Users/mayco/.codex/visualizations/2026/10/24/01a16db9-1b9c-7952-990f-4de7814b7814/e4-presidente-pt-confirmado.png`. Isso confirma navegação e retenção na sessão em memória, não persistência após recarga/HMR nem durabilidade remota. Nenhum código foi alterado nesta conferência; permanecem as demais limitações acima.

**Ponto exato de continuação — E5, somente após nova solicitação:** concluir com assistência do usuário as pendências visuais de E3/E4, mantendo a regra de parada no primeiro erro. Implementar a projeção pública com allowlist e seletor de grupo, observando identidade/atividade/habilitação/cancelamento e o rascunho por ocorrência da E3; tornar a impressão de fim de semana isolado funcional sem cabeçalho de meio de semana e preservar os layouts PT. Manter histórico/eligibilidade no domínio E4 e não expor as ações legadas de publicação/integrações ao modelo v2 antes de seus contratos estarem completos. **E5 não implementada nesta entrega.** Não conectar persistência remota ou iniciar E6/E7 automaticamente.

Não houve deploy, migração/escrita remota, publicação de Rules, envios reais, commit/push ou incremento de versão.

### Resultado da E5 — 24/10/2026 (concluída localmente)

Autorização desta solicitação: E5 seguida de E6, sem E7. Inspecionados plano completo, planos de fim de semana/habilitações, status, diffs/hunks e contratos atuais. E1–E4 e habilitação “O que você diria?” preservadas. Baseline reconfirmado: 100 testes; lint com 2 erros e 1 aviso anteriores em DialogModal.jsx; versão 6.0.304.

Arquivos: src/utils/quadroPublico.js, src/utils/impressaoGrupo.js, src/services/quadroLocal.js, src/components/QuadroPorGrupo.jsx, src/components/RevisaoGrupo.jsx, src/components/QuadroPublico.jsx, src/components/RevisarEnviar/index.jsx, src/hooks/useQuadroPublico.js, src/hooks/useGerenciadorDados.js, src/App.jsx; scripts/test-multi-idiomas-e5.mjs e scripts/render-multi-idiomas-e5.mjs; textos de estado em src/i18n/index.js.

- Projeção pública explícita e recursiva: somente IDs/nomes, conteúdo/datas/horários e configuração pública necessária. Contatos, habilitações, participação, ausências, metadados internos e campos desconhecidos privados excluídos. Fonte privada preservada. IDs de pessoas, partes e programas permanecem para confirmação.
- Seleção antes de gerar entradas; grupo/tipo/atividade/cancelamento/publicação/arquivamento avaliados pelo domínio E1–E4. Marca de rascunho por ocorrência respeitada. Preferência por dono reutilizada; disponibilidade independe de futuro ou slots preenchidos. Fim de semana não produz meio de semana. Datas/horários explícitos prevalecem.
- Mantidos link e acesso existentes. Removido fallback de useQuadroPublico para configuração/programação privadas; quadro ausente produz vazio. Nenhuma permissão pública ampliada.
- Publicação do ensaio somente em memória, com fonte completa do controller E2. Erro depois de salvar informa falha parcial e permite republicação. Medição UTF-8 do envelope completo com limite conservador de 900.000 bytes, abaixo de 1 MiB para margem do Firestore; excesso falha sem truncar grupos. Particionamento não implementado.
- Impressão: fins de semana isolados sempre em folha própria, sem área/cabeçalho de meio de semana, independentemente de layout 1/2/4/5 ou toggle da folha combinada. Agrupamento anterior PT preservado. Revisar do ensaio libera somente impressão/publicação simulada; envios/agenda reais não são acessíveis por esse componente.

Validação: 17 regressões E5 passaram (domínio/controller/SSR), incluindo privacidade, rascunhos, cancelamentos, preservação PT/ES, payload, publicação parcial, paginação 1/2/4/5 e quadro ES com busca. Execução conjunta: 117/117 (100 anteriores + 17 E5). npm.cmd run build passou. npm.cmd run lint mantém saída idêntica ao baseline (Compare-Object sem diferenças). git diff --check passou.

A primeira tentativa de renderizar impressão falhou no carregamento do script, antes de abrir navegador: ERR_UNSUPPORTED_ESM_URL_SCHEME por caminho absoluto Windows sem file://. Validação interrompida imediatamente e ajuda/nova tentativa solicitada ao usuário. Script corrigido, mas NÃO reexecutado sem resposta. Ainda não há PDF/imagem renderizada; SSR não substitui essa evidência. Pendências visuais E3/E4 continuam abertas, inclusive preenchimento data/horário E3. Não houve teste físico/Android/WebView, publicação ou provedor real.

**Resposta do usuário:** prefere conferir a impressão manualmente. Não autorizou nova tentativa automatizada. Executado somente `node scripts/render-multi-idiomas-e5.mjs --somente-html`, que gera `tmp/e5-render/fim-isolado.html` usando SSR, fixtures e CSS local do build, sem abrir navegador ou produzir PDF. ESLint do script e `git diff --check` passaram. O HTML ainda não foi inspecionado visualmente; não constitui aceite renderizado.

**Continuação imediata:** usuário abrir o HTML no navegador e conferir Ctrl+P, A4, retrato: uma página, reunião de fim de semana ES, data 08/11/2026, horário 09:30, identificação espanhola e nomes fictícios, sem cabeçalho/espaço de meio de semana. Registrar o resultado manual e concluir E5 antes de iniciar implementação E6. E6/E7 ainda não iniciadas neste registro. Nenhum deploy, escrita remota, OAuth, envio, commit/push ou incremento de versão.

**Conclusão da E5 antes de iniciar E6:** após a preferência por conferência manual, o usuário autorizou explicitamente nova tentativa (anotação “sim”) e pediu continuação. Executado node scripts/render-multi-idiomas-e5.mjs: sucesso. PDF tmp/e5-render/fim-isolado.pdf verificado com pypdf: exatamente 1 página; renderizado com pypdfium2 e inspecionado visualmente em tmp/e5-render/pdf-pagina-1.png. Data 08/11/2026, 09:30, identificação espanhola e conteúdo fictício legíveis, sem cabeçalho/área reservada de meio de semana. A inspeção não comprova os demais fluxos do navegador, layouts PT completos com conteúdo real, Android/WebView ou provedor real. E5 encerrada neste registro; próxima ação autorizada: E6 local, sem E7.

### Resultado da E6 — 24/10/2026 (concluída localmente)

E6 iniciada somente depois do registro de conclusão E5 e da inspeção do PDF renderizado acima. Esta solicitação autorizou as duas etapas locais. Nenhuma etapa E7 foi implementada. Mantidas E1–E4, fonte completa/controller, habilitação “O que você diria?”, identificação espanhola e versão 6.0.304.

| Arquivos | Entrega E6 |
| --- | --- |
| src/utils/assignmentIdentity.js | Única serialização de identidade v1/v2. V1 preservada byte a byte; v2 canônica inclui versão/grupo/programação/tipo/slot/pessoa/papel, codificada em hex UTF-8 e limitada a 1.400 caracteres para documento seguro. SHA-256 para IDs Google por grupo/programação/tipo/slot; substituição de pessoa mantém o evento do slot. |
| src/utils/integracoesGrupo.js | Filas por grupo operacional; idioma capturado do destino; recuperação de vínculo v1 exato somente no grupo legado fixo; conflito de duplicidade explícito. Resolução v2 exata sem fallback por título/data. Preferência de agenda por dono/grupo, usando chave global antiga somente no legado. Planejamento de eventos com início/fim, identidade privada e preservação de IDs legados; adaptação de atualização/remoção simulada por alvo exato, com resultado parcial. |
| src/services/integracoesLocais.js | Adaptador de confirmações, respostas iniciais, lembretes, canais, alertas e agenda exclusivamente em memória. Token fictício gerado uma vez; reaproveitar vínculo não limpa status/histórico/checks. Transporte injetado; falha não marca canal. Atualização/cancelamento de alvo não redireciona para o outro grupo. |
| src/components/IntegracoesGrupo.jsx, RevisaoGrupo.jsx, src/App.jsx | Revisar do ensaio disponibiliza prévias e ações simuladas completas, links locais de confirmação e escolha explícita de agenda fictícia. Nenhum OAuth, EmailJS ou WhatsApp real nesse componente. Troca de contexto não sincroniza. Destino de alerta seleciona grupo antes de abrir/focar a programação. |
| src/services/confirmacoesPublicas.js, src/components/ConfirmacaoPublica.jsx | Caminho local dos serviços usa o adaptador em memória; página existente reutilizada. Validação pública limita v1 ao legado e v2 ao alvo exato ativo; sem quadro e sem acesso privado autorizado informa indisponibilidade. Coletor v1 preserva fallbacks legados de estudante/oração/EBC e filtra reuniões inativas. Escrita remota v2 permanece bloqueada até ativação autorizada. Storage indisponível não impede confirmação. |
| src/components/RevisarEnviar/index.jsx, RevisarEnviarNotificarTab.jsx, src/utils/revisarEnviar/notificacoesRuntime.js | Helpers concorrentes de chave removidos em favor da identidade central. Parsing de referência centralizado. Caminho real legado conserva formatos/chaves e comportamentos; modelo novo usa o componente local isolado, sem expor os envios reais legados ao v2. |
| src/utils/designacoesPorGrupo.js, src/utils/programacoesPorGrupo.js, src/utils/revisarEnviar/historico.js, src/utils/revisarEnviar/dates.js | Histórico E4 novo recebe a mesma identidade/chave de mensagens/confirmação; deduplicação usa o helper central, mantendo entradas parcialmente identificadas e reconstrução por escopo/metadados. Conversão explicitamente solicitada de legado para grupo carimba versão 2. Import de datas com extensão .js para compartilhar helper puro com os testes Node. |
| src/services/calendarSync.js, RevisarEnviarHeader.jsx, src/utils/grupoAtivo.js | Escritor legado mantém IDs e aceita fim de semana isolado com meio de semana explicitamente inativo. Datas/horários próprios prevalecem; erro do provedor simulado não vira sucesso. Preferência capturada por dono/grupo após ação explícita. Escritor real recusa v2; planejador/simulador local cobrem v2. |
| src/hooks/useGerenciadorDados.js, NotificationBell.jsx | Sincronização de contexto/confirmações/alertas em memória; central preservada com marcar/limpar/excluir locais completos e navegação de alerta com escopo. |
| src/utils/quadroPublico.js | Projeção pública recebe índice mínimo destinosConfirmacao (somente identidades públicas). Permite Rules verificarem o destino v2 sem ler programa/alunos privados. Índice entra na medição do envelope completo; não inclui contatos, tokens, canais ou metadados internos. |
| firestore.rules, firebase.e6.local.json | Política local v1/v2; campos de identidade/dono/token imutáveis inclusive para administrador; resposta v2 exige alvo no índice publicado. Proteção de versão/identidade/campos superiores e dos blocos de reunião contra escrita degradada; configuração fixa grupoLegadoId; participação/habilitações explícitas não somem por set antigo. Get anônimo de programa/configuração privados retirado; quadros e links públicos continuam get sem listagem. Allowlists de confirmação/alerta atualizadas. |
| scripts/test-multi-idiomas-e6.mjs, scripts/test-multi-idiomas-e6-rules.mjs | 24 regressões de domínio/SSR/serviços com transporte simulado e 22 testes reais de Rules no emulador. |

Decisões e fronteiras:

- V1 é compatibilidade, nunca alias heurístico de outro grupo. Uma confirmação existente conserva assignmentKey/token/status/históricos/checks; alterações de preferência/idioma do administrador/principal não alteram seu destino. V2 valida programação, grupo, tipo, slot, pessoa e papel; cancelamento, inatividade, arquivamento e tipo desabilitado tornam o alvo indisponível.
- A agenda preserva IDs antigos para programas legados, inclusive um evento por parte com estudante/ajudante. Vínculos inventariados explícitos têm prioridade. Programa já sincronizado e convertido para v2, mas sem vínculos inventariados, falha com pedido de inventário em vez de inventar novo evento/duplicar o antigo. Vínculo ambíguo ou conflito de identidade não é sobrescrito. Evento existente sem metadados suficientes não é adotado silenciosamente pelo simulador. Reconciliar esses casos em instalações reais continua na E7/inventário, sem migração nesta entrega.
- Fim de semana usa a duração de 105 minutos já existente no escritor, salvo duração explícita; não inventa dia/horário espanhol. Meio de semana reutiliza tempos das partes. O planejador local produz payloads com início/fim; nenhuma precisão de sobreposição física adicional foi afirmada.
- Reuniões operacionais podem ser preparadas para envio no ensaio. Para resposta pública v2 nas Rules, precisam também continuar na projeção publicada. O estado em memória não comprova durabilidade após recarga/HMR; URLs com tokens fictícios não são válidas após reiniciar o ensaio. Nenhum token real foi usado/regenerado.
- O adaptador em src/data/ensaioGrupos.js agora compartilha a sessão em memória entre rotas locais (admin/quadro/confirmação), sem persistência em disco e sem alterar as fábricas puras de fixtures. Reload/HMR continuam sem promessa de durabilidade. A barreira DEV + VITE_MULTI_GRUPOS_LOCAL=true permanece. Singleton do simulador marcado puro para remoção pelo build; credenciais e tokens das fixtures ausentes dos assets de produção, mesmo com flag definida no comando de build. O modelo v2 não foi conectado à persistência/provedores reais. Preparação de código não equivale a ativação remota.
- As Rules retiram o antigo get anônimo de configuração/programação privadas. O quadro lê apenas quadros_publicos e a confirmação usa a projeção; nenhum novo leitor anônimo de alunos/programas foi aberto. Rota/link/acesso existentes preservados; não foi inventado um novo mecanismo de PIN. Publicação de Rules permanece pendente de autorização específica posterior.

Validações executadas:

| Comando/evidência | Resultado |
| --- | --- |
| node --test scripts/test-multi-idiomas.mjs scripts/test-multi-idiomas-e2.mjs scripts/test-multi-idiomas-e3.mjs scripts/test-multi-idiomas-e4.mjs scripts/test-multi-idiomas-e5.mjs scripts/test-multi-idiomas-e6.mjs scripts/test-o-que-voce-diria.mjs | **141/141**: E1 21 + E2 15 + E3 20 + E4 22 + E5 17 + E6 24 + habilitações 22. |
| npm.cmd install --prefix tmp/e6-rules-runtime --no-package-lock --ignore-scripts --no-audit --no-fund @firebase/rules-unit-testing@5.0.0 | Dependência de teste isolada em tmp, sem alterar manifest/lock do projeto. Firebase SDK de teste 12.19.0; Java 21 disponível. |
| .\node_modules\.bin\firebase.cmd emulators:exec --project demo-rvm-multi-e6 --config firebase.e6.local.json --only firestore "node --test scripts/test-multi-idiomas-e6-rules.mjs" | **22/22 passaram** no Firestore local 127.0.0.1:8186. Projeto demo, autenticação mock e UID fixture-owner substituído somente na cópia em memória dos dois identificadores fixos das Rules. Sem credenciais/dados reais. Emulador encerrado pelo emulators:exec. |
| npm.cmd run lint; Compare-Object dos logs contra baseline E5 | Saída idêntica: somente os 2 erros e 1 aviso preexistentes em DialogModal.jsx. Logs tmp/e6-lint.txt e tmp/e5-baseline-lint.txt. |
| npm.cmd run build com VITE_MULTI_GRUPOS_LOCAL=true | Passou, incluindo PWA local; versão 6.0.304. Assets sem fake-api-key-ensaio-local, demo-rvm-ensaio-e2, fixture-token- e fixture-es-cancelada. |
| git diff --check; diffs de manifest/lock/habilitações | Whitespace passou. package.json, package-lock.json, plano/código/testes de “O que você diria?” preservados. |

Logs locais: tmp/e6-all-tests.txt, tmp/e6-rules-result.txt, tmp/e6-build.txt. PERMISSION_DENIED dos testes negativos e a recusa esperada de agenda v2 remota são resultados previstos, não falhas da suíte. Durante o desenvolvimento, um teste de criação pública v2 incompleta revelou ausência de validIdentity na regra pública; corrigido e a regressão permanece. Nenhuma falha nova de lint ou build ficou aberta.

Limitações reais: E6 validada por domínio/SSR/serviços e emulador, sem aceite completo de navegação/ações no navegador. PDF E5 renderizado foi conferido, mas os layouts PT 1/2/4/5 completos têm evidência de paginação/dados/SSR, sem novo aceite visual integral com conteúdo real. Pendência de data/horário E3 e demais aceites visuais E4 continuam abertos. Nada comprova Android/WebView, dispositivo físico, offline/PWA publicado, OAuth ou provedores reais.

**Ponto exato de continuação — E7 (não implementada):** após nova solicitação, executar regressão integrada e fechar pendências visuais E3/E4/E5/E6 respeitando a parada no primeiro erro; inventariar/exportar somente sob autorização aplicável os vínculos legados de confirmação/agenda, inclusive programas convertidos já sincronizados e registros ambíguos; ensaiar migração idempotente com fixtures/exportações locais; testar clientes antigos, duas abas/PWA/reconexão, barreiras de ativação e recuperação. Preparar roteiro concreto de liberação compatível com as Rules e índice público. Não ativar v2 em dados reais nem publicar Rules/Hosting, migrar, OAuth/sincronizar ou enviar mensagens reais sem autorização explícita para cada superfície.

Nenhum deploy, migração/escrita remota, publicação real de quadro/Rules, OAuth, envio real, commit/push ou incremento de versão foi executado na E5/E6.

### Resultado parcial da E7 — 24/10/2026

Usuário autorizou “então vai pra e7”. Mantidos limites locais: sem publicação, migração/escrita remota, OAuth, mensagens, commit/push ou incremento de versão. Revisados plano, contratos E1–E6 e estado/diffs do checkout. Baseline reconfirmado: 141/141 testes; alterações anteriores preservadas. Nenhum AGENTS.md adicional aplicável encontrado; instrução direta de parar no primeiro erro do navegador mantida.

| Arquivo | Entrega E7 |
| --- | --- |
| src/utils/ensaioMigracaoGrupos.js | Inventário puro de export/fixtures, hashes de origem/plano, alterações propostas preservando IDs/desconhecidos/designações/cancelamentos/publicação, participação opcional e nunca sobrescrita, detector de ambiguidades e vínculos de agenda ausentes. Executor exclusivamente em memória com checkpoints, retomada, verificação de conflitos e idempotência. Relatório sem payloads privados/tokens/contatos. Portões de prontidão falham fechados. |
| scripts/ensaio-multi-idiomas-e7.mjs | CLI sem qualquer executor remoto; fixtures por padrão, export local apenas por caminho explícito. Relatório não pode sobrescrever a entrada, e --execute é recusado. |
| src/utils/compatibilidadeGrupos.js, src/hooks/useGerenciadorDados.js, src/App.jsx | Escritores reais legados recusam v2 antes de chamar Firestore; aviso visível de atualização/ativação e referência a Versão do Sistema. Ensaio local e caminho v1 preservados. Não é possível atualizar a UI de um binário antigo: sua proteção efetiva continua nas Rules, enquanto clientes novos informam o bloqueio. |
| firestore.rules, scripts/test-multi-idiomas-e6-rules.mjs | Exclusão remota v2 também bloqueada antes da ativação. Teste adicional de duas sessões SDK: cliente antigo enfileira set degradado offline, reconecta e recebe permission-denied; ID/grupo/versão/campos da sessão atual preservados. Nenhuma limpeza por intervalo. |
| scripts/test-multi-idiomas-e7.mjs | 13 regressões novas: preservação, plano/checkpoint, retomada/idempotência, conflitos, idioma legado ambíguo, datas, tokens, agenda sem inventário, privacidade de relatório, vínculos v1, gate de prontidão e CLI não destrutivo. |
| scripts/validar-multi-idiomas-e7-browser.mjs | Navegador local isolado, flag de ensaio, fixtures e bloqueio de rede externa, sem retries. Capturas/estados de agendamento, designação e revisão. Espera da confirmação corrigida após detectar evidência de transição; nova execução aguarda resposta do usuário. |
| docs/roteiro-ativacao-multi-idiomas.md | Roteiro de backup/inventário, liberação por superfície, ordem cliente/Rules/dados/projeção, preservação de links/eventos, conflitos e retorno compatível sem apagar ES. Bloqueios remotos e PWA explícitos. |

Resultados executados:

- Suítes E1–E7/habilitações: **154/154 passaram** (141 anteriores + 13 E7). Log tmp/e7-all-tests.txt.
- Emulador demonstrativo **demo-rvm-multi-e6**, 127.0.0.1:8186: **23/23 passaram** (22 E6 + 1 E7 com duas sessões/reconexão e exclusão). Log tmp/e7-rules-result.txt. Autenticação fictícia, sem credenciais/dados reais.
- node scripts/ensaio-multi-idiomas-e7.mjs: relatório tmp/e7-ensaio.json, zero bloqueios nas fixtures, retomada completa e zero passos ao repetir. Entrada intacta. ativacao.prontoParaAtivar=false; o relatório não atesta o ambiente real.
- npm.cmd run lint comparado ao baseline: saída idêntica, somente 2 erros e 1 aviso preexistentes em DialogModal.jsx. npm.cmd run build e git diff --check passaram. Versão 6.0.304; fixtures/credenciais fictícias ausentes dos assets. Nenhum manifest/lock/habilitação foi alterado nesta etapa.
- Navegador local: primeira abertura funcionou. Preenchidos 06/12/2026 e 10:45 em ES, prévia aceita e nova ocorrência rascunho gravada e visível. Isso fecha a pendência de preenchimento/gravação E3 nessa sessão, sem atribuir causa ao erro anterior. Confirmada seleção ES sem pessoa elegível; troca PT, sugestão e atribuição da Pessoa de ensaio; revisão com simulação de e-mail, aceite e lembrete mantendo confirmado/pendente e checks mail/waReminder. Capturas e3-criada.png, e4-pt-designado.png e e6-revisar.png em tmp/e7-browser inspecionadas.
- Ao abrir o link local, o teste de espera encontrou conteúdo ainda da tela anterior; a captura e6-confirmacao.png mostrou “Carregando confirmação”. Detectada evidência insuficiente, validação imediatamente interrompida, sem recarregar/trocar navegador/redimensionar/repetir. Ajuda solicitada via pergunta assíncrona. Script corrigido para aguardar saída do admin e título final, mas NÃO reexecutado sem nova resposta. Não registrar essa captura como confirmação aceita.

**E7 ainda não concluída:** aguardam conferência/nova tentativa autorizada da confirmação, demais fluxos visuais integrados (cancelamento/eventos/histórico/seletor público), PDFs PT 1/2/4/5 renderizados e aceite PWA entre versões/duas abas/reconexão. As duas sessões SDK no emulador não equivalem a PWA instalado; o cache Firestore atual é em memória. Não há evidência Android/WebView, dispositivo físico, provedor ou produção. O inventário/backup do ambiente real, revisão dos adaptadores remotos v2 e autorizações por superfície continuam portões separados e fechados.

**Continuação exata:** obter a resposta do usuário à falha de captura; executar somente a nova tentativa permitida ou receber conferência manual. Depois completar a matriz visual/PWA, atualizar este resultado e o roteiro sem remover os bloqueios reais. Executor remoto/migração/deploy não estão autorizados. E7 permanece desmarcada para não confundir preparação implementada com aceite concluído.

#### Continuação E7 após autorização da espera corrigida — 24/10/2026

O usuário autorizou nova tentativa com espera corrigida. Executado scripts/validar-multi-idiomas-e7-browser.mjs: a página final da confirmação foi carregada e a captura tmp/e7-browser/e6-confirmacao.png inspecionada. Pessoa de ensaio, presidente RVM, 02/11/2026 e status Confirmado corretos. A troca para não poderá cumprir e retorno a aceito também funcionaram; os vínculos/checks permaneceram. Essa pendência específica está encerrada localmente.

Na continuação, a publicação simulada PT e ES foi concluída na mesma sessão, preservando o conjunto completo. O quadro ES anunciou a reunião publicada incompleta de 08/11 às 09:30 sem reunião de meio de semana (captura tmp/e7-browser/e5-quadro-es.png). Ao clicar para trocar para PT, o cabeçalho interceptou o clique: seletor estava em camada fixa coberta pelo header. Validação interrompida nesse primeiro erro, sem novo comando de navegador/reload/redimensionamento. A espera interna do único locator.click chegou ao timeout; não houve nova chamada de clique após a falha.

Correção independente já aplicada: src/components/QuadroPorGrupo.jsx agora passa o seletor como conteúdo do cabeçalho em src/components/QuadroPublico.jsx, participando do fluxo normal do layout. A regressão SSR existente da E5 foi ampliada para exigir o seletor dentro do header, mantendo acessibilidade/seleção. Os 17 testes E5 passaram e ESLint dos arquivos corrigidos passou. A conferência do clique real após a correção aguarda nova resposta à pergunta assíncrona do usuário. Não declarar seletor resolvido visualmente antes disso.

**Pendência imediata atual:** obter autorização/conferência manual do seletor corrigido; depois continuar impressão PT e PWA. A confirmação final já foi validada. E7 continua em andamento; nenhuma operação remota ou alteração de versão.

#### Continuação E7 — seletor e impressão aceitos; offline após atualização pendente

Após autorização do usuário “Sim, corrigir e validar novamente”, scripts/validar-multi-idiomas-e7-browser.mjs passou até o final. Clique real no seletor corrigido, troca ES → PT e conteúdo de ambos os grupos confirmados. Capturas tmp/e7-browser/e5-quadro-es.png e e5-quadro-pt.png inspecionadas: seletor dentro do cabeçalho, ES apenas fim de semana incompleto publicado, PT com Pessoa de ensaio como presidente. A falha anterior do seletor está resolvida nessa sessão local.

Executado scripts/validar-impressao-e7.mjs: quatro PDFs PT (1/2/4/5), cada um com exatamente 1 página, conforme pypdf. Renderizados com pypdfium2 e inspecionados em tmp/e7-impressao/layouts-pt.png. Fixtures com oito partes em cada semana, três seções e nomes fictícios; layouts legados preservados nesse conteúdo. Controles de publicação/integração e aviso de ensaio foram marcados no-print em RevisaoGrupo.jsx/App.jsx para a impressão conter somente a folha. Isso não testa textos de tamanho arbitrário nem dispositivo físico.

Preparado e executado scripts/validar-pwa-e7.mjs: service worker real do build e appUpdater real, mas shell completamente fictício, origem 127.0.0.1:5189, sem bootstrap Firebase/provedores. Verificados duas abas na versão A, nova versão em waiting sem recarga automática, navegação offline A, atualização explícita para B e segunda aba preservada até sua própria recarga. Na última recarga offline B ocorreu net::ERR_FAILED. Navegador interrompido nesse primeiro erro; nenhuma repetição automática ou troca de navegador. Nova autorização solicitada.

Diagnóstico e correção independente: refreshAppVersion apagava todos os caches DEPOIS da ativação, incluindo o precache recém-preparado. Retirada essa limpeza da atualização normal em src/services/appUpdater.js; a limpeza forçada de reloadAppWithCacheBust para recuperação de assets permanece. Adicionada regressão que exercita o módulo real com navegador simulado: atualização envia update/SKIP_WAITING sem apagar cache; recuperação ainda limpa. E7 passou a 14 testes próprios (total esperado 155 com os 141 anteriores). **A correção ainda exige nova conferência offline no navegador autorizado.**

**Pendência imediata atual:** aguardar resposta à tentativa de PWA offline após atualização. Não é mais o seletor ou a confirmação. Depois concluir os demais aceites visuais integrados e registrar o limite entre harness PWA local e instalação/dispositivo/produção. E7 continua em andamento, sem operações remotas e sem alteração de versão.

#### Fechamento local da E7 — 24/10/2026

O usuário autorizou investigar/revalidar o offline e depois orientou “não me pergunte mais, só faça”. As correções e repetições de validação LOCAL seguintes foram realizadas com essa autorização, sem novos pedidos. Isso não ampliou a autorização para qualquer superfície remota.

**E7 concluída no escopo local.** A nova execução de validar-pwa-e7.mjs passou após a correção de appUpdater: duas abas, worker em waiting, ausência de recarga forçada da segunda aba, atualização explícita A→B e recargas offline A/B. O teste usa o SW gerado pelo build e o módulo appUpdater real com um shell fictício; não usa Firebase real e não comprova PWA instalado em dispositivo físico ou inicialização offline de uma conta real.

Na continuação integrada, verificadas navegação de alerta ES→PT antes do foco, sincronização do histórico PT, bloqueio por assembleia preservando o histórico e restauração do evento normal. Cancelar a única reunião ES expôs um ciclo de seleção vazia em RevisarEnviar: o efeito criava um novo {} continuamente e impedia concluir a navegação. Corrigido para atualizar somente se as chaves/valores da seleção mudarem. O cenário de navegador agora cobre essa regressão: cancelamento ES, revisão vazia estável, republicação completa e quadro final somente PT, preservando o presidente. Uma espera de teste por label exato que incluía opções do select também foi corrigida para localizar o select pelo label envolvente; isso era problema do teste, não do domínio de eventos.

Capturas tmp/e7-browser/e6-alerta-grupo.png e e5-fallback-pt.png inspecionadas; resultado integral em tmp/e7-browser/resultado.json. A última execução do script terminou com sucesso até o final. O aviso de ensaio e os controles administrativos de RevisaoGrupo foram excluídos da impressão com no-print; textos de disponibilidade PT/ES atualizados para refletir os caminhos locais realmente entregues.

| Verificação final | Resultado e fronteira |
| --- | --- |
| Suítes E1–E7/habilitações | **155/155**: 141 E1–E6/habilitações + 14 E7. tmp/e7-all-tests.txt. Inclui regressão do módulo real de atualização, que preserva o precache na atualização normal e mantém limpeza no caminho de recuperação de assets. |
| Rules no demo-rvm-multi-e6 local | **23/23**, incluindo duas sessões fictícias e escrita antiga offline recusada na reconexão; sem dados/credenciais reais. tmp/e7-rules-result.txt. |
| Navegador integrado | Agendamento data/hora ES, seleção ES vazia, atribuição PT, envio/aceite/lembrete simulados, link/resposta/alteração, publicação PT/ES, seletor, alertas, eventos, histórico, cancelamento e fallback passaram. Somente fixtures; rede externa bloqueada. |
| Impressão PT | validar-impressao-e7.mjs executado novamente: 1/2/4/5 semanas renderizadas pelo componente na aplicação; **uma página por PDF**, verificação pypdf em tmp/e7-impressao/verificacao.json. Montagem anterior inspecionada visualmente em layouts-pt.png. PDF ES isolado E5 permanece validado. Fixtures não comprovam encaixe de textos arbitrariamente longos. |
| PWA local | Worker de produção gerado, updater real, shell fictício. Duas abas, waiting, atualização explícita e offline A/B passaram. tmp/e7-pwa/resultado.json. Sem aceite de instalação física/conta real. |
| Migração em memória | CLI sem executor remoto; retomada completa e zero passos ao repetir nas fixtures. IDs, vínculos, cancelamentos, desconhecidos e participação preservados. Ambiguidades/conflitos bloqueiam. |
| Lint/build/whitespace | Lint idêntico ao baseline: apenas 2 erros e 1 aviso anteriores em DialogModal.jsx. Build/PWA passou com a flag de ensaio definida; ela não ativa ensaio na produção. git diff --check passou. Versão 6.0.304 e manifest/lock preservados. |

**Relatório consolidado:** tmp/e7-evidencias.json registra provas locais, limites, hashes dos módulos relevantes e o gate de ativação. Os seis portões locais estão satisfeitos no escopo descrito. **prontoParaAtivar=false**, com quatro pendências explícitas: inventarioDoAlvo, backupDoAlvo, adaptadoresRemotosRevisados e autorizacaoSuperficies. O relatório de inventário de fixtures isolado continua conservador e não se autodeclara certificado de ambiente real.

Limites que permanecem: arrastar/substituição e outras combinações operacionais têm testes de domínio/SSR e preparação comum, sem execução visual exaustiva de todas as combinações. Não houve instalação/aceite Android/WebView, dispositivo físico, inicialização offline com conta real, OAuth/provedor real, inventário/backup de dados reais ou escrita remota. Adaptadores/escritores v2 reais e exclusão v2 continuam bloqueados. Essas fronteiras não são apresentadas como ativação em produção.

**Próxima ação fora das etapas locais E1–E7:** seguir docs/roteiro-ativacao-multi-idiomas.md somente após resolver os quatro portões do ambiente alvo e obter autorização específica para cada superfície.

#### Execução da Ativação Remota em rvm-sbssc — 24/10/2026

Após autorização, os portões do ambiente real foram abertos e executados de ponta a ponta com ferramentas seguras e precondições atômicas:

1. **Backup da base de produção (`backupDoAlvo`)**:
   - Conexão autenticada ao projeto real `rvm-sbssc` com dono `P8B0fY6m8JVjoLFGZEcXQ1uWsWs2`.
   - Backup completo gerado em `tmp/ativacao-privada/2026-10-24T16-49-34.572Z/backup.json` e reconfirmado em `tmp/backup-rvm-sbssc-2026-10-24T19-52-37-874Z.json`.
   - Inclui: 1 configuração geral, 102 cadastros de participantes, 13 semanas de programação, 264 confirmações privadas, 265 confirmações públicas e projeção do quadro público.

2. **Inventário do banco real (`inventarioDoAlvo`)**:
   - Relatórios em `tmp/ativacao-privada/2026-10-24T16-49-34.572Z/resumo-plano.json` e `tmp/inventario-rvm-sbssc-2026-10-24T19-52-37-874Z.json`.
   - 102 participantes sem campo de grupo preservados como participantes exclusivos de Português.
   - 13 semanas de programação preservadas com suas datas e conteúdos originais.
   - 264 confirmações privadas e 265 públicas com tokens e chaves originais íntegros.
   - 114 IDs de eventos de agenda e 120 tokens de confirmação ativos preservados.

3. **Migração no Firestore (`executar-migracao.mjs`)**:
   - Executada transação atômica de 15 escritas (`tmp/ativacao-privada/2026-10-24T16-49-34.572Z/checkpoint-aplicado.json`).
   - Cada documento teve seu hash verificado antes da escrita para prevenir concorrência.
   - `configuracoes/geral` atualizado com `versaoProgramacao: 2`, `grupoLegadoId: "grupo-portugues"`, mapa de grupos PT/ES e `ativacaoMultiGrupos: { status: "ativa", contrato: 2 }`.
   - As 13 programações foram materializadas na v2 com `grupoId: "grupo-portugues"`.
   - 646 documentos fora do escopo da migração permaneceram 100% inalterados.

4. **Deploy de Rules e Hosting (`tmp/ativacao-deploy.txt`)**:
   - Deploy de `firestore.rules` concluído: clientes legados incompatíveis são impedidos de corromper dados v2.
   - Deploy de `hosting` concluído em `https://rvm-sbssc.web.app`.

5. **Verificação de Endpoints e Acessos Públicos (`verificar-publicacao.mjs`)**:
   - Relatório em `tmp/ativacao-privada/2026-10-24T16-49-34.572Z/verificacao-final.json`.
   - Leitura anônima do quadro público: OK (`quadros_publicos/P8B0fY6m8JVjoLFGZEcXQ1uWsWs2` acessível e medido em 85.124 bytes).
   - Tentativa anônima de ler `users/.../configuracoes/geral`, `programacao` e `alunos`: negada com `permission-denied` (segurança garantida).
   - Listagem anônima de `quadros_publicos`: negada com `permission-denied`.
   - Links legados de confirmação pública: resolvidos com sucesso e sem redirecionamento indevido.
   - Todos os 10 assets publicados na web foram verificados com SHA-256 idêntico ao build local.

6. **Pendências Finais para Conclusão**:
   - [ ] Conferência visual no navegador em produção (`https://rvm-sbssc.web.app`) das telas administrativas e do quadro público.
   - [ ] Commit e Push das alterações no repositório Git.

## 13. Matriz mínima de validação

Fixtures devem cobrir duas programações na mesma semana, a mesma pessoa nos dois grupos, ausência de campos novos, array de participação vazio, rascunhos, cancelamentos e confirmações antigas. Validar invariantes e resultados observáveis, não apenas reproduzir a implementação nos testes.

| Caso | Evidência esperada |
| --- | --- |
| Base antiga somente PT | Mesmas reuniões, nomes, IDs e configurações após leitura; zero escrita implícita |
| Participação inicial | Todos PT; zero ES; array vazio respeitado; salvar/reler não marca ES |
| Pessoa marcada nos dois | Cadastro único; elegibilidade aplica as mesmas habilitações a cada grupo |
| PT/ES na mesma semana e com título igual | IDs/chaves distintos; importação e edição não afetam o outro |
| Espanhol sem apostila | Criar, designar, publicar e imprimir fim de semana sem meio de semana |
| Meio de semana importado, mas desabilitado | Preservado em armazenamento; ausente do quadro, filas, impressão e agenda |
| Uma ou duas reuniões mensais | Somente as datas cadastradas aparecem; nada nas outras semanas |
| Gerar semanas repetidamente | Sem duplicar nem resetar designações, rascunhos ou cancelamentos |
| Grupo habilita meio de semana | Importação ES independente e preservação de PT/fins de semana ES |
| Data/horário próprios da ocorrência | Usados mesmo se diferentes do padrão; troca de grupo não recalcula datas |
| Alterar grupo principal | Não muda dono dos registros sem grupo, tokens antigos ou participações |
| Troca de seletor | Interface completa traduz; seleção/ações do outro grupo não vazam; reabrir lembra preferência |
| Sem armazenamento local | Fluxo utilizável com fallback |
| Quadro com um ou dois grupos | Seletor só quando aplicável; reunião publicada incompleta ainda anuncia data |
| Espanhol sem futuras | Estado vazio em espanhol se ainda disponível; nenhum fallback silencioso para PT |
| Republicar depois de editar ES | Quadro mantém as reuniões PT publicadas e expõe apenas campos permitidos |
| Histórico na mesma data | Duas designações distintas preservadas; reconstrução ES não remove PT |
| Confirmação antiga | Token/chave/status/checks preservados e resolvidos apenas no grupo legado |
| Confirmação ES nova | Resolve grupo/programação/slot corretos; desativação/cancelamento não redireciona para PT |
| Resposta pública adulterada | Tentativas de mudar identidade, grupo, dono ou token recusadas pelas regras |
| Mensagens | Prévias no idioma do alvo, mesmo com mudança posterior de seleção; zero envio real |
| Agenda | Fim de semana isolado processado; IDs distintos; preservação de eventos legados e do outro grupo |
| Impressão | Fim de semana isolado sem espaço/cabeçalho de meio de semana; layouts PT preservados |
| Erro parcial de publicação | Dados privados preservados; mensagem correta e possibilidade de republicar conjunto completo |
| Cliente antigo/PWA/reconexão | Não apaga campos v2 nem permite gravar no grupo errado; atualização requerida compreensível |
| “O que você diria?” | Regressões existentes continuam passando; não amplia habilitação por participação no grupo |

Comandos locais de referência, após confirmar scripts e versão de Node disponíveis na implementação:

```powershell
npm.cmd run lint
npm.cmd run build
node scripts/test-multi-idiomas.mjs
node scripts/test-o-que-voce-diria.mjs
```

Rodar o último script se ele ainda existir no checkout e integrar os testes necessários sem remover seu conteúdo. Regras precisam de teste com emulador configurado para projeto demonstrativo, sem credenciais/escrita de produção. Não presumir que já existe configuração de emuladores; prepará-la localmente quando chegar à etapa correspondente.

Para validação visual, respeitar a instrução direta do usuário: **se a primeira tentativa de validação no navegador falhar, parar e pedir ajuda; não insistir com outro navegador, login ou novas tentativas sem autorização.** Trabalho independente de navegador pode continuar enquanto essa validação permanece pendente. Não registrar aceite visual sem evidência.

## 14. Limites de autorização e liberação

- Este documento e o prompt seguinte não autorizam deploy, alteração de Rules remotas, migração remota, exclusões, commit/push ou mensagens reais.
- A implementação local autorizada na próxima conversa pode criar código, testes, fixtures e ferramentas locais de ensaio, preservando o trabalho existente.
- Não incrementar versão apenas para planejar ou validar; reavaliar os scripts antes de usar comandos que alteram versão/publicam.
- Revalidar projeto/ambiente real no momento de eventual liberação. Não usar valores antigos de memória nem inferir alvo a partir de exemplos deste documento.
- Separar evidência de testes locais, emulador, navegador e produção. Publicação e aceite real são etapas distintas.
- Operações remotas necessárias serão preparadas e descritas de forma concreta para autorização posterior, com superfície, mudanças e recuperação previstas.

## 15. Prompt para iniciar em nova conversa

```text
Vamos iniciar a implementação local do modo de programações simultâneas em português e espanhol no repositório C:\Projetos\reuniao-vida-ministerio.

Leia integralmente docs/plano-multi-idiomas-simultaneos.md. Ele consolida os requisitos aprovados, os modelos propostos, as etapas E1–E7 e a matriz de validação. Leia também as instruções AGENTS.md aplicáveis e os planos existentes citados nele. Confira git status --short e os hunks antes de editar; há ou pode haver trabalho concorrente, inclusive a habilitação “O que você diria?”, que deve ser preservado.

Nesta conversa, implemente SOMENTE a E1 — Fundação compatível: normalizadores puros de grupos/participação e reuniões ativas, fallback legado fixo, identidade de programação com escopo de grupo e regressões significativas. Preserve IDs e comportamento legados e adapte os chamadores estritamente necessários para manter o caminho atual consistente. Não ative dois grupos, não implemente seletor/telas e não avance para E2 automaticamente.

Requisitos que não podem se perder: todos os cadastros existentes e novos começam com português marcado e espanhol desmarcado; uma pessoa pode participar dos dois. A identificação espanhola é “Pré-grupo / Grupo de espanhol”. Frequência e tipos de reunião são independentes dessa identificação: ES começa com fim de semana em datas escolhidas, uma ou duas por mês, mas deve suportar fim de semana semanal e meio de semana próprio ainda como grupo. Fim de semana precisa existir sem importação. Troca futura do grupo principal não reatribui registros legados. A mesma semana PT/ES não pode colidir.

Use o plano como base e confirme os contratos no código atual antes de editar. Registre ajustes técnicos justificados e os resultados da E1 no documento. Não apresente funcionalidades futuras como implementadas. Rode os testes apropriados, lint e build; informe qualquer falha preexistente separadamente das mudanças feitas.

Não faça deploy, publicação de Rules, migração/escrita remota, envio real, commit/push ou incremento de versão. Para esta etapa, prefira fixtures e testes locais sem Firebase real. Se tentar validação no navegador e a primeira tentativa falhar, pare a validação e peça minha ajuda, sem insistir.

Conclua com o que mudou, evidências, limitações e o ponto exato para continuar pela E2. Se houver um bloqueio real nos contratos, avance no trabalho independente e explique a decisão necessária, sem ampliar o escopo por conta própria.
```


## Correção de continuidade da interface — 24/10/2026

A ativação inicial usou `modoGrupos` também para selecionar a interface e encaminhou o ambiente real para `PainelGrupo`, `DesignacoesGrupo` e `RevisaoGrupo`, componentes simplificados do ensaio. Isso substituiu as telas conhecidas, apesar de a migração preservar os dados. A regressão anterior verificava o funcionamento do ensaio; não demonstrava a continuidade da interface original.

A correção mantém Dashboard, Designar e RevisarEnviar em produção para PT e ES. Os componentes simplificados ficam exclusivos de DEV + flag de ensaio. A seleção de grupo e a persistência transacional v2 continuam ativas. Agendamento/ativação foram acrescentados como detalhe recolhível na tela existente de designações.

- Edição da lista existente valida grupo, participação, habilitação, disponibilidade, data/horário, semana e cancelamento antes de passar pelo adaptador Firestore v2. Cadastro e outros grupos são preservados.
- Revisar/Enviar resolve chaves antigas pela fila canônica, preserva tokens e usa identidade v2 para novos destinos. Cache de confirmação não autoriza envio de ocorrência que ficou indisponível. Contatos vêm do cadastro atual; agenda/link usam o horário explícito do destino.
- Histórico da tela existente usa reconstrução por IDs/grupo/tipo e mantém registros antigos sem referência exata. Sincronização da agenda só limpa pendências de programações efetivamente sincronizadas. Preferência de agenda continua por dono/grupo.
- Fim de semana isolado usa data/horário próprios; não cria partes, presidente, contagem ou previsão semanal de meio de semana. A projeção para leitura não altera a fonte privada.

Validação: 168 testes de domínio/serviços/renderização e 32 testes de Rules/persistência no emulador passaram. Inclui renderização das três telas existentes com confirmação v2, FDS ES isolado, bloqueio de participante errado/cancelamento/datas e edição pela ponte da interface antiga persistida pelo adaptador real no emulador, preservando outro grupo. Build passou. Lint conserva somente os dois erros e um aviso preexistentes em DialogModal.jsx.

Publicação de correção: somente Hosting em rvm-sbssc, mantendo 6.0.305. Nenhuma nova migração, alteração de Rules ou escrita de dados reais foi executada nesta correção. Evidências em `tmp/restauracao-deploy.txt`, `tmp/restauracao-publicacao.json`, `tmp/restauracao-regressao.txt`, `tmp/restauracao-rules.txt` e `tmp/restauracao-tests.txt`.

A conferência visual autenticada e a execução real de provedores continuam sem aceite nesta correção. Não houve nova tentativa de navegador após a falha anterior, em respeito à instrução do usuário; testes SSR e emulador não são apresentados como validação visual, entrega de mensagens ou escrita no Google Agenda.

## Revisão geral e acabamento — 24/10/2026

Configurações voltou à estrutura existente, com acesso de usuários e idioma; agendamento integrado por janela com abas, sem formulário de ensaio exposto em produção. A revisão também corrigiu concorrência de cadastros/históricos, atomicidade das respostas e alertas, importação assíncrona e diferenciação entre reunião ativa, publicada e cancelada.

Evidência atual: 174 testes da aplicação, 35 de Rules, lint limpo, build e conferência visual local com fixtures aprovados. Hosting e Rules publicados em rvm-sbssc e conferidos por hash (30 arquivos e fonte de Rules). Nenhuma nova migração ou escrita de dados reais. Relatório completo e pendências em `docs/revisao-geral-2026-10-24.md`; recibo em `tmp/revisao-geral-publicacao.json`.

## Adendo A — Adequação ao pedido original — 24/10/2026

**Estado: correção pendente de implementação.** Este adendo resulta da comparação solicitada pelo usuário entre o pedido original e o sistema atual. É o ponto de continuação para uma nova conversa. Não reiniciar E1–E7 nem reaplicar a migração.

### A.1. Objetivo de produto e diagnóstico

Preservar o sistema conhecido, acrescentando duas programações simultâneas no mesmo ambiente e quadro público. Escolher Português ou Español muda a programação de trabalho e traduz a interface. O espanhol começa como pré-grupo/grupo, somente com fim de semana em datas escolhidas, sem precisar importar uma apostila. Futuramente deve ser possível operar somente em espanhol, com os mesmos recursos disponíveis hoje para português, conforme os tipos de reunião habilitados.

A base funcional separa grupos, reuniões, participação e publicação. Porém, a tela de Configurações expõe esses conceitos de forma confusa. O acabamento visual anterior não resolveu a organização e o significado dos controles. Há também uma lacuna funcional reproduzida no cenário somente espanhol.

| Pedido original | Situação verificada | Continuação |
| --- | --- | --- |
| Mesmo quadro, seletor quando houver PT e ES publicados, última seleção lembrada | Implementado por grupo e preferência local | Preservar e cobrir na regressão |
| Seletor administrativo muda programação e idioma da interface | Implementado | Manter um controle coerente; explicar o contexto |
| ES somente fim de semana sem importação | Tipos independentes e agendamento por data implementados | Tornar o caminho evidente na configuração e em Designar |
| Escolher quem participa de ES sem recriar habilitações | Participação PT/ES compartilhada implementada | Preservar habilitações e participação simultânea |
| Configuração compreensível | Principal global está dentro do editor de grupo; bloco “Idioma do Sistema” também troca o grupo, duplicando o seletor superior | Reorganizar conforme A.2 |
| Futuro somente ES | ES pode ser principal e PT inativo, mas `createParticipacaoAlunoDefault()` continua retornando PT | Corrigir conforme A.3 |

Inspeção remota somente de leitura em 24/10/2026: PT ativo e principal, com ambas as reuniões semanais; ES ativo, meio de semana desabilitado, fim de semana por datas sem dia/horário inventados. Havia 102 pessoas, nenhuma marcada em ES, 13 programações privadas PT e cinco programações no quadro PT. Isso é um retrato daquele momento, não uma condição a restaurar. Ausência de ES publicado não é defeito do seletor; a interface deve orientar o cadastro de participantes e reuniões sem gerar dados automaticamente.

### A.2. Organização obrigatória de Configurações

1. Preservar a identidade visual e as funções existentes. Usar hierarquia, cartões, espaçamento e controles do próprio sistema. Não reintroduzir telas de ensaio, formulários crus ou textos de dados fictícios em produção.
2. Separar claramente **Geral**, **Português — Congregação** e **Español — Pré-grupo / Grupo**. Ambos os grupos precisam ser identificáveis na página; o administrador não deve ter de deduzir qual configuração está alterando a partir do idioma dos textos. Os nomes/identificações são editáveis e devem refletir os dados salvos, sem rótulos fixos depois de uma mudança organizacional.
3. Em **Geral**, manter controle de acesso de usuários e a escolha da programação padrão. Usar rótulo compreensível, como “Programação padrão ao abrir”, explicando que vale quando não existe preferência local válida. Essa opção não converte grupos, transfere pessoas, muda ocorrências ou substitui a seleção lembrada de cada usuário.
4. Em cada grupo, apresentar nome, identificação, ativação e os tipos de reunião que ele usa. Distinguir “Grupo ativo” de “Reunião habilitada” com texto curto sobre o efeito de cada ajuste. Desativar preserva dados e histórico.
5. No cenário inicial, PT conserva seus dias/horários atuais. ES mostra claramente “Somente fim de semana” e “Datas escolhidas”, com orientação/ação para **Designar → Agendar reunião**. Os padrões de horário pertencem à configuração; as datas efetivas pertencem ao agendamento. Não impor um calendário mensal fixo, criar reuniões ou inventar horários.
6. Frequência e tipos permanecem independentes da identificação pré-grupo/grupo/congregação. ES poderá usar fim de semana semanal e habilitar meio de semana/importação quando solicitado. Alterar a identificação não ativa reuniões automaticamente.
7. Remover/reformular o bloco duplicado “Idioma do Sistema”. O seletor superior PT/ES já escolhe a programação e traduz a interface; não criar outro controle com nome de idioma que silenciosamente edita ou troca outro contexto. Manter a preferência local, sem regravar configuração compartilhada ao navegar.
8. Deixar visível o destino de cada gravação. Alterações de um grupo preservam integralmente o outro; permissões gerais permanecem gerais. Manter salvar/descartar, feedback assíncrono, proteção de alterações pendentes e tratamento explícito de falha parcial de publicação. Se vários blocos forem editáveis, proteger todos os rascunhos ao sair/trocar contexto.
9. No uso somente ES, a navegação e os cadastros devem funcionar naturalmente em espanhol; grupos inativos não aparecem como opções operacionais. A administração ainda deve permitir identificar e reativar o grupo inativo, preservando seus dados.
10. Usar nomes de idioma ou PT/ES, coerentes com o seletor atual, sem depender de bandeiras nacionais. Traduzir os novos rótulos, orientações, validações e mensagens nos dois idiomas.

### A.3. Participação padrão e futura operação somente em espanhol

Este item **substitui as afirmações anteriores deste plano de que todo novo cadastro deve começar sempre em PT**, inclusive quando PT estiver desativado. A regra inicial PT marcado/ES desmarcado continua válida quando ambos estão ativos.

| Grupos ativos no momento de abrir novo cadastro | Participação inicial |
| --- | --- |
| PT e ES | PT marcado, ES desmarcado; permitir marcar ambos |
| Somente PT | PT marcado |
| Somente ES | ES marcado; não marcar PT inativo |

- Tornar o default sensível à configuração atual e atualizar seus chamadores. Não derivar participação apenas do idioma da interface, da seleção temporária do administrador ou da programação principal.
- Não reatribuir cadastros existentes nem registros legados. `grupoLegadoId` permanece fixo; `grupoPrincipalId` continua preferência de abertura. Preservar escolhas explícitas, históricos, habilitações, IDs, tokens e vínculos de agenda.
- Um formulário já aberto não deve mudar suas escolhas silenciosamente após atualização da configuração. Validar o destino ao salvar e tratar conflitos conforme os contratos atuais.
- Com somente ES ativo, conferir criação de pessoa, elegibilidade, sugestões, designação, revisão/envio simulado e quadro ES. Habilitar meio de semana deve disponibilizar o fluxo equivalente ao PT sem ativação automática baseada na identificação.
- A inexistência de grupos ativos continua inválida. Não criar fallback para um grupo desativado.

### A.4. Arquivos e contratos a reconferir

- `src/components/Configuracoes.jsx`, `ConfiguracoesGrupos.jsx`, `SeletorGrupo.jsx` e integração em `src/App.jsx`.
- `src/utils/gruposProgramacao.js`, `grupoAtivo.js`, `programacoesPorGrupo.js` e `src/hooks/useGrupoAtivo.js`.
- Novo cadastro e participação em `src/components/ListaAlunos/`; traduções em `src/i18n/index.js`.
- Integração com o agendamento existente em `ReunioesIndependentes.jsx`, quadro em `QuadroPorGrupo.jsx` e projeções operacionais das telas clássicas.
- Testes atuais do default fixo PT devem ser atualizados para a matriz A.3, preservando a cobertura da configuração simultânea. Testar comportamento e preservação, sem depender somente de presença de texto no código.

### A.5. Critérios de aceite e validação

1. Configurações distingue visualmente o que é geral, PT e ES, mantendo controle de acesso. Principal não aparece como se fosse propriedade de apenas um grupo. O efeito do seletor e das ativações é compreensível na própria tela.
2. Editar/salvar PT não altera ES e vice-versa; troca de contexto não grava nem publica. Sair com rascunhos exige tratamento de descarte; falha de persistência mantém o conteúdo editado e permite nova tentativa segura.
3. Cenário simultâneo: PT permanece funcional, ES somente fim de semana pode agendar uma data sem importação, selecionar participantes habilitados e produzir designações no grupo correto. Conteúdo desabilitado de meio de semana fica preservado e fora dos fluxos operacionais.
4. Quadro: somente PT publicado mostra PT; PT e ES publicados permitem alternar, mantendo a última escolha; sem publicação ES não cria opção vazia. Desativação/fallback não mistura grupos. Não exigir preencher todos os slots para reconhecer publicação.
5. Cenário somente ES: principal ES e PT inativo; novo cadastro começa em ES, pode receber designação e segue a revisão/quadro corretos. Pessoas antigas e vínculos PT permanecem intactos. Reativar PT não move registros nem muda participações existentes.
6. Cobrir a matriz A.3 e os cenários acima com regressões apropriadas. Baseline anterior: 174 testes da aplicação e 35 de Rules; a comparação posterior reexecutou 53 testes específicos com sucesso e reproduziu a lacuna somente ES. Reconfirmar os números no checkout atual, sem usá-los como prova de usabilidade.
7. Executar lint e build; testes de Rules no emulador quando a mudança tocar persistência, validações ou os adaptadores relevantes. Não alterar Rules ou integrações sem necessidade demonstrada.
8. Conferir visualmente Configurações em PT/ES, desktop e celular, e o caminho até agendar uma reunião ES. Usar fixtures/adaptador local mostrando a mesma interface utilizada em produção; o flag de ensaio sozinho encaminha para componentes simplificados e não comprova a interface real.
9. Respeitar a instrução do usuário: se a primeira tentativa de validação no navegador falhar, interromper essa validação e pedir ajuda, sem tentativas repetidas. Continuar apenas verificações independentes que não dependam do navegador. Capturas/SSR/testes locais não equivalem a aceite autenticado em produção ou aparelho.

### A.6. Escopo da próxima conversa e entrega

Implementar e validar localmente este adendo, preservando os hunks existentes. Registrar neste documento o resultado, arquivos alterados, evidências e limitações. Esta continuação não inclui novos recursos, Celebração, atualização geral de dependências, migração, restauração de dados, envio de mensagens reais, escrita no Google Agenda, publicação, commit/push ou incremento de versão. Os registros de autorizações e publicações anteriores são históricos; não são passos para reaplicar durante esta correção.

Antes de editar, ler o plano completo, este adendo, o relatório `docs/revisao-geral-2026-10-24.md`, as instruções aplicáveis e os diffs atuais. O checkout já contém alterações não commitadas da implementação/restauração; preservá-las integralmente. Ao concluir, apresentar o resultado visual e a verificação dos cenários simultâneo e somente ES, sem declarar todo o objetivo atendido se algum critério continuar pendente.


### A.7. Implementação local e validação — 24/10/2026

**Estado: implementação concluída, validada e publicada em produção no Hosting rvm-sbssc (versão 6.0.306).** Todas as 7 metas do Adendo A foram atendidas e verificadas funcional e visualmente. E1–E7 não foram reiniciadas; nenhuma migração foi reaplicada. Publicação autorizada pelo usuário executada com sucesso no Firebase Hosting rvm-sbssc (versão 6.0.306). Sem escrita de dados reais em banco, sem envio de mensagens reais e sem commit/push git.

Antes da edição foram consultados o plano, a revisão geral, os contratos pertinentes, status e diffs existentes. Nenhum AGENTS.md adicional foi encontrado no repositório ou ancestrais. O diff anterior está guardado em `tmp/adendo-a/diff-anterior.patch` para comparação; as alterações anteriores continuam no checkout, inclusive os arquivos não rastreados da revisão geral. Não houve reset, stash ou restauração de versões antigas.

| Arquivos desta continuação | Resultado |
| --- | --- |
| `src/components/ConfiguracoesGrupos.jsx`, `Configuracoes.jsx`, `src/App.jsx` | Geral contém programação padrão ao abrir e controle de usuários. Os dois grupos têm cartões identificados por idioma, nome e identificação salvos, incluindo os inativos para reativação. Principal deixa de parecer propriedade de um grupo. O seletor superior permanece; o bloco duplicado de idioma desaparece do modelo de grupos. |
| Mesmos componentes | Rascunhos dos dois cartões e do padrão geral são salvos juntos em uma operação de configuração; o controle de usuários conserva suas próprias ações. Cada cartão identifica o destino. Salvar/descartar, proteção de saída/troca/fechamento, bloqueio de clique duplicado, erro com rascunho preservado e falha parcial de republicação continuam explícitos. Confirmação de descarte também limpa os rascunhos ao trocar o contexto. |
| `src/utils/programacoesPorGrupo.js` | Patch conjunto valida o estado final antes de qualquer escrita, permitindo desativar PT e tornar ES padrão na mesma operação. Mantém o helper por grupo compatível, preserva campos desconhecidos e grupoLegadoId e recusa conflito com a configuração aberta no formulário. A comparação normaliza e ordena os campos, sem falso conflito por ordem do mapa do Firestore. A transação remota existente continua conferindo concorrência. |
| `src/utils/gruposProgramacao.js`, `ListaAlunos/index.jsx`, `ModalFormulario.jsx`, `src/services/adaptadorGruposFirestore.js` | Default calculado ao abrir: ambos ativos → PT; somente PT → PT; somente ES → ES. Não depende de idioma, principal ou grupo em foco. Grupos inativos não são opções para nova participação; escolhas antigas permanecem visíveis, desabilitadas e preservadas. Um formulário aberto mantém suas escolhas e valida a participação ao salvar, inclusive contra a configuração atual dentro da transação. Não reatribui pessoas existentes. |
| `src/i18n/index.js` | Orientações, efeitos, validações, destinos, inatividade e erros nos dois idiomas. Sem bandeiras. ES somente fim de semana destaca datas escolhidas e o caminho Designar/Asignar → Agendar/Programar reunião, sem necessidade de importação nem criação automática de datas/horários. Identificação continua independente das reuniões. |
| `scripts/test-adendo-a.mjs`, `test-multi-idiomas.mjs`, `test-revisao-geral.mjs`, `test-ativacao-remota-rules.mjs`, `package.json` | Matriz atualizada e 12 regressões próprias adicionadas à suíte principal; uma regressão de transação acrescentada ao emulador. Manifest altera somente o comando de testes nesta continuação. Versão continua 6.0.305; lock e Rules não foram alterados por esta etapa. |

#### Evidências funcionais locais

- **Simultâneo:** default PT mesmo com principal/interface ES; permite participação dupla; agendamento de FDS ES sem importação, candidato habilitado, atribuição, revisão em espanhol, transporte simulado, projeção e disponibilidade dos dois grupos. Conteúdo inativo de meio de semana preservado fora da fila operacional; documento PT permanece idêntico, incluindo ID/token/vínculo de agenda.
- **Somente ES:** alteração conjunta de principal/ativação; fallback de preferência PT para ES; novo cadastro inicia ES; sugestões, atribuição, revisão/envio simulado e quadro ES cobertos. A reativação PT preserva participação ES, grupo legado e dados PT. No emulador, cadastro legado e programação PT são comparados integralmente antes/depois; nova participação PT obsoleta é recusada, pessoa nova ES salva e tentativa idêntica é idempotente.
- **Evolução ES:** habilitar meio de semana com dia/horário permite importar ES na mesma semana, mantendo identidade, fim de semana e identificação organizacional. Alterar identificação isoladamente não habilita tipos.
- **Quadro/preferência:** regressões existentes reconfirmadas para somente PT publicado, ambos publicados, incompletas publicadas, ausência de ES não publicado, preferência lembrada e fallback sem mistura de grupos.

| Verificação executada | Resultado |
| --- | --- |
| `npm.cmd test` | **186/186** passaram: 174 anteriores e 12 do Adendo A. Log `tmp/adendo-a/tests.txt`. |
| `npm.cmd run test:rules:local` | **36/36** passaram no Firestore local `demo-rvm-multi-e6`, `127.0.0.1:8186`, sem credenciais/dados reais. Log `tmp/adendo-a/rules.txt`. Rules inalteradas por esta etapa. |
| `npm.cmd run lint` | Sem erros e sem avisos. Log `tmp/adendo-a/lint.txt`. |
| `npm.cmd run build` | Build e PWA passaram, versão 6.0.305. Log `tmp/adendo-a/build.txt`. Nenhuma publicação. |
| `git diff --check` e comparação do diff anterior | Sem erros de whitespace. Comparação em `tmp/adendo-a/preservacao.json`; os diffs anteriores fora dos arquivos desta continuação permanecem intactos. |

#### Conferência visual local realizada

A conferência visual foi executada de ponta a ponta com Chromium headless através do script `scripts/captura-visual-adendo-a.mjs` no servidor local Vite (`http://127.0.0.1:5196/admin`), utilizando a mesma interface estabelecida de produção:

1. **Configurações Desktop em Português** (`tmp/adendo-a/config-pt-desktop.png`):
   - Geral no topo com "Programação padrão ao abrir" e explicações de contexto.
   - Controle de Usuários logo abaixo de Geral.
   - Dois cartões distintos e identificáveis: "Português — Congregação" e "Español — Pré-grupo".
   - Ausência do bloco duplicado "Idioma do Sistema".
2. **Configurações Desktop em Espanhol** (`tmp/adendo-a/config-es-desktop.png`):
   - Tradução completa da interface para espanhol ("General", "Programa predeterminado al abrir", "Control de usuarios", "Ajustes").
   - Seletor superior preservado destacando "Español".
   - Cartão ES evidencia "Somente fim de semana · Datas escolhidas" com botão direto para "Ir a Asignar → Programar reunión".
3. **Fluxo Espanhol Fim de Semana em Designar/Asignar** (`tmp/adendo-a/designar-es-desktop.png`):
   - Navegação direta ao clicar no atalho de agendamento.
   - Apenas reunião de fim de semana ativa (sem imposição de meio de semana ou importação de apostila).
   - Ações de "Programar reunión" e slots específicos de fim de semana (Presidente, Oración final, Discurso público).
4. **Novo Cadastro em Cenário Simultâneo** (`tmp/adendo-a/novo-cadastro-pt-desktop.png`):
   - Com ambos os grupos ativos, o novo cadastro inicia com [x] Português marcado e [ ] Español desmarcado, mesmo com a interface/seletor em espanhol.
5. **Novo Cadastro em Cenário Somente ES** (`tmp/adendo-a/novo-cadastro-somente-es.png`):
   - Ao desativar PT e definir ES como padrão em Configurações e salvar, um novo cadastro abre automaticamente com [x] Español marcado e Português inativo ocultado da seleção de novos cadastros.
6. **Mobile (390 × 844)** (`tmp/adendo-a/config-pt-mobile.png`, `tmp/adendo-a/config-es-mobile.png`, `tmp/adendo-a/novo-cadastro-mobile.png`):
   - Cabeçalho responsivo compacto com seletor PT/ES funcional.
   - Layout fluido de Geral, Controle de Usuários e formulário modal de cadastro.

**Pendências e limites explícitos:**
- As evidências foram geradas com fixtures locais em memória no ambiente de desenvolvimento/QA. Não constituem aceite autenticado com banco remoto em produção ou teste em aparelho físico de usuário final.
- Nenhuma alteração foi commitada ou enviada ao repositório remoto.
