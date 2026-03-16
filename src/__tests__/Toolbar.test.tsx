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
    expect(screen.getByRole('button')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button'));
    expect(onToggleSort).toHaveBeenCalledTimes(1);
  });
});
