# Prompt arquivado do idioma configurável dos grupos

**Status: DESATIVADO — planejamento congelado por solicitação do usuário em 26 de outubro de 2026.**

Não execute as instruções históricas abaixo. Nenhuma etapa desta implementação foi iniciada. A retomada depende de novo pedido explícito do usuário para descongelar o assunto e da revisão do [planejamento](plano-idioma-configuravel-grupos.md) contra o código atual. Ler ou mencionar este arquivo não autoriza iniciar a implementação.

## Referência histórica sem autorização de execução

```text
PROMPT HISTÓRICO DESATIVADO — NÃO EXECUTAR SEM PEDIDO EXPLÍCITO DE RETOMADA.

Leia docs/plano-idioma-configuravel-grupos.md e implemente somente a etapa I1, contrato e funções de leitura, no projeto C:\Projetos\reuniao-vida-ministerio.

O objetivo completo é permitir configurar o idioma e a sigla da congregação, grupo ou pré-grupo, separando o idioma real da tradução da interface. Já existem traduções em português e espanhol. Outros idiomas, como crioulo haitiano, alemão, Libras, japonês e árabe, precisam ser identificáveis sem serem convertidos em português ou espanhol e sem prometer tradução ou importação indisponível.

Antes de editar, leia as instruções aplicáveis e inspecione o estado atual do Git. Preserve todas as alterações locais existentes. Use o código atual como fonte de verdade e registre divergências materiais do plano.

Nesta etapa:

1. Confirme o contrato aditivo proposto para idiomaGrupo, sigla, idiomaInterface, idioma legado e versaoMetadadosIdioma. Documente a precedência e os fallbacks. Preserve grupoId, grupoLegadoId, contratos de programação v2, tokens e identidades operacionais.
2. Crie um catálogo de idiomas com Português, Espanhol, Crioulo haitiano, Alemão, Libras, Japonês e Árabe, além do suporte a idioma personalizado. Use chaves internas estáveis; não invente equivalência com códigos de publicações ou locales.
3. Implemente funções puras para ler e normalizar metadados, obter nome e sigla, resolver idioma da interface PT/ES e consultar capacidades de conteúdo. Reaproveite padrões do projeto sem aplicar normalizeLanguage ao idioma real. Capacidades são derivadas do catálogo, não concedidas por campos editáveis.
4. Faça a leitura de dados legados derivar valores em memória, preservando os campos originais e desconhecidos e sem gravação automática. Dados novos prevalecem sobre o campo legado. Um idioma personalizado mantém sua identidade e usa a tradução explicitamente configurada ou o fallback PT. Normalize e valide nome e sigla conforme o plano.
5. Acrescente testes em scripts/test-idioma-configuravel-grupos.mjs com fixtures sintéticas para PT/ES antigos, metadados novos, idioma personalizado, campos inválidos, duplicidade de sigla, preservação, pureza e idempotência. Prove que interface em português não concede importação portuguesa a um grupo haitiano ou personalizado.
6. Execute os testes novos e scripts/test-multi-idiomas.mjs. Faça verificações estáticas pertinentes aos arquivos criados. Atualize o plano com os arquivos, resultados reais e decisões pendentes para I2 e I6.

Não conecte os módulos novos às telas ou escritores operacionais nesta etapa. Não altere o comportamento atual de Configurações, Designar, importação, quadro, mensagens, agenda ou confirmação. Não migre documentos, não acesse dados privados de produção e não faça gravações remotas. Não altere Rules, versão, deploy, commits ou push. Não comece I2 automaticamente.

Esta etapa não precisa de navegador. Se surgir uma necessidade posterior e a primeira tentativa de usar o navegador para validar falhar, pare as tentativas e peça minha ajuda; não insista.

Ao terminar, informe o que foi implementado, os arquivos alterados, os testes executados e seus resultados, as limitações e o próximo passo. Diferencie funções prontas de funcionalidades já conectadas ao produto.
```
