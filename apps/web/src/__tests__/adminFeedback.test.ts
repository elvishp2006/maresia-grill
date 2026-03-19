import { describe, expect, it, vi } from 'vitest';
import {
  getAdminErrorMessage,
  showAdminError,
  showAdminInfo,
  showAdminSuccess,
} from '../lib/adminFeedback';

describe('adminFeedback', () => {
  it('prefers a usable error message when one is available', () => {
    expect(getAdminErrorMessage('save', new Error('Falha detalhada'))).toBe('Falha detalhada');
  });

  it('maps permission errors by context', () => {
    expect(getAdminErrorMessage('load', { code: 'permission-denied' }))
      .toBe('Você não tem permissão para carregar estes dados do admin.');
    expect(getAdminErrorMessage('save', { code: 'permission-denied' }))
      .toBe('Você não tem permissão para concluir esta ação no admin.');
  });

  it('maps failed precondition errors for editor lock contexts', () => {
    expect(getAdminErrorMessage('lock_request', { code: 'failed-precondition' }))
      .toBe('O controle de edição ficou desatualizado. Atualize a tela e tente novamente.');
    expect(getAdminErrorMessage('save', { code: 'failed-precondition' }))
      .toBe('Os dados do admin ficaram desatualizados. Atualize a tela e tente novamente.');
  });

  it('returns fallback messages for each admin context', () => {
    expect(getAdminErrorMessage('share_link')).toBe('Não foi possível compartilhar o link.');
    expect(getAdminErrorMessage('order_intake')).toBe('Não foi possível atualizar o recebimento de pedidos.');
    expect(getAdminErrorMessage('orders_history')).toBe('Não foi possível carregar o histórico confiável dos pedidos.');
    expect(getAdminErrorMessage('lock_takeover')).toBe('Não foi possível assumir o controle.');
    expect(getAdminErrorMessage('lock_renew')).toBe('Não foi possível renovar a sessão de edição.');
  });

  it('uses toast helpers with the expected message, type and duration', () => {
    const showToast = vi.fn();

    showAdminError(showToast, 'save');
    showAdminSuccess(showToast, 'Salvo com sucesso');
    showAdminInfo(showToast, 'Atualizando dados');
    showAdminSuccess(showToast, 'Com duração customizada', 5000);
    showAdminInfo(showToast, 'Com duração customizada', 3500);

    expect(showToast).toHaveBeenNthCalledWith(1, 'Não foi possível salvar esta alteração no admin.', 'error');
    expect(showToast).toHaveBeenNthCalledWith(2, 'Salvo com sucesso', 'success', 2500);
    expect(showToast).toHaveBeenNthCalledWith(3, 'Atualizando dados', 'info', 2500);
    expect(showToast).toHaveBeenNthCalledWith(4, 'Com duração customizada', 'success', 5000);
    expect(showToast).toHaveBeenNthCalledWith(5, 'Com duração customizada', 'info', 3500);
  });
});
