# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server
npm run build        # tsc + vite build
npm run lint         # ESLint (must pass before commit)
npm run lint:fix     # ESLint with auto-fix
npm run test         # vitest run (all tests, once)
npm run test:watch   # vitest watch mode
npm run test:coverage # vitest with v8 coverage
```

Run a single test file:
```bash
npx vitest run src/__tests__/ItemRow.test.tsx
```

## Before Every Commit

1. `npm run lint` — zero errors or warnings
2. `npm run test` — all tests passing

Husky runs `lint-staged` on pre-commit (ESLint --fix on `*.{ts,tsx}`).

## Architecture

Single-page PWA. State lives entirely in one hook (`useMenuState`), persisted to Firestore. No router.

```
src/
  contexts/       # ToastContext, ModalContext — wrap the whole app in main.tsx
  hooks/          # useMenuState (all app state), useHapticFeedback, PWA hooks
  components/     # Presentational; receive callbacks, no direct Firestore access
  storage.ts      # All Firestore reads/writes — returns Promise<T> for saves
  types.ts        # Item, Categoria, DEFAULT_CATEGORIES
  App.css         # CSS custom properties (design tokens) + toggle/scrollbar CSS
```

### Data flow

`main.tsx` → `ToastProvider` → `ModalProvider` → `App` → `useMenuState` → `storage.ts` → Firestore

`useMenuState` owns all mutable state (categories, items, daySelection, usageCounts, sortMode, loading). Components receive slices + callbacks as props.

**Firestore schema:**
- `config/categories` → `{ items: string[] }`
- `config/complements` → `{ items: Item[] }`
- `config/categorySelectionRules` → `{ rules: CategorySelectionRule[] }`
- `selections/YYYY-MM-DD` → `{ ids: string[] }` — one doc per day; `loadSelectionHistory(n)` fetches `n` docs in parallel (7 days for `usageCounts`, 90 days for insights)

### Auth

`useAuthSession` gates the whole app. `App.tsx` renders `<AuthScreen>` until `isAuthorized` is true.

- Google Sign-In via `signInWithPopup` (Firebase Auth)
- Allowed accounts are listed in `src/authConfig.ts` (`AUTHORIZED_EMAILS`)
- All state and Firestore access only begins after a successful authorized sign-in

### Insights

`useMenuInsights(complements, daySelection, enabled)` loads 90 days of history then calls `buildInsightMetrics` (pure function in `src/insights.ts`). `InsightsPanel` renders the result.

`insights.ts` has no side effects — unit-test logic there, not in the component.

### Offline guard

`useOnlineStatus` returns a boolean. `useMenuState` uses it to block write operations while offline, showing a toast error instead.

### Feedback system

Both contexts render their UI inline inside the provider (no separate mount point needed):
- **`useToast()`** → `showToast(message, type, duration?)` — types: `success | error | info`
- **`useModal()`** → `confirm(title, message): Promise<boolean>` — replaces all `window.confirm()`

### Commits

Use **Conventional Commits** in English:
```
feat: add hidden category support
fix: correct list overflow on mobile
refactor: extract sort logic to hook
test: add tests for useMenuState
chore: update dependencies
```

Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`

## Tests

- Files: `src/__tests__/<Component>.test.tsx` or `<hook>.test.ts`
- Stack: `vitest` + `@testing-library/react` + `@testing-library/jest-dom`
- Components that use `useModal` must be wrapped in `<ModalProvider>` in tests
- Components that use `useToast` / hooks that call `useMenuState` must be wrapped in `<ToastProvider>`
- Test behavior visible to the user, not implementation details
- For async modal flows, wrap the confirm click in `await act(async () => { ... })`

## Haptic Feedback

Every clickable element uses `useHapticFeedback` from `src/hooks/useHapticFeedback.ts`.

| Method | When |
|---|---|
| `lightTap` | Toggle item, collapse/expand, move category, sort change, open/cancel form |
| `success` | Add item/category confirmed, copy menu |
| `mediumTap` | Remove item, remove category |

## Styling

Tailwind CSS v4 via `@tailwindcss/vite`. Design tokens are CSS custom properties in `src/App.css`:

| Variable | Usage |
|---|---|
| `--bg` / `--bg-card` | Page / card backgrounds |
| `--accent` | Primary gold color |
| `--accent-red` | Destructive actions |
| `--text` / `--text-dim` | Primary / secondary text |
| `--border` | Borders and dividers |
| `--green` | Success states |

Reference them in Tailwind with arbitrary values: `bg-[var(--bg-card)]`, `text-[var(--accent)]`.

Custom CSS in `src/App.css` is limited to: toggle switch pseudo-elements, webkit scrollbar, and hover-only button visibility (`@media (hover: hover)`).
