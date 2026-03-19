import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AddForm from '../components/AddForm';

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    lightTap: vi.fn(),
    success: vi.fn(),
  }),
}));

describe('AddForm', () => {
  it('does not auto focus or auto select the input when mounted with initial value', () => {
    render(
      <AddForm
        onAdd={vi.fn()}
        onClose={vi.fn()}
        initialValue="Arroz"
      />
    );

    const input = screen.getByDisplayValue('Arroz') as HTMLInputElement;
    expect(input).not.toHaveFocus();
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('keeps the current caret position when the field receives focus', () => {
    render(
      <AddForm
        onAdd={vi.fn()}
        onClose={vi.fn()}
        initialValue="Arroz"
      />
    );

    const input = screen.getByDisplayValue('Arroz') as HTMLInputElement;
    input.setSelectionRange(2, 2);
    fireEvent.focus(input);

    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2);
  });
});
