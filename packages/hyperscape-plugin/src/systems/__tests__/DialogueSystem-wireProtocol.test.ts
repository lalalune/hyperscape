/**
 * Tests for DialogueSystem's authored wire-protocol translator — the
 * bridge that turns authored `DialoguePresentation` values (from
 * `DialogueRegistry`) into the legacy `DIALOGUE_START` /
 * `DIALOGUE_NODE_CHANGE` / `DIALOGUE_END` event shape that the existing
 * client + EventBridge already understand.
 *
 * These tests bypass `SystemBase.init()` (which wants a real EventBus
 * with subscribe() semantics) and instead call the translator methods
 * via `(system as unknown as …)` test access. Emissions land on a
 * mocked `$eventBus.emitEvent` capture so we can assert the full wire
 * shape without booting a world.
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
    // SystemBase reads `world.$eventBus` in its constructor. Supply
    // just the surface `emitTypedEvent` touches.
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

// A minimal but functionally complete manifest exercising the three
// presentation shapes (line → choice → end) and a self-referential
// choice so tests can force a second pickChoice round-trip.
const manifest: DialogueManifest = [
  {
    id: "wire_line",
    name: "Line then end",
    description: "",
    start: "ln1",
    nodes: {
      ln1: {
        kind: "line",
        id: "ln1",
        speaker: "npc",
        textKey: "wire.line.hello",
        next: "done",
      },
      done: { kind: "end", id: "done" },
    },
  },
  {
    id: "wire_line_to_choice",
    name: "Line then choice",
    description: "",
    start: "ln1",
    nodes: {
      ln1: {
        kind: "line",
        id: "ln1",
        speaker: "npc",
        textKey: "wire.line.greeting",
        next: "cn1",
      },
      cn1: {
        kind: "choice",
        id: "cn1",
        promptKey: "wire.prompt",
        options: [
          { textKey: "wire.opt.only", action: "", showIf: "", next: "done" },
        ],
      },
      done: { kind: "end", id: "done" },
    },
  },
  {
    id: "wire_choice",
    name: "Choice then end",
    description: "",
    start: "cn1",
    nodes: {
      cn1: {
        kind: "choice",
        id: "cn1",
        promptKey: "wire.prompt",
        options: [
          {
            textKey: "wire.opt.yes",
            action: "",
            showIf: "",
            next: "done",
          },
          {
            textKey: "wire.opt.no",
            action: "wire.record.no",
            showIf: "",
            next: "done",
          },
        ],
      },
      done: { kind: "end", id: "done" },
    },
  },
];

// Typed accessor to the private authored-path helpers. Avoids peppering
// `as any` throughout the file while still keeping the production API
// surface small.
type PrivateSurface = {
  startAuthoredDialogue(
    playerId: string,
    npcId: string,
    npcName: string,
    treeId: string,
    npcEntityId: string | undefined,
  ): void;
  handleAuthoredDialogueResponse(playerId: string, responseIndex: number): void;
  handleAuthoredDialogueContinue(playerId: string): void;
  authoredSessions: Map<string, unknown>;
};

describe("DialogueSystem wire-protocol translator", () => {
  let system: DialogueSystem;
  let received: EmitCall[];
  let priv: PrivateSurface;

  beforeEach(() => {
    received = [];
    system = new DialogueSystem(makeWorld(received));
    system.setAuthoredDialogues(manifest);
    priv = system as unknown as PrivateSurface;
  });

  describe("startAuthoredDialogue — line", () => {
    it("emits DIALOGUE_START with textKey as `text` and empty responses", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_a",
        "Greeter",
        "wire_line",
        undefined,
      );

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe(EventType.DIALOGUE_START);
      expect(received[0].data).toMatchObject({
        playerId: "player1",
        npcId: "npc_a",
        npcName: "Greeter",
        text: "wire.line.hello",
        responses: [],
      });
      // Line-kind `nodeId` prefix is a deterministic, collision-resistant
      // synthetic id ("line:<textKey>"). The client doesn't interpret
      // it — only echoes it back on effect events.
      expect(received[0].data.nodeId).toBe("line:wire.line.hello");
    });

    it("threads npcEntityId into the payload when provided", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_a",
        "Greeter",
        "wire_line",
        "entity_42",
      );

      expect(received[0].data.npcEntityId).toBe("entity_42");
    });

    it("omits npcEntityId when not supplied", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_a",
        "Greeter",
        "wire_line",
        undefined,
      );
      expect("npcEntityId" in received[0].data).toBe(false);
    });

    it("tracks the session so subsequent events can route back", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_a",
        "Greeter",
        "wire_line",
        undefined,
      );
      expect(priv.authoredSessions.has("player1")).toBe(true);
    });
  });

  describe("startAuthoredDialogue — choice", () => {
    it("emits DIALOGUE_START with responses carrying action+textKey", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_b",
        "Shopkeeper",
        "wire_choice",
        undefined,
      );

      expect(received).toHaveLength(1);
      const payload = received[0].data as {
        responses: Array<{ text: string; nextNodeId: string; effect?: string }>;
      };
      expect(payload.responses).toHaveLength(2);
      expect(payload.responses[0]).toMatchObject({
        text: "wire.opt.yes",
        nextNodeId: "choice:0",
      });
      // Empty-string action becomes undefined on the wire.
      expect(payload.responses[0].effect).toBeUndefined();
      expect(payload.responses[1]).toMatchObject({
        text: "wire.opt.no",
        nextNodeId: "choice:1",
        effect: "wire.record.no",
      });
    });
  });

  describe("handleAuthoredDialogueResponse", () => {
    it("advances via pickChoice and emits DIALOGUE_END when presentation becomes end", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_b",
        "Shopkeeper",
        "wire_choice",
        undefined,
      );
      received.length = 0; // drop the opening event

      priv.handleAuthoredDialogueResponse("player1", 0);

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe(EventType.DIALOGUE_END);
      expect(received[0].data).toMatchObject({
        playerId: "player1",
        npcId: "npc_b",
      });
      // Session must be cleared on end.
      expect(priv.authoredSessions.has("player1")).toBe(false);
    });

    it("ends the session gracefully on illegal response index", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_b",
        "Shopkeeper",
        "wire_choice",
        undefined,
      );
      received.length = 0;

      // 99 is out of bounds for a 2-option choice.
      priv.handleAuthoredDialogueResponse("player1", 99);

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe(EventType.DIALOGUE_END);
      expect(priv.authoredSessions.has("player1")).toBe(false);
    });

    it("is a no-op when no session exists for the player", () => {
      priv.handleAuthoredDialogueResponse("ghost_player", 0);
      expect(received).toHaveLength(0);
    });
  });

  describe("handleAuthoredDialogueContinue", () => {
    it("advances a line presentation and emits DIALOGUE_END at end-node", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_a",
        "Greeter",
        "wire_line",
        undefined,
      );
      received.length = 0; // drop opening DIALOGUE_START

      priv.handleAuthoredDialogueContinue("player1");

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe(EventType.DIALOGUE_END);
      expect(priv.authoredSessions.has("player1")).toBe(false);
    });

    it("is a no-op when no session exists", () => {
      priv.handleAuthoredDialogueContinue("ghost_player");
      expect(received).toHaveLength(0);
    });

    it("emits DIALOGUE_NODE_CHANGE with choice responses when line advances to a choice", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_a",
        "Greeter",
        "wire_line_to_choice",
        undefined,
      );
      received.length = 0;

      priv.handleAuthoredDialogueContinue("player1");

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe(EventType.DIALOGUE_NODE_CHANGE);
      const payload = received[0].data as {
        responses: Array<{ text: string; nextNodeId: string }>;
        text: string;
      };
      expect(payload.text).toBe("wire.prompt");
      expect(payload.responses).toHaveLength(1);
      expect(payload.responses[0]).toMatchObject({
        text: "wire.opt.only",
        nextNodeId: "choice:0",
      });
      // Session must still be open — we're on a visible choice, not end.
      expect(priv.authoredSessions.has("player1")).toBe(true);
    });
  });

  describe("startAuthoredDialogue — session churn", () => {
    it("replaces a stale session for the same player without throwing", () => {
      priv.startAuthoredDialogue(
        "player1",
        "npc_a",
        "Greeter",
        "wire_line",
        undefined,
      );
      // Open a second session for the same player — must not throw
      // DuplicateDialogueSessionError.
      priv.startAuthoredDialogue(
        "player1",
        "npc_b",
        "Shopkeeper",
        "wire_choice",
        undefined,
      );

      expect(priv.authoredSessions.has("player1")).toBe(true);
      // Last emitted event should be the new session's opener.
      expect(received[received.length - 1].data).toMatchObject({
        npcId: "npc_b",
      });
    });
  });
});
