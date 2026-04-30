/**
 * `PROPOSE_NPC_PLACEMENT` — first world-content authoring action.
 *
 * Phase B1.2 of `PLAN_AAA_QUALITY.md`. After the agent has decided
 * an NPC should exist somewhere in the world, it emits a single
 * `WorldAreaNPC`-shaped object as the `entity` parameter. The
 * handler validates against `WorldAreaNPCSchema` from
 * `@hyperforge/manifest-schema` (the same schema the world-areas
 * manifest is parsed against) and surfaces every Zod issue back
 * to the agent on failure so it can fix and retry.
 *
 * On success the validated entity lands on `data.entity` for the
 * host to merge into its `agentWorldContent` store. The host wires
 * that store into the editor's rendering pipeline so the NPC
 * appears in the PIE viewport without any further round-trip.
 *
 * Required `WorldAreaNPC` fields (from world-areas.ts):
 *   id, type, position { x, y, z }
 *
 * Optional:
 *   name, storeId, dialogue (record<string, string>)
 *
 * The schema uses `.passthrough()` so additional engine-specific
 * fields (rotation, scale, custom data) are preserved.
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
import { WorldAreaNPCSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import {
  autoFillAssetRef,
  validateAssetRef,
  validatePlacementType,
} from "./placementValidators.js";
import { readObjectField } from "./shared.js";

export const proposeNpcPlacementAction: Action = {
  name: "PROPOSE_NPC_PLACEMENT",
  similes: ["PLACE_NPC", "ADD_NPC", "CREATE_NPC", "SUBMIT_NPC"],
  description:
    "Propose an NPC placement in the world. Pass `entity` — a JSON object matching `WorldAreaNPCSchema` (id, type, position {x,y,z}; optionally name, storeId, dialogue, assetRef). The handler validates against the canonical schema; on success the validated entity is surfaced on `data.entity` for the host to merge into the editor's agent-world-content store. STRONGLY PREFER setting `assetRef` to a value from `GET_PROJECT_STATE` (select=availableAssets) — without it the placed NPC renders as a generic placeholder; with it the engine loads the actual model.",

  parameters: [
    {
      name: "entity",
      description:
        "The WorldAreaNPC JSON. Required: id (string), type (e.g. 'shopkeeper', 'questgiver', 'guard'), position {x,y,z}. Optional: name, storeId (when type is a shop), dialogue (record of string→string), assetRef (a `<packId>/<entryId>` ref pulled from GET_PROJECT_STATE.availableAssets — strongly recommended so the NPC has a real model).",
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

    const entityRaw = readObjectField(options, "entity");
    if (!entityRaw) {
      const error = new Error(
        "PROPOSE_NPC_PLACEMENT requires an `entity` parameter — a WorldAreaNPC JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaNPCSchema.safeParse(entityRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `NPC invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    let entity = result.data;

    // Layer B — gameplay-typed validation. The `type` must be a
    // value an installed plugin actually handles.
    const typeCheck = validatePlacementType(runtime, "npc", entity.type);
    if (!typeCheck.ok) {
      await callback?.({ text: typeCheck.message, error: true });
      return {
        success: false,
        text: typeCheck.message,
        data: typeCheck.detail as unknown as ProviderDataRecord,
      };
    }

    // Auto-fill assetRef when omitted — pick the first matching
    // asset whose `type` is in the entity type's
    // `acceptedAssetTypes`. Best-effort; null = render placeholder.
    let autoFilledRef: string | null = null;
    const providedRef = (entity as { assetRef?: string }).assetRef;
    if (!providedRef) {
      autoFilledRef = autoFillAssetRef(runtime, "npc", entity.type);
      if (autoFilledRef) {
        entity = { ...entity, assetRef: autoFilledRef };
      }
    }

    const refCheck = validateAssetRef(
      runtime,
      (entity as { assetRef?: string }).assetRef,
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
      `NPC accepted: ${entity.id}`,
      `  type:     ${entity.type}`,
      `  position: (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`,
    ];
    if (entity.name) summary.push(`  name:     ${entity.name}`);
    if (entity.storeId) summary.push(`  storeId:  ${entity.storeId}`);
    const finalRef = (entity as { assetRef?: string }).assetRef;
    if (finalRef) {
      summary.push(
        `  assetRef: ${finalRef}${autoFilledRef ? " (auto-picked)" : ""}`,
      );
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_NPC_PLACEMENT" });

    return {
      success: true,
      text,
      values: { id: entity.id, type: entity.type },
      data: { entity } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "user",
        content: {
          text: "Place a shopkeeper named Eldric at the town center.",
        },
      },
      {
        name: "agent",
        content: {
          text: "NPC accepted: eldric_shopkeeper\n  type:     shopkeeper\n  position: (0, 0, 0)\n  name:     Eldric",
          action: "PROPOSE_NPC_PLACEMENT",
        },
      },
    ],
  ],
};
