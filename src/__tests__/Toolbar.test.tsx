import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from '../components/Toolbar';

const defaultProps = {
  search: '',
  onSearchChange: vi.fn(),
  sortMode: 'alpha' as const,
  onToggleSort: vi.fn(),
  viewMode: 'select' as const,
  stickyTop: 188,
};

describe('Toolbar', () => {
  it('renders search input and sort button', () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Buscar item para o menu de hoje')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais usados' })).toBeInTheDocument();
  });

  it('changes helper copy based on mode', () => {
    const { rerender } = render(<Toolbar {...defaultProps} />);
    expect(screen.getByText('Selecao rapida')).toBeInTheDocument();
    expect(screen.getByText('Ordem alfabetica')).toBeInTheDocument();

    rerender(<Toolbar {...defaultProps} viewMode="manage" />);
    expect(screen.getByText('Busca e organizacao')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar item ou categoria')).toBeInTheDocument();
  });

  it('shows "A-Z" label when sortMode is usage', () => {
    render(<Toolbar {...defaultProps} sortMode="usage" />);
    expect(screen.getByRole('button', { name: 'A-Z' })).toBeInTheDocument();
    expect(screen.getByText('Prioridade por frequencia')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(<Toolbar {...defaultProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar item para o menu de hoje'), {
      target: { value: 'arroz' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('arroz');
  });

  it('clears search and keeps focus on input when clear button clicked', () => {
    const onSearchChange = vi.fn();
    render(<Toolbar {...defaultProps} search="arroz" onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('Buscar item para o menu de hoje');
    input.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));

    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(input).toHaveFocus();
  });

  it('calls onToggleSort when sort button clicked', () => {
    const onToggleSort = vi.fn();
    render(<Toolbar {...defaultProps} onToggleSort={onToggleSort} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mais usados' }));
    expect(onToggleSort).toHaveBeenCalledTimes(1);
  });

  it('applies the provided sticky offset', () => {
    render(<Toolbar {...defaultProps} stickyTop={212} />);
    expect(screen.getByText('Selecao rapida').closest('div.sticky')).toHaveStyle({ top: '212px' });
  });
});
