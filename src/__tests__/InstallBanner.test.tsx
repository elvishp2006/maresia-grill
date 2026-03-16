import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InstallBanner from '../components/InstallBanner';

const installMock = vi.fn().mockResolvedValue(undefined);
const dismissMock = vi.fn();
const lightTapMock = vi.fn();
const successMock = vi.fn();

let installMode: 'none' | 'prompt' | 'ios-manual' = 'none';

vi.mock('../hooks/usePWAInstall', () => ({
  usePWAInstall: vi.fn(() => ({
    installMode,
    canInstall: installMode !== 'none',
    install: installMock,
    dismiss: dismissMock,
  })),
}));

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: vi.fn(() => ({
    lightTap: lightTapMock,
    success: successMock,
  })),
}));

describe('InstallBanner', () => {
  beforeEach(() => {
    installMode = 'none';
    installMock.mockClear();
    dismissMock.mockClear();
    lightTapMock.mockClear();
    successMock.mockClear();
  });

  it('renders nothing when installation is not available', () => {
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the native install CTA for prompt-capable browsers', () => {
    installMode = 'prompt';

    render(<InstallBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));

    expect(screen.getByText('Instalar o app')).toBeInTheDocument();
    expect(successMock).toHaveBeenCalledTimes(1);
    expect(installMock).toHaveBeenCalledTimes(1);
    expect(dismissMock).not.toHaveBeenCalled();
  });

  it('renders manual iPhone instructions and dismisses on confirmation', () => {
    installMode = 'ios-manual';

    render(<InstallBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));

    expect(screen.getByText('Instalar no iPhone')).toBeInTheDocument();
    expect(screen.getByText('Toque em Compartilhar no Safari e depois em Adicionar a Tela de Inicio.')).toBeInTheDocument();
    expect(lightTapMock).toHaveBeenCalledTimes(1);
    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(installMock).not.toHaveBeenCalled();
  });
});
