/**
 * Hyperia Content Pack Seeder — `@hyperforge/content-pack-hyperia-v1`.
 *
 * Phase D of `PLAN_AAA_CONTENT_SYSTEM.md`. Produces a single
 * unified content pack carrying Hyperia's biomes (and, in
 * future cuts, the terrain shader recipe + 18 procgen tree
 * recipes + per-biome density rules + the existing 10 asset
 * splits — added section-by-section as their authoring data
 * is extracted from the engine package).
 *
 * Re-runnable; idempotent UPSERT keyed by `manifest_id`. Writes
 * to the `asset_packs` table (still named that until a future
 * cosmetic-rename cut; Phase A made it the canonical content
 * pack table).
 *
 * Why this seeder matters:
 *
 * Phase C1 made the engine's `GAME_BIOME_DEFINITIONS` empty —
 * blank projects render as gray islands with zero biomes
 * (correct AAA "blank means blank"). Hyperia projects keep
 * their biomes via the Hyperscape gameplay plugin's
 * plugin.json `contributions.biomes` (commit `63e8e2992`).
 * This seeder gives non-Hyperia projects a way to import
 * Hyperia's biome zoning palette WITHOUT installing the
 * gameplay plugin — install the content pack, get
 * tundra/forest/canyon as a visual theme.
 *
 * Source: `HYPERIA_LIVE_GAME_BIOMES` in
 * `src/components/WorldBuilder/GameTerrainAdapter.ts`. The
 * two MUST stay in sync until Phase D's eventual follow-up
 * (move the data INTO this seeder as the canonical source +
 * drop the engine's private constant).
 *
 * Usage:
 *   bun run packages/asset-forge/server/scripts/seed-hyperia-content-pack.ts
 */

import { Pool } from "pg";

interface BiomeContribution {
  id: string;
  name: string;
  /** Surface color as a 24-bit hex int. */
  color: number;
  terrainMultiplier: number;
  difficultyLevel: number;
  heightRange: [number, number];
  maxSlope: number;
  resourceDensity: number;
}

const PACK_MANIFEST_ID = "@hyperforge/content-pack-hyperia-v1";
const PACK_VERSION = "1.0.0";

// Snapshot of `HYPERIA_LIVE_GAME_BIOMES` from
// `packages/asset-forge/src/components/WorldBuilder/GameTerrainAdapter.ts`.
const HYPERIA_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "tundra",
    name: "Tundra",
    color: 0xe8e4e0,
    terrainMultiplier: 1,
    difficultyLevel: 1,
    heightRange: [0.3, 0.8],
    maxSlope: 1.5,
    resourceDensity: 0.4,
  },
  {
    id: "forest",
    name: "Forest",
    color: 0x388e3c,
    terrainMultiplier: 1,
    difficultyLevel: 0,
    heightRange: [0, 0.5],
    maxSlope: 0.8,
    resourceDensity: 1.0,
  },
  {
    id: "canyon",
    name: "Canyon",
    color: 0x8d6e63,
    terrainMultiplier: 1,
    difficultyLevel: 2,
    heightRange: [0.2, 1.0],
    maxSlope: 2.0,
    resourceDensity: 0.6,
  },
];

function buildManifest(): Record<string, unknown> {
  return {
    version: 1,
    id: PACK_MANIFEST_ID,
    name: "Hyperia",
    description:
      "Hyperia's biome theme — tundra, forest, canyon. Install on a non-Hyperia project to inherit Hyperia's zoning palette without installing the gameplay plugin. Future cuts of this pack will add Hyperia's terrain shader recipe, the 18 procgen tree recipes, per-biome density rules, and the asset splits. The Hyperscape gameplay plugin remains separate — install both via the project pack `@hyperforge/project-pack-hyperia-v1` to fork Hyperia in full.",
    packVersion: PACK_VERSION,
    author: { name: "HyperForge" },
    license: "UNLICENSED",
    tags: ["hyperia", "content-pack", "built-in"],

    // ContentPackManifest sections — only `biomes` populated this cut.
    // Other sections (assets, terrainShaders, waterShaders,
    // vegetationSpecies, vegetationDensityRules, …) get added as
    // their authoring data is extracted from the engine package.
    biomes: HYPERIA_BIOMES,
  };
}

async function upsertPack(
  pool: Pool,
  manifestId: string,
  manifest: Record<string, unknown>,
): Promise<void> {
  // Note: writes to `asset_packs` — that's the table that holds
  // unified content pack rows after the Phase A2 collapse. A
  // future cosmetic rename to `content_packs` is queued; doing
  // it now would cascade through every existing route, service
  // and migration without behavior change.
  const sql = `
    INSERT INTO asset_packs
      (team_id, manifest_id, manifest, source, version, visibility,
       published_at, created_at, updated_at)
    VALUES
      (NULL, $1, $2::jsonb, 'built-in', $3, 'public', now(), now(), now())
    ON CONFLICT (manifest_id) DO UPDATE SET
      manifest = EXCLUDED.manifest,
      version = EXCLUDED.version,
      visibility = 'public',
      published_at = COALESCE(asset_packs.published_at, EXCLUDED.published_at),
      updated_at = now()
    RETURNING id, manifest_id, source, version, visibility;
  `;
  const result = await pool.query(sql, [
    manifestId,
    JSON.stringify(manifest),
    PACK_VERSION,
  ]);
  const row = result.rows[0];
  console.log(
    `[seed-hyperia-content] upserted ${row.manifest_id} (id=${row.id}, source=${row.source}, version=${row.version})`,
  );
}

async function main(): Promise<void> {
  const url =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.FORGE_POSTGRES_USER || "forge"}:${process.env.FORGE_POSTGRES_PASSWORD || "forge_dev_password"}@localhost:${process.env.FORGE_POSTGRES_PORT || "5489"}/${process.env.FORGE_POSTGRES_DB || "forge"}`;
  const pool = new Pool({ connectionString: url });

  const manifest = buildManifest();
  await upsertPack(pool, PACK_MANIFEST_ID, manifest);
  console.log(
    `[seed-hyperia-content] done: 1 pack, ${HYPERIA_BIOMES.length} biome${
      HYPERIA_BIOMES.length === 1 ? "" : "s"
    }.`,
  );
  await pool.end();
}

void main().catch((err) => {
  console.error("[seed-hyperia-content] failed:", err);
  process.exit(1);
});
