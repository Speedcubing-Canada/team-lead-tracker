import type { AbsenceCount } from "../lib/absentees";

/**
 * A lightweight horizontal bar chart built from plain divs (no charting
 * dependency). Bars are sized relative to the largest value. Mobile-friendly:
 * labels wrap above their bars so long names don't get clipped on a phone.
 */
export function BarChart({ title, data }: { title: string; data: AbsenceCount[] }) {
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">Nothing to show yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((d) => (
            <li key={d.label}>
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs text-slate-700 dark:text-slate-300">{d.label}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {d.count}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  data-testid="bar"
                  className="h-full rounded-full bg-red-500"
                  style={{ width: `${max > 0 ? (d.count / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
