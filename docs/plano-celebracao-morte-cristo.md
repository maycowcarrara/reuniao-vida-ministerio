# Plano: Celebração da morte de Jesus Cristo

Data: 24/10/2026.
Status: proposta para revisão; implementação aguardando a conclusão da divisão de idiomas pelo usuário.

## 1. Objetivo e regra de produto

Adicionar **Celebração da morte de Jesus Cristo** à Gestão de Eventos e Visitas.
A celebração substitui somente uma das reuniões da semana, conforme o dia exato
cadastrado. A outra reunião continua com programação e designações normais.

Este plano considera a última definição do pedido: a celebração terá designações
próprias, em vez de aparecer somente como observação.

| Data da celebração | Área de meio de semana | Área de fim de semana | Importação da programação normal do meio de semana |
| --- | --- | --- | --- |
| Segunda a sexta | Celebração, com data, discurso e apoio | Reunião normal, com todas as designações | Bloqueada |
| Sábado ou domingo | Reunião normal, com todas as designações | Celebração, com data, discurso e apoio | Permitida |

A classificação depende do dia da celebração, mesmo que seja diferente do dia
habitual da reunião. A semana vai de segunda a domingo; uma celebração no domingo
pertence à semana iniciada na segunda-feira anterior.

Assembleias e congresso continuam com a regra de cancelamento das duas reuniões
descrita pelo usuário. A visita do superintendente mantém seu tratamento próprio.
Não usar o bloqueio integral de assembleia/congresso para a celebração.

## 2. Conteúdo da celebração

Na área da reunião substituída, apresentar:

- Título: **Celebração da morte de Jesus Cristo**.
- Data exata, com dia da semana; horário próprio para a celebração.
- **Discurso da celebração**: nome do orador em campo livre, seguindo a forma de
  preenchimento do orador do discurso público. Não selecionar aluno, criar
  habilitação de orador ou exigir cadastro para esse campo.
- Apoio com as funções já existentes: vídeo/Zoom/som, indicadores da entrada,
  indicadores do auditório e microfones volantes.

O apoio reutiliza seleção de irmãos, habilitações, indisponibilidades, múltiplos
designados e sugestões existentes. Ausências e conflitos devem considerar a data
real da celebração, e a carga deve considerar também a outra reunião da semana.
O nome manual do orador não deve gerar cadastro, rodízio ou confirmação de aluno.

As partes normais da reunião substituída ficam inativas. Na celebração de fim de
semana, por exemplo, não exigir discurso público, dirigente/leitor da Sentinela
ou outros campos da reunião normal. A proposta inicial limita as designações da
celebração ao discurso e ao apoio solicitado; presidente e orações próprios ficam
como ponto de revisão, sem serem acrescentados por suposição.

## 3. Situação encontrada no código

- `src/utils/eventos.js` centraliza a busca do evento pela semana, mas os helpers
  de bloqueio atuais retornam apenas um booleano para assembleia/congresso.
- `src/App.jsx`, em `handleDefinirEvento`, guarda os eventos em
  `configuracoes.eventosAnuais`, atualiza uma programação se ela já existir e
  permite apenas um evento por semana. Não cria a semana quando ela não existe.
- `normalizeProgramacaoDates` e o fluxo de importação em `src/App.jsx` também
  alteram datas conforme o evento; não podem atribuir a data da celebração à
  reunião normal que continua ocorrendo.
- `src/components/Importador/index.jsx` e `RevisarImportacao.jsx` têm verificações
  de bloqueio que precisam ser aplicadas ao meio de semana, incluindo a
  confirmação final após eventual edição da data na revisão.
- A tela de designações possui travas, cálculo de completude, sugestões e
  renderização baseados no evento da semana. Algumas áreas de notificações
  descartam qualquer tipo diferente de `normal` e `visita`.
- `src/utils/fimDeSemana.js` já contém as quatro funções de apoio e a estrutura
  do discurso público com `oradorNomeManual`; `assignmentEligibility.js`
  concentra as regras de habilitação reutilizáveis.
- Dashboard, quadro público, impressão, notificações, confirmações e Google
  Agenda têm consumidores próprios da programação e das datas. Alterar só o
  formulário de eventos não cobre o pedido.

O comportamento das assembleias/congresso também deve ser conferido nos
consumidores: há comparações por nomes específicos e outras por trechos do nome.
Usar uma política compartilhada evita que os tipos `assembleia_betel` e
`assembleia_circuito` sejam interpretados de maneira diferente entre telas.

## 4. Estrutura proposta

### Política única por reunião

Evoluir `eventos.js` para resolver o estado da semana e devolver, conceitualmente:

```js
{
  meioDeSemana: 'normal' | 'celebracao' | 'sem_reuniao',
  fimDeSemana: 'normal' | 'celebracao' | 'sem_reuniao',
  bloqueiaImportacaoMeioDeSemana: false,
  dataCelebracao: ''
}
```

O contrato acima é ilustrativo. O nome e a assinatura dos helpers serão definidos
após a divisão de idiomas. A visita deve conservar as regras e datas atuais.
Todos os consumidores precisam consultar a mesma política, incluindo os handlers
de atribuição; esconder um campo na interface não basta para impedir sua edição.

### Persistência

Proposta de identificador estável: `celebracao`. Manter no cadastro do evento o
início canônico da semana e a data exata informada, como já ocorre com os demais
eventos. O dia da semana determina qual reunião será substituída.

Guardar as designações em um bloco opcional próprio da programação:

```js
celebracao: {
  horario: '',
  oradorNomeManual: '',
  responsabilidades: {
    videoZoomSom: [],
    indicadoresEntrada: [],
    indicadoresAuditorio: [],
    microfonesVolantes: []
  }
}
```

Usar a data do evento como referência da celebração, sem duplicá-la em vários
campos editáveis. Manter o fallback de `dataEventoEspecial` compatível com os
registros existentes e definir claramente a precedência da configuração atual.
A estrutura final deve acompanhar a separação de idiomas que estiver concluída.

Separar o bloco da celebração dos dados normais de meio/fim de semana permite
substituir a reunião sem converter indevidamente suas designações. Semanas antigas
sem esse bloco continuam válidas; não se prevê migração em massa.

### Criação da semana sem importação

Ao cadastrar a celebração, criar ou reutilizar um único registro da semana no
escopo correto, mesmo que a programação normal ainda não tenha sido importada.
Esse registro permite designar celebração e fim de semana quando a celebração
cai de segunda a sexta. Não exigir importação fictícia de partes para abrir a
semana e não depender de `partes.length > 0` para ela aparecer.

Quando a celebração cai sábado/domingo, a importação posterior deve preencher o
meio de semana no mesmo registro, preservando o evento e seu bloco de designações.
Rever a mesclagem no fluxo de importação para evitar substituir esses dados.
Reutilizar os mecanismos de identidade/deduplicação de `utils/programacoes.js`,
adaptando a chave ao escopo que a divisão de idiomas estabelecer.

### Datas, alterações e dados anteriores

- Manter independentes: início da semana, data da reunião normal de meio de
  semana, data da reunião normal de fim de semana e data da celebração.
- Interpretar a data como calendário local, sem conversão UTC que mude o dia.
- Não apagar automaticamente partes ou designações já preenchidas da reunião
  substituída. Elas ficam inativas e não entram na completude, nos conflitos,
  nas sugestões, na publicação nem nos novos envios enquanto estiverem inativas.
- Remover ou mudar a data do evento recalcula qual reunião está ativa. Revisar
  os dados preservados ao reativar a reunião; não copiar apoio entre reuniões
  silenciosamente, pois datas e disponibilidade podem ser diferentes.
- Alterar evento/data após publicação exige atualizar a projeção pública e a
  validade das confirmações afetadas. Registros históricos de envio permanecem
  históricos, mas não autorizam novos lembretes de designações inativas.
- Na revisão, decidir o comportamento de coexistência com outro evento na mesma
  semana. O cadastro atual substitui o anterior; não introduzir uma precedência
  silenciosa entre celebração, assembleia, congresso e visita.

## 5. Alcance da implementação

| Área | Trabalho previsto |
| --- | --- |
| Gestão de Eventos e Visitas / Dashboard | Nova opção, data exata em qualquer dia, explicação da reunião substituída e cadastro acessível sem importação; cobertura e pendências por reunião ativa. |
| `App.jsx` / persistência | Criar ou reutilizar a semana, preservar a outra reunião e o bloco da celebração em salvamentos/importações; datas corretas e identidade compatível com idiomas. |
| Importador e revisão | Bloquear apenas a programação normal do meio de semana substituído, com mensagem que informe celebração e data; validar também na entrada final da importação. |
| Designar / navegador / cabeçalho | Área de celebração na posição correta; orador manual e apoio habilitado; sugestões, conflitos, datas, completude e ações de limpar/substituir respeitando cada reunião. |
| Revisar e imprimir/PDF | Celebração acima e reunião normal abaixo quando cair de segunda a sexta; ordem inversa quando cair no fim de semana. Mostrar data, discurso/orador e apoio. |
| Quadro público e busca | Mesma ordem e conteúdo das reuniões ativas; busca dos designados de apoio; links de agenda com data/horário reais. Dados inativos não aparecem no payload público. |
| WhatsApp, e-mail e lembretes | Designações de apoio da celebração e da reunião normal continuam elegíveis aos fluxos existentes; campos manuais de orador seguem o tratamento do discurso público. Nenhum novo envio para a reunião substituída. |
| Confirmações públicas | Reconhecer as designações de apoio da celebração com identidade própria; invalidar vínculos de designações que deixaram de estar ativas ou mudaram de data. |
| Google Agenda | Gerar dados da celebração e da reunião normal com datas/horários independentes; avaliar reconciliação dos eventos antigos da reunião substituída para não deixar agenda contraditória. |
| Histórico, rodízio e estatísticas | Considerar designações efetivas da celebração e da reunião normal; excluir dados inativos dos cálculos operacionais e revisar os registros derivados já existentes. |
| Idiomas e regras de acesso | Adicionar os textos na estrutura resultante da divisão de idiomas e conferir validação/payloads nas Rules, sem presumir necessidade de publicação de Rules. |

A impressão atual inclui fim de semana opcionalmente no layout de uma semana.
Esse layout deverá suportar a semana completa com a celebração em qualquer uma
das duas posições. Nos layouts compactos, respeitar o escopo de reuniões que já
exibem, substituindo o bloco correspondente quando presente; ampliar a inclusão
de fim de semana nesses layouts fica como decisão de revisão, não como expansão
automática deste trabalho.

## 6. Sequência após a revisão

1. Reexaminar o repositório após a divisão de idiomas e atualizar este plano com
   o novo escopo de dados, arquivos de tradução e chaves de semana/evento.
2. Fechar as decisões de coexistência de eventos, campos da celebração e impressão.
3. Implementar política compartilhada, normalização, persistência e criação da
   semana; cobrir as regras de calendário e preservação dos dados com testes.
4. Integrar cadastro, importador e designações, incluindo todos os bloqueios de
   ação e cálculos de completude/carga.
5. Integrar revisão, impressão, quadro, notificações, confirmações, histórico e
   agenda; verificar que nenhum consumidor ainda cancela a semana inteira.
6. Validar os cenários abaixo, executar lint/build e fazer revisão visual local.
   Se a primeira tentativa de validação no navegador falhar, parar essa validação
   e pedir ajuda ao usuário, conforme a instrução fornecida.

## 7. Critérios de aceite

- Testar cada dia, de segunda a domingo, verificando a matriz da seção 1.
- Celebração na sexta bloqueia a importação do meio de semana e mantém o fim de
  semana normal; celebração no sábado/domingo permite importar o meio de semana.
- Domingo continua associado à segunda anterior; viradas de mês/ano e fuso não
  mudam a data escolhida.
- Sem programação anterior, cadastrar celebração permite abrir a semana e
  designar o apoio e a outra reunião, mesmo sem importação.
- Importar após cadastrar celebração no fim de semana não duplica a semana nem
  perde seu orador/apoio. Revisar data na importação reaplica o bloqueio correto.
- Reunião normal não afetada conserva partes, pessoas, data e horário.
- Orador da celebração é texto livre; apoio rejeita pessoas sem habilitação ou
  indisponíveis e mantém as regras de conflito/rodízio aplicáveis.
- Completude ignora todos os campos da reunião substituída e considera discurso
  e apoio conforme a mesma política de preenchimento exigido adotada pelo sistema.
- Trocar a data entre dia útil e fim de semana, mudar para outra semana, remover
  o evento e recarregar preserva os dados corretos e recalcula as reuniões ativas.
- Quadro, impressão e mensagens mostram celebração, data correta e designações
  ativas; partes inativas não geram novas notificações ou confirmações válidas.
- Agenda não move a reunião normal para a data da celebração; revisar tratamento
  dos itens já sincronizados usando dados de teste, sem envios reais nesta etapa.
- Semanas antigas, visitas, os dois tipos de assembleia e congresso mantêm o
  comportamento acordado; conferir separadamente cada consumidor.
- Conferir o isolamento de eventos/designações entre idiomas de acordo com a
  implementação concluída pelo usuário, sem criar regra paralela neste plano.

## 8. Limite desta entrega

Esta entrega adiciona somente este documento. A implementação fica aguardando
a conclusão da divisão de idiomas e a revisão do plano com o usuário. Código,
dados e arquivos já alterados por outros trabalhos não fazem parte desta entrega.
