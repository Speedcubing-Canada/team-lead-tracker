import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";

/**
 * Firebase is initialized lazily from Vite env vars (see .env.example).
 * Kept lazy so the app can render the login screen even before a project is
 * configured, and so tests don't require live credentials.
 *
 * Set VITE_USE_EMULATORS=true to point Auth/Firestore/Functions at the local
 * Firebase emulator suite.
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
    if (import.meta.env.VITE_USE_EMULATORS === "true") {
      connectAuthEmulator(getAuth(app), "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), "127.0.0.1", 8080);
      connectFunctionsEmulator(getFunctions(app), "127.0.0.1", 5001);
    }
  }
  return app;
}

export function auth(): Auth {
  return getAuth(getApp());
}

export function db(): Firestore {
  return getFirestore(getApp());
}

export function functions(): Functions {
  return getFunctions(getApp());
}
