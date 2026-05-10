/**
 * Phase 1.1 fourteenth carve — locks in the tile-coord ↔ key
 * encoding. Determinism + the packed-key collision bounds are
 * the contract the streamer's Map<string, TileData> + the
 * packed-int cache key depend on.
 */

import { describe, expect, it } from "vitest";
import { formatTileKey, isTileInBounds, packTileKey } from "../tileKey";

describe("formatTileKey", () => {
  it("formats positive coords as 'x_z'", () => {
    expect(formatTileKey(3, 7)).toBe("3_7");
  });

  it("formats negative coords as 'x_z' (no sign mangling)", () => {
    expect(formatTileKey(-3, -7)).toBe("-3_-7");
  });

  it("(0, 0) formats to '0_0'", () => {
    expect(formatTileKey(0, 0)).toBe("0_0");
  });

  it("symmetric across coord swap — different keys for (a, b) vs (b, a)", () => {
    expect(formatTileKey(3, 7)).not.toBe(formatTileKey(7, 3));
  });
});

describe("packTileKey", () => {
  it("is deterministic — same input → same packed key", () => {
    expect(packTileKey(3, 7)).toBe(packTileKey(3, 7));
  });

  it("packs (0, 0) to a positive non-collision value (500*1000+500 = 500500)", () => {
    expect(packTileKey(0, 0)).toBe(500_500);
  });

  it("distinct (tx, tz) within range produce distinct packed values", () => {
    const seen = new Set<number>();
    for (let tx = -50; tx <= 50; tx++) {
      for (let tz = -50; tz <= 50; tz++) {
        const k = packTileKey(tx, tz);
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    expect(seen.size).toBe(101 * 101);
  });

  it("uses the canonical +500 offset (encoding contract)", () => {
    // (1, 0) → (1+500)*1000 + (0+500) = 501500
    // (0, 1) → (0+500)*1000 + (1+500) = 500501
    expect(packTileKey(1, 0)).toBe(501_500);
    expect(packTileKey(0, 1)).toBe(500_501);
  });

  it("supports negative coords within the [-500, 500] window", () => {
    expect(packTileKey(-100, -100)).toBe(400 * 1000 + 400);
    expect(packTileKey(-500, -500)).toBe(0);
    expect(packTileKey(500, 500)).toBe(1_000_000 + 1000);
  });
});

describe("isTileInBounds", () => {
  it("accepts (0, 0) when worldSize > 0", () => {
    expect(isTileInBounds(0, 0, 10)).toBe(true);
  });

  it("accepts coords up to worldSize - 1 (exclusive upper bound)", () => {
    expect(isTileInBounds(9, 9, 10)).toBe(true);
  });

  it("rejects worldSize itself (exclusive upper bound)", () => {
    expect(isTileInBounds(10, 0, 10)).toBe(false);
    expect(isTileInBounds(0, 10, 10)).toBe(false);
  });

  it("rejects negative coordinates", () => {
    expect(isTileInBounds(-1, 0, 10)).toBe(false);
    expect(isTileInBounds(0, -1, 10)).toBe(false);
  });

  it("rejects everything when worldSize is 0", () => {
    expect(isTileInBounds(0, 0, 0)).toBe(false);
    expect(isTileInBounds(-1, -1, 0)).toBe(false);
  });

  it("rejects when either coord is out of bounds (mixed)", () => {
    // X in bounds, Z out
    expect(isTileInBounds(5, 100, 10)).toBe(false);
    // Z in bounds, X out
    expect(isTileInBounds(100, 5, 10)).toBe(false);
  });
});
