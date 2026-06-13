import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { buildWcaAuthorizeUrl } from "../lib/wca";

export interface AuthUser {
  wcaUserId: number;
  name: string;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** Redirect to WCA to begin the OAuth login. */
  signIn: () => void;
  signOut: () => void;
}

const STATE_KEY = "wca_oauth_state";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(auth(), async (fbUser) => {
        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }
        const { claims } = await fbUser.getIdTokenResult();
        const wcaUserId = Number(claims.wcaUserId);
        setUser(
          Number.isFinite(wcaUserId)
            ? { wcaUserId, name: String(claims.name ?? "Unknown") }
            : null,
        );
        setLoading(false);
      });
    } catch {
      // Firebase not configured yet — render as logged out.
      setLoading(false);
    }
    return () => unsub();
  }, []);

  const signIn = useCallback(() => {
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    window.location.href = buildWcaAuthorizeUrl(state);
  }, []);

  const signOut = useCallback(() => {
    void firebaseSignOut(auth());
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** Validate the OAuth state param echoed back by WCA against what we stored. */
export function consumeOAuthState(returned: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return !!returned && !!expected && returned === expected;
}
