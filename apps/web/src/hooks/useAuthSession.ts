import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, hasFirebaseConfig } from '../lib/firebase';
import { loadEditorLock } from '../lib/storage';

const getSignInErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String(error.code);
    if (code === 'auth/popup-closed-by-user') return 'Login cancelado.';
    if (code === 'auth/network-request-failed') return 'Nao foi possivel entrar. Verifique sua conexao.';
  }
  return 'Nao foi possivel entrar com Google.';
};

const isPermissionDeniedError = (error: unknown) => (
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && String(error.code) === 'permission-denied'
);

export function useAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signInPending, setSignInPending] = useState(false);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      setLoading(false);
      setAuthError('Configuracao do Firebase ausente.');
      setUser(null);
      return;
    }

    let active = true;
    const authInstance = auth;

    const unsubscribe = onAuthStateChanged(authInstance, async (nextUser) => {
      if (!active) return;
      setLoading(true);
      setAuthError(null);

      if (!nextUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        await loadEditorLock();
        if (!active) return;
        setUser(nextUser);
        setLoading(false);
      } catch (error) {
        if (!active) return;

        if (isPermissionDeniedError(error)) {
          try {
            await firebaseSignOut(authInstance);
          } catch {
            // Ignore sign-out failures during access denial handling.
          }

          if (!active) return;
          setUser(null);
          setAuthError('Este email não tem acesso ao admin.');
          setLoading(false);
          return;
        }

        setUser(nextUser);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = async () => {
    if (!hasFirebaseConfig || !auth || !googleProvider) {
      setAuthError('Configuracao do Firebase ausente.');
      return;
    }

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
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  return {
    user,
    loading,
    authError,
    signInPending,
    signIn,
    signOut,
  };
}
