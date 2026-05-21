/**
 * applyStreamingTurn — SSE event applicator tests.
 *
 * Phase 1.2 twelfth carve. Pins the dialog's live streaming
 * pipeline: status updates, registry-driven plan dispatch, plus
 * the four bespoke arms (plugins, asset packs, removals, UI
 * pack). Drift here = the right-side plan diverges from server's
 * canonical aggregate at done-time.
 */

import { describe, it, expect, vi } from "vitest";

import {
  createEmptyOnboardingPlan,
  type OnboardingPlan,
} from "../onboardingPlan";
import {
  applyStreamingTurn,
  type StreamTurnEvent,
} from "../applyStreamingTurn";

/**
 * Mini React-state harness — stand-in for the dialog's
 * useState. Mirrors React.Dispatch contract: accepts a value or
 * a (prev) => next updater function.
 */
function makeState<T>(initial: T) {
  let value = initial;
  const set = vi.fn((next: T | ((prev: T) => T)) => {
    value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
  });
  return {
    get value(): T {
      return value;
    },
    set,
  };
}

function turn(partial: Partial<StreamTurnEvent> = {}): StreamTurnEvent {
  return {
    turn: 0,
    assistantText: "",
    toolCalls: [],
    ...partial,
  };
}

describe("applyStreamingTurn — status updates", () => {
  it("surfaces the most-recent tool name as status", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(
      turn({
        toolCalls: [
          { name: "LIST_PLUGINS", success: true, data: {} },
          { name: "GET_PROJECT_STATE", success: true, data: {} },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    // GET_PROJECT_STATE is the most-recent tool call; status
    // surfaces its prettified label.
    expect(status.set).toHaveBeenCalled();
    expect(typeof status.value).toBe("string");
  });

  it("falls back to 'Drafting reply…' when there are no tool calls", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(
      turn({ assistantText: "Some prose" }),
      plan.set,
      status.set,
      [],
    );
    expect(status.value).toBe("Drafting reply…");
  });

  it("doesn't update status when toolCalls and assistantText are both empty", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(turn(), plan.set, status.set, []);
    expect(status.set).not.toHaveBeenCalled();
  });
});

describe("applyStreamingTurn — PROPOSE_PLUGIN_SET (registry-driven)", () => {
  // Note: PROPOSE_PLUGIN_SET is in proposeActionRegistry (singleton,
  // dataKey=pluginIds), so the registry path takes over and the
  // dialog's bespoke string-filter arm is dead code. The test
  // pins current behavior — registry assigns the value verbatim.

  it("assigns pluginIds via the registry singleton path", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "PROPOSE_PLUGIN_SET",
            success: true,
            data: { pluginIds: ["combat", "skills"] },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.pluginIds).toEqual(["combat", "skills"]);
  });

  it("skips when data.pluginIds is absent (registry undefined-guard)", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(
      turn({
        toolCalls: [
          { name: "PROPOSE_PLUGIN_SET", success: true, data: { other: 1 } },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.pluginIds).toBe(null);
  });
});

describe("applyStreamingTurn — PROPOSE_ASSET_PACK_INSTALL", () => {
  it("merges incoming pack ids additively", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>({
      ...createEmptyOnboardingPlan(),
      assetPackIds: ["@hyperforge/asset-pack-a"],
    });
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "PROPOSE_ASSET_PACK_INSTALL",
            success: true,
            data: { assetPackIds: ["@hyperforge/asset-pack-b"] },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.assetPackIds?.sort()).toEqual([
      "@hyperforge/asset-pack-a",
      "@hyperforge/asset-pack-b",
    ]);
  });

  it("deduplicates pack ids across the merge", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>({
      ...createEmptyOnboardingPlan(),
      assetPackIds: ["@hyperforge/asset-pack-a"],
    });
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "PROPOSE_ASSET_PACK_INSTALL",
            success: true,
            data: { assetPackIds: ["@hyperforge/asset-pack-a"] },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.assetPackIds).toEqual(["@hyperforge/asset-pack-a"]);
  });

  it("starts a fresh array when prior assetPackIds is null", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "PROPOSE_ASSET_PACK_INSTALL",
            success: true,
            data: { assetPackIds: ["@hyperforge/asset-pack-a"] },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.assetPackIds).toEqual(["@hyperforge/asset-pack-a"]);
  });
});

describe("applyStreamingTurn — REMOVE_FROM_PROJECT", () => {
  it("removes an NPC by id", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>({
      ...createEmptyOnboardingPlan(),
      npcs: [{ id: "shop" }, { id: "guard" }],
    });
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "REMOVE_FROM_PROJECT",
            success: true,
            data: { removal: { kind: "npc", id: "guard" } },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.npcs).toEqual([{ id: "shop" }]);
  });

  it("removes a quest by id", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>({
      ...createEmptyOnboardingPlan(),
      quests: [{ id: "q1" }, { id: "q2" }],
    });
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "REMOVE_FROM_PROJECT",
            success: true,
            data: { removal: { kind: "quest", id: "q1" } },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.quests).toEqual([{ id: "q2" }]);
  });

  it("removes a mob spawn by mobId + position match", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>({
      ...createEmptyOnboardingPlan(),
      mobSpawns: [
        { mobId: "goblin", position: { x: 0, y: 0, z: 0 } },
        { mobId: "goblin", position: { x: 10, y: 0, z: 10 } },
      ],
    });
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "REMOVE_FROM_PROJECT",
            success: true,
            data: {
              removal: {
                kind: "mobSpawn",
                mobId: "goblin",
                position: { x: 10, y: 0, z: 10 },
              },
            },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.mobSpawns).toHaveLength(1);
    expect(
      (plan.value.mobSpawns[0] as { position: { x: number } }).position.x,
    ).toBe(0);
  });

  it("leaves plan untouched for unknown removal kinds", () => {
    const status = makeState<string | null>(null);
    const original = { ...createEmptyOnboardingPlan(), npcs: [{ id: "shop" }] };
    const plan = makeState<OnboardingPlan>(original);
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "REMOVE_FROM_PROJECT",
            success: true,
            data: { removal: { kind: "mystery", id: "shop" } },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.npcs).toEqual([{ id: "shop" }]);
  });
});

describe("applyStreamingTurn — PROPOSE_UI_PACK", () => {
  it("sets uiPack to the proposed pack", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "PROPOSE_UI_PACK",
            success: true,
            data: { pack: { id: "hud-1" } },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.uiPack).toEqual({ id: "hud-1" });
  });

  it("skips when data.pack is undefined", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(
      turn({
        toolCalls: [{ name: "PROPOSE_UI_PACK", success: true, data: {} }],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.uiPack).toBe(null);
  });
});

describe("applyStreamingTurn — call gating", () => {
  it("ignores failed tool calls", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(
      turn({
        toolCalls: [
          {
            name: "PROPOSE_PLUGIN_SET",
            success: false,
            data: { pluginIds: ["combat"] },
          },
        ],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.pluginIds).toBe(null);
  });

  it("ignores tool calls with empty data", () => {
    const status = makeState<string | null>(null);
    const plan = makeState<OnboardingPlan>(createEmptyOnboardingPlan());
    applyStreamingTurn(
      turn({
        toolCalls: [{ name: "PROPOSE_PLUGIN_SET", success: true, data: null }],
      }),
      plan.set,
      status.set,
      [],
    );
    expect(plan.value.pluginIds).toBe(null);
  });
});
