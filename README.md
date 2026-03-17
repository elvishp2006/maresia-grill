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
| UI dos emuladores | http://localhost:4000 |

`src/firebase.ts` detecta `import.meta.env.DEV` e conecta automaticamente aos emuladores — nenhuma configuração manual é necessária. O Google Sign-In no dev funciona via popup contra o emulador de Auth.

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

## Segurança do Firestore

- Regras exigem autenticação para leitura e escrita
- Deletes pelo cliente são bloqueados pelas regras
- Configure exports agendados no GCP para backup contra perda permanente de dados
