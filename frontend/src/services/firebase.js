import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let auth = null;
let isMock = false;

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('YOUR_FIREBASE')) {
  isMock = true;
  console.warn('Firebase web client configuration missing. Running in local MOCK AUTH MODE.');
} else {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (err) {
    isMock = true;
    console.error('Failed to initialize Firebase app. Falling back to MOCK AUTH:', err.message);
  }
}

const provider = new GoogleAuthProvider();

export {
  auth,
  provider,
  signInWithPopup,
  isMock
};
