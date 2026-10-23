import { renderApp } from "../test/renderApp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { checksApi } from "../test/fakeBackend";
import { sampleWcif } from "../test/fixtures/wcif";

const COMP = "SampleComp2026";
const lead = { wcaUserId: 9, name: "Lead" };

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

let downloads: { name: string; blob: Blob }[];
beforeEach(async () => {
  downloads = [];
  let blob: Blob;
  URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), "blob:report"));
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, blob });
  });

  // Bob: 1 absent of 2 duties (50%); Alice: present at her only duty.
  await checksApi.writeStatus(COMP, 101, 2, "absent", lead);
  await checksApi.writeStatus(COMP, 102, 2, "present", lead);
  await checksApi.writeStatus(COMP, 101, 1, "present", lead);
});
afterEach(() => vi.restoreAllMocks());

const card = (name: string) => screen.getByText(name).closest("li")!;

describe("reimbursement export", () => {
  it("tiers each staffer by confirmed absences", async () => {
    renderApp(`/c/${COMP}/reimbursement`, { wcifs: [sampleWcif] });

    expect(await screen.findByText("Reimbursement export")).toBeInTheDocument();
    expect(card("Alice Anderson")).toHaveTextContent("Full");
    expect(card("Bob Brown")).toHaveTextContent("None");
    expect(card("Bob Brown")).toHaveTextContent("50% absent");
  });

  it("re-tiers people when a band is edited", async () => {
    renderApp(`/c/${COMP}/reimbursement`, { wcifs: [sampleWcif] });
    fireEvent.click(await screen.findByRole("button", { name: /Tiers/ }));
    fireEvent.change(screen.getByLabelText("Tier 2 max absent percent"), { target: { value: "60" } });
    expect(card("Bob Brown")).toHaveTextContent("Partial");
  });

  it("downloads a CSV with one row per staffer", async () => {
    renderApp(`/c/${COMP}/reimbursement`, { wcifs: [sampleWcif] });
    fireEvent.click(await screen.findByRole("button", { name: "CSV" }));

    expect(downloads.map((d) => d.name)).toEqual([`${COMP}-reimbursement.csv`]);
    const csv = await downloads[0]!.blob.text();
    expect(csv).toMatch(/^Name,WCA ID,Total/);
    expect(csv).toContain("Bob Brown");
    expect(csv).toContain("Alice Anderson");
  });

  it("says why the comp couldn't load", async () => {
    renderApp("/c/Nope2099/reimbursement");
    expect(await screen.findByRole("alert")).toHaveTextContent('Failed to load competition "Nope2099" (404)');
  });
});
