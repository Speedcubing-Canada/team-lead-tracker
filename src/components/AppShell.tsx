import { useCallback, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useParams } from "react-router-dom";
import { BarChart3, ChevronLeft, ClipboardList, Loader2, type LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  fetchPrivileged,
  removePersonPhoto,
  subscribePeoplePhotos,
  uploadPersonPhoto,
  type PersonPhoto,
} from "../lib/photos";
import { PersonSheetProvider } from "./PersonSheetProvider";

/**
 * Mobile app shell: a scrollable content area with a fixed bottom tab bar.
 * The bottom bar keeps the primary destinations within thumb reach.
 * Also guards nested tracker routes behind authentication.
 */
export function AppShell() {
  const { competitionId } = useParams();
  const { user, loading } = useAuth();
  const base = `/c/${competitionId}`;

  const [photos, setPhotos] = useState<Map<number, PersonPhoto>>(new Map());
  const [canUpload, setCanUpload] = useState(false);

  useEffect(() => {
    if (!competitionId || !user) return;
    const unsub = subscribePeoplePhotos(competitionId, setPhotos);
    let active = true;
    fetchPrivileged(competitionId)
      .then((p) => {
        if (active) setCanUpload(p);
      })
      .catch(() => {});
    return () => {
      active = false;
      unsub();
    };
  }, [competitionId, user]);

  const onUploadPhoto = useCallback(
    (wcaUserId: number, file: File) => uploadPersonPhoto(competitionId!, wcaUserId, file, user!),
    [competitionId, user],
  );
  const onRemovePhoto = useCallback(
    (wcaUserId: number) => removePersonPhoto(competitionId!, wcaUserId),
    [competitionId],
  );

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500"
      >
        <Loader2 size={28} aria-hidden className="motion-safe:animate-spin" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <PersonSheetProvider
      photos={photos}
      canUpload={canUpload}
      onUploadPhoto={onUploadPhoto}
      onRemovePhoto={onRemovePhoto}
    >
      <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <main className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <Outlet />
        </main>
        <nav className="grid grid-cols-3 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-700 dark:bg-slate-800">
          <TabLink to={base} end label="Stage" Icon={ClipboardList} />
          <TabLink to={`${base}/shame`} label="Dashboard" Icon={BarChart3} />
          <TabLink to="/" end label="Comps" Icon={ChevronLeft} />
        </nav>
      </div>
    </PersonSheetProvider>
  );
}

function TabLink({
  to,
  label,
  Icon,
  end,
}: {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
          isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"
        }`
      }
    >
      <Icon size={20} aria-hidden />
      {label}
    </NavLink>
  );
}
