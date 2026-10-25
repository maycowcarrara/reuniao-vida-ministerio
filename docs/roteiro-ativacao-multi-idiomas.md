# Preparação de ativação PT/ES — E7 local

24/10/2026. **Ativação remota bloqueada.** Este roteiro não é autorização de publicação ou migração. Versão preservada: 6.0.304.

## Resultado local e evidências

- Baseline E1–E6/habilitações: 141 testes. E7 acrescenta inventário, plano de migração em memória, retomada, idempotência, conflitos, relatório sem contatos/tokens e proteção visível contra cliente incompatível.
- `node scripts/ensaio-multi-idiomas-e7.mjs`: usa apenas fixtures por padrão. Relatório `tmp/e7-ensaio.json`; nenhum arquivo fonte é alterado. Para exportação local explicitamente fornecida: `node scripts/ensaio-multi-idiomas-e7.mjs --input export-local.json --output relatorio.json`. Não apontar para credenciais. O CLI não tem modo de execução remota.
- O plano fica apenas em memória. Relatório exporta hashes e identificação das operações, nunca os payloads privados. Hash identifica integridade/conflito; não criptografa o conteúdo de um export.
- `node --test scripts/test-multi-idiomas-e7.mjs`: regressões da migração simulada e prontidão. Suites E1–E6 e habilitações devem continuar passando.
- `.\node_modules\.bin\firebase.cmd emulators:exec --project demo-rvm-multi-e6 --config firebase.e6.local.json --only firestore "node --test scripts/test-multi-idiomas-e6-rules.mjs"`: inclui duas sessões SDK autenticadas ficticiamente, fila offline antiga e reconexão. Escrita degradada e exclusão v2 recusadas; documento atual preservado. Isso não equivale a duas abas de PWA instalado.
- Navegador: script `scripts/validar-multi-idiomas-e7-browser.mjs`, origem 127.0.0.1:5187, somente fixtures e rede externa abortada. Primeira abertura funcionou. Agendamento E3 com data/horário, seleção ES vazia, atribuição PT e envio/aceite/lembrete simulados foram executados. A captura do link de confirmação pegou transição de carregamento; evidência incompleta detectada e validação interrompida. Após autorização, a espera corrigida funcionou: confirmação final e alteração de resposta validadas. Na publicação PT/ES, foi detectado seletor público encoberto pelo cabeçalho; navegador interrompido. Após nova autorização, clique real e troca PT/ES conferidos. PDFs PT 1/2/4/5 renderizados e inspecionados, uma página cada com fixtures.

## Portões que permanecem fechados

1. Aceite no ambiente real e nos dispositivos aplicáveis. Os fluxos locais integrados, seletor, eventos/histórico/cancelamento e PDFs PT 1/2/4/5 já passaram; fixtures não substituem dados reais nem textos de tamanho arbitrário.
2. PWA instalado: atualizar entre bundles compatíveis, duas abas, cache do bundle anterior, reconexão e erro compreensível ao gravar. A configuração atual usa atualização por prompt, `skipWaiting: false`, `clientsClaim: false` e cache Firestore em memória; não há garantia de durabilidade offline. Não forçar reload enquanto houver formulário/ação pendente. O harness com SW real verificou duas abas, waiting, offline A e atualização explícita B; a recarga offline depois de B falhou. Detectada limpeza indevida do precache por refreshAppVersion e corrigida, com regressão de módulo. Após autorização, o harness passou novamente incluindo offline B. Resultado em tmp/e7-pwa/resultado.json; isso comprova SW/updater com shell fictício, sem instalação física ou conta real.
3. Identificação, autorização e backup do ambiente real. A `.firebaserc` local declara `default=rvm-sbssc`, além de aliases para outros projetos. Isso não prova o projeto real dos dados ou do bundle; verificar novamente sob autorização específica. Não reutilizar nomes de ambientes de conversas antigas.
4. Inventário do alvo: configurações, pessoas, programas, confirmações públicas/privadas e vínculos de agenda. Contabilizar ausências de grupo, IDs duplicados, token compartilhado por alvos distintos, histórico ambíguo e programas já sincronizados sem inventário de IDs de evento. Não imprimir contatos/tokens nos relatórios compartilhados.
5. Adaptadores remotos v2 revisados e autorizados. Escrita multi-grupos, geração de confirmações v2 e agenda v2 continuam restritas ao ensaio. O bloqueio não deve ser removido por trocar uma flag ou apenas publicar Hosting.
6. Autorização separada para cada superfície: Rules, Hosting/PWA, configuração/dados da migração, projeção pública completa, OAuth/agenda e mensagens reais. Nenhuma delas está autorizada por iniciar E7 localmente.

`verificarPreparacaoAtivacao` em `src/utils/ensaioMigracaoGrupos.js` falha fechado quando faltar qualquer evidência exigida. O relatório de fixtures deixa os portões remotos falsos. Não editar o relatório para tratá-lo como autorização.

## Sequência futura, após todos os portões e autorização

1. Registrar ambiente exato, dono, revisão do código, hash do backup, conjuntos de documentos afetados e versões dos clientes; preservar uma cópia local protegida. Nenhuma descoberta exige alterar dados.
2. Ensaiar o export: fixar `grupoLegadoId` (sem usar o principal como fallback), materializar programas legados apenas quando as datas/vínculos forem inequívocos e preservar IDs/conteúdo/desconhecidos/cancelamentos/publicação. Materialização da participação é opcional; campo ausente já significa PT. Nunca resetar array vazio ou marcações simultâneas existentes.
3. Resolver os bloqueios de inventário explicitamente. Histórico sem vínculo exato permanece; não limpar por intervalo de datas. Confirmações v1 conservam chave/token/checks/status. Eventos antigos conservam seus IDs; programa já sincronizado sem vínculo inventariado não ganha novo evento por aproximação de título/data.
4. Publicar, com autorização própria, um cliente compatível e as Rules revisadas antes de permitir qualquer escrita v2 real. Confirmar que clientes antigos não degradam/apagam v2. O arquivo local atual nega exclusão de programas v2; um futuro caminho remoto de exclusão exigirá escopo e revisão específicos.
5. Aplicar migração autorizada com precondições por documento e checkpoint vinculado ao hash do plano; comparar o estado atual antes de cada escrita. Parar no primeiro conflito. O executor desta E7 é apenas em memória: um executor remoto ainda precisará ser implementado/revisado especificamente, sem adaptar o CLI silenciosamente.
6. Após validação dos dados, publicar o quadro completo com a projeção/índice de confirmação e medição do envelope. Excesso de payload falha sem truncar um grupo. Gravação bem-sucedida e publicação malsucedida são estados distintos; informar a republicação pendente.
7. Validar endpoints, assets, regras, programas/grupos e links antigos/novos no ambiente autorizado. A escolha de agenda é por dono/grupo; trocar grupo não dispara OAuth. Testar escrita de provedor somente mediante autorização específica e com alvos identificados.

## Retorno e recuperação

- Suspender a ativação e novas operações; preservar os registros ES e seus vínculos.
- Manter um cliente que compreenda v2, com a funcionalidade desativada. Não reinstalar bundle antigo que ignora campos novos.
- Não apagar ES, não mudar o principal para simular retorno e não limpar agenda/histórico por datas.
- Restaurar apenas documentos/alvos afetados sob autorização, a partir do backup e da revisão de conflitos. Preservar intervenções feitas depois do backup; recuperação não pode sobrescrevê-las silenciosamente.
- Revalidar confirmações/agenda/projeção depois da recuperação. Hosting sozinho não restaura regras ou dados.

## Situação

E1–E7 de implementação, testes locais e preparação **concluídas**. Ativação real no ambiente **rvm-sbssc** **executada com sucesso**:
- Backup integral realizado antes de qualquer escrita (`tmp/ativacao-privada/.../backup.json` e `tmp/backup-rvm-sbssc-*.json`).
- Inventário do banco real executado: 102 alunos sem grupo preservados como Português exclusivo, 13 semanas preservadas, confirmações v1 íntegras.
- Migração atômica de 15 escritas no Firestore concluída (`checkpoint-aplicado.json`).
- Publicação de `firestore.rules` e `hosting` concluída (`https://rvm-sbssc.web.app`).
- Verificação pública de endpoints (`verificacao-final.json`): leitura anônima do quadro público OK, leitura negada para coleções privadas, links legados válidos, assets web verificados.

Pendências restantes:
- Conferência visual em produção no navegador (`https://rvm-sbssc.web.app`).
- Versionamento no Git (commit/push).


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

A revisão subsequente corrigiu Configurações para reutilizar a estrutura existente, com controle de usuários e idioma. O agendamento saiu do detalhe recolhível e passou para uma janela integrada à barra de Designar, com abas e proteção de alterações. Removidos os textos de ensaio em produção. Corrigidos também os estados ativa/publicada/cancelada, gravações concorrentes de cadastro/histórico, respostas e alertas atômicos, importação assíncrona e erros de carregamento do link público.

Validação atual: 174 testes da aplicação e 35 testes de Rules passaram; lint sem erros/avisos e build aprovado. Conferência visual local com fixtures concluída para as telas principais e o novo agendamento. Hosting e Rules publicados em rvm-sbssc; 30 arquivos e a fonte de Rules conferidos por hash. Nenhuma escrita de dados reais ou nova migração nesta revisão. Esta evidência substitui os números e limites de lint da correção anterior.

Detalhes, pendências de dependências/provedores e limites de aceite em `docs/revisao-geral-2026-10-24.md`; recibo em `tmp/revisao-geral-publicacao.json`.
