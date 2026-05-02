/**
 * Hyperia Biome Pack Seeder — populates the marketplace with
 * the canonical Hyperia biome pack so other projects (or the
 * future Hyperia ProjectPack) can install it independently of
 * the gameplay plugin set.
 *
 * Re-runnable; idempotent UPSERT keyed by `manifest_id`.
 *
 * Output pack (visibility="public", source="built-in"):
 *
 *   @hyperforge/biome-pack-hyperia-v1
 *
 * Source: extracted from `GAME_BIOME_DEFINITIONS` (the
 * engine-default biomes that ship with asset-forge today —
 * tundra / forest / canyon). Once Phase 3 of
 * `PLAN_PACK_TYPES.md` finishes the consumer flip, the
 * `GAME_BIOME_DEFINITIONS` constant in
 * `GameTerrainAdapter.ts` is dropped — projects that want
 * Hyperia's biomes install this pack instead.
 *
 * Usage:
 *   bun run packages/asset-forge/server/scripts/seed-hyperia-biome-pack.ts
 *
 * Phase 3 of `PLAN_PACK_TYPES.md`.
 */

import { Pool } from "pg";

interface BiomeEntry {
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

const PACK_MANIFEST_ID = "@hyperforge/biome-pack-hyperia-v1";
const PACK_VERSION = "1.0.0";

// Snapshot of `GAME_BIOME_DEFINITIONS` from
// `packages/asset-forge/src/components/WorldBuilder/GameTerrainAdapter.ts`.
// The two MUST stay in sync until the engine constant is
// dropped — until then, this is the authoring source for
// projects that opt out of the engine default and install
// the pack explicitly.
const HYPERIA_BIOMES: ReadonlyArray<BiomeEntry> = [
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
    name: "Hyperia Biomes",
    description:
      "The three biomes that ship with Hyperia: tundra, forest, canyon. Install on a non-Hyperia project to inherit Hyperia's zoning palette without installing the gameplay plugin.",
    packVersion: PACK_VERSION,
    author: { name: "HyperForge" },
    license: "UNLICENSED",
    tags: ["hyperia", "biome", "built-in"],
    biomes: HYPERIA_BIOMES,
  };
}

async function upsertPack(
  pool: Pool,
  manifestId: string,
  manifest: Record<string, unknown>,
): Promise<void> {
  const sql = `
    INSERT INTO biome_packs
      (team_id, manifest_id, manifest, source, version, visibility,
       published_at, created_at, updated_at)
    VALUES
      (NULL, $1, $2::jsonb, 'built-in', $3, 'public', now(), now(), now())
    ON CONFLICT (manifest_id) DO UPDATE SET
      manifest = EXCLUDED.manifest,
      version = EXCLUDED.version,
      visibility = 'public',
      published_at = COALESCE(biome_packs.published_at, EXCLUDED.published_at),
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
    `[seed-hyperia-biome] upserted ${row.manifest_id} (id=${row.id}, source=${row.source}, version=${row.version})`,
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
    `[seed-hyperia-biome] done: 1 pack, ${HYPERIA_BIOMES.length} biome${
      HYPERIA_BIOMES.length === 1 ? "" : "s"
    }.`,
  );
  await pool.end();
}

void main().catch((err) => {
  console.error("[seed-hyperia-biome] failed:", err);
  process.exit(1);
});
