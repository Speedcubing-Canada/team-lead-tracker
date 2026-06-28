import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useWcif } from "../lib/useWcif";
import { useChecks } from "../lib/useChecks";
import { listDays } from "../lib/wcif";
import {
  DEFAULT_TIERS,
  reimbursementByPerson,
  tierFor,
  tierTally,
  toneFor,
  type Tier,
} from "../lib/reimbursement";
import { toCsv, toHtml, toMarkdown, triggerDownload, type ReportMeta } from "../lib/exportReport";
import { ReimbursementSkeleton } from "../components/Skeleton";

type Tone = "good" | "warn" | "bad";

const pct = (n: number): number => Math.round(n * 100);

/** Tailwind classes for a tone, used by the tally chips and the tier badges. */
const TONE_BADGE: Record<Tone, string> = {
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

/** Format the comp's first–last scheduled day, e.g. "Jul 1 – Jul 2, 2026". */
function formatDateRange(days: string[]): string {
  if (days.length === 0) return "";
  const fmt = (d: string, withYear = false) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: withYear ? "numeric" : undefined,
      timeZone: "UTC",
    });
  const first = days[0];
  const last = days[days.length - 1];
  return first === last ? fmt(first, true) : `${fmt(first)} – ${fmt(last, true)}`;
}

/** A short, human cap for a tier band, e.g. "≤5%" or "rest". */
const tierCap = (t: Tier): string => (Number.isFinite(t.maxAbsentPct) ? `≤${t.maxAbsentPct}%` : "rest");

/**
 * Post-comp reimbursement export. Leads with the export action and a tier-outcome
 * summary so nothing important is buried under the roster; the per-person
 * breakdown follows as scannable cards. Confirmed-absent % drives each person's
 * tier; unrecorded (unknown) duties are shown but never counted as missed.
 */
export default function ReimbursementExport() {
  const { competitionId } = useParams();
  const { data: wcif, isLoading } = useWcif(competitionId);
  const checks = useChecks(competitionId);
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS);
  const [editingTiers, setEditingTiers] = useState(false);

  const rows = useMemo(() => (wcif ? reimbursementByPerson(wcif, checks) : []), [wcif, checks]);
  const tally = useMemo(() => tierTally(rows, tiers), [rows, tiers]);
  const meta: ReportMeta | null = useMemo(() => {
    if (!wcif) return null;
    return {
      competitionName: wcif.name,
      dateRange: formatDateRange(listDays(wcif)),
      generatedAt: new Date(),
      tiers,
    };
  }, [wcif, tiers]);

  if (isLoading) {
    return <ReimbursementSkeleton />;
  }
  if (!wcif || !meta) {
    return (
      <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Could not load this competition.
      </p>
    );
  }

  const setTierCap = (i: number, value: number) =>
    setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, maxAbsentPct: value } : t)));
  const setTierLabel = (i: number, value: string) =>
    setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, label: value } : t)));

  const download = (kind: "md" | "html" | "csv") => {
    const base = `${competitionId}-reimbursement`;
    if (kind === "md") triggerDownload(`${base}.md`, "text/markdown", toMarkdown(rows, meta));
    else if (kind === "html") triggerDownload(`${base}.html`, "text/html", toHtml(rows, meta));
    else triggerDownload(`${base}.csv`, "text/csv", toCsv(rows, meta));
  };

  const downloadBtn = (kind: "md" | "html" | "csv", label: string) => (
    <button
      type="button"
      onClick={() => download(kind)}
      disabled={rows.length === 0}
      className="min-h-11 flex-1 rounded-lg bg-indigo-600 px-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Reimbursement export
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {wcif.name} · {meta.dateRange}
        </p>
      </header>

      {/* Hero: outcome at a glance + export, both reachable without scrolling. */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{rows.length}</span>{" "}
          {rows.length === 1 ? "person" : "people"} tracked
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tally.map((t, i) => {
            // Chips follow tier order, so tone tracks position: first good, last bad.
            const tone: Tone = i === 0 ? "good" : i === tally.length - 1 ? "bad" : "warn";
            return (
              <span
                key={t.label}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_BADGE[tone]}`}
              >
                {t.count} {t.label}
              </span>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          {downloadBtn("md", "Markdown")}
          {downloadBtn("html", "HTML")}
          {downloadBtn("csv", "CSV")}
        </div>
      </section>

      {/* Tiers: collapsed to a one-liner by default; expand to tune the bands. */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setEditingTiers((v) => !v)}
          aria-expanded={editingTiers}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left"
        >
          <span className="min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Tiers</span>
            {" · "}
            {tiers.map((t) => `${t.label} ${tierCap(t)}`).join(" · ")}
          </span>
          <span className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {editingTiers ? "Done" : "Edit"}
          </span>
        </button>
        {editingTiers && (
          <div className="border-t border-slate-100 p-3 dark:border-slate-700/60">
            <ul className="flex flex-col gap-2">
              {tiers.map((t, i) => {
                const last = i === tiers.length - 1;
                return (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      aria-label={`Tier ${i + 1} label`}
                      value={t.label}
                      onChange={(e) => setTierLabel(i, e.target.value)}
                      className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                    {last ? (
                      <span className="w-20 shrink-0 text-center text-xs text-slate-400 dark:text-slate-500">
                        rest
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs text-slate-400 dark:text-slate-500">≤</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`Tier ${i + 1} max absent percent`}
                          value={t.maxAbsentPct}
                          onChange={(e) => setTierCap(i, Number(e.target.value))}
                          className="min-h-11 w-16 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <span className="text-xs text-slate-400 dark:text-slate-500">%</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Bands use the confirmed-absent %. Unrecorded duties don't count as missed.
            </p>
          </div>
        )}
      </section>

      {/* Roster: one card per person — fits a phone, no horizontal scroll. */}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          No staff assignments have started yet — nothing to report.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const absentPct = pct(r.absentRate);
            return (
              <li
                key={r.person.registrantId}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100">
                    {r.person.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      TONE_BADGE[toneFor(absentPct, tiers)]
                    }`}
                  >
                    {tierFor(absentPct, tiers)}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{r.present} present</span>
                  <span aria-hidden>·</span>
                  <span>{r.absent} absent</span>
                  <span aria-hidden>·</span>
                  <span>{r.unknown} unknown</span>
                  <span aria-hidden>·</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {absentPct}% absent
                  </span>
                  <span aria-hidden>·</span>
                  <span>{pct(r.coverage)}% recorded</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
