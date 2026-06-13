import { NavLink, Outlet, useParams } from "react-router-dom";

/**
 * Mobile app shell: a scrollable content area with a fixed bottom tab bar.
 * The bottom bar keeps the primary destinations within thumb reach.
 */
export function AppShell() {
  const { competitionId } = useParams();
  const base = `/c/${competitionId}`;

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <main className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <Outlet />
      </main>
      <nav className="grid grid-cols-2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <TabLink to={base} end label="Stage" />
        <TabLink to={`${base}/shame`} label="Dashboard" />
      </nav>
    </div>
  );
}

function TabLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-14 items-center justify-center text-sm font-medium ${
          isActive ? "text-indigo-600" : "text-slate-500"
        }`
      }
    >
      {label}
    </NavLink>
  );
}
