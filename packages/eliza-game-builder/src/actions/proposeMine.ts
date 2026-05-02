/**
 * `PROPOSE_MINE` — place a dedicated mining area with clustered
 * ore rocks.
 *
 * R4.P8 of `PLAN_HYPERIA_DECOUPLING.md`. Studio's autoGen
 * pipeline already produces `PlacedMine` entries; this action
 * lets the agent author specific mines.
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
import { WorldAreaMineSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { validateAssetRef } from "./placementValidators.js";
import { readObjectField } from "./shared.js";

export const proposeMineAction: Action = {
  name: "PROPOSE_MINE",
  similes: ["ADD_MINE", "PLACE_MINE", "CREATE_MINE_AREA"],
  description:
    "Propose a dedicated mining area with clustered ore rocks. Pass `mine` — a JSON object matching `WorldAreaMineSchema`. Required: id, name, position {x,y,z}, radius (meters; 15-25 typical), biome (biome id), oreRocks (array of { resourceId, count }). Optional: radialOffsets (8 floats 0.82-1.18 for organic shape), entryAngle (radians), tierIndex (0=starter), assetRef. " +
    "Use mines for concentrated gathering experiences distinct from scattered resource placements. tierIndex scales spawn difficulty; pair with PROPOSE_DANGER_SOURCE for elite mines.",

  parameters: [
    {
      name: "mine",
      description:
        "WorldAreaMine JSON. Required: id, name, position, radius>0, biome, oreRocks (>=1 entry of {resourceId, count}). Optional: radialOffsets, entryAngle, tierIndex, assetRef.",
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

    const raw = readObjectField(options, "mine");
    if (!raw) {
      const error = new Error(
        "PROPOSE_MINE requires a `mine` parameter — a WorldAreaMine JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaMineSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Mine invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const mine = result.data;
    const refCheck = validateAssetRef(
      runtime,
      (mine as { assetRef?: string }).assetRef,
    );
    if (!refCheck.ok) {
      await callback?.({ text: refCheck.message, error: true });
      return {
        success: false,
        text: refCheck.message,
        data: refCheck.detail as unknown as ProviderDataRecord,
      };
    }

    const totalRocks = mine.oreRocks.reduce((s, r) => s + r.count, 0);
    const summary = [
      `Mine accepted: ${mine.id} (${mine.name})`,
      `  position:  (${mine.position.x}, ${mine.position.y}, ${mine.position.z})`,
      `  radius:    ${mine.radius}m`,
      `  biome:     ${mine.biome}`,
      `  tier:      ${mine.tierIndex}`,
      `  ores:      ${mine.oreRocks.length} type(s), ${totalRocks} rock(s) total`,
    ];
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_MINE" });

    return {
      success: true,
      text,
      values: { id: mine.id, oreCount: mine.oreRocks.length },
      data: { mine } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Place an iron mine in the canyon biome." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Mine accepted: canyon-iron-mine (Iron Outcrop)\n  position: (240, 0, -120)\n  radius: 20m\n  biome: canyon\n  tier: 1\n  ores: 2 type(s), 18 rock(s) total",
          actions: ["PROPOSE_MINE"],
        },
      },
    ],
  ],
};
