/**
 * rehydrateExtendedLayersFromWorldContent — P0.6 unit tests.
 *
 * The rehydrator walks each placement kind in worldContent JSON,
 * validates against the WorldArea* schema, maps via P0.1 forward
 * mappers, and dispatches via the actions surface. These tests
 * cover:
 *
 *   - Each kind dispatches the correct action with correctly
 *     mapped position (game → scene) + fields
 *   - Malformed entries get counted as dropped, valid siblings
 *     continue to dispatch
 *   - Empty / null worldContent → all-zero counts, no dispatches
 *   - Mixed valid + invalid input
 */

import { describe, expect, it, vi } from "vitest";

import {
  rehydrateExtendedLayersFromWorldContent,
  type RehydrateActions,
} from "../rehydrateExtendedLayers";

const OFFSET = 2500;

function makeStubActions(): {
  actions: RehydrateActions;
  npcs: unknown[];
  spawns: unknown[];
  resources: unknown[];
  stations: unknown[];
  teleports: unknown[];
} {
  const npcs: unknown[] = [];
  const spawns: unknown[] = [];
  const resources: unknown[] = [];
  const stations: unknown[] = [];
  const teleports: unknown[] = [];
  return {
    actions: {
      addNPC: vi.fn((n) => npcs.push(n)),
      addMobSpawn: vi.fn((s) => spawns.push(s)),
      addResource: vi.fn((r) => resources.push(r)),
      addStation: vi.fn((s) => stations.push(s)),
      addTeleport: vi.fn((t) => teleports.push(t)),
    },
    npcs,
    spawns,
    resources,
    stations,
    teleports,
  };
}

describe("rehydrateExtendedLayersFromWorldContent", () => {
  it("returns all-zero counts for null worldContent", () => {
    const { actions } = makeStubActions();
    const counts = rehydrateExtendedLayersFromWorldContent(
      null,
      actions,
      OFFSET,
    );
    expect(counts).toEqual({
      npcs: 0,
      spawns: 0,
      resources: 0,
      stations: 0,
      teleports: 0,
      dropped: 0,
    });
  });

  it("returns all-zero counts for empty object", () => {
    const { actions } = makeStubActions();
    const counts = rehydrateExtendedLayersFromWorldContent({}, actions, OFFSET);
    expect(counts.npcs).toBe(0);
    expect(counts.dropped).toBe(0);
  });

  it("dispatches each NPC + applies coordinate offset", () => {
    const stub = makeStubActions();
    const counts = rehydrateExtendedLayersFromWorldContent(
      {
        npcs: [
          {
            id: "eldric",
            type: "shopkeeper",
            position: { x: 0, y: 0, z: 0 },
          },
          {
            id: "marcus",
            type: "questgiver",
            position: { x: 12, y: 0, z: -8 },
          },
        ],
      },
      stub.actions,
      OFFSET,
    );
    expect(counts.npcs).toBe(2);
    expect(stub.npcs).toHaveLength(2);
    // Game-space (0,0,0) → scene-space (2500, 0, 2500)
    expect(
      (stub.npcs[0] as { position: { x: number; z: number } }).position.x,
    ).toBe(2500);
    // Game-space (12,0,-8) → scene-space (2512, 0, 2492)
    expect(
      (stub.npcs[1] as { position: { x: number; z: number } }).position.x,
    ).toBe(2512);
    expect(
      (stub.npcs[1] as { position: { x: number; z: number } }).position.z,
    ).toBe(2492);
  });

  it("dispatches mob spawns + maps required fields", () => {
    const stub = makeStubActions();
    const counts = rehydrateExtendedLayersFromWorldContent(
      {
        spawns: [
          {
            mobId: "goblin",
            position: { x: 30, y: 0, z: 30 },
            maxCount: 3,
            spawnRadius: 5,
          },
        ],
      },
      stub.actions,
      OFFSET,
    );
    expect(counts.spawns).toBe(1);
    const spawn = stub.spawns[0] as {
      mobId: string;
      maxCount: number;
      spawnRadius: number;
    };
    expect(spawn.mobId).toBe("goblin");
    expect(spawn.maxCount).toBe(3);
    expect(spawn.spawnRadius).toBe(5);
  });

  it("dispatches resources + stations + teleports", () => {
    const stub = makeStubActions();
    const counts = rehydrateExtendedLayersFromWorldContent(
      {
        resources: [
          {
            resourceId: "tree_oak",
            type: "tree",
            position: { x: 18, y: 0, z: -12 },
          },
        ],
        stations: [
          {
            id: "smithy-anvil",
            type: "anvil",
            position: { x: 4, y: 0, z: -2 },
          },
        ],
        teleports: [
          {
            id: "village-lodestone",
            name: "Village Lodestone",
            type: "lodestone",
            position: { x: 0, y: 0, z: 0 },
          },
        ],
      },
      stub.actions,
      OFFSET,
    );
    expect(counts.resources).toBe(1);
    expect(counts.stations).toBe(1);
    expect(counts.teleports).toBe(1);
    expect(stub.resources).toHaveLength(1);
    expect(stub.stations).toHaveLength(1);
    expect(stub.teleports).toHaveLength(1);
  });

  it("counts dropped entries when validation fails — valid siblings continue", () => {
    const stub = makeStubActions();
    const counts = rehydrateExtendedLayersFromWorldContent(
      {
        npcs: [
          // Valid
          { id: "good", type: "shopkeeper", position: { x: 0, y: 0, z: 0 } },
          // Invalid — missing required `type`
          { id: "bad", position: { x: 1, y: 0, z: 1 } },
          // Invalid — missing required `position`
          { id: "ugly", type: "guard" },
          // Valid
          { id: "good2", type: "guard", position: { x: 2, y: 0, z: 2 } },
        ],
      },
      stub.actions,
      OFFSET,
    );
    expect(counts.npcs).toBe(2); // only the two valid NPCs
    expect(counts.dropped).toBe(2); // two malformed
    expect(stub.npcs).toHaveLength(2);
    expect((stub.npcs[0] as { id: string }).id).toBe("good");
    expect((stub.npcs[1] as { id: string }).id).toBe("good2");
  });

  it("aggregates dropped count across kinds", () => {
    const stub = makeStubActions();
    const counts = rehydrateExtendedLayersFromWorldContent(
      {
        npcs: [{ id: "n1", type: "x", position: { x: 0, y: 0, z: 0 } }, "junk"],
        spawns: [
          {
            mobId: "g",
            position: { x: 0, y: 0, z: 0 },
            maxCount: 1,
            spawnRadius: 0,
          },
          {}, // bad
        ],
      },
      stub.actions,
      OFFSET,
    );
    expect(counts.npcs).toBe(1);
    expect(counts.spawns).toBe(1);
    expect(counts.dropped).toBe(2);
  });

  it("ignores worldContent fields that aren't placement kinds", () => {
    const stub = makeStubActions();
    const counts = rehydrateExtendedLayersFromWorldContent(
      {
        // These should NOT be processed by this rehydrator
        // (quests + zones go through the legacy path; uiPack is
        // handled elsewhere).
        quests: [{ id: "q1", name: "Test Quest" }],
        zones: [{ id: "z1", name: "Test Zone" }],
        uiPack: {
          /* whatever */
        },
      },
      stub.actions,
      OFFSET,
    );
    expect(counts.npcs).toBe(0);
    expect(counts.spawns).toBe(0);
    expect(counts.resources).toBe(0);
    expect(counts.stations).toBe(0);
    expect(counts.teleports).toBe(0);
    expect(stub.npcs).toHaveLength(0);
  });

  it("offset 0 leaves coords unchanged (pre-generation case)", () => {
    const stub = makeStubActions();
    rehydrateExtendedLayersFromWorldContent(
      {
        npcs: [{ id: "n1", type: "x", position: { x: 100, y: 5, z: -50 } }],
      },
      stub.actions,
      0,
    );
    const npc = stub.npcs[0] as {
      position: { x: number; y: number; z: number };
    };
    expect(npc.position).toEqual({ x: 100, y: 5, z: -50 });
  });
});
