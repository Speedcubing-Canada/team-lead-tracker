import { useTheme, type Theme } from "../lib/theme";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "system", label: "System theme", icon: "🖥️" },
  { value: "light", label: "Light theme", icon: "☀️" },
  { value: "dark", label: "Dark theme", icon: "🌙" },
];

/** Compact segmented control for choosing System / Light / Dark. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800"
    >
      {OPTIONS.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => setTheme(o.value)}
            className={`flex min-h-10 min-w-10 items-center justify-center rounded-md text-base ${
              active
                ? "bg-indigo-600 text-white"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <span aria-hidden="true">{o.icon}</span>
          </button>
        );
      })}
    </div>
  );
}
