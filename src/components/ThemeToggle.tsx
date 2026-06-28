import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme, type Theme } from "../lib/theme";
import { Tooltip } from "./Tooltip";

const OPTIONS: { value: Theme; label: string; Icon: LucideIcon }[] = [
  { value: "system", label: "System theme", Icon: Monitor },
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
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
          <Tooltip key={o.value} label={o.label} side="bottom" longPress={false}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              onClick={() => setTheme(o.value)}
              className={`flex min-h-10 min-w-10 items-center justify-center rounded-md ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <o.Icon size={18} aria-hidden />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
