import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuthSession } from '../hooks/useAuthSession';

const onAuthStateChangedMock = vi.fn();
const signInWithPopupMock = vi.fn();
const signOutMock = vi.fn();

vi.mock('../lib/firebase', () => ({
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

  it('sets user when onAuthStateChanged fires with an authenticated user', async () => {
    onAuthStateChangedMock.mockImplementation((_auth, callback) => {
      void callback({ uid: 'user-1', email: 'elvishp2006@gmail.com' });
      return vi.fn();
    });

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

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn();
    });

    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
  });
});
