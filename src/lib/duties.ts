/** Presentation for a staff duty: a human label and a Tailwind badge class. */
export interface DutyStyle {
  label: string;
  /** Tailwind classes for a small pill badge (background + text color). */
  badge: string;
}

/**
 * Per-duty colors so judge/scrambler/runner/etc. are scannable at a glance.
 * Each known duty gets a distinct, accessible 100/700 pairing; unknown staff
 * codes fall back to slate with the "staff-" prefix stripped.
 */
const DUTY_STYLES: Record<string, DutyStyle> = {
  "staff-judge": { label: "Judge", badge: "bg-blue-100 text-blue-700" },
  "staff-scrambler": { label: "Scrambler", badge: "bg-amber-100 text-amber-700" },
  "staff-runner": { label: "Runner", badge: "bg-purple-100 text-purple-700" },
  "staff-dataentry": { label: "Data entry", badge: "bg-teal-100 text-teal-700" },
  "staff-announcer": { label: "Announcer", badge: "bg-rose-100 text-rose-700" },
};

export function dutyStyle(code: string): DutyStyle {
  return DUTY_STYLES[code] ?? { label: code.replace(/^staff-/, ""), badge: "bg-slate-100 text-slate-700" };
}

/** The order duties are shown in (most to least common on a stage); unknowns sort last. */
const DUTY_ORDER = [
  "staff-judge",
  "staff-scrambler",
  "staff-runner",
  "staff-dataentry",
  "staff-announcer",
];

/** Sort key for a duty code: its position in DUTY_ORDER, or last for unknowns. */
export function dutyRank(code: string): number {
  const i = DUTY_ORDER.indexOf(code);
  return i === -1 ? DUTY_ORDER.length : i;
}
