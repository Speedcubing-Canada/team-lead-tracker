import { tierFor, type StaffTotals, type Tier } from "./reimbursement";

/** Header/footer context for a reimbursement report. */
export interface ReportMeta {
  competitionName: string;
  dateRange: string;
  generatedAt: Date;
  tiers: Tier[];
}

const COLUMNS = [
  "Name",
  "WCA ID",
  "Total",
  "Present",
  "Absent",
  "Unknown",
  "Absent %",
  "Coverage %",
  "Reimbursement",
] as const;

const pct = (n: number): number => Math.round(n * 100);

/** A human-readable cap for a tier, e.g. "≤5%" or "any". */
function tierCap(t: Tier): string {
  return Number.isFinite(t.maxAbsentPct) ? `≤${t.maxAbsentPct}%` : "any";
}

const UNKNOWN_NOTE =
  "Unknown = a duty no delegate recorded; shown for completeness but not counted as missed. " +
  "Reimbursement is based on the confirmed-absent percentage only.";

/** The cells of one person's row, in COLUMNS order, as plain strings. */
function cells(r: StaffTotals, tiers: Tier[]): string[] {
  return [
    r.person.name,
    r.person.wcaId ?? "—",
    String(r.total),
    String(r.present),
    String(r.absent),
    String(r.unknown),
    `${pct(r.absentRate)}%`,
    `${pct(r.coverage)}%`,
    tierFor(pct(r.absentRate), tiers),
  ];
}

/** Markdown report: heading, tier legend, then a table of everyone. */
export function toMarkdown(rows: StaffTotals[], meta: ReportMeta): string {
  const tierLegend = meta.tiers
    .map((t) => `- **${t.label}** — ${tierCap(t)} absent`)
    .join("\n");
  const header = `| ${COLUMNS.join(" | ")} |`;
  const divider = `| ${COLUMNS.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((r) => `| ${cells(r, meta.tiers).join(" | ")} |`)
    .join("\n");

  return [
    `# Reimbursement — ${meta.competitionName}`,
    "",
    `${meta.dateRange} · generated ${meta.generatedAt.toLocaleDateString()}`,
    "",
    "## Tiers",
    tierLegend,
    "",
    "## Staff",
    header,
    divider,
    body,
    "",
    `_${UNKNOWN_NOTE}_`,
    "",
  ].join("\n");
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

/** Standalone, print-friendly HTML report. */
export function toHtml(rows: StaffTotals[], meta: ReportMeta): string {
  const head = COLUMNS.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${cells(r, meta.tiers)
          .map((c) => `<td>${escapeHtml(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("\n");
  const legend = meta.tiers
    .map((t) => `<li><strong>${escapeHtml(t.label)}</strong> — ${tierCap(t)} absent</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Reimbursement — ${escapeHtml(meta.competitionName)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; color: #0f172a; }
  h1 { margin-bottom: 0.25rem; }
  .meta { color: #64748b; margin-bottom: 1.5rem; }
  ul { color: #334155; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-size: 14px; }
  th { background: #f1f5f9; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .note { color: #64748b; font-size: 13px; margin-top: 1rem; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>Reimbursement — ${escapeHtml(meta.competitionName)}</h1>
<p class="meta">${escapeHtml(meta.dateRange)} · generated ${escapeHtml(
    meta.generatedAt.toLocaleDateString(),
  )}</p>
<h2>Tiers</h2>
<ul>${legend}</ul>
<table>
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
<p class="note">${escapeHtml(UNKNOWN_NOTE)}</p>
</body>
</html>
`;
}

const csvCell = (s: string): string =>
  /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

/** Spreadsheet-friendly CSV: header row + one row per person. */
export function toCsv(rows: StaffTotals[], meta: ReportMeta): string {
  const lines = [
    COLUMNS.map(csvCell).join(","),
    ...rows.map((r) => cells(r, meta.tiers).map(csvCell).join(",")),
  ];
  return lines.join("\n") + "\n";
}

/**
 * Hand the browser a generated file to download. The only non-pure piece here —
 * builds a Blob, clicks a transient anchor, then revokes the object URL.
 */
export function triggerDownload(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
