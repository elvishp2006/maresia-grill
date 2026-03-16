# Menu do Dia — Claude Code Instructions

## Fluxo de Desenvolvimento

### Antes de cada commit
1. `npm run lint` — sem erros ou warnings
2. `npm run test` — todos os testes passando

### Commits
Use **Conventional Commits**:
```
feat: adiciona suporte a categorias ocultas
fix: corrige overflow da lista no mobile
refactor: extrai lógica de ordenação para hook
test: adiciona testes para useMenuState
chore: atualiza dependências
```

Tipos: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`

### Testes
- Todo novo código deve ter testes correspondentes
- Testes ficam em `src/__tests__/`, nomeados `<Componente>.test.tsx` ou `<hook>.test.ts`
- Use `vitest` + `@testing-library/react` seguindo o padrão dos testes existentes
- Estrutura: `describe` → `it` com descrição comportamental (o que o componente faz, não como)
- Não teste detalhes de implementação; teste comportamento visível ao usuário

### Estilo de código
- Sem comentários no código — nomes claros e autoexplicativos substituem comentários
- Siga os padrões TypeScript/ESLint já configurados (`npm run lint` deve passar sem alterações)
- Componentes e hooks seguem os arquivos existentes como referência de estilo

## Haptic Feedback

Todos os elementos clicáveis do app devem usar o hook `useHapticFeedback`
localizado em `src/hooks/useHapticFeedback.ts`.

O hook suporta:
- **iOS PWA**: usa `<input type="checkbox" switch>` para acionar feedback tátil nativo
- **Android / outros**: usa `navigator.vibrate()`
- **Fallback silencioso** se nenhum método for suportado

### Quando usar cada tipo:

| Tipo | Quando usar |
|---|---|
| `lightTap` | Toggle de item, colapsar/expandir categoria, mover categoria, trocar ordenação, abrir/cancelar form |
| `success` | Confirmar adição de item ou categoria, copiar menu |
| `mediumTap` | Remover item, remover categoria |

### Exemplo de uso:
```tsx
import { useHapticFeedback } from '../hooks/useHapticFeedback';

function MyComponent() {
  const { lightTap, success, mediumTap } = useHapticFeedback();

  return (
    <button onClick={() => { lightTap(); doSomething(); }}>
      Ação simples
    </button>
  );
}
```

## Estilização

O projeto usa **Tailwind CSS v4** com `@tailwindcss/vite`.

As cores do tema são definidas como CSS custom properties em `src/App.css` e
referenciadas nos componentes com valores arbitrários do Tailwind, ex:
`bg-[var(--bg-card)]`, `text-[var(--accent)]`, `border-[var(--border)]`.

CSS customizado mínimo é mantido em `src/App.css` apenas para:
- Toggle switch (pseudo-elementos `::after` e seletores irmãos)
- Webkit scrollbar styling
- Visibilidade de botões com hover (media query `hover: hover`)
