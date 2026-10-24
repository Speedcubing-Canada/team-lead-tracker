import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { buildWcaAuthorizeUrl } from "../lib/wca";
import { clearMyCompetitions } from "../lib/myCompetitions";

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

export const OAUTH_STATE_KEY = "wca_oauth_state";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    let recheck = () => {};
    const resolve = async (fbUser: User | null) => {
      window.removeEventListener("online", recheck);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const { claims } = await fbUser.getIdTokenResult();
        if (auth().currentUser !== fbUser) return; // a later sign-in/out won
        const wcaUserId = Number(claims["wcaUserId"]);
        setUser(
          Number.isFinite(wcaUserId)
            ? { wcaUserId, name: String(claims["name"] ?? "Unknown") }
            : null,
        );
      } catch {
        if (auth().currentUser !== fbUser) return;
        // Usually an expired token on venue wifi; the session is intact, so retry once back online.
        setUser(null);
        recheck = () => void resolve(fbUser);
        window.addEventListener("online", recheck, { once: true });
      }
      setLoading(false);
    };
    try {
      unsub = onAuthStateChanged(auth(), resolve);
    } catch {
      // Firebase not configured yet — render as logged out.
      setLoading(false);
    }
    return () => {
      unsub();
      window.removeEventListener("online", recheck);
    };
  }, []);

  const signIn = useCallback(() => {
    const state = crypto.randomUUID();
    sessionStorage.setItem(OAUTH_STATE_KEY, state);
    window.location.href = buildWcaAuthorizeUrl(state);
  }, []);

  const signOut = useCallback(() => {
    // Only once signed out: an interrupted sign-out must not leave a signed-in user with no comps.
    void firebaseSignOut(auth()).then(clearMyCompetitions);
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
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  return !!returned && !!expected && returned === expected;
}
