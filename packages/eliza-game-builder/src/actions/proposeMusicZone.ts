/**
 * `PROPOSE_MUSIC_ZONE` — paint a music zone over a polygonal area.
 *
 * R4.P8 of `PLAN_HYPERIA_DECOUPLING.md`. Studio's
 * `audioLayers.musicZones` slot already exists; this action
 * lets the agent populate it. Like roads + water bodies,
 * music zones have NO Layer-B plugin-type validation — just
 * Zod-validate the schema.
 *
 *   id            — unique zone id
 *   name          — display name ("Town Theme", "Wilderness Tension")
 *   trackId       — track id from the active music manifest
 *   combatTrackId — optional override during combat inside the zone
 *   polygon       — closed (x, z) polygon (>= 3 points)
 *   priority      — higher wins on zone overlap
 *   blendDistance — cross-fade distance at edges (meters)
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
import { WorldAreaMusicZoneSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { readObjectField } from "./shared.js";

export const proposeMusicZoneAction: Action = {
  name: "PROPOSE_MUSIC_ZONE",
  similes: ["ADD_MUSIC_ZONE", "PAINT_MUSIC_ZONE", "CREATE_MUSIC_ZONE"],
  description:
    "Propose a music zone — a polygonal area on the map that plays a music track while the player is inside. Pass `musicZone` — a JSON object matching `WorldAreaMusicZoneSchema`. Required: id (string), name (string), trackId (string — id from the music manifest), polygon (>=3 (x,z) points). Optional: combatTrackId (override during combat), priority (higher wins overlap), blendDistance (edge cross-fade meters). " +
    "Use distinct music zones to score each region (town, wilderness, dungeon). Combat overrides keep tension high without losing the regional theme. Higher priority for nested zones (boss arena inside the dungeon).",

  parameters: [
    {
      name: "musicZone",
      description:
        "WorldAreaMusicZone JSON. Required: id, name, trackId, polygon (>=3 closed (x,z) loop). Optional: combatTrackId, priority, blendDistance.",
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

    const raw = readObjectField(options, "musicZone");
    if (!raw) {
      const error = new Error(
        "PROPOSE_MUSIC_ZONE requires a `musicZone` parameter — a WorldAreaMusicZone JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaMusicZoneSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Music zone invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const musicZone = result.data;
    const summary = [
      `Music zone accepted: ${musicZone.id} (${musicZone.name})`,
      `  trackId:       ${musicZone.trackId}`,
      `  polygon points: ${musicZone.polygon.length}`,
      `  priority:      ${musicZone.priority}`,
    ];
    if (musicZone.combatTrackId) {
      summary.push(`  combatTrackId: ${musicZone.combatTrackId}`);
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_MUSIC_ZONE" });

    return {
      success: true,
      text,
      values: { id: musicZone.id, trackId: musicZone.trackId },
      data: { musicZone } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Set up town music for the central village." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Music zone accepted: village-theme (Village Theme)\n  trackId: town_lute\n  polygon points: 6\n  priority: 0",
          actions: ["PROPOSE_MUSIC_ZONE"],
        },
      },
    ],
  ],
};
