import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const initializeAppMock = vi.fn();
const getAuthMock = vi.fn();
const getFirestoreMock = vi.fn();
const setPersistenceMock = vi.fn().mockResolvedValue(undefined);
const setCustomParametersMock = vi.fn();
const connectAuthEmulatorMock = vi.fn();
const connectFirestoreEmulatorMock = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp: (...args: unknown[]) => initializeAppMock(...args),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    setCustomParameters = setCustomParametersMock;
  },
  browserLocalPersistence: { type: 'local' },
  connectAuthEmulator: (...args: unknown[]) => connectAuthEmulatorMock(...args),
  getAuth: (...args: unknown[]) => getAuthMock(...args),
  setPersistence: (...args: unknown[]) => setPersistenceMock(...args),
}));

vi.mock('firebase/firestore', () => ({
  connectFirestoreEmulator: (...args: unknown[]) => connectFirestoreEmulatorMock(...args),
  getFirestore: (...args: unknown[]) => getFirestoreMock(...args),
}));

const importFirebaseModule = async () => {
  vi.resetModules();
  return import('../lib/firebase');
};

beforeEach(() => {
  vi.clearAllMocks();
  initializeAppMock.mockReturnValue({ name: 'app' });
  getAuthMock.mockReturnValue({ name: 'auth' });
  getFirestoreMock.mockReturnValue({ name: 'db' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('firebase bootstrap', () => {
  it('skips Firebase initialization when config is missing', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', '');
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '');
    vi.stubEnv('VITE_FIREBASE_APP_ID', '');

    const firebase = await importFirebaseModule();

    expect(firebase.hasFirebaseConfig).toBe(false);
    expect(firebase.app).toBeNull();
    expect(firebase.auth).toBeNull();
    expect(firebase.db).toBeNull();
    expect(firebase.googleProvider).toBeNull();
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(getAuthMock).not.toHaveBeenCalled();
  });

  it('initializes Firebase services when config is present', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test.appspot.com');
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456');
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'app-123');

    const firebase = await importFirebaseModule();

    expect(firebase.hasFirebaseConfig).toBe(true);
    expect(initializeAppMock).toHaveBeenCalledWith({
      apiKey: 'test-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test.appspot.com',
      messagingSenderId: '123456',
      appId: 'app-123',
    });
    expect(getAuthMock).toHaveBeenCalled();
    expect(getFirestoreMock).toHaveBeenCalled();
    expect(setPersistenceMock).toHaveBeenCalled();
    expect(setCustomParametersMock).toHaveBeenCalledWith({ prompt: 'select_account' });
  });
});
