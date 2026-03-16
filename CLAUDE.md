# Menu do Dia — Claude Code Instructions

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
