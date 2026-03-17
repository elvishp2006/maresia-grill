import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { ModalProvider } from '../contexts/ModalContext';
import { ToastProvider } from '../contexts/ToastContext';
import type { EditorLock } from '../types';

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
const useUpdateNotificationMock = vi.fn(() => ({
  needRefresh: false,
  applyUpdate: applyUpdateMock,
  dismiss: vi.fn(),
}));

vi.mock('../hooks/useUpdateNotification', () => ({
  useUpdateNotification: () => useUpdateNotificationMock(),
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

const defaultMenuState = {
  categories: ['Saladas', 'Carnes'] as string[],
  complements: [
    { id: '1', nome: 'Alface', categoria: 'Saladas' },
    { id: '2', nome: 'Frango', categoria: 'Carnes' },
  ],
  daySelection: ['1'] as string[],
  usageCounts: {} as Record<string, number>,
  sortMode: 'alpha' as const,
  loading: false,
  toggleSortMode: vi.fn(),
  toggleItem,
  addItem: vi.fn(),
  removeItem: vi.fn(),
  renameItem: vi.fn(),
  addCategory: vi.fn(),
  removeCategory: vi.fn(),
  moveCategory: vi.fn(),
};

const useMenuStateMock = vi.fn(() => defaultMenuState);

vi.mock('../hooks/useMenuState', () => ({
  useMenuState: () => useMenuStateMock(),
}));

describe('App', () => {
  const todayShort = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  beforeEach(() => {
    vi.clearAllMocks();
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
    useMenuStateMock.mockReturnValueOnce({ ...defaultMenuState, daySelection: [] });

    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    expect(screen.queryByRole('button', { name: 'Compartilhar menu' })).not.toBeInTheDocument();
  });

  it('copies menu to clipboard when share button is clicked and navigator.share is unavailable', async () => {
    render(
      <ToastProvider>
        <ModalProvider>
        <App />
        </ModalProvider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar menu' }));

    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
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

    await vi.waitFor(() => {
      expect(applyUpdateMock).toHaveBeenCalledTimes(1);
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
});
