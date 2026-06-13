import { createContext, useContext, type ReactNode } from "react";

export interface AuthUser {
  wcaUserId: number;
  name: string;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Phase 2 provider: no real session yet. Phase 1 replaces the body with the WCA
 * OAuth + Firebase custom-token flow while keeping this same interface, so
 * consumers (e.g. StageView's stage derivation) don't change.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthState = {
    user: null,
    loading: false,
    signIn: () => {},
    signOut: () => {},
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
