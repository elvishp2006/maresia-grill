import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ItemEditorForm from '../components/ItemEditorForm';

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    lightTap: vi.fn(),
    success: vi.fn(),
  }),
}));

describe('ItemEditorForm', () => {
  it('does not auto focus or auto select the name input on mount', () => {
    render(
      <ItemEditorForm
        onSubmit={vi.fn()}
        onClose={vi.fn()}
        initialName="Feijao"
        initialPriceCents={1290}
      />
    );

    const input = screen.getByDisplayValue('Feijao') as HTMLInputElement;
    expect(input).not.toHaveFocus();
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('keeps the caret position when the name input receives focus', () => {
    render(
      <ItemEditorForm
        onSubmit={vi.fn()}
        onClose={vi.fn()}
        initialName="Feijao"
        initialPriceCents={1290}
      />
    );

    const input = screen.getByDisplayValue('Feijao') as HTMLInputElement;
    input.setSelectionRange(3, 3);
    fireEvent.focus(input);

    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
  });
});
