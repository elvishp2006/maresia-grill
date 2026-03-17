import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Header from '../components/Header';

const lightTapMock = vi.fn();

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    lightTap: lightTapMock,
  }),
}));

const defaultProps = {
  activeCount: 1,
  dateShort: '17/03',
  isOnline: true,
  onSignOut: vi.fn(),
  showUpdateIndicator: false,
  onApplyUpdate: vi.fn(),
  userEmail: 'chef@maresia.com',
  viewMode: 'menu' as const,
  onViewModeChange: vi.fn(),
  onHeightChange: vi.fn(),
};

describe('Header', () => {
  beforeEach(() => {
    lightTapMock.mockReset();
  });

  it('does not render the update button when no update is available', () => {
    render(<Header {...defaultProps} />);

    expect(screen.queryByRole('button', { name: 'Aplicar atualização do app' })).not.toBeInTheDocument();
  });

  it('applies the strong neon treatment to the header logo', () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByRole('img', { name: 'Logo do Maresia Grill' })).toHaveClass('neon-gold-mark-strong');
  });

  it('renders the update button when an update is available', () => {
    render(<Header {...defaultProps} showUpdateIndicator />);

    expect(screen.getByRole('button', { name: 'Aplicar atualização do app' })).toBeInTheDocument();
  });

  it('applies the update when the update button is clicked', () => {
    const onApplyUpdate = vi.fn();
    render(<Header {...defaultProps} showUpdateIndicator onApplyUpdate={onApplyUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar atualização do app' }));

    expect(lightTapMock).toHaveBeenCalledTimes(1);
    expect(onApplyUpdate).toHaveBeenCalledTimes(1);
  });
});
