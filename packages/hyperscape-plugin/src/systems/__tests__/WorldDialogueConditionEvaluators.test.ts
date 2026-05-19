/**
 * Tests for the world-backed concrete DialogueConditionEvaluator
 * bindings.
 *
 * These bridge author-named dialogue predicates (e.g.
 * `"has_bandits_quest"`) to live QuestSystem / InventorySystem /
 * SkillsSystem reads on the running world. Each test builds a fake
 * `World` with a `getSystem` stub that returns a small shim for only
 * the read surface the predicate touches.
 */
import { describe, it, expect, vi } from "vitest";

import type { World } from "@hyperforge/shared";
import type { DialogueConditionArgs } from "../DialogueSystem";
import { DialogueSystem } from "../DialogueSystem";
import {
  buildDialoguePredicate,
  createManagedDialogueConditionInstall,
  installWorldDialogueConditions,
  type DialogueConditionBinding,
} from "@hyperforge/shared";

interface FakeSystems {
  quest?: {
    getActiveQuests: (playerId: string) => Array<{
      questId: string;
      status: string;
    }>;
    hasCompletedQuest: (playerId: string, questId: string) => boolean;
  };
  inventory?: {
    hasItem: (playerId: string, itemId: string, qty: number) => boolean;
  };
  skills?: {
    getSkillData: (
      playerId: string,
      skill: string,
    ) => { level: number } | undefined;
  };
}

function makeWorld(systems: FakeSystems): World {
  return {
    isServer: true,
    entities: new Map(),
    currentTick: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSystem: vi.fn((name: string) => (systems as any)[name] ?? null),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    $eventBus: {
      emitEvent: vi.fn(),
      subscribe: vi.fn(),
      subscribeOnce: vi.fn(),
      unsubscribe: vi.fn(),
    },
  } as unknown as World;
}

const args = (playerId: string): DialogueConditionArgs => ({
  playerId,
  npcId: "npc_banditleader",
  npcEntityId: "entity_npc_123",
});

describe("buildDialoguePredicate — quest-active", () => {
  it("returns false when QuestSystem is missing", () => {
    const world = makeWorld({});
    const fn = buildDialoguePredicate(world, {
      name: "has_bandits_quest",
      kind: "quest-active",
      questId: "bandits_quest",
    });
    expect(fn(args("p1"))).toBe(false);
  });

  it("returns true when the quest is in progress for the player", () => {
    const world = makeWorld({
      quest: {
        getActiveQuests: () => [
          { questId: "bandits_quest", status: "in_progress" },
          { questId: "other", status: "ready_to_complete" },
        ],
        hasCompletedQuest: () => false,
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "has_bandits_quest",
      kind: "quest-active",
      questId: "bandits_quest",
    });
    expect(fn(args("p1"))).toBe(true);
  });

  it("returns true when the quest is ready_to_complete (still active)", () => {
    const world = makeWorld({
      quest: {
        getActiveQuests: () => [
          { questId: "bandits_quest", status: "ready_to_complete" },
        ],
        hasCompletedQuest: () => false,
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "has_bandits_quest",
      kind: "quest-active",
      questId: "bandits_quest",
    });
    expect(fn(args("p1"))).toBe(true);
  });

  it("returns false when the quest is already completed (status === 'completed')", () => {
    const world = makeWorld({
      quest: {
        getActiveQuests: () => [
          { questId: "bandits_quest", status: "completed" },
        ],
        hasCompletedQuest: () => true,
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "has_bandits_quest",
      kind: "quest-active",
      questId: "bandits_quest",
    });
    expect(fn(args("p1"))).toBe(false);
  });

  it("returns false when the quest is not in the active list", () => {
    const world = makeWorld({
      quest: {
        getActiveQuests: () => [],
        hasCompletedQuest: () => false,
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "has_bandits_quest",
      kind: "quest-active",
      questId: "bandits_quest",
    });
    expect(fn(args("p1"))).toBe(false);
  });
});

describe("buildDialoguePredicate — quest-completed", () => {
  it("delegates to QuestSystem.hasCompletedQuest with (playerId, questId)", () => {
    const calls: Array<{ playerId: string; questId: string }> = [];
    const world = makeWorld({
      quest: {
        getActiveQuests: () => [],
        hasCompletedQuest: (playerId, questId) => {
          calls.push({ playerId, questId });
          return questId === "beaten_quest";
        },
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "beat_quest",
      kind: "quest-completed",
      questId: "beaten_quest",
    });
    expect(fn(args("p1"))).toBe(true);
    expect(calls).toEqual([{ playerId: "p1", questId: "beaten_quest" }]);
  });

  it("returns false when QuestSystem is missing", () => {
    const fn = buildDialoguePredicate(makeWorld({}), {
      name: "beat_quest",
      kind: "quest-completed",
      questId: "beaten_quest",
    });
    expect(fn(args("p1"))).toBe(false);
  });
});

describe("buildDialoguePredicate — has-item", () => {
  it("defaults quantity to 1 when omitted", () => {
    const seen: number[] = [];
    const world = makeWorld({
      inventory: {
        hasItem: (_p, _i, qty) => {
          seen.push(qty);
          return true;
        },
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "has_key",
      kind: "has-item",
      itemId: "key",
    });
    fn(args("p1"));
    expect(seen).toEqual([1]);
  });

  it("honors an explicit quantity > 1", () => {
    const seen: number[] = [];
    const world = makeWorld({
      inventory: {
        hasItem: (_p, _i, qty) => {
          seen.push(qty);
          return true;
        },
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "has_five_logs",
      kind: "has-item",
      itemId: "logs",
      quantity: 5,
    });
    fn(args("p1"));
    expect(seen).toEqual([5]);
  });

  it("returns a short-circuit-false predicate when quantity ≤ 0 (programmer error)", () => {
    // Sanity: we expect binding-time validation to produce a
    // dead predicate that never consults the world.
    const world = makeWorld({
      inventory: { hasItem: () => true },
    });
    const zero = buildDialoguePredicate(world, {
      name: "bad_zero",
      kind: "has-item",
      itemId: "logs",
      quantity: 0,
    });
    const neg = buildDialoguePredicate(world, {
      name: "bad_neg",
      kind: "has-item",
      itemId: "logs",
      quantity: -3,
    });
    expect(zero(args("p1"))).toBe(false);
    expect(neg(args("p1"))).toBe(false);
  });

  it("returns false when InventorySystem is missing", () => {
    const fn = buildDialoguePredicate(makeWorld({}), {
      name: "has_key",
      kind: "has-item",
      itemId: "key",
    });
    expect(fn(args("p1"))).toBe(false);
  });

  it("delegates to InventorySystem.hasItem and returns its result", () => {
    const world = makeWorld({
      inventory: { hasItem: (_p, itemId) => itemId === "key" },
    });
    const hasKey = buildDialoguePredicate(world, {
      name: "has_key",
      kind: "has-item",
      itemId: "key",
    });
    const hasScroll = buildDialoguePredicate(world, {
      name: "has_scroll",
      kind: "has-item",
      itemId: "scroll",
    });
    expect(hasKey(args("p1"))).toBe(true);
    expect(hasScroll(args("p1"))).toBe(false);
  });
});

describe("buildDialoguePredicate — level-at-least", () => {
  it("returns true when skill level ≥ required", () => {
    const world = makeWorld({
      skills: {
        getSkillData: () => ({ level: 42 }),
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "mining_at_40",
      kind: "level-at-least",
      skill: "mining",
      level: 40,
    });
    expect(fn(args("p1"))).toBe(true);
  });

  it("returns true when skill level equals required", () => {
    const world = makeWorld({
      skills: {
        getSkillData: () => ({ level: 40 }),
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "mining_at_40",
      kind: "level-at-least",
      skill: "mining",
      level: 40,
    });
    expect(fn(args("p1"))).toBe(true);
  });

  it("returns false when skill level < required", () => {
    const world = makeWorld({
      skills: {
        getSkillData: () => ({ level: 10 }),
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "mining_at_40",
      kind: "level-at-least",
      skill: "mining",
      level: 40,
    });
    expect(fn(args("p1"))).toBe(false);
  });

  it("returns false when SkillsSystem is missing", () => {
    const fn = buildDialoguePredicate(makeWorld({}), {
      name: "mining_at_40",
      kind: "level-at-least",
      skill: "mining",
      level: 40,
    });
    expect(fn(args("p1"))).toBe(false);
  });

  it("returns false when skill is not tracked (getSkillData → undefined)", () => {
    const world = makeWorld({
      skills: { getSkillData: () => undefined },
    });
    const fn = buildDialoguePredicate(world, {
      name: "mining_at_40",
      kind: "level-at-least",
      skill: "mining",
      level: 40,
    });
    expect(fn(args("p1"))).toBe(false);
  });

  it("short-circuits to false for unknown skill names (not in KNOWN_SKILLS)", () => {
    const world = makeWorld({
      skills: {
        // Would otherwise allow through — but binding's `skill` is
        // typed `keyof Skills`; this test simulates a mis-typed
        // author binding routed through the runtime guard.
        getSkillData: () => ({ level: 99 }),
      },
    });
    const fn = buildDialoguePredicate(world, {
      name: "dancing_at_1",
      kind: "level-at-least",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      skill: "dancing" as any,
      level: 1,
    });
    expect(fn(args("p1"))).toBe(false);
  });
});

describe("installWorldDialogueConditions", () => {
  function makeDialogueSystem(world: World): DialogueSystem {
    return new DialogueSystem(world);
  }

  it("registers every binding by its `name` on the DialogueSystem", () => {
    const world = makeWorld({});
    const ds = makeDialogueSystem(world);
    const bindings: DialogueConditionBinding[] = [
      {
        name: "has_bandits_quest",
        kind: "quest-active",
        questId: "bandits",
      },
      {
        name: "beat_bandits",
        kind: "quest-completed",
        questId: "bandits",
      },
      { name: "has_key", kind: "has-item", itemId: "key" },
      {
        name: "mining_40",
        kind: "level-at-least",
        skill: "mining",
        level: 40,
      },
    ];
    installWorldDialogueConditions(ds, world, bindings);

    expect(ds.getRegisteredConditionNames()).toEqual([
      "beat_bandits",
      "has_bandits_quest",
      "has_key",
      "mining_40",
    ]);
  });

  it("last-write-wins when two bindings share a name", () => {
    const world = makeWorld({
      inventory: { hasItem: (_p, itemId) => itemId === "gold_key" },
    });
    const ds = makeDialogueSystem(world);
    installWorldDialogueConditions(ds, world, [
      { name: "has_the_key", kind: "has-item", itemId: "iron_key" },
      { name: "has_the_key", kind: "has-item", itemId: "gold_key" },
    ]);
    expect(ds.getRegisteredConditionNames()).toEqual(["has_the_key"]);
    // Second binding wins → only "gold_key" returns true.
    const latest = (
      ds as unknown as {
        conditionEvaluators: Map<string, (a: DialogueConditionArgs) => boolean>;
      }
    ).conditionEvaluators.get("has_the_key");
    expect(latest).toBeDefined();
    expect(latest!(args("p1"))).toBe(true);
  });

  it("installed predicates route to live systems via world.getSystem", () => {
    const world = makeWorld({
      quest: {
        getActiveQuests: () => [{ questId: "bandits", status: "in_progress" }],
        hasCompletedQuest: (_p, qid) => qid === "beaten",
      },
      inventory: {
        hasItem: (_p, itemId, qty) => itemId === "key" && qty === 1,
      },
      skills: {
        getSkillData: (_p, skill) =>
          skill === "mining" ? { level: 50 } : undefined,
      },
    });
    const ds = makeDialogueSystem(world);
    installWorldDialogueConditions(ds, world, [
      { name: "has_bandits_quest", kind: "quest-active", questId: "bandits" },
      { name: "beat_bandits", kind: "quest-completed", questId: "beaten" },
      { name: "has_key", kind: "has-item", itemId: "key" },
      {
        name: "mining_40",
        kind: "level-at-least",
        skill: "mining",
        level: 40,
      },
    ]);

    // Reach in through the private registry (same pattern as the
    // DialogueSystem-conditions test suite).
    const evals = (
      ds as unknown as {
        conditionEvaluators: Map<string, (a: DialogueConditionArgs) => boolean>;
      }
    ).conditionEvaluators;

    expect(evals.get("has_bandits_quest")!(args("p1"))).toBe(true);
    expect(evals.get("beat_bandits")!(args("p1"))).toBe(true);
    expect(evals.get("has_key")!(args("p1"))).toBe(true);
    expect(evals.get("mining_40")!(args("p1"))).toBe(true);
  });

  it("picks up systems registered AFTER install (resolves getSystem on each call)", () => {
    const systems: FakeSystems = {};
    const world = makeWorld(systems);
    const ds = makeDialogueSystem(world);
    installWorldDialogueConditions(ds, world, [
      { name: "has_key", kind: "has-item", itemId: "key" },
    ]);

    const evals = (
      ds as unknown as {
        conditionEvaluators: Map<string, (a: DialogueConditionArgs) => boolean>;
      }
    ).conditionEvaluators;

    // Before InventorySystem is registered, evaluator falls through to false.
    expect(evals.get("has_key")!(args("p1"))).toBe(false);

    // Register late.
    systems.inventory = { hasItem: () => true };

    // Same predicate now routes through.
    expect(evals.get("has_key")!(args("p1"))).toBe(true);
  });

  it("rejects empty-name bindings (DialogueSystem contract — empty showIf is reserved)", () => {
    const world = makeWorld({});
    const ds = makeDialogueSystem(world);
    expect(() =>
      installWorldDialogueConditions(ds, world, [
        { name: "", kind: "has-item", itemId: "x" },
      ]),
    ).toThrow(/empty name/);
  });
});

describe("createManagedDialogueConditionInstall", () => {
  function makeDialogueSystem(world: World): DialogueSystem {
    return new DialogueSystem(world);
  }

  it("starts empty with no bindings installed", () => {
    const world = makeWorld({});
    const ds = makeDialogueSystem(world);
    const managed = createManagedDialogueConditionInstall(ds, world);
    expect(managed.getInstalledNames()).toEqual([]);
    expect(ds.getRegisteredConditionNames()).toEqual([]);
  });

  it("replace() installs the new list", () => {
    const world = makeWorld({});
    const ds = makeDialogueSystem(world);
    const managed = createManagedDialogueConditionInstall(ds, world);
    managed.replace([
      { name: "has_key", kind: "has-item", itemId: "key" },
      { name: "mining_40", kind: "level-at-least", skill: "mining", level: 40 },
    ]);
    expect(managed.getInstalledNames()).toEqual(["has_key", "mining_40"]);
    expect(ds.getRegisteredConditionNames()).toEqual(["has_key", "mining_40"]);
  });

  it("replace() unregisters previously-owned names that are not in the new list", () => {
    const world = makeWorld({});
    const ds = makeDialogueSystem(world);
    const managed = createManagedDialogueConditionInstall(ds, world);

    managed.replace([
      { name: "has_key", kind: "has-item", itemId: "key" },
      { name: "mining_40", kind: "level-at-least", skill: "mining", level: 40 },
    ]);

    managed.replace([
      { name: "has_key", kind: "has-item", itemId: "key" },
      // mining_40 dropped; has_gold added
      { name: "has_gold", kind: "has-item", itemId: "gold_key" },
    ]);

    expect(managed.getInstalledNames()).toEqual(["has_gold", "has_key"]);
    expect(ds.getRegisteredConditionNames()).toEqual(["has_gold", "has_key"]);
  });

  it("preserves plugin-registered predicates that the managed install does not own", () => {
    const world = makeWorld({});
    const ds = makeDialogueSystem(world);
    const managed = createManagedDialogueConditionInstall(ds, world);

    // Plugin registers an unrelated predicate directly.
    ds.registerConditionEvaluator("plugin_special", () => true);

    managed.replace([{ name: "has_key", kind: "has-item", itemId: "key" }]);
    expect(ds.getRegisteredConditionNames()).toEqual([
      "has_key",
      "plugin_special",
    ]);

    // Swap managed bindings — plugin one survives.
    managed.replace([
      { name: "mining_40", kind: "level-at-least", skill: "mining", level: 40 },
    ]);
    expect(ds.getRegisteredConditionNames()).toEqual([
      "mining_40",
      "plugin_special",
    ]);

    // Clear managed — plugin one still survives.
    managed.clear();
    expect(ds.getRegisteredConditionNames()).toEqual(["plugin_special"]);
  });

  it("replace([]) is equivalent to clear() — removes every owned name", () => {
    const world = makeWorld({});
    const ds = makeDialogueSystem(world);
    const managed = createManagedDialogueConditionInstall(ds, world);

    managed.replace([
      { name: "has_key", kind: "has-item", itemId: "key" },
      { name: "mining_40", kind: "level-at-least", skill: "mining", level: 40 },
    ]);
    expect(managed.getInstalledNames().length).toBe(2);

    managed.replace([]);
    expect(managed.getInstalledNames()).toEqual([]);
    expect(ds.getRegisteredConditionNames()).toEqual([]);
  });

  it("replace() on a renamed binding removes the old name before installing the new one", () => {
    const world = makeWorld({});
    const ds = makeDialogueSystem(world);
    const managed = createManagedDialogueConditionInstall(ds, world);

    managed.replace([{ name: "old_name", kind: "has-item", itemId: "key" }]);
    expect(ds.getRegisteredConditionNames()).toEqual(["old_name"]);

    managed.replace([{ name: "new_name", kind: "has-item", itemId: "key" }]);
    expect(ds.getRegisteredConditionNames()).toEqual(["new_name"]);
    expect(managed.getInstalledNames()).toEqual(["new_name"]);
  });
});
