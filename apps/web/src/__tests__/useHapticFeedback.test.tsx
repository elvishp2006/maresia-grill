import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

const originalUserAgent = navigator.userAgent;
const originalVibrate = navigator.vibrate;

describe('useHapticFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent });
    if (originalVibrate) {
      navigator.vibrate = originalVibrate;
    } else {
      delete (navigator as Navigator & { vibrate?: Navigator['vibrate'] }).vibrate;
    }
    document.querySelectorAll('[id^="haptic-switch-"]').forEach((node) => node.remove());
    document.querySelectorAll('label').forEach((node) => {
      if ((node as HTMLLabelElement).htmlFor.startsWith('haptic-switch-')) node.remove();
    });
  });

  it('uses navigator.vibrate for non-iOS devices', () => {
    const vibrateMock = vi.fn();
    navigator.vibrate = vibrateMock;
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 14)' });

    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.lightTap();
      result.current.mediumTap();
      result.current.heavyTap();
      result.current.doubleTap();
      result.current.success();
      result.current.error();
    });

    expect(vibrateMock).toHaveBeenNthCalledWith(1, 50);
    expect(vibrateMock).toHaveBeenNthCalledWith(2, 100);
    expect(vibrateMock).toHaveBeenNthCalledWith(3, 150);
    expect(vibrateMock).toHaveBeenNthCalledWith(4, [50, 100, 50]);
    expect(vibrateMock).toHaveBeenNthCalledWith(5, [50, 50, 50]);
    expect(vibrateMock).toHaveBeenNthCalledWith(6, [100, 100, 100]);
  });

  it('swallows navigator vibration errors on non-iOS devices', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    navigator.vibrate = vi.fn(() => {
      throw new Error('blocked');
    }) as Navigator['vibrate'];

    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.vibrate(50);
    });

    expect(warnSpy).toHaveBeenCalledWith('Vibration not supported or blocked:', expect.any(Error));
  });

  it('creates and toggles the hidden iOS switch for haptic feedback', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const clickSpy = vi.spyOn(HTMLLabelElement.prototype, 'click');

    const { result, unmount } = renderHook(() => useHapticFeedback());

    const input = document.querySelector('input[switch]') as HTMLInputElement | null;
    const label = document.querySelector(`label[for="${input?.id}"]`) as HTMLLabelElement | null;

    expect(input).not.toBeNull();
    expect(label).not.toBeNull();
    expect(input?.checked).toBe(false);

    act(() => {
      result.current.lightTap();
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(input?.checked).toBe(false);

    unmount();

    expect(document.body.contains(input!)).toBe(false);
    expect(document.body.contains(label!)).toBe(false);
  });

  it('swallows iOS switch errors while trying to click the hidden label', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    vi.spyOn(HTMLLabelElement.prototype, 'click').mockImplementation(() => {
      throw new Error('failed');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.vibrate();
    });

    expect(warnSpy).toHaveBeenCalledWith('iOS haptic feedback failed:', expect.any(Error));
  });
});
