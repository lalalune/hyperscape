/**
 * `PROPOSE_ROAD` — placement action for roads / paths between
 * world locations.
 *
 * P2.a of `PLAN_AGENT_STUDIO_PARITY.md`. Roads are polylines
 * (sequences of waypoints) rather than single-point placements,
 * so the action takes a `road` parameter shaped like
 * `WorldAreaRoadSchema` — { id, name, path: Vec3[], width,
 * assetRef? }. The studio renders these as ribbons on the
 * terrain mesh; the runtime uses them for navmesh hints + mob
 * patrol paths + travel UX.
 *
 * Unlike NPCs / mob spawns / resources / stations, roads have
 * NO Layer B plugin-type validation — there's no concept of a
 * "road type" that plugins contribute (a road is a road; the
 * `assetRef` controls visual styling, not gameplay behavior).
 * Just Zod-validate the schema + check assetRef resolves.
 *
 * Required fields:
 *   id      — unique road id
 *   name    — display name ("Northern Trade Road")
 *   path    — array of {x, y, z} game-space waypoints; min 2
 *   width   — road width in meters; positive number
 *
 * Optional:
 *   assetRef — pack ref for road texture/material
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
import { WorldAreaRoadSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { validateAssetRef } from "./placementValidators.js";
import { readObjectField } from "./shared.js";

export const proposeRoadAction: Action = {
  name: "PROPOSE_ROAD",
  similes: [
    "PLACE_ROAD",
    "ADD_ROAD",
    "DRAW_PATH",
    "CREATE_ROAD",
    "SUBMIT_ROAD",
  ],
  description:
    "Propose a road / path connecting points in the world. Pass `road` — a JSON object matching `WorldAreaRoadSchema`. Required: id (string), name (string), path (array of {x,y,z} waypoints; minimum 2 points), width (positive number, meters). Optional: assetRef (a `<packId>/<entryId>` ref from GET_PROJECT_STATE.availableAssets — controls road styling). " +
    "Roads connect existing entities (towns, NPCs, points of interest) so players have a clear travel route. Use 4-8 waypoints for natural curving paths instead of straight lines. Width 4-8m for narrow trails, 10-15m for major roads.",

  parameters: [
    {
      name: "road",
      description:
        "WorldAreaRoad JSON. Required: id, name, path (Vec3[] >= 2), width > 0. Optional: assetRef. Example: { id: 'north-trade-road', name: 'Northern Trade Road', path: [{x:0,y:0,z:0}, {x:50,y:0,z:30}, {x:120,y:0,z:80}], width: 8 }.",
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

    const roadRaw = readObjectField(options, "road");
    if (!roadRaw) {
      const error = new Error(
        "PROPOSE_ROAD requires a `road` parameter — a WorldAreaRoad JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaRoadSchema.safeParse(roadRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Road invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const road = result.data;

    // No plugin-type validation for roads (no contribution model);
    // just verify assetRef when set.
    const refCheck = validateAssetRef(
      runtime,
      (road as { assetRef?: string }).assetRef,
    );
    if (!refCheck.ok) {
      await callback?.({ text: refCheck.message, error: true });
      return {
        success: false,
        text: refCheck.message,
        data: refCheck.detail as unknown as ProviderDataRecord,
      };
    }

    const start = road.path[0]!;
    const end = road.path[road.path.length - 1]!;
    const summary = [
      `Road accepted: ${road.id} (${road.name})`,
      `  width:    ${road.width}m`,
      `  waypoints: ${road.path.length}`,
      `  start:    (${start.x}, ${start.y}, ${start.z})`,
      `  end:      (${end.x}, ${end.y}, ${end.z})`,
    ];
    const finalRef = (road as { assetRef?: string }).assetRef;
    if (finalRef) {
      summary.push(`  assetRef: ${finalRef}`);
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_ROAD" });

    return {
      success: true,
      text,
      values: { id: road.id, waypoints: road.path.length },
      data: { road } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Connect the village to the wilderness with a road." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Road accepted: village-to-wilderness (Wilderness Path)\n  width:    6m\n  waypoints: 5\n  start: (0, 0, 0)\n  end: (120, 0, 80)",
          actions: ["PROPOSE_ROAD"],
        },
      },
    ],
  ],
};
