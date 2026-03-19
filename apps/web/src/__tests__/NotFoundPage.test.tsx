import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NotFoundPage from '../NotFoundPage';

const lightTapMock = vi.fn();

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    lightTap: lightTapMock,
  }),
}));

describe('NotFoundPage', () => {
  beforeEach(() => {
    lightTapMock.mockReset();
  });

  it('triggers haptic feedback when returning to the start page', () => {
    render(<NotFoundPage />);

    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao início' }));

    expect(lightTapMock).toHaveBeenCalledTimes(1);
  });
});
