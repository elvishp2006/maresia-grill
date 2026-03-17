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
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });

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

  it('acquires the lock automatically when active and unlocked', async () => {
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

  it('releases the lock when the app goes to background', async () => {
    subscribeEditorLockMock.mockImplementation((onValue: (lock: EditorLock | null) => void) => {
      onValue(makeLock());
      return vi.fn();
    });

    renderHook(() => useEditorLock('chef@maresia.com', true));

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(releaseEditorLockMock).toHaveBeenCalledWith('session-1');
  });

  it('releases the lock after 30 seconds without interaction while visible', async () => {
    subscribeEditorLockMock.mockImplementation((onValue: (lock: EditorLock | null) => void) => {
      onValue(makeLock());
      return vi.fn();
    });

    renderHook(() => useEditorLock('chef@maresia.com', true));

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(releaseEditorLockMock).toHaveBeenCalledWith('session-1');
  });

  it('tries to reacquire when the user interacts again after inactivity', async () => {
    let onValueRef: ((lock: EditorLock | null) => void) | null = null;
    subscribeEditorLockMock.mockImplementation((onValue: (lock: EditorLock | null) => void) => {
      onValueRef = onValue;
      onValue(makeLock());
      return vi.fn();
    });

    renderHook(() => useEditorLock('chef@maresia.com', true));

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(releaseEditorLockMock).toHaveBeenCalledWith('session-1');

    act(() => {
      onValueRef?.(null);
    });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(acquireEditorLockMock).toHaveBeenCalled();
  });
});
