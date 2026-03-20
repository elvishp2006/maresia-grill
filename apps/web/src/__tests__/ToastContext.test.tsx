import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { ToastProvider, useToast } from '../contexts/ToastContext';

const ToastHarness = () => {
  const { showToast } = useToast();

  return (
    <div>
      <button type="button" onClick={() => showToast('Falha ao salvar', 'error')}>
        Toast fixo
      </button>
      <button type="button" onClick={() => showToast('Sincronizado', 'success', 10)}>
        Toast temporario
      </button>
      <button type="button" onClick={() => showToast('Operação concluída', 'success')}>
        Toast sucesso padrao
      </button>
      <button type="button" onClick={() => showToast('Falha ao salvar', 'error')}>
        Toast duplicado
      </button>
    </div>
  );
};

describe('ToastProvider', () => {
  it('positions the toast container below the top safe area', () => {
    const { container } = render(createElement(ToastProvider, null, createElement(ToastHarness)));

    fireEvent.click(screen.getByRole('button', { name: 'Toast fixo' }));

    const toastContainer = container.querySelector('.fixed.z-50');
    expect(toastContainer).toHaveStyle({ top: 'max(16px, calc(env(safe-area-inset-top) + 8px))' });
  });

  it('keeps the toast visible until the user closes it', () => {
    render(createElement(ToastProvider, null, createElement(ToastHarness)));

    fireEvent.click(screen.getByRole('button', { name: 'Toast fixo' }));
    expect(screen.getByText('Falha ao salvar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fechar aviso: Falha ao salvar/i }));
    expect(screen.queryByText('Falha ao salvar')).not.toBeInTheDocument();
  });

  it('deduplicates the same toast message and type', () => {
    render(createElement(ToastProvider, null, createElement(ToastHarness)));

    fireEvent.click(screen.getByRole('button', { name: 'Toast fixo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toast duplicado' }));

    expect(screen.getAllByText('Falha ao salvar')).toHaveLength(1);
  });

  it('still allows temporary toasts when a duration is provided', async () => {
    vi.useFakeTimers();
    render(createElement(ToastProvider, null, createElement(ToastHarness)));

    fireEvent.click(screen.getByRole('button', { name: 'Toast temporario' }));
    expect(screen.getByText('Sincronizado')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.queryByText('Sincronizado')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('auto dismisses success toasts by default', async () => {
    vi.useFakeTimers();
    render(createElement(ToastProvider, null, createElement(ToastHarness)));

    fireEvent.click(screen.getByRole('button', { name: 'Toast sucesso padrao' }));
    expect(screen.getByText('Operação concluída')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByText('Operação concluída')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
