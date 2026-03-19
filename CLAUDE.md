# CLAUDE.md

This file provides guidance to coding agents working in this repository.

## Monorepo layout

```text
apps/
  web/         React + Vite + PWA
  functions/   Firebase Functions
packages/
  domain/      shared models and helpers
  eslint-config/
  tsconfig/
tools/
  scripts/
```

Root orchestration lives in `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `firebase.json`, and `render.yaml`.

## Commands

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run lint
pnpm run lint:fix
pnpm run test
pnpm run test:coverage
pnpm run test:watch
pnpm run preview
```

Run a single web test file:

```bash
pnpm --filter @maresia-grill/web exec vitest run src/__tests__/ItemRow.test.tsx
```

Target a specific workspace:

```bash
pnpm --filter @maresia-grill/web build
pnpm --filter @maresia-grill/functions build
```

## Before every commit

1. `pnpm run lint`
2. `pnpm run test`
3. `pnpm run build`

Pre-commit currently runs:

- `pnpm exec lint-staged`
- `pnpm run test`
- `pnpm run build`

`lint-staged` runs `pnpm exec eslint --fix` for staged `*.{ts,tsx}` files.

## Architecture

This repository is no longer a single app rooted at `src/`. Treat it as a monorepo.

### Web app

Primary app code lives in `apps/web/src`.

```text
apps/web/src/
  components/   presentational UI
  contexts/     Toast and modal providers
  hooks/        auth, editor lock, menu state, PWA, insights
  lib/          Firebase, storage, billing, admin feedback, helpers
  App.tsx       admin entrypoint and route resolver
  PublicMenuPage.tsx
  MenuView.tsx
  NotFoundPage.tsx
```

The app supports:

- admin flow at `/`
- public order flow at `/s/:token`
- hash-based public states such as `#/pedido` and `#/enviado`

`App.tsx` resolves pathname-level routing internally. There is no external router dependency.

### Backend

`apps/functions/src/index.ts` is the Functions entrypoint. Shared server logic lives in `apps/functions/src/core.ts`.

`firebase.json` points to `apps/functions` as the deploy source.

### Shared code

`packages/domain` is the shared workspace dependency used by both web and Functions. Prefer importing from `@maresia-grill/domain` instead of relative cross-package paths.

## Data flow

Admin UI flow:

`apps/web/src/main.tsx`
-> providers
-> `App.tsx`
-> hooks such as `useMenuState`, `useMenuInsights`, `useEditorLock`
-> `apps/web/src/lib/storage.ts`
-> Firebase services

Public order flow:

`/s/:token`
-> `PublicMenuPage.tsx`
-> web billing/storage helpers
-> public HTTP Functions for checkout and order submission

## Local development

Canonical local workflow:

```bash
pnpm run dev
```

It prepares:

- root `.env.local`
- `apps/functions/.env.local`
- Functions build
- Firebase emulators
- seed data
- web app on `http://127.0.0.1:5173`

Useful local URL:

```text
http://127.0.0.1:5173/s/teste-pagamento/#/pedido
```

Emulator ports:

- Auth: `9099`
- Firestore: `8180`
- Functions: `5001`
- UI: `4000`

In dev, `apps/web/src/lib/firebase.ts` connects automatically to Auth and Firestore emulators.

## Tests

- Web tests live in `apps/web/src/__tests__`
- Stack: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`
- `apps/web` test script currently generates coverage by default
- Prefer behavior tests over implementation-detail tests

When testing components that use context:

- wrap toast consumers with `ToastProvider`
- wrap modal consumers with `ModalProvider`

## Linting and configs

- shared ESLint config lives in `packages/eslint-config`
- shared TypeScript bases live in `packages/tsconfig`
- root `eslint.config.js` scopes React rules to `apps/web` and Node rules to `apps/functions` and `tools`

## Commits

Use Conventional Commits in English:

```text
feat: add public checkout retry state
fix: correct emulator env lookup in web app
refactor: move shared menu types to domain package
test: add coverage for public order validation
docs: update monorepo setup instructions
chore: align github actions with pnpm
```

## Operational notes

- Use `pnpm`, never `npm`, for repository commands and docs.
- Do not document or rely on legacy root paths like `src/...` unless the file actually exists under `apps/web/src/...`.
- `apps/web/dist` is the frontend build output.
- `apps/functions/lib` is the Functions build output.
- Keep README and this file aligned whenever dev, CI, or deployment flows change.
