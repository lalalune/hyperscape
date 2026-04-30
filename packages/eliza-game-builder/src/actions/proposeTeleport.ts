/**
 * `PROPOSE_TELEPORT` — placement action for teleport nodes
 * (lodestones, portals, shortcuts).
 *
 * The schema's `type` field is a fixed enum (`lodestone | portal
 * | shortcut`) — Hyperia core handles all three; plugins do not
 * extend this set. So unlike PROPOSE_NPC / MOB / RESOURCE /
 * STATION, this handler does NOT call `validatePlacementType`.
 * Zod's enum check is the type validation.
 *
 * Required fields:
 *   id, name, type, position { x, y, z }
 *
 * Optional:
 *   requirements ({ questComplete?, level?, itemId? }), cost,
 *   assetRef — `<packId>/<entryId>` from
 *   GET_PROJECT_STATE.availableAssets
 *
 * The schema uses `.passthrough()` so engine-specific extra
 * fields (rotation, scale) are preserved.
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
import { WorldAreaTeleportNodeSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { autoFillAssetRef, validateAssetRef } from "./placementValidators.js";
import { readObjectField } from "./shared.js";

export const proposeTeleportAction: Action = {
  name: "PROPOSE_TELEPORT",
  similes: [
    "PLACE_TELEPORT",
    "ADD_TELEPORT",
    "PLACE_LODESTONE",
    "PLACE_PORTAL",
    "SUBMIT_TELEPORT",
  ],
  description:
    'Propose a teleport node (lodestone, portal, or shortcut) in the world. Pass `teleport` — a JSON object matching `WorldAreaTeleportNodeSchema` (id, name, type ∈ {"lodestone","portal","shortcut"}, position {x,y,z}; optionally requirements {questComplete, level, itemId}, cost, assetRef). The handler validates the schema, then validates that `assetRef` (when provided) resolves in an installed pack. Strongly recommend setting `assetRef` to a value from `GET_PROJECT_STATE.availableAssets` so the engine renders an actual model. Type is fixed by the schema enum — no plugin contribution to check.',

  parameters: [
    {
      name: "teleport",
      description:
        "The WorldAreaTeleportNode JSON. Required: id (string), name (string), type ('lodestone' | 'portal' | 'shortcut'), position {x,y,z}. Optional: requirements {questComplete?: string|null, level?: number, itemId?: string}, cost (number), assetRef (a `<packId>/<entryId>` ref from GET_PROJECT_STATE.availableAssets).",
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

    const teleportRaw = readObjectField(options, "teleport");
    if (!teleportRaw) {
      const error = new Error(
        "PROPOSE_TELEPORT requires a `teleport` parameter — a WorldAreaTeleportNode JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaTeleportNodeSchema.safeParse(teleportRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Teleport invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    let teleport = result.data;

    // Auto-fill assetRef when omitted. Teleports don't use the
    // `kind` validation surface (their type is a fixed enum), but
    // they CAN benefit from asset auto-fill: try the type as the
    // preferred id (`lodestone` → `lodestone` entry in a portals
    // pack), then fall through to any prop the type matches.
    let autoFilledRef: string | null = null;
    const providedRef = (teleport as { assetRef?: string }).assetRef;
    if (!providedRef) {
      autoFilledRef = autoFillAssetRef(
        runtime,
        // No "teleport" PlacementKind — passing "station" is a
        // safe stand-in: type-based pass falls through (no
        // contribution match), and the preferredId pass still
        // tries an exact id match against installed packs.
        "station",
        "",
        teleport.type,
      );
      if (autoFilledRef) {
        teleport = { ...teleport, assetRef: autoFilledRef };
      }
    }

    const refCheck = validateAssetRef(
      runtime,
      (teleport as { assetRef?: string }).assetRef,
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
      `Teleport accepted: ${teleport.id}`,
      `  name:     ${teleport.name}`,
      `  type:     ${teleport.type}`,
      `  position: (${teleport.position.x}, ${teleport.position.y}, ${teleport.position.z})`,
    ];
    if (teleport.cost !== undefined) {
      summary.push(`  cost:     ${teleport.cost}`);
    }
    const reqs = teleport.requirements;
    if (reqs && (reqs.questComplete || reqs.level || reqs.itemId)) {
      const parts: string[] = [];
      if (reqs.questComplete) parts.push(`quest=${reqs.questComplete}`);
      if (reqs.level) parts.push(`level=${reqs.level}`);
      if (reqs.itemId) parts.push(`item=${reqs.itemId}`);
      summary.push(`  requires: ${parts.join(", ")}`);
    }
    const finalRef = (teleport as { assetRef?: string }).assetRef;
    if (finalRef) {
      summary.push(
        `  assetRef: ${finalRef}${autoFilledRef ? " (auto-picked)" : ""}`,
      );
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_TELEPORT" });

    return {
      success: true,
      text,
      values: { id: teleport.id, type: teleport.type },
      data: { teleport } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Add a lodestone at the village center so players can fast-travel back here.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Teleport accepted: village-lodestone\n  name: Village Lodestone\n  type: lodestone\n  position: (0, 0, 0)",
          actions: ["PROPOSE_TELEPORT"],
        },
      },
    ],
  ],
};
