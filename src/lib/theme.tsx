import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** "system" follows the device theme; "light"/"dark" are explicit overrides. */
export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "theme";

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** The actual light/dark a given preference resolves to right now. */
function isDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && prefersDark());
}

/**
 * Apply the resolved theme to <html>: the `dark` class drives Tailwind's
 * `dark:` variant, and `color-scheme` keeps native UI (scrollbars, inputs,
 * form controls) in sync. Mirrored by the pre-paint script in index.html.
 */
function applyTheme(theme: Theme): void {
  const dark = isDark(theme);
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
}

function readStored(): Theme {
  const v =
    typeof localStorage !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as Theme | null) : null;
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);

  useEffect(() => {
    applyTheme(theme);
    // While following the system, re-apply when the OS theme flips live.
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function setTheme(t: Theme) {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Ignore storage failures (private mode); the choice still applies this session.
    }
    setThemeState(t);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
