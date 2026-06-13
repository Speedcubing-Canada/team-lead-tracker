/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_WCA_ORIGIN: string;
  readonly VITE_WCA_CLIENT_ID: string;
  readonly VITE_WCA_REDIRECT_URI: string;
  readonly VITE_USE_EMULATORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
