import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuthSession } from '../hooks/useAuthSession';

const onAuthStateChangedMock = vi.fn();
const signInWithPopupMock = vi.fn();
const signOutMock = vi.fn();

vi.mock('../firebase', () => ({
  auth: {},
  googleProvider: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

describe('useAuthSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks a user as authorized when the email is in the allowlist', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback({ uid: 'user-1', email: 'elvishp2006@gmail.com' });
      return vi.fn();
    });

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.email).toBe('elvishp2006@gmail.com');
    expect(result.current.isAuthorized).toBe(true);
    expect(result.current.authError).toBeNull();
  });

  it('exposes an authorization error when the email is outside the allowlist', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback({ uid: 'user-2', email: 'outsider@maresia.com' });
      return vi.fn();
    });

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthorized).toBe(false);
    expect(result.current.authError).toBe('Sua conta nao esta autorizada para usar este app.');
  });

  it('runs Google sign-in through Firebase Auth', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback(null);
      return vi.fn();
    });
    signInWithPopupMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn();
    });

    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
  });
});
