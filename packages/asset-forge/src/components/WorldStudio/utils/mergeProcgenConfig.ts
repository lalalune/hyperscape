/**
 * mergeProcgenConfig — deep-merge the agent's terrain overrides
 * into the blank-base WorldCreationConfig.
 *
 * The naive `{ ...base, ...agent }` shallow-spread silently
 * corrupts nested config sections: if the agent emits
 * `terrain: { worldSize: 100 }` (a single field), the spread
 * REPLACES base.terrain wholesale and loses tileSize / maxHeight
 * / tileResolution. Procgen then reads `undefined` and writes
 * NaN into the heightmap, which the renderer reports as
 * "BufferGeometry.computeBoundingSphere(): Computed radius is
 * NaN" every frame until the user reloads.
 *
 * This deep-merge recurses into the nested objects (terrain,
 * biomes, island, shoreline, noise, towns, roads, vegetation)
 * so partial agent overrides only override the fields they
 * specify. Top-level primitives (seed, preset, useGamePipeline)
 * shallow-merge as before. Arrays are replaced wholesale (no
 * array merge — preserves the "agent fully replaces this list"
 * semantics).
 *
 * Used by:
 *   - WorldStudioCompanion when agent emits PROPOSE_TERRAIN_CONFIG
 *     mid-edit (live regen).
 *   - DesignWithAIDialog when the user clicks Generate after the
 *     onboarding agent's plan accumulates a terrainConfig.
 *
 * @param base   The blank-base WorldCreationConfig (typed but
 *               cast to record so we can recurse generically).
 * @param agent  The agent's `data.config` payload — partial.
 * @param seed   Resolved seed (the agent's seed field if numeric,
 *               otherwise a fresh random one). Always overrides
 *               whatever was at base.seed or agent.seed.
 */
export function mergeProcgenConfig(
  base: Record<string, unknown>,
  agent: Record<string, unknown>,
  seed: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, agentValue] of Object.entries(agent)) {
    const baseValue = base[key];
    if (
      agentValue !== null &&
      typeof agentValue === "object" &&
      !Array.isArray(agentValue) &&
      baseValue !== null &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      // Recurse into nested objects (terrain, biomes, etc.)
      out[key] = mergeProcgenConfig(
        baseValue as Record<string, unknown>,
        agentValue as Record<string, unknown>,
        seed,
      );
    } else {
      // Primitive / array / null — agent's value wins.
      out[key] = agentValue;
    }
  }
  out.seed = seed;
  return out;
}
