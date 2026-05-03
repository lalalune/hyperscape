/**
 * `PROPOSE_RESOURCE` — gathering resource placement.
 *
 * Resources are the gathering counterpart to mob spawns: trees,
 * rocks, ore veins, fishing spots — the things players harvest
 * via woodcutting / mining / fishing. Without this action the
 * agent can place enemies (PROPOSE_MOB_SPAWN) but can't seed the
 * world with the gathering loop that supports a full RPG.
 *
 * Validates against `WorldAreaResourceSchema` from
 * `@hyperforge/manifest-schema`. On success the validated entry
 * lands on `data.resource` for the host to merge into its
 * `agentWorldContent` store and persist to `worldContent.resources`.
 *
 * Required:
 *   resourceId — id of the resource definition
 *                (e.g. "tree_oak", "rock_iron", "fish_shrimp")
 *   type       — resource category ("tree", "rock", "fishing-spot")
 *   position   — { x, y, z }
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
import { WorldAreaResourceSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import {
  autoFillAssetRefDetailed,
  describeAutoFillMiss,
  isStrictAutoFillFailure,
  validateAssetRef,
  validatePlacementType,
} from "./placementValidators.js";
import { readObjectField } from "./shared.js";

export const proposeResourceAction: Action = {
  name: "PROPOSE_RESOURCE",
  similes: [
    "PLACE_RESOURCE",
    "ADD_RESOURCE",
    "PLACE_TREE",
    "PLACE_ROCK",
    "PLACE_FISHING_SPOT",
    "SUBMIT_RESOURCE",
  ],
  description:
    "Place a gathering resource (tree / rock / fishing spot / ore vein) in the world. Pass `resource` — JSON matching `WorldAreaResourceSchema`. Required: resourceId, type, position {x,y,z}. Optional: assetRef (a `<packId>/<entryId>` ref from GET_PROJECT_STATE.availableAssets — strongly recommended so the resource has a real 3D model). Use this for the gathering side of an RPG loop; PROPOSE_MOB_SPAWN handles enemies.",

  parameters: [
    {
      name: "resource",
      description:
        "WorldAreaResource JSON. Required: resourceId, type, position {x,y,z}. Optional: assetRef (e.g. `@hyperforge/asset-pack-hyperia-trees-v1/tree_oak_v1`). Example: { resourceId: 'tree_oak', type: 'tree', position: {x: 24, y: 0, z: -8}, assetRef: '@hyperforge/asset-pack-hyperia-trees-v1/tree_oak_v1' }.",
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

    const resourceRaw = readObjectField(options, "resource");
    if (!resourceRaw) {
      const error = new Error(
        "PROPOSE_RESOURCE requires a `resource` parameter — a WorldAreaResource JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaResourceSchema.safeParse(resourceRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Resource invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    let resource = result.data;

    // Layer B — gameplay-typed validation.
    const typeCheck = validatePlacementType(runtime, "resource", resource.type);
    if (!typeCheck.ok) {
      await callback?.({ text: typeCheck.message, error: true });
      return {
        success: false,
        text: typeCheck.message,
        data: typeCheck.detail as unknown as ProviderDataRecord,
      };
    }

    // Auto-fill assetRef when omitted — try resourceId for an
    // exact-match (e.g. "tree_oak" → matching pack entry), else
    // any prop matching the type's acceptedAssetTypes. Strict
    // mode: when the auto-fill can't pick because packs ARE
    // installed but none have a matching prop, REJECT with a
    // clear next-action instruction. Graceful mode: when no
    // packs are installed at all, accept with a warning so the
    // agent's onboarding flow isn't blocked before a pack is
    // added.
    let autoFilledRef: string | null = null;
    let autoFillMissHint: string | null = null;
    const providedRef = (resource as { assetRef?: string }).assetRef;
    if (!providedRef) {
      const result = autoFillAssetRefDetailed(
        runtime,
        "resource",
        resource.type,
        resource.resourceId,
      );
      autoFilledRef = result.ref;
      if (autoFilledRef) {
        resource = { ...resource, assetRef: autoFilledRef };
      } else {
        autoFillMissHint = describeAutoFillMiss(
          result,
          "resource",
          resource.type,
        );
        if (isStrictAutoFillFailure(result.missReason)) {
          const text =
            autoFillMissHint ??
            `Resource rejected — no installed asset pack contributes a prop for resource type "${resource.type}". Call LIST_ASSET_PACKS, install a pack with matching prop assets via PROPOSE_ASSET_PACK_INSTALL, then retry.`;
          await callback?.({ text, error: true });
          return {
            success: false,
            text,
            data: {
              kind: "resource",
              providedType: resource.type,
              resourceId: resource.resourceId,
              missReason: result.missReason,
            } as unknown as ProviderDataRecord,
          };
        }
      }
    }

    const refCheck = validateAssetRef(
      runtime,
      (resource as { assetRef?: string }).assetRef,
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
      `Resource accepted: ${resource.resourceId}`,
      `  type:     ${resource.type}`,
      `  position: (${resource.position.x}, ${resource.position.y}, ${resource.position.z})`,
    ];
    const finalRef = (resource as { assetRef?: string }).assetRef;
    if (finalRef) {
      summary.push(
        `  assetRef: ${finalRef}${autoFilledRef ? " (auto-picked)" : ""}`,
      );
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_RESOURCE" });

    return {
      success: true,
      text,
      data: { resource } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Plant some oak trees around the village." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Resource accepted: tree_oak\n  type: tree\n  position: (24, 0, -8)",
          actions: ["PROPOSE_RESOURCE"],
        },
      },
    ],
  ],
};
