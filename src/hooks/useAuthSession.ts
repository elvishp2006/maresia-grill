import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { isAuthorizedEmail } from '../authConfig';
import { auth, googleProvider } from '../firebase';

const getSignInErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String(error.code);
    if (code === 'auth/popup-closed-by-user') return 'Login cancelado.';
    if (code === 'auth/network-request-failed') return 'Nao foi possivel entrar. Verifique sua conexao.';
  }
  return 'Nao foi possivel entrar com Google.';
};

export function useAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signInPending, setSignInPending] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;

      setLoading(true);
      setAuthError(null);

      if (!nextUser) {
        setUser(null);
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setUser(nextUser);
      const canAccess = isAuthorizedEmail(nextUser.email);
      setIsAuthorized(canAccess);
      setAuthError(canAccess ? null : 'Sua conta nao esta autorizada para usar este app.');
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = async () => {
    setSignInPending(true);
    setAuthError(null);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(getSignInErrorMessage(error));
    } finally {
      setSignInPending(false);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return {
    user,
    loading,
    isAuthorized,
    authError,
    signInPending,
    signIn,
    signOut,
  };
}
