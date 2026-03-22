import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ItemRow from '../components/ItemRow';
import { ModalProvider } from '../contexts/ModalContext';
import type { Item } from '../types';

const item: Item = { id: '1', nome: 'Arroz', categoria: 'Acompanhamentos' };

const defaultProps = {
  item,
  active: false,
  onToggle: vi.fn(),
  onRemove: vi.fn(),
  onRename: vi.fn(),
  mode: 'select' as const,
};

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ModalProvider>{ui}</ModalProvider>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ItemRow', () => {
  it('renders item name', () => {
    renderWithProviders(<ItemRow {...defaultProps} />);
    expect(screen.getByText('Arroz')).toBeInTheDocument();
  });

  it('has active class when active', () => {
    const { container } = renderWithProviders(<ItemRow {...defaultProps} active={true} />);
    expect(container.querySelector('.item')).toHaveClass('active');
  });

  it('calls onToggle when the row button is clicked', () => {
    const onToggle = vi.fn();
    renderWithProviders(<ItemRow {...defaultProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Arroz do menu do dia' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders management actions in manage mode', () => {
    renderWithProviders(<ItemRow {...defaultProps} mode="manage" />);
    expect(screen.getByRole('button', { name: 'Renomear Arroz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Arroz' })).toBeInTheDocument();
  });

  it('opens rename sheet when rename button is clicked', () => {
    renderWithProviders(<ItemRow {...defaultProps} mode="manage" />);
    fireEvent.click(screen.getByRole('button', { name: 'Renomear Arroz' }));
    expect(screen.getByRole('dialog', { name: 'Renomear Arroz' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Arroz')).toBeInTheDocument();
  });

  it('calls onRename with new name when saving', () => {
    const onRename = vi.fn();
    renderWithProviders(<ItemRow {...defaultProps} mode="manage" onRename={onRename} />);
    fireEvent.click(screen.getByRole('button', { name: 'Renomear Arroz' }));
    const input = screen.getByDisplayValue('Arroz');
    fireEvent.change(input, { target: { value: 'Arroz Integral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onRename).toHaveBeenCalledWith('Arroz Integral');
  });

  it('shows confirm modal when remove button is clicked', async () => {
    renderWithProviders(<ItemRow {...defaultProps} mode="manage" />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover Arroz' }));
    expect(await screen.findByText('Remover item')).toBeInTheDocument();
    expect(screen.getByText('Remover "Arroz"?')).toBeInTheDocument();
    expect(screen.getByText('Remover item').parentElement).toHaveClass('text-center');
  });

  it('calls onRemove when modal is confirmed', async () => {
    const onRemove = vi.fn();
    renderWithProviders(<ItemRow {...defaultProps} mode="manage" onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover Arroz' }));
    await act(async () => {
      fireEvent.click(await screen.findByText('Confirmar'));
    });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows a gold dot indicator in select mode when item is alwaysActive', () => {
    const alwaysActiveItem: Item = { ...item, alwaysActive: true };
    renderWithProviders(<ItemRow {...defaultProps} item={alwaysActiveItem} />);
    expect(screen.getByTitle('Sempre ativo')).toBeInTheDocument();
  });

  it('does not show the gold dot indicator when item is not alwaysActive', () => {
    renderWithProviders(<ItemRow {...defaultProps} />);
    expect(screen.queryByTitle('Sempre ativo')).not.toBeInTheDocument();
  });

  it('renders pin button in manage mode when onUpdateAlwaysActive is provided', () => {
    renderWithProviders(
      <ItemRow {...defaultProps} mode="manage" onUpdateAlwaysActive={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Marcar Arroz como sempre ativo' })).toBeInTheDocument();
  });

  it('calls onUpdateAlwaysActive with true when pin button is clicked on inactive item', () => {
    const onUpdateAlwaysActive = vi.fn();
    renderWithProviders(
      <ItemRow {...defaultProps} mode="manage" onUpdateAlwaysActive={onUpdateAlwaysActive} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Marcar Arroz como sempre ativo' }));
    expect(onUpdateAlwaysActive).toHaveBeenCalledWith(true);
  });

  it('calls onUpdateAlwaysActive with false when pin button is clicked on alwaysActive item', () => {
    const alwaysActiveItem: Item = { ...item, alwaysActive: true };
    const onUpdateAlwaysActive = vi.fn();
    renderWithProviders(
      <ItemRow {...defaultProps} item={alwaysActiveItem} mode="manage" onUpdateAlwaysActive={onUpdateAlwaysActive} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar Arroz como sempre ativo' }));
    expect(onUpdateAlwaysActive).toHaveBeenCalledWith(false);
  });

  it('disables pin button when offline', () => {
    const onUpdateAlwaysActive = vi.fn();
    renderWithProviders(
      <ItemRow {...defaultProps} mode="manage" onUpdateAlwaysActive={onUpdateAlwaysActive} isOnline={false} />,
    );
    const pinButton = screen.getByRole('button', { name: 'Marcar Arroz como sempre ativo' });
    expect(pinButton).toBeDisabled();
    fireEvent.click(pinButton);
    expect(onUpdateAlwaysActive).not.toHaveBeenCalled();
  });

  it('disables selection and management actions when offline', () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();

    const { rerender } = renderWithProviders(
      <ItemRow {...defaultProps} onToggle={onToggle} isOnline={false} />
    );

    const toggleButton = screen.getByRole('button', { name: 'Adicionar Arroz do menu do dia' });
    expect(toggleButton).toBeDisabled();
    fireEvent.click(toggleButton);
    expect(onToggle).not.toHaveBeenCalled();

    rerender(
      <ModalProvider>
        <ItemRow {...defaultProps} mode="manage" onRemove={onRemove} isOnline={false} />
      </ModalProvider>
    );

    const renameButton = screen.getByRole('button', { name: 'Renomear Arroz' });
    const removeButton = screen.getByRole('button', { name: 'Remover Arroz' });

    expect(renameButton).toBeDisabled();
    expect(removeButton).toBeDisabled();

    fireEvent.click(renameButton);
    fireEvent.click(removeButton);

    expect(screen.queryByRole('dialog', { name: 'Renomear Arroz' })).not.toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
  });
});
