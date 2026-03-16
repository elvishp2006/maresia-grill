import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface BeforeInstallPromptEventMock extends Event {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const IOS_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36';

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
}

function setStandaloneMode(isStandalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation(() => ({
      matches: isStandalone,
      media: '(display-mode: standalone)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    configurable: true,
  });

  Object.defineProperty(window.navigator, 'standalone', {
    value: isStandalone,
    configurable: true,
  });
}

function createBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): BeforeInstallPromptEventMock {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEventMock;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  event.preventDefault = vi.fn();
  return event;
}

describe('usePWAInstall', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setUserAgent(ANDROID_CHROME_UA);
    setStandaloneMode(false);
  });

  it('shows manual installation mode on Safari for iPhone', () => {
    setUserAgent(IOS_SAFARI_UA);

    const { result } = renderHook(() => usePWAInstall());

    expect(result.current.installMode).toBe('ios-manual');
    expect(result.current.canInstall).toBe(true);
  });

  it('does not show installation banner when already running standalone on iPhone', () => {
    setUserAgent(IOS_SAFARI_UA);
    setStandaloneMode(true);

    const { result } = renderHook(() => usePWAInstall());

    expect(result.current.installMode).toBe('none');
    expect(result.current.canInstall).toBe(false);
  });

  it('switches to prompt mode after beforeinstallprompt on supported browsers', () => {
    const { result } = renderHook(() => usePWAInstall());

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });

    expect(result.current.installMode).toBe('prompt');
    expect(result.current.canInstall).toBe(true);
  });

  it('stores the iOS dismiss timestamp separately from the prompt flow', () => {
    setUserAgent(IOS_SAFARI_UA);

    const { result } = renderHook(() => usePWAInstall());

    act(() => {
      result.current.dismiss();
    });

    expect(localStorage.getItem('pwa-ios-install-dismissed')).not.toBeNull();
    expect(localStorage.getItem('pwa-install-dismissed')).toBeNull();
    expect(result.current.installMode).toBe('none');
  });

  it('runs the native install prompt and clears the prompt state afterwards', async () => {
    const event = createBeforeInstallPromptEvent();
    const { result } = renderHook(() => usePWAInstall());

    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.install();
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.installMode).toBe('none');
  });
});
