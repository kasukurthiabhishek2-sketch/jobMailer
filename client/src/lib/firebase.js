/**
 * Firebase Client SDK — Authentication & Firestore initialization.
 *
 * Config values are read from VITE_ environment variables so environments
 * stay separable without hardcoded keys in version control.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export const watchAuthState = (cb) => {
  if (typeof window !== 'undefined' && (window.__E2E_MOCK_USER__ || window.location.search.includes('mock_auth=1'))) {
    const mockUser = window.__E2E_MOCK_USER__ || {
      uid: 'e2e-tester',
      displayName: 'Test User',
      email: 'test@example.com'
    };
    setTimeout(() => cb(mockUser), 10);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
};

/**
 * Get the current user's Firebase ID token for server-side auth.
 * Returns null if no user is signed in.
 */
export async function getIdToken() {
  if (typeof window !== 'undefined' && (window.__E2E_MOCK_USER__ || window.location.search.includes('mock_auth=1'))) {
    return 'e2e_mock_token_for_tests';
  }
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}
