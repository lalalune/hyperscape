/**
 * `PROPOSE_AMBIENT_ZONE` — paint an environmental ambient sound
 * loop over a polygonal area.
 *
 * R4.P8 of `PLAN_HYPERIA_DECOUPLING.md`. Studio's
 * `audioLayers.ambientZones` slot already exists.
 *
 *   id              — unique zone id
 *   name            — display name ("Coastal Wind", "Cave Drips")
 *   ambientType     — themed bucket (forest / cave / ocean / town / desert / mountain / swamp / custom)
 *   tracks          — sound asset paths to layer (1+)
 *   polygon         — closed (x, z) polygon (>= 3 points)
 *   volume          — mix gain (0..1)
 *   falloffDistance — edge falloff in meters
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
import { WorldAreaAmbientZoneSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { readObjectField } from "./shared.js";

export const proposeAmbientZoneAction: Action = {
  name: "PROPOSE_AMBIENT_ZONE",
  similes: ["ADD_AMBIENT_ZONE", "PAINT_AMBIENT_ZONE", "CREATE_AMBIENT_ZONE"],
  description:
    "Propose an ambient sound zone — a polygonal area that layers environmental sound (wind, surf, marketplace bustle) while the player is inside. Pass `ambientZone` — a JSON object matching `WorldAreaAmbientZoneSchema`. Required: id, name, ambientType ('forest' | 'cave' | 'ocean' | 'town' | 'desert' | 'mountain' | 'swamp' | 'custom'), tracks (>=1 sound asset paths), polygon (>=3 (x,z) points). Optional: volume (0..1), falloffDistance (edge fade meters). " +
    "Use ambient zones to give regions sonic identity layered ON TOP of music: a town has marketplace bustle; a forest has wind through leaves; a cave has dripping water. Multiple ambient layers in one zone (e.g. wind + birds) feel richer than a single track.",

  parameters: [
    {
      name: "ambientZone",
      description:
        "WorldAreaAmbientZone JSON. Required: id, name, ambientType, tracks (>=1), polygon (>=3 (x,z) loop). Optional: volume (0..1), falloffDistance.",
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

    const raw = readObjectField(options, "ambientZone");
    if (!raw) {
      const error = new Error(
        "PROPOSE_AMBIENT_ZONE requires an `ambientZone` parameter — a WorldAreaAmbientZone JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaAmbientZoneSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Ambient zone invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const ambientZone = result.data;
    const summary = [
      `Ambient zone accepted: ${ambientZone.id} (${ambientZone.name})`,
      `  ambientType:    ${ambientZone.ambientType}`,
      `  tracks:         ${ambientZone.tracks.length}`,
      `  polygon points: ${ambientZone.polygon.length}`,
      `  volume:         ${ambientZone.volume}`,
    ];
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_AMBIENT_ZONE" });

    return {
      success: true,
      text,
      values: { id: ambientZone.id, ambientType: ambientZone.ambientType },
      data: { ambientZone } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Add forest sounds to the woodland zone." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Ambient zone accepted: forest-ambient (Forest Ambient)\n  ambientType: forest\n  tracks: 2\n  polygon points: 8\n  volume: 0.5",
          actions: ["PROPOSE_AMBIENT_ZONE"],
        },
      },
    ],
  ],
};
