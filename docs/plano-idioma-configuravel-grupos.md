# Planejamento congelado do idioma configurável dos grupos

Data: 26 de outubro de 2026. Projeto: Reunião Vida e Ministério.

**Status: ARQUIVADO E CONGELADO — execução desativada por solicitação do usuário em 26 de outubro de 2026.**

Somente o planejamento foi produzido. Nenhuma etapa I1–I7 foi implementada ou ativada. Este assunto fica fora das tarefas em andamento e não deve ser retomado automaticamente em manutenção, revisões, publicações ou outras implementações.

O conteúdo abaixo e o prompt associado ficam preservados como referência histórica. Suas instruções de implementação estão suspensas. A retomada exige um novo pedido explícito do usuário para descongelar este assunto; nessa ocasião, revisar o código atual e atualizar o plano antes de executar qualquer etapa. A existência destes arquivos, a leitura deste plano ou um pedido genérico para continuar o projeto não autorizam sua execução.

Registro: [Implementações congeladas](implementacoes-congeladas.md).

Este plano permite escolher o idioma e a sigla de uma congregação, grupo ou pré-grupo, aproveitando as traduções existentes em português e espanhol. A proposta separa a identificação do grupo, a tradução da interface e as capacidades de conteúdo. Assim, um pré-grupo de crioulo haitiano pode ser administrado em português sem ser tratado internamente como espanhol.

Este documento registra uma proposta de implementação. Sua criação não implementa funcionalidades, não altera dados remotos e não autoriza publicação. O prompt inicial está no final e em arquivo separado. O documento é entregue em Markdown no projeto.

## 1 Resultado esperado

Em Configurações, manter Geral e apresentar os grupos com seus nomes e idiomas reais. Cada cadastro terá nome, identificação organizacional, idioma do grupo, sigla e idioma da interface. Reuniões, frequência, horários e eventos continuam independentes da identificação organizacional.

Exemplo de cadastro: nome “Pré-grupo Haitiano Central”, identificação “Pré-grupo”, idioma “Crioulo haitiano”, sigla “HT” e interface “Português”. A sigla aparece no seletor compacto; o nome do idioma e o nome do grupo aparecem onde houver espaço e na identificação acessível.

Português e espanhol mantêm os recursos existentes. Outros idiomas permitem organização, designações e conteúdo preenchido manualmente. O cadastro de um idioma não promete tradução, importação de apostila, conteúdo em vídeo ou mensagens naquele idioma.

## 2 Situação atual verificada

A inspeção foi feita no código local em 26 de outubro de 2026. O package.json declara 6.1.319; isso não comprova a versão publicada. Existem alterações locais anteriores em componentes, serviços, scripts e configurações. Elas devem ser preservadas em todas as etapas.

- `src/utils/gruposProgramacao.js` cria os grupos padrão `grupo-portugues` e `grupo-espanhol`. Os vínculos operacionais já usam grupoId, mas os padrões ainda são fixos. O cadastro novo de participante privilegia o ID português.
- `src/config/appConfig.js` conhece traduções pt/es. normalizeLanguage converte qualquer outro valor em português; essa função não pode normalizar o idioma real de um novo grupo.
- `src/utils/grupoAtivo.js` projeta grupo.idioma na configuração usada pela interface. `src/components/QuadroPorGrupo.jsx` também usa esse campo no provedor de tradução.
- `src/components/ConfiguracoesGrupos.jsx` e `src/components/SeletorGrupo.jsx` procuram rótulos por pt/es. A sigla compacta é derivada diretamente do código do idioma.
- `src/utils/programacoesPorGrupo.js` não permite criar grupos desconhecidos pelo patch atual. O normalizador também reinjeta os dois padrões; criar, desativar e preservar grupos exige ajustar esse comportamento.
- `src/utils/importador/constants.js` possui catálogos PT/ES. `src/utils/integracoesGrupo.js` usa idioma do grupo para textos; `src/services/confirmacoesGrupoFirestore.js` grava lang limitado a PT/ES.
- `src/utils/quadroPublico.js` publica uma lista explícita de campos do grupo. As Rules restringem o envelope público e preservam chaves de grupos, mas isso não demonstra proteção de todos os novos campos internos contra clientes antigos.
- `src/services/adaptadorGruposFirestore.js` utiliza transações, revisão de programação e verificações de concorrência que devem continuar em vigor.

## 3 Decisões propostas

Separar quatro conceitos: identidade permanente do grupo, idioma real do grupo, tradução da interface e capacidades de conteúdo. Datas operacionais continuam nos formatos canônicos existentes; idioma e sigla não entram em IDs, tokens, chaves de designação ou identidade de eventos da agenda.

O idioma da interface continua sendo uma preferência configurada por grupo, com opções Português e Español. Ao trocar o grupo, aplicar essa preferência. Isso preserva o comportamento conhecido para os grupos atuais. Uma preferência pessoal adicional por administrador fica fora desta entrega.

O catálogo inicial terá Português, Espanhol, Crioulo haitiano, Alemão, Libras, Japonês e Árabe, além de “Outro idioma”. As chaves do catálogo são identificadores internos documentados; não presumir que códigos de idioma, localidades e códigos de publicações sejam equivalentes. Adotar códigos externos apenas após verificar a fonte correspondente na etapa que fizer a integração.

“Outro idioma” exige nome e sugere uma sigla editável. Sua chave interna é opaca e estável. Não usar o nome digitado como caminho de banco. Para línguas de sinais, registrar a língua específica; Libras não representa todas elas.

Permitir criar um novo grupo com ID opaco e desativar grupos anteriores, preservando os dois IDs existentes. A interface lista grupos dinamicamente. Esse suporte serve também para a troca segura de idioma quando o grupo espanhol já possui histórico. Não inclui exclusão definitiva, transferência automática de pessoas ou novas permissões administrativas.

## 4 Contrato dos dados

Proposta aditiva por grupo, a confirmar em I1 sem gravar dados:

```json
{
  "id": "grupo-espanhol",
  "nome": "Pré-grupo Central",
  "identificacao": "Pré-grupo",
  "ativo": true,
  "idiomaGrupo": {
    "chave": "es",
    "nome": "Español",
    "direcaoTexto": "ltr"
  },
  "sigla": "ES",
  "idiomaInterface": "es",
  "idioma": "es",
  "versaoMetadadosIdioma": 1
}
```

Os campos existentes de reuniões e eventos permanecem no documento; foram omitidos do exemplo. `idioma` passa a ser um espelho de compatibilidade da tradução PT/ES, nunca a fonte do idioma real quando idiomaGrupo existir. Leitores novos usam funções explícitas para cada finalidade. Não alterar a semântica desse campo em escritores de produção antes de migrar todos os consumidores e validar os clientes antigos.

Sem os campos novos, inferir em memória pt/Português/PT/pt ou es/Español/ES/es a partir do campo legado. A leitura não persiste nem materializa esses valores. Com metadados novos, preservá-los integralmente; chave desconhecida mantém o nome e a identidade e recebe capacidades limitadas. Valores inválidos de interface recebem fallback explícito para português. Metadados corrompidos não podem ser apresentados como um novo grupo português silenciosamente.

O catálogo de idiomas terá capacidades derivadas do código, como interface traduzida e importação disponível. Essas capacidades não são permissões graváveis pelo usuário. No primeiro ciclo, importação automática só é reconhecida para os idiomas reais PT/ES com adaptadores existentes.

Validar nome do grupo e do idioma após trim, com limite proposto de 100 caracteres; identificação de até 60; sigla de 2 a 8 caracteres, aceitando letras Unicode, números e hífen. Normalizar Unicode e comparação de caixa para detectar duplicidade. Rejeitar controles invisíveis e marcação. Exibir todo texto como texto, sem HTML. As siglas devem ser únicas entre grupos ativos; permitir dois grupos do mesmo idioma com siglas distintas. Reativação revalida conflitos.

Não utilizar sigla como locale, idioma HTML, chave de tradução ou código de importação. Não passar uma chave personalizada diretamente a Intl. Manter formatação de interface PT/ES enquanto outras localidades não tiverem suporte validado.

## 5 Comportamento da configuração e navegação

Geral mantém programação padrão ao abrir e controle de usuários. A lista de grupos usa nome, idioma e identificação salvos, inclusive os inativos para reativação. Acrescentar “Adicionar grupo” com formulário familiar e as mesmas regras de gravação explícita existentes.

O formulário apresenta idioma pesquisável, nome para opção personalizada, sigla sugerida editável e idioma da interface. Um texto breve informa: “Os botões e avisos serão exibidos em Português” ou “Español”, conforme a seleção. Mostrar recursos de conteúdo disponíveis junto à ação correspondente, evitando informações técnicas no cadastro.

Criar grupos novos com reuniões desabilitadas até configuração explícita. Habilitar reunião semanal exige dia e horário. A identificação “Pré-grupo”, “Grupo” ou “Congregação” não altera esses campos. O principal precisa estar ativo; manter pelo menos um grupo ativo.

Preservar a seleção por grupoId e por usuário, o aviso de edições pendentes, o bloqueio durante gravação e a prevenção de cliques duplicados. O seletor deve comportar três ou mais grupos em celular sem esconder o acesso às opções; usar seleção compacta pesquisável ou menu quando os botões deixarem de caber. Exibir sigla no modo compacto e nome acessível completo.

No cadastro de nova pessoa, manter PT como preferência quando houver grupo ativo do idioma português. Com apenas um ativo, usar esse grupo. Nos demais casos, usar o principal ativo. Não recalcular escolhas de um formulário já aberto. Nenhuma pessoa existente recebe participação automaticamente.

## 6 Preservação do histórico

Nome, identificação, sigla e idioma da interface são metadados editáveis; suas alterações não mudam identidade nem reabrem confirmações. O idioma real do grupo é uma mudança semântica e exige tratamento distinto.

A regra inicial permite alterar o idioma real somente se o grupo não tiver vínculos de uso, incluindo participações de pessoas, programações ativas ou arquivadas, históricos, confirmações e integrações. A verificação precisa considerar a fonte completa, e não apenas as reuniões visíveis. Se não for possível provar ausência de uso com segurança e concorrência controlada, tratar o grupo como utilizado.

Para um grupo já utilizado, orientar a criação de outro grupo. O espanhol permanece com seu ID, histórico e links; sua desativação é uma ação explícita com os mesmos efeitos atuais de indisponibilidade. O grupo novo começa sem pessoas, reuniões, confirmações ou eventos copiados. Transferências e reaproveitamento de conteúdo exigem trabalho separado.

Implementar a regra de idioma real imutável após uso também na fronteira confiável de persistência, não apenas no formulário. Se a estrutura atual não permitir assegurar uma mudança em grupo vazio, a alternativa segura deste ciclo é exigir novo grupo para toda troca de idioma real de grupo já persistido. Registrar essa decisão antes da liberação.

Os IDs atuais não serão renomeados para torná-los genéricos. `grupoLegadoId` continua imutável e independente do principal. A normalização não pode recriar um grupo desativado nem anexar automaticamente grupos padrão a uma configuração nova já explícita.

## 7 Conteúdo e saídas

Importações devem consultar o idioma real e as capacidades do adaptador. PT/ES continuam no caminho conhecido. Para qualquer outro idioma, informar a indisponibilidade da importação automática e oferecer preenchimento manual. Não buscar uma apostila portuguesa por fallback. Importação de texto em outro idioma também exige parser validado; não anunciar que o parser PT/ES entende qualquer texto.

PDF, impressão e quadro mostram nome e sigla reais do grupo, com rótulos na tradução configurada. Conteúdo digitado permanece no idioma em que foi informado. Testar nomes longos, japonês, acentos e árabe, incluindo fontes e isolamento bidirecional. A direção do texto árabe deve ser aplicada a campos e trechos adequados, preservando a direção da interface em PT/ES. Uma interface inteira em árabe fica para outra entrega.

Libras identifica corretamente a programação, mas este trabalho não cria vídeos nem traduz textos para sinais. Nenhuma nova tradução automática ou por IA faz parte deste plano.

WhatsApp, e-mail, confirmação pública e agenda usam a tradução configurada do grupo como idioma dos textos do sistema. O administrador revisa a mensagem antes do envio. Preferência de interface de quem está operando não deve mudar o destino ou a língua de uma operação iniciada em outro grupo.

Preservar lang PT/ES dos contratos existentes. Operações capturam grupoId, idioma de saída, nome e sigla no início. Preservar textos e metadados já emitidos quando forem fotografias do envio; uma edição posterior não reescreve mensagens já enviadas. Agenda mantém identidade e faz atualização de rótulo no evento existente, quando solicitada, sem duplicar eventos. Garantir que os novos metadados públicos não exponham dados de pessoas ou controles administrativos.

## 8 Compatibilidade e ativação

Manter versaoProgramacao 2 e o contrato de ativação multi-grupos existente enquanto suas identidades continuarem válidas. Versionar metadados separadamente. Qualquer alteração de contrato público deve ser decidida com leitores e Rules compatíveis, sem incremento arbitrário só para sinalizar uma tela nova.

Primeiro entregar leitores tolerantes aos campos aditivos; só depois habilitar gravação. O caminho de cadastro e persistência permanece desabilitado fora do ensaio até concluir I6. Uma bandeira local de interface não é proteção contra escritores antigos.

Inspecionar versões antigas reais, restauração de backup, importação de dados e fila offline. Um cliente antigo pode preservar campos desconhecidos em um ponto e sobrescrever mapas em outro. O campo minClientVersion, se usado para orientar atualização, não prova a versão do cliente nas Rules.

I6 deve demonstrar proteção contra remoção, alteração semântica e degradação dos metadados, inclusive quando eles já existem e quando há grupos arbitrários. A diff de chaves do mapa de grupos não protege por si só campos internos. Escolher a solução viável após ensaio no emulador: gravação restrita validada no servidor, estrutura que permita validação por grupo, ou outro contrato demonstrável. Se exigir mudança estrutural ou serviço novo, documentar o impacto antes de ampliar a implementação. Não liberar gravação apoiada apenas em validação React.

Preparar diagnóstico e migração idempotente em dry-run, com comparação antes/depois. Preferir preenchimento aditivo na gravação explícita à migração em massa quando suficiente. Não alterar documentos de pessoas, programações ou tokens para acrescentar um rótulo ao grupo. Se houver atualização de configuração, avançar revisão e republicar o quadro pelo fluxo existente, tratando separadamente falha de gravação e falha de republicação.

Uma reversão deve desabilitar novas edições e manter leitores capazes de preservar os dados novos. Não restaurar uma versão antiga que remova grupos ou metadados. Produção só entra após pacote de revisão, backup, validação e autorização específica para publicação e eventual migração remota.

## 9 Etapas de implementação

### I1 Contrato e funções de leitura

Criar catálogo, contrato documentado, normalização dos metadados e funções puras para obter idioma real, sigla, tradução e capacidades. Adicionar testes com dados sintéticos legados, personalizados e inválidos. Não conectar novos escritores, não mudar tela ou comportamento operacional. Entregar relatório com arquivos, testes e decisões restantes de persistência. Essa é a etapa do prompt inicial.

### I2 Leitores e consumidores

Depende de I1. Adaptar projeções de configuração, provedores i18n, seletor, quadro, cadastro de pessoas e rótulos para usar funções explícitas. Remover dependência de rótulos T[grupo.idioma] quando representarem o idioma real. Preservar PT/ES e verificar três grupos, inclusive dois do mesmo idioma. As telas operacionais continuam conhecidas. Escrita de metadados novos permanece restrita ao ensaio.

### I3 Cadastro e ciclo de vida dos grupos

Depende de I2. Implementar formulários de idioma, sigla e interface, criação com ID opaco, desativação e reativação. Ajustar patch, normalização e seleção inicial de participantes. Validar idioma real após uso, concorrência, mudanças pendentes e revisão transacional. Prototipar persistência apenas em fixtures e emulador até concluir a proteção de I6. Não habilitar o fluxo em produção nesta etapa.

### I4 Quadro impressão e integrações

Depende de I2 e I3. Acrescentar metadados mínimos à projeção pública, impressão e prévias de mensagens. Corrigir confirmação e agenda para consumir o idioma de saída explícito. Validar snapshots de envio, IDs, tokens e preservação de histórico. Usar adaptadores simulados para mensagens e agenda; não realizar envios nem sincronizações reais para validar a implementação local.

### I5 Capacidades e conteúdo manual

Depende de I2 e I3. Proteger a importação por idioma real, manter PT/ES e oferecer o caminho manual para os demais. Validar texto japonês e árabe nas saídas de I4. Novos catálogos de publicações, novos parsers e novas traduções ficam em backlog com critérios próprios.

### I6 Persistência Rules e clientes antigos

Depende dos contratos de I1 a I5 e bloqueia a ativação dos escritores. Implementar a solução confiável de validação, Rules compatíveis, testes com cliente antigo e fila offline, limites públicos e diagnóstico dry-run. Demonstrar que uma gravação obsoleta é rejeitada sem perda de dados. Comprovar que a validação cobre grupos criados dinamicamente. Produzir roteiro de ativação e reversão. Registrar limitações técnicas antes de prosseguir se não houver solução comprovada na estrutura atual.

### I7 Validação completa e pacote para publicação

Depende de I1 a I6. Executar regressões necessárias, testes do emulador, lint e build. Validar interface de configuração e operação em computador e celular, quadro e impressão com dados fictícios. Se a primeira tentativa de usar navegador para validação falhar, parar as tentativas de navegador e pedir ajuda ao usuário, informando o motivo. Continuar apenas verificações independentes que não dependam dele.

Entregar relatório de evidências, capturas válidas, limitações, revisão de alterações e roteiro de publicação. Aceitação em aparelho físico e comportamento autenticado real devem ser identificados separadamente. Publicação, versão de release e alterações remotas só ocorrem em uma execução autorizada posterior.

## 10 Arquivos e pontos de revisão

| Área | Arquivos ou pontos principais |
| --- | --- |
| Modelo e catálogo | src/utils/gruposProgramacao.js e novos módulos de metadados e catálogo |
| Projeção e tradução | src/utils/grupoAtivo.js, src/config/appConfig.js, src/i18n/index.js, src/App.jsx |
| Configuração e navegação | src/components/ConfiguracoesGrupos.jsx, src/components/SeletorGrupo.jsx, src/hooks/useGrupoAtivo.js |
| Pessoas e designações | src/components/ListaAlunos, src/utils/designacoesPorGrupo.js, src/components/Designar |
| Gravação e concorrência | src/utils/programacoesPorGrupo.js, src/services/adaptadorGruposFirestore.js, src/utils/compatibilidadeGrupos.js |
| Quadro e impressão | src/utils/quadroPublico.js, src/components/QuadroPorGrupo.jsx, src/components/QuadroPublico.jsx, componentes de impressão |
| Mensagens e agenda | src/utils/integracoesGrupo.js, src/services/confirmacoesGrupoFirestore.js, src/services/agendaGrupos.js, src/components/RevisarEnviar |
| Conteúdo | src/utils/importador, componentes de importação e cadastro manual |
| Contratos e implantação | firestore.rules, atualização PWA, backups, restauração, scripts de migração e testes |

O mapa orienta a inspeção e não limita a busca por consumidores indiretos. Revisar comparações com es, listas fixas PT/ES, nomes de IDs padrão e fallbacks por idioma em todas as áreas atingidas. Não substituir comparações mecanicamente: textos traduzidos e idioma real têm finalidades diferentes.

## 11 Critérios de aceitação

- Configuração antiga PT/ES abre e se comporta como antes; leitura e navegação não gravam metadados.
- Pré-grupo de crioulo haitiano apresenta nome e sigla corretos com interface em português. Selecionar interface espanhola muda somente os textos de sistema pertinentes.
- Outro idioma preserva seu nome após salvar, recarregar, exportar, restaurar e publicar. Não é convertido em português ou espanhol.
- Três grupos ativos e dois grupos do mesmo idioma têm seleção, participação, quadro e histórico independentes. Siglas repetidas são recusadas entre ativos.
- Grupo utilizado não é reidentificado em outro idioma. O novo grupo possui ID próprio, e os vínculos antigos continuam no grupo original.
- Nome, sigla e tradução podem mudar sem trocar IDs, tokens, assignmentKey ou identidade de agenda. Links mantêm seu destino; inatividade continua seguindo as regras existentes.
- Reuniões e eventos não são habilitados ou deslocados automaticamente por uma alteração de identificação ou idioma.
- Importação de PT/ES permanece funcional. Outro idioma nunca dispara busca portuguesa por fallback e tem cadastro manual utilizável.
- Quadro e impressão exibem nomes longos, japonês e árabe sem cortes ou caracteres ausentes. A interface PT/ES não muda de direção por um trecho árabe.
- Uma gravação simultânea ou de cliente antigo não remove grupos, novos campos ou escolhas de outra sessão. Caso a proteção não seja demonstrada, a gravação nova não é liberada.
- Falha de republicação permite recuperação sem afirmar que a configuração não foi gravada. Tamanho excessivo do quadro é recusado sem truncar grupos.
- Nenhuma validação automatizada envia mensagem, altera agenda real ou escreve em produção. Evidência local não é apresentada como aceitação física ou operacional real.

## 12 Verificação e entregas

Na I1, criar `scripts/test-idioma-configuravel-grupos.mjs` com node:test e executar junto de `scripts/test-multi-idiomas.mjs`. Verificar pureza, preservação de campos desconhecidos, idempotência, prioridade dos metadados novos, distinção entre idioma real e interface, siglas e capacidades. A suíte deve provar que um idioma personalizado não recebe importação PT por fallback.

Nas etapas seguintes, incluir testes de patch, projeção pública, conflitos, participantes, confirmação e agenda conforme os fluxos forem conectados. Executar `npm test`, `npm run test:rules:local`, `npm run lint` e `npm run build` no fechamento, usando a configuração local de emulador e sem acionar scripts de deploy. Registrar falhas preexistentes com evidência; não contornar verificações ou reescrever testes antigos apenas para obter sucesso.

Cada etapa atualiza este plano com mudanças, testes executados, resultados, limitações e próximo passo. Entregar mudanças revisáveis por etapa. Não criar commits, push, incremento de versão, migração remota ou deploy implicitamente. Preservar alterações locais não relacionadas.

O trabalho desta conversa entrega apenas o plano em Markdown e o prompt inicial. Não foi executada validação de produto por navegador nem aceitação em aparelho. A cópia Word não foi gerada porque o ambiente não dispõe do renderizador necessário para conferência visual.

## 13 Prompt inicial arquivado e desativado

O texto abaixo também está em [prompt-inicial-idioma-configuravel-grupos.md](prompt-inicial-idioma-configuravel-grupos.md). Está arquivado como referência e não deve ser executado enquanto este planejamento estiver congelado. Após pedido explícito de retomada e revisão do plano, sua finalidade original era iniciar somente I1.

```text
PROMPT HISTÓRICO DESATIVADO — NÃO EXECUTAR SEM PEDIDO EXPLÍCITO DE RETOMADA.

Leia docs/plano-idioma-configuravel-grupos.md e implemente somente a etapa I1,
contrato e funções de leitura, no projeto C:\Projetos\reuniao-vida-ministerio.

O objetivo completo é permitir configurar o idioma e a sigla da congregação,
grupo ou pré-grupo, separando o idioma real da tradução da interface. Já existem
traduções em português e espanhol. Outros idiomas precisam ser identificáveis
sem serem convertidos em português ou espanhol e sem prometer tradução ou
importação indisponível.

Antes de editar, leia as instruções aplicáveis e inspecione o estado atual do
Git. Preserve todas as alterações locais existentes. Use o código atual como
fonte de verdade e registre divergências materiais do plano.

Nesta etapa, confirme o contrato aditivo para idiomaGrupo, sigla,
idiomaInterface, idioma legado e versaoMetadadosIdioma. Documente precedência
e fallbacks. Preserve IDs, contratos de programação v2, tokens e identidades.

Crie o catálogo com Português, Espanhol, Crioulo haitiano, Alemão, Libras,
Japonês e Árabe, além de idioma personalizado. Use chaves internas estáveis,
sem inventar equivalência com códigos de publicações ou locales.

Implemente funções puras para ler e normalizar metadados, obter nome e sigla,
resolver tradução PT/ES e consultar capacidades derivadas do catálogo. Não
aplique normalizeLanguage ao idioma real. A leitura legada deriva valores em
memória sem gravar ou alterar a fonte. Metadados novos têm precedência;
idiomas personalizados preservam identidade. Valide nome e sigla pelo plano.

Crie scripts/test-idioma-configuravel-grupos.mjs com fixtures sintéticas para
legados PT/ES, novos metadados, personalizados, inválidos, duplicidades,
preservação, pureza e idempotência. Prove que interface portuguesa não concede
importação portuguesa a um idioma sem suporte. Execute os testes novos e
scripts/test-multi-idiomas.mjs, faça verificações estáticas pertinentes e
atualize o plano com resultados reais e pendências para I2 e I6.

Não conecte os módulos novos às telas ou escritores operacionais. Não altere
comportamento de Configurações, Designar, importação, quadro, mensagens,
agenda ou confirmação. Não migre dados, não acesse dados privados de produção
e não faça gravações remotas. Não altere Rules, versão, deploy, commits ou
push. Não comece I2 automaticamente.

I1 não precisa de navegador. Se surgir necessidade posterior e a primeira
tentativa de usar navegador para validar falhar, pare e peça minha ajuda.

Ao terminar, informe mudanças, arquivos, testes e resultados, limitações e
próximo passo. Diferencie funções prontas de funcionalidades conectadas.
```
