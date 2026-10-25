# Revisão geral — 24/10/2026

## Resultado e alcance

Revisão de código, regressão de domínio/serviços, Rules no emulador e conferência visual local da interface existente com fixtures. O objetivo é preservar as telas e os dados conhecidos, usando a lógica PT/ES. Não representa aceite de todos os provedores externos nem uso autenticado em aparelho físico.

## Falhas corrigidas

| Área | Falha observada | Correção |
| --- | --- | --- |
| Configurações | Formulário simplificado substituiu a estrutura e retirou o controle de usuários | Reuso de Configuracoes: cabeçalho/cartões, acesso de usuários e idioma. Campos de grupo integrados ao mesmo padrão visual. Escolha de idioma muda o contexto; não regrava o idioma do outro grupo. |
| Agendamento | Bloco cru duplicava conteúdo em Designar e mostrava texto de dados fictícios em produção | Ação compacta na barra existente abre janela com abas Uma data / Semanal / Reuniões. Campos, mensagens e botões seguem o padrão do app; dia semanal traduzido e saída com proteção de alterações. |
| Estado da reunião | Ativa era apresentada como publicada; canceladas ainda exibiam campos editáveis | Publicação e atividade distintas; canceladas/desabilitadas ficam em leitura. FDS isolado sem duração ou conteúdo fictício de meio de semana. |
| Cadastro | Formulário reenviava histórico antigo; IDs sequenciais podiam colidir | Gravação transacional apenas dos campos editados, com comparação do estado original. Histórico e contato alterados por outra sessão são preservados. Novos IDs estáveis e exclusivos; nova tentativa idêntica é idempotente. Avatar preservado/editável. |
| Histórico manual | Remoção visual acontecia antes da confirmação de gravação | Histórico atualizado na tela após sucesso; comparação transacional impede apagar alteração concorrente. |
| Exclusão de pessoa | Cadastro podia ter mudado depois da confirmação | Estado atual é conferido dentro da transação; pessoa ativa não é excluída. |
| Confirmações | Respostas simultâneas podiam perder histórico e alerta podia falhar após salvar resposta | Uma transação salva resposta, espelho privado e alerta. Rules consultam o estado posterior para validar esse alerta. Resposta repetida não duplica histórico; status inválido não vira aceite. |
| Importação | A confirmação não aguardava a gravação e podia rejeitar sem mensagem na tela | Aguarda conclusão, exibe erro preservando revisão e protege troca de grupo/saída. |
| Configuração/publicação | Alteração de grupo podia deixar quadro público desatualizado | Republicação completa após salvar, com estado parcial explícito e tentativa de republicação. |
| Infraestrutura da UI | Lint tinha erros em handlers de diálogo; fallback de compartilhamento citava outro projeto | Callbacks de diálogo estabilizados; link de fallback usa o projeto configurado. |
| Link público | Falha de rede podia parecer link inválido; qualquer abertura liberava preferência local do quadro | Erro de carregamento separado, nova tentativa e preferência aplicada somente após confirmação válida. Token malformado é recusado antes do SDK. |

## Evidências

- `npm test`: 174 testes de domínio, serviços, parser PT/ES e renderização.
- `npm run test:rules:local`: 35 testes, incluindo editor clássico → adaptador v2, conflito entre sessões, preservação de históricos, restrição de exclusão e duas respostas anônimas com alertas atômicos.
- `npm run lint`: sem erros e sem avisos.
- Build de produção e inventário dos módulos renderizados no bundle: `tmp/revisao-geral-build.txt` e `tmp/revisao-geral-bundle.json`.
- Conferência visual no navegador local: Início, Configurações (estrutura, controle de usuários, idioma), Designar e abertura/fechamento/aba semanal do agendamento. Sem erro na abertura ou navegação dessa conferência.
- Capturas locais: `tmp/revisao-configuracoes-mobile.png` e `tmp/revisao-agendamento-mobile.png`. São fixtures; não são capturas autenticadas de produção.
- Registros completos: `tmp/revisao-geral-tests.txt`, `tmp/revisao-geral-rules.txt`, `tmp/revisao-geral-lint.txt`.

## Pendências e limites explícitos

1. **Dependências:** o npm apontou 10 pacotes com alertas na árvore considerada de produção (1 crítico, 8 altos, 1 moderado). O inventário Rollup encontrou somente `react-router` entre esses nomes com código renderizado no bundle do navegador. Isso não encerra a triagem de todos os avisos. O [aviso GHSA-49rj-9fvp-4h2h](https://github.com/advisories/GHSA-49rj-9fvp-4h2h) exclui explicitamente o uso declarativo com BrowserRouter, utilizado aqui. A manutenção das dependências permanece registrada, sem atualização indiscriminada de bibliotecas nesta correção visual/funcional. O [aviso crítico websocket-driver](https://github.com/advisories/GHSA-xv26-6w52-cph6) refere-se a pacote transitivo do caminho Node de Firebase Database; esse módulo não foi renderizado no bundle observado. Relatório bruto: `tmp/revisao-geral-dependencias.json`.
2. **Provedores:** e-mail real, OAuth/escrita no Google Agenda, consulta ao catálogo JW ao vivo e PWA instalado/offline em aparelho não foram exercitados nesta revisão. Serviços têm testes locais e de erro; não são prova de entrega/sincronização real.
3. **Proxy JW:** entrada HTTPS e domínios jw.org foram conferidos com fetch simulado. O código atual segue redirecionamentos automaticamente; a validação explícita de cada salto é uma pendência de endurecimento do Worker. Nenhum Worker Cloudflare foi publicado nesta correção.
4. **Reimportação:** a substituição automática de uma semana que já contém partes continua protegida, para não descartar designações e vínculos. O erro agora aparece na revisão, sem perda do conteúdo. Edições de partes existentes seguem disponíveis em Designar; uma reconciliação completa de reimportação deve ter fluxo próprio.
5. **Celebração:** `plano-celebracao-morte-cristo.md` continua como proposta. Não foi implementado por esta revisão nem deve ser apresentado como funcionalidade entregue.

## Publicação e preservação

Correção publicada com sucesso no Hosting e nas Rules do projeto rvm-sbssc, versão 6.0.305, em https://rvm-sbssc.web.app. Os 30 arquivos servidos foram comparados por SHA-256 com o build local; a fonte de Rules publicada também corresponde exatamente à fonte validada. Recibo em `tmp/revisao-geral-publicacao.json` e log em `tmp/revisao-geral-deploy.txt`.

A publicação não reaplicou migração, não restaurou banco e não executou escritas de dados reais, mensagens ou eventos Google. Backups prévios de Hosting e Rules em `tmp/ativacao-privada/revisao-geral-2026-10-24/`. A conferência visual desta revisão foi local, com fixtures; o uso autenticado em produção e aparelho permanece separado desse resultado.
