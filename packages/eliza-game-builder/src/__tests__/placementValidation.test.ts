/**
 * Placement validation — Layer B enforcement tests.
 *
 * Covers `validatePlacementType` and `validateAssetRef` indirectly
 * by exercising the propose actions that wire them in. Keeping
 * the tests at the action layer ensures the integration (including
 * how the runtime's IProjectContextService is read) is what we
 * verify, not just the helper in isolation.
 *
 * Coverage:
 *   - PROPOSE_NPC_PLACEMENT rejects unknown `type`
 *   - PROPOSE_NPC_PLACEMENT rejects assetRef from uninstalled pack
 *   - PROPOSE_NPC_PLACEMENT rejects assetRef whose entry is missing
 *   - PROPOSE_NPC_PLACEMENT happy path with matching type + ref
 *   - PROPOSE_RESOURCE rejects unknown `type`
 *   - PROPOSE_MOB_SPAWN passes when no assetRef (no `type` to check)
 *   - validators no-op when no plugins installed (graceful degrade)
 *   - validators no-op when no project context registered
 */

import { describe, expect, it } from "vitest";
import { proposeNpcPlacementAction } from "../actions/proposeNpcPlacement.js";
import { proposeResourceAction } from "../actions/proposeResource.js";
import { proposeMobSpawnAction } from "../actions/proposeMobSpawn.js";
import { proposeStationAction } from "../actions/proposeStation.js";
import { proposeTeleportAction } from "../actions/proposeTeleport.js";
import {
  PROJECT_CONTEXT_SERVICE_TYPE,
  makeProjectContextService,
  type ProjectContext,
} from "../services/ProjectContextService.js";
import type { IAgentRuntime } from "@elizaos/core";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function runtimeWithCtx(ctx: ProjectContext | null): IAgentRuntime {
  const stub = makeStubRuntime({ service: {} as GameBuilderService });
  const original = stub.runtime;
  return {
    ...original,
    getService: <T>(name: string): T | null => {
      if (name === PROJECT_CONTEXT_SERVICE_TYPE) {
        return makeProjectContextService(ctx) as unknown as T;
      }
      return original.getService<T>(name);
    },
  } as unknown as IAgentRuntime;
}

const HYPERIA_TREES_PACK = {
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

const HYPERIA_NPCS_PACK = {
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
  ],
};

const HYPERIA_STATIONS_PACK = {
  manifestId: "@hyperforge/asset-pack-hyperia-stations-v1",
  name: "Hyperia Stations",
  packVersion: "1.0.0",
  assets: [
    {
      id: "anvil",
      name: "Anvil",
      type: "prop",
      subtype: "anvil",
    },
  ],
};

describe("Layer B placement validators (via propose actions)", () => {
  it("PROPOSE_NPC_PLACEMENT rejects type not in plugin catalog", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_NPCS_PACK],
    });
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        entity: {
          id: "wizard-1",
          type: "wizard", // not in Hyperia's catalog
          position: { x: 0, y: 0, z: 0 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
    expect(String(r?.text)).toContain('Unknown npc type "wizard"');
    expect(String(r?.text)).toContain("shopkeeper");
    const detail = r?.data as { providedType?: string; validTypes?: string[] };
    expect(detail.providedType).toBe("wizard");
    expect(detail.validTypes).toContain("shopkeeper");
  });

  it("PROPOSE_NPC_PLACEMENT rejects assetRef pointing at uninstalled pack", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_NPCS_PACK],
    });
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
          assetRef: "@some/uninstalled-pack-v1/x", // pack not installed
        },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
    expect(String(r?.text)).toMatch(/isn't installed/);
    const detail = r?.data as { packId?: string };
    expect(detail.packId).toBe("@some/uninstalled-pack-v1");
  });

  it("PROPOSE_NPC_PLACEMENT rejects assetRef whose entry is missing", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_NPCS_PACK],
    });
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
          assetRef: "@hyperforge/asset-pack-hyperia-npcs-v1/nonexistent-entry",
        },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
    expect(String(r?.text)).toMatch(/doesn't contain an entry/);
  });

  it("PROPOSE_NPC_PLACEMENT happy path with matching type + ref", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_NPCS_PACK],
    });
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
          assetRef: "@hyperforge/asset-pack-hyperia-npcs-v1/shopkeeper",
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { entity: { id: string; assetRef?: string } };
    expect(data.entity.id).toBe("shop-1");
    expect(data.entity.assetRef).toBe(
      "@hyperforge/asset-pack-hyperia-npcs-v1/shopkeeper",
    );
  });

  it("PROPOSE_RESOURCE rejects unknown resource type", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_TREES_PACK],
    });
    const r = await proposeResourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        resource: {
          resourceId: "fake_resource",
          type: "magic-orb", // not in resource catalog
          position: { x: 0, y: 0, z: 0 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
    expect(String(r?.text)).toContain('Unknown resource type "magic-orb"');
  });

  it("PROPOSE_RESOURCE happy path with matching type + ref", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_TREES_PACK],
    });
    const r = await proposeResourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        resource: {
          resourceId: "tree_oak",
          type: "tree",
          position: { x: 24, y: 0, z: -8 },
          assetRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_oak_v1",
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
  });

  it("PROPOSE_MOB_SPAWN passes when no assetRef + type-irrelevant", async () => {
    // Mob spawns don't carry a `type` field, so type validation
    // doesn't apply. Without an assetRef there's nothing else to
    // check beyond the schema.
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [],
    });
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
  });

  it("validators skip when no plugins installed", async () => {
    // No plugins → no entity-type catalog → nothing to validate
    // type against. The action should succeed regardless of the
    // type string (graceful degrade).
    const runtime = runtimeWithCtx({
      plugins: [],
      assetPacks: [],
    });
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        entity: {
          id: "n1",
          type: "anything-goes",
          position: { x: 0, y: 0, z: 0 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
  });

  it("validators skip when no project context registered", async () => {
    // No IProjectContextService at all (simulating a no-project
    // /design call). Validators degrade to passthrough.
    const runtime = runtimeWithCtx(null);
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        entity: {
          id: "n1",
          type: "still-anything",
          position: { x: 0, y: 0, z: 0 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
  });

  it("PROPOSE_STATION rejects unknown station type", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_STATIONS_PACK],
    });
    const r = await proposeStationAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        station: {
          id: "magic-altar-1",
          type: "magic-altar", // not in Hyperia's station catalog
          position: { x: 0, y: 0, z: 0 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
    expect(String(r?.text)).toContain('Unknown station type "magic-altar"');
    expect(String(r?.text)).toContain("anvil");
  });

  it("PROPOSE_STATION happy path with anvil + matching ref", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_STATIONS_PACK],
    });
    const r = await proposeStationAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        station: {
          id: "smithy-anvil",
          type: "anvil",
          position: { x: 12, y: 0, z: 8 },
          assetRef: "@hyperforge/asset-pack-hyperia-stations-v1/anvil",
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      station: { id: string; type: string; assetRef?: string };
    };
    expect(data.station.id).toBe("smithy-anvil");
    expect(data.station.type).toBe("anvil");
    expect(data.station.assetRef).toBe(
      "@hyperforge/asset-pack-hyperia-stations-v1/anvil",
    );
  });

  it("auto-fills assetRef on NPC when omitted", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_NPCS_PACK],
    });
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
          // assetRef intentionally omitted
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { entity: { assetRef?: string } };
    expect(data.entity.assetRef).toBe(
      "@hyperforge/asset-pack-hyperia-npcs-v1/shopkeeper",
    );
    expect(String(r?.text)).toContain("auto-picked");
  });

  it("auto-fills mob spawn assetRef by mobId when entry id matches", async () => {
    const mobsPack = {
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
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [mobsPack],
    });
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
          // assetRef omitted — should auto-pick goblin entry
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { spawn: { assetRef?: string } };
    expect(data.spawn.assetRef).toBe(
      "@hyperforge/asset-pack-hyperia-mobs-v1/goblin",
    );
  });

  it("auto-fills resource assetRef when omitted", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_TREES_PACK],
    });
    const r = await proposeResourceAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        resource: {
          resourceId: "tree_oak",
          type: "tree",
          position: { x: 24, y: 0, z: -8 },
          // assetRef omitted
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { resource: { assetRef?: string } };
    // "tree_oak" doesn't match the pack's "tree_oak_v1" id exactly,
    // so the type-based fallback kicks in and picks the first prop.
    expect(data.resource.assetRef).toBe(
      "@hyperforge/asset-pack-hyperia-trees-v1/tree_oak_v1",
    );
  });

  it("auto-fills station assetRef when omitted", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_STATIONS_PACK],
    });
    const r = await proposeStationAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        station: {
          id: "smithy-anvil",
          type: "anvil",
          position: { x: 12, y: 0, z: 8 },
          // assetRef omitted
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { station: { assetRef?: string } };
    // Station auto-fill prefers type === entryId match, so anvil
    // station picks the anvil entry.
    expect(data.station.assetRef).toBe(
      "@hyperforge/asset-pack-hyperia-stations-v1/anvil",
    );
  });

  it("auto-fill is no-op when no installed packs", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [],
    });
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        entity: {
          id: "n1",
          type: "shopkeeper",
          storeId: "general",
          position: { x: 0, y: 0, z: 0 },
          // omitted, nothing to auto-fill
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { entity: { assetRef?: string } };
    expect(data.entity.assetRef).toBeUndefined();
  });

  it("malformed assetRef is rejected explicitly", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [HYPERIA_NPCS_PACK],
    });
    const r = await proposeNpcPlacementAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        entity: {
          id: "n1",
          type: "shopkeeper",
          storeId: "general",
          position: { x: 0, y: 0, z: 0 },
          assetRef: "no-slash-here",
        },
      },
      undefined,
    );
    // Schema's regex catches malformed shape FIRST (validator never
    // runs because Zod rejects). Either way: not success.
    expect(r?.success).toBe(false);
  });

  it("PROPOSE_TELEPORT happy path with all required fields", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [],
    });
    const r = await proposeTeleportAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        teleport: {
          id: "village-lodestone",
          name: "Village Lodestone",
          type: "lodestone",
          position: { x: 0, y: 0, z: 0 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      teleport: { id: string; name: string; type: string };
    };
    expect(data.teleport.id).toBe("village-lodestone");
    expect(data.teleport.type).toBe("lodestone");
  });

  it("PROPOSE_TELEPORT preserves optional requirements + cost", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [],
    });
    const r = await proposeTeleportAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        teleport: {
          id: "ancient-portal",
          name: "Ancient Portal",
          type: "portal",
          position: { x: 50, y: 0, z: 50 },
          requirements: { questComplete: "lost_city", level: 30 },
          cost: 100,
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as {
      teleport: {
        requirements?: { questComplete?: string | null; level?: number };
        cost?: number;
      };
    };
    expect(data.teleport.requirements?.questComplete).toBe("lost_city");
    expect(data.teleport.requirements?.level).toBe(30);
    expect(data.teleport.cost).toBe(100);
  });

  it("PROPOSE_TELEPORT rejects type outside the enum", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [],
    });
    const r = await proposeTeleportAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        teleport: {
          id: "bad",
          name: "Bad",
          type: "wormhole", // not in enum
          position: { x: 0, y: 0, z: 0 },
        },
      },
      undefined,
    );
    expect(r?.success).toBe(false);
    expect(String(r?.text)).toContain("Teleport invalid");
  });

  it("PROPOSE_TELEPORT auto-fills assetRef when an exact-id match exists", async () => {
    const runtime = runtimeWithCtx({
      plugins: ["com.hyperforge.hyperscape"],
      assetPacks: [
        {
          manifestId: "@hyperforge/asset-pack-hyperia-portals-v1",
          name: "Hyperia Portals",
          packVersion: "1.0.0",
          assets: [
            {
              id: "lodestone",
              name: "Lodestone",
              type: "prop",
              subtype: "lodestone",
            },
          ],
        },
      ],
    });
    const r = await proposeTeleportAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        teleport: {
          id: "village-lodestone",
          name: "Village Lodestone",
          type: "lodestone",
          position: { x: 0, y: 0, z: 0 },
          // assetRef omitted — auto-fill should pick the lodestone entry
        },
      },
      undefined,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { teleport: { assetRef?: string } };
    expect(data.teleport.assetRef).toBe(
      "@hyperforge/asset-pack-hyperia-portals-v1/lodestone",
    );
  });
});
