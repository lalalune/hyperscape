/**
 * PIEEditorSession lifecycle + editor-visible entity map.
 *
 * Slice 1 + 2 scope: `start()` boots the server+client loopback, seeds
 * the player entity, and mirrors manifest `mobSpawns / npcs / resources
 * / stations` into the editor-visible `entities` map. `tick()` forwards
 * time to the server session. `stop()` tears everything down cleanly
 * and is idempotent.
 *
 * This is the façade surface `usePIESession.ts` consumes; proving it
 * here lets Slice 5 (editor repoint) ship as a pure call-site swap.
 */

import { afterEach, describe, expect, it } from "vitest";
import { PIEEditorSession } from "../PIEEditorSession";
import type { RuntimeScriptGraph } from "../../../systems/shared/scripting/ScriptGraphInterpreter";
import type { PIEDebugEntry } from "../../PIEScriptRunner";

function makeOnReadyGraph(id: string): RuntimeScriptGraph {
  return {
    id,
    name: id,
    nodes: [
      {
        id: "t1",
        type: "trigger/onReady",
        data: {},
        inputs: [],
        outputs: [],
      },
    ],
    edges: [],
    variables: [],
  } as RuntimeScriptGraph;
}

const LONG_TIMEOUT_MS = 60_000;

describe("PIEEditorSession", () => {
  let session: PIEEditorSession | null = null;

  afterEach(async () => {
    if (session) {
      await session.stop();
      session = null;
    }
  });

  it(
    "start() boots loopback, seeds player, tick() is a no-op before stop()",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      session = new PIEEditorSession();
      expect(session.isRunning).toBe(false);

      await session.start({ playerSpawn: { x: 1, y: 2, z: 3 } });

      expect(session.isRunning).toBe(true);
      expect(session.server).not.toBeNull();
      expect(session.clientNetwork).not.toBeNull();
      expect(session.gameMode).not.toBeNull();

      const player = session.entities.get("pie-player");
      expect(player).toBeDefined();
      expect(player!.type).toBe("player");
      expect(player!.position).toEqual({ x: 1, y: 2, z: 3 });

      // Tick should be safe and not throw.
      expect(() => session!.tick(0.016)).not.toThrow();
    },
  );

  it(
    "mirrors manifest mobSpawns / npcs / resources / stations into entities map",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      session = new PIEEditorSession();
      await session.start({
        mobSpawns: [
          {
            id: "goblin-camp",
            mobId: "goblin",
            name: "Goblin",
            position: { x: 10, y: 0, z: 10 },
            spawnRadius: 5,
            maxCount: 3,
          },
        ],
        npcs: [
          {
            id: "merchant-1",
            type: "merchant",
            name: "Bob",
            position: { x: 0, y: 0, z: 5 },
          },
        ],
        resources: [
          {
            id: "tree-1",
            resourceId: "oak",
            resourceType: "tree",
            name: "Oak Tree",
            position: { x: -5, y: 0, z: 0 },
          },
        ],
        stations: [
          {
            id: "anvil-1",
            type: "anvil",
            position: { x: 3, y: 0, z: 3 },
          },
        ],
      });

      // Player + 3 mobs + 1 npc + 1 resource + 1 station = 7
      expect(session.entities.size).toBe(7);

      const mob0 = session.entities.get("mob_goblin-camp_0");
      expect(mob0).toBeDefined();
      expect(mob0!.type).toBe("mob");
      expect(mob0!.mobId).toBe("goblin");
      expect(mob0!.patrolCenter).toEqual({ x: 10, z: 10 });
      expect(mob0!.patrolRadius).toBe(5);

      const npc = session.entities.get("npc_merchant-1");
      expect(npc).toBeDefined();
      expect(npc!.type).toBe("npc");
      expect(npc!.npcType).toBe("merchant");

      const resource = session.entities.get("resource_tree-1");
      expect(resource).toBeDefined();
      expect(resource!.type).toBe("resource");
      expect(resource!.resourceType).toBe("tree");

      const station = session.entities.get("station_anvil-1");
      expect(station).toBeDefined();
      expect(station!.type).toBe("station");
      expect(station!.stationType).toBe("anvil");
    },
  );

  it(
    "stop() is idempotent and clears entities + handles",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      session = new PIEEditorSession();
      await session.start();
      expect(session.isRunning).toBe(true);

      await session.stop();
      expect(session.isRunning).toBe(false);
      expect(session.entities.size).toBe(0);

      // Second stop is a no-op.
      await expect(session.stop()).resolves.toBeUndefined();
    },
  );

  it(
    "double start() warns but does not throw",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      session = new PIEEditorSession();
      await session.start();
      await expect(session.start()).resolves.toBeUndefined();
      expect(session.isRunning).toBe(true);
    },
  );

  it(
    "interactWith fires onInteract trigger on the entity's behavior graph",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const sinkEntries: PIEDebugEntry[] = [];
      const onInteractGraph: RuntimeScriptGraph = {
        id: "g",
        name: "g",
        nodes: [
          {
            id: "t1",
            type: "trigger/onInteract",
            data: {},
            inputs: [],
            outputs: [],
          },
        ],
        edges: [],
        variables: [],
      } as RuntimeScriptGraph;

      session = new PIEEditorSession();
      await session.start({
        npcs: [
          {
            id: "ntest",
            type: "merchant",
            name: "Bob",
            position: { x: 0, y: 0, z: 0 },
            behaviorGraph: onInteractGraph,
          },
        ],
        debugSink: (entry) => {
          sinkEntries.push(entry);
        },
      });

      session.interactWith("npc_ntest");

      const triggerEntry = sinkEntries.find(
        (e) => e.source === "scripting/trigger",
      );
      expect(triggerEntry).toBeDefined();
      expect(triggerEntry!.data?.entityId).toBe("npc_ntest");
    },
  );

  it(
    "tick() mirrors server-side entity positions into the editor entities map",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      session = new PIEEditorSession();
      await session.start({
        npcs: [
          {
            id: "mover",
            type: "walker",
            name: "Mover",
            position: { x: 0, y: 0, z: 0 },
          },
        ],
      });

      const serverEntity =
        session.server!.world.entities.items.get("npc_mover");
      expect(serverEntity).toBeDefined();
      // Force a server-side position change.
      serverEntity!.position.set(5, 1, 7);

      // tick() pulls the new position into the façade map.
      session.tick(0.016);

      const pieEntity = session.entities.get("npc_mover");
      expect(pieEntity).toBeDefined();
      expect(pieEntity!.position.x).toBeCloseTo(5);
      expect(pieEntity!.position.y).toBeCloseTo(1);
      expect(pieEntity!.position.z).toBeCloseTo(7);
    },
  );

  it(
    "spawns entities on server world and attaches behavior graphs via ScriptingSystem",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const sinkEntries: PIEDebugEntry[] = [];

      session = new PIEEditorSession();
      await session.start({
        npcs: [
          {
            id: "merchant-1",
            type: "merchant",
            name: "Bob",
            position: { x: 0, y: 0, z: 0 },
            behaviorGraph: makeOnReadyGraph("merchant-graph"),
          },
        ],
        debugSink: (entry) => {
          sinkEntries.push(entry);
        },
      });

      // Server ECS saw the spawn.
      const serverWorld = session.server!.world;
      const serverEntity = serverWorld.entities.items.get("npc_merchant-1");
      expect(serverEntity).toBeDefined();

      // ScriptingSystem registered the graph. `addGraph` emits
      // `scripting:graph_ready` which the debug-sink listener forwards.
      const scripting = serverWorld.getSystem("scripting") as
        | {
            instances: Map<string, unknown[]>;
          }
        | undefined;
      expect(scripting).toBeDefined();
      const instances = scripting!.instances.get("npc_merchant-1");
      expect(instances).toBeDefined();
      expect(instances!.length).toBeGreaterThanOrEqual(1);

      // Debug-sink picked up the graph_ready event.
      const readyEntry = sinkEntries.find(
        (e) => e.source === "scripting/graph_ready",
      );
      expect(readyEntry).toBeDefined();
    },
  );

  it(
    "updateManifests({ woodcutting }) hot-reloads gathering trees without Stop/Play",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const { gatheringResources } = await import("../../../gathering/index");

      session = new PIEEditorSession();
      await session.start({});

      // Seed initial state — populate via the registry directly so the
      // test is independent of filesystem/CDN loaders.
      gatheringResources.loadWoodcuttingFromJson({
        trees: [
          {
            id: "oak",
            name: "oak tree",
            type: "tree",
            examine: "",
            modelPath: null,
            depletedModelPath: null,
            scale: 1,
            depletedScale: 1,
            harvestSkill: "woodcutting",
            toolRequired: "bronze_axe",
            levelRequired: 15,
            baseCycleTicks: 3,
            depleteChance: 0,
            respawnTicks: 0,
            harvestYield: [
              {
                itemId: "logs",
                itemName: "Logs",
                quantity: 1,
                chance: 1,
                xpAmount: 25,
                stackable: false,
              },
            ],
          },
        ],
      });
      expect(gatheringResources.tree("oak").levelRequired).toBe(15);

      // Hot-reload swap: push a manifest replacing the tree set.
      session.updateManifests({
        woodcutting: {
          trees: [
            {
              id: "willow",
              name: "willow tree",
              type: "tree",
              examine: "",
              modelPath: null,
              depletedModelPath: null,
              scale: 1,
              depletedScale: 1,
              harvestSkill: "woodcutting",
              toolRequired: "bronze_axe",
              levelRequired: 30,
              baseCycleTicks: 3,
              depleteChance: 0,
              respawnTicks: 0,
              harvestYield: [
                {
                  itemId: "willow_logs",
                  itemName: "Willow Logs",
                  quantity: 1,
                  chance: 1,
                  xpAmount: 67.5,
                  stackable: false,
                },
              ],
            },
          ],
        },
      });

      expect(gatheringResources.hasTree("oak")).toBe(false);
      expect(gatheringResources.hasTree("willow")).toBe(true);
      expect(gatheringResources.tree("willow").levelRequired).toBe(30);
    },
  );

  // DialogueSystem was migrated to @hyperforge/hyperscape plugin
  // (Wave 2 migration). The remaining `updateManifests({ dialogue
  // / dialogueConditionBindings / npcDialogueBindings /
  // localization })` integration tests dynamic-import the system
  // from inside the shared package — that path no longer resolves,
  // and forwarding to the plugin would create a shared→plugin
  // circular dep. These 4 tests should be re-homed in the plugin
  // package alongside DialogueSystem itself; until then they're
  // skipped so the rest of this 5,000+ line file runs.
  it.skip(
    "updateManifests({ dialogue }) hot-reloads authored trees on DialogueSystem",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const { DialogueSystem } =
        await import("../../../systems/shared/interaction/DialogueSystem");

      session = new PIEEditorSession();
      await session.start({});

      // The DialogueSystem is registered on the server world under the
      // "dialogue" system key; `updateManifests({ dialogue })` resolves
      // it dynamically and delegates to `setAuthoredDialogues`, which
      // replaces the authored tree table atomically.
      session.updateManifests({
        dialogue: [
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
        ],
      });

      const server = (
        session as unknown as {
          _server?: { world: { getSystem<T>(name: string): T | null } };
        }
      )._server;
      expect(server).toBeDefined();
      const dialogueSystem =
        server!.world.getSystem<InstanceType<typeof DialogueSystem>>(
          "dialogue",
        );
      expect(dialogueSystem).not.toBeNull();
      expect(dialogueSystem!.hasAuthoredDialogue("greeter_intro")).toBe(true);
      expect(dialogueSystem!.getAuthoredDialogueIds()).toEqual([
        "greeter_intro",
      ]);

      // Replace the entire authored set in one swap — the previous
      // tree must disappear so the editor roundtrip stays consistent.
      session.updateManifests({
        dialogue: [
          {
            id: "shopkeeper_intro",
            name: "Shopkeeper Intro",
            description: "",
            start: "n1",
            nodes: {
              n1: { kind: "end", id: "n1" },
            },
          },
        ],
      });
      expect(dialogueSystem!.hasAuthoredDialogue("greeter_intro")).toBe(false);
      expect(dialogueSystem!.hasAuthoredDialogue("shopkeeper_intro")).toBe(
        true,
      );

      // Empty manifest clears the authored set while leaving the
      // system installed (drop-to-legacy escape hatch).
      session.updateManifests({ dialogue: [] });
      expect(dialogueSystem!.getAuthoredDialogueIds()).toEqual([]);
    },
  );

  it.skip(
    "updateManifests({ dialogueConditionBindings }) installs, replaces, and clears authored predicates",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const { DialogueSystem } =
        await import("../../../systems/shared/interaction/DialogueSystem");

      session = new PIEEditorSession();
      await session.start({});

      const server = (
        session as unknown as {
          _server?: { world: { getSystem<T>(name: string): T | null } };
        }
      )._server;
      expect(server).toBeDefined();
      const dialogueSystem =
        server!.world.getSystem<InstanceType<typeof DialogueSystem>>(
          "dialogue",
        );
      expect(dialogueSystem).not.toBeNull();

      // A plugin-registered predicate that must survive managed swaps.
      dialogueSystem!.registerConditionEvaluator(
        "plugin_predicate",
        () => true,
      );

      // First install — two authored bindings.
      session.updateManifests({
        dialogueConditionBindings: {
          $schema: "hyperforge.dialogue-condition-bindings.v1",
          bindings: [
            {
              kind: "quest-active",
              name: "has_bandits_quest",
              questId: "bandits",
            },
            {
              kind: "has-item",
              name: "has_key",
              itemId: "iron_key",
            },
          ],
        },
      });
      expect(dialogueSystem!.getRegisteredConditionNames()).toEqual([
        "has_bandits_quest",
        "has_key",
        "plugin_predicate",
      ]);

      // Replace — drop `has_bandits_quest`, add `mining_40`. Plugin
      // predicate stays.
      session.updateManifests({
        dialogueConditionBindings: {
          $schema: "hyperforge.dialogue-condition-bindings.v1",
          bindings: [
            {
              kind: "has-item",
              name: "has_key",
              itemId: "iron_key",
            },
            {
              kind: "level-at-least",
              name: "mining_40",
              skill: "mining",
              level: 40,
            },
          ],
        },
      });
      expect(dialogueSystem!.getRegisteredConditionNames()).toEqual([
        "has_key",
        "mining_40",
        "plugin_predicate",
      ]);

      // Clear — explicit null removes every authored binding while
      // the plugin predicate survives.
      session.updateManifests({ dialogueConditionBindings: null });
      expect(dialogueSystem!.getRegisteredConditionNames()).toEqual([
        "plugin_predicate",
      ]);
    },
  );

  it.skip(
    "updateManifests({ npcDialogueBindings }) maps NPC ids to authored trees",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      session = new PIEEditorSession();
      await session.start({});

      // Load an authored tree + bind it to two NPC ids in the same
      // updateManifests call. The binding table must be an atomic
      // replacement (prior bindings vanish).
      session.updateManifests({
        dialogue: [
          {
            id: "village_greeter_tree",
            name: "Village Greeter Tree",
            description: "",
            start: "n1",
            nodes: { n1: { kind: "end", id: "n1" } },
          },
        ],
        npcDialogueBindings: {
          village_greeter_a: "village_greeter_tree",
          village_greeter_b: "village_greeter_tree",
        },
      });

      const server = (
        session as unknown as {
          _server?: { world: { getSystem<T>(name: string): T | null } };
        }
      )._server;
      const dialogueSystem =
        server!.world.getSystem<
          import("../../../systems/shared/interaction/DialogueSystem").DialogueSystem
        >("dialogue");
      expect(dialogueSystem).not.toBeNull();
      expect(
        dialogueSystem!.resolveAuthoredTreeIdForNpc("village_greeter_a"),
      ).toBe("village_greeter_tree");
      expect(
        dialogueSystem!.resolveAuthoredTreeIdForNpc("village_greeter_b"),
      ).toBe("village_greeter_tree");
      expect(dialogueSystem!.resolveAuthoredTreeIdForNpc("nobody")).toBeNull();

      // Replace bindings — prior entries are gone.
      session.updateManifests({
        npcDialogueBindings: {
          new_npc_id: "village_greeter_tree",
        },
      });
      expect(
        dialogueSystem!.resolveAuthoredTreeIdForNpc("village_greeter_a"),
      ).toBeNull();
      expect(dialogueSystem!.resolveAuthoredTreeIdForNpc("new_npc_id")).toBe(
        "village_greeter_tree",
      );

      // Stale bindings → null when tree is unloaded.
      session.updateManifests({ dialogue: [] });
      expect(
        dialogueSystem!.resolveAuthoredTreeIdForNpc("new_npc_id"),
      ).toBeNull();
    },
  );

  it(
    "updateManifests({ combatTuning }) emits combat:tuning:updated on world",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      session = new PIEEditorSession();
      await session.start({});

      const server = (
        session as unknown as {
          _server?: {
            world: {
              on(event: string, fn: (p: unknown) => void): void;
              off(event: string, fn: (p: unknown) => void): void;
            };
          };
        }
      )._server;
      expect(server).toBeDefined();

      const received: unknown[] = [];
      const onTuningUpdated = (p: unknown) => received.push(p);
      server!.world.on("combat:tuning:updated", onTuningUpdated);

      // A minimal but schema-valid CombatTuningManifest — `profiles`
      // is a required record keyed by profile id, and each profile
      // needs the core role/threshold/range fields. Exact values
      // don't matter for this wiring test.
      const manifest = {
        version: 1,
        defaultProfileId: "test",
        profiles: {
          test: {
            id: "test",
            role: "melee" as const,
            healThresholdPct: 40,
            aggressiveThresholdPct: 70,
            defensiveThresholdPct: 30,
            engagementRange: {
              melee: { min: 0.8, max: 1.8 },
              ranged: { min: 5, max: 8 },
              mage: { min: 5, max: 8 },
            },
            offensivePrayerId: "superhuman_strength",
            defensivePrayerId: "rock_skin",
            moveCooldownMs: 1200,
            strafeStep: 1.35,
            noFood: false,
          },
        },
      };

      session.updateManifests({
        combatTuning: manifest as unknown as never,
      });
      expect(received).toHaveLength(1);
      // Editor wraps the manifest in `{ manifest }` so that null survives
      // World.emit's `?? {}` nullish-coalescing on the payload slot.
      expect(received[0]).toEqual({ manifest });

      // null also propagates — signals "drop authored tuning".
      session.updateManifests({ combatTuning: null });
      expect(received).toHaveLength(2);
      expect(received[1]).toEqual({ manifest: null });

      server!.world.off("combat:tuning:updated", onTuningUpdated);
    },
  );

  it(
    "updateManifests({ combatTuningAgentBindings }) emits one event per binding",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      session = new PIEEditorSession();
      await session.start({});

      const server = (
        session as unknown as {
          _server?: {
            world: {
              on(event: string, fn: (p: unknown) => void): void;
              off(event: string, fn: (p: unknown) => void): void;
            };
          };
        }
      )._server;

      const events: Array<{
        characterId: string;
        profileId: string | null;
      }> = [];
      const onBinding = (p: unknown) =>
        events.push(p as { characterId: string; profileId: string | null });
      server!.world.on("combat:tuning:binding", onBinding);

      session.updateManifests({
        combatTuningAgentBindings: {
          alice: "boss",
          bob: "test",
          carol: null,
        },
      });

      expect(events).toHaveLength(3);
      expect(events).toContainEqual({
        characterId: "alice",
        profileId: "boss",
      });
      expect(events).toContainEqual({
        characterId: "bob",
        profileId: "test",
      });
      expect(events).toContainEqual({
        characterId: "carol",
        profileId: null,
      });

      server!.world.off("combat:tuning:binding", onBinding);
    },
  );

  it.skip(
    "updateManifests({ localization }) attaches catalog to DialogueSystem and hot-reloads textKey resolution",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      session = new PIEEditorSession();
      await session.start({});

      const { DialogueSystem } =
        await import("../../../systems/shared/interaction/DialogueSystem");
      const dialogueSystem = session.getSystem("dialogue") as InstanceType<
        typeof DialogueSystem
      > | null;
      expect(dialogueSystem).not.toBeNull();

      // Author a one-line tree so we can probe resolution via the
      // authored-path translator.
      session.updateManifests({
        dialogue: [
          {
            id: "ui_greet",
            name: "Greet",
            description: "",
            start: "ln1",
            nodes: {
              ln1: {
                kind: "line",
                id: "ln1",
                speaker: "npc",
                textKey: "greet.hello",
                next: "done",
              },
              done: { kind: "end", id: "done" },
            },
          },
        ],
      });

      // Attach a catalog via the editor hot-reload path. Applies
      // atomically to the live DialogueSystem; no restart required.
      session.updateManifests({
        localization: [
          {
            locale: "en",
            strings: { "greet.hello": "Hello, world." },
          },
        ],
      });

      // Capture DIALOGUE_START to verify resolution happens through
      // the catalog attached via updateManifests.
      const received: Array<Record<string, unknown>> = [];
      const onStart = (p: unknown) =>
        received.push(p as Record<string, unknown>);
      session.on("dialogue:start", onStart);

      (
        dialogueSystem as unknown as {
          startAuthoredDialogue(
            playerId: string,
            npcId: string,
            npcName: string,
            treeId: string,
            npcEntityId: string | undefined,
          ): void;
        }
      ).startAuthoredDialogue("p1", "npc", "Greeter", "ui_greet", undefined);

      expect(received).toHaveLength(1);
      expect(received[0].text).toBe("Hello, world.");
      session.off("dialogue:start", onStart);

      // Detach via null — next session should revert to raw textKey.
      session.updateManifests({ localization: null });

      const received2: Array<Record<string, unknown>> = [];
      const onStart2 = (p: unknown) =>
        received2.push(p as Record<string, unknown>);
      session.on("dialogue:start", onStart2);

      (
        dialogueSystem as unknown as {
          startAuthoredDialogue(
            playerId: string,
            npcId: string,
            npcName: string,
            treeId: string,
            npcEntityId: string | undefined,
          ): void;
        }
      ).startAuthoredDialogue("p2", "npc", "Greeter", "ui_greet", undefined);

      expect(received2).toHaveLength(1);
      expect(received2[0].text).toBe("greet.hello");
      session.off("dialogue:start", onStart2);
    },
  );

  it(
    "updateManifests is a no-op when session is not running",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const { gatheringResources } = await import("../../../gathering/index");

      // Preload the registry so we can verify the not-running guard
      // doesn't clobber existing state.
      gatheringResources.loadWoodcuttingFromJson({
        trees: [
          {
            id: "guard-tree",
            name: "guard tree",
            type: "tree",
            examine: "",
            modelPath: null,
            depletedModelPath: null,
            scale: 1,
            depletedScale: 1,
            harvestSkill: "woodcutting",
            toolRequired: "bronze_axe",
            levelRequired: 1,
            baseCycleTicks: 3,
            depleteChance: 0,
            respawnTicks: 0,
            harvestYield: [
              {
                itemId: "logs",
                itemName: "Logs",
                quantity: 1,
                chance: 1,
                xpAmount: 25,
                stackable: false,
              },
            ],
          },
        ],
      });

      const stopped = new PIEEditorSession();
      expect(stopped.isRunning).toBe(false);

      // Calling updateManifests on a stopped session must not mutate
      // the registry. The `if (!this._running) return` guard protects
      // against mid-teardown races where the editor pushes a final
      // update after `stop()` has begun.
      stopped.updateManifests({
        woodcutting: {
          trees: [
            {
              id: "should-not-appear",
              name: "should-not-appear",
              type: "tree",
              examine: "",
              modelPath: null,
              depletedModelPath: null,
              scale: 1,
              depletedScale: 1,
              harvestSkill: "woodcutting",
              toolRequired: "bronze_axe",
              levelRequired: 99,
              baseCycleTicks: 3,
              depleteChance: 0,
              respawnTicks: 0,
              harvestYield: [
                {
                  itemId: "logs",
                  itemName: "Logs",
                  quantity: 1,
                  chance: 1,
                  xpAmount: 25,
                  stackable: false,
                },
              ],
            },
          ],
        },
      });

      expect(gatheringResources.hasTree("guard-tree")).toBe(true);
      expect(gatheringResources.hasTree("should-not-appear")).toBe(false);
    },
  );

  it(
    "updateManifests tees Batch 16/17/18/19/20/21/22/23/24/25/26/27 manifests into their singleton providers",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const { combatSpellsProvider } =
        await import("../../../data/CombatSpellsProvider");
      const { woodcuttingProvider } =
        await import("../../../data/WoodcuttingProvider");
      const { miningProvider } = await import("../../../data/MiningProvider");
      const { fishingProvider } = await import("../../../data/FishingProvider");
      const { npcsProvider } = await import("../../../data/NpcsProvider");
      const { questsProvider } = await import("../../../data/QuestsProvider");
      const { pluginRegistryProvider } =
        await import("../../../data/PluginRegistryProvider");
      const { worldAreasProvider } =
        await import("../../../data/WorldAreasProvider");
      const { worldConfigProvider } =
        await import("../../../data/WorldConfigProvider");
      const { damageTypesProvider } =
        await import("../../../data/DamageTypesProvider");
      const { npcScheduleProvider } =
        await import("../../../data/NpcScheduleProvider");
      const { xpCurvesProvider } =
        await import("../../../data/XpCurvesProvider");
      const { renderProfilesProvider } =
        await import("../../../data/RenderProfilesProvider");
      const { soundEffectsProvider } =
        await import("../../../data/SoundEffectsProvider");
      const { vfxProvider } = await import("../../../data/VfxProvider");
      const { animationsProvider } =
        await import("../../../data/AnimationsProvider");
      const { cameraProfilesProvider } =
        await import("../../../data/CameraProfilesProvider");
      const { audioBusMixProvider } =
        await import("../../../data/AudioBusMixProvider");
      const { interactionPromptsProvider } =
        await import("../../../data/InteractionPromptsProvider");
      const { chatChannelsProvider } =
        await import("../../../data/ChatChannelsProvider");
      const { musicStateMachineProvider } =
        await import("../../../data/MusicStateMachineProvider");
      const { timeWeatherProvider } =
        await import("../../../data/TimeWeatherProvider");
      const { achievementsProvider } =
        await import("../../../data/AchievementsProvider");
      const { factionsProvider } =
        await import("../../../data/FactionsProvider");
      const { mountsProvider } = await import("../../../data/MountsProvider");
      const { petCompanionProvider } =
        await import("../../../data/PetCompanionProvider");
      const { statusEffectsProvider } =
        await import("../../../data/StatusEffectsProvider");
      const { enchantmentsProvider } =
        await import("../../../data/EnchantmentsProvider");
      const { titlesProvider } = await import("../../../data/TitlesProvider");
      const { leaderboardsProvider } =
        await import("../../../data/LeaderboardsProvider");
      const { mailProvider } = await import("../../../data/MailProvider");
      const { seasonsProvider } = await import("../../../data/SeasonsProvider");
      const { worldEventsProvider } =
        await import("../../../data/WorldEventsProvider");
      const { skyboxAtmosphereProvider } =
        await import("../../../data/SkyboxAtmosphereProvider");
      const { particleGraphProvider } =
        await import("../../../data/ParticleGraphProvider");
      const { voiceChatProvider } =
        await import("../../../data/VoiceChatProvider");
      const { partyGuildProvider } =
        await import("../../../data/PartyGuildProvider");
      const { navMeshProvider } = await import("../../../data/NavMeshProvider");
      const { lightingBakeProvider } =
        await import("../../../data/LightingBakeProvider");
      const { levelStreamingProvider } =
        await import("../../../data/LevelStreamingProvider");
      const { prefabProvider } = await import("../../../data/PrefabProvider");
      const { cinematicProvider } =
        await import("../../../data/CinematicProvider");
      const { postProcessVolumesProvider } =
        await import("../../../data/PostProcessVolumesProvider");
      const { accessibilityProvider } =
        await import("../../../data/AccessibilityProvider");
      const { featureFlagsProvider } =
        await import("../../../data/FeatureFlagsProvider");
      const { physicsConfigProvider } =
        await import("../../../data/PhysicsConfigProvider");
      const { respawnProvider } = await import("../../../data/RespawnProvider");
      const { talentTreesProvider } =
        await import("../../../data/TalentTreesProvider");
      const { auctionHouseProvider } =
        await import("../../../data/AuctionHouseProvider");
      const { crashReporterProvider } =
        await import("../../../data/CrashReporterProvider");
      const { pushNotificationsProvider } =
        await import("../../../data/PushNotificationsProvider");
      const { licenseAgreementsProvider } =
        await import("../../../data/LicenseAgreementsProvider");
      const { moderationProvider } =
        await import("../../../data/ModerationProvider");
      const { parentalControlsProvider } =
        await import("../../../data/ParentalControlsProvider");
      const { fastTravelProvider } =
        await import("../../../data/FastTravelProvider");
      const { friendsSocialProvider } =
        await import("../../../data/FriendsSocialProvider");
      const { housingProvider } = await import("../../../data/HousingProvider");
      const { loadoutsProvider } =
        await import("../../../data/LoadoutsProvider");
      const { avatarsProvider } = await import("../../../data/AvatarsProvider");
      const { playerEmotesProvider } =
        await import("../../../data/PlayerEmotesProvider");
      const { spellVisualsProvider } =
        await import("../../../data/SpellVisualsProvider");
      const { skillIconsProvider } =
        await import("../../../data/SkillIconsProvider");
      const { commerceProvider } =
        await import("../../../data/CommerceProvider");
      const { storeFrontProvider } =
        await import("../../../data/StoreFrontProvider");
      const { onboardingGoalsProvider } =
        await import("../../../data/OnboardingGoalsProvider");
      const { creditsProvider } = await import("../../../data/CreditsProvider");
      const { mainMenuProvider } =
        await import("../../../data/MainMenuProvider");
      const { tooltipsProvider } =
        await import("../../../data/TooltipsProvider");
      const { keyPromptIconsProvider } =
        await import("../../../data/KeyPromptIconsProvider");
      const { loadingScreensProvider } =
        await import("../../../data/LoadingScreensProvider");
      const { hapticsProvider } = await import("../../../data/HapticsProvider");
      const { tutorialFlowsProvider } =
        await import("../../../data/TutorialFlowsProvider");
      const { inputActionsProvider } =
        await import("../../../data/InputActionsProvider");
      const { skillUnlocksProvider } =
        await import("../../../data/SkillUnlocksProvider");
      const { weaponStylesProvider } =
        await import("../../../data/WeaponStylesProvider");
      const { ammunitionProvider } =
        await import("../../../data/AmmunitionProvider");
      const { editorSnapProvider } =
        await import("../../../data/EditorSnapProvider");
      const { projectSettingsProvider } =
        await import("../../../data/ProjectSettingsProvider");
      const { qualityPresetsProvider } =
        await import("../../../data/QualityPresetsProvider");
      const { deployTargetsProvider } =
        await import("../../../data/DeployTargetsProvider");
      const { profilerOverlayProvider } =
        await import("../../../data/ProfilerOverlayProvider");
      const { replicationProvider } =
        await import("../../../data/ReplicationProvider");
      const { smithingProvider } =
        await import("../../../data/SmithingProvider");
      const { processingProvider } =
        await import("../../../data/ProcessingProvider");
      const { bankingProvider } = await import("../../../data/BankingProvider");
      const { arenaLayoutProvider } =
        await import("../../../data/ArenaLayoutProvider");
      const { lodSettingsProvider } =
        await import("../../../data/LODSettingsProvider");
      const { npcSizesProvider } =
        await import("../../../data/NPCSizesProvider");
      const { duelProvider } = await import("../../../data/DuelProvider");
      const { storesProvider } = await import("../../../data/StoresProvider");
      const { toolsProvider } = await import("../../../data/ToolsProvider");
      const { treesProvider } = await import("../../../data/TreesProvider");
      const { biomesProvider } = await import("../../../data/BiomesProvider");
      const { vegetationProvider } =
        await import("../../../data/VegetationProvider");
      const { tradingProvider } = await import("../../../data/TradingProvider");
      const { itemSetsProvider } =
        await import("../../../data/ItemSetsProvider");
      const { transmogProvider } =
        await import("../../../data/TransmogProvider");
      const { economyTuningProvider } =
        await import("../../../data/EconomyTuningProvider");
      const { interactionProvider } =
        await import("../../../data/InteractionProvider");
      const { newsFeedProvider } =
        await import("../../../data/NewsFeedProvider");
      const { buildingsProvider } =
        await import("../../../data/BuildingsProvider");
      const { screenshotProvider } =
        await import("../../../data/ScreenshotProvider");
      const { serverBrowserProvider } =
        await import("../../../data/ServerBrowserProvider");
      const { equipmentProvider } =
        await import("../../../data/EquipmentProvider");
      const { matchmakingTuningProvider } =
        await import("../../../data/MatchmakingTuningProvider");
      const { aiBehaviorProvider } =
        await import("../../../data/AIBehaviorProvider");
      const { analyticsEventsProvider } =
        await import("../../../data/AnalyticsEventsProvider");
      const { groupFinderProvider } =
        await import("../../../data/GroupFinderProvider");
      const { duelArenasProvider } =
        await import("../../../data/DuelArenasProvider");
      const { combatProvider } = await import("../../../data/CombatProvider");
      const { gameProvider } = await import("../../../data/GameProvider");
      const { gatheringProvider } =
        await import("../../../data/GatheringProvider");
      const { musicProvider } = await import("../../../data/MusicProvider");
      const { saveDataProvider } =
        await import("../../../data/SaveDataProvider");
      const { worldStructureProvider } =
        await import("../../../data/WorldStructureProvider");

      // Clear provider state so assertions aren't polluted by prior tests.
      combatSpellsProvider.unload();
      woodcuttingProvider.unload();
      miningProvider.unload();
      fishingProvider.unload();
      npcsProvider.unload();
      questsProvider.unload();
      pluginRegistryProvider.unload();
      worldAreasProvider.unload();
      worldConfigProvider.unload();
      damageTypesProvider.unload();
      npcScheduleProvider.unload();
      xpCurvesProvider.unload();
      renderProfilesProvider.unload();
      soundEffectsProvider.unload();
      vfxProvider.unload();
      animationsProvider.unload();
      cameraProfilesProvider.unload();
      audioBusMixProvider.unload();
      interactionPromptsProvider.unload();
      chatChannelsProvider.unload();
      musicStateMachineProvider.unload();
      timeWeatherProvider.unload();
      achievementsProvider.unload();
      factionsProvider.unload();
      mountsProvider.unload();
      petCompanionProvider.unload();
      statusEffectsProvider.unload();
      enchantmentsProvider.unload();
      titlesProvider.unload();
      leaderboardsProvider.unload();
      mailProvider.unload();
      seasonsProvider.unload();
      worldEventsProvider.unload();
      skyboxAtmosphereProvider.unload();
      particleGraphProvider.unload();
      voiceChatProvider.unload();
      partyGuildProvider.unload();
      navMeshProvider.unload();
      lightingBakeProvider.unload();
      levelStreamingProvider.unload();
      prefabProvider.unload();
      cinematicProvider.unload();
      postProcessVolumesProvider.unload();
      accessibilityProvider.unload();
      featureFlagsProvider.unload();
      physicsConfigProvider.unload();
      respawnProvider.unload();
      talentTreesProvider.unload();
      auctionHouseProvider.unload();
      crashReporterProvider.unload();
      pushNotificationsProvider.unload();
      licenseAgreementsProvider.unload();
      moderationProvider.unload();
      parentalControlsProvider.unload();
      fastTravelProvider.unload();
      friendsSocialProvider.unload();
      housingProvider.unload();
      loadoutsProvider.unload();
      avatarsProvider.unload();
      playerEmotesProvider.unload();
      spellVisualsProvider.unload();
      skillIconsProvider.unload();
      commerceProvider.unload();
      storeFrontProvider.unload();
      onboardingGoalsProvider.unload();
      creditsProvider.unload();
      mainMenuProvider.unload();
      tooltipsProvider.unload();
      keyPromptIconsProvider.unload();
      loadingScreensProvider.unload();
      hapticsProvider.unload();
      tutorialFlowsProvider.unload();
      inputActionsProvider.unload();
      skillUnlocksProvider.unload();
      weaponStylesProvider.unload();
      ammunitionProvider.unload();
      editorSnapProvider.unload();
      projectSettingsProvider.unload();
      qualityPresetsProvider.unload();
      deployTargetsProvider.unload();
      profilerOverlayProvider.unload();
      replicationProvider.unload();
      smithingProvider.unload();
      processingProvider.unload();
      bankingProvider.unload();
      arenaLayoutProvider.unload();
      lodSettingsProvider.unload();
      npcSizesProvider.unload();
      duelProvider.unload();
      storesProvider.unload();
      toolsProvider.unload();
      treesProvider.unload();
      biomesProvider.unload();
      vegetationProvider.unload();
      tradingProvider.unload();
      itemSetsProvider.unload();
      transmogProvider.unload();
      economyTuningProvider.unload();
      interactionProvider.unload();
      newsFeedProvider.unload();
      buildingsProvider.unload();
      screenshotProvider.unload();
      serverBrowserProvider.unload();
      equipmentProvider.unload();
      matchmakingTuningProvider.unload();
      aiBehaviorProvider.unload();
      analyticsEventsProvider.unload();
      groupFinderProvider.unload();
      duelArenasProvider.unload();
      combatProvider.unload();
      gameProvider.unload();
      gatheringProvider.unload();
      musicProvider.unload();
      saveDataProvider.unload();
      worldStructureProvider.unload();

      session = new PIEEditorSession();
      await session.start({});

      const { NPC_SPAWN_CONSTANTS } = await import("../../../data/npcs");

      const { gatheringResources } = await import("../../../gathering");

      const { worldAreasRegistry } = await import("../../../world-areas");

      const { damageTypeRegistry } = await import("../../../damage-types");

      const { npcScheduleRegistry } = await import("../../../npc-schedule");
      const { xpCurveRegistry } = await import("../../../progression");
      const { renderProfileRegistry } = await import("../../../rendering");
      const { sfxRegistry } = await import("../../../sfx");
      const { vfxRegistry } = await import("../../../vfx");
      const { animationRegistry } = await import("../../../animations");
      const { cameraProfileRegistry } = await import("../../../camera");
      const { audioBusMixer } = await import("../../../audio");
      const { interactionPromptRegistry } =
        await import("../../../interaction-prompts");
      const { chatChannelRegistry } = await import("../../../chat");
      const { musicStateMachineRegistry } = await import("../../../music");
      const { timeWeatherDriver } = await import("../../../time-weather");
      const { achievementEvaluator } = await import("../../../achievements");
      const { factionsRegistry } = await import("../../../factions");
      const { mountRegistry } = await import("../../../mounts");
      const { petRegistry } = await import("../../../pet-companion");
      const { statusEffectRegistry } = await import("../../../status-effects");
      const { enchantmentRegistry } = await import("../../../enchantments");
      const { titleRegistry } = await import("../../../titles");
      const { leaderboardEngine } = await import("../../../leaderboards");
      const { mailPolicyRegistry } = await import("../../../mail");
      const { seasonRegistry } = await import("../../../seasons");
      const { worldEventsRegistry } = await import("../../../world-events");
      const { skyboxAtmosphereRegistry } =
        await import("../../../skybox-atmosphere");
      const { particleGraphRegistry } = await import("../../../particle-graph");
      const { voiceChatRegistry } = await import("../../../voice-chat");
      const { partyGuildRegistry } = await import("../../../party-guild");
      const { navMeshRegistry } = await import("../../../nav-mesh");
      const { lightingBakeRegistry } = await import("../../../lighting-bake");
      const { levelStreamingRegistry } =
        await import("../../../level-streaming");
      const { prefabRegistry } = await import("../../../prefab");
      const { cinematicRegistry } = await import("../../../cinematic");
      const { postProcessVolumeCompositor } =
        await import("../../../rendering");
      const { accessibilitySettings } = await import("../../../accessibility");
      const { featureFlagRegistry } = await import("../../../feature-flags");
      const { physicsConfigRegistry } = await import("../../../physics-config");
      const { respawnPolicyResolver } = await import("../../../respawn");
      const { talentTreeRegistry } = await import("../../../talent-trees");
      const { auctionHouseRegistry } = await import("../../../auction-house");
      const { crashReporterRegistry } = await import("../../../crash-reporter");
      const { pushNotificationsRegistry } =
        await import("../../../push-notifications");
      const { licenseAgreementsRegistry } =
        await import("../../../license-agreements");
      const { moderationRegistry } = await import("../../../moderation");
      const { parentalControlsRegistry } =
        await import("../../../parental-controls");
      const { fastTravelGraph } = await import("../../../fast-travel");
      const { friendsSocialRegistry } = await import("../../../friends-social");
      const { housingRegistry } = await import("../../../housing");
      const { loadoutPolicyRegistry } = await import("../../../loadouts");
      const { avatarsRegistry } = await import("../../../avatars");
      const { playerEmotesRegistry } = await import("../../../player-emotes");
      const { spellVisualsRegistry } = await import("../../../spell-visuals");
      const { skillIconsRegistry } = await import("../../../skill-icons");
      const { commerceRegistry } = await import("../../../commerce");
      const { storeFrontRegistry } = await import("../../../store-front");
      const { onboardingGoalsRegistry } =
        await import("../../../onboarding-goals");
      const { creditsRegistry } = await import("../../../credits");
      const { mainMenuRegistry } = await import("../../../main-menu");
      const { tooltipRegistry } = await import("../../../tooltips");
      const { keyPromptGlyphRegistry } = await import("../../../key-prompts");
      const { loadingScreensRegistry } =
        await import("../../../loading-screens");
      const { hapticsRegistry } = await import("../../../haptics");
      const { tutorialFlowsRegistry } = await import("../../../tutorial-flows");
      const { inputActionsRegistry } = await import("../../../input-actions");
      const { skillUnlocksRegistry } = await import("../../../skill-unlocks");
      const { weaponStylesRegistry } = await import("../../../weapon-styles");
      const { ammunitionRegistry } = await import("../../../ammunition");
      const { editorSnapRegistry } = await import("../../../editor-snap");
      const { projectSettingsRegistry } =
        await import("../../../project-settings");
      const { qualityPresetsRegistry } =
        await import("../../../quality-presets");
      const { deployTargetsRegistry } = await import("../../../deploy-targets");
      const { profilerOverlayRegistry } = await import("../../../profiler");
      const { replicationRegistry } = await import("../../../replication");
      const { smithingRegistry } = await import("../../../smithing");
      const { processingRegistry } = await import("../../../processing");
      const { bankingRegistry } = await import("../../../banking");
      const { arenaLayoutRegistry } = await import("../../../arena-layout");
      const { lodSettingsRegistry } = await import("../../../lod-settings");
      const { npcSizesRegistry } = await import("../../../npc-sizes");
      const { duelRulesRegistry } = await import("../../../duel");
      const { storesRegistry } = await import("../../../stores");
      const { toolsRegistry } = await import("../../../tools");
      const { treeCatalogRegistry } = await import("../../../trees");
      const { biomesRegistry } = await import("../../../biomes");
      const { vegetationRegistry } = await import("../../../vegetation");
      const { tradingRegistry } = await import("../../../trading");
      const { itemSetRegistry } = await import("../../../item-sets");
      const { transmogRegistry } = await import("../../../transmog");
      const { economyTuningRegistry } = await import("../../../economy-tuning");
      const { interactionConfigRegistry } =
        await import("../../../interaction");
      const { newsFeedRegistry } = await import("../../../news-feed");
      const { buildingsRegistry } = await import("../../../buildings");
      const { screenshotRegistry } = await import("../../../screenshot");
      const { serverBrowserRegistry } = await import("../../../server-browser");
      const { equipmentManifestRegistry } =
        await import("../../../equipment-manifest");
      const { matchmakingRegistry } =
        await import("../../../matchmaking-tuning");
      const { analyticsEventRouter } = await import("../../../analytics");
      const { groupFinderRegistry } = await import("../../../group-finder");

      // Batch 26 fixtures — load + parse the canonical manifest
      // JSON files so we exercise the true schema shape without
      // hand-authoring hundreds of required fields in this test.
      const { readFileSync } = await import("node:fs");
      const pathMod = await import("node:path");
      const {
        CombatManifestSchema,
        GameManifestSchema,
        GatheringManifestSchema,
      } = await import("@hyperforge/manifest-schema");
      const parts = __dirname.split(pathMod.sep);
      const packagesIndex = parts.lastIndexOf("packages");
      const rootDir =
        packagesIndex >= 0
          ? parts.slice(0, packagesIndex + 1).join(pathMod.sep)
          : pathMod.resolve(__dirname, "../../../../../..");
      const loadManifest = (rel: string): unknown =>
        JSON.parse(
          readFileSync(
            pathMod.resolve(rootDir, `server/world/assets/manifests/${rel}`),
            "utf-8",
          ),
        );
      const combatFixture = CombatManifestSchema.parse(
        loadManifest("combat-constants.json"),
      );
      const gameFixture = GameManifestSchema.parse(
        loadManifest("game-constants.json"),
      );
      const gatheringFixture = GatheringManifestSchema.parse(
        loadManifest("gathering-constants.json"),
      );

      session.updateManifests({
        // Live-dispatch + tee: woodcutting trees.
        woodcutting: {
          trees: [
            {
              id: "tee-tree",
              name: "Tee Tree",
              type: "tree",
              examine: "",
              modelPath: null,
              depletedModelPath: null,
              scale: 1,
              depletedScale: 1,
              harvestSkill: "woodcutting",
              toolRequired: "bronze_axe",
              levelRequired: 1,
              baseCycleTicks: 1,
              depleteChance: 0,
              respawnTicks: 0,
              harvestYield: [
                {
                  itemId: "logs",
                  itemName: "Logs",
                  quantity: 1,
                  chance: 1,
                  xpAmount: 1,
                  stackable: false,
                },
              ],
            },
          ],
        },
        // Live-dispatch + tee: mining rocks.
        mining: {
          rocks: [
            {
              id: "tee-rock",
              name: "Tee Rock",
              type: "ore",
              examine: "",
              modelPath: null,
              depletedModelPath: null,
              scale: 1,
              depletedScale: 1,
              harvestSkill: "mining",
              toolRequired: "bronze_pickaxe",
              levelRequired: 1,
              baseCycleTicks: 1,
              depleteChance: 0,
              respawnTicks: 0,
              harvestYield: [
                {
                  itemId: "copper_ore",
                  itemName: "Copper Ore",
                  quantity: 1,
                  chance: 1,
                  xpAmount: 1,
                  stackable: false,
                },
              ],
            },
          ],
        },
        // Live-dispatch + tee: fishing spots (extended yield schema).
        fishing: {
          spots: [
            {
              id: "tee-spot",
              name: "Tee Spot",
              type: "fishing_spot",
              examine: "",
              modelPath: null,
              depletedModelPath: null,
              scale: 1,
              depletedScale: 1,
              harvestSkill: "fishing",
              toolRequired: "small_fishing_net",
              levelRequired: 1,
              baseCycleTicks: 1,
              depleteChance: 0,
              respawnTicks: 0,
              harvestYield: [
                {
                  itemId: "raw_shrimp",
                  itemName: "Raw Shrimp",
                  quantity: 1,
                  chance: 1,
                  xpAmount: 1,
                  stackable: false,
                  levelRequired: 1,
                  catchLow: 64,
                  catchHigh: 128,
                },
              ],
            },
          ],
        },
        // Live-dispatch + tee: combat spells (standard spellbook).
        spells: {
          standard: {
            strike: [
              {
                id: "tee-strike",
                name: "Tee Strike",
                level: 1,
                baseMaxHit: 2,
                baseXp: 5.5,
                element: "air",
                attackSpeed: 5,
                runes: [{ runeId: "air_rune", quantity: 1 }],
              },
            ],
            bolt: [
              {
                id: "tee-bolt",
                name: "Tee Bolt",
                level: 17,
                baseMaxHit: 9,
                baseXp: 22.5,
                element: "air",
                attackSpeed: 5,
                runes: [
                  { runeId: "air_rune", quantity: 2 },
                  { runeId: "chaos_rune", quantity: 1 },
                ],
              },
            ],
          },
        },
        // Live-dispatch + tee: rewrites `NPC_SPAWN_CONSTANTS` in-place.
        npcs: {
          $schema: "hyperforge.npcs.v1",
          spawnConstants: {
            globalRespawnTime: 999,
            maxNpcsPerZone: 42,
            spawnRadiusCheck: 13,
            aggroLevelThreshold: 7,
          },
        },
        // Boot-load-only tees — safe-baseline-shaped payloads.
        quests: {},
        pluginRegistry: {
          plugins: [],
          enabledByDefault: {},
        },
        worldAreas: {
          starterTowns: {
            "tee-town": {
              id: "tee-town",
              name: "Tee Town",
              description: "",
              difficultyLevel: 0,
              bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
              biomeType: "plains",
              safeZone: true,
            },
          },
          level1Areas: {},
          level2Areas: {},
          level3Areas: {},
          specialAreas: {},
        },
        damageTypes: {
          types: [
            {
              id: "tee-fire",
              name: "Tee Fire",
              family: "elemental",
              displayColor: "#ff8040",
            },
            {
              id: "tee-ice",
              name: "Tee Ice",
              family: "elemental",
              displayColor: "#80c0ff",
            },
          ],
          resistances: [
            {
              attacker: "tee-fire",
              target: "tee-ice",
              multiplier: 2,
            },
          ],
          defaultMultiplier: 1,
        },
        npcSchedule: [
          {
            id: "tee-schedule",
            name: "Tee Schedule",
            description: "",
            npcIds: [],
            slots: [
              {
                id: "morning",
                startTime: "08:00",
                endTime: "12:00",
                days: [],
                activity: "idle",
                patrolPath: [],
                animationId: "",
                dialogueId: "",
                customKey: "",
              },
            ],
          },
        ],
        xpCurves: [
          {
            id: "tee-curve",
            name: "Tee Curve",
            kind: "formula",
            formula: "linear",
            maxLevel: 10,
          },
        ],
        renderProfiles: [
          {
            id: "tee-profile",
            name: "Tee Profile",
          },
        ],
        sfx: [
          {
            id: "tee-sfx",
            name: "Tee SFX",
            description: "",
            category: "ui",
            path: "asset://sfx/tee.ogg",
            duration: 0,
            volume: 1,
            pitchVariance: 0,
            cullable: false,
          },
        ],
        vfx: [
          {
            id: "tee-vfx",
            name: "Tee VFX",
            description: "",
            kind: "burst",
            asset: "asset://vfx/tee.glb",
            duration: 0.5,
            color: 0xffffff,
            glowIntensity: 1,
            scale: 1,
            blendMode: "normal",
            attachToSource: false,
            cullable: false,
          },
        ],
        animations: {
          clips: [
            {
              id: "tee-idle",
              name: "Tee Idle",
              path: "asset://anim/tee_idle.glb",
              description: "",
              duration: 1,
              speed: 1,
              loop: true,
              blendIn: 0.15,
              blendOut: 0.15,
              tags: [],
            },
          ],
          bindings: [{ rigId: "tee-rig", action: "idle", clipId: "tee-idle" }],
        },
        cameraProfiles: [
          {
            id: "teeCam",
            name: "Tee Cam",
            description: "",
            projection: "perspective",
            nearMeters: 0.1,
            farMeters: 2000,
            fov: {
              baseDegrees: 75,
              speedWideningDegrees: 0,
              speedRefForWidening: 10,
            },
            lag: {
              enabled: true,
              positionStiffness: 8,
              rotationStiffness: 10,
              damping: 1,
            },
            collision: {
              enabled: true,
              probeRadius: 0.2,
              maxPullForwardMeters: 10,
              smoothingSec: 0.15,
            },
            rig: {
              kind: "first-person",
              eyeOffset: { x: 0, y: 1.6, z: 0 },
              headbobAmplitude: 0.05,
            },
          },
        ],
        audioBusMix: {
          masterVolumeDb: 0,
          buses: [
            {
              id: "master",
              name: "Master",
              parent: "",
              volumeDb: 0,
              muted: false,
              solo: false,
              lowpassHz: 0,
              highpassHz: 0,
            },
          ],
          duckRules: [],
        },
        interactionPrompts: [
          {
            id: "teePrompt",
            interactionKind: "chest",
            actionId: "interact",
            mode: "tap",
            durationSec: 0,
            labelKey: "prompt.chest.open",
            subLabelKey: "",
            iconId: "",
            style: "default",
            anchor: "screen-center",
            autoHideDistanceMeters: 3,
            fadeInSec: 0.15,
            fadeOutSec: 0.2,
            priority: 0,
          },
        ],
        chatChannels: {
          channels: [
            {
              id: "teeChat",
              name: "Tee Chat",
              description: "",
              scope: "global",
              postPermission: "anyone",
              color: "#00aaff",
              defaultVisible: true,
              rateLimitPerMinute: 60,
              maxMessageLength: 500,
              cooldownSec: 0,
              historySize: 200,
              filterRuleIds: [],
              customScopeKey: "",
            },
          ],
          filterRules: [],
        },
        musicStateMachine: [
          {
            id: "tee-sm",
            name: "Tee SM",
            description: "",
            initial: "idle",
            states: [
              {
                id: "idle",
                name: "Idle",
                description: "",
                musicId: "",
                volume: 1,
                loop: true,
                transitions: [],
              },
            ],
          },
        ],
        timeWeather: {
          dayNight: {
            cycleSeconds: 1200,
            timeOrigin: "dawn",
            keyframes: [
              {
                t: 0,
                sunColor: 0xffffff,
                moonColor: 0x000000,
                ambientColor: 0x888888,
                sunIntensity: 1,
                moonIntensity: 0,
                fogColor: 0xaaaaaa,
                fogDensity: 0.01,
              },
              {
                t: 1,
                sunColor: 0xffffff,
                moonColor: 0x000000,
                ambientColor: 0x888888,
                sunIntensity: 1,
                moonIntensity: 0,
                fogColor: 0xaaaaaa,
                fogDensity: 0.01,
              },
            ],
          },
          weather: {
            states: [
              {
                id: "tee-clear",
                name: "Tee Clear",
                description: "",
                skyTint: 0xffffff,
                fogDensityBoost: 0,
                wind: { x: 0, y: 0, z: 0 },
                rainIntensity: 0,
                snowIntensity: 0,
                lightningChancePerSecond: 0,
              },
            ],
            transitions: [],
            transitionSeconds: 4,
            defaultStateId: "tee-clear",
          },
        },
        achievements: [
          {
            id: "tee-ach",
            name: "Tee Achievement",
            description: "",
            hidden: false,
            rarity: "common",
            points: 0,
            prerequisites: [],
            trigger: { kind: "stat", stat: "tee.level", threshold: 10 },
          },
        ],
        factions: {
          factions: [
            {
              id: "tee-guild",
              name: "Tee Guild",
              description: "",
              iconId: "",
              startingStanding: 0,
              tiers: [
                {
                  id: "neutral",
                  name: "Neutral",
                  minStanding: -100,
                  maxStanding: 100,
                  vendorPriceMultiplier: 1,
                  npcsAttackOnSight: false,
                  questsUnlocked: false,
                  shopUnlocked: false,
                },
              ],
              color: "",
              playerJoinable: false,
              hidden: false,
            },
          ],
          relationships: [],
        },
        mounts: [
          {
            id: "tee-mount",
            name: "Tee Mount",
            description: "",
            iconId: "",
            category: "common",
            modelId: "",
            idleAnimationId: "",
            mountAnimationId: "",
            mountSfxId: "",
            mountVfxId: "",
            locomotion: ["ground"],
            speeds: {
              walkSpeed: 6,
              runSpeed: 12,
              sprintSpeed: 18,
              flySpeed: 0,
              swimSpeed: 0,
              maxAltitudeMeters: 0,
            },
            stamina: {
              maxStamina: 100,
              regenPerSecond: 10,
              drainPerSecondSprint: 20,
              pauseWhenStationary: true,
            },
            capacity: {
              passengers: 1,
              cargoSlots: 0,
              passengersCanAct: false,
            },
            summonRules: {
              allowInCombat: false,
              allowInSafeZones: true,
              allowIndoors: false,
              allowUnderwater: false,
              summonCooldownSec: 3,
              forceDismountOnDamage: true,
            },
            hotkey: "none",
            requiredRidingLevel: 0,
            persistent: true,
            tradeable: false,
          },
        ],
        petCompanion: [
          {
            id: "tee-pet",
            name: "Tee Pet",
            description: "",
            iconId: "",
            category: "cosmetic",
            modelId: "",
            idleAnimationId: "",
            summonVfxId: "",
            summonSfxId: "",
            slots: [],
            stats: {
              maxHealth: 10,
              baseAttack: 0,
              baseDefense: 0,
              moveSpeed: 5,
              ownerStatScaling: 0.25,
            },
            abilities: [],
            summonRules: {
              allowInCombat: false,
              allowInSafeZones: true,
              allowWhileMounted: false,
              summonCooldownSec: 5,
              maxActive: 1,
              idleDespawnSec: 0,
            },
            followBehavior: "heel",
            progression: {
              enabled: false,
              maxLevel: 1,
              xpPerLevel: 100,
              statGrowthPerLevel: 0.05,
              loyaltyPerInteraction: 1,
            },
            persistent: true,
            persistOnDeath: false,
            tradeable: false,
          },
        ],
        statusEffects: [
          {
            id: "tee-buff",
            name: "Tee Buff",
            description: "",
            iconId: "",
            category: "beneficial",
            tags: [],
            modifiers: [],
            durationSec: 30,
            tickIntervalSec: 0,
            perTickDamage: 0,
            perTickHeal: 0,
            damageTypeId: "true",
            stackRule: "refresh",
            maxStacks: 1,
            undispellable: false,
            persistOnDeath: false,
            applyVfxId: "",
            activeVfxId: "",
            applySfxId: "",
          },
        ],
        enchantments: [
          {
            id: "tee-ench",
            name: "Tee Enchant",
            description: "",
            iconId: "",
            kind: "permanent",
            slots: ["weapon"],
            maxTier: 1,
            modifiers: [
              {
                stat: "attack",
                op: "add",
                tiers: [{ tier: 1, value: 5, requiredLevel: 1 }],
              },
            ],
            recipe: {
              reagentIds: [],
              stationId: "",
              requiredCraftingLevel: 0,
              successChance: 1,
            },
            durationHits: 0,
            destructiveRemoval: false,
            soulboundsItem: false,
          },
        ],
        titles: [
          {
            id: "tee-title",
            name: "Tee Title",
            displayKey: "title.tee",
            description: "",
            iconId: "",
            displayMode: "prefix",
            rarity: "common",
            color: "",
            unlockConditions: [{ kind: "manual" }],
            revocation: {
              revokeOnCadenceRollover: false,
              expireAfterDays: 0,
              revocableByGm: true,
            },
            hiddenUntilEarned: true,
            showInAchievementsTab: true,
          },
        ],
        leaderboards: [
          {
            id: "tee-board",
            name: "Tee Board",
            description: "",
            iconId: "",
            metric: "pvpRating",
            customMetricKey: "",
            sort: "desc",
            scope: "global",
            cadence: "allTime",
            tieBreak: "none",
            maxEntries: 1000,
            minQualifyingScore: 0,
            minLevel: 1,
            maxLevel: 100,
            frozenBetweenRollups: false,
            announceTopOnRollover: false,
            announceTopN: 10,
            rewardBrackets: [],
          },
        ],
        mail: {
          enabled: true,
          enabledCategories: ["player", "system"],
          attachments: {
            maxItemSlots: 6,
            maxTotalWeight: 0,
            maxCurrencyAmount: 1_000_000,
            currencyId: "gold",
            allowSoulboundBetweenSameAccount: true,
            allowQuestItems: false,
          },
          cod: {
            enabled: true,
            commission: 0.05,
            maxCodAmount: 10_000_000,
            disallowCurrencyAttachment: true,
          },
          postage: {
            flatFee: 30,
            perItemFee: 0,
            perCurrencyFee: 0,
            freeGuildMail: true,
            freeSystemMail: true,
          },
          retention: {
            readNoAttachmentsRetentionHours: 72,
            withAttachmentsRetentionHours: 720,
            unreadAutoReturnHours: 720,
            senderReclaimGraceHours: 720,
            maxInboxPerPlayer: 100,
          },
          rateLimit: {
            maxPerHour: 30,
            maxPerDay: 200,
            minSendIntervalSec: 1,
            maxRecipientsPerMail: 1,
          },
          maxSubjectLength: 64,
          maxBodyLength: 2000,
          blockListEnabled: true,
          gmMailBypassesAllLimits: true,
        },
        seasons: [
          {
            id: "tee-season",
            name: "Tee Season",
            description: "",
            iconId: "",
            startsAt: "2026-01-01T00:00:00Z",
            endsAt: "2026-12-31T23:59:59Z",
            tracks: [
              {
                id: "tee-track",
                name: "Free",
                kind: "free",
                tiers: [
                  {
                    tier: 1,
                    xpRequired: 100,
                    rewardItemId: "",
                    rewardCount: 1,
                    rewardCurrencyAmount: 0,
                    rewardCurrencyId: "gold",
                    label: "",
                  },
                ],
              },
            ],
            challenges: [],
            premiumPassPrice: 0,
            premiumPassCurrencyId: "gold",
            endBehavior: {
              mailUnclaimedRewards: true,
              resetXp: true,
              gracePeriodDays: 7,
              snapshotLeaderboard: true,
            },
            themeColor: "",
          },
        ],
        worldEvents: [
          {
            id: "tee-event",
            name: "Tee Event",
            description: "",
            iconId: "",
            category: "invasion",
            markerColor: "",
            trigger: { kind: "manual" },
            minPlayers: 1,
            maxPlayers: 40,
            minLevel: 1,
            maxLevel: 100,
            zoneId: "tee-zone",
            phases: [
              {
                id: "tee-phase",
                name: "Start",
                description: "",
                objectiveText: "",
                durationSec: 60,
                nextOnSuccess: "",
                nextOnFailure: "",
                spawnNpcIds: [],
                cinematicId: "",
              },
            ],
            startPhaseId: "tee-phase",
            participationTiers: [
              {
                id: "tee-tier",
                name: "All",
                minContribution: 0,
                lootTableId: "tee-loot",
                xpReward: 0,
              },
            ],
            rewardLockoutHours: 0,
            crossServer: false,
            broadcastToWorld: false,
          },
        ],
        skyboxAtmosphere: {
          activeSkyboxId: "tee-sky",
          skyboxes: [
            {
              id: "tee-sky",
              name: "Tee Sky",
              description: "",
              sun: {
                direction: { x: 0, y: 1, z: 0 },
                color: "#ffffff",
                angularDiameterDeg: 0.53,
                intensity: 1,
              },
              moon: {
                direction: { x: 0, y: -1, z: 0 },
                color: "#e6ecff",
                angularDiameterDeg: 0.5,
                intensity: 0.05,
                textureId: "",
                phase: 0.5,
              },
              stars: {
                count: 2000,
                brightness: 0.7,
                twinkleSpeed: 0.5,
                seed: 1,
                visibleWindow: { t0: 0.75, t1: 0.25 },
              },
              cloudLayers: [],
              atmosphere: {
                planetRadiusKm: 6371,
                atmosphereHeightKm: 100,
                rayleighCoefficient: { r: 0.005, g: 0.013, b: 0.033 },
                rayleighScaleHeightKm: 8,
                mieCoefficient: 0.004,
                mieScaleHeightKm: 1.2,
                mieG: 0.76,
                ozoneCoefficient: {
                  r: 0.00065,
                  g: 0.00188,
                  b: 0.000085,
                },
              },
              gradient: {
                horizonColor: "#b0c4e0",
                zenithColor: "#2a4a8a",
                blendExponent: 2,
              },
            },
          ],
        },
        particleGraph: [
          {
            id: "teeParticles",
            name: "Tee Particles",
            description: "",
            emitter: {
              rate: 0,
              burstCount: 10,
              particleLifetimeSec: { min: 1, max: 1 },
              systemLifetimeSec: 0,
              loop: true,
              maxParticles: 2000,
              simulationSpace: "world",
              spawnShape: { kind: "point" },
            },
            initializers: [
              {
                kind: "velocity-cone",
                angleDeg: 30,
                speed: { min: 1, max: 1 },
              },
            ],
            updaters: [],
            renderer: {
              kind: "billboard",
              textureId: "tex.tee",
              blendMode: "additive",
              softParticles: true,
            },
          },
        ],
        voiceChat: {
          enabled: true,
          rooms: [
            {
              id: "teeRoom",
              name: "Tee Room",
              description: "",
              scope: "party",
              customKey: "",
              defaultTransmissionMode: "voiceActivation",
              maxSpeakers: 0,
              maxParticipants: 0,
              minSpeakLevel: 0,
            },
          ],
          muteDefaults: {
            startMuted: false,
            startDeafened: false,
            allowPerRoomSelfMute: true,
            allowIndividualMute: true,
            maxIndividualMutes: 0,
          },
          autoMute: {
            muteUntilAccountAgeDays: 0,
            muteBelowCharacterLevel: 0,
            muteOnOpenReports: 0,
            openReportsLookbackHours: 24,
          },
          codec: {
            codec: "opus",
            maxBitrateKbps: 32,
            forwardErrorCorrection: true,
            noiseSuppression: true,
            echoCancellation: true,
            discontinuousTransmission: true,
          },
          voiceActivation: {
            thresholdDb: -40,
            releaseMs: 200,
            attackMs: 20,
          },
          forcePushToTalk: false,
          recordForModeration: false,
          moderationRecordingRetentionHours: 0,
        },
        partyGuild: {
          party: {
            maxMembers: 6,
            lootPolicy: "round-robin",
            xpPolicy: "proximity-share",
            xpShareRangeMeters: 50,
            idleAutoDisbandMinutes: 30,
            showOnMinimap: true,
            partyChannelId: "party",
          },
          guild: {
            maxMembers: 200,
            maxLevel: 30,
            xpPerLevel: 10000,
            minNameLength: 3,
            maxNameLength: 24,
            alliancesEnabled: true,
            maxAllies: 3,
            guildWarsEnabled: false,
            rejoinCooldownHours: 24,
          },
          ranks: [
            {
              id: "teeLeader",
              name: "Tee Leader",
              description: "",
              order: 0,
              permissions: [],
              maxHolders: 0,
            },
          ],
          perks: [],
          defaultRankId: "teeLeader",
          leaderRankId: "teeLeader",
        },
        navMesh: {
          quality: "medium",
          cellSize: 0.3,
          cellHeight: 0.2,
          minRegionAreaSqMeters: 1,
          tileSizeVoxels: 64,
          agents: [
            {
              id: "teeAgent",
              name: "Tee Agent",
              radius: 0.3,
              height: 1.8,
              maxStep: 0.4,
              maxSlopeDeg: 45,
              areaTags: [],
            },
          ],
          modifierVolumes: [],
          jumpLinks: [],
        },
        lightingBake: {
          quality: "medium",
          lightmapResolutionTexelsPerMeter: 4,
          lightmapFormat: "rgb16f",
          lightmapPaddingTexels: 4,
          lightmapMaxAtlasSize: 4096,
          ao: {
            enabled: true,
            radius: 2,
            samples: 128,
            intensity: 1,
          },
          gi: {
            enabled: true,
            bounces: 3,
            samples: 256,
            intensity: 1,
          },
          lightprobeVolumes: [],
          levelOverrides: [],
          skipBake: false,
        },
        levelStreaming: [
          {
            id: "teeSublevel",
            name: "Tee Sublevel",
            description: "",
            sourcePath: "sublevels/tee.json",
            policy: "always-loaded",
            priority: "normal",
            unloadPaddingMeters: 25,
            playerCap: 0,
            dependsOn: [],
            tags: [],
          },
        ],
        prefab: {
          prefabs: [
            {
              id: "teePrefab",
              name: "Tee Prefab",
              description: "",
              tags: [],
              entities: [
                {
                  localId: "root",
                  entityType: "static-mesh",
                  transform: {
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0, w: 1 },
                    scale: { x: 1, y: 1, z: 1 },
                  },
                  properties: {},
                  nestedPrefabId: "",
                },
              ],
            },
          ],
          instances: [],
        },
        cinematic: [
          {
            id: "teeCinematic",
            name: "Tee Cinematic",
            description: "",
            durationSec: 5,
            skippable: true,
            lockInput: true,
            tracks: [
              {
                kind: "event",
                id: "teeTrack",
                events: [{ time: 0, event: "noop", params: {} }],
              },
            ],
          },
        ],
        postProcessVolumes: [
          {
            id: "teeVolume",
            name: "Tee Volume",
            priority: 0,
            blendDistanceMeters: 0,
            blendWeight: 1,
            enabled: true,
            shape: { kind: "unbounded" },
            overrides: { exposureBiasStops: 0.5 },
          },
        ],
        accessibility: {
          fontScale: 1.25,
          motion: "reduced",
          colorBlindMode: "none",
          highContrast: false,
          dyslexiaFriendlyFont: false,
          subtitles: {
            enabled: true,
            scale: 1.0,
            backgroundOpacity: 0.5,
            showSpeaker: true,
            showSoundCues: false,
          },
          inputAssist: {
            targetAssist: false,
            autoHold: false,
            autoTap: false,
            inputDebounceMs: 0,
          },
          cameraEffectIntensity: 1,
          screenReaderAnnouncements: false,
        },
        featureFlags: {
          enabled: true,
          rules: [
            {
              id: "teeRule",
              rolloutPercent: 100,
              minAccountAgeDays: 0,
              minCharacterLevel: 0,
              platforms: [],
              regionPrefixes: [],
              allowAccountIds: [],
              blockAccountIds: [],
            },
          ],
          flags: [
            {
              id: "teeFlag",
              description: "",
              body: {
                kind: "boolean",
                enabledForRuleIds: ["teeRule"],
                defaultEnabled: false,
              },
            },
          ],
          mutexGroups: [],
        },
        physicsConfig: {
          enabled: true,
          simulation: {
            gravity: { x: 0, y: -9.81, z: 0 },
            fixedDeltaSec: 1 / 60,
            maxSubsteps: 4,
            maxAccumulatedSec: 0.25,
          },
          solver: {
            positionIterations: 4,
            velocityIterations: 1,
            deterministic: false,
          },
          sleep: {
            linearThreshold: 0.05,
            stabilizationFrames: 15,
            allowSleep: true,
          },
          ccd: {
            enabled: false,
            minLinearVelocityMPerS: 10,
            maxPasses: 1,
          },
          materials: [],
          layers: [
            {
              id: "teeLayer",
              name: "Tee Layer",
              description: "",
            },
          ],
          defaultInteraction: "collide",
          matrix: [],
        },
        respawn: {
          enabled: true,
          bindPoints: [
            {
              id: "teeBind",
              name: "Tee Bind",
              description: "",
              iconId: "",
              kind: "graveyard",
              zoneId: "teeZone",
              position: { x: 0, y: 0, z: 0 },
              facingYawRadians: 0,
              allowBindHere: true,
              corpseRunAllowed: true,
              applyResurrectionSickness: true,
              minCharacterLevel: 0,
              factionAllowList: [],
              customKey: "",
            },
          ],
          deathPenalty: {
            xpLossFractionOfLevel: 0,
            xpLossCanDelevel: false,
            goldLossFraction: 0,
            goldLossMaxCurrency: 0,
            durabilityLossFraction: 0.1,
            dropItemsOnDeath: false,
            maxItemsDropped: 0,
            dropPolicy: "none",
            dropGraceSec: 60,
          },
          corpseRun: {
            enabled: true,
            ghostSpeedMultiplier: 1.25,
            ghostInvisibleToEnemies: true,
            ghostInvulnerable: true,
            corpseDespawnMinutes: 120,
            corpseLootableByOthers: false,
            resurrectOnProximityMeters: 3,
            allowCorpseTeleport: false,
          },
          resurrection: {
            sicknessMinutes: 10,
            sicknessStatReductionFraction: 0.75,
            allowInstantResByAbility: true,
            autoResAtBindAfterSec: 30,
            allowSpiritGuideRes: false,
            sicknessMinCharacterLevel: 10,
          },
        },
        talentTrees: {
          enabled: true,
          trees: [
            {
              id: "teeTree",
              name: "Tee Tree",
              description: "",
              iconId: "",
              kind: "class",
              customKey: "",
              ownerRef: "",
              totalPointsAvailable: 30,
              tierPointRequirement: 5,
              nodes: [
                {
                  id: "teeNode",
                  name: "Tee Node",
                  description: "",
                  iconId: "",
                  kind: "statBoost",
                  tier: 0,
                  maxPoints: 1,
                  costPerPoint: 1,
                  prerequisites: [],
                  abilityRef: "",
                  statusEffectRef: "",
                  keystoneTags: [],
                  gridX: 0,
                  gridY: 0,
                  exclusiveWithSiblings: false,
                },
              ],
              allowRespec: true,
            },
          ],
          respec: {
            enabled: true,
            baseCostCurrency: 1000,
            costCurrencyId: "gold",
            costMultiplierPerUse: 1.5,
            freeRespecsPerWeek: 1,
            respecCooldownHours: 0,
            allowPartialRespec: true,
          },
        },
        auctionHouse: {
          enabled: true,
          listing: {
            model: "bidAndBuyout",
            durationsHours: [12, 24, 48],
            depositFraction: 0.05,
            depositMinimumCurrency: 100,
            maxListingsPerCharacter: 50,
            maxListingsPerAccount: 200,
            minReservePriceCurrency: 1,
            maxListingPriceCurrency: 0,
            allowStacks: true,
            maxStackSize: 1000,
            expiryPolicy: "returnToSeller",
          },
          bidding: {
            minIncrementFraction: 0.05,
            minIncrementCurrencyFloor: 10,
            antiSnipeWindowSec: 300,
            antiSnipeExtensionSec: 300,
            refundOutbidImmediately: true,
            showBidderIdentityToSeller: false,
          },
          cancellation: {
            allowCancellation: true,
            forfeitDepositOnCancel: true,
            cancelBlockedWithinMinutesOfExpiry: 30,
            refundOutstandingBids: true,
          },
          fees: {
            commissionFraction: 0.05,
            currencyId: "gold",
            allowPremiumCurrency: false,
            enforceDailyRevenueCap: false,
            dailyRevenueCapCurrency: 1_000_000,
          },
          search: {
            pageSize: 50,
            minQueryLength: 2,
            maxQueriesPerMinute: 30,
            showSellerIdentity: true,
            allowPublicReadApi: false,
          },
          antiManipulation: {
            flagOverpricedFraction: 0,
            flagRapidListCancelSec: 300,
            flagSelfBidding: true,
            selfBidPolicy: "log",
          },
        },
        crashReporter: {
          enabled: true,
          sinks: [
            {
              id: "teeSink",
              name: "Tee Sink",
              kind: "http",
              customKey: "",
              endpointNameRef: "teeEndpoint",
              minSeverity: "error",
              maxReportsPerHour: 60,
              samplingFraction: 1,
              maxRetryAttempts: 3,
              retryBackoffSec: 2,
              includeSystemInfo: true,
              includeBreadcrumbs: true,
            },
          ],
          symbolication: {
            enabled: true,
            stripLocalPaths: true,
            pathPlaceholder: "<redacted>",
            maxFrames: 100,
          },
          breadcrumbs: {
            enabled: true,
            maxEntries: 200,
            maxBytesPerEntry: 512,
            minSeverity: "info",
          },
          pii: {
            alwaysRedact: [],
            defaultRedact: [],
            customRegexes: [],
          },
          consent: {
            requireOptIn: false,
            allowAnonymousReports: true,
          },
          globalMinSeverity: "warning",
          dedupeInFlight: true,
          dedupeWindowSec: 60,
        },
        pushNotifications: {
          enabled: true,
          channels: [
            {
              id: "teeChannel",
              name: "Tee Channel",
              transport: "inApp",
              credentialsNameRef: "",
              maxMessagesPerHour: 0,
              maxAgeSec: 3600,
              enabled: true,
            },
          ],
          categories: [
            {
              id: "teeCategory",
              titleLocalizationKey: "tee.title",
              descriptionLocalizationKey: "",
              playerToggleable: true,
              defaultEnabled: true,
              priority: "normal",
              channelIds: ["teeChannel"],
              respectQuietHours: true,
              collapseKey: "",
            },
          ],
          quietHours: {
            enabled: false,
            defaultStartLocal: "22:00",
            defaultEndLocal: "08:00",
            criticalAlwaysDelivers: true,
            allowUserOverride: true,
          },
          consent: {
            requireOptIn: true,
            allowGlobalOptOut: true,
          },
          globalMaxMessagesPerHour: 0,
          deduplicateWindowSec: 30,
        },
        licenseAgreements: {
          enabled: true,
          documents: [
            {
              id: "teeEula",
              name: "Tee EULA",
              description: "",
              kind: "eula",
              customKey: "",
              gate: "beforeFirstLogin",
              revocation: "revocableAnyTime",
              minimumAgeYears: 0,
              allowGuardianConsent: true,
              currentVersion: "1.0.0",
              versions: [
                {
                  version: "1.0.0",
                  changelog: "",
                  publishedAtIso: "2026-01-01T00:00:00Z",
                  requiresReAcceptance: true,
                  variants: [
                    {
                      jurisdiction: "global",
                      bodyAssetRef: "teeEulaBody",
                      localeCode: "en",
                      effectiveAtIso: "",
                    },
                  ],
                },
              ],
            },
          ],
          consentFlow: {
            blockLoginOnPending: true,
            batchPrompts: true,
            declineReDisplayDays: 7,
            requireSignedAcceptance: true,
            auditRetentionDays: 730,
          },
        },
        moderation: {
          enabled: true,
          reportCategories: [
            {
              id: "teeCategory",
              name: "Tee Category",
              description: "",
              iconId: "",
              playerVisible: true,
              priority: 50,
              defaultAction: "warn",
              requiresHumanReview: true,
              triggersReporterCooldown: false,
            },
          ],
          filterRules: [],
          sanctionLadders: [
            {
              categoryId: "teeCategory",
              tiers: [
                {
                  atOffenseCount: 1,
                  action: "warn",
                  durationMinutes: 60,
                },
              ],
            },
          ],
          reportRateLimits: {
            maxReportsPerHour: 20,
            maxReportsPerDay: 100,
            cooldownBetweenReportsSec: 30,
            maxUniqueTargetsPerHour: 10,
            requireEvidenceText: false,
            minEvidenceTextLength: 10,
            allowAnonymous: true,
          },
          autoModeration: {
            enabled: true,
            windowHours: 24,
            demoteNoisyReporters: true,
            noisyReporterDismissFraction: 0.5,
            noisyReporterMinReports: 10,
          },
          appeals: {
            enabled: true,
            maxAppealsPerSanction: 1,
            cooldownHoursBeforeFiling: 24,
            minExplanationLength: 50,
            responseSlaHours: 72,
            autoRejectAfterMax: true,
          },
          banPolicy: {
            allowIpBan: false,
            allowHardwareBan: false,
            retainReadOnlyAccess: true,
            postBanItemHoldHours: 720,
            showReasonInBanNotice: true,
            cascadeToLinkedAccounts: false,
          },
        },
        parentalControls: {
          enabled: true,
          profiles: [
            {
              id: "teeProfile",
              name: "Tee Profile",
              description: "",
              minAccountAgeYears: 13,
              maxAccountAgeYearsExclusive: 0,
              priority: 50,
              requireGuardianAccount: false,
              playTime: {
                maxMinutesPerDay: 0,
                maxMinutesPerWeekendDay: 0,
                maxMinutesPerWeek: 0,
                allowedStartHourLocal: 0,
                allowedEndHourLocal: 24,
                breakReminderIntervalMin: 0,
                breakDurationMin: 0,
              },
              spend: {
                allowPurchases: true,
                maxSpendPerDayMinorUnit: 0,
                maxSpendPerWeekMinorUnit: 0,
                maxSpendPerMonthMinorUnit: 0,
                maxSingleTransactionMinorUnit: 0,
                requireGuardianApproval: false,
              },
              communication: {
                allowedChatScopes: [],
                allowWhispers: true,
                allowFriendRequests: true,
                allowVoiceChat: true,
                allowedVoiceModes: [],
                forceFamilyFriendlyFilter: false,
                restrictToFriendsOnly: false,
              },
              content: {
                suppressBloodAndGore: false,
                suppressProfanity: false,
                suppressSubstances: false,
                suppressMatureThemes: false,
                softenScareEffects: false,
                allowMarketplace: true,
              },
            },
          ],
          guardian: {
            enabled: false,
            requireEmailVerification: true,
            approvalTimeoutMin: 1440,
            sendWeeklySummary: true,
            notifyOnPurchaseAttempt: true,
            notifyOnFriendRequest: false,
          },
          allowAdultOptIn: true,
        },
        fastTravel: {
          global: {
            enabled: true,
            blockedInCombat: true,
            blockedWhilePvPFlagged: false,
            blockedInInstancedContent: true,
            globalCooldownSec: 5,
            channelTimeSec: 10,
            cancelChannelOnDamage: true,
            maxHearthBindings: 1,
            allowDestinationSummon: false,
          },
          nodes: [
            {
              id: "teeNode",
              name: "Tee Node",
              description: "",
              iconId: "",
              kind: "flightMaster",
              customKey: "",
              zoneId: "teeZone",
              position: { x: 0, y: 0, z: 0 },
              continentTag: "",
              unlock: {
                requiresVisit: true,
                requiresQuestId: "",
                requiresAchievementId: "",
                minCharacterLevel: 0,
                requiresReputation: { factionId: "", minStanding: 0 },
              },
              neutralToAllFactions: false,
              factionAllowList: [],
              perUseCooldownSec: 0,
              useCostCurrency: 0,
              useCostCurrencyId: "gold",
              shareDiscoveryWithParty: false,
              discoveryXpReward: 0,
            },
          ],
          edges: [],
        },
        friendsSocial: {
          enabled: true,
          friends: {
            maxFriends: 100,
            scope: "perAccount",
            autoAcceptFromSameGuild: false,
            allowCrossFaction: true,
            allowCrossRealm: true,
            friendRequestExpireHours: 72,
            maxNoteLength: 120,
            allowOfflineMessages: true,
            maxOfflineMessagesPerSender: 5,
          },
          ignore: {
            maxIgnored: 50,
            scope: "perAccount",
            expireAfterDays: 0,
            blocksAllInteractions: true,
            transparentToBlocked: false,
          },
          recent: {
            enabled: true,
            maxEntries: 50,
            retentionHours: 72,
            recordPartyMembers: true,
            recordFinderGroups: true,
            recordPvpEncounters: false,
          },
          onlineStatus: {
            defaultVisibility: "online",
            allowPlayerOverride: true,
            broadcastOfflineEdge: true,
            broadcastOnlineEdge: true,
            broadcastToGuild: true,
            showZoneToFriends: true,
            showLastSeenToFriends: true,
          },
        },
        housing: {
          enabled: true,
          maxPlotsPerCharacter: 1,
          maxPlotsPerAccount: 3,
          plotTypes: [
            {
              id: "teePlot",
              name: "Tee Plot",
              description: "",
              iconId: "",
              category: "cottage",
              widthMeters: 10,
              depthMeters: 10,
              heightMeters: 20,
              slots: {
                interior: 100,
                exterior: 50,
                lighting: 20,
                customMedia: 0,
              },
              visitorCap: 20,
              purchaseCost: 0,
              purchaseCurrencyId: "gold",
              upkeepCost: 0,
              minCharacterLevel: 1,
              transferable: true,
              instanced: true,
            },
          ],
          customization: {
            allowDecoration: true,
            allowStructuralSkins: true,
            allowStructuralEdits: false,
            allowDecorationClipping: false,
            maxStackHeightMeters: 10,
            maxSessionMinutes: 120,
          },
          permissions: {
            maxCoOwners: 1,
            maxFriendEntries: 100,
            maxBlockEntries: 50,
            allowPublicListing: true,
            allowPublicBio: true,
            publicPlotsAutoOpenDoors: true,
          },
          upkeep: {
            cyclePeriodDays: 7,
            gracePeriodDays: 14,
            reclaimAfterDays: 30,
            returnDecorationsOnReclaim: true,
            sendUpkeepWarnings: true,
            upkeepWarningDaysAhead: 3,
          },
          visitors: {
            visitorsCanInteract: true,
            allowGuestbook: true,
            maxGuestbookEntries: 200,
            combatPolicy: "block",
          },
        },
        loadouts: {
          enabled: true,
          maxSlotsPerCharacter: 10,
          freeSlotCount: 3,
          slot: {
            categories: ["equipment", "abilities"],
            fullReplacement: true,
            pullFromBags: true,
            pullFromBank: false,
          },
          naming: {
            maxNameLength: 24,
            enforceProfanityFilter: true,
            iconPresetCount: 24,
          },
          swap: {
            policy: "outOfCombat",
            cooldownSec: 10,
            channelTimeSec: 0,
            cancelChannelOnDamage: false,
            autoRestoreOnRespawn: false,
          },
          sharing: {
            allowExport: true,
            allowImport: true,
            allowPartyShare: false,
          },
        },
        avatars: {
          $schema: "hyperforge.avatars.v1",
          avatars: [
            {
              id: "teeAvatar",
              name: "Tee Avatar",
              url: "asset://avatars/tee.vrm",
              previewPath: "/previews/tee.png",
            },
          ],
          lodDistances: {
            lod0ToLod1: 10,
            lod1ToLod2: 40,
          },
        },
        playerEmotes: {
          $schema: "hyperforge.player-emotes.v1",
          emotes: {
            teeIdle: "asset://emotes/tee-idle.glb",
          },
          essentialEmoteKeys: ["teeIdle"],
        },
        spellVisuals: {
          $schema: "hyperforge.spell-visuals.v1",
          spells: {
            teeSpell: {
              color: 0xff00ff,
              size: 0.5,
              glowIntensity: 0.75,
            },
          },
          arrows: {
            default: {
              shaftColor: 0x8b4513,
              headColor: 0xcccccc,
              fletchingColor: 0xffffff,
              length: 1.0,
              width: 0.05,
              rotateToDirection: true,
              arcHeight: 0,
            },
          },
          fallbackSpell: {
            color: 0x800080,
            size: 0.4,
            glowIntensity: 0.5,
          },
        },
        skillIcons: {
          $schema: "hyperforge.skill-icons.v1",
          definitions: [
            {
              key: "teeSkill",
              label: "Tee Skill",
              icon: "🎯",
              category: "combat",
              defaultLevel: 1,
            },
          ],
          icons: { teeSkill: "🎯" },
          fallbackIcon: "❓",
        },
        commerce: {
          $schema: "hyperforge.commerce.v1",
          defaultBuybackRate: 0.5,
          bankStorageUnlimited: -1,
          storeUnlimitedStock: -1,
          interactionRange: 3,
          starterStoreItemIds: ["teeStarterItem"],
        },
        storeFront: {
          enabled: true,
          priceTiers: [
            {
              id: "teeTier",
              displayFormatKey: "USD_CENTS",
              canonicalAmountCents: 499,
              regionAmounts: [],
            },
          ],
          bundles: [
            {
              id: "teeBundle",
              titleLocalizationKey: "bundle.tee.title",
              descriptionLocalizationKey: "",
              heroAssetRef: "teeHero",
              priceTierId: "teeTier",
              entitlementIds: ["teeEntitlement"],
              categoryTag: "",
              minAgeYears: 0,
              publishAtIso: "",
              expireAtIso: "",
              maxPurchasesPerPlayer: 0,
            },
          ],
          shelves: [
            {
              id: "teeShelf",
              titleLocalizationKey: "shelf.tee.title",
              bundleIds: ["teeBundle"],
              displayOrder: 0,
            },
          ],
          discountRules: [],
          globalDailySpendCapCents: 0,
          requiresLicenseAgreement: true,
        },
        onboardingGoals: {
          enabled: true,
          goals: [
            {
              id: "teeGoal",
              titleLocalizationKey: "goal.tee.title",
              descriptionLocalizationKey: "",
              displayOrder: 0,
              prerequisites: [],
              criteria: [
                { kind: "openInventory", targetKey: "", requiredCount: 1 },
              ],
              rewards: [],
              playerCanSkip: true,
              showInTracker: true,
            },
          ],
          abort: {
            allowSkipEntireOnboarding: false,
            requireConfirmOnSkip: true,
            gracePeriodSec: 0,
          },
          showTracker: true,
          trackerTitleLocalizationKey: "onboarding.tracker.title",
        },
        credits: {
          enabled: true,
          sections: [
            {
              id: "teeSection",
              titleLocalizationKey: "credits.tee.title",
              entries: [
                {
                  id: "teeEntry",
                  kind: "sectionHeader",
                  primaryLocalizationKey: "credits.tee.header",
                  secondaryLocalizationKey: "",
                  alignment: "center",
                  linkUrlKey: "",
                  verticalSpacingMultiplier: 1,
                },
              ],
              displayOrder: 0,
            },
          ],
          scroll: {
            scrollSpeedPxPerSec: 60,
            fadeInMs: 500,
            fadeOutMs: 500,
            allowSkip: true,
            allowSpeedUp: true,
            speedUpMultiplier: 3,
          },
          copyrightLocalizationKey: "",
        },
        mainMenu: {
          enabled: true,
          rootMenuId: "teeRootMenu",
          menus: [
            {
              id: "teeRootMenu",
              titleLocalizationKey: "menu.tee.root",
              entries: [
                {
                  id: "teeEntry",
                  labelLocalizationKey: "menu.tee.start",
                  descriptionLocalizationKey: "",
                  action: "startNewGame",
                  submenuId: "",
                  actionKey: "",
                  visibility: { kind: "always", argKey: "" },
                  displayOrder: 0,
                  greyWhenHidden: false,
                },
              ],
              showBackButton: false,
              backgroundBlur: 0,
            },
          ],
          allowGamepad: true,
          allowMouse: true,
          allowKeyboard: true,
        },
        tooltips: {
          enabled: true,
          entries: [
            {
              id: "teeTooltip",
              titleLocalizationKey: "tooltip.tee.title",
              bodyLocalizationKey: "tooltip.tee.body",
              ariaLocalizationKey: "",
              trigger: "hover",
              placement: "auto",
              showDelayMs: 400,
              hideDelayMs: 100,
              maxWidthPx: 320,
              iconAssetRef: "",
              categoryTag: "",
              maxShowsPerPlayer: 0,
            },
          ],
          defaultShowDelayMs: 400,
          defaultHideDelayMs: 100,
          defaultMaxWidthPx: 320,
          respectReducedMotionPreference: true,
        },
        keyPromptIcons: {
          enabled: true,
          families: [
            {
              kind: "keyboard",
              themeName: "light",
              scaleMultiplier: 1,
            },
          ],
          glyphs: [
            {
              deviceKind: "keyboard",
              inputCode: "KeyA",
              iconAssetRef: "hyperforge:keyboard/a.svg",
              fallbackLabel: "A",
              renderWidthPx: 24,
              renderHeightPx: 24,
            },
          ],
          fallbackDeviceKind: "keyboard",
        },
        loadingScreens: {
          enabled: true,
          slates: [
            {
              id: "teeSlate",
              backgroundAssetRef: "hyperforge:loading/tee.png",
              backgroundMotion: "static",
              titleLocalizationKey: "loading.tee.title",
              subtitleLocalizationKey: "",
              tipLocalizationKeys: [],
              tipRotationIntervalSec: 5,
              progressBarStyle: "indeterminate",
              minDisplayMs: 500,
              maxDisplayMs: 0,
              zoneIds: [],
              triggers: [],
              selectionWeight: 1,
              categoryTag: "",
            },
          ],
          defaultSlateId: "teeSlate",
          fades: {
            fadeInMs: 200,
            fadeOutMs: 300,
            backgroundColorHex: "#000000",
          },
          showTips: true,
          showProgressBar: true,
        },
        haptics: [
          {
            id: "teeRumble",
            name: "Tee Rumble",
            description: "",
            category: "combat",
            stages: [
              {
                channel: "both",
                durationMs: 100,
                startAmplitude: 1,
                endAmplitude: 0,
                envelope: "linear",
                frequencyHz: 0,
              },
            ],
            intensityScale: 1,
            loop: false,
            loopGapMs: 0,
            cancellable: true,
            priority: 10,
          },
        ],
        tutorialFlows: [
          {
            id: "teeFlow",
            name: "Tee Flow",
            description: "",
            category: "general",
            autoStart: false,
            priority: 10,
            prerequisiteFlowIds: [],
            startStepId: "teeStep",
            steps: {
              teeStep: {
                id: "teeStep",
                titleKey: "tutorial.tee.title",
                bodyKey: "tutorial.tee.body",
                iconId: "",
                anchor: { kind: "screen-center" },
                completionTriggers: [{ kind: "manual-continue" }],
                nextStepId: "",
                skipToStepId: "",
                delaySec: 0,
                autoAdvanceSec: 0,
                skippableByUser: true,
              },
            },
          },
        ],
        inputActions: [
          {
            id: "teeJump",
            name: "Tee Jump",
            kind: "button",
            description: "",
            category: "",
            rebindable: true,
            defaults: [
              {
                source: "key",
                code: "Space",
                modifiers: [],
                scale: 1,
                scheme: "keyboard-mouse",
              },
            ],
          },
        ],
        skillUnlocks: {
          $schema: "hyperforge.skill-unlocks.v1",
          skills: {
            attack: [
              { level: 5, description: "Unlock tee blade", type: "item" },
            ],
          },
        },
        weaponStyles: {
          $schema: "hyperforge.weapon-styles.v1",
          styles: {
            sword: ["accurate", "aggressive"],
          },
        },
        ammunition: {
          $schema: "hyperforge.ammunition.v1",
          bowTiers: { teeBow: 1 },
          arrows: {
            teeArrow: {
              id: "teeArrow",
              name: "Tee Arrow",
              rangedStrength: 10,
              requiredRangedLevel: 1,
              requiredBowTier: 1,
            },
          },
        },
        editorSnap: {
          grid: { enabled: true, translate: 1.0, rotate: 15, scale: 0.1 },
          surface: {
            enabled: false,
            tolerance: 0.5,
            alignToNormal: true,
            mode: "surface",
          },
          gizmo: { space: "local", pivot: "center", size: 1.0 },
          snapByDefault: true,
        },
        projectSettings: {
          projectName: "TeeProject",
          gameModeId: "hyperia",
          plugins: [],
          renderProfile: {
            preset: "medium",
            targetFps: 60,
            resolutionScale: 1.0,
            antialiasing: "taa",
          },
          defaultInputScheme: "auto",
          defaultLocale: "en",
          worldSeed: "",
          pieFlags: {},
        },
        qualityPresets: [
          {
            id: "teePreset",
            name: "Tee Preset",
            description: "",
            shadowResolution: "1024",
            shadowDistance: 50,
            reflections: "cubemap",
            postProcess: {
              bloom: true,
              toneMapping: true,
              ssao: false,
              motionBlur: false,
              depthOfField: false,
              colorGrading: true,
              vignette: false,
            },
            particleDensity: 1,
            lodBias: 0,
            maxPixelRatio: 1,
            tag: "",
          },
        ],
        deployTargets: [
          {
            id: "tee-target",
            name: "Tee Target",
            description: "",
            provider: "railway",
            environment: "development",
            region: "us-east1",
            url: "",
            secrets: [],
            env: {},
            enabled: true,
            requireConfirmation: false,
            tags: [],
          },
        ],
        profilerOverlay: {
          enabled: false,
          anchor: "top-left",
          refreshMs: 250,
          backgroundOpacity: 0.6,
          fontScale: 1,
          groups: [
            {
              id: "tee-group",
              title: "Tee Group",
              collapsed: false,
              metrics: [
                {
                  id: "tee-metric",
                  label: "Tee Metric",
                  kind: "fps",
                  display: "text",
                  sampleWindow: 30,
                  visible: true,
                },
              ],
            },
          ],
        },
        replication: {
          components: [
            {
              component: "TeeComp",
              description: "",
              fields: [
                {
                  name: "teeField",
                  kind: "int",
                  authority: "server",
                  cadence: "on-change",
                  intervalMs: 100,
                  bits: 0,
                  relevancyFiltered: true,
                  description: "",
                },
              ],
            },
          ],
          events: [],
        },
        smithing: {
          $schema: "hyperforge.smithing.v1",
          items: {
            hammerItemId: "tee_hammer",
            coalItemId: "tee_coal",
          },
          timing: {
            defaultSmeltingTicks: 3,
            defaultSmithingTicks: 3,
          },
          validation: {
            maxQuantity: 100,
            minQuantity: 1,
            maxItemIdLength: 64,
          },
          messages: {
            alreadySmelting: "already smelting",
            noItems: "no items",
            noOres: "no ores",
            invalidBar: "invalid bar",
            levelTooLowSmelt: "level too low",
            smeltingStart: "smelting start",
            outOfMaterials: "out of materials",
            smeltSuccess: "smelt success",
            ironSmeltFail: "iron smelt fail",
            alreadySmithing: "already smithing",
            noHammer: "no hammer",
            noBars: "no bars",
            invalidRecipe: "invalid recipe",
            levelTooLowSmith: "level too low",
            smithingStart: "smithing start",
            outOfBars: "out of bars",
            smithSuccess: "smith success",
          },
        },
        processing: {
          $schema: "hyperforge.processing.v1",
          skillMechanics: {
            firemaking: {
              type: "fixed-roll-retry-on-fail",
              baseRollTicks: 4,
              retryOnFail: true,
              levelAffectsSuccess: true,
            },
            cooking: {
              type: "fixed-tick-continuous",
              ticksPerItem: 3,
              levelAffectsBurn: true,
              levelAffectsSpeed: false,
            },
          },
          firemakingSuccessRate: { low: 32, high: 256 },
          fire: {
            minDurationTicks: 60,
            maxDurationTicks: 240,
            maxFiresPerPlayer: 1,
            maxFiresPerArea: 8,
            interactionRange: 1.5,
          },
          fireWalkPriority: ["west", "east", "south", "north"],
          timing: { rateLimitMs: 500, minimumCycleTicks: 1 },
        },
        banking: {
          $schema: "hyperforge.banking.v1",
          sizes: {
            maxBankSlots: 400,
            slotsPerTab: 50,
            maxTabs: 8,
            defaultTabs: 1,
            defaultSlots: 50,
          },
          ui: { itemsPerRow: 8 },
          transactionLimits: {
            maxItemStack: 2147483647,
            minItemQuantity: 1,
          },
          errors: {
            bankFull: "bank full",
            invalidQuantity: "invalid quantity",
            itemNotFound: "item not found",
            insufficientQuantity: "insufficient quantity",
            invalidSlot: "invalid slot",
            noBankData: "no bank data",
            bankNotOpen: "bank not open",
            insufficientPouchCoins: "insufficient pouch coins",
            insufficientBankCoins: "insufficient bank coins",
            coinOverflow: "coin overflow",
          },
          messages: {
            itemDeposited: "item deposited",
            itemWithdrawn: "item withdrawn",
            bankOpened: "bank opened",
            bankClosed: "bank closed",
            coinsDeposited: "coins deposited",
            coinsWithdrawn: "coins withdrawn",
          },
        },
        arenaLayout: {
          $schema: "hyperforge.arena-layout.v1",
          arenaGrid: {
            baseX: 10,
            baseZ: 20,
            baseY: 0,
            width: 16,
            length: 16,
            gap: 2,
            columns: 2,
            rows: 2,
            count: 4,
            spawnOffset: 1,
          },
          lobby: { centerX: 0, centerZ: 0, width: 20, length: 20 },
          hospital: { centerX: 50, centerZ: 0, width: 10, length: 10 },
          lobbySpawn: { x: 0, y: 0, z: 0 },
        },
        lodSettings: {
          version: 1,
          distanceThresholds: {
            default: { lod1: 30, imposter: 80, fadeOut: 150 },
            "tee-category": { lod1: 15, imposter: 40, fadeOut: 80 },
          },
          dissolve: {
            closeRangeStart: 0,
            closeRangeEnd: 2,
            transitionDuration: 0.5,
          },
        },
        npcSizes: {
          $schema: "hyperforge.npc-sizes.v1",
          sizes: {
            "tee-boss": { width: 3, depth: 3 },
          },
        },
        duel: {
          $schema: "hyperforge.duel.v1",
          challengeTimeoutMs: 60000,
          rules: {
            "tee-rule": {
              label: "Tee Rule",
              description: "Tee rule description",
              incompatibleWith: [],
            },
          },
          equipmentSlots: {
            "tee-slot": { label: "Tee Slot", order: 0 },
          },
          duelSlotToEquipmentSlot: {
            "tee-slot": "weapon",
          },
        },
        tools: [
          {
            itemId: "tee_hatchet",
            skill: "woodcutting",
            tier: "bronze",
            levelRequired: 1,
            priority: 10,
          },
        ],
        stores: [
          {
            id: "tee-store",
            name: "Tee Store",
            buyback: true,
            buybackRate: 0.4,
            items: [
              {
                id: "tee-entry",
                itemId: "tee_item",
                name: "Tee Item",
                price: 100,
                stockQuantity: -1,
                restockTime: 0,
              },
            ],
            description: "Tee store description",
          },
        ],
        trees: {
          $schema: "hyperforge.trees.v1",
          trees: {
            oakish: {
              id: "tee_oakish",
              name: "Tee Oakish",
              levelRequired: 15,
            },
          },
        },
        biomes: [
          {
            id: "tee-biome",
            name: "Tee Biome",
            description: "Tee biome description",
            difficultyLevel: 2,
            terrain: "grass",
            resources: ["tee_oakish"],
            mobs: [],
            fogIntensity: 0.3,
            ambientSound: "ambient_tee",
            colorScheme: {
              primary: "#224422",
              secondary: "#336633",
              fog: "#aabbcc",
            },
            color: 0x224422,
            heightRange: [0, 50] as [number, number],
            terrainMultiplier: 1.0,
            waterLevel: 0,
            maxSlope: 0.8,
            mobTypes: [],
            difficulty: 2,
            baseHeight: 10,
            heightVariation: 5,
            resourceDensity: 0.4,
            resourceTypes: ["tree"],
            vegetation: {
              enabled: true,
              layers: [
                {
                  category: "teeLayer",
                  density: 0.25,
                  assets: ["tee_veg"],
                  minSpacing: 1.5,
                  clustering: false,
                  noiseScale: 0.1,
                  noiseThreshold: 0.5,
                },
              ],
            },
          },
        ],
        vegetation: {
          version: 1,
          description: "Tee vegetation catalog",
          assets: [
            {
              id: "tee_veg",
              model: "asset://tee_veg.glb",
              category: "teeLayer",
              baseScale: 1.0,
              scaleVariation: [0.8, 1.2] as [number, number],
              randomRotation: true,
              weight: 1.0,
              maxSlope: 0.5,
              alignToNormal: false,
              yOffset: 0,
            },
          ],
        },
        trading: {
          enabled: true,
          session: {
            confirmMode: "bothConfirm",
            confirmCountdownSec: 5,
            sessionTimeoutSec: 120,
            maxItemSlotsPerSide: 12,
            maxDistanceMeters: 5,
            autoCancelOnDistance: true,
            resetConfirmOnChange: true,
          },
          items: {
            blockSoulbound: true,
            allowBoaBetweenSameAccount: true,
            blockQuestItems: true,
            minGearScore: 0,
            minRarity: "",
            blockedItemIds: [],
          },
          currency: {
            allowPrimaryCurrency: true,
            maxCurrencyPerSide: 10000000,
            commission: 0,
            currencyId: "gold",
            blockPremiumCurrency: true,
          },
          eligibility: {
            allowCrossFaction: false,
            requireFriendship: false,
            minAccountAgeDays: 0,
            minCharacterLevel: 1,
            maxLevelGap: 0,
            blockIgnoredPlayers: true,
          },
          rateLimit: {
            maxTradesPerHour: 30,
            maxTradesPerDay: 200,
            minIntervalBetweenTradesSec: 3,
            maxRequestsPerHour: 60,
          },
          antiRmt: {
            asymmetryFlagThreshold: 0,
            logNewAccountTrades: true,
            logLargeCurrencyTrades: true,
            logCurrencyOnlyTrades: true,
            autoSuspendFlagThreshold: 0,
          },
        },
        itemSets: [
          {
            id: "teeSet",
            name: "Tee Set",
            description: "",
            iconId: "",
            category: "raid",
            tier: 1,
            minLevel: 1,
            maxLevel: 100,
            memberItemIds: ["teeHelm", "teeChest"],
            stages: [
              {
                requiredPieces: 2,
                label: "2-Piece Bonus",
                description: "",
                statModifiers: [{ stat: "strength", op: "add", value: 10 }],
                triggeredEffects: [],
              },
            ],
            color: "",
          },
        ],
        transmog: {
          global: {
            enabled: true,
            lockedSlots: [],
            accountWideByDefault: true,
            applyCostPerSlotCurrency: 500,
            applyCostCurrencyId: "gold",
            requireSourceInInventory: false,
            allowHideSlot: true,
            allowDye: true,
          },
          outfits: {
            enabled: true,
            maxOutfitsPerCharacter: 20,
            maxOutfitNameLength: 24,
            allowOutfitSharing: true,
          },
          sources: [
            {
              id: "teeHelmLook",
              name: "Tee Helm Look",
              description: "",
              iconId: "",
              slot: "helm",
              itemId: "teeHelm",
              displayAssetId: "teeHelmMesh",
              unlockModel: "onFirstAcquire",
              unlockScope: "perAccount",
              color: "",
              rarity: "",
              restriction: {
                raceAllowList: "all",
                classAllowList: "all",
                factionAllowList: "all",
              },
              vendorCost: 0,
              vendorCurrencyId: "gold",
              setTag: "",
            },
          ],
        },
        economyTuning: {
          currencies: [
            {
              id: "gold",
              name: "Gold",
              symbol: "g",
              description: "",
              iconId: "",
              cap: 0,
              tradeable: true,
              bankStored: true,
              keepOnDeath: true,
            },
          ],
          vendor: {
            vendorBuybackMultiplier: 0.4,
            vendorSellMultiplier: 1,
            stockRestockMinutes: 60,
            stockRestockFraction: 0.5,
            defaultCurrencyId: "gold",
          },
          costCurves: [
            {
              id: "teeRepairCurve",
              description: "",
              currencyId: "gold",
              base: 10,
              perLevel: 2,
              perTier: 5,
              min: 10,
              max: 10_000,
            },
          ],
          market: {
            enabled: true,
            currencyId: "gold",
            listingFee: 100,
            salesCommission: 0.05,
            maxListingsPerPlayer: 24,
            listingExpiryHours: 48,
            minListingPrice: 1,
          },
        },
        interaction: {
          $schema: "hyperforge.interaction.v1",
          sessionTypes: {
            store: "store",
            bank: "bank",
            dialogue: "dialogue",
          },
          interactionDistance: {
            store: 2,
            bank: 2,
            dialogue: 3,
          },
          transactionRateLimitMs: 250,
          sessionConfig: {
            validationIntervalTicks: 10,
            gracePeriodTicks: 5,
            maxSessionTicks: 600,
          },
          inputLimits: {
            maxItemIdLength: 64,
            maxStoreIdLength: 64,
            maxQuantity: 1_000_000,
            maxInventorySlots: 28,
            maxRequestAgeMs: 5000,
            maxClockSkewMs: 2000,
          },
        },
        newsFeed: {
          enabled: true,
          categories: [
            {
              id: "teePatchNotes",
              name: "Tee Patch Notes",
              description: "",
              color: "",
              visibleInFilters: true,
            },
          ],
          entries: [
            {
              id: "teeAnnouncement",
              titleLocalizationKey: "news.teeAnnouncement.title",
              summaryLocalizationKey: "",
              bodyAssetRef: "teeAnnouncementBody",
              categoryId: "teePatchNotes",
              priority: "normal",
              publishAtIso: "2026-04-21T00:00:00Z",
              expireAtIso: "",
              pinned: false,
              dismissable: true,
              trackReads: true,
              showUnreadBadge: true,
              deepLink: "",
              targeting: {
                platforms: [],
                regionPrefixes: [],
                minClientBuild: "",
                minCharacterLevel: 0,
                minAccountAgeDays: 0,
                requiresFlagId: "",
              },
              tags: [],
            },
          ],
          feed: {
            maxEntriesRetained: 100,
            pollIntervalMinutes: 30,
            autoShowOnLoginIfUnread: true,
            groupByCategory: false,
            allowUserOptOut: true,
          },
        },
        buildings: [
          {
            id: "teeBuilding",
            kind: "shop",
          },
        ],
        screenshot: {
          enabled: true,
          capture: {
            captureWidthPx: 0,
            captureHeightPx: 0,
            format: "png",
            qualityPercent: 90,
            hideHud: true,
            superResolutionMultiplier: 1,
          },
          photoMode: {
            enabled: true,
            allowTimeFreeze: true,
            allowFreeCamera: true,
            maxCameraDistanceMeters: 10,
            allowDepthOfFieldPicker: true,
            allowAspectPresets: true,
            defaultAspect: "auto",
          },
          watermark: {
            enabled: false,
            position: "none",
            textLocalizationKey: "",
            opacity: 0.8,
          },
          shareTargets: [
            {
              id: "teeDiskTarget",
              kind: "saveToDisk",
              labelLocalizationKey: "screenshot.saveToDisk",
              endpointNameRef: "",
              enabled: true,
            },
          ],
          maxCapturesPerMinute: 30,
        },
        serverBrowser: {
          enabled: true,
          filters: [
            {
              id: "teeRegionFilter",
              kind: "region",
              labelLocalizationKey: "serverBrowser.region",
              enabledByDefault: true,
              customKey: "",
              displayOrder: 10,
            },
          ],
          columns: [
            {
              column: "ping",
              labelLocalizationKey: "serverBrowser.ping",
              visibleByDefault: true,
              widthPx: 80,
              displayOrder: 0,
            },
            {
              column: "name",
              labelLocalizationKey: "serverBrowser.name",
              visibleByDefault: true,
              widthPx: 0,
              displayOrder: 1,
            },
          ],
          list: {
            maxResults: 200,
            autoRefreshIntervalSec: 30,
            maxFavorites: 20,
            maxHistoryEntries: 50,
            pingGoodMs: 80,
            pingOkMs: 200,
          },
          defaultSortColumn: "ping",
          defaultSortDirection: "ascending",
          allowPasswordProtected: true,
          allowDirectConnect: false,
        },
        equipment: {
          $schema: "hyperforge.equipment.v1",
          implementedSlots: ["weapon", "shield", "helmet"],
          bankEquipmentSlots: [
            {
              key: "weapon",
              label: "Weapon",
              icon: "icons/weapon.png",
              gridPosition: { row: 0, col: 0 },
            },
          ],
          bankEquipmentErrorMessages: {
            NOT_EQUIPABLE: "Item is not equipable.",
            REQUIREMENTS_NOT_MET: "Requirements not met.",
            SLOT_OCCUPIED: "Slot occupied.",
            INVENTORY_FULL: "Inventory full.",
            ITEM_NOT_FOUND: "Item not found.",
            TWO_HANDED_CONFLICT: "Two-handed conflict.",
            BANK_SESSION_INVALID: "Bank session invalid.",
            RATE_LIMITED: "Rate limited.",
            INVALID_REQUEST: "Invalid request.",
            BANK_FULL: "Bank full.",
          },
        },
        matchmakingTuning: {
          enabled: true,
          queues: [
            {
              id: "teeQueue",
              labelLocalizationKey: "matchmaking.teeQueue",
              playersPerSide: 3,
              numberOfSides: 2,
              skillModel: "elo",
              initialRatingHalfWidth: 100,
              wideningSchedule: [
                {
                  afterSec: 30,
                  ratingHalfWidth: 200,
                  allowCrossRegion: false,
                  maxPingMs: 0,
                },
              ],
              party: {
                minPartySize: 1,
                maxPartySize: 3,
                allowSoloWithParty: true,
                maxPartyRatingSpread: 200,
              },
              backfill: {
                enabled: false,
                maxGameProgressSec: 120,
                backfillRatingHalfWidth: 200,
                offerRewardMultiplier: 1,
              },
              preferSameRegion: true,
              hardTimeoutSec: 300,
              priority: 100,
            },
          ],
          maxConcurrentQueues: 2,
          dodgePenaltySec: 300,
          dodgePenaltyDecayWindowHours: 24,
        },
        aiBehavior: [
          {
            id: "teeTree",
            name: "Tee Tree",
            description: "",
            tickIntervalSeconds: 8,
            root: "teeRoot",
            nodes: {
              teeRoot: {
                id: "teeRoot",
                label: "",
                kind: "action",
                action: "idle",
                params: {},
              },
            },
          },
        ],
        analyticsEvents: [
          {
            name: "tee_event",
            category: "gameplay",
            description: "Tee analytics event",
            piiSafe: true,
            samplingRate: 1,
            props: [
              {
                name: "tee_prop",
                kind: "string",
                description: "",
                required: true,
                cardinality: "low",
                piiSafe: true,
              },
            ],
          },
        ],
        groupFinder: {
          enabled: true,
          content: [
            {
              id: "teeDungeon",
              name: "Tee Dungeon",
              description: "",
              iconId: "icons/tee.png",
              kind: "dungeon",
              minGroupSize: 3,
              maxGroupSize: 5,
              roleRequirements: [
                { role: "tank", count: 1 },
                { role: "healer", count: 1 },
                { role: "dps", count: 3 },
              ],
              queuePolicy: "random",
              minLevel: 10,
              maxLevel: 20,
              minGearScore: 0,
              allowPartyPremade: true,
              estimatedDurationMinutes: 20,
              minRating: 0,
              lockoutBucketId: "teeBucket",
            },
          ],
          matchmaking: {
            queueTimeoutSec: 1200,
            readyCheckTimeoutSec: 40,
            backfillEnabled: true,
            applyDeserterPenalty: true,
            deserterCooldownSec: 1800,
            roleIncentiveEnabled: true,
            wideningAfterMinutes: 10,
            allowCrossRealm: true,
            allowCrossFaction: false,
          },
          rewards: {
            firstDailyCompletionBonus: true,
            firstWeeklyCompletionBonus: true,
            completionSatchelEnabled: true,
            timeoutConsolationCurrency: 100,
            consolationCurrencyId: "gold",
            roleIncentiveSatchelEnabled: true,
          },
        },
        duelArenas: {
          arenas: [
            {
              arenaId: 1,
              center: { x: 0, z: 0 },
              size: 16,
              spawnPoints: [
                { x: -5, y: 0, z: 0 },
                { x: 5, y: 0, z: 0 },
              ],
              trapdoorPositions: [{ x: 0, z: 0 }],
            },
          ],
          lobby: {
            center: { x: 100, z: 100 },
            size: { width: 10, depth: 10 },
            spawnPoint: { x: 100, y: 0, z: 100 },
          },
          hospital: {
            center: { x: 200, z: 200 },
            size: { width: 10, depth: 10 },
            spawnPoint: { x: 200, y: 0, z: 200 },
          },
          constants: {
            arenaSize: 16,
            wallHeight: 4,
            wallThickness: 1,
            floorColor: "#888888",
            wallColor: "#555555",
            trapdoorColor: "#aa0000",
          },
        },
        combat: combatFixture,
        game: gameFixture,
        gathering: gatheringFixture,
        music: [
          {
            id: "tee-theme",
            name: "Tee Theme",
            type: "theme",
            category: "intro",
            path: "asset://tee-theme.mp3",
            description: "",
            duration: 120,
            mood: "heroic",
          },
        ],
        saveData: [
          {
            id: "teeSlice",
            name: "Tee Slice",
            description: "",
            scope: "character",
            version: 1,
            fields: [
              {
                name: "teeField",
                kind: "int",
                required: true,
                description: "",
                immutable: false,
              },
            ],
            migrations: [],
            periodicSnapshot: false,
            snapshotIntervalSec: 60,
          },
        ],
        worldStructure: {
          $schema: "hyperforge.world-structure.v1",
          constants: {
            gridSize: 1,
            defaultSpawnHeight: 0,
            waterLevel: 0,
            maxBuildHeight: 200,
            safeZoneRadius: 50,
          },
        },
        // Batch 28 — live-dispatch through StationDataProvider singleton.
        stations: {
          stations: [
            {
              type: "tee-station",
              name: "Tee Station",
              model: "asset://models/stations/tee.glb",
              modelScale: 1,
              modelYOffset: 0,
              examine: "Tee examine.",
              flattenGround: false,
              flattenPadding: 0.3,
              flattenBlendRadius: 0.5,
              footprint: { width: 2, depth: 2 },
            },
          ],
        },
        modelBounds: {
          generatedAt: new Date().toISOString(),
          tileSize: 1,
          models: [
            {
              id: "tee-model",
              assetPath: "asset://models/stations/tee.glb",
              bounds: {
                min: { x: -1, y: 0, z: -1 },
                max: { x: 1, y: 2, z: 1 },
              },
              dimensions: { x: 2, y: 2, z: 2 },
              footprint: { width: 2, depth: 2 },
            },
          ],
        },
      });

      // Live-dispatch-plus-tee: woodcutting.
      expect(woodcuttingProvider.isLoaded()).toBe(true);
      expect(woodcuttingProvider.getManifest()?.trees[0]?.id).toBe("tee-tree");
      expect(gatheringResources.hasTree("tee-tree")).toBe(true);

      // Live-dispatch-plus-tee: mining.
      expect(miningProvider.isLoaded()).toBe(true);
      expect(miningProvider.getManifest()?.rocks[0]?.id).toBe("tee-rock");
      expect(gatheringResources.hasRock("tee-rock")).toBe(true);

      // Live-dispatch-plus-tee: fishing.
      expect(fishingProvider.isLoaded()).toBe(true);
      expect(fishingProvider.getManifest()?.spots[0]?.id).toBe("tee-spot");
      expect(gatheringResources.hasFishingSpot("tee-spot")).toBe(true);

      // Live-dispatch-plus-tee: combat spells.
      expect(combatSpellsProvider.isLoaded()).toBe(true);
      expect(combatSpellsProvider.getManifest()?.standard.strike[0]?.id).toBe(
        "tee-strike",
      );
      expect(combatSpellsProvider.getManifest()?.standard.bolt[0]?.id).toBe(
        "tee-bolt",
      );

      // Live-dispatch: `NPC_SPAWN_CONSTANTS` rewritten in-place + tee.
      expect(NPC_SPAWN_CONSTANTS.GLOBAL_RESPAWN_TIME).toBe(999);
      expect(NPC_SPAWN_CONSTANTS.MAX_NPCS_PER_ZONE).toBe(42);
      expect(NPC_SPAWN_CONSTANTS.SPAWN_RADIUS_CHECK).toBe(13);
      expect(NPC_SPAWN_CONSTANTS.AGGRO_LEVEL_THRESHOLD).toBe(7);
      expect(npcsProvider.isLoaded()).toBe(true);

      // Boot-load-only tees: providers captured the payload.
      expect(questsProvider.isLoaded()).toBe(true);
      expect(pluginRegistryProvider.isLoaded()).toBe(true);
      expect(pluginRegistryProvider.getManifest()?.plugins).toEqual([]);
      // Live-dispatch: worldAreas now pushes through to the module-level
      // `worldAreasRegistry` singleton so any runtime consumer sees the
      // edit on the next lookup — in addition to the provider tee below.
      expect(worldAreasRegistry.has("tee-town")).toBe(true);
      expect(worldAreasRegistry.get("tee-town").name).toBe("Tee Town");
      expect(worldAreasRegistry.areaAt(0, 0)?.id).toBe("tee-town");

      // Tee: provider captured the payload for cold-boot persistence.
      expect(worldAreasProvider.isLoaded()).toBe(true);
      expect(
        worldAreasProvider.getManifest()?.starterTowns["tee-town"]?.name,
      ).toBe("Tee Town");

      // Live-dispatch: damageTypes pushes through to the module-level
      // `damageTypeRegistry` singleton. Any combat consumer that reads
      // through `damageTypeRegistry.resolveMultiplier(attacker, target)`
      // picks up the edit on the next lookup. The fixture sets a fire
      // vs ice multiplier of 2 — verify both the id index and the
      // resolved multiplier, plus the provider tee for cold-boot
      // persistence.
      expect(damageTypeRegistry.isLoaded()).toBe(true);
      expect(damageTypeRegistry.has("tee-fire")).toBe(true);
      expect(damageTypeRegistry.has("tee-ice")).toBe(true);
      expect(damageTypeRegistry.resolveMultiplier("tee-fire", "tee-ice")).toBe(
        2,
      );
      expect(damageTypesProvider.isLoaded()).toBe(true);
      expect(damageTypesProvider.getManifest()?.types[0]?.id).toBe("tee-fire");

      // Live-dispatch + tee for npcSchedule, xpCurves, renderProfiles:
      // each manifest pushes through to its module-level registry
      // singleton so any runtime consumer sees the edit on the next
      // lookup — plus the provider tee below for cold-boot restart
      // persistence.
      expect(npcScheduleRegistry.isLoaded()).toBe(true);
      expect(npcScheduleRegistry.has("tee-schedule")).toBe(true);
      expect(npcScheduleProvider.isLoaded()).toBe(true);
      expect(npcScheduleProvider.getManifest()?.[0]?.id).toBe("tee-schedule");

      expect(xpCurveRegistry.isLoaded()).toBe(true);
      expect(xpCurveRegistry.has("tee-curve")).toBe(true);
      expect(xpCurvesProvider.isLoaded()).toBe(true);
      expect(xpCurvesProvider.getManifest()?.[0]?.id).toBe("tee-curve");

      expect(renderProfileRegistry.isLoaded()).toBe(true);
      expect(renderProfileRegistry.has("tee-profile")).toBe(true);
      expect(renderProfilesProvider.isLoaded()).toBe(true);
      expect(renderProfilesProvider.getManifest()?.[0]?.id).toBe("tee-profile");

      // Live-dispatch + tee for sfx / vfx / animations. Each manifest
      // pushes through to its module-level registry singleton so the
      // audio/vfx/animation consumers see the edit on the next lookup —
      // plus provider tee for cold-boot restart persistence.
      expect(sfxRegistry.isLoaded()).toBe(true);
      expect(sfxRegistry.has("tee-sfx")).toBe(true);
      expect(soundEffectsProvider.isLoaded()).toBe(true);
      expect(soundEffectsProvider.getManifest()?.[0]?.id).toBe("tee-sfx");

      expect(vfxRegistry.isLoaded()).toBe(true);
      expect(vfxRegistry.has("tee-vfx")).toBe(true);
      expect(vfxProvider.isLoaded()).toBe(true);
      expect(vfxProvider.getManifest()?.[0]?.id).toBe("tee-vfx");

      expect(animationRegistry.isLoaded()).toBe(true);
      expect(animationRegistry.hasClip("tee-idle")).toBe(true);
      expect(animationsProvider.isLoaded()).toBe(true);
      expect(animationsProvider.getManifest()?.clips[0]?.id).toBe("tee-idle");

      // Live-dispatch + tee: camera profiles.
      expect(cameraProfileRegistry.isLoaded()).toBe(true);
      expect(cameraProfileRegistry.has("teeCam")).toBe(true);
      expect(cameraProfilesProvider.isLoaded()).toBe(true);
      expect(cameraProfilesProvider.getManifest()?.[0]?.id).toBe("teeCam");

      // Live-dispatch + tee: audio bus mix.
      expect(audioBusMixer.isLoaded()).toBe(true);
      expect(audioBusMixer.size).toBe(1);
      expect(audioBusMixProvider.isLoaded()).toBe(true);
      expect(audioBusMixProvider.getManifest()?.buses[0]?.id).toBe("master");

      // Live-dispatch + tee: interaction prompts.
      expect(interactionPromptRegistry.isLoaded()).toBe(true);
      expect(interactionPromptRegistry.has("teePrompt")).toBe(true);
      expect(interactionPromptsProvider.isLoaded()).toBe(true);
      expect(interactionPromptsProvider.getManifest()?.[0]?.id).toBe(
        "teePrompt",
      );

      // Live-dispatch + tee: chat channels.
      expect(chatChannelRegistry.isLoaded()).toBe(true);
      expect(chatChannelRegistry.has("teeChat")).toBe(true);
      expect(chatChannelsProvider.isLoaded()).toBe(true);
      expect(chatChannelsProvider.getManifest()?.channels[0]?.id).toBe(
        "teeChat",
      );

      // Live-dispatch + tee: music state machine.
      expect(musicStateMachineRegistry.isLoaded()).toBe(true);
      expect(musicStateMachineRegistry.has("tee-sm")).toBe(true);
      expect(musicStateMachineProvider.isLoaded()).toBe(true);
      expect(musicStateMachineProvider.getManifest()?.[0]?.id).toBe("tee-sm");

      // Live-dispatch + tee: time-weather driver.
      expect(timeWeatherDriver.isLoaded()).toBe(true);
      expect(timeWeatherDriver.currentStateId).toBe("tee-clear");
      expect(timeWeatherProvider.isLoaded()).toBe(true);
      expect(timeWeatherProvider.getManifest()?.weather.defaultStateId).toBe(
        "tee-clear",
      );

      // Live-dispatch + tee: achievements.
      expect(achievementEvaluator.isLoaded()).toBe(true);
      expect(achievementEvaluator.has("tee-ach")).toBe(true);
      expect(achievementsProvider.isLoaded()).toBe(true);
      expect(achievementsProvider.getManifest()?.[0]?.id).toBe("tee-ach");

      // Live-dispatch + tee: factions.
      expect(factionsRegistry.isLoaded()).toBe(true);
      expect(factionsRegistry.has("tee-guild")).toBe(true);
      expect(factionsProvider.isLoaded()).toBe(true);
      expect(factionsProvider.getManifest()?.factions[0]?.id).toBe("tee-guild");

      // Live-dispatch + tee: mounts.
      expect(mountRegistry.isLoaded()).toBe(true);
      expect(mountRegistry.has("tee-mount")).toBe(true);
      expect(mountsProvider.isLoaded()).toBe(true);
      expect(mountsProvider.getManifest()?.[0]?.id).toBe("tee-mount");

      // Live-dispatch + tee: pet-companion.
      expect(petRegistry.isLoaded()).toBe(true);
      expect(petRegistry.has("tee-pet")).toBe(true);
      expect(petCompanionProvider.isLoaded()).toBe(true);
      expect(petCompanionProvider.getManifest()?.[0]?.id).toBe("tee-pet");

      // Live-dispatch + tee: status-effects.
      expect(statusEffectRegistry.isLoaded()).toBe(true);
      expect(statusEffectRegistry.has("tee-buff")).toBe(true);
      expect(statusEffectsProvider.isLoaded()).toBe(true);
      expect(statusEffectsProvider.getManifest()?.[0]?.id).toBe("tee-buff");

      // Live-dispatch + tee: enchantments.
      expect(enchantmentRegistry.isLoaded()).toBe(true);
      expect(enchantmentRegistry.has("tee-ench")).toBe(true);
      expect(enchantmentsProvider.isLoaded()).toBe(true);
      expect(enchantmentsProvider.getManifest()?.[0]?.id).toBe("tee-ench");

      // Live-dispatch + tee: titles.
      expect(titleRegistry.isLoaded()).toBe(true);
      expect(titleRegistry.has("tee-title")).toBe(true);
      expect(titlesProvider.isLoaded()).toBe(true);
      expect(titlesProvider.getManifest()?.[0]?.id).toBe("tee-title");

      // Live-dispatch + tee: leaderboards.
      expect(leaderboardEngine.isLoaded()).toBe(true);
      expect(leaderboardEngine.has("tee-board")).toBe(true);
      expect(leaderboardsProvider.isLoaded()).toBe(true);
      expect(leaderboardsProvider.getManifest()?.[0]?.id).toBe("tee-board");

      // Live-dispatch + tee: mail.
      expect(mailPolicyRegistry.isLoaded()).toBe(true);
      expect(mailPolicyRegistry.policy.enabled).toBe(true);
      expect(mailProvider.isLoaded()).toBe(true);
      expect(mailProvider.getManifest()?.enabled).toBe(true);

      // Live-dispatch + tee: seasons.
      expect(seasonRegistry.isLoaded()).toBe(true);
      expect(seasonRegistry.has("tee-season")).toBe(true);
      expect(seasonsProvider.isLoaded()).toBe(true);
      expect(seasonsProvider.getManifest()?.[0]?.id).toBe("tee-season");

      // Live-dispatch + tee: worldEvents.
      expect(worldEventsRegistry.isLoaded()).toBe(true);
      expect(worldEventsRegistry.has("tee-event")).toBe(true);
      expect(worldEventsProvider.isLoaded()).toBe(true);
      expect(worldEventsProvider.getManifest()?.[0]?.id).toBe("tee-event");

      // Live-dispatch + tee: skyboxAtmosphere.
      expect(skyboxAtmosphereRegistry.isLoaded()).toBe(true);
      expect(skyboxAtmosphereRegistry.has("tee-sky")).toBe(true);
      expect(skyboxAtmosphereProvider.isLoaded()).toBe(true);
      expect(skyboxAtmosphereProvider.getManifest()?.activeSkyboxId).toBe(
        "tee-sky",
      );

      // Live-dispatch + tee: particleGraph.
      expect(particleGraphRegistry.isLoaded()).toBe(true);
      expect(particleGraphProvider.isLoaded()).toBe(true);
      expect(particleGraphProvider.getManifest()?.[0]?.id).toBe("teeParticles");

      // Live-dispatch + tee: voiceChat.
      expect(voiceChatRegistry.isLoaded()).toBe(true);
      expect(voiceChatProvider.isLoaded()).toBe(true);
      expect(voiceChatProvider.getManifest()?.rooms[0]?.id).toBe("teeRoom");

      // Live-dispatch + tee: partyGuild.
      expect(partyGuildRegistry.isLoaded()).toBe(true);
      expect(partyGuildRegistry.hasRank("teeLeader")).toBe(true);
      expect(partyGuildProvider.isLoaded()).toBe(true);
      expect(partyGuildProvider.getManifest()?.leaderRankId).toBe("teeLeader");

      // Live-dispatch + tee: navMesh.
      expect(navMeshRegistry.isLoaded()).toBe(true);
      expect(navMeshRegistry.manifest.agents[0]?.id).toBe("teeAgent");
      expect(navMeshProvider.isLoaded()).toBe(true);
      expect(navMeshProvider.getManifest()?.agents[0]?.id).toBe("teeAgent");

      // Live-dispatch + tee: lightingBake.
      expect(lightingBakeRegistry.isLoaded()).toBe(true);
      expect(lightingBakeRegistry.manifest.quality).toBe("medium");
      expect(lightingBakeProvider.isLoaded()).toBe(true);
      expect(lightingBakeProvider.getManifest()?.quality).toBe("medium");

      // Live-dispatch + tee: levelStreaming.
      expect(levelStreamingRegistry.isLoaded()).toBe(true);
      expect(levelStreamingRegistry.has("teeSublevel")).toBe(true);
      expect(levelStreamingProvider.isLoaded()).toBe(true);
      expect(levelStreamingProvider.getManifest()?.[0]?.id).toBe("teeSublevel");

      // Live-dispatch-plus-tee: prefab.
      expect(prefabRegistry.isLoaded()).toBe(true);
      expect(prefabRegistry.hasPrefab("teePrefab")).toBe(true);
      expect(prefabProvider.isLoaded()).toBe(true);
      expect(prefabProvider.getManifest()?.prefabs[0]?.id).toBe("teePrefab");

      // Live-dispatch-plus-tee: cinematic.
      expect(cinematicRegistry.isLoaded()).toBe(true);
      expect(cinematicRegistry.manifest[0]?.id).toBe("teeCinematic");
      expect(cinematicProvider.isLoaded()).toBe(true);
      expect(cinematicProvider.getManifest()?.[0]?.id).toBe("teeCinematic");

      // Live-dispatch-plus-tee: postProcessVolumes.
      expect(postProcessVolumeCompositor.isLoaded()).toBe(true);
      expect(postProcessVolumeCompositor.size).toBe(1);
      expect(postProcessVolumesProvider.isLoaded()).toBe(true);
      expect(postProcessVolumesProvider.getManifest()?.[0]?.id).toBe(
        "teeVolume",
      );

      // Live-dispatch-plus-tee: accessibility.
      expect(accessibilitySettings.isLoaded()).toBe(true);
      expect(accessibilitySettings.manifest.fontScale).toBe(1.25);
      expect(accessibilityProvider.isLoaded()).toBe(true);
      expect(accessibilityProvider.getManifest()?.motion).toBe("reduced");

      // Live-dispatch-plus-tee: featureFlags.
      expect(featureFlagRegistry.isLoaded()).toBe(true);
      expect(featureFlagRegistry.has("teeFlag")).toBe(true);
      expect(featureFlagsProvider.isLoaded()).toBe(true);
      expect(featureFlagsProvider.getManifest()?.flags[0]?.id).toBe("teeFlag");

      // Live-dispatch-plus-tee: physicsConfig.
      expect(physicsConfigRegistry.isLoaded()).toBe(true);
      expect(physicsConfigRegistry.hasLayer("teeLayer")).toBe(true);
      expect(physicsConfigProvider.isLoaded()).toBe(true);
      expect(physicsConfigProvider.getManifest()?.layers[0]?.id).toBe(
        "teeLayer",
      );

      // Live-dispatch-plus-tee: respawn.
      expect(respawnPolicyResolver.isLoaded()).toBe(true);
      expect(respawnPolicyResolver.has("teeBind")).toBe(true);
      expect(respawnProvider.isLoaded()).toBe(true);
      expect(respawnProvider.getManifest()?.bindPoints[0]?.id).toBe("teeBind");

      // Live-dispatch-plus-tee: talentTrees.
      expect(talentTreeRegistry.isLoaded()).toBe(true);
      expect(talentTreeRegistry.has("teeTree")).toBe(true);
      expect(talentTreesProvider.isLoaded()).toBe(true);
      expect(talentTreesProvider.getManifest()?.trees[0]?.id).toBe("teeTree");

      // Live-dispatch-plus-tee: auctionHouse.
      expect(auctionHouseRegistry.isLoaded()).toBe(true);
      expect(auctionHouseRegistry.enabled).toBe(true);
      expect(auctionHouseProvider.isLoaded()).toBe(true);
      expect(auctionHouseProvider.getManifest()?.listing.model).toBe(
        "bidAndBuyout",
      );

      // Live-dispatch-plus-tee: crashReporter.
      expect(crashReporterRegistry.isLoaded()).toBe(true);
      expect(crashReporterRegistry.manifest.sinks[0]?.id).toBe("teeSink");
      expect(crashReporterProvider.isLoaded()).toBe(true);
      expect(crashReporterProvider.getManifest()?.sinks[0]?.id).toBe("teeSink");

      // Live-dispatch-plus-tee: pushNotifications.
      expect(pushNotificationsRegistry.isLoaded()).toBe(true);
      expect(pushNotificationsRegistry.manifest.channels[0]?.id).toBe(
        "teeChannel",
      );
      expect(pushNotificationsProvider.isLoaded()).toBe(true);
      expect(pushNotificationsProvider.getManifest()?.categories[0]?.id).toBe(
        "teeCategory",
      );

      // Live-dispatch-plus-tee: licenseAgreements.
      expect(licenseAgreementsRegistry.isLoaded()).toBe(true);
      expect(licenseAgreementsRegistry.manifest.documents[0]?.id).toBe(
        "teeEula",
      );
      expect(licenseAgreementsProvider.isLoaded()).toBe(true);
      expect(licenseAgreementsProvider.getManifest()?.documents[0]?.id).toBe(
        "teeEula",
      );

      // Live-dispatch-plus-tee: moderation.
      expect(moderationRegistry.isLoaded()).toBe(true);
      expect(moderationRegistry.manifest.reportCategories[0]?.id).toBe(
        "teeCategory",
      );
      expect(moderationProvider.isLoaded()).toBe(true);
      expect(moderationProvider.getManifest()?.reportCategories[0]?.id).toBe(
        "teeCategory",
      );

      // Live-dispatch-plus-tee: parentalControls.
      expect(parentalControlsRegistry.isLoaded()).toBe(true);
      expect(parentalControlsRegistry.manifest.profiles[0]?.id).toBe(
        "teeProfile",
      );
      expect(parentalControlsProvider.isLoaded()).toBe(true);
      expect(parentalControlsProvider.getManifest()?.profiles[0]?.id).toBe(
        "teeProfile",
      );

      // Live-dispatch-plus-tee: fastTravel.
      expect(fastTravelGraph.isLoaded()).toBe(true);
      expect(fastTravelGraph.hasNode("teeNode")).toBe(true);
      expect(fastTravelProvider.isLoaded()).toBe(true);
      expect(fastTravelProvider.getManifest()?.nodes[0]?.id).toBe("teeNode");

      // Live-dispatch-plus-tee: friendsSocial.
      expect(friendsSocialRegistry.isLoaded()).toBe(true);
      expect(friendsSocialRegistry.manifest.friends.maxFriends).toBe(100);
      expect(friendsSocialProvider.isLoaded()).toBe(true);
      expect(friendsSocialProvider.getManifest()?.friends.scope).toBe(
        "perAccount",
      );

      // Live-dispatch-plus-tee: housing.
      expect(housingRegistry.isLoaded()).toBe(true);
      expect(housingRegistry.has("teePlot")).toBe(true);
      expect(housingProvider.isLoaded()).toBe(true);
      expect(housingProvider.getManifest()?.plotTypes[0]?.id).toBe("teePlot");

      // Live-dispatch-plus-tee: loadouts.
      expect(loadoutPolicyRegistry.isLoaded()).toBe(true);
      expect(loadoutPolicyRegistry.policy.maxSlotsPerCharacter).toBe(10);
      expect(loadoutsProvider.isLoaded()).toBe(true);
      expect(loadoutsProvider.getManifest()?.maxSlotsPerCharacter).toBe(10);

      // Live-dispatch-plus-tee: avatars.
      expect(avatarsRegistry.isLoaded()).toBe(true);
      expect(avatarsRegistry.has("teeAvatar")).toBe(true);
      expect(avatarsProvider.isLoaded()).toBe(true);
      expect(avatarsProvider.getManifest()?.avatars[0]?.id).toBe("teeAvatar");

      // Live-dispatch-plus-tee: playerEmotes.
      expect(playerEmotesRegistry.isLoaded()).toBe(true);
      expect(playerEmotesRegistry.has("teeIdle")).toBe(true);
      expect(playerEmotesProvider.isLoaded()).toBe(true);
      expect(playerEmotesProvider.getManifest()?.essentialEmoteKeys[0]).toBe(
        "teeIdle",
      );

      // Live-dispatch-plus-tee: spellVisuals.
      expect(spellVisualsRegistry.isLoaded()).toBe(true);
      expect(spellVisualsRegistry.hasSpell("teeSpell")).toBe(true);
      expect(spellVisualsRegistry.hasArrow("default")).toBe(true);
      expect(spellVisualsProvider.isLoaded()).toBe(true);
      expect(
        spellVisualsProvider.getManifest()?.spells["teeSpell"]?.color,
      ).toBe(0xff00ff);

      // Live-dispatch-plus-tee: skillIcons.
      expect(skillIconsRegistry.isLoaded()).toBe(true);
      expect(skillIconsRegistry.hasDefinition("teeSkill")).toBe(true);
      expect(skillIconsProvider.isLoaded()).toBe(true);
      expect(skillIconsProvider.getManifest()?.definitions[0]?.key).toBe(
        "teeSkill",
      );

      // Live-dispatch-plus-tee: commerce.
      expect(commerceRegistry.isLoaded()).toBe(true);
      expect(commerceRegistry.defaultBuybackRate).toBe(0.5);
      expect(commerceProvider.isLoaded()).toBe(true);
      expect(commerceProvider.getManifest()?.starterStoreItemIds[0]).toBe(
        "teeStarterItem",
      );

      // Live-dispatch-plus-tee: storeFront.
      expect(storeFrontRegistry.isLoaded()).toBe(true);
      expect(storeFrontRegistry.hasBundle("teeBundle")).toBe(true);
      expect(storeFrontRegistry.hasShelf("teeShelf")).toBe(true);
      expect(storeFrontProvider.isLoaded()).toBe(true);
      expect(storeFrontProvider.getManifest()?.bundles[0]?.id).toBe(
        "teeBundle",
      );

      // Live-dispatch-plus-tee: onboardingGoals.
      expect(onboardingGoalsRegistry.isLoaded()).toBe(true);
      expect(onboardingGoalsRegistry.has("teeGoal")).toBe(true);
      expect(onboardingGoalsProvider.isLoaded()).toBe(true);
      expect(onboardingGoalsProvider.getManifest()?.goals[0]?.id).toBe(
        "teeGoal",
      );

      // Live-dispatch-plus-tee: credits.
      expect(creditsRegistry.isLoaded()).toBe(true);
      expect(creditsRegistry.has("teeSection")).toBe(true);
      expect(creditsProvider.isLoaded()).toBe(true);
      expect(creditsProvider.getManifest()?.sections[0]?.id).toBe("teeSection");

      // Live-dispatch-plus-tee: mainMenu.
      expect(mainMenuRegistry.isLoaded()).toBe(true);
      expect(mainMenuRegistry.has("teeRootMenu")).toBe(true);
      expect(mainMenuProvider.isLoaded()).toBe(true);
      expect(mainMenuProvider.getManifest()?.rootMenuId).toBe("teeRootMenu");

      // Live-dispatch-plus-tee: tooltips.
      expect(tooltipRegistry.isLoaded()).toBe(true);
      expect(tooltipRegistry.has("teeTooltip")).toBe(true);
      expect(tooltipsProvider.isLoaded()).toBe(true);
      expect(tooltipsProvider.getManifest()?.entries[0]?.id).toBe("teeTooltip");

      // Live-dispatch-plus-tee: keyPromptIcons.
      expect(keyPromptGlyphRegistry.isLoaded()).toBe(true);
      expect(
        keyPromptGlyphRegistry.getExact("keyboard", "KeyA")?.inputCode,
      ).toBe("KeyA");
      expect(keyPromptIconsProvider.isLoaded()).toBe(true);
      expect(keyPromptIconsProvider.getManifest()?.glyphs[0]?.inputCode).toBe(
        "KeyA",
      );

      // Live-dispatch-plus-tee: loadingScreens.
      expect(loadingScreensRegistry.isLoaded()).toBe(true);
      expect(loadingScreensRegistry.has("teeSlate")).toBe(true);
      expect(loadingScreensProvider.isLoaded()).toBe(true);
      expect(loadingScreensProvider.getManifest()?.defaultSlateId).toBe(
        "teeSlate",
      );

      // Live-dispatch-plus-tee: haptics.
      expect(hapticsRegistry.isLoaded()).toBe(true);
      expect(hapticsRegistry.has("teeRumble")).toBe(true);
      expect(hapticsProvider.isLoaded()).toBe(true);
      expect(hapticsProvider.getManifest()?.[0]?.id).toBe("teeRumble");

      // Live-dispatch-plus-tee: tutorialFlows.
      expect(tutorialFlowsRegistry.isLoaded()).toBe(true);
      expect(tutorialFlowsRegistry.has("teeFlow")).toBe(true);
      expect(tutorialFlowsProvider.isLoaded()).toBe(true);
      expect(tutorialFlowsProvider.getManifest()?.[0]?.id).toBe("teeFlow");

      // Live-dispatch-plus-tee: inputActions.
      expect(inputActionsRegistry.isLoaded()).toBe(true);
      expect(inputActionsRegistry.has("teeJump")).toBe(true);
      expect(inputActionsProvider.isLoaded()).toBe(true);
      expect(inputActionsProvider.getManifest()?.[0]?.id).toBe("teeJump");

      // Live-dispatch-plus-tee: skillUnlocks.
      expect(skillUnlocksRegistry.isLoaded()).toBe(true);
      expect(skillUnlocksRegistry.hasSkill("attack")).toBe(true);
      expect(skillUnlocksProvider.isLoaded()).toBe(true);
      expect(
        skillUnlocksProvider.getManifest()?.skills.attack?.[0]?.level,
      ).toBe(5);

      // Live-dispatch-plus-tee: weaponStyles.
      expect(weaponStylesRegistry.isLoaded()).toBe(true);
      expect(weaponStylesRegistry.has("sword")).toBe(true);
      expect(weaponStylesProvider.isLoaded()).toBe(true);
      expect(weaponStylesProvider.getManifest()?.styles.sword?.[0]).toBe(
        "accurate",
      );

      // Live-dispatch-plus-tee: ammunition.
      expect(ammunitionRegistry.isLoaded()).toBe(true);
      expect(ammunitionRegistry.hasBow("teeBow")).toBe(true);
      expect(ammunitionRegistry.hasArrow("teeArrow")).toBe(true);
      expect(ammunitionProvider.isLoaded()).toBe(true);
      expect(ammunitionProvider.getManifest()?.bowTiers["teeBow"]).toBe(1);

      // Live-dispatch-plus-tee: editorSnap.
      expect(editorSnapRegistry.isLoaded()).toBe(true);
      expect(editorSnapRegistry.grid.translate).toBe(1.0);
      expect(editorSnapProvider.isLoaded()).toBe(true);
      expect(editorSnapProvider.getManifest()?.snapByDefault).toBe(true);

      // Live-dispatch-plus-tee: projectSettings.
      expect(projectSettingsRegistry.isLoaded()).toBe(true);
      expect(projectSettingsRegistry.projectName).toBe("TeeProject");
      expect(projectSettingsProvider.isLoaded()).toBe(true);
      expect(projectSettingsProvider.getManifest()?.gameModeId).toBe("hyperia");

      // Live-dispatch-plus-tee: qualityPresets.
      expect(qualityPresetsRegistry.isLoaded()).toBe(true);
      expect(qualityPresetsRegistry.has("teePreset")).toBe(true);
      expect(qualityPresetsProvider.isLoaded()).toBe(true);
      expect(qualityPresetsProvider.getManifest()?.[0]?.id).toBe("teePreset");

      // Live-dispatch-plus-tee: deployTargets.
      expect(deployTargetsRegistry.isLoaded()).toBe(true);
      expect(deployTargetsRegistry.has("tee-target")).toBe(true);
      expect(deployTargetsProvider.isLoaded()).toBe(true);
      expect(deployTargetsProvider.getManifest()?.[0]?.id).toBe("tee-target");

      // Live-dispatch-plus-tee: profilerOverlay.
      expect(profilerOverlayRegistry.isLoaded()).toBe(true);
      expect(profilerOverlayRegistry.hasMetric("tee-metric")).toBe(true);
      expect(profilerOverlayProvider.isLoaded()).toBe(true);
      expect(profilerOverlayProvider.getManifest()?.groups[0]?.id).toBe(
        "tee-group",
      );

      // Live-dispatch-plus-tee: replication.
      expect(replicationRegistry.isLoaded()).toBe(true);
      expect(replicationRegistry.hasComponent("TeeComp")).toBe(true);
      expect(replicationProvider.isLoaded()).toBe(true);
      expect(replicationProvider.getManifest()?.components[0]?.component).toBe(
        "TeeComp",
      );

      // Live-dispatch-plus-tee: smithing.
      expect(smithingRegistry.isLoaded()).toBe(true);
      expect(smithingRegistry.hammerItemId).toBe("tee_hammer");
      expect(smithingProvider.isLoaded()).toBe(true);
      expect(smithingProvider.getManifest()?.items.coalItemId).toBe("tee_coal");

      // Live-dispatch-plus-tee: processing.
      expect(processingRegistry.isLoaded()).toBe(true);
      expect(processingRegistry.firemaking.baseRollTicks).toBe(4);
      expect(processingProvider.isLoaded()).toBe(true);
      expect(processingProvider.getManifest()?.fire.maxFiresPerArea).toBe(8);

      // Live-dispatch-plus-tee: banking.
      expect(bankingRegistry.isLoaded()).toBe(true);
      expect(bankingRegistry.sizes.maxBankSlots).toBe(400);
      expect(bankingProvider.isLoaded()).toBe(true);
      expect(bankingProvider.getManifest()?.ui.itemsPerRow).toBe(8);

      // Live-dispatch-plus-tee: arenaLayout.
      expect(arenaLayoutRegistry.isLoaded()).toBe(true);
      expect(arenaLayoutRegistry.arenaCount).toBe(4);
      expect(arenaLayoutProvider.isLoaded()).toBe(true);
      expect(arenaLayoutProvider.getManifest()?.lobby.width).toBe(20);

      // Live-dispatch-plus-tee: lodSettings.
      expect(lodSettingsRegistry.isLoaded()).toBe(true);
      expect(lodSettingsRegistry.thresholdFor("tee-category").lod1).toBe(15);
      expect(lodSettingsProvider.isLoaded()).toBe(true);
      expect(
        lodSettingsProvider.getManifest()?.dissolve.transitionDuration,
      ).toBe(0.5);

      // Live-dispatch-plus-tee: npcSizes.
      expect(npcSizesRegistry.isLoaded()).toBe(true);
      expect(npcSizesRegistry.getOrDefault("tee-boss").width).toBe(3);
      expect(npcSizesProvider.isLoaded()).toBe(true);
      expect(npcSizesProvider.getManifest()?.sizes["tee-boss"]?.depth).toBe(3);

      // Live-dispatch-plus-tee: duel.
      expect(duelRulesRegistry.isLoaded()).toBe(true);
      expect(duelRulesRegistry.challengeTimeoutMs).toBe(60000);
      expect(duelRulesRegistry.hasRule("tee-rule")).toBe(true);
      expect(duelProvider.isLoaded()).toBe(true);
      expect(duelProvider.getManifest()?.challengeTimeoutMs).toBe(60000);

      // Live-dispatch-plus-tee: tools.
      expect(toolsRegistry.isLoaded()).toBe(true);
      expect(toolsRegistry.has("tee_hatchet")).toBe(true);
      expect(toolsRegistry.get("tee_hatchet").priority).toBe(10);
      expect(toolsProvider.isLoaded()).toBe(true);
      expect(toolsProvider.getManifest()?.[0]?.itemId).toBe("tee_hatchet");

      // Live-dispatch-plus-tee: stores.
      expect(storesRegistry.isLoaded()).toBe(true);
      expect(storesRegistry.ids).toContain("tee-store");
      expect(storesProvider.isLoaded()).toBe(true);
      expect(storesProvider.getManifest()?.[0]?.items[0]?.price).toBe(100);

      // Live-dispatch-plus-tee: trees.
      expect(treeCatalogRegistry.isLoaded()).toBe(true);
      expect(treeCatalogRegistry.hasSubtype("oakish")).toBe(true);
      expect(treeCatalogRegistry.byResourceId("tee_oakish").levelRequired).toBe(
        15,
      );
      expect(treesProvider.isLoaded()).toBe(true);
      expect(treesProvider.getManifest()?.trees["oakish"]?.id).toBe(
        "tee_oakish",
      );

      // Live-dispatch-plus-tee: biomes.
      expect(biomesRegistry.isLoaded()).toBe(true);
      expect(biomesRegistry.has("tee-biome")).toBe(true);
      expect(biomesRegistry.get("tee-biome").difficultyLevel).toBe(2);
      expect(biomesProvider.isLoaded()).toBe(true);
      expect(biomesProvider.getManifest()?.[0]?.id).toBe("tee-biome");

      // Live-dispatch-plus-tee: vegetation.
      expect(vegetationRegistry.isLoaded()).toBe(true);
      expect(vegetationRegistry.has("tee_veg")).toBe(true);
      expect(vegetationRegistry.get("tee_veg").category).toBe("teeLayer");
      expect(vegetationProvider.isLoaded()).toBe(true);
      expect(vegetationProvider.getManifest()?.assets[0]?.id).toBe("tee_veg");

      // Live-dispatch-plus-tee: trading.
      expect(tradingRegistry.isLoaded()).toBe(true);
      expect(tradingRegistry.manifest.session.confirmMode).toBe("bothConfirm");
      expect(tradingProvider.isLoaded()).toBe(true);
      expect(tradingProvider.getManifest()?.rateLimit.maxTradesPerDay).toBe(
        200,
      );

      // Live-dispatch-plus-tee: itemSets.
      expect(itemSetRegistry.isLoaded()).toBe(true);
      expect(itemSetRegistry.has("teeSet")).toBe(true);
      expect(itemSetRegistry.get("teeSet").memberItemIds).toContain("teeHelm");
      expect(itemSetsProvider.isLoaded()).toBe(true);
      expect(itemSetsProvider.getManifest()?.[0]?.id).toBe("teeSet");

      // Live-dispatch-plus-tee: transmog.
      expect(transmogRegistry.isLoaded()).toBe(true);
      expect(transmogRegistry.manifest.global.enabled).toBe(true);
      expect(transmogRegistry.manifest.sources[0]?.id).toBe("teeHelmLook");
      expect(transmogProvider.isLoaded()).toBe(true);
      expect(transmogProvider.getManifest()?.sources[0]?.slot).toBe("helm");

      // Live-dispatch-plus-tee: economyTuning.
      expect(economyTuningRegistry.isLoaded()).toBe(true);
      expect(economyTuningRegistry.currency("gold").symbol).toBe("g");
      expect(economyTuningRegistry.hasCurve("teeRepairCurve")).toBe(true);
      expect(economyTuningProvider.isLoaded()).toBe(true);
      expect(economyTuningProvider.getManifest()?.currencies[0]?.id).toBe(
        "gold",
      );

      // Live-dispatch-plus-tee: interaction.
      expect(interactionConfigRegistry.isLoaded()).toBe(true);
      expect(interactionConfigRegistry.maxDistanceFor("dialogue")).toBe(3);
      expect(interactionConfigRegistry.transactionRateLimitMs).toBe(250);
      expect(interactionProvider.isLoaded()).toBe(true);
      expect(
        interactionProvider.getManifest()?.sessionConfig
          .validationIntervalTicks,
      ).toBe(10);

      // Live-dispatch-plus-tee: newsFeed.
      expect(newsFeedRegistry.isLoaded()).toBe(true);
      expect(newsFeedRegistry.hasEntry("teeAnnouncement")).toBe(true);
      expect(newsFeedRegistry.hasCategory("teePatchNotes")).toBe(true);
      expect(newsFeedProvider.isLoaded()).toBe(true);
      expect(newsFeedProvider.getManifest()?.entries[0]?.id).toBe(
        "teeAnnouncement",
      );

      // Live-dispatch-plus-tee: buildings.
      expect(buildingsRegistry.isLoaded()).toBe(true);
      expect(buildingsRegistry.has("teeBuilding")).toBe(true);
      expect(buildingsProvider.isLoaded()).toBe(true);
      expect(buildingsProvider.getManifest()?.[0]?.id).toBe("teeBuilding");

      // Live-dispatch-plus-tee: screenshot.
      expect(screenshotRegistry.isLoaded()).toBe(true);
      expect(screenshotRegistry.enabled).toBe(true);
      expect(screenshotRegistry.shareTarget("teeDiskTarget").kind).toBe(
        "saveToDisk",
      );
      expect(screenshotProvider.isLoaded()).toBe(true);
      expect(screenshotProvider.getManifest()?.shareTargets[0]?.id).toBe(
        "teeDiskTarget",
      );

      // Live-dispatch-plus-tee: serverBrowser.
      expect(serverBrowserRegistry.isLoaded()).toBe(true);
      expect(serverBrowserRegistry.hasFilter("teeRegionFilter")).toBe(true);
      expect(serverBrowserRegistry.hasColumn("ping")).toBe(true);
      expect(serverBrowserRegistry.classifyPing(50)).toBe("good");
      expect(serverBrowserRegistry.classifyPing(150)).toBe("ok");
      expect(serverBrowserRegistry.classifyPing(500)).toBe("poor");
      expect(serverBrowserProvider.isLoaded()).toBe(true);
      expect(serverBrowserProvider.getManifest()?.defaultSortColumn).toBe(
        "ping",
      );

      // Live-dispatch-plus-tee: equipment (Batch 24).
      expect(equipmentManifestRegistry.isLoaded()).toBe(true);
      expect(equipmentManifestRegistry.manifest.implementedSlots).toContain(
        "weapon",
      );
      expect(equipmentProvider.isLoaded()).toBe(true);
      expect(equipmentProvider.getManifest()?.bankEquipmentSlots[0]?.key).toBe(
        "weapon",
      );

      // Live-dispatch-plus-tee: matchmakingTuning (Batch 24).
      expect(matchmakingRegistry.isLoaded()).toBe(true);
      expect(matchmakingRegistry.manifest.queues[0]?.id).toBe("teeQueue");
      expect(matchmakingTuningProvider.isLoaded()).toBe(true);
      expect(matchmakingTuningProvider.getManifest()?.queues[0]?.id).toBe(
        "teeQueue",
      );

      // Tee-only: aiBehavior (Batch 24). No live-dispatch registry.
      expect(aiBehaviorProvider.isLoaded()).toBe(true);
      expect(aiBehaviorProvider.getManifest()?.[0]?.id).toBe("teeTree");

      // Live-dispatch-plus-tee: analyticsEvents (Batch 25).
      expect(analyticsEventRouter.isLoaded()).toBe(true);
      expect(analyticsEventRouter.has("tee_event")).toBe(true);
      expect(analyticsEventsProvider.isLoaded()).toBe(true);
      expect(analyticsEventsProvider.getManifest()?.[0]?.name).toBe(
        "tee_event",
      );

      // Live-dispatch-plus-tee: groupFinder (Batch 25).
      expect(groupFinderRegistry.isLoaded()).toBe(true);
      expect(groupFinderRegistry.manifest.content[0]?.id).toBe("teeDungeon");
      expect(groupFinderProvider.isLoaded()).toBe(true);
      expect(groupFinderProvider.getManifest()?.content[0]?.id).toBe(
        "teeDungeon",
      );

      // Tee-only: duelArenas (Batch 25). Runtime `DuelRulesRegistry`
      // handles a separate `DuelManifest`; no live-dispatch registry
      // exists for this shape.
      expect(duelArenasProvider.isLoaded()).toBe(true);
      expect(duelArenasProvider.getManifest()?.arenas[0]?.arenaId).toBe(1);

      // Tee-only: combat (Batch 26). Cold-boot consumed by CombatSystem
      // via DataManager; no live-dispatch registry today.
      expect(combatProvider.isLoaded()).toBe(true);
      expect(combatProvider.getManifest()?.$schema).toBe(
        "hyperforge.combat.v1",
      );

      // Tee-only: game (Batch 26). Cold-boot consumed via DataManager.
      expect(gameProvider.isLoaded()).toBe(true);
      expect(gameProvider.getManifest()?.$schema).toBe("hyperforge.game.v1");

      // Tee-only: gathering (Batch 26). Cold-boot consumed via DataManager.
      expect(gatheringProvider.isLoaded()).toBe(true);
      expect(gatheringProvider.getManifest()?.$schema).toBe(
        "hyperforge.gathering.v1",
      );

      // Tee-only: music (Batch 27). Track catalog; distinct from
      // musicStateMachine (wired above).
      expect(musicProvider.isLoaded()).toBe(true);
      expect(musicProvider.getManifest()?.[0]?.id).toBe("tee-theme");

      // Tee-only: saveData (Batch 27). Save-slice schema registry.
      expect(saveDataProvider.isLoaded()).toBe(true);
      expect(saveDataProvider.getManifest()?.[0]?.id).toBe("teeSlice");

      // Tee-only: worldStructure (Batch 27). Grid/terrain constants.
      expect(worldStructureProvider.isLoaded()).toBe(true);
      expect(worldStructureProvider.getManifest()?.$schema).toBe(
        "hyperforge.world-structure.v1",
      );

      // Live-dispatch: stations + modelBounds (Batch 28). StationDataProvider
      // singleton rebuilds the station catalog in-place so world-building
      // queries pick up edits without a cold boot.
      const { stationDataProvider } =
        await import("../../../data/StationDataProvider");
      expect(stationDataProvider.hasStation("tee-station")).toBe(true);
      expect(stationDataProvider.getFootprint("tee-station").width).toBe(2);
      expect(stationDataProvider.getModelPath("tee-station")).toBe(
        "asset://models/stations/tee.glb",
      );
    },
  );

  it(
    "updateManifests({ npcDefinitions }) hot-reloads npcDefinitionsRegistry without Stop/Play",
    { timeout: LONG_TIMEOUT_MS },
    async () => {
      const { npcDefinitionsRegistry } =
        await import("../../../npc-definitions");
      const { getNPCById } = await import("../../../data/npcs");

      session = new PIEEditorSession();
      await session.start({});

      // Reset registry to baseline so we're not piggy-backing on
      // whatever DataManager loaded during start().
      npcDefinitionsRegistry._unloadForTests();
      expect(npcDefinitionsRegistry.isLoaded()).toBe(false);

      // Push an authored NPC catalog through PIE.
      session.updateManifests({
        npcDefinitions: [
          {
            id: "tee-npc",
            name: "Tee NPC",
            category: "mob",
            faction: "monster",
            stats: {
              level: 5,
              health: 10,
              attack: 3,
              strength: 3,
              defense: 3,
              defenseBonus: 0,
              ranged: 1,
              magic: 1,
            },
            combat: {
              attackable: true,
              aggressive: true,
              attackSpeedTicks: 4,
            },
          },
        ],
      });

      // Registry now loaded with authored data.
      expect(npcDefinitionsRegistry.isLoaded()).toBe(true);
      expect(npcDefinitionsRegistry.size).toBe(1);
      expect(npcDefinitionsRegistry.find("tee-npc")?.name).toBe("Tee NPC");

      // Critical end-to-end proof: getNPCById (the consumer-facing
      // wrapper used by ~10 systems) routes through the registry
      // when loaded.
      const fromConsumer = getNPCById("tee-npc");
      expect(fromConsumer).not.toBeNull();
      expect(fromConsumer?.name).toBe("Tee NPC");

      // Cleanup: restore baseline so other tests aren't affected.
      npcDefinitionsRegistry._unloadForTests();
    },
  );

  describe("plugin hooks", () => {
    it(
      "start() invokes bootServerPlugins + bootClientPlugins with the real worlds; stop() unwinds both in reverse",
      async () => {
        session = new PIEEditorSession();

        const callLog: string[] = [];
        let seenServerWorld: unknown = null;
        let seenClientWorld: unknown = null;

        await session.start({
          plugins: {
            bootServerPlugins: async (serverWorld) => {
              callLog.push("boot-server");
              seenServerWorld = serverWorld;
              return {
                async stop() {
                  callLog.push("stop-server");
                },
              };
            },
            bootClientPlugins: async (clientWorld) => {
              callLog.push("boot-client");
              seenClientWorld = clientWorld;
              return {
                async stop() {
                  callLog.push("stop-client");
                },
              };
            },
          },
        });

        // Both hooks fired during start.
        expect(callLog).toEqual(["boot-server", "boot-client"]);

        // Hooks received the real worlds PIE owns — not null shims.
        expect(seenServerWorld).toBe(session.server?.world);
        expect(seenClientWorld).not.toBeNull();

        await session.stop();
        session = null;

        // stop() unwinds client-before-server (matches world teardown
        // order) so the full log is boot-server → boot-client → stop-client
        // → stop-server.
        expect(callLog).toEqual([
          "boot-server",
          "boot-client",
          "stop-client",
          "stop-server",
        ]);
      },
      LONG_TIMEOUT_MS,
    );

    it(
      "start() survives when a plugin hook throws; stop() still succeeds",
      async () => {
        session = new PIEEditorSession();

        // Both hooks throw — PIE should log and continue, not reject.
        await session.start({
          plugins: {
            bootServerPlugins: async () => {
              throw new Error("server boot boom");
            },
            bootClientPlugins: async () => {
              throw new Error("client boot boom");
            },
          },
        });

        // Session is running despite the failed hooks.
        expect(session.isRunning).toBe(true);
        expect(session.server).not.toBeNull();

        // Teardown doesn't throw even though no plugin sessions were
        // ever captured.
        await expect(session.stop()).resolves.toBeUndefined();
        session = null;
      },
      LONG_TIMEOUT_MS,
    );

    it(
      "absence of plugins option is equivalent to legacy behavior (no hook calls, clean teardown)",
      async () => {
        session = new PIEEditorSession();
        await session.start({});
        expect(session.isRunning).toBe(true);
        await session.stop();
        session = null;
      },
      LONG_TIMEOUT_MS,
    );
  });
});
