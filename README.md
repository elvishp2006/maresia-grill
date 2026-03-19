# Maresia Grill

Monorepo do PWA de cardapio do Maresia Grill, com frontend React/Vite, backend em Firebase Functions, dominio compartilhado e infraestrutura declarativa.

## Requisitos

- Node 20+
- pnpm 9+
- Firebase CLI
- Stripe CLI opcional para webhooks locais

## Estrutura

```text
apps/
  web/         frontend React + Vite + PWA
  functions/   Firebase Functions
packages/
  domain/      tipos e modelos compartilhados
  eslint-config/
  tsconfig/
tools/
  scripts/     bootstrap local, seed e utilitarios
infra/
  terraform/   infraestrutura GCP/Firebase com OpenTofu
```

## Inicio rapido

```bash
pnpm install
pnpm run dev
```

Fluxo padrao local:

- prepara `.env.local` na raiz e `apps/functions/.env.local`
- compila `apps/functions`
- sobe os emuladores Firebase
- aplica o seed local
- sobe o app em `http://127.0.0.1:5173`
- tenta iniciar o listener do Stripe quando houver chaves e Stripe CLI

## Comandos

| Script | O que faz |
|---|---|
| `pnpm run dev` | Bootstrap local completo |
| `pnpm run dev:web` | Apenas `apps/web` em `127.0.0.1:5173` |
| `pnpm run dev:emulators` | Build das Functions + emuladores Firebase |
| `pnpm run dev:seed` | Seed unico no Firestore emulator |
| `pnpm run build` | Build dos workspaces via Turbo |
| `pnpm run lint` | Lint de todos os workspaces |
| `pnpm run lint:fix` | Lint com autofix |
| `pnpm run test` | Testes via Turbo |
| `pnpm run test:coverage` | Testes com coverage |
| `pnpm run test:watch` | Watch do Vitest no app web |
| `pnpm run preview` | Preview do build do app web |
| `pnpm run push:staging` | Push da branch atual para `origin/staging` |

Aliases legados ainda disponiveis:

- `pnpm run dev:local`
- `pnpm run emulators`
- `pnpm run stripe:test:seed`
- `pnpm run stripe:test:app`
- `pnpm run stripe:test:emulators`
- `pnpm run stripe:test:dev`
- `pnpm run stripe:test:webhook`

## Desenvolvimento local

O frontend usa `.env.local` na raiz. As Functions usam `apps/functions/.env.local`.

Variaveis locais injetadas automaticamente pelo bootstrap:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_PUBLIC_ORDER_API_URL`

Variaveis opcionais para habilitar Stripe local:

- `.env.local` com `VITE_STRIPE_PUBLISHABLE_KEY`
- `apps/functions/.env.local` com `STRIPE_SECRET_KEY`

Se a Stripe CLI estiver instalada e autenticada, `pnpm run dev` tenta gravar o `STRIPE_WEBHOOK_SECRET` automaticamente no arquivo local das Functions.

Portas locais:

| Servico | Porta |
|---|---|
| Web | `5173` |
| Functions emulator | `5001` |
| Firestore emulator | `8180` |
| Auth emulator | `9099` |
| Emulator UI | `4000` |

O frontend conecta automaticamente aos emuladores quando `import.meta.env.DEV` estiver ativo.

URL fixa para validar o fluxo publico de pedidos:

```text
http://127.0.0.1:5173/s/teste-pagamento/#/pedido
```

O seed local cria um cenario que cobre:

- administracao do cardapio
- historico diario
- fluxo publico de pedido
- checkout gratuito e checkout com Stripe

## Arquitetura

- `apps/web` concentra a interface administrativa e a pagina publica de pedidos.
- `apps/functions` expoe os endpoints e a logica server-side de checkout/publicacao.
- `packages/domain` evita imports relativos entre frontend e backend.
- `packages/eslint-config` e `packages/tsconfig` centralizam configuracoes compartilhadas.
- `turbo.json` orquestra `build`, `lint`, `test`, `test:coverage`, `dev` e `preview`.

Saidas principais:

- build web em `apps/web/dist`
- build das Functions em `apps/functions/lib`

## Firebase, Render e deploy

Arquivos de infraestrutura e deploy do repositorio:

- `firebase.json`: aponta `functions.source` para `apps/functions`
- `firestore.rules`: regras do Firestore
- `render.yaml`: blueprint do frontend no Render
- `infra/terraform`: IAM e baseline GCP/Firebase

Ambientes esperados:

- `staging`
- `production`

Modelo operacional:

- `staging` publica frontend no Render staging e backend no Firebase staging
- `main` publica frontend no Render production e backend no Firebase production

## GitHub Actions

Workflows atuais:

- `CI`: roda `pnpm install`, `pnpm run lint`, `pnpm run test` e `pnpm run build`
- `Deploy Functions`: publica `apps/functions`
- `Deploy Firestore Rules`: publica `firestore.rules`
- `Infra Plan`: valida mudancas em `infra/terraform/**` em PRs
- `Infra Apply`: apply manual de infraestrutura

Segredos e variaveis esperados:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `vars.GCP_PROJECT_ID`
- `vars.PUBLIC_WEB_ORIGIN`
- `vars.TF_STATE_BUCKET`
- `vars.GCP_PROJECT_ID_STAGING`
- `vars.GCP_PROJECT_NUMBER_STAGING`
- `vars.APP_DEPLOYER_MEMBER_STAGING`
- `vars.GCP_PROJECT_ID_PRODUCTION`
- `vars.GCP_PROJECT_NUMBER_PRODUCTION`
- `vars.APP_DEPLOYER_MEMBER_PRODUCTION`
- `secrets.GCP_TERRAFORM_CREDENTIALS_STAGING`
- `secrets.GCP_TERRAFORM_CREDENTIALS_PRODUCTION`

Os workflows de deploy e de IaC usam credenciais distintas por ambiente. Isso evita que um unico secret de service account tente publicar em staging e production com IAM desalinhado.

## Autenticacao

O admin usa Firebase Auth com Google Sign-In via popup. O estado de sessao fica no frontend em `apps/web/src/hooks/useAuthSession.ts`.

Se o fluxo de autorizacao administrativa mudar, atualize a documentacao junto com a implementacao. O repositorio nao deve apontar para arquivos de allowlist que nao existam mais.

## Troubleshooting

Quando algo falhar no ambiente local:

1. confira se as portas `5173`, `5001`, `8180` e `9099` estao livres
2. valide se `.env.local` e `apps/functions/.env.local` existem
3. confira `firebase-debug.log` e `firestore-debug.log` na raiz
4. se o erro for do checkout, valide tambem a Stripe CLI e o `STRIPE_WEBHOOK_SECRET`

Indicadores uteis:

- `permission-denied` pode ser auth ou regras invalidas
- `failed-precondition` costuma indicar lock, concorrencia ou estado desatualizado
- `EvaluationException` no emulator normalmente aponta para problema em `firestore.rules`

## Infra

O guia de Terraform/OpenTofu fica em [infra/terraform/README.md](/Users/elvishenriquepereira/projects/menu/infra/terraform/README.md).

## Guia para agentes

As instrucoes operacionais para agentes de codigo ficam em [CLAUDE.md](/Users/elvishenriquepereira/projects/menu/CLAUDE.md).
