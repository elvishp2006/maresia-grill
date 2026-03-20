import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorLock } from '../types';
import { useEditorLock } from '../hooks/useEditorLock';

const acquireEditorLockMock = vi.fn();
const releaseEditorLockMock = vi.fn();
const renewEditorLockMock = vi.fn();
const subscribeEditorLockMock = vi.fn();
const isLockExpiredMock = vi.fn();

vi.mock('../lib/storage', () => ({
  acquireEditorLock: (...args: unknown[]) => acquireEditorLockMock(...args),
  releaseEditorLock: (...args: unknown[]) => releaseEditorLockMock(...args),
  renewEditorLock: (...args: unknown[]) => renewEditorLockMock(...args),
  subscribeEditorLock: (...args: unknown[]) => subscribeEditorLockMock(...args),
  isLockExpired: (...args: unknown[]) => isLockExpiredMock(...args),
}));

const makeLock = (overrides: Partial<EditorLock> = {}): EditorLock => ({
  sessionId: 'session-1',
  userEmail: 'chef@maresia.com',
  deviceLabel: 'Mac',
  status: 'active',
  acquiredAt: 1,
  lastHeartbeatAt: 1,
  expiresAt: Date.now() + 60_000,
  ...overrides,
});

describe('useEditorLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('menu-editor-session-id', 'session-1');
    localStorage.setItem('menu-editor-device-label', 'Mac');

    subscribeEditorLockMock.mockImplementation((onValue: (lock: EditorLock | null) => void) => {
      onValue(null);
      return vi.fn();
    });
    acquireEditorLockMock.mockResolvedValue(makeLock());
    releaseEditorLockMock.mockResolvedValue(undefined);
    renewEditorLockMock.mockResolvedValue(makeLock());
    isLockExpiredMock.mockImplementation((lock: EditorLock | null) => !lock || lock.expiresAt <= Date.now());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('acquires the lock automatically when there is no current owner', async () => {
    renderHook(() => useEditorLock('chef@maresia.com', true));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(acquireEditorLockMock).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userEmail: 'chef@maresia.com',
      deviceLabel: 'Mac',
    });
  });

  it('keeps renewing the heartbeat while the current session owns the lock', async () => {
    subscribeEditorLockMock.mockImplementation((onValue: (lock: EditorLock | null) => void) => {
      onValue(makeLock());
      return vi.fn();
    });

    renderHook(() => useEditorLock('chef@maresia.com', true));

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(renewEditorLockMock).toHaveBeenCalledWith('session-1');
  });

  it('forces takeover when takeControl is called', async () => {
    subscribeEditorLockMock.mockImplementation((onValue: (lock: EditorLock | null) => void) => {
      onValue(makeLock({
        sessionId: 'session-2',
        userEmail: 'other@maresia.com',
        deviceLabel: 'iPhone',
      }));
      return vi.fn();
    });

    const { result } = renderHook(() => useEditorLock('chef@maresia.com', true));

    await act(async () => {
      await result.current.takeControl();
    });

    expect(acquireEditorLockMock).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userEmail: 'chef@maresia.com',
      deviceLabel: 'Mac',
    }, { force: true });
  });

  it('recovers the lock automatically when the same user is marked active on the same device', async () => {
    subscribeEditorLockMock.mockImplementation((onValue: (lock: EditorLock | null) => void) => {
      onValue(makeLock({
        sessionId: 'session-2',
        userEmail: 'chef@maresia.com',
        deviceLabel: 'Mac',
      }));
      return vi.fn();
    });

    renderHook(() => useEditorLock('chef@maresia.com', true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(acquireEditorLockMock).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userEmail: 'chef@maresia.com',
      deviceLabel: 'Mac',
    }, { force: true });
  });

  it('does not auto-acquire when offline or without a user', async () => {
    renderHook(() => useEditorLock('chef@maresia.com', false));
    renderHook(() => useEditorLock(null, true));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(acquireEditorLockMock).not.toHaveBeenCalled();
  });

  it('derives session and device labels when storage is empty', async () => {
    sessionStorage.clear();
    localStorage.clear();
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });

    renderHook(() => useEditorLock('chef@maresia.com', true));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(sessionStorage.getItem('menu-editor-session-id')).toBe('session-4fzzzxjylrx-123456');
    expect(localStorage.getItem('menu-editor-device-label')).toBe('Windows');
    expect(acquireEditorLockMock).toHaveBeenCalledWith({
      sessionId: 'session-4fzzzxjylrx-123456',
      userEmail: 'chef@maresia.com',
      deviceLabel: 'Windows',
    });
  });

  it('surfaces request and takeover errors using admin feedback messages', async () => {
    acquireEditorLockMock.mockRejectedValueOnce(new Error('falha-request')).mockRejectedValueOnce(new Error('falha-takeover'));

    const { result } = renderHook(() => useEditorLock('chef@maresia.com', true));

    await act(async () => {
      expect(await result.current.requestEditAccess()).toBe(false);
    });
    expect(result.current.error).toBe('falha-request');

    await act(async () => {
      expect(await result.current.takeControl()).toBe(false);
    });
    expect(result.current.error).toBe('falha-takeover');
  });

  it('surfaces subscription errors and clears them after a successful request', async () => {
    subscribeEditorLockMock.mockImplementation((_onValue: (lock: EditorLock | null) => void, onError?: (error: Error) => void) => {
      onError?.(new Error('falha-subscribe'));
      return vi.fn();
    });

    const { result } = renderHook(() => useEditorLock('chef@maresia.com', true));

    expect(result.current.error).toBe('falha-subscribe');

    await act(async () => {
      expect(await result.current.requestEditAccess()).toBe(true);
    });

    expect(result.current.error).toBeNull();
  });

  it('clears the owned lock and exposes renew errors when heartbeat fails', async () => {
    subscribeEditorLockMock.mockImplementation((onValue: (lock: EditorLock | null) => void) => {
      onValue(makeLock());
      return vi.fn();
    });
    renewEditorLockMock.mockRejectedValueOnce(new Error('falha-renew'));

    const { result } = renderHook(() => useEditorLock('chef@maresia.com', true));

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe('falha-renew');
    expect(result.current.lock).toBeNull();
  });

  it('clears the owned lock when the heartbeat can no longer renew it', async () => {
    subscribeEditorLockMock.mockImplementation((onValue: (lock: EditorLock | null) => void) => {
      onValue(makeLock());
      return vi.fn();
    });
    renewEditorLockMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useEditorLock('chef@maresia.com', true));

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.lock).toBeNull();
    expect(result.current.canEdit).toBe(false);
  });

  it('releases edit access on beforeunload and ignores release failures', async () => {
    releaseEditorLockMock.mockRejectedValueOnce(new Error('ignored'));

    renderHook(() => useEditorLock('chef@maresia.com', true));

    await act(async () => {
      window.dispatchEvent(new Event('beforeunload'));
      await Promise.resolve();
    });

    expect(releaseEditorLockMock).toHaveBeenCalledWith('session-1');
  });

  it('releases edit access when the hook unmounts', () => {
    const view = renderHook(() => useEditorLock('chef@maresia.com', true));

    view.unmount();

    expect(releaseEditorLockMock).toHaveBeenCalledWith('session-1');
  });
});
