/**
 * Tests for DialogueSystem's authored condition-evaluator registry.
 *
 * `showIf` and branch `condition` names are free-form identifiers; the
 * runner calls `ctx.evaluateCondition(name)` on each one. DialogueSystem
 * owns a registry of `name → predicate` mappings:
 *
 *   - Registered predicates run with `{ playerId, npcId, npcEntityId? }`.
 *   - Unknown names default to `false` (safe — hides gated choices).
 *   - Thrown predicates default to `false` (plugin isolation).
 *
 * These tests exercise the registry through the private
 * `startAuthoredDialogue` surface on a minimally mocked world.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

import type { DialogueManifest } from "@hyperforge/manifest-schema";

import { DialogueSystem } from "../DialogueSystem";
import { EventType } from "@hyperforge/shared";
import type { World } from "../../../../types/index";

interface EmitCall {
  type: string;
  data: Record<string, unknown>;
}

function makeWorld(received: EmitCall[]): World {
  return {
    isServer: true,
    entities: new Map(),
    currentTick: 0,
    getSystem: vi.fn(() => null),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    $eventBus: {
      emitEvent: vi.fn((type: string, data: Record<string, unknown>) => {
        received.push({ type, data });
      }),
      subscribe: vi.fn(),
      subscribeOnce: vi.fn(),
      unsubscribe: vi.fn(),
    },
  } as unknown as World;
}

// Tree with two gated options — one always-visible, two behind
// different named predicates — so we can probe the registry.
const manifest: DialogueManifest = [
  {
    id: "gated_choice",
    name: "Gated Choice",
    description: "",
    start: "cn1",
    nodes: {
      cn1: {
        kind: "choice",
        id: "cn1",
        promptKey: "gate.prompt",
        options: [
          {
            textKey: "gate.always",
            action: "",
            showIf: "",
            next: "done",
          },
          {
            textKey: "gate.hasQuest",
            action: "",
            showIf: "player_has_quest_x",
            next: "done",
          },
          {
            textKey: "gate.highLevel",
            action: "",
            showIf: "player_level_over_30",
            next: "done",
          },
        ],
      },
      done: { kind: "end", id: "done" },
    },
  },
];

type PrivateSurface = {
  startAuthoredDialogue(
    playerId: string,
    npcId: string,
    npcName: string,
    treeId: string,
    npcEntityId: string | undefined,
  ): void;
};

describe("DialogueSystem condition-evaluator registry", () => {
  let system: DialogueSystem;
  let received: EmitCall[];
  let priv: PrivateSurface;

  beforeEach(() => {
    received = [];
    system = new DialogueSystem(makeWorld(received));
    system.setAuthoredDialogues(manifest);
    priv = system as unknown as PrivateSurface;
  });

  describe("no predicates registered (default)", () => {
    it("hides every gated option (unknown-name → false)", () => {
      priv.startAuthoredDialogue(
        "p1",
        "npc",
        "Gatekeeper",
        "gated_choice",
        undefined,
      );

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe(EventType.DIALOGUE_START);
      const data = received[0].data as {
        responses: Array<{ text: string }>;
      };
      // Only the empty-showIf option survives.
      expect(data.responses).toHaveLength(1);
      expect(data.responses[0].text).toBe("gate.always");
    });
  });

  describe("predicates registered", () => {
    it("exposes gated options when their predicate returns true", () => {
      system.registerConditionEvaluator("player_has_quest_x", () => true);
      system.registerConditionEvaluator("player_level_over_30", () => false);

      priv.startAuthoredDialogue(
        "p1",
        "npc",
        "Gatekeeper",
        "gated_choice",
        undefined,
      );
      const data = received[0].data as {
        responses: Array<{ text: string }>;
      };
      expect(data.responses.map((r) => r.text)).toEqual([
        "gate.always",
        "gate.hasQuest",
      ]);
    });

    it("passes playerId / npcId / npcEntityId to the predicate", () => {
      const capture: Array<{
        playerId: string;
        npcId: string;
        npcEntityId?: string;
      }> = [];
      system.registerConditionEvaluator("player_has_quest_x", (args) => {
        capture.push({
          playerId: args.playerId,
          npcId: args.npcId,
          npcEntityId: args.npcEntityId,
        });
        return false;
      });

      priv.startAuthoredDialogue(
        "player_42",
        "npc_a",
        "X",
        "gated_choice",
        "entity_99",
      );

      expect(capture).toHaveLength(1);
      expect(capture[0]).toEqual({
        playerId: "player_42",
        npcId: "npc_a",
        npcEntityId: "entity_99",
      });
    });

    it("last-write-wins on duplicate registration", () => {
      system.registerConditionEvaluator("player_has_quest_x", () => false);
      system.registerConditionEvaluator("player_has_quest_x", () => true);

      priv.startAuthoredDialogue("p1", "npc", "X", "gated_choice", undefined);
      const data = received[0].data as {
        responses: Array<{ text: string }>;
      };
      expect(data.responses.map((r) => r.text)).toContain("gate.hasQuest");
    });

    it("unregisterConditionEvaluator drops a single name", () => {
      system.registerConditionEvaluator("player_has_quest_x", () => true);
      system.registerConditionEvaluator("player_level_over_30", () => true);
      system.unregisterConditionEvaluator("player_has_quest_x");

      priv.startAuthoredDialogue("p1", "npc", "X", "gated_choice", undefined);
      const data = received[0].data as {
        responses: Array<{ text: string }>;
      };
      // quest dropped → hidden; level still true → visible.
      expect(data.responses.map((r) => r.text)).toEqual([
        "gate.always",
        "gate.highLevel",
      ]);
    });

    it("clearConditionEvaluators drops every registration", () => {
      system.registerConditionEvaluator("player_has_quest_x", () => true);
      system.registerConditionEvaluator("player_level_over_30", () => true);
      system.clearConditionEvaluators();

      priv.startAuthoredDialogue("p1", "npc", "X", "gated_choice", undefined);
      const data = received[0].data as {
        responses: Array<{ text: string }>;
      };
      expect(data.responses.map((r) => r.text)).toEqual(["gate.always"]);
    });

    it("getRegisteredConditionNames returns a sorted snapshot", () => {
      system.registerConditionEvaluator("z_last", () => true);
      system.registerConditionEvaluator("a_first", () => true);
      system.registerConditionEvaluator("m_middle", () => true);

      expect(system.getRegisteredConditionNames()).toEqual([
        "a_first",
        "m_middle",
        "z_last",
      ]);
    });
  });

  describe("plugin isolation", () => {
    it("treats a throwing predicate as false (does not crash dialogue)", () => {
      system.registerConditionEvaluator("player_has_quest_x", () => {
        throw new Error("plugin-side boom");
      });
      system.registerConditionEvaluator("player_level_over_30", () => true);

      priv.startAuthoredDialogue("p1", "npc", "X", "gated_choice", undefined);

      expect(received).toHaveLength(1);
      const data = received[0].data as {
        responses: Array<{ text: string }>;
      };
      // Throwing predicate hides its option; the non-throwing one stays.
      expect(data.responses.map((r) => r.text)).toEqual([
        "gate.always",
        "gate.highLevel",
      ]);
    });
  });

  describe("input validation", () => {
    it("rejects empty predicate name (empty showIf means always-visible)", () => {
      expect(() =>
        system.registerConditionEvaluator("", () => true),
      ).toThrowError(/empty name is reserved/);
    });
  });
});
