import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { ToastProvider } from '../contexts/ToastContext';
import { useUpdateNotification } from '../hooks/useUpdateNotification';

const updateServiceWorkerMock = vi.fn().mockResolvedValue(undefined);
const setNeedRefreshMock = vi.fn();
const setOfflineReadyMock = vi.fn();
const registrationUpdateMock = vi.fn().mockResolvedValue(undefined);

let currentNeedRefresh = false;
let currentOfflineReady = false;
let registerOptions: {
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
} = {};

vi.mock('../pwa', () => ({
  useRegisterSW: vi.fn((options) => {
    registerOptions = options;
    return {
      needRefresh: [currentNeedRefresh, setNeedRefreshMock],
      offlineReady: [currentOfflineReady, setOfflineReadyMock],
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
    currentOfflineReady = false;
    registerOptions = {};
    updateServiceWorkerMock.mockClear();
    setNeedRefreshMock.mockClear();
    setOfflineReadyMock.mockClear();
    registrationUpdateMock.mockClear();
  });

  it('applies the pending update through the service worker helper', async () => {
    const { result } = renderHook(() => useUpdateNotification(), { wrapper });

    await act(async () => {
      await result.current.applyUpdate();
    });

    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
  });

  it('dismisses both refresh and offline states', () => {
    const { result } = renderHook(() => useUpdateNotification(), { wrapper });

    act(() => {
      result.current.dismiss();
    });

    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
    expect(setOfflineReadyMock).toHaveBeenCalledWith(false);
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
  });

  it('exposes the plugin state for refresh prompts', () => {
    currentNeedRefresh = true;

    const { result } = renderHook(() => useUpdateNotification(), { wrapper });

    expect(result.current.needRefresh).toBe(true);
    expect(result.current.offlineReady).toBe(false);
  });
});
