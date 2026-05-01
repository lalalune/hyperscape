/**
 * `PROPOSE_POI` — placement action for Points of Interest.
 *
 * P5.a of `PLAN_AGENT_STUDIO_PARITY.md`. POIs are named landmarks
 * with a radius + importance weight + optional road connectivity:
 * dungeons, shrines, ruins, camps, crossings, waystations,
 * fishing spots. The studio renders them as outlined regions on
 * the terrain and feeds them into procgen's road-connectivity
 * pass (high-importance POIs get more road connections).
 *
 * Categories are a fixed enum — no plugin contribution model
 * (POI categories are universal across game genres). Just
 * Zod-validate the schema + check assetRef when set.
 *
 * Required fields:
 *   id          — unique POI id
 *   name        — display name
 *   category    — fixed enum (dungeon / shrine / landmark /
 *                 resource_area / ruin / camp / crossing /
 *                 waystation / fishing_spot)
 *   position    — game-space coords
 *   importance  — 0-1, higher = more road connectivity
 *   radius      — POI area radius in meters; positive
 *
 * Optional:
 *   connectedRoads — ids of roads at this POI (pair with PROPOSE_ROAD)
 *   entryPoint     — { x, z, angle } visitor approach
 *   assetRef       — pack ref for the POI's anchor model
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
import { WorldAreaPOISchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { validateAssetRef } from "./placementValidators.js";
import { readObjectField } from "./shared.js";

export const proposePOIAction: Action = {
  name: "PROPOSE_POI",
  similes: [
    "PLACE_POI",
    "ADD_POI",
    "PLACE_LANDMARK",
    "PLACE_DUNGEON",
    "PLACE_SHRINE",
    "PLACE_CAMP",
    "PLACE_RUIN",
    "SUBMIT_POI",
  ],
  description:
    "Propose a Point of Interest in the world. Pass `poi` — a JSON object matching `WorldAreaPOISchema`. Required: id, name, category (one of: dungeon, shrine, landmark, resource_area, ruin, camp, crossing, waystation, fishing_spot), position {x,y,z}, importance (0-1), radius (positive). Optional: connectedRoads, entryPoint {x,z,angle}, assetRef. " +
    "Use POIs for player-visible destinations (dungeons, shrines), navigation anchors (crossings, waystations), and procgen hooks (high-importance POIs attract more road connections). Pair with PROPOSE_ROAD to wire POIs into the travel network.",

  parameters: [
    {
      name: "poi",
      description:
        "WorldAreaPOI JSON. Required: id, name, category (fixed enum), position {x,y,z}, importance (0-1), radius>0. Example: { id: 'whispering-cave', name: 'Whispering Cave', category: 'dungeon', position: {x:120,y:0,z:80}, importance: 0.8, radius: 30 }.",
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

    const poiRaw = readObjectField(options, "poi");
    if (!poiRaw) {
      const error = new Error(
        "PROPOSE_POI requires a `poi` parameter — a WorldAreaPOI JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaPOISchema.safeParse(poiRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `POI invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const poi = result.data;

    // No plugin-type validation (POI category is a fixed enum);
    // just verify assetRef when set.
    const refCheck = validateAssetRef(
      runtime,
      (poi as { assetRef?: string }).assetRef,
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
      `POI accepted: ${poi.id} (${poi.name})`,
      `  category:   ${poi.category}`,
      `  position:   (${poi.position.x}, ${poi.position.y}, ${poi.position.z})`,
      `  radius:     ${poi.radius}m`,
      `  importance: ${poi.importance}`,
    ];
    if (poi.connectedRoads && poi.connectedRoads.length > 0) {
      summary.push(`  roads:      ${poi.connectedRoads.join(", ")}`);
    }
    const finalRef = (poi as { assetRef?: string }).assetRef;
    if (finalRef) {
      summary.push(`  assetRef:   ${finalRef}`);
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_POI" });

    return {
      success: true,
      text,
      values: { id: poi.id, category: poi.category },
      data: { poi } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Add a dungeon in the canyon to the east." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "POI accepted: canyon-depths (Canyon Depths)\n  category:   dungeon\n  position:   (200, 0, 50)\n  radius:     40m\n  importance: 0.9",
          actions: ["PROPOSE_POI"],
        },
      },
    ],
  ],
};
