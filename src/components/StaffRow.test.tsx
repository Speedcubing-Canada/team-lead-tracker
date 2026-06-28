import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StaffRow } from "./StaffRow";
import type { WcifPerson } from "../lib/wca";

const person: WcifPerson = {
  registrantId: 7,
  name: "Bob Brown",
  wcaUserId: 1002,
  wcaId: null,
  countryIso2: "US",
  roles: [],
  assignments: [],
  avatar: null,
};

describe("StaffRow notes", () => {
  it("saves a typed note when tapping ✓ directly, and also marks present", () => {
    const onStatus = vi.fn();
    const onNote = vi.fn();
    render(<StaffRow person={person} station={null} onStatus={onStatus} onNote={onNote} />);

    // Reveal the note input and type, then go straight for the present button —
    // the interaction that used to drop the note (regression guard).
    fireEvent.click(screen.getByLabelText("Add note"));
    const input = screen.getByPlaceholderText(/Add a note/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "left early" } });

    const present = screen.getByLabelText("Present");
    fireEvent.pointerDown(present);
    fireEvent.click(present);

    expect(onNote).toHaveBeenCalledWith("left early");
    expect(onStatus).toHaveBeenCalledWith("present");
  });

  it("still saves the note on blur when tapping elsewhere", () => {
    const onNote = vi.fn();
    render(<StaffRow person={person} station={null} onStatus={vi.fn()} onNote={onNote} />);

    fireEvent.click(screen.getByLabelText("Add note"));
    const input = screen.getByPlaceholderText(/Add a note/);
    fireEvent.change(input, { target: { value: "left early" } });
    fireEvent.blur(input);

    expect(onNote).toHaveBeenCalledWith("left early");
  });

  it("does not write when the note is unchanged", () => {
    const onNote = vi.fn();
    render(
      <StaffRow
        person={person}
        station={null}
        check={{ status: "present", note: "left early", updatedByName: "L", updatedByWcaId: 9 }}
        onStatus={vi.fn()}
        onNote={onNote}
      />,
    );

    const input = screen.getByPlaceholderText(/Add a note/);
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onNote).not.toHaveBeenCalled();
  });
});
