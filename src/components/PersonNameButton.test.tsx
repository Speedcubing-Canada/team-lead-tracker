import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PersonNameButton } from "./PersonNameButton";
import { PersonSheetProvider } from "./PersonSheetProvider";
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

describe("PersonNameButton", () => {
  it("renders the name and opens the shared sheet on tap", () => {
    render(
      <PersonSheetProvider>
        <PersonNameButton person={person} />
      </PersonSheetProvider>,
    );

    // No dialog until the name is activated.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bob Brown" }));

    expect(screen.getByRole("dialog", { name: "Bob Brown" })).toBeInTheDocument();
  });

  it("renders harmlessly without a provider (no-op open)", () => {
    render(<PersonNameButton person={person} />);
    fireEvent.click(screen.getByRole("button", { name: "Bob Brown" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
