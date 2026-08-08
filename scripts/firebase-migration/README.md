# Migracao Firebase

Este diretorio contem scripts para conferir e migrar dados entre dois projetos
Firebase usando chaves Admin SDK.

Por padrao historico, os scripts ainda assumem:

- origem: `vidaeministerio-firebase-adminsdk-fbsvc-175535c784.json`
- destino: `rvm-palmas-pr-firebase-adminsdk-fbsvc-8b2962008e.json`

Para uma nova congregacao, prefira passar os arquivos explicitamente:

```powershell
npm run migrate:verify -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json
```

Se SBS vai comecar limpa, nao rode os comandos de migracao de Auth/Firestore;
configure `.env.local`, `firestore.rules`, regras, indices e Hosting conforme
`docs/nova-congregacao-setup.md`.

## Ordem recomendada

1. Conferir leitura das duas contas:
   `npm run migrate:verify -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json`
2. Simular usuarios do Auth:
   `npm run migrate:auth:dry -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json`
3. Migrar usuarios do Auth preservando UID quando nao houver conflito:
   `npm run migrate:auth -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json`
4. Simular Firestore inteiro:
   `npm run migrate:firestore:dry -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json`
5. Migrar Firestore inteiro, incluindo subcolecoes:
   `npm run migrate:firestore -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json`
6. Simular indices compostos:
   `npm run migrate:indexes:dry -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json`
7. Migrar indices compostos:
   `npm run migrate:indexes -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json`
8. Conferir `.env.local` e `firestore.rules` do projeto novo:
   `npm run new-congregation:check -- --env .env.local`
9. Publicar regras no projeto novo (`rvm-sbssc`).
10. Gerar e publicar Hosting no projeto novo (`rvm-sbssc`).
11. Verificar contagens finais:
   `npm run migrate:verify -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json`

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
- Os scripts oficiais de deploy em `package.json` apontam para `rvm-sbssc`.
  Palmas deve ficar apenas como backup/legado local, nao como alvo oficial.
