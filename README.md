# Maresia Grill

PWA de cardápio do restaurante Maresia Grill — gerencia categorias, complementos e seleções diárias.

## Pré-requisitos

- Node 20+
- Firebase CLI: `npm i -g firebase-tools`

## Início rápido

```bash
npm install
npm run dev:local   # sobe emuladores Firebase + servidor Vite
```

## Comandos

| Script | O que faz |
|---|---|
| `dev` | Servidor Vite (produção Firebase) |
| `dev:local` | Emuladores Firebase + Vite em paralelo |
| `emulators` | Apenas emuladores Firebase |
| `stripe:test:seed` | Cria o cenário local fixo para pagamento |
| `stripe:test:app` | Sobe o app em `http://127.0.0.1:5173` |
| `stripe:test:emulators` | Sobe `auth`, `firestore` e `functions` para Stripe local |
| `stripe:test:dev` | Sobe app + emuladores do cenário Stripe |
| `stripe:test:webhook` | Encaminha eventos Stripe para `paymentWebhook` |
| `gcp:bootstrap` | Habilita APIs e grants mínimos para deploy de Functions v2 |
| `gcp:check` | Valida APIs e IAM antes do deploy |
| `build` | `tsc` + Vite build |
| `lint` | ESLint (deve passar antes do commit) |
| `lint:fix` | ESLint com correção automática |
| `test` | Vitest (todos os testes, uma vez) |
| `test:watch` | Vitest em modo watch |
| `test:coverage` | Vitest com cobertura v8 |
| `ci` | `lint` + `test` + `build` |
| `preview` | Serve o build de `dist/` |

## Ambiente de desenvolvimento

`npm run dev:local` sobe dois processos com labels coloridos (`[emulators]` / `[vite]`):

| Emulador | Porta |
|---|---|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| UI dos emuladores | http://localhost:4000 |

`src/firebase.ts` detecta `import.meta.env.DEV` e conecta automaticamente aos emuladores — nenhuma configuração manual é necessária. O Google Sign-In no dev funciona via popup contra o emulador de Auth.

Para testar pagamentos locais com Stripe:

1. Preencha as chaves em `.env.local` e `functions/.env.local`
2. Rode `npm run stripe:test:dev`
3. Em outro terminal, rode `npm run stripe:test:webhook`
4. Copie o `whsec_...` retornado pela Stripe CLI para `functions/.env.local` em `STRIPE_WEBHOOK_SECRET`
5. Rode `npm run stripe:test:seed`
6. Abra a URL fixa de teste:

```text
http://localhost:5173/s/teste-pagamento#/pedido
```

O seed cria um cenario minimo com:

- `Prato executivo` e `Prato vegetariano` gratis
- `Agua com gas` por `R$ 4,50`
- `Refrigerante lata` por `R$ 7,00`
- `Brownie` por `R$ 9,00`

Fluxos esperados:

- `Prato executivo` sozinho envia sem checkout
- `Prato executivo` + `Refrigerante lata` abre o checkout Stripe embutido

Comando bruto da Stripe CLI:

```bash
stripe listen --forward-to http://127.0.0.1:5001/menu-7f7cd/us-central1/paymentWebhook
```

## Staging com Render Preview + Firebase

O preview de PR do Render e o staging do Firebase devem usar um projeto Firebase separado da producao.

Arquitetura recomendada:

- frontend preview do Render
- Auth/Firestore/Functions em um projeto Firebase de staging
- Stripe de staging apontando para as Functions de staging

### GitHub Actions

O repositório possui dois fluxos separados:

- `Deploy Functions`: publica producao na `main`
- `Deploy Firebase Staging`: em cada PR, descobre a URL do preview do Render e publica `functions` + `firestore.rules` no Firebase staging

Secrets esperados para staging no GitHub:

- `FIREBASE_SERVICE_ACCOUNT_STAGING`
- `FIREBASE_PROJECT_ID_STAGING`
- `STRIPE_SECRET_KEY_STAGING`
- `STRIPE_WEBHOOK_SECRET_STAGING`

Secrets esperados para producao no GitHub:

- `FIREBASE_SERVICE_ACCOUNT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_MENU_BASE_URL`

### Render Preview

O `render.yaml` voltou ao blueprint completo com `projects/environments`, mantendo fora apenas o domínio customizado para evitar misturar causas de falha.

Neste passo, o arquivo usa:

- `version: "1"`
- `projects`
- environments `production` e `staging`
- env groups `production` e `staging`
- previews automáticos no `staging`
- nomes de serviço sem colisão no workspace:
  - `maresia-grill-production-web`
  - `maresia-grill-staging-web`

Ainda não recolocamos:

- o dominio `maresiagrill.com`

O workflow de staging busca a URL real do preview do Render via GitHub Deployments e a injeta como `PUBLIC_MENU_BASE_URL` no deploy das Functions de staging. Isso garante que o retorno do checkout Stripe volte para o preview correto do PR.

As Functions HTTP públicas do checkout são deployadas como Functions v2 com `invoker: 'public'`. Isso é obrigatório para browser e Stripe conseguirem chamar os endpoints; cabeçalhos CORS sozinhos não tornam a Function publicamente invocável. Os workflows de staging e produção validam o preflight do endpoint `preparePublicOrderCheckout` logo após o deploy para detectar regressões de exposição pública/CORS.

### Variaveis do preview no Render

Quando os groups forem recolocados no Blueprint, o group `staging` do Render deve conter os valores de staging para:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_PUBLIC_ORDER_API_URL`
- `VITE_STRIPE_PUBLISHABLE_KEY`

Esses valores devem apontar para o Firebase staging e para a chave publicavel de staging do Stripe.

O group `production` deve conter o equivalente de producao para o serviço principal.

## Autenticação e allowlist

Fluxo: Google Sign-In → `isAuthorizedEmail()` em `src/authConfig.ts`.

Para adicionar ou remover alguém:
1. Atualize `AUTHORIZED_EMAILS` em `src/authConfig.ts`
2. Mantenha `firestore.rules` alinhado (regras de leitura/escrita por email)
3. Publique as regras: `firebase deploy --only firestore:rules`

## Schema do Firestore

| Documento | Formato |
|---|---|
| `config/categories` | `{ items: string[] }` |
| `config/complements` | `{ items: Item[] }` |
| `config/categorySelectionRules` | `{ rules: CategorySelectionRule[] }` |
| `selections/YYYY-MM-DD` | `{ ids: string[] }` — um doc por dia |

## Deploy

Hospedado no Render como static site:

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Rewrite:** todas as rotas → `/index.html` (SPA)

### GitHub Actions

- `CI`: instala dependencias do app e de `functions/`, roda `lint`, `test`, `build` do app e `build` das Functions
- `Deploy Functions`: publica automaticamente as Functions na `main`
- `Deploy Firestore Rules`: publica `firestore.rules` quando o arquivo muda
- `Deploy Functions` e `Deploy Firebase Staging` agora executam um pre-check de GCP antes do deploy

Secrets obrigatorios para o deploy automatico das Functions:

- `FIREBASE_SERVICE_ACCOUNT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_MENU_BASE_URL`

## Bootstrap de GCP

Para reduzir o trabalho manual de APIs e IAM no Firebase/Cloud Functions v2, o repositório inclui dois scripts operacionais:

```bash
npm run gcp:bootstrap -- --project <project-id> --member "<user:email@dominio.com|serviceAccount:sa@project.iam.gserviceaccount.com>"
npm run gcp:check -- --project <project-id> --member "<user:email@dominio.com|serviceAccount:sa@project.iam.gserviceaccount.com>"
```

O `gcp:bootstrap` faz:

- habilita as APIs necessárias de Functions v2
- concede `roles/iam.serviceAccountUser` no runtime service account padrão do projeto
- concede `roles/cloudbuild.builds.builder` para a compute service account do projeto
- verifica o service agent do Cloud Build

O `gcp:check` não altera nada; ele só valida o ambiente e falha com o comando de bootstrap recomendado.

Se `--member` não for informado, os scripts usam automaticamente a identidade autenticada no `gcloud`.

## Segurança do Firestore

- Regras exigem autenticação para leitura e escrita
- Deletes pelo cliente são bloqueados pelas regras
- Configure exports agendados no GCP para backup contra perda permanente de dados
