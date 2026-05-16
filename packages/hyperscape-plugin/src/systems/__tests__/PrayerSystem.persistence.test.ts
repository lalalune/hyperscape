import { describe, expect, it } from "vitest";
import { parsePersistedActivePrayers } from "../PrayerSystem";

describe("PrayerSystem persisted activePrayers parsing", () => {
  it("accepts JSONB array values without repair", () => {
    const parsed = parsePersistedActivePrayers(
      ["thick_skin", "burst_of_strength"],
      "player-1",
    );

    expect(parsed.activePrayers).toEqual(["thick_skin", "burst_of_strength"]);
    expect(parsed.shouldRepair).toBe(false);
  });

  it("repairs malformed JSON strings", () => {
    const parsed = parsePersistedActivePrayers('["thick_skin"', "player-2");

    expect(parsed.activePrayers).toEqual([]);
    expect(parsed.shouldRepair).toBe(true);
  });

  it("repairs non-array JSON payloads", () => {
    const parsed = parsePersistedActivePrayers(
      '{"thick_skin": true}',
      "player-3",
    );

    expect(parsed.activePrayers).toEqual([]);
    expect(parsed.shouldRepair).toBe(true);
  });

  it("repairs empty strings", () => {
    const parsed = parsePersistedActivePrayers("   ", "player-4");

    expect(parsed.activePrayers).toEqual([]);
    expect(parsed.shouldRepair).toBe(true);
  });

  it("filters invalid and duplicate prayer ids", () => {
    const parsed = parsePersistedActivePrayers(
      JSON.stringify([
        "thick_skin",
        "thick_skin",
        "burst_of_strength",
        "INVALID_PRAYER",
        123,
      ]),
      "player-5",
    );

    expect(parsed.activePrayers).toEqual(["thick_skin", "burst_of_strength"]);
    expect(parsed.shouldRepair).toBe(true);
  });

  it("returns empty array without repair for null/undefined", () => {
    const fromNull = parsePersistedActivePrayers(null, "player-6");
    const fromUndefined = parsePersistedActivePrayers(undefined, "player-7");

    expect(fromNull).toEqual({ activePrayers: [], shouldRepair: false });
    expect(fromUndefined).toEqual({ activePrayers: [], shouldRepair: false });
  });
});
