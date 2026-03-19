import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { ToastProvider } from '../contexts/ToastContext';
import { useUpdateNotification } from '../hooks/useUpdateNotification';

const updateServiceWorkerMock = vi.fn().mockResolvedValue(undefined);
const setNeedRefreshMock = vi.fn();
const registrationUpdateMock = vi.fn().mockResolvedValue(undefined);

let currentNeedRefresh = false;
let registerOptions: {
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
} = {};

vi.mock('../pwa', () => ({
  useRegisterSW: vi.fn((options) => {
    registerOptions = options;
    return {
      needRefresh: [currentNeedRefresh, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateServiceWorkerMock,
    };
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('useUpdateNotification', () => {
  beforeEach(() => {
    currentNeedRefresh = false;
    registerOptions = {};
    updateServiceWorkerMock.mockClear();
    setNeedRefreshMock.mockClear();
    registrationUpdateMock.mockClear();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it('applies the pending update through the service worker helper', async () => {
    const { result } = renderHook(() => useUpdateNotification(), { wrapper });

    await act(async () => {
      await result.current.applyUpdate();
    });

    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
  });

  it('dismisses the refresh state', () => {
    const { result } = renderHook(() => useUpdateNotification(), { wrapper });

    act(() => {
      result.current.dismiss();
    });

    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
  });

  it('checks for updates when the registration is available and the window regains focus', () => {
    renderHook(() => useUpdateNotification(), { wrapper });

    act(() => {
      registerOptions.onRegisteredSW?.('/sw.js', {
        update: registrationUpdateMock,
      } as unknown as ServiceWorkerRegistration);
    });

    expect(registrationUpdateMock).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(registrationUpdateMock).toHaveBeenCalledTimes(2);
    expect(updateServiceWorkerMock).not.toHaveBeenCalled();
  });

  it('checks for updates again when the document becomes visible', () => {
    renderHook(() => useUpdateNotification(), { wrapper });

    act(() => {
      registerOptions.onRegisteredSW?.('/sw.js', {
        update: registrationUpdateMock,
      } as unknown as ServiceWorkerRegistration);
    });

    expect(registrationUpdateMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(registrationUpdateMock).toHaveBeenCalledTimes(2);
  });

  it('exposes the plugin state for refresh prompts', () => {
    currentNeedRefresh = true;

    const { result } = renderHook(() => useUpdateNotification(), { wrapper });

    expect(result.current.needRefresh).toBe(true);
  });

  it('applies updates automatically when configured for auto-apply', async () => {
    currentNeedRefresh = true;

    renderHook(() => useUpdateNotification({ autoApply: true }), { wrapper });

    await waitFor(() => {
      expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
      expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
    });
  });

  it('shows an updated toast on controller change when auto reload is disabled', () => {
    const addEventListenerSpy = vi.spyOn(navigator.serviceWorker, 'addEventListener');
    let handler: EventListener | null = null;
    addEventListenerSpy.mockImplementation((event, listener) => {
      if (event === 'controllerchange') handler = listener as EventListener;
    });

    renderHook(() => useUpdateNotification(), { wrapper });

    act(() => {
      handler?.(new Event('controllerchange'));
    });

    expect(screen.getByText('✓ App atualizado')).toBeInTheDocument();
  });
});
