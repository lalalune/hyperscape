/**
 * `PROPOSE_MOB_SPAWN` — mob spawn point authoring action.
 *
 * Phase A2 of the AAA gap audit. RPGs are mostly mobs, not NPCs:
 * NPCs are vendors and quest-givers (typically 1-5 per world),
 * mob spawns are combat encounters (typically 50-500). Until this
 * action exists the agent has no path for "place a goblin spawn
 * here" — the bread-and-butter prompt for any RPG-style world.
 *
 * The handler validates against `WorldAreaMobSpawnSchema` from
 * `@hyperforge/manifest-schema` (the same schema the world-areas
 * manifest is parsed against). On success the validated spawn
 * lands on `data.spawn` for the host to merge into its
 * `agentWorldContent` store.
 *
 * Required `WorldAreaMobSpawn` fields:
 *   mobId      — id of the mob definition (e.g. "goblin", "skeleton")
 *   position   — { x, y, z }
 *   maxCount   — int positive (concurrent spawns at this point)
 *   spawnRadius — non-negative (0 for point spawn, >0 for area)
 */

import type {
  Action,
  ActionResult,
  HandlerCallback,
  HandlerOptions,
  IAgentRuntime,
  Memory,
  ProviderDataRecord,
  State,
} from "@elizaos/core";
import { WorldAreaMobSpawnSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import {
  autoFillAssetRefDetailed,
  describeAutoFillMiss,
  isStrictAutoFillFailure,
  validateAssetRef,
} from "./placementValidators.js";
import { readObjectField } from "./shared.js";

export const proposeMobSpawnAction: Action = {
  name: "PROPOSE_MOB_SPAWN",
  similes: ["PLACE_MOB", "ADD_MOB_SPAWN", "CREATE_SPAWN", "SUBMIT_SPAWN"],
  description:
    "Propose a mob spawn point in the world. Pass `spawn` — a JSON object matching `WorldAreaMobSpawnSchema`. Required: mobId, position {x,y,z}, maxCount, spawnRadius. Optional: assetRef (a `<packId>/<entryId>` ref from GET_PROJECT_STATE.availableAssets — strongly recommended so spawned mobs have real models). Use this for combat encounters; use PROPOSE_NPC_PLACEMENT for vendors/quest-givers/dialogue NPCs.",

  parameters: [
    {
      name: "spawn",
      description:
        "The WorldAreaMobSpawn JSON. Required: mobId, position {x,y,z}, maxCount (int >= 1), spawnRadius (>= 0). Optional: assetRef (e.g. `@hyperforge/asset-pack-hyperia-mobs-v1/goblin`). Example: { mobId: 'goblin', position: {x: 12, y: 0, z: 8}, maxCount: 3, spawnRadius: 5, assetRef: '@hyperforge/asset-pack-hyperia-mobs-v1/goblin' }.",
      required: true,
      schema: { type: "object" },
    },
  ],

  validate: async (runtime: IAgentRuntime) => {
    return (
      runtime.getService<GameBuilderService>(GameBuilderService.serviceType) !==
      null
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: HandlerOptions | Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const service = runtime.getService<GameBuilderService>(
      GameBuilderService.serviceType,
    );
    if (!service) {
      const error = new Error("GameBuilderService not available");
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const spawnRaw = readObjectField(options, "spawn");
    if (!spawnRaw) {
      const error = new Error(
        "PROPOSE_MOB_SPAWN requires a `spawn` parameter — a WorldAreaMobSpawn JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaMobSpawnSchema.safeParse(spawnRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Mob spawn invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    let spawn = result.data;

    // Auto-fill assetRef when omitted — try to match mobId against
    // an exact pack-entry id first ("goblin" mob → goblin entry in
    // mobs pack). Falls back to any creature-type asset if no exact
    // match. Strict mode: when the auto-fill can't pick because
    // packs ARE installed but none have a matching mob model,
    // REJECT with a clear next-action instruction. Graceful mode:
    // when no packs at all are installed, accept with a warning.
    let autoFilledRef: string | null = null;
    let autoFillMissHint: string | null = null;
    const providedRef = (spawn as { assetRef?: string }).assetRef;
    if (!providedRef) {
      const result = autoFillAssetRefDetailed(
        runtime,
        "mobSpawn",
        "",
        spawn.mobId,
      );
      autoFilledRef = result.ref;
      if (autoFilledRef) {
        spawn = { ...spawn, assetRef: autoFilledRef };
      } else {
        autoFillMissHint = describeAutoFillMiss(
          result,
          "mobSpawn",
          spawn.mobId,
        );
        if (isStrictAutoFillFailure(result.missReason)) {
          const text =
            autoFillMissHint ??
            `Mob spawn rejected — no installed asset pack contributes a model for mobId "${spawn.mobId}". Call LIST_ASSET_PACKS, install a pack with creature-type assets via PROPOSE_ASSET_PACK_INSTALL, then retry.`;
          await callback?.({ text, error: true });
          return {
            success: false,
            text,
            data: {
              kind: "mobSpawn",
              mobId: spawn.mobId,
              missReason: result.missReason,
            } as unknown as ProviderDataRecord,
          };
        }
      }
    }

    // Layer B — validate assetRef (mob spawns have no `type`
    // field on the schema; mobId itself selects behavior).
    const refCheck = validateAssetRef(
      runtime,
      (spawn as { assetRef?: string }).assetRef,
    );
    if (!refCheck.ok) {
      await callback?.({ text: refCheck.message, error: true });
      return {
        success: false,
        text: refCheck.message,
        data: refCheck.detail as unknown as ProviderDataRecord,
      };
    }

    const summary = [
      `Mob spawn accepted: ${spawn.mobId}`,
      `  position:     (${spawn.position.x}, ${spawn.position.y}, ${spawn.position.z})`,
      `  maxCount:     ${spawn.maxCount}`,
      `  spawnRadius:  ${spawn.spawnRadius}`,
    ];
    const finalRef = (spawn as { assetRef?: string }).assetRef;
    if (finalRef) {
      summary.push(
        `  assetRef:     ${finalRef}${autoFilledRef ? " (auto-picked)" : ""}`,
      );
    } else if (autoFillMissHint) {
      summary.push(`  warning:      ${autoFillMissHint}`);
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_MOB_SPAWN" });

    return {
      success: true,
      text,
      data: { spawn } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Place 3 goblins near the village entrance." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Mob spawn accepted: goblin\n  position: (12, 0, 8)\n  maxCount: 3\n  spawnRadius: 5",
          actions: ["PROPOSE_MOB_SPAWN"],
        },
      },
    ],
  ],
};
