import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../lib/firebase";
import { authWithWca } from "../lib/authApi";
import { consumeOAuthState } from "../auth/AuthContext";

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
        const token = await authWithWca(code, import.meta.env.VITE_WCA_REDIRECT_URI);
        await signInWithCustomToken(auth(), token);
        navigate("/", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed.");
      }
    })();
  }, [params, navigate]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="min-h-12 rounded-xl bg-indigo-600 px-6 font-semibold text-white"
          >
            Back to login
          </button>
        </>
      ) : (
        <p className="text-sm text-slate-500">Signing you in…</p>
      )}
    </div>
  );
}
