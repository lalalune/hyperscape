/**
 * `PROPOSE_SFX_TRIGGER` — place a point-source ambient sound.
 *
 * R4.P8 of `PLAN_HYPERIA_DECOUPLING.md`. Studio's
 * `audioLayers.sfxTriggers` slot already exists.
 *
 *   id          — unique trigger id
 *   name        — display name ("Creaking Sign", "Fountain Splashing")
 *   soundPath   — sound asset path
 *   position    — game-space (x, y, z)
 *   radius      — audible radius in meters
 *   volume      — playback volume (0..1)
 *   looping     — whether the sound loops while in range
 *   description — optional human-readable description (used by AI auto-pick)
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
import { WorldAreaSFXTriggerSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { readObjectField } from "./shared.js";

export const proposeSfxTriggerAction: Action = {
  name: "PROPOSE_SFX_TRIGGER",
  similes: [
    "ADD_SFX_TRIGGER",
    "ADD_SOUND_TRIGGER",
    "PLACE_SFX",
    "CREATE_SFX_TRIGGER",
  ],
  description:
    "Propose a point-source ambient sound — plays while the player is within `radius` meters of `position`. Pass `sfxTrigger` — a JSON object matching `WorldAreaSFXTriggerSchema`. Required: id, name, soundPath (sound asset path), position {x,y,z}, radius (positive meters). Optional: volume (0..1), looping (default true), description. " +
    "Use point SFX for atmospheric details that aren't zone-wide: a creaking sign at a tavern entrance, a fountain splash in a town square, a gust of wind near a cliff edge. Distinct from ambient zones (which paint sound across an area).",

  parameters: [
    {
      name: "sfxTrigger",
      description:
        "WorldAreaSFXTrigger JSON. Required: id, name, soundPath, position {x,y,z}, radius > 0. Optional: volume (0..1), looping (default true), description.",
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

    const raw = readObjectField(options, "sfxTrigger");
    if (!raw) {
      const error = new Error(
        "PROPOSE_SFX_TRIGGER requires a `sfxTrigger` parameter — a WorldAreaSFXTrigger JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaSFXTriggerSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `SFX trigger invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const sfxTrigger = result.data;
    const p = sfxTrigger.position;
    const summary = [
      `SFX trigger accepted: ${sfxTrigger.id} (${sfxTrigger.name})`,
      `  soundPath: ${sfxTrigger.soundPath}`,
      `  position:  (${p.x}, ${p.y}, ${p.z})`,
      `  radius:    ${sfxTrigger.radius}m`,
      `  volume:    ${sfxTrigger.volume}`,
      `  looping:   ${sfxTrigger.looping}`,
    ];
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_SFX_TRIGGER" });

    return {
      success: true,
      text,
      values: { id: sfxTrigger.id, soundPath: sfxTrigger.soundPath },
      data: { sfxTrigger } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Place a creaking sign at the tavern entrance." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "SFX trigger accepted: tavern-sign (Tavern Creak)\n  soundPath: sounds/wood-creak.ogg\n  position: (12, 0, -8)\n  radius: 6m\n  volume: 0.7\n  looping: true",
          actions: ["PROPOSE_SFX_TRIGGER"],
        },
      },
    ],
  ],
};
