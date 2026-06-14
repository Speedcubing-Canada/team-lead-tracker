import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PersonSheet } from "./PersonSheet";
import type { WcifPerson } from "../lib/wca";

const base: WcifPerson = {
  registrantId: 42,
  name: "Alice Anderson",
  wcaUserId: 1001,
  wcaId: "2015ANDE01",
  countryIso2: "CA",
  roles: [],
  assignments: [],
  avatar: {
    url: "https://avatars.example/full.jpg",
    thumbUrl: "https://avatars.example/thumb.jpg",
  },
};

describe("PersonSheet", () => {
  it("shows the avatar, name, WCA profile link, and WCA Live ID number", () => {
    render(<PersonSheet person={base} onClose={() => {}} />);

    expect(screen.getByRole("img", { name: "Alice Anderson" })).toHaveAttribute(
      "src",
      "https://avatars.example/full.jpg",
    );
    expect(screen.getByText("Alice Anderson")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2015ANDE01" })).toHaveAttribute(
      "href",
      "https://www.worldcubeassociation.org/persons/2015ANDE01",
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("falls back to initials when there is no avatar", () => {
    render(<PersonSheet person={{ ...base, avatar: null }} onClose={() => {}} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AA")).toBeInTheDocument();
  });

  it("omits the WCA profile link when the person has no WCA ID", () => {
    render(<PersonSheet person={{ ...base, wcaId: null }} onClose={() => {}} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("closes via the backdrop and the Close button", () => {
    const onClose = vi.fn();
    render(<PersonSheet person={base} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
