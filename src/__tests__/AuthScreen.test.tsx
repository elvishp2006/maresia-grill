import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AuthScreen from '../components/AuthScreen';

describe('AuthScreen', () => {
  it('renders the login logo without neon glow classes', () => {
    render(
      <AuthScreen
        onPrimaryAction={vi.fn()}
        primaryActionLabel="Entrar com Google"
      />
    );

    expect(screen.getByRole('img', { name: 'Logo do Marésia Grill' })).toHaveClass('auth-screen__mark');
    expect(screen.getByRole('img', { name: 'Logo do Marésia Grill' })).not.toHaveClass(
      'neon-gold-mark-strong',
      'auth-screen__mark--hero'
    );
  });

  it('calls the primary action when the button is clicked', () => {
    const onPrimaryAction = vi.fn();

    render(
      <AuthScreen
        onPrimaryAction={onPrimaryAction}
        primaryActionLabel="Entrar com Google"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });
});
