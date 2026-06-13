import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase is initialized lazily from Vite env vars (see .env.example).
 * Kept lazy so the app can render the login screen even before a project is
 * configured, and so tests don't require live credentials.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;

function getApp(): FirebaseApp {
  if (!app) {
    if (!config.projectId) {
      throw new Error(
        "Firebase is not configured. Copy .env.example to .env.local and fill in VITE_FIREBASE_* values.",
      );
    }
    app = initializeApp(config);
  }
  return app;
}

export function auth(): Auth {
  return getAuth(getApp());
}

export function db(): Firestore {
  return getFirestore(getApp());
}
