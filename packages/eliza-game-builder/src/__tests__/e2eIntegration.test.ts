/**
 * End-to-end agent integration smoke test.
 *
 * Walks a single conceptual flow:
 *   1. AI inspects what's available (LIST_ENTITY_TYPES,
 *      LIST_ASSET_PACKS, GET_PROJECT_STATE).
 *   2. AI emits placements with auto-fill (no assetRef).
 *   3. AI emits a placement with a bad type → rejected with a
 *      catalog-driven error.
 *   4. AI emits a placement with a bad assetRef → rejected.
 *   5. Successful placements carry the auto-filled assetRef.
 *
 * Single test file so a regression in any of the layers (schema,
 * validators, plugin entity-type catalog, asset pack catalog,
 * project context wiring) shows up here as a clear failure
 * pinned to the integration boundary, not buried inside one of
 * the per-action tests.
 *
 * Renderer integration (`useAgentEntityMarkers` →
 * `assetRefResolver` → `loadModelForScene`) lives in the
 * asset-forge package and is exercised separately; here we
 * verify that the data leaving the agent action is shaped
 * correctly for that downstream consumer.
 */

import { describe, expect, it } from "vitest";
import type { IAgentRuntime } from "@elizaos/core";

import { listEntityTypesAction } from "../actions/listEntityTypes.js";
import { listAssetPacksAction } from "../actions/listAssetPacks.js";
import { getProjectStateAction } from "../actions/getProjectState.js";
import { proposeNpcPlacementAction } from "../actions/proposeNpcPlacement.js";
import { proposeMobSpawnAction } from "../actions/proposeMobSpawn.js";
import { proposeResourceAction } from "../actions/proposeResource.js";
import { proposeStationAction } from "../actions/proposeStation.js";
import {
  PROJECT_CONTEXT_SERVICE_TYPE,
  makeProjectContextService,
  type ProjectContext,
} from "../services/ProjectContextService.js";
import {
  ASSET_PACK_CATALOG_SERVICE_TYPE,
  makeAssetPackCatalogService,
  type InstallableAssetPack,
} from "../services/AssetPackCatalogService.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

// Realistic Hyperia-shaped fixtures — mirror what a project that's
// installed the npcs, mobs, trees, and stations packs looks like.
const NPCS_PACK = {
  manifestId: "@hyperforge/asset-pack-hyperia-npcs-v1",
  name: "Hyperia NPCs",
  packVersion: "1.0.0",
  assets: [
    {
      id: "shopkeeper",
      name: "Shopkeeper",
      type: "character",
      subtype: "humanoid",
    },
    {
      id: "captain-rowan",
      name: "Captain Rowan",
      type: "character",
      subtype: "guard",
    },
  ],
};

const MOBS_PACK = {
  manifestId: "@hyperforge/asset-pack-hyperia-mobs-v1",
  name: "Hyperia Mobs",
  packVersion: "1.0.0",
  assets: [
    {
      id: "goblin",
      name: "Goblin",
      type: "creature",
      subtype: "monster",
    },
    {
      id: "wolf",
      name: "Wolf",
      type: "creature",
      subtype: "beast",
    },
  ],
};

const TREES_PACK = {
  manifestId: "@hyperforge/asset-pack-hyperia-trees-v1",
  name: "Hyperia Trees",
  packVersion: "1.0.0",
  assets: [
    {
      id: "tree_oak_v1",
      name: "Oak Tree #1",
      type: "prop",
      subtype: "tree",
    },
  ],
};

const STATIONS_PACK = {
  manifestId: "@hyperforge/asset-pack-hyperia-stations-v1",
  name: "Hyperia Stations",
  packVersion: "1.0.0",
  assets: [
    { id: "anvil", name: "Anvil", type: "prop", subtype: "anvil" },
    { id: "furnace", name: "Furnace", type: "prop", subtype: "furnace" },
  ],
};

const FULL_CONTEXT: ProjectContext = {
  plugins: ["com.hyperforge.hyperscape"],
  assetPacks: [NPCS_PACK, MOBS_PACK, TREES_PACK, STATIONS_PACK],
};

const INSTALLABLE_AS_CATALOG: InstallableAssetPack[] = [
  {
    manifestId: NPCS_PACK.manifestId,
    name: NPCS_PACK.name,
    description: "",
    packVersion: NPCS_PACK.packVersion,
    assetCount: NPCS_PACK.assets.length,
    tags: [],
    source: "builtin",
  },
  {
    manifestId: MOBS_PACK.manifestId,
    name: MOBS_PACK.name,
    description: "",
    packVersion: MOBS_PACK.packVersion,
    assetCount: MOBS_PACK.assets.length,
    tags: [],
    source: "builtin",
  },
];

function fullRuntime(): IAgentRuntime {
  const stub = makeStubRuntime({ service: {} as GameBuilderService });
  const original = stub.runtime;
  return {
    ...original,
    getService: <T>(name: string): T | null => {
      if (name === PROJECT_CONTEXT_SERVICE_TYPE) {
        return makeProjectContextService(FULL_CONTEXT) as unknown as T;
      }
      if (name === ASSET_PACK_CATALOG_SERVICE_TYPE) {
        return makeAssetPackCatalogService(
          INSTALLABLE_AS_CATALOG,
        ) as unknown as T;
      }
      return original.getService<T>(name);
    },
  } as unknown as IAgentRuntime;
}

describe("e2e agent integration smoke", () => {
  const runtime = fullRuntime();

  it("LIST_ENTITY_TYPES returns Hyperia's full catalog", async () => {
    const r = await listEntityTypesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      entityTypes: Array<{ kind: string; type: string }>;
    };
    expect(data.entityTypes.length).toBe(15);
    const types = new Set(data.entityTypes.map((e) => `${e.kind}:${e.type}`));
    expect(types.has("npc:shopkeeper")).toBe(true);
    expect(types.has("mobSpawn:aggressive")).toBe(true);
    expect(types.has("resource:tree")).toBe(true);
    expect(types.has("station:anvil")).toBe(true);
  });

  it("LIST_ASSET_PACKS returns the installable catalog", async () => {
    const r = await listAssetPacksAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { packs: Array<{ manifestId: string }> };
    expect(data.packs.map((p) => p.manifestId)).toEqual([
      NPCS_PACK.manifestId,
      MOBS_PACK.manifestId,
    ]);
  });

  it("GET_PROJECT_STATE select=availableAssets returns refs from installed packs", async () => {
    const r = await getProjectStateAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { select: "availableAssets" },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      projectContext: {
        assets: Array<{ ref: string; type: string }>;
      };
    };
    const refs = data.projectContext.assets.map((a) => a.ref);
    expect(refs).toContain(`${NPCS_PACK.manifestId}/shopkeeper`);
    expect(refs).toContain(`${MOBS_PACK.manifestId}/goblin`);
    expect(refs).toContain(`${TREES_PACK.manifestId}/tree_oak_v1`);
    expect(refs).toContain(`${STATIONS_PACK.manifestId}/anvil`);
  });

  it("PROPOSE_NPC_PLACEMENT auto-fills assetRef end-to-end", async () => {
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        entity: {
          id: "shop-1",
          type: "shopkeeper",
          storeId: "general",
          position: { x: 0, y: 0, z: 0 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { entity: { assetRef?: string } };
    // Auto-fill picks the first character asset; npcs pack's
    // first entry is "shopkeeper".
    expect(data.entity.assetRef).toBe(`${NPCS_PACK.manifestId}/shopkeeper`);
  });

  it("PROPOSE_NPC_PLACEMENT rejects bad type with catalog hint", async () => {
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        entity: {
          id: "wizard-1",
          type: "wizard",
          position: { x: 0, y: 0, z: 0 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
    const text = String(r?.text);
    expect(text).toContain('Unknown npc type "wizard"');
    expect(text).toContain("shopkeeper"); // valid alternative
    expect(text).toContain("LIST_ENTITY_TYPES");
  });

  it("PROPOSE_NPC_PLACEMENT rejects assetRef from uninstalled pack", async () => {
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        entity: {
          id: "shop-1",
          type: "shopkeeper",
          storeId: "general",
          position: { x: 0, y: 0, z: 0 },
          assetRef: "@bogus/never-installed-v1/who",
        },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
    const text = String(r?.text);
    expect(text).toContain("isn't installed");
    expect(text).toContain("@bogus/never-installed-v1");
  });

  it("PROPOSE_MOB_SPAWN auto-fills assetRef from mobId", async () => {
    const r = await proposeMobSpawnAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        spawn: {
          mobId: "goblin",
          position: { x: 12, y: 0, z: 8 },
          maxCount: 3,
          spawnRadius: 5,
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { spawn: { assetRef?: string } };
    expect(data.spawn.assetRef).toBe(`${MOBS_PACK.manifestId}/goblin`);
  });

  it("PROPOSE_RESOURCE auto-fills + accepts the type", async () => {
    const r = await proposeResourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        resource: {
          resourceId: "tree_oak",
          type: "tree",
          position: { x: 24, y: 0, z: -8 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { resource: { assetRef?: string } };
    // No exact id match (`tree_oak` vs `tree_oak_v1`), so type-based
    // fallback picks the first prop in the trees pack.
    expect(data.resource.assetRef).toBe(`${TREES_PACK.manifestId}/tree_oak_v1`);
  });

  it("PROPOSE_STATION auto-fills assetRef by exact-id (type === entryId)", async () => {
    const r = await proposeStationAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        station: {
          id: "smithy-anvil",
          type: "anvil",
          position: { x: 12, y: 0, z: 8 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { station: { assetRef?: string } };
    expect(data.station.assetRef).toBe(`${STATIONS_PACK.manifestId}/anvil`);
  });

  it("Each successful placement carries the resolved assetRef on its data field", async () => {
    // Spot-check: the entity object returned to the host is what
    // gets persisted. Auto-fill must mutate the entity, not just
    // log the chosen ref. Without this guarantee, the agent
    // emission would silently lose the auto-pick downstream.
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        entity: {
          id: "shop-2",
          type: "shopkeeper",
          storeId: "armor",
          position: { x: 5, y: 0, z: -5 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { entity: Record<string, unknown> };
    expect(data.entity.id).toBe("shop-2");
    expect(typeof data.entity.assetRef).toBe("string");
    expect(String(data.entity.assetRef)).toMatch(
      /^@hyperforge\/asset-pack-hyperia-npcs-v1\//,
    );
  });
});
