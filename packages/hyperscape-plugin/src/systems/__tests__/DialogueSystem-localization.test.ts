/**
 * Tests for DialogueSystem's optional localization resolution.
 *
 * When a `LocalizationCatalog` is attached via `setLocalizationCatalog`,
 * authored-path `textKey` strings are resolved through the catalog
 * before being emitted as `text` on DIALOGUE_START / DIALOGUE_NODE_CHANGE.
 *
 * When no catalog is attached (default), the raw textKey is echoed —
 * preserving the editor-loop behavior for unlocalized trees.
 *
 * These tests mirror the private-surface access pattern used in
 * `DialogueSystem-wireProtocol.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

import type { DialogueManifest } from "@hyperforge/manifest-schema";

import { DialogueSystem } from "../DialogueSystem";
import { EventType } from "@hyperforge/shared";
import type { World } from "../../../../types/index";
import { LocalizationCatalog } from "@hyperforge/shared";

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

const manifest: DialogueManifest = [
  {
    id: "loc_line",
    name: "Line",
    description: "",
    start: "ln1",
    nodes: {
      ln1: {
        kind: "line",
        id: "ln1",
        speaker: "npc",
        textKey: "dialogue.greet",
        next: "done",
      },
      done: { kind: "end", id: "done" },
    },
  },
  {
    id: "loc_choice",
    name: "Choice",
    description: "",
    start: "cn1",
    nodes: {
      cn1: {
        kind: "choice",
        id: "cn1",
        promptKey: "dialogue.prompt",
        options: [
          {
            textKey: "dialogue.opt.yes",
            action: "",
            showIf: "",
            next: "done",
          },
          {
            // No catalog entry for this key — should fall back to raw key.
            textKey: "dialogue.opt.missing",
            action: "",
            showIf: "",
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
  authoredSessions: Map<string, unknown>;
};

function makeCatalog(): LocalizationCatalog {
  const catalog = new LocalizationCatalog();
  catalog.loadManifests([
    {
      locale: "en",
      strings: {
        "dialogue.greet": "Hello, traveler.",
        "dialogue.prompt": "What do you want?",
        "dialogue.opt.yes": "Yes.",
      },
    },
  ]);
  return catalog;
}

describe("DialogueSystem localization resolution", () => {
  let system: DialogueSystem;
  let received: EmitCall[];
  let priv: PrivateSurface;

  beforeEach(() => {
    received = [];
    system = new DialogueSystem(makeWorld(received));
    system.setAuthoredDialogues(manifest);
    priv = system as unknown as PrivateSurface;
  });

  describe("no catalog attached (default)", () => {
    it("emits raw textKey as text for line presentations", () => {
      priv.startAuthoredDialogue("p1", "npc", "Greeter", "loc_line", undefined);
      expect(received[0].data.text).toBe("dialogue.greet");
    });

    it("emits raw textKey as text for choice prompts and options", () => {
      priv.startAuthoredDialogue(
        "p1",
        "npc",
        "Shopkeeper",
        "loc_choice",
        undefined,
      );
      const data = received[0].data as {
        text: string;
        responses: Array<{ text: string }>;
      };
      expect(data.text).toBe("dialogue.prompt");
      expect(data.responses[0].text).toBe("dialogue.opt.yes");
      expect(data.responses[1].text).toBe("dialogue.opt.missing");
    });
  });

  describe("with catalog attached", () => {
    beforeEach(() => {
      system.setLocalizationCatalog(makeCatalog());
    });

    it("resolves line textKey through catalog to display string", () => {
      priv.startAuthoredDialogue("p1", "npc", "Greeter", "loc_line", undefined);
      expect(received[0].data.text).toBe("Hello, traveler.");
      // nodeId still encodes the raw textKey — the client echoes it
      // back on effect events; the server doesn't rely on the label.
      expect(received[0].data.nodeId).toBe("line:dialogue.greet");
    });

    it("resolves choice prompt and option textKeys, falling back to raw on miss", () => {
      priv.startAuthoredDialogue(
        "p1",
        "npc",
        "Shopkeeper",
        "loc_choice",
        undefined,
      );
      const data = received[0].data as {
        text: string;
        responses: Array<{ text: string }>;
      };
      expect(data.text).toBe("What do you want?");
      expect(data.responses[0].text).toBe("Yes.");
      // Missing key falls through to raw textKey — permissive on
      // purpose so partial translations never break the dialogue loop.
      expect(data.responses[1].text).toBe("dialogue.opt.missing");
    });
  });

  describe("detaching the catalog", () => {
    it("reverts to raw textKey when catalog is set then cleared", () => {
      system.setLocalizationCatalog(makeCatalog());
      priv.startAuthoredDialogue("p1", "npc", "Greeter", "loc_line", undefined);
      expect(received[0].data.text).toBe("Hello, traveler.");

      received.length = 0;
      system.setLocalizationCatalog(null);

      // Open a new session on the same system — should now echo the raw key.
      priv.startAuthoredDialogue("p2", "npc", "Greeter", "loc_line", undefined);
      expect(received[0].data.text).toBe("dialogue.greet");
    });
  });

  describe("wire-shape invariants survive catalog attachment", () => {
    it("does not rename nodeId / responses / DIALOGUE_START type", () => {
      system.setLocalizationCatalog(makeCatalog());
      priv.startAuthoredDialogue("p1", "npc", "Greeter", "loc_line", undefined);
      expect(received).toHaveLength(1);
      expect(received[0].type).toBe(EventType.DIALOGUE_START);
      expect(received[0].data.nodeId).toBe("line:dialogue.greet");
      expect(received[0].data.responses).toEqual([]);
    });
  });
});
