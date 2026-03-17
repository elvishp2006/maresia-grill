import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { ModalProvider } from '../contexts/ModalContext';
import { ToastProvider } from '../contexts/ToastContext';

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

vi.mock('../components/UpdateBanner', () => ({
  default: () => null,
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
    expect(screen.getByText(/1 • 16\/03/)).toBeInTheDocument();
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

    expect(screen.getByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
  });
});
