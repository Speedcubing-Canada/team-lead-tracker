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

  const photoMeta = { photoPath: "p", uploadedByName: "Dana Delegate", uploadedByWcaId: 9 };

  it("prefers an uploaded photo over the WCA avatar", () => {
    render(
      <PersonSheet
        person={base}
        onClose={() => {}}
        photo={photoMeta}
        photoUrl="https://uploaded.example/p.jpg"
      />,
    );
    expect(screen.getByRole("img", { name: "Alice Anderson" })).toHaveAttribute(
      "src",
      "https://uploaded.example/p.jpg",
    );
    expect(screen.getByText("Photo added by Dana Delegate")).toBeInTheDocument();
  });

  it("hides upload/remove controls when the lead can't upload", () => {
    render(<PersonSheet person={base} onClose={() => {}} canUpload={false} />);
    expect(screen.queryByText(/photo/i)).not.toBeInTheDocument();
  });

  it("shows Upload (no Remove) when privileged and no photo exists, and fires onUpload", () => {
    const onUpload = vi.fn();
    render(<PersonSheet person={base} onClose={() => {}} canUpload onUpload={onUpload} />);
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();

    const file = new File(["x"], "face.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload photo"), { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it("shows Replace + Remove and fires onRemove when a photo exists", () => {
    const onRemove = vi.fn();
    render(
      <PersonSheet
        person={base}
        onClose={() => {}}
        canUpload
        photo={photoMeta}
        photoUrl="https://uploaded.example/p.jpg"
        onUpload={vi.fn()}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByLabelText("Replace photo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
