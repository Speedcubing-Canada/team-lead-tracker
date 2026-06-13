import { useEffect, useState } from "react";
import type { AbsenceCount } from "../lib/absentees";

/** Severity color for a 0..1 rate: green (low) → amber → red (high), via hue. */
function barGradient(rate: number): string {
  const hue = 120 * (1 - Math.min(1, Math.max(0, rate))); // 120=green, 0=red
  return `linear-gradient(90deg, hsl(${hue} 75% 42%), hsl(${hue} 85% 55%))`;
}

/** Round a 0..1 rate to a whole-percent string, e.g. 0.6667 → "67%". */
function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * A lightweight horizontal bar chart built from plain divs (no charting
 * dependency). Each bar is sized by its absence *rate* (count / total) and tinted
 * green→red by severity, so a glance reads "how bad" directly. Bars grow from
 * zero on mount for a polished reveal (skipped under prefers-reduced-motion).
 * Mobile-friendly: labels truncate, the count/total + percentage sit to the right.
 */
export function BarChart({ title, data }: { title: string; data: AbsenceCount[] }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">Nothing to show yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((d, i) => (
            <li key={d.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                  {d.label}
                </span>
                <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {d.count}/{d.total}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {percent(d.rate)}
                  </span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-700/60">
                <div
                  data-testid="bar"
                  className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
                  style={{
                    width: grown ? `${Math.round(d.rate * 100)}%` : "0%",
                    background: barGradient(d.rate),
                    transitionDelay: `${i * 60}ms`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
