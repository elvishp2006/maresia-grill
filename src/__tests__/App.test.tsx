import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { ModalProvider } from '../contexts/ModalContext';
import { ToastProvider } from '../contexts/ToastContext';
import type { EditorLock } from '../types';

const buildOrderLine = (
  itemId: string,
  name: string,
  categoryName: string,
  quantity = 1,
  unitPriceCents = 0,
) => ({
  itemId,
  quantity,
  unitPriceCents,
  name,
  categoryId: categoryName.toLowerCase(),
  categoryName,
});

vi.mock('../hooks/useMenuInsights', () => ({
  useMenuInsights: vi.fn(() => ({
    loading: false,
    error: null,
    trackedDays: 8,
    weekdayLabel: 'Seg',
    topItems: [{ id: '1', nome: 'Alface', categoria: 'Saladas', count: 4 }],
    weekdayAverages: [{ weekday: 1, label: 'Seg', average: 3, sampleSize: 2 }],
    categoryLeaders: [{ id: '1', nome: 'Alface', categoria: 'Saladas', count: 4 }],
    streakItems: [{ id: '1', nome: 'Alface', categoria: 'Saladas', count: 4, streak: 2 }],
    neglectedItems: [{ id: '2', nome: 'Frango', categoria: 'Carnes', count: 0, lastSeen: null }],
    suggestedItems: [{ id: '2', nome: 'Frango', categoria: 'Carnes', score: 8, reason: 'Usado recentemente', totalCount: 2, weekdayCount: 1 }],
  })),
}));

const useAuthSessionMock = vi.fn(() => ({
  user: { email: 'chef@maresia.com' } as { email: string } | null,
  loading: false,
  authError: null as string | null,
  signInPending: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../hooks/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

const useOnlineStatusMock = vi.fn(() => ({ isOnline: true }));

vi.mock('../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => useOnlineStatusMock(),
}));

const applyUpdateMock = vi.fn().mockResolvedValue(undefined);
type UpdateNotificationOptions = {
  autoApply?: boolean;
  reloadOnControllerChange?: boolean;
  showUpdatedToast?: boolean;
};

const useUpdateNotificationMock = vi.fn((options?: UpdateNotificationOptions) => {
  void options;
  return {
  needRefresh: false,
  applyUpdate: applyUpdateMock,
  dismiss: vi.fn(),
  };
});

vi.mock('../hooks/useUpdateNotification', () => ({
  useUpdateNotification: (options?: UpdateNotificationOptions) => useUpdateNotificationMock(options),
}));

const useEditorLockMock = vi.fn(() => ({
  canEdit: true,
  loading: false,
  lock: null as EditorLock | null,
  isExpired: false,
  isOwner: true,
  error: null as string | null,
  requestEditAccess: vi.fn().mockResolvedValue(true),
  takeControl: vi.fn().mockResolvedValue(true),
  releaseEditAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../hooks/useEditorLock', () => ({
  useEditorLock: () => useEditorLockMock(),
}));

const toggleItem = vi.fn();
const subscribeOrdersMock = vi.fn();
const getOrCreateDailyShareLinkMock = vi.fn().mockResolvedValue({
  token: 'token-1',
  url: 'https://maresia.example/s/token-1',
});
const subscribePublicMenuMock = vi.fn();
const submitPublicOrderMock = vi.fn().mockResolvedValue({
  orderId: 'public-order-1',
  customerName: 'Ana',
  lines: [buildOrderLine('1', 'Alface', 'Saladas')],
  paymentSummary: {
    freeTotalCents: 0,
    paidTotalCents: 0,
    currency: 'BRL',
    paymentStatus: 'not_required',
    provider: null,
    paymentMethod: null,
    providerPaymentId: null,
    refundedAt: null,
  },
});
const deletePublicOrderMock = vi.fn().mockResolvedValue(undefined);
const preparePublicOrderCheckoutMock = vi.fn();
const fetchPublicOrderStatusMock = vi.fn();
const cancelPublicOrderMock = vi.fn().mockResolvedValue({
  refunded: true,
  paymentSummary: null,
});
const syncPublicMenuSnapshotForDateMock = vi.fn().mockResolvedValue(undefined);
const subscribeOrderIntakeStatusMock = vi.fn();
const setOrderIntakeStatusMock = vi.fn().mockResolvedValue(undefined);
const loadPublicMenuVersionsMock = vi.fn().mockResolvedValue({});

vi.mock('../lib/storage', () => ({
  subscribeOrders: (...args: unknown[]) => subscribeOrdersMock(...args),
  getOrCreateDailyShareLink: (...args: unknown[]) => getOrCreateDailyShareLinkMock(...args),
  loadPublicMenuVersions: (...args: unknown[]) => loadPublicMenuVersionsMock(...args),
  subscribeOrderIntakeStatus: (...args: unknown[]) => subscribeOrderIntakeStatusMock(...args),
  setOrderIntakeStatus: (...args: unknown[]) => setOrderIntakeStatusMock(...args),
  subscribePublicMenu: (...args: unknown[]) => subscribePublicMenuMock(...args),
  submitPublicOrder: (...args: unknown[]) => submitPublicOrderMock(...args),
  deletePublicOrder: (...args: unknown[]) => deletePublicOrderMock(...args),
  preparePublicOrderCheckout: (...args: unknown[]) => preparePublicOrderCheckoutMock(...args),
  fetchPublicOrderStatus: (...args: unknown[]) => fetchPublicOrderStatusMock(...args),
  cancelPublicOrder: (...args: unknown[]) => cancelPublicOrderMock(...args),
  syncPublicMenuSnapshotForDate: (...args: unknown[]) => syncPublicMenuSnapshotForDateMock(...args),
}));

const defaultMenuState = {
  categories: ['Saladas', 'Carnes'] as string[],
  complements: [
    { id: '1', nome: 'Alface', categoria: 'Saladas' },
    { id: '2', nome: 'Frango', categoria: 'Carnes' },
  ],
  categorySelectionRules: [] as Array<{ category: string; maxSelections?: number | null; sharedLimitGroupId?: string | null }>,
  daySelection: ['1'] as string[],
  usageCounts: {} as Record<string, number>,
  sortMode: 'alpha' as const,
  loading: false,
  pendingWrites: 0,
  dataRevision: 0,
  persistedRevision: 0,
  currentDateKey: '2026-03-17',
  toggleSortMode: vi.fn(),
  toggleItem,
  addItem: vi.fn(),
  removeItem: vi.fn(),
  updateItem: vi.fn(),
  renameItem: vi.fn(),
  addCategory: vi.fn(),
  removeCategory: vi.fn(),
  moveCategory: vi.fn(),
  saveCategoryRule: vi.fn(),
};

const useMenuStateMock = vi.fn(() => defaultMenuState);

vi.mock('../hooks/useMenuState', () => ({
  useMenuState: () => useMenuStateMock(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('App', () => {
  const todayShort = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    window.history.pushState({}, '', '/');
    localStorage.clear();
    window.scrollTo = vi.fn();
    toggleItem.mockReset();
    useMenuStateMock.mockReturnValue(defaultMenuState);
    useAuthSessionMock.mockReturnValue({
      user: { email: 'chef@maresia.com' },
      loading: false,
      authError: null,
      signInPending: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    useOnlineStatusMock.mockReturnValue({ isOnline: true });
    useUpdateNotificationMock.mockReturnValue({
      needRefresh: false,
      applyUpdate: applyUpdateMock,
      dismiss: vi.fn(),
    });
    applyUpdateMock.mockReset();
    useEditorLockMock.mockReturnValue({
      canEdit: true,
      loading: false,
      lock: null as EditorLock | null,
      isExpired: false,
      isOwner: true,
      error: null,
      requestEditAccess: vi.fn().mockResolvedValue(true),
      takeControl: vi.fn().mockResolvedValue(true),
      releaseEditAccess: vi.fn().mockResolvedValue(undefined),
    });
    vi.stubGlobal('alert', vi.fn());
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      share: undefined,
    });
    subscribeOrdersMock.mockImplementation((_dateKey: string, onValue: (orders: unknown[]) => void) => {
      onValue([]);
      return vi.fn();
    });
    subscribeOrderIntakeStatusMock.mockImplementation((_dateKey: string, onValue: (acceptingOrders: boolean) => void) => {
      onValue(true);
      return vi.fn();
    });
    loadPublicMenuVersionsMock.mockResolvedValue({});
    setOrderIntakeStatusMock.mockResolvedValue(undefined);
    syncPublicMenuSnapshotForDateMock.mockResolvedValue(undefined);
    submitPublicOrderMock.mockResolvedValue({
      orderId: 'public-order-1',
      customerName: 'Ana',
      lines: [
        buildOrderLine('1', 'Alface', 'Saladas'),
        buildOrderLine('3', 'Molho da casa', 'Molhos'),
        buildOrderLine('2', 'Frango', 'Carnes'),
      ],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 0,
        currency: 'BRL',
        paymentStatus: 'not_required',
        provider: null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    });
    deletePublicOrderMock.mockResolvedValue(undefined);
    preparePublicOrderCheckoutMock.mockReset();
    fetchPublicOrderStatusMock.mockReset();
    cancelPublicOrderMock.mockResolvedValue({
      refunded: true,
      paymentSummary: null,
    });
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: true,
        currentVersionId: 'version-1',
        categories: ['Saladas'],
        items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
        categorySelectionRules: [],
      });
      return vi.fn();
    });
  });

  it('shows the share button when items are selected in menu mode', () => {
    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.getByRole('button', { name: 'Compartilhar menu' })).toBeInTheDocument();
  });

  it('hides the share button when no items are selected', () => {
    useMenuStateMock.mockReturnValue({ ...defaultMenuState, daySelection: [] });

    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.queryByRole('button', { name: 'Compartilhar menu' })).not.toBeInTheDocument();
    useMenuStateMock.mockReturnValue(defaultMenuState);
  });

  it('copies menu to clipboard when text share is chosen and navigator.share is unavailable', async () => {
    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar texto' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    expect(await screen.findByText('Menu copiado!')).toBeInTheDocument();
  });

  it('shares the daily link when the link option is chosen', async () => {
    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar link único' }));

    await waitFor(() => {
      expect(getOrCreateDailyShareLinkMock).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://maresia.example/s/token-1');
    });
    expect(await screen.findByText('Link copiado!')).toBeInTheDocument();
  });

  it('disables daily link sharing when order intake is closed', () => {
    subscribeOrderIntakeStatusMock.mockImplementation((_dateKey: string, onValue: (acceptingOrders: boolean) => void) => {
      onValue(false);
      return vi.fn();
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar menu' }));

    expect(screen.getByRole('button', { name: 'Compartilhar link único' })).toBeDisabled();
    expect(screen.getByText(/recebimento estiver encerrado/i)).toBeInTheDocument();
  });

  it('shows the update indicator in the header and applies the update on click', async () => {
    useUpdateNotificationMock.mockReturnValue({
      needRefresh: true,
      applyUpdate: applyUpdateMock,
      dismiss: vi.fn(),
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar atualização do app' }));

    await waitFor(() => {
      expect(applyUpdateMock).toHaveBeenCalledTimes(1);
    });
  });

  it('configures automatic updates on public menu routes', () => {
    window.history.pushState({}, '', '/s/token-1');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(useUpdateNotificationMock).toHaveBeenCalledWith({
      autoApply: true,
      reloadOnControllerChange: true,
      showUpdatedToast: false,
    });
  });

  it('opens the first visible category by default', () => {
    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.getByRole('img', { name: 'Logo do Maresia Grill' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Menu do Dia' })).not.toBeInTheDocument();
    expect(screen.getByText(`1 • ${todayShort}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colapsar Saladas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir Carnes' })).toBeInTheDocument();
    expect(screen.queryByText('Sugestões inteligentes')).not.toBeInTheDocument();
  });

  it('allows collapsing the currently open category', () => {
    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Colapsar Saladas' }));

    expect(screen.getByRole('button', { name: 'Expandir Saladas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir Carnes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Alface do menu do dia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar Frango do menu do dia' })).not.toBeInTheDocument();
  });

  it('opens only the category that was explicitly selected', () => {
    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Carnes' }));

    expect(screen.getByRole('button', { name: 'Expandir Saladas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colapsar Carnes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Alface do menu do dia' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar Frango do menu do dia' })).toBeInTheDocument();
  });

  it('renders suggestions and selects an item from insights', () => {
    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Estatísticas' }));
    expect(screen.getByText('Sugestões inteligentes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
    expect(toggleItem).toHaveBeenCalledWith('2');
  });

  it('hides toolbar and categories in statistics area', () => {
    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Estatísticas' }));

    expect(screen.queryByPlaceholderText('Buscar item para o menu de hoje')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Colapsar Saladas' })).not.toBeInTheDocument();
    expect(screen.getByText('Leitura do cardápio')).toBeInTheDocument();
  });

  it('renders the orders tab and empty state', () => {
    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Pedidos' }));

    expect(screen.getByText('Nenhum pedido ainda')).toBeInTheDocument();
  });

  it('allows closing order intake from the orders tab', async () => {
    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Pedidos' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Recebimento de pedidos' }));

    await waitFor(() => {
      expect(setOrderIntakeStatusMock).toHaveBeenCalledWith(expect.objectContaining({
        dateKey: '2026-03-17',
        acceptingOrders: false,
      }));
    });
    expect(await screen.findByText('Recebimento de pedidos encerrado.')).toBeInTheDocument();
  });

  it('renders order categories following the configured category order', () => {
    subscribeOrdersMock.mockImplementation((_dateKey: string, onValue: (orders: unknown[]) => void) => {
      onValue([{
        id: 'order-1',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
        orderId: 'order-1',
        customerName: 'Ana',
        menuVersionId: 'version-1',
        lines: [
          { itemId: '1', quantity: 1, unitPriceCents: 0, name: 'Alface', categoryId: 'saladas', categoryName: 'Saladas' },
          { itemId: '2', quantity: 1, unitPriceCents: 0, name: 'Frango', categoryId: 'carnes', categoryName: 'Carnes' },
          { itemId: '3', quantity: 1, unitPriceCents: 0, name: 'Molho da casa', categoryId: 'molhos', categoryName: 'Molhos' },
        ],
        paymentSummary: {
          freeTotalCents: 0,
          paidTotalCents: 0,
          currency: 'BRL',
          paymentStatus: 'not_required',
          provider: null,
          paymentMethod: null,
          providerPaymentId: null,
          refundedAt: null,
        },
        submittedAt: Date.now(),
      }]);
      return vi.fn();
    });
    loadPublicMenuVersionsMock.mockResolvedValue({
      'version-1': {
        id: 'version-1',
        token: 'token-1',
        dateKey: '2026-03-17',
        categories: ['Saladas', 'Carnes'],
        itemIds: ['1', '2', '3'],
        items: [
          { id: '2', nome: 'Frango', categoria: 'Carnes' },
          { id: '3', nome: 'Molho da casa', categoria: 'Molhos' },
          { id: '1', nome: 'Alface', categoria: 'Saladas' },
        ],
        createdAt: Date.now(),
      },
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Pedidos' }));

    return waitFor(() => {
      const categoryLabels = screen.getAllByText(/^(Saladas|Carnes|Molhos)$/).map(node => node.textContent);
      expect(categoryLabels).toEqual(['Saladas', 'Carnes', 'Molhos']);
    });
  });

  it('shows the offline warning and disables statistics when offline', () => {
    useOnlineStatusMock.mockReturnValue({ isOnline: false });

    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.getByText('Sem internet')).toBeInTheDocument();
    expect(screen.getByText(/Edição, seleção do menu e estatísticas estão indisponíveis/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Estatísticas' })).toBeDisabled();
  });

  it('renders an offline empty state when the statistics view is open and connection drops', () => {
    const { rerender } = render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Estatísticas' }));
    expect(screen.getByText('Sugestões inteligentes')).toBeInTheDocument();

    useOnlineStatusMock.mockReturnValue({ isOnline: false });

    rerender(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.getByText('Estatísticas indisponíveis')).toBeInTheDocument();
    expect(screen.getByText(/Conecte-se a internet para consultar sugestões e histórico/i)).toBeInTheDocument();
  });

  it('shows the read-only banner when another device owns the editor lock', () => {
    useEditorLockMock.mockReturnValue({
      canEdit: false,
      loading: false,
      lock: {
        sessionId: 'other-session',
        userEmail: 'outra@maresia.com',
        deviceLabel: 'iPhone',
        status: 'active',
        acquiredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        expiresAt: Date.now() + 30_000,
      },
      isExpired: false,
      isOwner: false,
      error: null,
      requestEditAccess: vi.fn().mockResolvedValue(false),
      takeControl: vi.fn().mockResolvedValue(true),
      releaseEditAccess: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.getByText('Leitura somente')).toBeInTheDocument();
    expect(screen.getByText(/outra@maresia.com está editando em iPhone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assumir controle' })).toBeInTheDocument();
  });

  it('shows a Firestore rules hint when the editor lock read is denied', () => {
    useEditorLockMock.mockReturnValue({
      canEdit: false,
      loading: false,
      lock: null,
      isExpired: false,
      isOwner: false,
      error: 'Missing or insufficient permissions.',
      requestEditAccess: vi.fn().mockResolvedValue(false),
      takeControl: vi.fn().mockResolvedValue(false),
      releaseEditAccess: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.getByText(/não conseguiu acessar o documento de lock no Firestore/i)).toBeInTheDocument();
    expect(screen.getByText(/Publique as regras mais recentes do Firestore/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assumir controle' })).not.toBeInTheDocument();
  });

  it('renders the sign-in screen when there is no session', () => {
    useAuthSessionMock.mockReturnValue({
      user: null,
      loading: false,
      authError: null,
      signInPending: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.getByRole('img', { name: 'Logo do Marésia Grill' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Marésia Grill' })).not.toBeInTheDocument();
  });

  it('keeps auth errors visible on the sign-in screen', () => {
    useAuthSessionMock.mockReturnValue({
      user: null,
      loading: false,
      authError: 'Login cancelado.',
      signInPending: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.getByText('Login cancelado.')).toBeInTheDocument();
  });

  it('renders the public menu route without login', async () => {
    window.history.pushState({}, '', '/s/token-1');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByPlaceholderText('Digite seu nome')).toBeInTheDocument();
    expect(screen.getByText('Saladas')).toBeInTheDocument();
  });

  it('renders the public closed state when order intake is closed', async () => {
    window.history.pushState({}, '', '/s/token-1');
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: false,
        currentVersionId: 'version-1',
        categories: ['Saladas'],
        items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
        categorySelectionRules: [],
      });
      return vi.fn();
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByText('O recebimento de pedidos foi encerrado')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Digite seu nome')).not.toBeInTheDocument();
  });

  it('syncs the public menu snapshot while the authenticated menu changes', async () => {
    vi.useFakeTimers();
    let menuState = { ...defaultMenuState, dataRevision: 0, persistedRevision: 0 };
    useMenuStateMock.mockImplementation(() => menuState);

    const view = render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    menuState = { ...defaultMenuState, dataRevision: 1, persistedRevision: 1 };
    view.rerender(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    expect(syncPublicMenuSnapshotForDateMock).toHaveBeenCalledWith(expect.objectContaining({
      dateKey: '2026-03-17',
      categories: ['Saladas', 'Carnes'],
      daySelection: ['1'],
    }));
    expect(screen.queryByText('Sincronizando público')).not.toBeInTheDocument();

    useMenuStateMock.mockImplementation(() => defaultMenuState);
  });

  it('shows success state after sending a public order and allows editing again', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'public-order-1' });
    window.history.pushState({}, '', '/s/token-1');
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: true,
        currentVersionId: 'version-1',
        categories: ['Carnes', 'Saladas', 'Molhos'],
        items: [
          { id: '1', nome: 'Alface', categoria: 'Saladas' },
          { id: '2', nome: 'Frango', categoria: 'Carnes' },
          { id: '3', nome: 'Molho da casa', categoria: 'Molhos' },
        ],
        categorySelectionRules: [],
      });
      return vi.fn();
    });
    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.change(await screen.findByPlaceholderText('Digite seu nome'), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Alface do menu do dia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Frango do menu do dia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Molho da casa do menu do dia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));

    await waitFor(() => {
      expect(submitPublicOrderMock).toHaveBeenCalledWith(expect.objectContaining({
        orderId: 'public-order-1',
        customerName: 'Ana',
        selectedItems: [
          { itemId: '1', quantity: 1 },
          { itemId: '2', quantity: 1 },
          { itemId: '3', quantity: 1 },
        ],
      }));
    });

    expect(await screen.findByText('Seu pedido foi enviado')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/enviado');
    expect(screen.getByText('Seu nome')).toBeInTheDocument();
    expect(screen.getByText('Itens escolhidos')).toBeInTheDocument();
    const groupedCategoryLabels = screen.getAllByText(/^(Carnes|Saladas|Molhos)$/).map(node => node.textContent);
    expect(groupedCategoryLabels.slice(0, 3)).toEqual(['Carnes', 'Saladas', 'Molhos']);
    expect(screen.getByText('Frango')).toBeInTheDocument();
    expect(screen.getByText('Alface')).toBeInTheDocument();
    expect(screen.getByText('Molho da casa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar pedido' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument();
    expect(screen.getByText('Para mudar os itens, cancele este pedido e faça um novo.')).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('opens embedded checkout without asking for e-mail in the main form', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'public-order-1' });
    preparePublicOrderCheckoutMock.mockResolvedValue({
      kind: 'payment_required',
      draftId: 'draft-1',
      checkoutSession: {
        clientSecret: 'cs_test_123',
        draftId: 'draft-1',
        provider: 'stripe',
      },
    });
    window.history.pushState({}, '', '/s/token-1');
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: true,
        currentVersionId: 'version-1',
        categories: ['Carnes'],
        items: [
          { id: '2', nome: 'Frango', categoria: 'Carnes', priceCents: 1500 },
        ],
        categorySelectionRules: [],
      });
      return vi.fn();
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.change(await screen.findByPlaceholderText('Digite seu nome'), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Frango do menu do dia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pagar e finalizar pedido' }));

    await waitFor(() => {
    expect(preparePublicOrderCheckoutMock).toHaveBeenCalledWith(expect.objectContaining({
        customerName: 'Ana',
      }));
    });
    expect(await screen.findByRole('heading', { name: 'Finalize seu pedido' })).toBeInTheDocument();
    expect(await screen.findByPlaceholderText('voce@empresa.com')).toBeInTheDocument();
  });

  it('opens the limit sheet in the manage tab and saves linked categories', async () => {
    const saveCategoryRule = vi.fn();
    useMenuStateMock.mockReturnValue({
      ...defaultMenuState,
      saveCategoryRule,
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Catálogo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Carnes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limite' }));

    expect(saveCategoryRule).toHaveBeenCalledWith('Saladas', {
      maxSelections: 2,
      sharedLimitGroupId: null,
      linkedCategories: ['Carnes'],
    });
  });

  it('disables the remaining public items when a category reaches its maximum', async () => {
    window.history.pushState({}, '', '/s/token-1');
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: true,
        currentVersionId: 'version-1',
        categories: ['Saladas'],
        items: [
          { id: '1', nome: 'Alface', categoria: 'Saladas' },
          { id: '3', nome: 'Tomate', categoria: 'Saladas' },
        ],
        categorySelectionRules: [{ category: 'Saladas', maxSelections: 1 }],
      });
      return vi.fn();
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Alface do menu do dia' }));

    const tomateButton = screen.getByRole('button', { name: 'Adicionar Tomate do menu do dia' });
    expect(tomateButton).toBeDisabled();
    expect(screen.getByText('Limite atingido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Alface do menu do dia' })).toBeInTheDocument();
  });

  it('disables remaining items in linked categories when the shared maximum is reached', async () => {
    window.history.pushState({}, '', '/s/token-1');
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: true,
        currentVersionId: 'version-1',
        categories: ['Churrasco', 'Carnes'],
        items: [
          { id: '1', nome: 'Picanha', categoria: 'Churrasco' },
          { id: '2', nome: 'Frango', categoria: 'Carnes' },
          { id: '3', nome: 'Linguica', categoria: 'Carnes' },
        ],
        categorySelectionRules: [
          { category: 'Churrasco', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
          { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
        ],
      });
      return vi.fn();
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Picanha do menu do dia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Frango do menu do dia' }));

    const linguicaButton = screen.getByRole('button', { name: 'Adicionar Linguica do menu do dia' });
    expect(linguicaButton).toBeDisabled();
    expect(screen.getAllByText('Limite atingido').length).toBeGreaterThan(0);
  });

  it('renders repeated items without a redundant left-side indicator', async () => {
    window.history.pushState({}, '', '/s/token-1');
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: true,
        currentVersionId: 'version-1',
        categories: ['Sobremesas'],
        items: [
          { id: '1', nome: 'Brownie', categoria: 'Sobremesas' },
        ],
        categorySelectionRules: [{ category: 'Sobremesas', allowRepeatedItems: true }],
      });
      return vi.fn();
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByText('Brownie')).toBeInTheDocument();
    expect(screen.getByText('Use + e - para ajustar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar Brownie do menu do dia' })).not.toBeInTheDocument();
    expect(screen.queryByText('0x')).not.toBeInTheDocument();
  });

  it('allows cancelling the public order while intake is open and shows a cancellation confirmation state', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'public-order-1' });
    window.history.pushState({}, '', '/s/token-1');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.change(await screen.findByPlaceholderText('Digite seu nome'), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Alface do menu do dia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));

    expect(await screen.findByText('Seu pedido foi enviado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(cancelPublicOrderMock).toHaveBeenCalledWith({
        orderId: 'public-order-1',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
      });
    });

    expect(await screen.findByText('Seu pedido foi cancelado')).toBeInTheDocument();
    expect(localStorage.getItem('public-menu-last-order:token-1')).toBeNull();
    expect(window.location.hash).toBe('#/cancelado');
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });

    fireEvent.click(screen.getByRole('button', { name: 'Fazer novo pedido' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ana')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Adicionar Alface do menu do dia' })).toBeInTheDocument();
    });
    expect(window.location.hash).toBe('#/pedido');
  });

  it('persists only the validated public selection after submit', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'public-order-1' });
    submitPublicOrderMock.mockResolvedValue({
      orderId: 'public-order-1',
      customerName: 'Ana',
      lines: [buildOrderLine('1', 'Alface', 'Saladas')],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 0,
        currency: 'BRL',
        paymentStatus: 'not_required',
        provider: null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    });
    localStorage.setItem('public-menu-order-session:token-1', 'public-order-1');
    localStorage.setItem('public-menu-last-order:token-1', JSON.stringify({
      orderId: 'public-order-1',
      customerName: 'Ana',
      lines: [buildOrderLine('1', 'Alface', 'Saladas'), buildOrderLine('999', 'Fantasma', 'Outros')],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 0,
        currency: 'BRL',
        paymentStatus: 'not_required',
        provider: null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    }));
    window.history.pushState({}, '', '/s/token-1');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByDisplayValue('Ana')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));

    expect(await screen.findByText('Seu pedido foi enviado')).toBeInTheDocument();

    expect(JSON.parse(localStorage.getItem('public-menu-last-order:token-1') ?? 'null')).toEqual({
      orderId: 'public-order-1',
      customerName: 'Ana',
      lines: [buildOrderLine('1', 'Alface', 'Saladas')],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 0,
        currency: 'BRL',
        paymentStatus: 'not_required',
        provider: null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    });
  });

  it('rehydrates the previous public order from local storage on revisit', async () => {
    localStorage.setItem('public-menu-order-session:token-1', 'public-order-1');
    localStorage.setItem('public-menu-last-order:token-1', JSON.stringify({
      orderId: 'public-order-1',
      customerName: 'Ana',
      lines: [buildOrderLine('1', 'Alface', 'Saladas')],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 0,
        currency: 'BRL',
        paymentStatus: 'not_required',
        provider: null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    }));
    window.history.pushState({}, '', '/s/token-1');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByDisplayValue('Ana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Alface do menu do dia' })).toBeInTheDocument();
  });

  it('keeps the submitted state after reload when the hash and cached order are present', async () => {
    localStorage.setItem('public-menu-order-session:token-1', 'public-order-1');
    localStorage.setItem('public-menu-last-order:token-1', JSON.stringify({
      orderId: 'public-order-1',
      customerName: 'Ana',
      lines: [buildOrderLine('1', 'Alface', 'Saladas')],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 0,
        currency: 'BRL',
        paymentStatus: 'not_required',
        provider: null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    }));
    localStorage.setItem('public-menu-view:token-1', 'submitted');
    window.history.pushState({}, '', '/s/token-1/#/enviado');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByText('Seu pedido foi enviado')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/enviado');
  });

  it('keeps the submitted confirmation after reload even when intake is closed', async () => {
    localStorage.setItem('public-menu-order-session:token-1', 'public-order-1');
    localStorage.setItem('public-menu-last-order:token-1', JSON.stringify({
      orderId: 'public-order-1',
      customerName: 'Ana',
      lines: [buildOrderLine('1', 'Alface', 'Saladas')],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 0,
        currency: 'BRL',
        paymentStatus: 'not_required',
        provider: null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    }));
    localStorage.setItem('public-menu-view:token-1', 'submitted');
    window.history.pushState({}, '', '/s/token-1/#/enviado');
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: false,
        currentVersionId: 'version-1',
        categories: ['Saladas'],
        items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
        categorySelectionRules: [],
      });
      return vi.fn();
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByText('Seu pedido foi enviado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar pedido' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });

  it('preserves submitted order lines after reload even when the item no longer exists in the current menu', async () => {
    localStorage.setItem('public-menu-order-session:token-1', 'public-order-1');
    localStorage.setItem('public-menu-last-order:token-1', JSON.stringify({
      orderId: 'public-order-1',
      customerName: 'Ana',
      lines: [buildOrderLine('2', 'Prato executivo', 'Pratos')],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 0,
        currency: 'BRL',
        paymentStatus: 'not_required',
        provider: null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    }));
    localStorage.setItem('public-menu-view:token-1', 'submitted');
    window.history.pushState({}, '', '/s/token-1/#/enviado');
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: true,
        currentVersionId: 'version-2',
        categories: ['Bebidas'],
        items: [{ id: '9', nome: 'Água', categoria: 'Bebidas' }],
        categorySelectionRules: [],
      });
      return vi.fn();
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByText('Seu pedido foi enviado')).toBeInTheDocument();
    expect(screen.getByText('Prato executivo')).toBeInTheDocument();
    expect(screen.getByText('1 selecionados')).toBeInTheDocument();
  });

  it('shows the pending paid order summary without a reveal button', async () => {
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: true,
        currentVersionId: 'version-1',
        categories: ['Saladas', 'Carnes', 'Molhos'],
        items: [
          { id: '1', nome: 'Alface', categoria: 'Saladas' },
          { id: '2', nome: 'Frango', categoria: 'Carnes' },
          { id: '3', nome: 'Molho da casa', categoria: 'Molhos' },
        ],
        categorySelectionRules: [],
      });
      return vi.fn();
    });
    localStorage.setItem('public-menu-pending-order:token-1', JSON.stringify({
      customerName: 'Ana',
      selectedItems: [
        { itemId: '3', quantity: 1 },
        { itemId: '1', quantity: 1 },
        { itemId: '2', quantity: 1 },
      ],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 1500,
        currency: 'BRL',
        paymentStatus: 'awaiting_payment',
        provider: 'stripe',
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    }));
    window.history.pushState({}, '', '/s/token-1?draftId=draft-1#/enviado');
    fetchPublicOrderStatusMock.mockResolvedValue({
      draftId: 'draft-1',
      paymentStatus: 'awaiting_payment',
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByText('Aguardando confirmação')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Itens escolhidos')).toBeInTheDocument();
    const groupedCategoryLabels = screen.getAllByText(/^(Carnes|Saladas|Molhos)$/).map(node => node.textContent);
    expect(groupedCategoryLabels.slice(0, 3)).toEqual(['Saladas', 'Carnes', 'Molhos']);
    expect(screen.getByText('Alface')).toBeInTheDocument();
    expect(screen.getByText('Frango')).toBeInTheDocument();
    expect(screen.getByText('Molho da casa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver itens selecionados' })).not.toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('keeps the cancelled state after reload when the hash and customer name are present', async () => {
    localStorage.setItem('public-menu-cancelled-state:token-1', JSON.stringify({ customerName: 'Ana' }));
    localStorage.setItem('public-menu-view:token-1', 'cancelled');
    window.history.pushState({}, '', '/s/token-1/#/cancelado');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByText('Seu pedido foi cancelado')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/cancelado');
  });

  it('keeps the cancelled confirmation after reload even when intake is closed', async () => {
    localStorage.setItem('public-menu-cancelled-state:token-1', JSON.stringify({ customerName: 'Ana' }));
    localStorage.setItem('public-menu-view:token-1', 'cancelled');
    window.history.pushState({}, '', '/s/token-1/#/cancelado');
    subscribePublicMenuMock.mockImplementation((_token: string, onValue: (menu: unknown) => void) => {
      onValue({
        token: 'token-1',
        dateKey: '2026-03-17',
        expiresAt: Date.now() + 60_000,
        acceptingOrders: false,
        currentVersionId: 'version-1',
        categories: ['Saladas'],
        items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
        categorySelectionRules: [],
      });
      return vi.fn();
    });

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByText('Seu pedido foi cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fazer novo pedido' })).not.toBeInTheDocument();
  });

  it('restores the cancelled state using token-scoped data instead of the global customer name', async () => {
    localStorage.setItem('public-menu-customer-name', 'Beatriz');
    localStorage.setItem('public-menu-cancelled-state:token-1', JSON.stringify({ customerName: 'Ana' }));
    localStorage.setItem('public-menu-view:token-1', 'cancelled');
    window.history.pushState({}, '', '/s/token-1/#/cancelado');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByText(/Ana, você ainda pode montar um novo pedido neste cardápio/i)).toBeInTheDocument();
    expect(screen.queryByText(/Beatriz, você ainda pode montar um novo pedido neste cardápio/i)).not.toBeInTheDocument();
  });

  it('falls back to the form when the cancelled hash has no token-scoped cancelled state', async () => {
    localStorage.setItem('public-menu-customer-name', 'Ana');
    localStorage.setItem('public-menu-view:token-1', 'cancelled');
    window.history.pushState({}, '', '/s/token-1/#/cancelado');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByPlaceholderText('Digite seu nome')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe('#/pedido');
    });
  });

  it('preserves query parameters when normalizing the public hash route', async () => {
    window.history.pushState({}, '', '/s/token-1?ref=whatsapp');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByPlaceholderText('Digite seu nome')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toBe('?ref=whatsapp');
      expect(window.location.href).toContain('/s/token-1/?ref=whatsapp#/pedido');
    });
  });

  it('falls back to the form when the submitted hash has no cached order', async () => {
    window.history.pushState({}, '', '/s/token-1/#/enviado');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByPlaceholderText('Digite seu nome')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe('#/pedido');
    });
  });

  it('sanitizes cached public selections that no longer exist in the current menu', async () => {
    localStorage.setItem('public-menu-order-session:token-1', 'public-order-1');
    localStorage.setItem('public-menu-last-order:token-1', JSON.stringify({
      orderId: 'public-order-1',
      customerName: 'Ana',
      lines: [buildOrderLine('1', 'Alface', 'Saladas'), buildOrderLine('999', 'Fantasma', 'Outros')],
      paymentSummary: {
        freeTotalCents: 0,
        paidTotalCents: 0,
        currency: 'BRL',
        paymentStatus: 'not_required',
        provider: null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
      },
    }));
    window.history.pushState({}, '', '/s/token-1');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(await screen.findByDisplayValue('Ana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Alface do menu do dia' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /999/i })).not.toBeInTheDocument();
  });

  it('renders the 404 page for unknown routes', () => {
    window.history.pushState({}, '', '/nao-existe');

    render(
      <ToastProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.getByText('Página não encontrada')).toBeInTheDocument();
  });
});
