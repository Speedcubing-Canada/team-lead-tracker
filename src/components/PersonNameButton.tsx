import type { WcifPerson } from "../lib/wca";
import { usePressReveal } from "../lib/usePressReveal";
import { usePersonSheet } from "./PersonSheetProvider";

/**
 * A person's name, rendered as a press target: tap or long-press opens the
 * shared PersonSheet with their WCA photo and IDs. The dotted underline hints
 * it's interactive; `select-none` keeps a long-press from highlighting text.
 */
export function PersonNameButton({
  person,
  className = "",
}: {
  person: WcifPerson;
  className?: string;
}) {
  const { open } = usePersonSheet();
  const press = usePressReveal(() => open(person));

  return (
    <button
      type="button"
      {...press}
      className={`select-none text-left underline decoration-dotted decoration-slate-300 underline-offset-2 dark:decoration-slate-600 ${className}`}
    >
      {person.name}
    </button>
  );
}
