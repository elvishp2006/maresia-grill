# Design: Apply neon glow to all gold-colored elements

**Date:** 2026-03-22
**Status:** Approved

## Goal

Every element that renders in `--accent` (gold) color should carry the matching neon glow class. Currently, interactive elements (filled buttons, badge borders, inputs) already use the neon classes, but a number of text labels, status lines, and a few secondary buttons are missing them.

## Neon class mapping

| Situation | Class to add |
|---|---|
| Gold text (`text-[var(--accent)]`) | `neon-gold-text` |
| Gold-filled button/surface (`bg-[var(--accent)]`) | `neon-gold-fill` |
| Gold-bordered element in active state (`border-[var(--accent)]` + soft bg) | `neon-gold-border` |

## Changes per file

### `apps/web/src/components/ItemRow.tsx`
- **Line ~71** — price `<span>` in select mode: add `neon-gold-text`
- **Line ~96** — price `<p>` in manage mode: add `neon-gold-text`
- **Line ~104** — `alwaysActive` button active branch (`border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]`): add `neon-gold-border neon-gold-text`

### `apps/web/src/components/OrdersPanel.tsx`
- **Line ~61** — status text (conditional, only the gold branch): add `neon-gold-text` to the `acceptingOrders` side of the ternary
- **Line ~70** — intake toggle switch active state (`border-[var(--accent)] bg-[rgba(215,176,92,0.28)]`): add `neon-gold-border`
- **Line ~95** — "Pedidos" section label `<p>`: add `neon-gold-text`
- **Line ~120** — "Pedidos" empty-state label `<p>`: add `neon-gold-text`
- **Line ~163** — per-order "Pedido" label `<p>`: add `neon-gold-text`
- **Line ~179** — observation container `<div>` (`border border-[var(--accent)] bg-[var(--accent-soft)]`): add `neon-gold-border`
- **Line ~180** — "Observação" label `<p>`: add `neon-gold-text`
- **Line ~190** — "Total pago" value `<p>` with `text-[var(--accent)]`: add `neon-gold-text`

### `apps/web/src/PublicMenuPage.tsx`
- **Line ~105** — "Total pago" `<p>`: add `neon-gold-text`

### `apps/web/src/components/CategoryCard.tsx`
- **Line ~90** — `CategoryExcludeButton` active branch (`border-[var(--accent)] bg-[rgba(215,176,92,0.16)] text-[var(--accent)]`): add `neon-gold-border neon-gold-text`
- **Line ~202** — manage-view rule summary `<p>` conditional: add `neon-gold-text` to the gold branch
- **Line ~394** — select-mode rule text `<p>` (`text-[var(--accent)]`): add `neon-gold-text`

### `apps/web/src/App.tsx`
- **Line ~444** — section card label `<p>`: add `neon-gold-text`

### `apps/web/src/components/CategoryRuleSheet.tsx`
- **Line ~8** — `BTN_ACTIVE_CLS` constant (active toggle buttons with `bg-[var(--accent)]`): add `neon-gold-fill`
- **Line ~130** — active-state conditional classes with `border-[var(--accent)]`: add `neon-gold-border`
- **Line ~282** — value badge `<span>` with `text-[var(--accent)]`: add `neon-gold-text`

### `apps/web/src/components/EmbeddedStripeCheckout.tsx`
- **Line ~142** — payment button with `bg-[var(--accent)]`: add `neon-gold-fill`

### `apps/web/src/components/PublicItemRow.tsx`
- **Line ~97** — checkmark icon `<span>` active state in `ToggleItemRow` (`bg-[var(--accent)]`): add `neon-gold-fill`

## What is NOT changed

- Elements that use `hover:border-[var(--accent)]` (border only on hover, not the resting state) — these are neutral controls that gain a gold accent on hover; adding neon to the resting state would over-glow non-active UI.
- `border-[var(--accent)]` on `<input>` focus — handled by `neon-gold-focus` already.
- Stripe internal theme variables (`colorPrimary`) — not our CSS, no-op.
- Decorative dots (`bg-[var(--accent)]` on tiny `h-[8px] w-[8px]` dots) — too small to benefit from glow.
- The category name edit `<input>` border — inline text editing, not a status display.
- `PublicItemRow` price tag (`<span>` at line 18) — already has `neon-gold-text` applied.

## Testing

- `pnpm run lint` — clean
- `pnpm run test` — no regressions (pure className additions, no logic)
- `pnpm run build` — clean
- Visual spot-check: admin → Orders tab, manage mode item rows, CategoryRuleSheet toggles, EmbeddedStripeCheckout button
