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
  it("folds a typed note into the status write when tapping ✓ (no prior check)", () => {
    const onStatus = vi.fn();
    const onNote = vi.fn();
    render(<StaffRow person={person} station={null} onStatus={onStatus} onNote={onNote} />);

    // Reveal the note input and type, then go straight for the present button.
    // The note must ride along with the status in one write, otherwise a fresh
    // doc gets created without a status (which Firestore rules reject) and the
    // note is lost — the regression this guards against.
    fireEvent.click(screen.getByLabelText("Add note"));
    const input = screen.getByPlaceholderText(/Add a note/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "left early" } });

    const present = screen.getByLabelText("Present");
    fireEvent.pointerDown(present);
    fireEvent.click(present);

    expect(onStatus).toHaveBeenCalledWith("present", "left early");
    // No separate note-only write (which would be a status-less create).
    expect(onNote).not.toHaveBeenCalled();
  });

  it("saves the note via onNote on blur when the staffer already has a status", () => {
    const onNote = vi.fn();
    render(
      <StaffRow
        person={person}
        station={null}
        check={{ status: "present", note: "", updatedByName: "L", updatedByWcaId: 9 }}
        onStatus={vi.fn()}
        onNote={onNote}
      />,
    );

    fireEvent.click(screen.getByLabelText("Add note"));
    const input = screen.getByPlaceholderText(/Add a note/);
    fireEvent.change(input, { target: { value: "left early" } });
    fireEvent.blur(input);

    expect(onNote).toHaveBeenCalledWith("left early");
  });

  it("saves a note-only check on blur when the staffer has no status", () => {
    const onStatus = vi.fn();
    const onNote = vi.fn();
    render(<StaffRow person={person} station={null} onStatus={onStatus} onNote={onNote} />);

    // Typing a note for an unmarked staffer and tapping elsewhere persists it as a
    // note-only check (no present/absent mark) — the reported bug was this note
    // being silently dropped and lost on navigation.
    fireEvent.click(screen.getByLabelText("Add note"));
    const input = screen.getByPlaceholderText(/Add a note/);
    fireEvent.change(input, { target: { value: "left early" } });
    fireEvent.blur(input);

    expect(onNote).toHaveBeenCalledWith("left early");
    // No status write: the note stands on its own without a present/absent mark.
    expect(onStatus).not.toHaveBeenCalled();
  });

  it("deletes a note-only check by clearing its note (via onStatus null)", () => {
    const onStatus = vi.fn();
    const onNote = vi.fn();
    render(
      <StaffRow
        person={person}
        station={null}
        check={{ note: "left early", updatedByName: "L", updatedByWcaId: 9 }}
        onStatus={onStatus}
        onNote={onNote}
      />,
    );

    // Emptying the note on a status-less check removes the doc rather than leaving
    // an orphan with an empty note and no status.
    const input = screen.getByPlaceholderText(/Add a note/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onStatus).toHaveBeenCalledWith(null);
    expect(onNote).not.toHaveBeenCalled();
  });

  it("does not pass a note when marking a staffer without editing the note", () => {
    const onStatus = vi.fn();
    render(
      <StaffRow
        person={person}
        station={null}
        check={{ status: "absent", note: "left early", updatedByName: "L", updatedByWcaId: 9 }}
        onStatus={onStatus}
        onNote={vi.fn()}
      />,
    );

    const present = screen.getByLabelText("Present");
    fireEvent.pointerDown(present);
    fireEvent.click(present);

    // Status-only write: note omitted so the existing note is left untouched.
    expect(onStatus).toHaveBeenCalledWith("present", undefined);
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
