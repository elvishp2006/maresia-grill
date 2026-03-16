import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { ModalProvider } from '../contexts/ModalContext';

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
  user: { email: 'chef@maresia.com' },
  loading: false,
  isAuthorized: true,
  authError: null,
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

vi.mock('../hooks/useMenuState', () => ({
  useMenuState: vi.fn(() => ({
    categories: ['Saladas', 'Carnes'],
    complements: [
      { id: '1', nome: 'Alface', categoria: 'Saladas' },
      { id: '2', nome: 'Frango', categoria: 'Carnes' },
    ],
    daySelection: ['1'],
    usageCounts: {},
    sortMode: 'alpha',
    loading: false,
    toggleSortMode: vi.fn(),
    toggleItem,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    renameItem: vi.fn(),
    addCategory: vi.fn(),
    removeCategory: vi.fn(),
    moveCategory: vi.fn(),
  })),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toggleItem.mockReset();
    useAuthSessionMock.mockReturnValue({
      user: { email: 'chef@maresia.com' },
      loading: false,
      isAuthorized: true,
      authError: null,
      signInPending: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    useOnlineStatusMock.mockReturnValue({ isOnline: true });
    vi.stubGlobal('alert', vi.fn());
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it('opens the first visible category by default', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    expect(screen.getByRole('img', { name: 'Logo do Maresia Grill' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Menu do Dia' })).not.toBeInTheDocument();
    expect(screen.getByText(/1 iten selecionado • 16\/03/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colapsar Saladas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir Carnes' })).toBeInTheDocument();
    expect(screen.queryByText('Sugestoes inteligentes')).not.toBeInTheDocument();
  });

  it('allows collapsing the currently open category', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Colapsar Saladas' }));

    expect(screen.getByRole('button', { name: 'Expandir Saladas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir Carnes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Alface do menu do dia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar Frango do menu do dia' })).not.toBeInTheDocument();
  });

  it('opens only the category that was explicitly selected', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Carnes' }));

    expect(screen.getByRole('button', { name: 'Expandir Saladas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colapsar Carnes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Alface do menu do dia' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar Frango do menu do dia' })).toBeInTheDocument();
  });

  it('renders suggestions and selects an item from insights', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Estatisticas' }));
    expect(screen.getByText('Sugestoes inteligentes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
    expect(toggleItem).toHaveBeenCalledWith('2');
  });

  it('hides toolbar and categories in statistics area', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Estatisticas' }));

    expect(screen.queryByPlaceholderText('Buscar item para o menu de hoje')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Colapsar Saladas' })).not.toBeInTheDocument();
    expect(screen.getByText('Leitura do cardapio')).toBeInTheDocument();
  });

  it('shows the offline warning and disables statistics when offline', () => {
    useOnlineStatusMock.mockReturnValue({ isOnline: false });

    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    expect(screen.getByText('Sem internet')).toBeInTheDocument();
    expect(screen.getByText(/Edicao, selecao do menu e estatisticas estao indisponiveis/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estatisticas' })).toBeDisabled();
  });

  it('renders an offline empty state when the statistics view is open and connection drops', () => {
    const { rerender } = render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Estatisticas' }));
    expect(screen.getByText('Sugestoes inteligentes')).toBeInTheDocument();

    useOnlineStatusMock.mockReturnValue({ isOnline: false });

    rerender(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    expect(screen.getByText('Estatisticas indisponiveis')).toBeInTheDocument();
    expect(screen.getByText(/Conecte-se a internet para consultar sugestoes e historico/i)).toBeInTheDocument();
  });

  it('renders the sign-in screen when there is no session', () => {
    useAuthSessionMock.mockReturnValue({
      user: null,
      loading: false,
      isAuthorized: false,
      authError: null,
      signInPending: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    expect(screen.getByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
  });

  it('renders the unauthorized screen for users outside the allowlist', () => {
    useAuthSessionMock.mockReturnValue({
      user: { email: 'outsider@maresia.com' },
      loading: false,
      isAuthorized: false,
      authError: 'Sua conta nao esta autorizada para usar este app.',
      signInPending: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    expect(screen.getByText('Conta sem acesso')).toBeInTheDocument();
    expect(screen.getByText('outsider@maresia.com')).toBeInTheDocument();
    expect(screen.getByText('Sua conta nao esta autorizada para usar este app.')).toBeInTheDocument();
  });
});
