import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { usePressReveal } from "./usePressReveal";

function Harness({ onReveal }: { onReveal: () => void }) {
  const press = usePressReveal(onReveal);
  return (
    <button type="button" {...press}>
      Tap me
    </button>
  );
}

describe("usePressReveal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reveals on a quick tap (release before the hold threshold)", () => {
    const onReveal = vi.fn();
    render(<Harness onReveal={onReveal} />);
    const btn = screen.getByRole("button");

    fireEvent.pointerDown(btn);
    fireEvent.pointerUp(btn); // released early → timer cleared, no hold
    fireEvent.click(btn);

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("reveals once on a long press and swallows the trailing click", () => {
    const onReveal = vi.fn();
    render(<Harness onReveal={onReveal} />);
    const btn = screen.getByRole("button");

    fireEvent.pointerDown(btn);
    act(() => vi.advanceTimersByTime(500)); // hold fires
    expect(onReveal).toHaveBeenCalledTimes(1);

    fireEvent.click(btn); // synthetic click after release is suppressed
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("does not reveal when the press is cancelled (e.g. turns into a scroll)", () => {
    const onReveal = vi.fn();
    render(<Harness onReveal={onReveal} />);
    const btn = screen.getByRole("button");

    fireEvent.pointerDown(btn);
    fireEvent.pointerCancel(btn);
    act(() => vi.advanceTimersByTime(500));

    expect(onReveal).not.toHaveBeenCalled();
  });
});
