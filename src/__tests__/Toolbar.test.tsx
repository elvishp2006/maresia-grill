import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from '../components/Toolbar';

describe('Toolbar', () => {
  it('renders search input and sort button', () => {
    render(
      <Toolbar
        search=""
        onSearchChange={vi.fn()}
        sortMode="alpha"
        onToggleSort={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText('Filtrar itens...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A–Z' })).toBeInTheDocument();
  });

  it('shows A–Z label when sortMode is alpha', () => {
    render(
      <Toolbar
        search=""
        onSearchChange={vi.fn()}
        sortMode="alpha"
        onToggleSort={vi.fn()}
      />
    );
    expect(screen.getByRole('button')).toHaveTextContent('A–Z');
  });

  it('shows Uso label when sortMode is usage', () => {
    render(
      <Toolbar
        search=""
        onSearchChange={vi.fn()}
        sortMode="usage"
        onToggleSort={vi.fn()}
      />
    );
    expect(screen.getByRole('button')).toHaveTextContent('Uso');
  });

  it('calls onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(
      <Toolbar
        search=""
        onSearchChange={onSearchChange}
        sortMode="alpha"
        onToggleSort={vi.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('Filtrar itens...'), {
      target: { value: 'arroz' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('arroz');
  });

  it('does not render clear button when search is empty', () => {
    render(
      <Toolbar
        search=""
        onSearchChange={vi.fn()}
        sortMode="alpha"
        onToggleSort={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeInTheDocument();
  });

  it('renders clear button when search has value', () => {
    render(
      <Toolbar
        search="arroz"
        onSearchChange={vi.fn()}
        sortMode="alpha"
        onToggleSort={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
  });

  it('clears search and keeps focus on input when clear button clicked', () => {
    const onSearchChange = vi.fn();
    render(
      <Toolbar
        search="arroz"
        onSearchChange={onSearchChange}
        sortMode="alpha"
        onToggleSort={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Filtrar itens...');
    input.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));

    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(input).toHaveFocus();
  });

  it('calls onToggleSort when sort button clicked', () => {
    const onToggleSort = vi.fn();
    render(
      <Toolbar
        search=""
        onSearchChange={vi.fn()}
        sortMode="alpha"
        onToggleSort={onToggleSort}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'A–Z' }));
    expect(onToggleSort).toHaveBeenCalledTimes(1);
  });
});
