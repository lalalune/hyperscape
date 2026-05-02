/**
 * `PROPOSE_WILDERNESS_BOUNDARY` — set the PvP boundary line.
 *
 * R4.P8 of `PLAN_HYPERIA_DECOUPLING.md`. Studio's
 * `world.layers.wildernessBoundary` slot already exists.
 * Today only one boundary per project is supported; the schema
 * carries an `id` so future multi-boundary support stays
 * additive without breaking existing payloads.
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
import { WorldAreaWildernessBoundarySchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { readObjectField } from "./shared.js";

export const proposeWildernessBoundaryAction: Action = {
  name: "PROPOSE_WILDERNESS_BOUNDARY",
  similes: [
    "ADD_WILDERNESS",
    "SET_PVP_BOUNDARY",
    "DRAW_PVP_LINE",
    "PROPOSE_PVP_LINE",
  ],
  description:
    "Set the PvP wilderness boundary — a polyline north of which player-vs-player combat unlocks. Pass `wildernessBoundary` — a JSON object matching `WorldAreaWildernessBoundarySchema`. Required: points (>=2 (x,z) waypoints — the boundary line), levelScale (meters north per +1 wilderness level), maxLevel (clamp on the level scale). Optional: id (defaults to 'wilderness'). " +
    "Use this to gate the world's risk gradient: south of the line is safe; north escalates per `levelScale` meters into wilderness levels (1 → maxLevel). Pair with PROPOSE_DANGER_SOURCE for elite hotspots.",

  parameters: [
    {
      name: "wildernessBoundary",
      description:
        "WorldAreaWildernessBoundary JSON. Required: points (>=2 (x,z)), levelScale > 0, maxLevel > 0. Optional: id.",
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

    const raw = readObjectField(options, "wildernessBoundary");
    if (!raw) {
      const error = new Error(
        "PROPOSE_WILDERNESS_BOUNDARY requires a `wildernessBoundary` parameter — a WorldAreaWildernessBoundary JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaWildernessBoundarySchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Wilderness boundary invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const boundary = result.data;
    const summary = [
      `Wilderness boundary accepted: ${boundary.id}`,
      `  points:     ${boundary.points.length}`,
      `  levelScale: ${boundary.levelScale}m / level`,
      `  maxLevel:   ${boundary.maxLevel}`,
    ];
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_WILDERNESS_BOUNDARY" });

    return {
      success: true,
      text,
      values: { id: boundary.id, maxLevel: boundary.maxLevel },
      data: { wildernessBoundary: boundary } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Add a PvP boundary cutting east-west at z=0." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Wilderness boundary accepted: wilderness\n  points:     2\n  levelScale: 50m / level\n  maxLevel:   55",
          actions: ["PROPOSE_WILDERNESS_BOUNDARY"],
        },
      },
    ],
  ],
};
