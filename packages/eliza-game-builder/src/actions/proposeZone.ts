/**
 * `PROPOSE_ZONE` — world-area authoring action.
 *
 * Phase A (continuation) of the AAA gap audit. NPCs and mob spawns
 * are placed at points; zones are bounded regions ("the wilderness
 * north of town", "the duel arena"). Without zone authoring, the
 * agent can place individual entities but can't carve up the world
 * into named, themed regions — biome, difficulty, PvP-enabled, etc.
 *
 * The handler validates against `WorldAreaSchema` from
 * `@hyperforge/manifest-schema` (the same schema the world-areas
 * manifest is parsed against). On success the validated zone
 * lands on `data.zone` for the host to merge into its
 * `agentWorldContent` store via `setAgentZone`.
 *
 * Required fields:
 *   id, name, description, difficultyLevel, bounds, biomeType,
 *   safeZone (boolean)
 *
 * Optional:
 *   pvpEnabled (boolean), npcs[], resources[], mobSpawns[],
 *   stations[], fishing, teleports[]
 *
 * Use this when the user describes a region rather than a point —
 * "make a wilderness zone north of the village" / "carve out a
 * lava biome with goblin-tier mobs".
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
import { WorldAreaSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { readObjectField } from "./shared.js";

export const proposeZoneAction: Action = {
  name: "PROPOSE_ZONE",
  similes: [
    "ADD_ZONE",
    "CREATE_ZONE",
    "DEFINE_AREA",
    "CARVE_REGION",
    "SUBMIT_ZONE",
  ],
  description:
    "Propose a bounded region (world-area). Pass `zone` — JSON matching `WorldAreaSchema`. Required: id, name, description, difficultyLevel (int >= 0), bounds, biomeType (string), safeZone (boolean). Optional: pvpEnabled, npcs[], resources[], mobSpawns[], stations[], fishing, teleports[]. Use when the user describes a REGION rather than a point — 'wilderness north of town', 'PvP duel arena', 'low-level forest'. For point placements use PROPOSE_NPC_PLACEMENT or PROPOSE_MOB_SPAWN instead.",

  parameters: [
    {
      name: "zone",
      description:
        "WorldArea JSON. Required: id, name, description, difficultyLevel, bounds (depends on schema — typically {min: {x,z}, max: {x,z}}), biomeType, safeZone. Optional: pvpEnabled, plus inline npcs[], mobSpawns[], resources[], stations[], fishing, teleports[]. Inline entries are convenient when defining a complete themed region in one shot — but PROPOSE_NPC_PLACEMENT / PROPOSE_MOB_SPAWN are preferred for ad-hoc placements outside a zone definition.",
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

    const zoneRaw = readObjectField(options, "zone");
    if (!zoneRaw) {
      const error = new Error(
        "PROPOSE_ZONE requires a `zone` parameter — a WorldArea JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaSchema.safeParse(zoneRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Zone invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const zone = result.data;
    const summary = [
      `Zone accepted: ${zone.id}`,
      `  name:       ${zone.name}`,
      `  biome:      ${zone.biomeType}`,
      `  difficulty: ${zone.difficultyLevel}`,
      `  safe:       ${zone.safeZone ? "yes" : "no"}`,
    ];
    if (zone.pvpEnabled) summary.push(`  pvp:        yes`);
    if (zone.npcs && zone.npcs.length > 0)
      summary.push(`  inline npcs: ${zone.npcs.length}`);
    if (zone.mobSpawns && zone.mobSpawns.length > 0)
      summary.push(`  inline mobs: ${zone.mobSpawns.length}`);
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_ZONE" });

    return {
      success: true,
      text,
      data: { zone } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Carve out a wilderness zone north of town with low-level goblins.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Zone accepted: north_wilderness\n  name: Northern Wilderness\n  biome: forest\n  difficulty: 1\n  safe: no",
          actions: ["PROPOSE_ZONE"],
        },
      },
    ],
  ],
};
