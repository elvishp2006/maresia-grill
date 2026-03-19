import type { ToastType } from '../contexts/ToastContext';

export type ShowToastFn = (message: string, type: ToastType, duration?: number | null) => void;

export type AdminErrorContext =
  | 'save'
  | 'load'
  | 'share_link'
  | 'order_intake'
  | 'orders_history'
  | 'lock_request'
  | 'lock_takeover'
  | 'lock_renew';

const DEFAULT_SUCCESS_DURATION_MS = 2500;
const DEFAULT_INFO_DURATION_MS = 2500;

const getErrorCode = (error: unknown) => (
  typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : ''
);

const hasUsableMessage = (error: unknown): error is Error => (
  error instanceof Error && typeof error.message === 'string' && error.message.trim().length > 0
);

export const getAdminErrorMessage = (context: AdminErrorContext, error?: unknown) => {
  if (hasUsableMessage(error)) return error.message;

  const code = getErrorCode(error);
  if (code === 'permission-denied') {
    return context === 'load'
      ? 'Você não tem permissão para carregar estes dados do admin.'
      : 'Você não tem permissão para concluir esta ação no admin.';
  }
  if (code === 'failed-precondition') {
    if (context === 'lock_request' || context === 'lock_takeover' || context === 'lock_renew') {
      return 'O controle de edição ficou desatualizado. Atualize a tela e tente novamente.';
    }
    return 'Os dados do admin ficaram desatualizados. Atualize a tela e tente novamente.';
  }

  switch (context) {
    case 'save':
      return 'Não foi possível salvar esta alteração no admin.';
    case 'load':
      return 'Não foi possível carregar os dados do admin.';
    case 'share_link':
      return 'Não foi possível compartilhar o link.';
    case 'order_intake':
      return 'Não foi possível atualizar o recebimento de pedidos.';
    case 'orders_history':
      return 'Não foi possível carregar o histórico confiável dos pedidos.';
    case 'lock_request':
      return 'Não foi possível solicitar a edição.';
    case 'lock_takeover':
      return 'Não foi possível assumir o controle.';
    case 'lock_renew':
      return 'Não foi possível renovar a sessão de edição.';
    default:
      return 'Não foi possível concluir a ação no admin.';
  }
};

export const showAdminError = (
  showToast: ShowToastFn,
  context: AdminErrorContext,
  error?: unknown,
) => {
  showToast(getAdminErrorMessage(context, error), 'error');
};

export const showAdminSuccess = (
  showToast: ShowToastFn,
  message: string,
  duration = DEFAULT_SUCCESS_DURATION_MS,
) => {
  showToast(message, 'success', duration);
};

export const showAdminInfo = (
  showToast: ShowToastFn,
  message: string,
  duration = DEFAULT_INFO_DURATION_MS,
) => {
  showToast(message, 'info', duration);
};
