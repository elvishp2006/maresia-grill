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
});
