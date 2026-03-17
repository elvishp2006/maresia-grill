import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdateBanner from '../components/UpdateBanner';

const applyUpdateMock = vi.fn();
const dismissMock = vi.fn();
const lightTapMock = vi.fn();
const successMock = vi.fn();

let currentNeedRefresh = false;

vi.mock('../hooks/useUpdateNotification', () => ({
  useUpdateNotification: vi.fn(() => ({
    needRefresh: currentNeedRefresh,
    applyUpdate: applyUpdateMock,
    dismiss: dismissMock,
  })),
}));

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: vi.fn(() => ({
    lightTap: lightTapMock,
    success: successMock,
  })),
}));

describe('UpdateBanner', () => {
  beforeEach(() => {
    currentNeedRefresh = false;
    applyUpdateMock.mockReset();
    dismissMock.mockReset();
    lightTapMock.mockReset();
    successMock.mockReset();
  });

  it('renders nothing when there is no update state to show', () => {
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the update call to action and applies the new version', () => {
    currentNeedRefresh = true;

    render(<UpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));

    expect(successMock).toHaveBeenCalledTimes(1);
    expect(applyUpdateMock).toHaveBeenCalledTimes(1);
    expect(dismissMock).not.toHaveBeenCalled();
  });

  it('dismisses the banner from the close button when an update is available', () => {
    currentNeedRefresh = true;

    render(<UpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso de atualizacao' }));

    expect(lightTapMock).toHaveBeenCalledTimes(1);
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });
});
