/**
 * Themed Content Pack Seeder — produces five broad-theme content
 * packs in one run so projects can install whichever climate /
 * terrain theme matches their world description.
 *
 * Phase D follow-up of `PLAN_AAA_CONTENT_SYSTEM.md`. Mirrors the
 * UE5 / Unity Marketplace pattern: instead of every project
 * sharing the same baseline catalog, themed packs ship the
 * specific biomes / vegetation / shader recipes that match a
 * climate. AI agents (or human users browsing the marketplace)
 * pick the pack that matches the world they're building:
 *
 *   "snowy mountain map"   → @hyperforge/content-pack-arctic-v1
 *   "tropical island"      → @hyperforge/content-pack-tropical-v1
 *   "desert ruins"         → @hyperforge/content-pack-desert-v1
 *   "volcanic wasteland"   → @hyperforge/content-pack-volcanic-v1
 *   "swamp adventure"      → @hyperforge/content-pack-wetland-v1
 *
 * Composition is permitted — installing Arctic + Volcanic gives
 * a project both biome catalogs (frozen + lava) for "frozen
 * lava world" themes. The runtime `contentRegistry` merges the
 * biomes section of each installed pack via id-merge.
 *
 * Re-runnable; idempotent UPSERT keyed by `manifest_id`. Each
 * pack ships only `biomes` today; vegetation species + shader
 * recipes get added section-by-section as Phase C3/C4 land
 * their consumer migrations. The biome shape itself is enough
 * for the visible "different climates produce different worlds"
 * payoff today — `BiomeDefinition.color` drives terrain tint,
 * `heightRange` + `terrainMultiplier` drive height shaping,
 * `difficultyLevel` flows into mob-spawn rules, etc.
 *
 * Usage:
 *   bun run packages/asset-forge/server/scripts/seed-themed-content-packs.ts
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

interface PackSpec {
  manifestId: string;
  name: string;
  description: string;
  tags: string[];
  biomes: ReadonlyArray<BiomeContribution>;
}

const PACK_VERSION = "1.0.0";

// ────────────────────────────────────────────────────────────
// Arctic — frozen / snowy / mountainous
// ────────────────────────────────────────────────────────────
const ARCTIC_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "frozen_tundra",
    name: "Frozen Tundra",
    color: 0xd6e0e8, // pale blue-gray
    terrainMultiplier: 0.8,
    difficultyLevel: 1,
    heightRange: [0.2, 0.6],
    maxSlope: 1.2,
    resourceDensity: 0.3,
  },
  {
    id: "snow_plain",
    name: "Snow Plain",
    color: 0xf4f7fa, // near-white
    terrainMultiplier: 0.5,
    difficultyLevel: 0,
    heightRange: [0.1, 0.4],
    maxSlope: 0.6,
    resourceDensity: 0.2,
  },
  {
    id: "glacial_peak",
    name: "Glacial Peak",
    color: 0xb6cde0, // ice blue
    terrainMultiplier: 1.6,
    difficultyLevel: 3,
    heightRange: [0.6, 1.0],
    maxSlope: 2.5,
    resourceDensity: 0.1,
  },
  {
    id: "frozen_lake",
    name: "Frozen Lake",
    color: 0xa8c8d8, // pale aqua
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
    color: 0xf5deb3, // sandy wheat
    terrainMultiplier: 0.4,
    difficultyLevel: 0,
    heightRange: [0.0, 0.15],
    maxSlope: 0.4,
    resourceDensity: 0.5,
  },
  {
    id: "jungle",
    name: "Jungle",
    color: 0x1b5e20, // deep green
    terrainMultiplier: 1.1,
    difficultyLevel: 2,
    heightRange: [0.15, 0.55],
    maxSlope: 1.4,
    resourceDensity: 1.4,
  },
  {
    id: "mangrove",
    name: "Mangrove",
    color: 0x4e6b3a, // olive green
    terrainMultiplier: 0.5,
    difficultyLevel: 1,
    heightRange: [0.05, 0.25],
    maxSlope: 0.6,
    resourceDensity: 0.9,
  },
  {
    id: "palm_grove",
    name: "Palm Grove",
    color: 0x66a866, // mid green
    terrainMultiplier: 0.6,
    difficultyLevel: 0,
    heightRange: [0.1, 0.35],
    maxSlope: 0.7,
    resourceDensity: 1.0,
  },
  {
    id: "lagoon",
    name: "Lagoon",
    color: 0x4dd0e1, // turquoise
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
    color: 0xeacb8a, // pale gold
    terrainMultiplier: 0.9,
    difficultyLevel: 1,
    heightRange: [0.1, 0.5],
    maxSlope: 1.1,
    resourceDensity: 0.2,
  },
  {
    id: "mesa",
    name: "Mesa",
    color: 0xa0522d, // sienna
    terrainMultiplier: 1.4,
    difficultyLevel: 2,
    heightRange: [0.5, 0.9],
    maxSlope: 2.2,
    resourceDensity: 0.3,
  },
  {
    id: "salt_flat",
    name: "Salt Flat",
    color: 0xf2eecb, // pale ivory
    terrainMultiplier: 0.2,
    difficultyLevel: 0,
    heightRange: [0.0, 0.15],
    maxSlope: 0.2,
    resourceDensity: 0.1,
  },
  {
    id: "oasis",
    name: "Oasis",
    color: 0x4ea66a, // emerald
    terrainMultiplier: 0.5,
    difficultyLevel: 0,
    heightRange: [0.05, 0.3],
    maxSlope: 0.5,
    resourceDensity: 1.5,
  },
  {
    id: "badlands",
    name: "Badlands",
    color: 0x7a3f25, // rust brown
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
    color: 0x4a0e0e, // dark red
    terrainMultiplier: 1.0,
    difficultyLevel: 4,
    heightRange: [0.1, 0.4],
    maxSlope: 1.4,
    resourceDensity: 0.1,
  },
  {
    id: "ash_plain",
    name: "Ash Plain",
    color: 0x3d3a36, // dark warm gray
    terrainMultiplier: 0.6,
    difficultyLevel: 2,
    heightRange: [0.05, 0.3],
    maxSlope: 0.7,
    resourceDensity: 0.2,
  },
  {
    id: "basalt_peak",
    name: "Basalt Peak",
    color: 0x2a2a2e, // near-black slate
    terrainMultiplier: 1.7,
    difficultyLevel: 3,
    heightRange: [0.6, 1.0],
    maxSlope: 2.6,
    resourceDensity: 0.4,
  },
  {
    id: "sulfur_pool",
    name: "Sulfur Pool",
    color: 0xc8b04a, // sulfur yellow
    terrainMultiplier: 0.3,
    difficultyLevel: 3,
    heightRange: [0.0, 0.15],
    maxSlope: 0.4,
    resourceDensity: 0.25,
  },
  {
    id: "obsidian_flow",
    name: "Obsidian Flow",
    color: 0x121214, // black
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
    color: 0x6b7a3d, // olive
    terrainMultiplier: 0.4,
    difficultyLevel: 1,
    heightRange: [0.05, 0.25],
    maxSlope: 0.5,
    resourceDensity: 0.8,
  },
  {
    id: "swamp",
    name: "Swamp",
    color: 0x3d5a3a, // dark moss green
    terrainMultiplier: 0.5,
    difficultyLevel: 2,
    heightRange: [0.0, 0.2],
    maxSlope: 0.5,
    resourceDensity: 0.9,
  },
  {
    id: "bog",
    name: "Bog",
    color: 0x4a3e2a, // mud brown
    terrainMultiplier: 0.3,
    difficultyLevel: 1,
    heightRange: [0.0, 0.15],
    maxSlope: 0.3,
    resourceDensity: 0.6,
  },
  {
    id: "fen",
    name: "Fen",
    color: 0x7a8a4a, // pale olive
    terrainMultiplier: 0.4,
    difficultyLevel: 0,
    heightRange: [0.05, 0.2],
    maxSlope: 0.4,
    resourceDensity: 0.85,
  },
  {
    id: "river_delta",
    name: "River Delta",
    color: 0x6a8856, // muddy green
    terrainMultiplier: 0.4,
    difficultyLevel: 0,
    heightRange: [0.0, 0.2],
    maxSlope: 0.3,
    resourceDensity: 1.2,
  },
];

// ────────────────────────────────────────────────────────────
// Pack catalog
// ────────────────────────────────────────────────────────────
const PACKS: ReadonlyArray<PackSpec> = [
  {
    manifestId: "@hyperforge/content-pack-arctic-v1",
    name: "Arctic",
    description:
      "Frozen / snowy / mountainous biomes. Install for a snowy mountain map, glacier exploration, or polar expedition theme.",
    tags: ["arctic", "snow", "frozen", "mountain", "cold", "content-pack"],
    biomes: ARCTIC_BIOMES,
  },
  {
    manifestId: "@hyperforge/content-pack-tropical-v1",
    name: "Tropical",
    description:
      "Beach / jungle / mangrove biomes. Install for a tropical island map, jungle exploration, or coastal adventure theme.",
    tags: ["tropical", "jungle", "beach", "warm", "humid", "content-pack"],
    biomes: TROPICAL_BIOMES,
  },
  {
    manifestId: "@hyperforge/content-pack-desert-v1",
    name: "Desert",
    description:
      "Sand / mesa / oasis biomes. Install for a desert ruins map, dune crossing, or arid wasteland theme.",
    tags: ["desert", "sand", "arid", "mesa", "warm", "content-pack"],
    biomes: DESERT_BIOMES,
  },
  {
    manifestId: "@hyperforge/content-pack-volcanic-v1",
    name: "Volcanic",
    description:
      "Lava / ash / basalt biomes. Install for a volcanic wasteland map, eruption survival, or lava-cavern theme.",
    tags: ["volcanic", "lava", "fire", "ash", "hostile", "content-pack"],
    biomes: VOLCANIC_BIOMES,
  },
  {
    manifestId: "@hyperforge/content-pack-wetland-v1",
    name: "Wetland",
    description:
      "Marsh / swamp / bog / delta biomes. Install for a swamp adventure map, river-delta survival, or wetland exploration theme.",
    tags: ["wetland", "swamp", "marsh", "humid", "content-pack"],
    biomes: WETLAND_BIOMES,
  },
];

function buildManifest(spec: PackSpec): Record<string, unknown> {
  return {
    version: 1,
    id: spec.manifestId,
    name: spec.name,
    description: spec.description,
    packVersion: PACK_VERSION,
    author: { name: "HyperForge" },
    license: "UNLICENSED",
    tags: spec.tags,
    // Phase D first cut: only `biomes` populated. Vegetation
    // species, terrain shader recipes, and water shader recipes
    // get added section-by-section as Phase C3/C4 land their
    // consumer migrations. The biome data alone produces visibly
    // different worlds (terrain tint, height shaping, difficulty
    // tier) which is enough payoff for the first cut.
    biomes: spec.biomes,
  };
}

async function upsertPack(
  pool: Pool,
  spec: PackSpec,
  manifest: Record<string, unknown>,
): Promise<void> {
  // Writes to `asset_packs` — that's the canonical content pack
  // table after Phase A2's collapse. A future cosmetic rename
  // to `content_packs` is queued.
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
    spec.manifestId,
    JSON.stringify(manifest),
    PACK_VERSION,
  ]);
  const row = result.rows[0];
  console.log(
    `[seed-themed-content] upserted ${row.manifest_id} (id=${row.id}, biomes=${spec.biomes.length})`,
  );
}

async function main(): Promise<void> {
  const url =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.FORGE_POSTGRES_USER || "forge"}:${process.env.FORGE_POSTGRES_PASSWORD || "forge_dev_password"}@localhost:${process.env.FORGE_POSTGRES_PORT || "5489"}/${process.env.FORGE_POSTGRES_DB || "forge"}`;
  const pool = new Pool({ connectionString: url });

  let totalBiomes = 0;
  for (const spec of PACKS) {
    const manifest = buildManifest(spec);
    await upsertPack(pool, spec, manifest);
    totalBiomes += spec.biomes.length;
  }

  console.log(
    `[seed-themed-content] done: ${PACKS.length} packs, ${totalBiomes} biomes total.`,
  );
  await pool.end();
}

void main().catch((err) => {
  console.error("[seed-themed-content] failed:", err);
  process.exit(1);
});
