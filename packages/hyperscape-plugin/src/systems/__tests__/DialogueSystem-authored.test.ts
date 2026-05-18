/**
 * DialogueSystem authored-surface unit tests.
 *
 * Exercises the authored-dialogue hot-reload surface added in the
 * Phase B3 slice:
 *   - `setAuthoredDialogues` / `setAuthoredDialoguesFromJson`
 *   - NPC → authored-tree binding table + `resolveAuthoredTreeIdForNpc`
 *
 * Constructs a bare `DialogueSystem` against a minimal `World` stub —
 * this exercises the public authored surface only, so no subscriptions
 * need to fire. The heavier end-to-end `updateManifests({ dialogue })`
 * path is covered separately in `PIEEditorSession.test.ts`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import type { DialogueManifest } from "@hyperforge/manifest-schema";

import { DialogueSystem } from "../DialogueSystem";
import type { World } from "../../../../types/index";

function makeWorld(): World {
  return {
    isServer: true,
    entities: new Map(),
    currentTick: 0,
    getSystem: vi.fn(() => null),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as World;
}

const manifest: DialogueManifest = [
  {
    id: "greeter_intro",
    name: "Greeter Intro",
    description: "",
    start: "n1",
    nodes: {
      n1: {
        kind: "line",
        id: "n1",
        speaker: "greeter",
        textKey: "greeter.intro.hello",
        next: "n2",
      },
      n2: { kind: "end", id: "n2" },
    },
  },
  {
    id: "shopkeeper_intro",
    name: "Shopkeeper Intro",
    description: "",
    start: "n1",
    nodes: { n1: { kind: "end", id: "n1" } },
  },
];

describe("DialogueSystem authored surface", () => {
  let system: DialogueSystem;

  beforeEach(() => {
    system = new DialogueSystem(makeWorld());
  });

  describe("setAuthoredDialogues", () => {
    it("loads a manifest and exposes tree ids", () => {
      system.setAuthoredDialogues(manifest);
      expect(system.getAuthoredDialogueIds()).toEqual([
        "greeter_intro",
        "shopkeeper_intro",
      ]);
      expect(system.hasAuthoredDialogue("greeter_intro")).toBe(true);
      expect(system.hasAuthoredDialogue("nonexistent")).toBe(false);
    });

    it("replaces the prior tree set on each call (no merge)", () => {
      system.setAuthoredDialogues(manifest);
      system.setAuthoredDialogues([
        {
          id: "new_tree",
          start: "n1",
          nodes: { n1: { kind: "end", id: "n1" } },
        },
      ]);
      expect(system.getAuthoredDialogueIds()).toEqual(["new_tree"]);
      expect(system.hasAuthoredDialogue("greeter_intro")).toBe(false);
    });

    it("null drops the authored roller entirely", () => {
      system.setAuthoredDialogues(manifest);
      system.setAuthoredDialogues(null);
      expect(system.getAuthoredDialogueIds()).toEqual([]);
    });
  });

  describe("setAuthoredDialoguesFromJson", () => {
    it("validates + loads raw JSON", () => {
      system.setAuthoredDialoguesFromJson(manifest);
      expect(system.hasAuthoredDialogue("greeter_intro")).toBe(true);
    });

    it("rejects invalid JSON with a thrown error", () => {
      expect(() =>
        system.setAuthoredDialoguesFromJson([
          { id: "bad", start: "missing", nodes: {} },
        ]),
      ).toThrow();
    });
  });

  describe("NPC → authored-tree bindings", () => {
    beforeEach(() => {
      system.setAuthoredDialogues(manifest);
    });

    it("setAuthoredNpcDialogueBindings replaces the whole map atomically", () => {
      system.setAuthoredNpcDialogueBindings({
        npc_a: "greeter_intro",
        npc_b: "shopkeeper_intro",
      });
      expect(system.resolveAuthoredTreeIdForNpc("npc_a")).toBe("greeter_intro");
      expect(system.resolveAuthoredTreeIdForNpc("npc_b")).toBe(
        "shopkeeper_intro",
      );

      system.setAuthoredNpcDialogueBindings({ npc_c: "greeter_intro" });
      expect(system.resolveAuthoredTreeIdForNpc("npc_a")).toBeNull();
      expect(system.resolveAuthoredTreeIdForNpc("npc_b")).toBeNull();
      expect(system.resolveAuthoredTreeIdForNpc("npc_c")).toBe("greeter_intro");
    });

    it("setAuthoredNpcDialogueBindings(null) clears the table", () => {
      system.setAuthoredNpcDialogueBindings({
        npc_a: "greeter_intro",
      });
      system.setAuthoredNpcDialogueBindings(null);
      expect(system.resolveAuthoredTreeIdForNpc("npc_a")).toBeNull();
      expect(system.getAuthoredNpcDialogueBindings()).toEqual({});
    });

    it("single-binding setters add/remove one row", () => {
      system.setAuthoredNpcDialogueBinding("npc_a", "greeter_intro");
      expect(system.resolveAuthoredTreeIdForNpc("npc_a")).toBe("greeter_intro");

      system.clearAuthoredNpcDialogueBinding("npc_a");
      expect(system.resolveAuthoredTreeIdForNpc("npc_a")).toBeNull();
    });

    it("resolveAuthoredTreeIdForNpc returns null for stale tree refs", () => {
      system.setAuthoredNpcDialogueBindings({
        npc_a: "greeter_intro",
      });
      expect(system.resolveAuthoredTreeIdForNpc("npc_a")).toBe("greeter_intro");

      // Reload manifest without the referenced tree — binding stays,
      // but resolution returns null so the caller falls back to legacy.
      system.setAuthoredDialogues([
        {
          id: "other_tree",
          start: "n1",
          nodes: { n1: { kind: "end", id: "n1" } },
        },
      ]);
      expect(system.resolveAuthoredTreeIdForNpc("npc_a")).toBeNull();

      // Re-adding the tree makes the binding resolve again without
      // needing to re-push the bindings table.
      system.setAuthoredDialogues(manifest);
      expect(system.resolveAuthoredTreeIdForNpc("npc_a")).toBe("greeter_intro");
    });

    it("getAuthoredNpcDialogueBindings returns a defensive snapshot", () => {
      system.setAuthoredNpcDialogueBindings({
        npc_a: "greeter_intro",
      });
      const snap = system.getAuthoredNpcDialogueBindings();
      snap.npc_a = "tampered";
      // Mutation of the snapshot must not leak back into the system.
      expect(system.resolveAuthoredTreeIdForNpc("npc_a")).toBe("greeter_intro");
    });
  });
});
