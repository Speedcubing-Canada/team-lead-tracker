import { describe, expect, it } from "vitest";
import { mergeMyCompetitions, partitionByOngoing, type RawCompetition } from "./competitions";

const comp = (id: string, start: string, end = start): RawCompetition => ({
  id,
  name: `Comp ${id}`,
  start_date: start,
  end_date: end,
});

describe("mergeMyCompetitions", () => {
  it("lists ongoing competitions before upcoming, each sorted by start date", () => {
    const result = mergeMyCompetitions(
      [comp("Live2", "2026-06-13"), comp("Live1", "2026-06-12")],
      [comp("Soon2", "2026-08-01"), comp("Soon1", "2026-07-01")],
    );
    expect(result.map((c) => c.id)).toEqual(["Live1", "Live2", "Soon1", "Soon2"]);
    expect(result.map((c) => c.ongoing)).toEqual([true, true, false, false]);
  });

  it("dedupes a competition present in both lists, keeping it as ongoing", () => {
    const result = mergeMyCompetitions([comp("WC2026", "2026-06-13")], [comp("WC2026", "2026-06-13")]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "WC2026", ongoing: true });
  });

  it("returns an empty list when there are no competitions", () => {
    expect(mergeMyCompetitions([], [])).toEqual([]);
  });
});

describe("partitionByOngoing", () => {
  const today = "2026-06-13";

  it("treats a competition spanning today as ongoing", () => {
    const { ongoing, upcoming } = partitionByOngoing([comp("Live", "2026-06-12", "2026-06-14")], today);
    expect(ongoing.map((c) => c.id)).toEqual(["Live"]);
    expect(upcoming).toEqual([]);
  });

  it("treats a future competition as upcoming", () => {
    const { ongoing, upcoming } = partitionByOngoing([comp("Soon", "2026-07-01", "2026-07-02")], today);
    expect(upcoming.map((c) => c.id)).toEqual(["Soon"]);
    expect(ongoing).toEqual([]);
  });

  it("treats the first and last day of a competition as ongoing (inclusive bounds)", () => {
    const { ongoing } = partitionByOngoing(
      [comp("StartsToday", today, "2026-06-15"), comp("EndsToday", "2026-06-10", today)],
      today,
    );
    expect(ongoing.map((c) => c.id).sort()).toEqual(["EndsToday", "StartsToday"]);
  });
});
