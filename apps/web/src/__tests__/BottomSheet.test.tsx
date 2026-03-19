import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BottomSheet from '../components/BottomSheet';

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    mediumTap: vi.fn(),
  }),
}));

describe('BottomSheet', () => {
  it('does not move focus automatically when opened', () => {
    render(
      <BottomSheet open onClose={vi.fn()} title="Novo item">
        <input aria-label="Nome do item" />
      </BottomSheet>
    );

    expect(screen.getByLabelText('Nome do item')).not.toHaveFocus();
  });

  it('moves focus into the sheet on first Tab and closes on Escape', () => {
    const onClose = vi.fn();

    render(
      <div>
        <button type="button">Fora</button>
        <BottomSheet open onClose={onClose} title="Novo item">
          <button type="button">Primeiro</button>
          <button type="button">Segundo</button>
        </BottomSheet>
      </div>
    );

    const outsideButton = screen.getByRole('button', { name: 'Fora' });
    const closeButton = screen.getByRole('button', { name: 'Fechar painel' });
    outsideButton.focus();

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
