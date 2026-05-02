/**
 * `PROPOSE_WATER_BODY` — placement action for rivers / lakes / ponds.
 *
 * R4.P8 of `PLAN_HYPERIA_DECOUPLING.md` — first of the 8 missing
 * agent vocabulary actions to land. Studio's `extendedLayers
 * .waterBodies` slot + `editorMarkers` rendering already
 * existed; this action lets the agent populate them.
 *
 *   bodyType  — river / lake / pond
 *   id        — unique water body id
 *   name      — display name
 *   waypoints — river-only; ordered (x, z, halfWidth, depth) chain
 *   polygon   — lake / pond; closed polygon of (x, z) points
 *   surfaceY  — water surface elevation
 *
 * Like roads, water bodies have NO Layer B plugin-type validation
 * — there's no concept of "water body type" that plugins
 * contribute beyond the river/lake/pond shape distinction. Just
 * Zod-validate the schema + check assetRef when set.
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
import { WorldAreaWaterBodySchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { validateAssetRef } from "./placementValidators.js";
import { readObjectField } from "./shared.js";

export const proposeWaterBodyAction: Action = {
  name: "PROPOSE_WATER_BODY",
  similes: [
    "PLACE_WATER_BODY",
    "ADD_WATER_BODY",
    "DRAW_RIVER",
    "ADD_LAKE",
    "ADD_POND",
    "CREATE_WATER",
  ],
  description:
    "Propose a river / lake / pond. Pass `waterBody` — a JSON object matching `WorldAreaWaterBodySchema`. Required: id (string), name (string), bodyType ('river' | 'lake' | 'pond'). For rivers: `waypoints` (array of { x, z, halfWidth, depth, surfaceY? } points; minimum 2). For lakes / ponds: `polygon` (array of { x, z } points; minimum 3, closed shape). Optional everywhere: `surfaceY` (water elevation), `assetRef` (pack ref for visual styling). " +
    "Use rivers to connect higher elevation regions to lower ones — they cut through terrain and shape settlement placement. Use lakes for resource hubs (fishing, drinking water) at low-elevation basins. Use ponds for atmospheric details near towns + shrines.",

  parameters: [
    {
      name: "waterBody",
      description:
        "WorldAreaWaterBody JSON. Required: id, name, bodyType. For rivers: waypoints (>= 2). For lakes / ponds: polygon (>= 3). Optional: surfaceY, bermWidth, valleyMultiplier, assetRef. Example river: { id: 'misty-river', name: 'Misty River', bodyType: 'river', waypoints: [{x: -200, z: 50, halfWidth: 4, depth: 2}, {x: 100, z: 30, halfWidth: 6, depth: 3}], surfaceY: 0 }.",
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

    const raw = readObjectField(options, "waterBody");
    if (!raw) {
      const error = new Error(
        "PROPOSE_WATER_BODY requires a `waterBody` parameter — a WorldAreaWaterBody JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaWaterBodySchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Water body invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const waterBody = result.data;

    const refCheck = validateAssetRef(
      runtime,
      (waterBody as { assetRef?: string }).assetRef,
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
      `Water body accepted: ${waterBody.id} (${waterBody.name})`,
      `  type:    ${waterBody.bodyType}`,
    ];
    if (waterBody.bodyType === "river" && waterBody.waypoints) {
      summary.push(`  waypoints: ${waterBody.waypoints.length}`);
    } else if (waterBody.polygon) {
      summary.push(`  polygon points: ${waterBody.polygon.length}`);
    }
    if (typeof waterBody.surfaceY === "number") {
      summary.push(`  surfaceY: ${waterBody.surfaceY}`);
    }
    const finalRef = (waterBody as { assetRef?: string }).assetRef;
    if (finalRef) {
      summary.push(`  assetRef: ${finalRef}`);
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_WATER_BODY" });

    return {
      success: true,
      text,
      values: { id: waterBody.id, bodyType: waterBody.bodyType },
      data: { waterBody } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Add a river that cuts through the canyon biome." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Water body accepted: canyon-river (Canyon River)\n  type: river\n  waypoints: 4\n  surfaceY: 0",
          actions: ["PROPOSE_WATER_BODY"],
        },
      },
    ],
  ],
};
