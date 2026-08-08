# Setup para SBS

Este guia prepara o sistema para a Congregacao Sao Bento do Sul - SC. A sigla
humana e `SBSSC`; o `projectId` Firebase oficial sugerido e `rvm-sbssc`, porque
IDs de projeto devem ser minusculos.

A ideia e ter um unico alvo oficial daqui para frente: SBS. Palmas fica apenas
como backup/legado local, sem scripts de deploy oficiais no `package.json`.

## O que muda

- Firebase Web App: novas variaveis `VITE_FIREBASE_*` em `.env.local`.
- Firebase Auth: ativar login Google e obter o UID da nova conta principal.
- Firestore Rules: trocar os UIDs literais em `firestore.rules`.
- Hosting: publicar em `rvm-sbssc`.
- Google Calendar API: ativar no mesmo projeto Google Cloud/Firebase.
- EmailJS: opcional; usar novas chaves se quiser envio automatico por e-mail.
- Worker JW: opcional; o app so usa para melhorar a importacao da programacao.

## Decisao: comecar limpo ou migrar dados

Para a mudanca de Palmas para SBS, o mais seguro costuma ser comecar limpo no
novo Firebase, porque alunos, historico, confirmacoes e quadro publico pertencem
a congregacao antiga.

Use migracao de dados somente se voce realmente quiser clonar o conteudo do
projeto atual para o novo. Os scripts de Firestore usam `set(..., { merge:
false })`, entao documentos no mesmo caminho do destino sao substituidos.

## Passo a passo

1. Criar o projeto Firebase `rvm-sbssc` na conta Google nova.
2. Criar um Web App no Firebase e copiar a configuracao para `.env.local`.
3. Ativar Authentication > Sign-in method > Google.
4. Criar o Firestore Database.
5. No Google Cloud do mesmo projeto, ativar a Google Calendar API.
6. Rodar localmente, entrar com a nova conta Google e copiar o UID em
   Authentication > Users.
7. Definir em `.env.local`:
   - `VITE_ADMIN_UID=<uid-onde-os-dados-ficam-em-users/{uid}>`
   - `VITE_OWNER_UID=<uid-da-conta-principal>`
   - `VITE_OWNER_EMAIL=<email-da-conta-principal>`
8. Se for uma unica conta dona, use o mesmo UID em `VITE_ADMIN_UID` e
   `VITE_OWNER_UID`.
9. Atualizar `firestore.rules` para os mesmos UIDs:
   - `dataOwnerUid()` deve retornar o valor de `VITE_ADMIN_UID`.
   - `primaryOwnerUid()` deve retornar o valor de `VITE_OWNER_UID`.
10. Conferir tudo localmente:
   `npm run new-congregation:check -- --env .env.local`
11. Gerar build local:
   `npm run build`
12. Publicar regras, indices e Hosting em `rvm-sbssc`.

## Backup de Palmas

O `.env` atual de Palmas deve ser guardado apenas como backup local ignorado pelo
Git:

```powershell
Copy-Item -LiteralPath .env -Destination .env.palmas-pr.local -Force
```

Depois que os dados reais do Web App Firebase de SBS estiverem disponiveis, o
`.env` ou `.env.local` oficial deve passar a apontar para `rvm-sbssc`.

## Comandos de deploy com projeto explicito

```powershell
npx firebase-tools deploy --project rvm-sbssc --only firestore:rules
npx firebase-tools deploy --project rvm-sbssc --only firestore:indexes
npm run build
npx firebase-tools deploy --project rvm-sbssc --only hosting
```

Os scripts oficiais de `package.json` tambem apontam para `rvm-sbssc`:

```powershell
npm run deploy:rules
npm run deploy:indexes
npm run deploy
```

## Migracao opcional de Auth e Firestore

Coloque as duas chaves Admin SDK na raiz do repo ou passe caminhos absolutos.
Use nomes explicitos para evitar confusao:

```powershell
npm run migrate:verify -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json
npm run migrate:auth:dry -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json
npm run migrate:firestore:dry -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json
npm run migrate:indexes:dry -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json
```

Se os dry-runs estiverem corretos:

```powershell
npm run migrate:auth -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json
npm run migrate:firestore -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json
npm run migrate:indexes -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json
npm run migrate:verify -- --source-key antigo-adminsdk.json --target-key novo-adminsdk.json
```

## Worker JW

O repo nao tem Worker versionado. Hoje o importador tenta, nesta ordem:

1. `VITE_JW_PROXY_URL`, se definido.
2. `VITE_JW_PROXY_FALLBACKS`, se definido.
3. O proxy antigo hardcoded no codigo.
4. Fallbacks publicos.

Para independencia total da conta antiga, crie um Worker/proxy novo e preencha
`VITE_JW_PROXY_URL`. Se a importacao automatica nao for essencial no primeiro
dia, o sistema pode subir sem Worker e usar colagem/importacao manual.

O Worker versionado para SBS fica em `workers/jw-proxy` e usa o nome
`proxy-jw-congregacao`, igual ao Worker antigo. Para publicar:

```powershell
npm run worker:jw:whoami
npm run worker:jw:deploy
```

Depois do deploy, copie a URL `workers.dev` gerada para `VITE_JW_PROXY_URL` no
`.env` e publique o Hosting novamente para o app usar o proxy novo.

## Checklist antes de publicar

- `.env.local` aponta para `rvm-sbssc`.
- `firestore.rules` tem os UIDs novos.
- `npm run new-congregation:check -- --env .env.local` nao mostra pendencias
  criticas.
- `npm run build` passa.
- Google Auth tem o dominio autorizado do Hosting novo.
- Google Calendar API esta ativada.
- Primeiro login com a conta dona foi testado.
- Regras e Hosting foram publicados no novo projeto, nao no antigo.
