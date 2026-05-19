import { describe, it, expect } from "vitest";

import {
  DialogueConditionBindingsManifestSchema,
  DialogueConditionBindingSchema,
  DialogueBindingSkillKeySchema,
} from "./dialogue-condition-bindings";

describe("DialogueConditionBindingSchema — per-binding shape", () => {
  it("accepts a well-formed quest-active binding", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "quest-active",
      name: "has_bandits_quest",
      questId: "bandits",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a well-formed quest-completed binding", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "quest-completed",
      name: "beat_bandits",
      questId: "bandits",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a has-item binding with omitted quantity", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "has-item",
      name: "has_gold_key",
      itemId: "gold_key",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a has-item binding with explicit positive quantity", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "has-item",
      name: "has_five_logs",
      itemId: "logs",
      quantity: 5,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a has-item binding with quantity 0 (programmer error)", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "has-item",
      name: "bad_zero",
      itemId: "logs",
      quantity: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a has-item binding with negative quantity", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "has-item",
      name: "bad_neg",
      itemId: "logs",
      quantity: -3,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a has-item binding with non-integer quantity", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "has-item",
      name: "bad_frac",
      itemId: "logs",
      quantity: 1.5,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a level-at-least binding with a known skill", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "level-at-least",
      name: "mining_40",
      skill: "mining",
      level: 40,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a level-at-least binding with an unknown skill name", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "level-at-least",
      name: "dancing_1",
      skill: "dancing",
      level: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a level-at-least binding with level > 99", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "level-at-least",
      name: "mining_over",
      skill: "mining",
      level: 100,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a level-at-least binding with level < 1", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "level-at-least",
      name: "mining_zero",
      skill: "mining",
      level: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty binding name", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "quest-active",
      name: "",
      questId: "bandits",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a binding name containing whitespace", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "quest-active",
      name: "has bandits quest",
      questId: "bandits",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a binding name containing forbidden punctuation", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "quest-active",
      name: "has.bandits.quest",
      questId: "bandits",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown discriminant kind", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "coin-flip",
      name: "random",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a quest-active binding with empty questId", () => {
    const parsed = DialogueConditionBindingSchema.safeParse({
      kind: "quest-active",
      name: "bad",
      questId: "",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("DialogueConditionBindingsManifestSchema — top-level", () => {
  const valid = {
    $schema: "hyperforge.dialogue-condition-bindings.v1",
    bindings: [
      { kind: "quest-active", name: "has_bandits_quest", questId: "bandits" },
      { kind: "quest-completed", name: "beat_bandits", questId: "bandits" },
      { kind: "has-item", name: "has_gold_key", itemId: "gold_key" },
      {
        kind: "level-at-least",
        name: "mining_40",
        skill: "mining",
        level: 40,
      },
    ],
  };

  it("accepts a well-formed manifest", () => {
    const parsed = DialogueConditionBindingsManifestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty bindings array (no predicates authored)", () => {
    const parsed = DialogueConditionBindingsManifestSchema.safeParse({
      $schema: "hyperforge.dialogue-condition-bindings.v1",
      bindings: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a manifest with the wrong $schema literal", () => {
    const parsed = DialogueConditionBindingsManifestSchema.safeParse({
      ...valid,
      $schema: "hyperforge.dialogue-condition-bindings.v2",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate binding names across the list", () => {
    const parsed = DialogueConditionBindingsManifestSchema.safeParse({
      $schema: "hyperforge.dialogue-condition-bindings.v1",
      bindings: [
        { kind: "has-item", name: "has_key", itemId: "iron_key" },
        { kind: "has-item", name: "has_key", itemId: "gold_key" },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some(
          (issue) =>
            issue.path.join(".") === "bindings.1.name" &&
            String(issue.message).includes("duplicate"),
        ),
      ).toBe(true);
    }
  });

  it("reports duplicate-name issue against the SECOND occurrence (first index stays valid)", () => {
    const parsed = DialogueConditionBindingsManifestSchema.safeParse({
      $schema: "hyperforge.dialogue-condition-bindings.v1",
      bindings: [
        { kind: "quest-active", name: "x", questId: "q1" },
        { kind: "quest-completed", name: "x", questId: "q1" },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const dupes = parsed.error.issues.filter((i) =>
        String(i.message).includes("duplicate"),
      );
      expect(dupes.length).toBe(1);
      expect(dupes[0]!.path.join(".")).toBe("bindings.1.name");
    }
  });

  it("allows two bindings of the same kind if their names differ", () => {
    const parsed = DialogueConditionBindingsManifestSchema.safeParse({
      $schema: "hyperforge.dialogue-condition-bindings.v1",
      bindings: [
        { kind: "has-item", name: "has_iron", itemId: "iron_key" },
        { kind: "has-item", name: "has_gold", itemId: "gold_key" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a manifest missing the $schema literal entirely", () => {
    const parsed = DialogueConditionBindingsManifestSchema.safeParse({
      bindings: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("DialogueBindingSkillKeySchema", () => {
  it("lists every tile-based-MMORPG-style skill key the runtime supports (17 total)", () => {
    expect(DialogueBindingSkillKeySchema.options.sort()).toEqual(
      [
        "agility",
        "attack",
        "constitution",
        "cooking",
        "crafting",
        "defense",
        "firemaking",
        "fishing",
        "fletching",
        "magic",
        "mining",
        "prayer",
        "ranged",
        "runecrafting",
        "smithing",
        "strength",
        "woodcutting",
      ].sort(),
    );
  });

  it("rejects every known non-skill", () => {
    for (const bad of ["combat", "xp", "dancing", "", "ATTACK"]) {
      expect(DialogueBindingSkillKeySchema.safeParse(bad).success).toBe(false);
    }
  });
});
