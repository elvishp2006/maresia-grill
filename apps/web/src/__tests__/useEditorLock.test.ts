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
});
