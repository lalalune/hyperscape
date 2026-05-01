/**
 * `PROPOSE_DANGER_SOURCE` — placement action for difficulty
 * gradient anchors.
 *
 * P5.b of `PLAN_AGENT_STUDIO_PARITY.md`. A danger source is a
 * point that increases local difficulty beyond the biome's
 * default scalar. Useful for "this region is more dangerous than
 * the biome alone implies" — a corrupted shrine deep in a Forest
 * biome bumps mob levels + spawn density nearby; a warlord's
 * camp turns surrounding territory into a contested zone.
 *
 * The studio's procgen difficulty pass reads danger sources to
 * shape mob levels + spawn density falloff. The studio's
 * DifficultyHeatmap visualization renders them as red gradient
 * blobs on the terrain.
 *
 * Required fields:
 *   id           — unique id
 *   name         — display name
 *   position     — game-space coords
 *   radius       — radius of influence in meters; positive
 *   intensity    — 0-3, added to biome difficulty at the center;
 *                  falls off with distance per falloffCurve
 *   falloffCurve — how quickly intensity falls off (1 = linear,
 *                  >1 = sharper edge, <1 = gentler spread)
 *
 * Optional:
 *   description  — tooltip / lore text
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
import { WorldAreaDangerSourceSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { readObjectField } from "./shared.js";

export const proposeDangerSourceAction: Action = {
  name: "PROPOSE_DANGER_SOURCE",
  similes: [
    "ADD_DANGER",
    "PLACE_DANGER_ZONE",
    "MARK_DANGEROUS",
    "ADD_DANGER_SOURCE",
    "SUBMIT_DANGER_SOURCE",
  ],
  description:
    "Propose a danger source — a point that elevates local difficulty beyond the biome's default. Pass `dangerSource` — a JSON object matching `WorldAreaDangerSourceSchema`. Required: id, name, position {x,y,z}, radius (positive, meters), intensity (0-3, added to biome scalar at center), falloffCurve (positive, sharper > 1 = harder edge). Optional: description. " +
    "Use for thematic difficulty bumps that aren't captured by biome alone — corrupted shrines, warlord camps, demonic incursions in otherwise peaceful regions. Intensity 1 = mild bump (~level +1 mob density), 2 = significant (PvP-zone tier), 3 = elite (boss territory). falloffCurve 1 for gradient, 2-3 for hard borders.",

  parameters: [
    {
      name: "dangerSource",
      description:
        "WorldAreaDangerSource JSON. Required: id, name, position, radius>0, intensity 0-3, falloffCurve>0. Example: { id: 'cursed-grove', name: 'Cursed Grove', position: {x:60,y:0,z:80}, radius: 40, intensity: 2, falloffCurve: 1.5, description: 'A blight has taken root.' }.",
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

    const raw = readObjectField(options, "dangerSource");
    if (!raw) {
      const error = new Error(
        "PROPOSE_DANGER_SOURCE requires a `dangerSource` parameter — a WorldAreaDangerSource JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaDangerSourceSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Danger source invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const ds = result.data;

    const summary = [
      `Danger source accepted: ${ds.id} (${ds.name})`,
      `  position:     (${ds.position.x}, ${ds.position.y}, ${ds.position.z})`,
      `  radius:       ${ds.radius}m`,
      `  intensity:    ${ds.intensity}`,
      `  falloffCurve: ${ds.falloffCurve}`,
    ];
    if (ds.description) {
      summary.push(`  description:  ${ds.description}`);
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_DANGER_SOURCE" });

    return {
      success: true,
      text,
      values: { id: ds.id, intensity: ds.intensity },
      data: { dangerSource: ds } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Make the eastern forest more dangerous near the ruined tower.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Danger source accepted: cursed-tower-blight (Cursed Tower Blight)\n  position: (180, 0, 60)\n  radius: 50m\n  intensity: 2\n  falloffCurve: 1.5",
          actions: ["PROPOSE_DANGER_SOURCE"],
        },
      },
    ],
  ],
};
