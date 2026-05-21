/**
 * formatters — display-string smoke tests.
 *
 * Pins the format strings the WorldStudio panels render across
 * the properties panel, outliner, and minimap. Drift here = a
 * UI regression visible to every user.
 */

import { describe, expect, it } from "vitest";

import { fmtDistance, fmtLevel, fmtLevelRange, fmtPos } from "../formatters";

describe("fmtPos", () => {
  it("rounds floats to nearest integer", () => {
    expect(fmtPos(10.4, 20.6)).toBe("(10, 21)");
  });

  it("formats integer coords verbatim", () => {
    expect(fmtPos(0, 0)).toBe("(0, 0)");
    expect(fmtPos(100, -50)).toBe("(100, -50)");
  });

  it("handles negative coordinates", () => {
    expect(fmtPos(-5.5, -10.5)).toBe("(-5, -10)");
  });
});

describe("fmtLevel", () => {
  it("prepends Lv and uses the level verbatim", () => {
    expect(fmtLevel(1)).toBe("Lv1");
    expect(fmtLevel(99)).toBe("Lv99");
  });

  it("handles 0 and negative (unusual but defined)", () => {
    expect(fmtLevel(0)).toBe("Lv0");
    expect(fmtLevel(-1)).toBe("Lv-1");
  });
});

describe("fmtLevelRange", () => {
  it("joins two levels with a hyphen and shared Lv prefix", () => {
    expect(fmtLevelRange(1, 10)).toBe("Lv1-10");
    expect(fmtLevelRange(50, 99)).toBe("Lv50-99");
  });

  it("emits identical-bounds form when min equals max", () => {
    // Equal bounds still produce "LvN-N" — callers that want
    // "LvN" use fmtLevel directly. Pin the contract.
    expect(fmtLevelRange(5, 5)).toBe("Lv5-5");
  });
});

describe("fmtDistance", () => {
  it("rounds to nearest meter", () => {
    expect(fmtDistance(12.4)).toBe("12m");
    expect(fmtDistance(12.6)).toBe("13m");
  });

  it("emits 0m at zero and supports large distances", () => {
    expect(fmtDistance(0)).toBe("0m");
    expect(fmtDistance(9999)).toBe("9999m");
  });

  it("handles fractional values near 0.5 (banker's rounding edge)", () => {
    // Math.round rounds half-to-even on some engines but
    // V8/JSC use half-away-from-zero — pin the observed result.
    expect(fmtDistance(0.5)).toBe("1m");
    expect(fmtDistance(1.5)).toBe("2m");
  });
});
