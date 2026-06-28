/**
 * Skeleton placeholders that mirror each screen's real layout, so a lead sees the
 * shape of what's loading instead of a bare "Loading…". The shimmer is opt-in via
 * `motion-safe` so reduced-motion users get a calm static block.
 */

/** Base shimmer block. Size it with utility classes via `className`. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`motion-safe:animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`}
    />
  );
}

/** Wrapper that announces "loading" to assistive tech while skeletons paint. */
function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
      <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
      <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
    </div>
  );
}

/** Mirrors StageBoard: sticky header controls + duty sections of staff rows. */
export function StageBoardSkeleton() {
  return (
    <Loading label="Loading competition">
      <div className="flex flex-col">
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <Skeleton className="h-11 w-full rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
          </div>
          <Skeleton className="mx-auto h-3 w-40" />
        </div>
        <div className="flex flex-col gap-4 p-3">
          {[3, 2].map((count, s) => (
            <div key={s} className="flex flex-col gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              {Array.from({ length: count }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1 h-3 w-24" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the shame dashboard: scope tabs, charts, then the absentee list. */
export function DashboardSkeleton() {
  return (
    <Loading label="Loading dashboard">
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-4 w-56" />
        <ChartSkeleton />
        <ChartSkeleton />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </Loading>
  );
}

/** Mirrors the competition list: a stack of tappable comp cards. */
export function CompListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Loading label="Loading">
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </Loading>
  );
}

/** Mirrors the reimbursement export: summary card + per-person rows. */
export function ReimbursementSkeleton() {
  return (
    <Loading label="Loading">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1 h-3 w-32" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </Loading>
  );
}
