# Migracao Firebase

Este diretorio contem scripts para migrar o projeto antigo `vidaeministerio` para
o projeto novo `rvm-palmas-pr` usando as duas chaves Admin SDK na raiz.

## Ordem recomendada

1. Conferir leitura das duas contas:
   `npm run migrate:verify`
2. Simular usuarios do Auth:
   `npm run migrate:auth:dry`
3. Migrar usuarios do Auth preservando UID quando nao houver conflito:
   `npm run migrate:auth`
4. Simular Firestore inteiro:
   `npm run migrate:firestore:dry`
5. Migrar Firestore inteiro, incluindo subcolecoes:
   `npm run migrate:firestore`
6. Simular indices compostos:
   `npm run migrate:indexes:dry`
7. Migrar indices compostos:
   `npm run migrate:indexes`
8. Publicar regras no projeto novo:
   `npm run firebase:new:deploy:rules`
9. Gerar e publicar Hosting no projeto novo:
   `npm run firebase:new:deploy:hosting`
10. Verificar contagens finais:
   `npm run migrate:verify`

## Observacoes

- Os comandos sem `--execute --yes` rodam em modo dry-run.
- A migracao do Firestore usa `set(..., { merge: false })`, entao documentos de
  mesmo caminho no destino sao substituidos.
- Referencias Firestore salvas como valor de campo sao reescritas para apontar
  para o projeto de destino usando o mesmo caminho do documento.
- Se um email ja existir no Auth novo com UID diferente, o script nao apaga nada
  automaticamente. Ele registra o conflito para decisao manual.
- O script de indices recria indices compostos. Se houver single-field overrides
  no projeto antigo, ele avisa para conferir manualmente no console Firebase.
