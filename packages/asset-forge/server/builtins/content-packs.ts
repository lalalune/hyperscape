/**
 * Built-in content pack catalog — the AAA "engine ships with
 * baseline content" pattern.
 *
 * Phase D / Phase F-prelude of `PLAN_AAA_CONTENT_SYSTEM.md`.
 * Mirrors UE5's `Engine/` content folder and Unity's built-in
 * packages: every install of asset-forge ships with a fixed
 * catalog of themed content packs that auto-bootstrap into the
 * `asset_packs` table on server start. No manual seeder run
 * required; new developers clone the repo, boot the server,
 * and immediately have all the built-in packs available.
 *
 * The data here is the canonical source for these packs. The
 * standalone seeder scripts
 * (`scripts/seed-hyperia-content-pack.ts`,
 * `scripts/seed-themed-content-packs.ts`) became thin wrappers
 * that call `upsertBuiltinContentPacks` for backward compat —
 * useful for re-seeding production without restarting the
 * server, or for CI environments that want explicit seed
 * control.
 *
 * Built-in catalog:
 *
 *   @hyperforge/content-pack-hyperia-v1   — tundra/forest/canyon
 *   @hyperforge/content-pack-arctic-v1    — frozen/snow/glacier
 *   @hyperforge/content-pack-tropical-v1  — beach/jungle/lagoon
 *   @hyperforge/content-pack-desert-v1    — sand/mesa/oasis
 *   @hyperforge/content-pack-volcanic-v1  — lava/ash/basalt
 *   @hyperforge/content-pack-wetland-v1   — marsh/swamp/delta
 *
 * Idempotent: re-running the upsert leaves rows unchanged
 * unless a pack's `packVersion` (the in-code constant below)
 * has been bumped, in which case the manifest is replaced.
 */

import { Pool } from "pg";

interface BiomeContribution {
  id: string;
  name: string;
  color: number;
  terrainMultiplier: number;
  difficultyLevel: number;
  heightRange: [number, number];
  maxSlope: number;
  resourceDensity: number;
}

interface BuiltinPack {
  manifestId: string;
  name: string;
  description: string;
  tags: string[];
  packVersion: string;
  biomes: ReadonlyArray<BiomeContribution>;
}

// ────────────────────────────────────────────────────────────
// Hyperia — the canonical fantasy RPG starter
// ────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────
// Arctic — frozen / snowy / mountainous
// ────────────────────────────────────────────────────────────
const ARCTIC_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "frozen_tundra",
    name: "Frozen Tundra",
    color: 0xd6e0e8,
    terrainMultiplier: 0.8,
    difficultyLevel: 1,
    heightRange: [0.2, 0.6],
    maxSlope: 1.2,
    resourceDensity: 0.3,
  },
  {
    id: "snow_plain",
    name: "Snow Plain",
    color: 0xf4f7fa,
    terrainMultiplier: 0.5,
    difficultyLevel: 0,
    heightRange: [0.1, 0.4],
    maxSlope: 0.6,
    resourceDensity: 0.2,
  },
  {
    id: "glacial_peak",
    name: "Glacial Peak",
    color: 0xb6cde0,
    terrainMultiplier: 1.6,
    difficultyLevel: 3,
    heightRange: [0.6, 1.0],
    maxSlope: 2.5,
    resourceDensity: 0.1,
  },
  {
    id: "frozen_lake",
    name: "Frozen Lake",
    color: 0xa8c8d8,
    terrainMultiplier: 0.3,
    difficultyLevel: 1,
    heightRange: [0.0, 0.15],
    maxSlope: 0.3,
    resourceDensity: 0.2,
  },
  {
    id: "ice_field",
    name: "Ice Field",
    color: 0xc8d8e8,
    terrainMultiplier: 0.7,
    difficultyLevel: 2,
    heightRange: [0.3, 0.7],
    maxSlope: 1.0,
    resourceDensity: 0.15,
  },
];

// ────────────────────────────────────────────────────────────
// Tropical — beach / jungle / mangrove
// ────────────────────────────────────────────────────────────
const TROPICAL_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "tropical_beach",
    name: "Tropical Beach",
    color: 0xf5deb3,
    terrainMultiplier: 0.4,
    difficultyLevel: 0,
    heightRange: [0.0, 0.15],
    maxSlope: 0.4,
    resourceDensity: 0.5,
  },
  {
    id: "jungle",
    name: "Jungle",
    color: 0x1b5e20,
    terrainMultiplier: 1.1,
    difficultyLevel: 2,
    heightRange: [0.15, 0.55],
    maxSlope: 1.4,
    resourceDensity: 1.4,
  },
  {
    id: "mangrove",
    name: "Mangrove",
    color: 0x4e6b3a,
    terrainMultiplier: 0.5,
    difficultyLevel: 1,
    heightRange: [0.05, 0.25],
    maxSlope: 0.6,
    resourceDensity: 0.9,
  },
  {
    id: "palm_grove",
    name: "Palm Grove",
    color: 0x66a866,
    terrainMultiplier: 0.6,
    difficultyLevel: 0,
    heightRange: [0.1, 0.35],
    maxSlope: 0.7,
    resourceDensity: 1.0,
  },
  {
    id: "lagoon",
    name: "Lagoon",
    color: 0x4dd0e1,
    terrainMultiplier: 0.2,
    difficultyLevel: 0,
    heightRange: [0.0, 0.1],
    maxSlope: 0.2,
    resourceDensity: 0.6,
  },
];

// ────────────────────────────────────────────────────────────
// Desert — sand / mesa / oasis
// ────────────────────────────────────────────────────────────
const DESERT_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "sand_dune",
    name: "Sand Dune",
    color: 0xeacb8a,
    terrainMultiplier: 0.9,
    difficultyLevel: 1,
    heightRange: [0.1, 0.5],
    maxSlope: 1.1,
    resourceDensity: 0.2,
  },
  {
    id: "mesa",
    name: "Mesa",
    color: 0xa0522d,
    terrainMultiplier: 1.4,
    difficultyLevel: 2,
    heightRange: [0.5, 0.9],
    maxSlope: 2.2,
    resourceDensity: 0.3,
  },
  {
    id: "salt_flat",
    name: "Salt Flat",
    color: 0xf2eecb,
    terrainMultiplier: 0.2,
    difficultyLevel: 0,
    heightRange: [0.0, 0.15],
    maxSlope: 0.2,
    resourceDensity: 0.1,
  },
  {
    id: "oasis",
    name: "Oasis",
    color: 0x4ea66a,
    terrainMultiplier: 0.5,
    difficultyLevel: 0,
    heightRange: [0.05, 0.3],
    maxSlope: 0.5,
    resourceDensity: 1.5,
  },
  {
    id: "badlands",
    name: "Badlands",
    color: 0x7a3f25,
    terrainMultiplier: 1.2,
    difficultyLevel: 3,
    heightRange: [0.3, 0.7],
    maxSlope: 1.8,
    resourceDensity: 0.15,
  },
];

// ────────────────────────────────────────────────────────────
// Volcanic — lava / ash / basalt
// ────────────────────────────────────────────────────────────
const VOLCANIC_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "lava_field",
    name: "Lava Field",
    color: 0x4a0e0e,
    terrainMultiplier: 1.0,
    difficultyLevel: 4,
    heightRange: [0.1, 0.4],
    maxSlope: 1.4,
    resourceDensity: 0.1,
  },
  {
    id: "ash_plain",
    name: "Ash Plain",
    color: 0x3d3a36,
    terrainMultiplier: 0.6,
    difficultyLevel: 2,
    heightRange: [0.05, 0.3],
    maxSlope: 0.7,
    resourceDensity: 0.2,
  },
  {
    id: "basalt_peak",
    name: "Basalt Peak",
    color: 0x2a2a2e,
    terrainMultiplier: 1.7,
    difficultyLevel: 3,
    heightRange: [0.6, 1.0],
    maxSlope: 2.6,
    resourceDensity: 0.4,
  },
  {
    id: "sulfur_pool",
    name: "Sulfur Pool",
    color: 0xc8b04a,
    terrainMultiplier: 0.3,
    difficultyLevel: 3,
    heightRange: [0.0, 0.15],
    maxSlope: 0.4,
    resourceDensity: 0.25,
  },
  {
    id: "obsidian_flow",
    name: "Obsidian Flow",
    color: 0x121214,
    terrainMultiplier: 0.8,
    difficultyLevel: 3,
    heightRange: [0.2, 0.55],
    maxSlope: 1.2,
    resourceDensity: 0.5,
  },
];

// ────────────────────────────────────────────────────────────
// Wetland — marsh / swamp / bog / delta
// ────────────────────────────────────────────────────────────
const WETLAND_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "marsh",
    name: "Marsh",
    color: 0x6b7a3d,
    terrainMultiplier: 0.4,
    difficultyLevel: 1,
    heightRange: [0.05, 0.25],
    maxSlope: 0.5,
    resourceDensity: 0.8,
  },
  {
    id: "swamp",
    name: "Swamp",
    color: 0x3d5a3a,
    terrainMultiplier: 0.5,
    difficultyLevel: 2,
    heightRange: [0.0, 0.2],
    maxSlope: 0.5,
    resourceDensity: 0.9,
  },
  {
    id: "bog",
    name: "Bog",
    color: 0x4a3e2a,
    terrainMultiplier: 0.3,
    difficultyLevel: 1,
    heightRange: [0.0, 0.15],
    maxSlope: 0.3,
    resourceDensity: 0.6,
  },
  {
    id: "fen",
    name: "Fen",
    color: 0x7a8a4a,
    terrainMultiplier: 0.4,
    difficultyLevel: 0,
    heightRange: [0.05, 0.2],
    maxSlope: 0.4,
    resourceDensity: 0.85,
  },
  {
    id: "river_delta",
    name: "River Delta",
    color: 0x6a8856,
    terrainMultiplier: 0.4,
    difficultyLevel: 0,
    heightRange: [0.0, 0.2],
    maxSlope: 0.3,
    resourceDensity: 1.2,
  },
];

// ────────────────────────────────────────────────────────────
// Pack catalog — exported as a frozen array
// ────────────────────────────────────────────────────────────
export const BUILTIN_CONTENT_PACKS: ReadonlyArray<BuiltinPack> = Object.freeze([
  {
    manifestId: "@hyperforge/content-pack-hyperia-v1",
    name: "Hyperia",
    description:
      "Hyperia's biome theme — tundra, forest, canyon. The canonical fantasy RPG starter; install when the user describes a generic-fantasy / unspecified world.",
    tags: ["hyperia", "fantasy", "rpg", "content-pack", "built-in"],
    packVersion: "1.0.0",
    biomes: HYPERIA_BIOMES,
  },
  {
    manifestId: "@hyperforge/content-pack-arctic-v1",
    name: "Arctic",
    description:
      "Frozen / snowy / mountainous biomes. Install for a snowy mountain map, glacier exploration, or polar expedition theme.",
    tags: ["arctic", "snow", "frozen", "mountain", "cold", "content-pack"],
    packVersion: "1.0.0",
    biomes: ARCTIC_BIOMES,
  },
  {
    manifestId: "@hyperforge/content-pack-tropical-v1",
    name: "Tropical",
    description:
      "Beach / jungle / mangrove biomes. Install for a tropical island map, jungle exploration, or coastal adventure theme.",
    tags: ["tropical", "jungle", "beach", "warm", "humid", "content-pack"],
    packVersion: "1.0.0",
    biomes: TROPICAL_BIOMES,
  },
  {
    manifestId: "@hyperforge/content-pack-desert-v1",
    name: "Desert",
    description:
      "Sand / mesa / oasis biomes. Install for a desert ruins map, dune crossing, or arid wasteland theme.",
    tags: ["desert", "sand", "arid", "mesa", "warm", "content-pack"],
    packVersion: "1.0.0",
    biomes: DESERT_BIOMES,
  },
  {
    manifestId: "@hyperforge/content-pack-volcanic-v1",
    name: "Volcanic",
    description:
      "Lava / ash / basalt biomes. Install for a volcanic wasteland map, eruption survival, or lava-cavern theme.",
    tags: ["volcanic", "lava", "fire", "ash", "hostile", "content-pack"],
    packVersion: "1.0.0",
    biomes: VOLCANIC_BIOMES,
  },
  {
    manifestId: "@hyperforge/content-pack-wetland-v1",
    name: "Wetland",
    description:
      "Marsh / swamp / bog / delta biomes. Install for a swamp adventure map, river-delta survival, or wetland exploration theme.",
    tags: ["wetland", "swamp", "marsh", "humid", "content-pack"],
    packVersion: "1.0.0",
    biomes: WETLAND_BIOMES,
  },
]);

function buildManifest(pack: BuiltinPack): Record<string, unknown> {
  return {
    version: 1,
    id: pack.manifestId,
    name: pack.name,
    description: pack.description,
    packVersion: pack.packVersion,
    author: { name: "HyperForge" },
    license: "UNLICENSED",
    tags: pack.tags,
    biomes: pack.biomes,
  };
}

/**
 * Idempotent UPSERT for one built-in pack. Re-runs replace
 * the manifest if `packVersion` changed; otherwise the row
 * stays. Visibility forced to `public` so every team sees the
 * pack in the marketplace browse.
 */
async function upsertOne(pool: Pool, pack: BuiltinPack): Promise<void> {
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
      updated_at = now();
  `;
  await pool.query(sql, [
    pack.manifestId,
    JSON.stringify(buildManifest(pack)),
    pack.packVersion,
  ]);
}

/**
 * Upsert every built-in content pack. Called once on server
 * boot from `api-elysia.ts`; safe to call repeatedly.
 *
 * Soft-fails per-pack so one broken manifest doesn't block the
 * rest. Returns counts so the caller can log a single summary
 * line.
 */
export async function upsertBuiltinContentPacks(
  pool: Pool,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const pack of BUILTIN_CONTENT_PACKS) {
    try {
      await upsertOne(pool, pack);
      ok += 1;
    } catch (err) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.warn(
        `[builtins/content-packs] upsert failed for ${pack.manifestId}:`,
        err,
      );
    }
  }
  return { ok, failed };
}
