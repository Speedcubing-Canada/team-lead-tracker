import { CircleAlert } from "lucide-react";

export function ErrorNotice({ id, title, body }: { id?: string; title: string; body: string }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 dark:border-red-900/60 dark:bg-red-950/40"
    >
      <CircleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
      <div>
        <p className="text-sm font-semibold text-red-800 dark:text-red-200">{title}</p>
        <p className="text-sm text-red-700 dark:text-red-300">{body}</p>
      </div>
    </div>
  );
}
