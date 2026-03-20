import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const onAuthStateChangedMock = vi.fn();
const signInWithPopupMock = vi.fn();
const signOutMock = vi.fn();
const loadEditorLockMock = vi.fn();

interface FirebaseModuleMock {
  auth: object | null;
  googleProvider: object | null;
  hasFirebaseConfig: boolean;
}

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

const importUseAuthSession = async (firebaseMock: FirebaseModuleMock = {
  auth: {},
  googleProvider: {},
  hasFirebaseConfig: true,
}) => {
  vi.resetModules();
  vi.doMock('../lib/firebase', () => firebaseMock);
  vi.doMock('../lib/storage', () => ({
    loadEditorLock: (...args: unknown[]) => loadEditorLockMock(...args),
  }));
  return import('../hooks/useAuthSession');
};

describe('useAuthSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadEditorLockMock.mockResolvedValue(null);
  });

  it('sets user when onAuthStateChanged fires with an authenticated user', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback({ uid: 'user-1', email: 'elvishp2006@gmail.com' });
      return vi.fn();
    });

    const { useAuthSession } = await importUseAuthSession();
    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.email).toBe('elvishp2006@gmail.com');
    expect(result.current.authError).toBeNull();
  });

  it('clears user when onAuthStateChanged fires with null', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback(null);
      return vi.fn();
    });

    const { useAuthSession } = await importUseAuthSession();
    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.authError).toBeNull();
  });

  it('runs Google sign-in through Firebase Auth', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback(null);
      return vi.fn();
    });
    signInWithPopupMock.mockResolvedValue(undefined);

    const { useAuthSession } = await importUseAuthSession();
    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn();
    });

    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a friendly message when popup login is canceled', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback(null);
      return vi.fn();
    });
    signInWithPopupMock.mockRejectedValue({ code: 'auth/popup-closed-by-user' });

    const { useAuthSession } = await importUseAuthSession();
    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.authError).toBe('Login cancelado.');
    expect(result.current.signInPending).toBe(false);
  });

  it('surfaces a network error when popup login fails due to connectivity', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback(null);
      return vi.fn();
    });
    signInWithPopupMock.mockRejectedValue({ code: 'auth/network-request-failed' });

    const { useAuthSession } = await importUseAuthSession();
    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.authError).toBe('Nao foi possivel entrar. Verifique sua conexao.');
    expect(result.current.signInPending).toBe(false);
  });

  it('signs out through Firebase Auth when a session exists', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback({ uid: 'user-1', email: 'elvishp2006@gmail.com' });
      return vi.fn();
    });
    signOutMock.mockResolvedValue(undefined);

    const { useAuthSession } = await importUseAuthSession();
    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('exposes a controlled auth error when Firebase config is missing', async () => {
    const { useAuthSession } = await importUseAuthSession({
      auth: null,
      googleProvider: null,
      hasFirebaseConfig: false,
    });
    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.authError).toBe('Configuracao do Firebase ausente.');
    expect(onAuthStateChangedMock).not.toHaveBeenCalled();
  });

  it('blocks unauthorized users based on the Firestore admin gate', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback({ uid: 'user-2', email: 'intruso@example.com' });
      return vi.fn();
    });
    loadEditorLockMock.mockRejectedValue({ code: 'permission-denied' });
    signOutMock.mockResolvedValue(undefined);

    const { useAuthSession } = await importUseAuthSession();
    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadEditorLockMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeNull();
    expect(result.current.authError).toBe('Este email não tem acesso ao admin.');
  });

  it('keeps the user signed in when the admin gate probe fails for a non-permission reason', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback({ uid: 'user-1', email: 'elvishp2006@gmail.com' });
      return vi.fn();
    });
    loadEditorLockMock.mockRejectedValue(new Error('transient'));

    const { useAuthSession } = await importUseAuthSession();
    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.email).toBe('elvishp2006@gmail.com');
    expect(result.current.authError).toBeNull();
  });
});
