import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from '@testing-library/react';
import AddForm from '../components/AddForm';

const lightTapMock = vi.fn();
const successMock = vi.fn();

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    lightTap: lightTapMock,
    success: successMock,
  }),
}));

describe('AddForm', () => {
  beforeEach(() => {
    lightTapMock.mockClear();
    successMock.mockClear();
  });

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

  it('submits a trimmed value, resets the field and closes the form', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(<AddForm onAdd={onAdd} onClose={onClose} />);

    await user.type(screen.getByRole('textbox'), '  Arroz  ');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(successMock).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('Arroz');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('prevents disabled submissions and shows the disabled message', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(
      <AddForm
        onAdd={onAdd}
        onClose={onClose}
        disabled
        disabledMessage="Sem conexão"
      />,
    );

    expect(screen.getByText('Sem conexão')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), 'Feijão');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(successMock).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes through escape and cancel using light haptic feedback', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<AddForm onAdd={vi.fn()} onClose={onClose} />);

    await user.type(screen.getByRole('textbox'), 'Arroz');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(lightTapMock).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores blank submissions', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(<AddForm onAdd={onAdd} onClose={onClose} />);

    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(successMock).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
