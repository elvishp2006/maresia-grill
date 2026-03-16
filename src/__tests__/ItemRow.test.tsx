import { describe, it, expect, vi } from 'vitest';
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
};

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ModalProvider>{ui}</ModalProvider>);

describe('ItemRow', () => {
  it('renders item name', () => {
    renderWithProviders(<ItemRow {...defaultProps} />);
    expect(screen.getByText('Arroz')).toBeInTheDocument();
  });

  it('has active class when active', () => {
    const { container } = renderWithProviders(<ItemRow {...defaultProps} active={true} />);
    expect(container.querySelector('.item')).toHaveClass('active');
  });

  it('calls onToggle when checkbox changes', () => {
    const onToggle = vi.fn();
    renderWithProviders(<ItemRow {...defaultProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('enters edit mode when edit button clicked', () => {
    renderWithProviders(<ItemRow {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Renomear Arroz'));
    expect(screen.getByDisplayValue('Arroz')).toBeInTheDocument();
  });

  it('calls onRename with new name on Enter', () => {
    const onRename = vi.fn();
    renderWithProviders(<ItemRow {...defaultProps} onRename={onRename} />);
    fireEvent.click(screen.getByLabelText('Renomear Arroz'));
    const input = screen.getByDisplayValue('Arroz');
    fireEvent.change(input, { target: { value: 'Arroz Integral' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Arroz Integral');
  });

  it('cancels edit on Escape without calling onRename', () => {
    const onRename = vi.fn();
    renderWithProviders(<ItemRow {...defaultProps} onRename={onRename} />);
    fireEvent.click(screen.getByLabelText('Renomear Arroz'));
    const input = screen.getByDisplayValue('Arroz');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Arroz')).toBeInTheDocument();
  });

  it('does not call onRename when value is unchanged', () => {
    const onRename = vi.fn();
    renderWithProviders(<ItemRow {...defaultProps} onRename={onRename} />);
    fireEvent.click(screen.getByLabelText('Renomear Arroz'));
    const input = screen.getByDisplayValue('Arroz');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
  });

  it('shows confirm modal when remove button is clicked', async () => {
    renderWithProviders(<ItemRow {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Remover Arroz'));
    expect(await screen.findByText('Remover item')).toBeInTheDocument();
    expect(screen.getByText('Remover "Arroz"?')).toBeInTheDocument();
  });

  it('calls onRemove when modal is confirmed', async () => {
    const onRemove = vi.fn();
    renderWithProviders(<ItemRow {...defaultProps} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('Remover Arroz'));
    await act(async () => {
      fireEvent.click(await screen.findByText('Confirmar'));
    });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not call onRemove when modal is cancelled', async () => {
    const onRemove = vi.fn();
    renderWithProviders(<ItemRow {...defaultProps} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('Remover Arroz'));
    await act(async () => {
      fireEvent.click(await screen.findByText('Cancelar'));
    });
    expect(onRemove).not.toHaveBeenCalled();
  });
});
