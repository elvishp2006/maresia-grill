# Maresia Grill

PWA de cardápio do restaurante Maresia Grill — gerencia categorias, complementos e seleções diárias.

## Pré-requisitos

- Node 20+

## Início rápido

```bash
pnpm install
pnpm run dev
```

## Comandos

| Script | O que faz |
|---|---|
| `dev` | Bootstrap local + emuladores Firebase + seed + Vite |
| `dev:web` | Apenas Vite em `http://127.0.0.1:5173` |
| `dev:emulators` | Apenas emuladores Firebase |
| `dev:seed` | Seed local único no Firestore emulator |
| `dev:local` | Alias para `dev` |
| `emulators` | Alias para `dev:emulators` |
| `stripe:test:seed` | Cria o cenário local fixo para pagamento |
| `stripe:test:app` | Alias para `dev:web` |
| `stripe:test:emulators` | Alias para `dev:emulators` |
| `stripe:test:dev` | Alias para `dev` |
| `stripe:test:webhook` | Legado: sobe `stripe listen` manualmente |
| `build` | Build dos workspaces via Turbo (`apps/web` + `apps/functions`) |
| `lint` | ESLint (deve passar antes do commit) |
| `lint:fix` | ESLint com correção automática |
| `test` | Vitest (todos os testes, uma vez) |
| `test:watch` | Vitest em modo watch |
| `test:coverage` | Vitest com cobertura v8 |
| `ci` | `lint` + `test` + `build` |
| `preview` | Serve o build de `apps/web/dist/` |

## Ambiente de desenvolvimento

`pnpm run dev` virou o fluxo canônico. Ele:

- cria `.env.local` e `apps/functions/.env.local` quando estiverem ausentes
- injeta defaults locais para o projeto `maresia-grill-local`
- compila as Functions
- sobe os emuladores Firebase
- aplica o seed local único automaticamente
- sobe o app em `http://127.0.0.1:5173`
- tenta ativar o Stripe local automaticamente quando houver chaves e Stripe CLI

Processos e endpoints locais:

| Emulador | Porta |
|---|---|
| Auth | 9099 |
| Firestore | 8180 |
| Functions | 5001 |
| UI dos emuladores | http://localhost:4000 |

`apps/web/src/lib/firebase.ts` detecta `import.meta.env.DEV` e conecta automaticamente aos emuladores — nenhuma configuração manual é necessária. O Google Sign-In no dev funciona via popup contra o emulador de Auth.

Os fluxos locais usam sempre o projeto de emulador `maresia-grill-local`. Desenvolvimento e testes locais não devem apontar para `staging` nem para `production`.

Para ativar o checkout Stripe local dentro do `pnpm run dev`, preencha:

- `.env.local` com `VITE_STRIPE_PUBLISHABLE_KEY`
- `apps/functions/.env.local` com `STRIPE_SECRET_KEY`

Se a Stripe CLI estiver instalada e autenticada, o próprio `pnpm run dev` sobe o listener e grava `STRIPE_WEBHOOK_SECRET` automaticamente no arquivo local das Functions.

URL fixa de teste do fluxo público:

```text
http://localhost:5173/s/teste-pagamento/#/pedido
```

O seed único cria um cenário local que cobre editor, histórico e checkout público. O cardápio público fixo inclui:

- `Prato executivo` e `Prato vegetariano` gratis
- `Agua com gas` por `R$ 4,50`
- `Refrigerante lata` por `R$ 7,00`
- `Brownie` por `R$ 9,00`

Fluxos esperados:

- `Prato executivo` sozinho envia sem checkout
- `Prato executivo` + `Refrigerante lata` abre o checkout Stripe embutido

Comando bruto da Stripe CLI, se você quiser rodar manualmente:

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

Os deploys de app usam `environment secrets` do GitHub com os mesmos nomes em `production` e `staging`. Quando houver um secret com o mesmo nome no ambiente e no repositório, o secret do ambiente tem precedência, conforme a documentação oficial do GitHub:
- https://docs.github.com/en/actions/reference/security/secrets

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

Variáveis de environment esperadas para deploy do app:

- `GCP_PROJECT_ID`
- `PUBLIC_WEB_ORIGIN`

Essas variáveis de deploy existem no environment `production` e no environment `staging` com os mesmos nomes. As variáveis com sufixo `_PRODUCTION` e `_STAGING` ficam restritas ao pipeline de IaC, que precisa conhecer os dois ambientes ao mesmo tempo.

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
pnpm run push:staging
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

## Troubleshooting do Admin

Quando um erro administrativo não estiver claro pela UI, a ordem de diagnóstico mais rápida é:

1. reproduzir a ação no admin e copiar a mensagem completa do toast
2. conferir o código bruto do Firestore no próprio toast, quando disponível em `dev`
3. ler `firebase-debug.log` e `firestore-debug.log` na raiz do projeto
4. procurar por:
   - `permission-denied`
   - `failed-precondition`
   - `EvaluationException`
   - o path do documento que falhou

Heurísticas úteis:

- `permission-denied` pode ser problema real de auth/allowlist, mas também pode ser **rule inválida** rejeitando o payload
- `failed-precondition` costuma indicar concorrência, versão desatualizada ou disputa de lock
- se o emulator citar uma linha exata de `firestore.rules`, trate como falha de rules antes de investigar frontend

No admin, os toasts de erro são persistentes por padrão e só somem quando fechados manualmente. Isso é intencional para facilitar cópia da mensagem e correlação com os logs do emulator. Toasts de `success` e `info` continuam temporários.

### Firestore: `permission-denied` ao salvar limites de categoria

Incidente já resolvido neste projeto:

- Sintoma na UI:
  - `Não foi possível salvar os limites da categoria. Recarregue a tela e tente novamente. (Firestore: permission-denied)`
- Erro real no emulator:
  - `EvaluationException`
  - `Property id is undefined on object`
  - apontando para `firestore.rules`
- Causa raiz:
  - a função `isValidCatalogCategory` acessava `request.resource.data.id == null`
  - o payload de categoria não tem campo `id`
  - a própria rule quebrava durante a avaliação e o Firestore devolvia `permission-denied`
- Correção aplicada:
  - remover a checagem direta de `request.resource.data.id`
  - manter apenas `keys().hasOnly(['name', 'sortOrder', 'selectionPolicy'])`

Se esse erro voltar:

1. confirme se o emulator/regras carregaram a versão atual de `firestore.rules`
2. procure no log por `EvaluationException`
3. use a linha reportada pelo emulator para localizar a expressão da rule que está quebrando
4. só depois volte para auth/allowlist ou payload do frontend

## Schema do Firestore

| Path | Formato |
|---|---|
| `catalog/root/categories/{categoryId}` | `CatalogCategory` |
| `catalog/root/items/{itemId}` | `CatalogItem` |
| `dailyMenus/{dateKey}` | `DailyMenu` |
| `dailyMenus/{dateKey}/versions/{versionId}` | `PublishedMenuVersion` |
| `dailyMenus/{dateKey}/orders/{orderId}` | `Order` |
| `config/editorLock` | lock global do editor |
| `publicOrderDrafts/{draftId}` | draft de checkout criado pelas Functions |

## Deploy

Hospedado no Render como static site:

- **Build command:** `pnpm run build`
- **Publish directory:** `apps/web/dist`
- **Rewrite:** todas as rotas → `/index.html` (SPA)

### GitHub Actions

- `CI`: instala os workspaces via `pnpm`, roda `lint`, `test` e `build` via Turbo em `main`, `staging` e PRs
- `Infra Plan`: valida a infraestrutura GCP/Firebase declarada em Terraform/OpenTofu
- `Infra Apply`: aplica APIs, IAM e grants estruturais manualmente por ambiente
- `Deploy Functions`: publica automaticamente as Functions na `main` e na `staging`
- `Deploy Firestore Rules`: publica `firestore.rules` na `main` e na `staging`
- os dois workflows escolhem `production` ou `staging` pela branch
- os dois workflows usam `vars.GCP_PROJECT_ID` do environment atual
- `Deploy Functions` usa `vars.PUBLIC_WEB_ORIGIN` do environment atual para validar CORS/acesso do endpoint público a partir da origem real do app
- Os deploys do app assumem que a infraestrutura IAM já foi aplicada pelo pipeline de infra

Secrets obrigatorios para o deploy automatico das Functions:

- `FIREBASE_SERVICE_ACCOUNT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

A produção canônica do projeto é `maresia-grill---production`. Deploys e IaC de produção devem apontar apenas para esse projeto.

## Infra GCP/Firebase

A fonte de verdade da infraestrutura GCP/Firebase agora fica em [`infra/terraform/`](/Users/elvishenriquepereira/projects/menu/infra/terraform/). O state remoto deve ficar em um bucket GCS dedicado, com versionamento, usando prefixos separados para `staging` e `production`.

O bucket de state é criado pelo bootstrap em `infra/terraform/bootstrap`. Depois disso, use os ambientes em `infra/terraform/environments/staging` e `infra/terraform/environments/production`.

Os deploys do app não alteram mais IAM estrutural. APIs, grants de runtime e permissões do deployer do app devem ser aplicados pelo workflow `Infra Apply`.

## Segurança do Firestore

- Regras administrativas exigem autenticação e allowlist
- Leituras públicas do cardápio publicado e gravações públicas do fluxo de pedido seguem apenas o schema novo
- Configure exports agendados no GCP para backup contra perda permanente de dados
