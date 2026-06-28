import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../lib/firebase";
import { authWithWca } from "../lib/authApi";
import { storeMyCompetitions } from "../lib/myCompetitions";
import { consumeOAuthState } from "../auth/AuthContext";
import { wcaRedirectUri } from "../lib/wca";

/** Handles the WCA OAuth redirect: validates state, exchanges the code, signs in. */
export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    // The authorization code is single-use; guard against StrictMode double-invoke.
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    const oauthError = params.get("error");
    if (oauthError) {
      setError(`WCA login was cancelled (${oauthError}).`);
      return;
    }
    if (!code) {
      setError("Missing authorization code.");
      return;
    }
    if (!consumeOAuthState(params.get("state"))) {
      setError("Login state mismatch — please try logging in again.");
      return;
    }

    void (async () => {
      try {
        const { token, competitions } = await authWithWca(code, wcaRedirectUri());
        storeMyCompetitions(competitions);
        await signInWithCustomToken(auth(), token);
        navigate("/", { replace: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        setError(msg && msg !== "internal" ? msg : "Login failed. Is the server reachable?");
      }
    })();
  }, [params, navigate]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="min-h-12 rounded-xl bg-indigo-600 px-6 font-semibold text-white"
          >
            Back to login
          </button>
        </>
      ) : (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
        >
          <Loader2 size={18} aria-hidden className="motion-safe:animate-spin" />
          Signing you in…
        </p>
      )}
    </div>
  );
}
