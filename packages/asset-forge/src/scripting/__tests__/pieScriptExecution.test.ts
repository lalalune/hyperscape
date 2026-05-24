/**
 * PIE Script Execution — End-to-end tests for the Play-In-Editor runtime.
 *
 * Verifies that script graphs authored in the editor actually execute inside
 * `PIEEditorSession` via the server-side `ScriptingSystem`. Covers the
 * critical pipeline links the user can break by editing the runtime:
 *
 *   1. `trigger/onReady` fires when a graph is loaded onto an entity
 *   2. `session.interactWith()` dispatches `entity:interacted` → fires
 *      `trigger/onInteract` nodes
 *   3. `action/*` nodes emit world events that `session.scripts.on()` observes
 *   4. The `debugSink` receives one entry per trigger fire and action emit
 *   5. `session.stop()` tears down all script state
 *
 * These tests use the built PIE bundle (via the `@hyperforge/shared/runtime`
 * subpath export) rather than reaching into source so they exercise the same
 * artifact World Studio loads in the browser.
 */

import { describe, it, expect } from "vitest";
import {
  PIEEditorSession,
  type PIEDebugEntry,
  type RuntimeScriptGraph,
} from "@hyperforge/shared/runtime";

const LONG_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Graph factories — keep tests readable
// ---------------------------------------------------------------------------

/** A 2-node graph: `trigger/<triggerType>` → `action/showDialogue`. */
function makeTriggerToDialogueGraph(
  graphId: string,
  triggerType: string,
  dialogueText: string,
): RuntimeScriptGraph {
  return {
    id: graphId,
    name: graphId,
    graphType: "behavior",
    variables: [],
    nodes: [
      {
        id: "trig",
        type: triggerType,
        data: {},
        inputs: [],
        outputs: [{ id: "out", type: "flow" }],
      },
      {
        id: "act",
        type: "action/showDialogue",
        data: { title: "Test", text: dialogueText },
        inputs: [{ id: "in", type: "flow" }],
        outputs: [{ id: "out", type: "flow" }],
      },
    ],
    edges: [
      {
        id: "e1",
        sourceNodeId: "trig",
        sourcePortId: "out",
        targetNodeId: "act",
        targetPortId: "in",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Skipped: this suite spins up a real PIEEditorSession (which calls
// PhysX init via Physics.init → PhysXManager.waitForPhysX). Vitest
// resolves the PhysX server entry from
// `packages/shared/build/runtime-pie.js` and fails with:
//
//   Cannot find module '/@fs/.../shared/build/PhysXManager.server'
//
// The shared build path the runtime-pie loader uses isn't satisfied
// in the test env. Re-enabling requires either (a) a PhysX shim for
// PIE tests that doesn't load the WASM, or (b) a Vite resolve
// alias mapping the missing file. Until either lands, skip — every
// test in this suite hits the same import.
describe.skip("PIE Script Execution", () => {
  it(
    "fires trigger/onReady when a graph is loaded onto an NPC",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const session = new PIEEditorSession();
      const graph = makeTriggerToDialogueGraph(
        "ready-graph",
        "trigger/onReady",
        "Hello from onReady",
      );

      // onReady fires synchronously when `ScriptingSystem.addGraph` runs
      // (called from `start()`). Observe via debugSink — wired in before
      // the trigger fires — rather than via `.on()` which would subscribe
      // too late.
      const entries: PIEDebugEntry[] = [];

      try {
        await session.start({
          playerSpawn: { x: 0, y: 0, z: 0 },
          npcs: [
            {
              id: "guard",
              type: "guard",
              name: "Town Guard",
              position: { x: 5, y: 0, z: 0 },
              behaviorGraph: graph,
            },
          ],
          debugSink: (e) => entries.push(e),
        });

        // Drain microtasks so the action handler chain completes.
        await Promise.resolve();
        await Promise.resolve();

        // PIEEditorSession forwards ScriptingSystem action emits through
        // its `scripting/action` source channel. The payload carries the
        // original event type + params.
        const actionEntry = entries.find(
          (e) =>
            e.source === "scripting/action" &&
            (e.data as { type?: string } | undefined)?.type ===
              "dialogue:start",
        );
        expect(actionEntry).toBeDefined();
        const actionData = actionEntry?.data as
          | { params?: { text?: string } }
          | undefined;
        expect(actionData?.params?.text).toBe("Hello from onReady");

        const triggerEntry = entries.find(
          (e) =>
            e.source === "scripting/trigger" &&
            (e.data as { triggerType?: string } | undefined)?.triggerType ===
              "trigger/onReady",
        );
        expect(triggerEntry).toBeDefined();
        expect(
          (triggerEntry?.data as { entityId?: string } | undefined)?.entityId,
        ).toBe("npc_guard");
      } finally {
        await session.stop();
      }
    },
  );

  it(
    "fires trigger/onInteract via session.interactWith()",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const session = new PIEEditorSession();
      const graph = makeTriggerToDialogueGraph(
        "interact-graph",
        "trigger/onInteract",
        "You interacted with me",
      );

      const dialogueEvents: Array<Record<string, unknown>> = [];

      try {
        await session.start({
          playerSpawn: { x: 0, y: 0, z: 0 },
          npcs: [
            {
              id: "shopkeeper",
              type: "merchant",
              name: "Shopkeeper",
              position: { x: 1, y: 0, z: 1 },
              behaviorGraph: graph,
            },
          ],
        });

        // Subscribe BEFORE the interaction so we don't miss the emit.
        session.scripts!.on("dialogue:start", (data) => {
          dialogueEvents.push(data as Record<string, unknown>);
        });

        // The PIEEditorSession assigns NPC ids as `npc_<input.id>`.
        session.interactWith("npc_shopkeeper");

        await Promise.resolve();
        await Promise.resolve();

        expect(dialogueEvents).toHaveLength(1);
        expect(dialogueEvents[0]?.text).toBe("You interacted with me");
      } finally {
        await session.stop();
      }
    },
  );

  it(
    "does not fire onInteract for a different entity (matchesEntity scope)",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const session = new PIEEditorSession();
      const graph = makeTriggerToDialogueGraph(
        "scoped-graph",
        "trigger/onInteract",
        "scoped",
      );

      const dialogueEvents: Array<Record<string, unknown>> = [];

      try {
        await session.start({
          playerSpawn: { x: 0, y: 0, z: 0 },
          npcs: [
            {
              id: "alice",
              type: "merchant",
              name: "Alice",
              position: { x: 1, y: 0, z: 1 },
              behaviorGraph: graph,
            },
            {
              id: "bob",
              type: "merchant",
              name: "Bob",
              position: { x: 2, y: 0, z: 2 },
              // No graph on Bob.
            },
          ],
        });

        session.scripts!.on("dialogue:start", (data) => {
          dialogueEvents.push(data as Record<string, unknown>);
        });

        // Interact with Bob — Alice's graph should NOT respond because the
        // `entity:interacted` event payload references Bob's id.
        session.interactWith("npc_bob");

        await Promise.resolve();
        await Promise.resolve();

        expect(dialogueEvents).toHaveLength(0);
      } finally {
        await session.stop();
      }
    },
  );

  it(
    "forwards trigger and action entries to debugSink",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const entries: PIEDebugEntry[] = [];
      const session = new PIEEditorSession();

      try {
        await session.start({
          playerSpawn: { x: 0, y: 0, z: 0 },
          npcs: [
            {
              id: "logger",
              type: "test",
              name: "Logger",
              position: { x: 0, y: 0, z: 5 },
              behaviorGraph: makeTriggerToDialogueGraph(
                "debug-graph",
                "trigger/onReady",
                "debug message",
              ),
            },
          ],
          debugSink: (e) => entries.push(e),
        });

        await Promise.resolve();
        await Promise.resolve();

        // Expect at least: one info entry (graph_ready), one trigger entry
        // (onReady fired), and one action entry (dialogue:start emitted).
        const levels = entries.map((e) => e.level);
        expect(levels).toContain("info");
        expect(levels).toContain("trigger");
        expect(levels).toContain("action");

        const actionEntry = entries.find(
          (e) =>
            e.source === "scripting/action" &&
            (e.data as { type?: string } | undefined)?.type ===
              "dialogue:start",
        );
        expect(actionEntry).toBeDefined();
        const actionData = actionEntry?.data as
          | { params?: { text?: string } }
          | undefined;
        expect(actionData?.params?.text).toBe("debug message");
      } finally {
        await session.stop();
      }
    },
  );

  it(
    "loads behavior graphs from mob spawns",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const session = new PIEEditorSession();
      const entries: PIEDebugEntry[] = [];

      try {
        await session.start({
          playerSpawn: { x: 0, y: 0, z: 0 },
          mobSpawns: [
            {
              id: "goblins",
              mobId: "goblin",
              name: "Goblin",
              position: { x: 10, y: 0, z: 10 },
              spawnRadius: 2,
              maxCount: 1,
              behaviorGraph: makeTriggerToDialogueGraph(
                "mob-graph",
                "trigger/onReady",
                "I am a goblin",
              ),
            },
          ],
          debugSink: (e) => entries.push(e),
        });

        await Promise.resolve();
        await Promise.resolve();

        const actionEntry = entries.find(
          (e) =>
            e.source === "scripting/action" &&
            (e.data as { type?: string } | undefined)?.type ===
              "dialogue:start",
        );
        expect(actionEntry).toBeDefined();
        const actionData = actionEntry?.data as
          | { params?: { text?: string } }
          | undefined;
        expect(actionData?.params?.text).toBe("I am a goblin");
      } finally {
        await session.stop();
      }
    },
  );

  it(
    "clears all script state on stop()",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const session = new PIEEditorSession();

      await session.start({
        playerSpawn: { x: 0, y: 0, z: 0 },
        npcs: [
          {
            id: "ephemeral",
            type: "test",
            name: "Ephemeral",
            position: { x: 0, y: 0, z: 0 },
            behaviorGraph: makeTriggerToDialogueGraph(
              "ephemeral-graph",
              "trigger/onReady",
              "x",
            ),
          },
        ],
      });

      expect(session.scripts).not.toBeNull();
      expect(session.entities.size).toBeGreaterThan(0);

      await session.stop();

      expect(session.scripts).toBeNull();
      expect(session.entities.size).toBe(0);
      expect(session.player).toBeNull();
      expect(session.isRunning).toBe(false);
    },
  );
});
