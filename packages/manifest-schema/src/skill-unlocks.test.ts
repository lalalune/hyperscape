import { describe, expect, it } from "vitest";

import {
  SkillUnlocksManifestSchema,
  type SkillUnlocksManifest,
} from "./skill-unlocks.js";

const hyperscapeSkillUnlocks: SkillUnlocksManifest = {
  _comment: "tile-based-MMORPG-accurate skill unlocks for implemented skills.",
  skills: {
    attack: [
      { level: 1, description: "Bronze weapons", type: "item" },
      { level: 5, description: "Steel weapons", type: "item" },
    ],
    defence: [{ level: 99, description: "Defence cape", type: "item" }],
  },
};

describe("SkillUnlocksManifestSchema", () => {
  it("parses a realistic manifest cleanly", () => {
    const result = SkillUnlocksManifestSchema.safeParse(hyperscapeSkillUnlocks);
    if (!result.success) {
      throw new Error(
        `Skill unlocks manifest failed validation:\n${JSON.stringify(result.error.format(), null, 2)}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it("rejects out-of-range level", () => {
    const bad = {
      skills: {
        attack: [{ level: 120, description: "x", type: "item" }],
      },
    };
    expect(SkillUnlocksManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown unlock type", () => {
    const bad = {
      skills: {
        attack: [{ level: 1, description: "x", type: "nonsense" }],
      },
    };
    expect(SkillUnlocksManifestSchema.safeParse(bad).success).toBe(false);
  });
});
