import { describe, expect, it } from "vitest";

import {
  AVATAR_OPTIONS,
  CANONICAL_DUEL_AVATAR_ID,
  CANONICAL_DUEL_AVATAR_URL,
  DEFAULT_AVATAR_URL,
  getDuelAvatarUrlForStyle,
} from "../avatars";

describe("duel avatar roster", () => {
  it("registers five distinct three-level optimized fighters", () => {
    expect(AVATAR_OPTIONS.map((avatar) => avatar.id)).toEqual([
      "bandit",
      "barbarian",
      "dark-ranger",
      "dark-wizard",
      "steve",
    ]);
    expect(new Set(AVATAR_OPTIONS.map((avatar) => avatar.url)).size).toBe(5);
    for (const avatar of AVATAR_OPTIONS) {
      expect(avatar.url).toContain("/duel-candidates/");
      expect(avatar.lod1Url).toContain("_lod1.vrm");
      expect(avatar.lod2Url).toContain("_lod2.vrm");
      expect(avatar.previewPath).toBe(avatar.url.slice("asset:/".length));
    }
    expect(DEFAULT_AVATAR_URL).toBe(AVATAR_OPTIONS[0].url);
    expect(CANONICAL_DUEL_AVATAR_ID).toBe("steve");
    expect(CANONICAL_DUEL_AVATAR_URL).toContain("duel-steve.vrm");
  });

  it("maps scripted strategies to stable, visually meaningful identities", () => {
    expect(getDuelAvatarUrlForStyle("melee", 0)).toContain("barbarian");
    expect(getDuelAvatarUrlForStyle("melee", 1)).toContain("bandit");
    expect(getDuelAvatarUrlForStyle("ranged", 0)).toContain("dark-ranger");
    expect(getDuelAvatarUrlForStyle("mage", 0)).toContain("dark-wizard");
    expect(getDuelAvatarUrlForStyle("prayer", 1)).toContain("barbarian");
    expect(getDuelAvatarUrlForStyle("auto", -1)).toContain("dark-wizard");
  });
});
