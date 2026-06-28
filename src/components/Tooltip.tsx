import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A small, dependency-free tooltip tuned for a touch-first app: it reveals on
 * hover/focus (desktop) and on long-press (mobile). Wrap a single interactive
 * child. For elements whose tap performs an action (e.g. present/absent), pass
 * `longPress={false}` so holding doesn't fight the tap — desktop hover/focus
 * still works there.
 */
export function Tooltip({
  label,
  side = "top",
  longPress = true,
  children,
  className = "",
}: {
  label: string;
  side?: "top" | "bottom";
  /** Reveal on long-press (mobile). Disable for tap-to-act controls. */
  longPress?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const clearTimer = () => window.clearTimeout(timer.current);

  // Long-press: arm a timer on press; a move/release before it fires cancels it.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!longPress || e.pointerType === "mouse") return;
    clearTimer();
    timer.current = window.setTimeout(() => setOpen(true), 400);
  };
  const endPress = () => {
    clearTimer();
    if (longPress) setOpen(false);
  };

  const pos =
    side === "top"
      ? "bottom-full mb-1.5 left-1/2 -translate-x-1/2"
      : "top-full mt-1.5 left-1/2 -translate-x-1/2";

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onPointerDown={onPointerDown}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
    >
      <span aria-describedby={open ? id : undefined} className="contents">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={`pointer-events-none absolute z-50 ${pos} whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-md dark:bg-slate-700`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
