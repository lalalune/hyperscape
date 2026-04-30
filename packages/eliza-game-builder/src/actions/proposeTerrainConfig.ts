/**
 * `PROPOSE_TERRAIN_CONFIG` — agent reshapes the project's terrain.
 *
 * Phase B0'.H of `PLAN_PROJECT_AS_DATA.md`. Agent emits a
 * `WorldCreationConfig`-shaped object as the `config` parameter.
 * The handler validates against `ProjectConfigSchema` from
 * `@hyperforge/manifest-schema` and surfaces the validated config
 * on `data.config` for the host (asset-forge editor) to:
 *
 *   1. Rerun procgen against the new config
 *   2. Persist the new config into the project (via the
 *      `Project.config` typed column shipped in B0'.A)
 *   3. Update the viewport so the designer sees the reshape
 *
 * `ProjectConfigSchema` is permissive (accepts `{ seed: number,
 * preset?, useGamePipeline?, ...passthrough }`). The procgen layer
 * itself enforces the richer `WorldCreationConfig` shape at run
 * time — schema rejection here would be premature, since the
 * procgen pipeline gracefully fills defaults for missing knobs.
 *
 * Required:
 *   - `config.seed` — number
 *
 * Optional (passthrough):
 *   - `terrain` — { tileSize, worldSize, tileResolution, maxHeight,
 *                   waterThreshold }
 *   - `noise` — TerrainNoiseConfig
 *   - `biomes` — BiomeConfig
 *   - `island`, `shoreline`, `towns`, `roads`, `vegetation`
 *
 * Pure (no side effects). The host (e.g. AutomationPanel's agent
 * callback) calls procgen + the project's API after this action
 * returns.
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
import { ProjectConfigSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { readObjectField } from "./shared.js";

export const proposeTerrainConfigAction: Action = {
  name: "PROPOSE_TERRAIN_CONFIG",
  similes: [
    "RESHAPE_TERRAIN",
    "GENERATE_TERRAIN",
    "PROCGEN_CONFIG",
    "WORLD_CREATION_CONFIG",
  ],
  description:
    "Reshape the world's terrain by proposing a procgen WorldCreationConfig. Pass `config` — a JSON object with at minimum `{ seed: number }`. " +
    "VALID TOP-LEVEL KEYS (D1 hardening — anything else is rejected): `seed` (number, required), `preset` (string|null), `useGamePipeline` (boolean), `terrain`, `noise`, `biomes`, `island`, `shoreline`, `towns`, `roads`, `vegetation`. Sub-objects are passthrough so engine-only knobs round-trip. " +
    "Each sub-object's known fields: " +
    "  terrain: { tileSize, worldSize, tileResolution, maxHeight, waterThreshold } — all optional numbers. " +
    "  biomes: { gridSize, jitter (0-1), minInfluence, maxInfluence, gaussianCoeff, boundaryNoiseScale, boundaryNoiseAmount }. " +
    "  island: { enabled, maxWorldSizeTiles, falloffTiles, edgeNoiseScale, edgeNoiseStrength }. " +
    "  shoreline: { waterLevelNormalized (0-1), threshold (0-1), colorStrength (0-1), minSlope, slopeSampleDistance, landBand, landMaxMultiplier, underwaterBand, underwaterDepthMultiplier }. " +
    "  noise.{continent,ridge,hill,erosion,detail}: each { scale, weight, octaves?, persistence?, lacunarity? }. " +
    "All sub-fields are optional — procgen fills defaults for what you omit. On success the validated config is surfaced on `data.config` for the host to feed into procgen + persist into the project.",

  parameters: [
    {
      name: "config",
      description:
        "WorldCreationConfig JSON. Required: `seed` (number). Optional top-level keys: `preset`, `useGamePipeline`, `terrain`, `noise`, `biomes`, `island`, `shoreline`, `towns`, `roads`, `vegetation`. Hallucinated top-level keys (e.g. `terrainStyle`) are rejected with a Zod issue.",
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

    const configRaw = readObjectField(options, "config");
    if (!configRaw) {
      const error = new Error(
        "PROPOSE_TERRAIN_CONFIG requires a `config` parameter — a WorldCreationConfig JSON object with at minimum `{ seed: number }`.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = ProjectConfigSchema.safeParse(configRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Terrain config invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const config = result.data;

    // Build a human-readable summary surfacing the most impactful
    // knobs (terrain dimensions, biome distribution if present)
    // so the agent's chat surface tells the user what's about to
    // change before the host re-runs procgen.
    const summary: string[] = [
      `Terrain config accepted (seed: ${config.seed})`,
    ];
    if (config.preset) summary.push(`  preset:    ${config.preset}`);
    if (config.useGamePipeline !== undefined) {
      summary.push(
        `  pipeline:  ${config.useGamePipeline ? "game" : "procgen"}`,
      );
    }
    const passthrough = config as Record<string, unknown>;
    if (passthrough.terrain) {
      const t = passthrough.terrain as {
        tileSize?: number;
        worldSize?: number;
      };
      if (t.tileSize !== undefined && t.worldSize !== undefined) {
        summary.push(
          `  terrain:   ${t.worldSize}×${t.worldSize} tiles @ ${t.tileSize}m`,
        );
      }
    }
    if (passthrough.biomes) {
      summary.push(`  biomes:    declared`);
    }
    if (passthrough.vegetation) {
      summary.push(`  vegetation:declared`);
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_TERRAIN_CONFIG" });

    return {
      success: true,
      text,
      values: { seed: config.seed },
      data: { config } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "Make this a snowy mountain region." },
      },
      {
        name: "agent",
        content: {
          text: "Terrain config accepted (seed: 42)\n  terrain:   100×100 tiles @ 100m\n  biomes:    declared",
          action: "PROPOSE_TERRAIN_CONFIG",
        },
      },
    ],
  ],
};
