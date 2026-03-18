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

Os fluxos locais usam sempre o projeto de emulador `maresia-grill-local`. Desenvolvimento e testes locais não devem apontar para `staging` nem para `production`.

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
stripe listen --forward-to http://127.0.0.1:5001/maresia-grill-local/us-central1/paymentWebhook
```

## Staging com Render + Firebase

O staging do Render e o staging do Firebase devem usar um projeto Firebase separado da producao.

Arquitetura recomendada:

- frontend de staging no Render
- Auth/Firestore/Functions em um projeto Firebase de staging
- Stripe de staging apontando para as Functions de staging

### GitHub Actions

O repositório possui sete fluxos principais:

- `Infra Plan`: valida mudanças em `infra/terraform/**` em PRs
- `Infra Apply`: aplica a infra declarativa manualmente em `staging` e `production`
- `Deploy Functions`: publica `functions` em `production` ou `staging` conforme a branch
- `Deploy Firestore Rules`: publica `firestore.rules` em `production` ou `staging` conforme a branch
- `CI`: valida lint, testes e builds em PRs e na `main`

Secrets esperados para producao no GitHub:

- `FIREBASE_SERVICE_ACCOUNT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Projeto de produção atual:

- `maresia-grill---production`
- project number `967884693073`

Variáveis e secrets esperados para IaC:

- `vars.TF_STATE_BUCKET`
- `vars.GCP_PROJECT_ID_STAGING`
- `vars.GCP_PROJECT_NUMBER_STAGING`
- `vars.APP_DEPLOYER_MEMBER_STAGING`
- `vars.GCP_PROJECT_ID_PRODUCTION`
- `vars.GCP_PROJECT_NUMBER_PRODUCTION`
- `vars.APP_DEPLOYER_MEMBER_PRODUCTION`
- `secrets.GCP_TERRAFORM_CREDENTIALS_STAGING`
- `secrets.GCP_TERRAFORM_CREDENTIALS_PRODUCTION`

Variáveis adicionais esperadas para deploy do app:

- `vars.RENDER_STAGING_ORIGIN`

### Render Staging

O `render.yaml` voltou ao blueprint completo com `projects/environments`, mantendo fora apenas o domínio customizado para evitar misturar causas de falha.

Neste passo, o arquivo usa:

- `version: "1"`
- `projects`
- environments `production` e `staging`
- env groups `production` e `staging`
- nomes de serviço sem colisão no workspace:
  - `maresia-grill-production-web`
  - `maresia-grill-staging-web`

O domínio customizado de produção fica declarado no Blueprint:

- `maresiagrill.com` em `web-production`

O checkout Stripe usa a URL de retorno enviada pelo próprio frontend no momento da criação da sessão. O backend valida que essa URL pertence à mesma origem da requisição HTTP, então o frontend publicado em staging funciona sem depender de redeploy dinâmico por PR.

As Functions HTTP públicas do checkout são deployadas como Functions v2 com `invoker: 'public'`. Isso é obrigatório para browser e Stripe conseguirem chamar os endpoints; cabeçalhos CORS sozinhos não tornam a Function publicamente invocável. Os workflows de staging e produção validam o preflight do endpoint `preparePublicOrderCheckout` logo após o deploy para detectar regressões de exposição pública/CORS.

O `render.yaml` já declara as branches esperadas para cada serviço:

- `web-production` rastreia a branch `main`
- `web-staging` rastreia a branch `staging`

Depois de alterar o Blueprint, confirme no painel do Render se os serviços sincronizaram esse branch mapping corretamente.

Com isso, o modelo operacional fica:

- push/merge em `staging` publica frontend no Render staging e backend no Firebase staging
- merge em `main` publica frontend no Render production e backend no Firebase production

Para subir rapidamente o estado atual para a branch remota `staging` sem trocar de branch local:

```bash
npm run push:staging
```

Esse comando faz `git push origin HEAD:staging` e falha se houver mudanças locais não commitadas.

### Variaveis do staging no Render

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

- `CI`: instala dependencias do app e de `functions/`, roda `lint`, `test`, `build` do app e `build` das Functions em `main`, `staging` e PRs
- `Infra Plan`: valida a infraestrutura GCP/Firebase declarada em Terraform/OpenTofu
- `Infra Apply`: aplica APIs, IAM e grants estruturais manualmente por ambiente
- `Deploy Functions`: publica automaticamente as Functions na `main` e na `staging`
- `Deploy Firestore Rules`: publica `firestore.rules` na `main` e na `staging`
- os dois workflows escolhem `production` ou `staging` pela branch
- os dois workflows usam `vars.GCP_PROJECT_ID_PRODUCTION` na `main`
- os dois workflows usam `vars.GCP_PROJECT_ID_STAGING` na `staging`
- `Deploy Functions` usa `vars.RENDER_STAGING_ORIGIN` na branch `staging` para validar CORS/acesso do endpoint público a partir da origem real do staging no Render
- Os deploys do app assumem que a infraestrutura IAM já foi aplicada pelo pipeline de infra

Secrets obrigatorios para o deploy automatico das Functions:

- `FIREBASE_SERVICE_ACCOUNT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_STAGING`
- `STRIPE_SECRET_KEY_STAGING`
- `STRIPE_WEBHOOK_SECRET_STAGING`

A produção canônica do projeto é `maresia-grill---production`. Deploys e IaC de produção devem apontar apenas para esse projeto.

## Infra GCP/Firebase

A fonte de verdade da infraestrutura GCP/Firebase agora fica em [`infra/terraform/`](/Users/elvishenriquepereira/projects/menu/infra/terraform/). O state remoto deve ficar em um bucket GCS dedicado, com versionamento, usando prefixos separados para `staging` e `production`.

O bucket de state é criado pelo bootstrap em `infra/terraform/bootstrap`. Depois disso, use os ambientes em `infra/terraform/environments/staging` e `infra/terraform/environments/production`.

Os deploys do app não alteram mais IAM estrutural. APIs, grants de runtime e permissões do deployer do app devem ser aplicados pelo workflow `Infra Apply`.

## Segurança do Firestore

- Regras exigem autenticação para leitura e escrita
- Deletes pelo cliente são bloqueados pelas regras
- Configure exports agendados no GCP para backup contra perda permanente de dados
