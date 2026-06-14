import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";

const LONG_PRESS_MS = 500;

/**
 * Fires `onReveal` when the user either taps OR presses-and-holds the element.
 *
 * Tap is handled via `onClick` (so mouse and keyboard activation work too);
 * the hold is a pointer timer. When the hold fires it reveals immediately and
 * swallows the trailing synthetic click so we don't reveal twice. The context
 * menu is suppressed so the mobile long-press doesn't fight us with a selection
 * popup. Pointer cancel/leave (e.g. the touch turns into a scroll) clears the
 * timer, so scrolling past a name never opens the card.
 */
export function usePressReveal(onReveal: () => void, longPressMs = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  function clear() {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  return {
    onPointerDown: () => {
      longFired.current = false;
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        longFired.current = true;
        onReveal();
      }, longPressMs);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: (e: ReactMouseEvent) => {
      if (longFired.current) {
        // The hold already revealed; swallow the click that follows pointerup.
        longFired.current = false;
        e.preventDefault();
        return;
      }
      onReveal();
    },
    onContextMenu: (e: ReactMouseEvent | ReactPointerEvent) => e.preventDefault(),
  };
}
