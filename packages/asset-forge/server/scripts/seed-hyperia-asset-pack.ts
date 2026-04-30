/**
 * Hyperia Asset Pack Seeder — populates the marketplace with
 * one pack per content category instead of a single mega-pack.
 * Re-runnable; idempotent UPSERT keyed by `manifest_id`.
 *
 * Output packs (all `visibility="public"`, `source="built-in"`):
 *
 *   @hyperforge/asset-pack-hyperia-trees-v1
 *   @hyperforge/asset-pack-hyperia-rocks-v1
 *   @hyperforge/asset-pack-hyperia-fishing-v1
 *   @hyperforge/asset-pack-hyperia-npcs-v1
 *   @hyperforge/asset-pack-hyperia-weapons-v1
 *   @hyperforge/asset-pack-hyperia-armor-v1
 *   @hyperforge/asset-pack-hyperia-tools-v1
 *   @hyperforge/asset-pack-hyperia-stations-v1
 *   @hyperforge/asset-pack-hyperia-consumables-v1
 *   @hyperforge/asset-pack-hyperia-resources-v1
 *
 * The original mega-pack `@hyperforge/asset-pack-hyperia-v1`
 * stays in the DB as a transitional alias (existing projects
 * reference it). New code should target the category packs.
 *
 * Source manifests use four different field shapes for model
 * URLs: `modelPath`, `modelVariants[]`, `equippedModelPath`,
 * `model`. We normalize to one `modelUrl` per asset entry.
 *
 * Usage:
 *   bun run packages/asset-forge/server/scripts/seed-hyperia-asset-pack.ts
 *
 * Phase AP2 of `PLAN_ASSET_PACKS.md`.
 */

import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

type AssetType =
  | "character"
  | "creature"
  | "prop"
  | "weapon"
  | "tool"
  | "armor"
  | "vehicle"
  | "misc";

interface AssetEntry {
  id: string;
  name: string;
  description: string;
  type: AssetType;
  subtype: string;
  modelUrl: string;
  rigged: boolean;
  tags: string[];
}

interface PackSpec {
  manifestId: string;
  name: string;
  description: string;
  tags: string[];
  entries: AssetEntry[];
}

const PACK_VERSION = "1.0.0";

function findManifestsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const dir = resolve(here, "../".repeat(i + 1));
    const candidate = join(dir, "packages/server/world/assets/manifests");
    try {
      readFileSync(join(candidate, "world-areas.json"), "utf-8");
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error("Could not find manifests directory");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function safeRead<T>(path: string, label: string): T | null {
  try {
    return readJson<T>(path);
  } catch (err) {
    console.warn(
      `[seed-hyperia] ${label} read failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// Trees (woodcutting)
// ════════════════════════════════════════════════════════════════

function buildTreeEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const wc = safeRead<{
    trees: Array<{
      id: string;
      name: string;
      type: string;
      modelVariants: string[] | null;
    }>;
  }>(join(manifestsDir, "gathering/woodcutting.json"), "woodcutting.json");
  if (!wc) return entries;
  for (const tree of wc.trees) {
    const variants = tree.modelVariants ?? [];
    for (let i = 0; i < variants.length; i++) {
      entries.push({
        id: `${tree.id}_v${i + 1}`,
        name: variants.length > 1 ? `${tree.name} #${i + 1}` : tree.name,
        description: `${tree.name} — woodcutting target.`,
        type: "prop",
        subtype: "tree",
        modelUrl: variants[i]!,
        rigged: false,
        tags: ["tree", "woodcutting", "hyperia"],
      });
    }
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// Rocks (mining)
// ════════════════════════════════════════════════════════════════

function buildRockEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const mining = safeRead<{
    rocks: Array<{
      id: string;
      name: string;
      type: string;
      modelPath: string | null;
    }>;
  }>(join(manifestsDir, "gathering/mining.json"), "mining.json");
  if (!mining) return entries;
  for (const rock of mining.rocks) {
    if (!rock.modelPath) continue;
    entries.push({
      id: rock.id,
      name: rock.name,
      description: `${rock.name} — mining target.`,
      type: "prop",
      subtype: "rock",
      modelUrl: rock.modelPath,
      rigged: false,
      tags: ["rock", "mining", rock.type, "hyperia"],
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// Fishing spots
// ════════════════════════════════════════════════════════════════

function buildFishingEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const fishing = safeRead<{
    spots: Array<{
      id: string;
      name: string;
      type: string;
      modelPath: string | null;
    }>;
  }>(join(manifestsDir, "gathering/fishing.json"), "fishing.json");
  if (!fishing) return entries;
  for (const spot of fishing.spots) {
    if (!spot.modelPath) continue;
    entries.push({
      id: spot.id,
      name: spot.name,
      description: `${spot.name} — fishing target.`,
      type: "prop",
      subtype: "fishing_spot",
      modelUrl: spot.modelPath,
      rigged: false,
      tags: ["fishing", spot.type, "hyperia"],
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// NPCs (model lives under appearance.modelPath; split by category)
// ════════════════════════════════════════════════════════════════

interface NpcRow {
  id: string;
  name: string;
  description?: string;
  category?: string;
  faction?: string;
  appearance?: { modelPath?: string | null; scale?: number };
}

function readNpcs(manifestsDir: string): NpcRow[] {
  return safeRead<NpcRow[]>(join(manifestsDir, "npcs.json"), "npcs.json") ?? [];
}

function buildNpcEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  for (const npc of readNpcs(manifestsDir)) {
    // Skip mobs — they get their own pack.
    if (npc.category === "mob") continue;
    const modelPath = npc.appearance?.modelPath;
    if (!modelPath) continue;
    entries.push({
      id: npc.id,
      name: npc.name,
      description: npc.description ?? `${npc.name} — Hyperia NPC.`,
      type: "character",
      subtype: npc.faction ?? "humanoid",
      modelUrl: modelPath,
      rigged: true,
      tags: [
        "npc",
        "hyperia",
        ...(npc.category ? [npc.category] : []),
        ...(npc.faction ? [npc.faction] : []),
      ],
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// Mobs (NPCs with category = "mob")
// ════════════════════════════════════════════════════════════════

function buildMobEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  for (const npc of readNpcs(manifestsDir)) {
    if (npc.category !== "mob") continue;
    const modelPath = npc.appearance?.modelPath;
    if (!modelPath) continue;
    entries.push({
      id: npc.id,
      name: npc.name,
      description: npc.description ?? `${npc.name} — combat creature.`,
      type: "creature",
      subtype: npc.faction ?? "monster",
      modelUrl: modelPath,
      rigged: true,
      tags: ["mob", "combat", "hyperia", ...(npc.faction ? [npc.faction] : [])],
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// Weapons
// ════════════════════════════════════════════════════════════════

function buildWeaponEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const weapons = safeRead<
    Array<{
      id: string;
      name: string;
      tier?: string;
      weaponType?: string;
      modelPath?: string | null;
      description?: string;
    }>
  >(join(manifestsDir, "items/weapons.json"), "items/weapons.json");
  if (!weapons) return entries;
  for (const w of weapons) {
    if (!w.modelPath) continue;
    const subtype = (w.weaponType ?? "weapon").toLowerCase();
    entries.push({
      id: w.id,
      name: w.name,
      description: w.description ?? w.name,
      type: "weapon",
      subtype,
      modelUrl: w.modelPath,
      rigged: false,
      tags: ["weapon", subtype, ...(w.tier ? [w.tier] : []), "hyperia"],
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// Armor (uses equippedModelPath)
// ════════════════════════════════════════════════════════════════

function buildArmorEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const armor = safeRead<
    Array<{
      id: string;
      name: string;
      tier?: string;
      equipSlot?: string;
      equippedModelPath?: string | null;
      description?: string;
    }>
  >(join(manifestsDir, "items/armor.json"), "items/armor.json");
  if (!armor) return entries;
  for (const a of armor) {
    if (!a.equippedModelPath) continue;
    const subtype = (a.equipSlot ?? "armor").toLowerCase();
    entries.push({
      id: a.id,
      name: a.name,
      description: a.description ?? a.name,
      type: "armor",
      subtype,
      modelUrl: a.equippedModelPath,
      rigged: false,
      tags: ["armor", subtype, ...(a.tier ? [a.tier] : []), "hyperia"],
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// Tools (pickaxes, hatchets, fishing rods)
// ════════════════════════════════════════════════════════════════

function buildToolEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const tools = safeRead<
    Array<{
      id: string;
      name: string;
      tier?: string;
      modelPath?: string | null;
      description?: string;
      tool?: { skill?: string };
    }>
  >(join(manifestsDir, "items/tools.json"), "items/tools.json");
  if (!tools) return entries;
  for (const t of tools) {
    if (!t.modelPath) continue;
    const subtype = (t.tool?.skill ?? "tool").toLowerCase();
    entries.push({
      id: t.id,
      name: t.name,
      description: t.description ?? t.name,
      type: "tool",
      subtype,
      modelUrl: t.modelPath,
      rigged: false,
      tags: ["tool", subtype, ...(t.tier ? [t.tier] : []), "hyperia"],
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// Stations (anvils, furnaces, banks, etc.)
// ════════════════════════════════════════════════════════════════

function buildStationEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const stations = safeRead<{
    stations: Array<{
      type: string;
      name: string;
      model?: string | null;
      examine?: string;
    }>;
  }>(join(manifestsDir, "stations.json"), "stations.json");
  if (!stations) return entries;
  for (const s of stations.stations) {
    if (!s.model) continue;
    entries.push({
      id: s.type,
      name: s.name,
      description: s.examine ?? s.name,
      type: "prop",
      subtype: s.type,
      modelUrl: s.model,
      rigged: false,
      tags: ["station", "hyperia"],
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// Consumables (food + ammunition + runes + misc)
// ════════════════════════════════════════════════════════════════

interface ItemRow {
  id: string;
  name: string;
  type?: string;
  modelPath?: string | null;
  description?: string;
}

function buildConsumableEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const seen = new Set<string>();

  const ingest = (items: ItemRow[], fallbackSubtype: string): void => {
    for (const it of items) {
      if (!it.modelPath) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      const subtype = (it.type ?? fallbackSubtype).toLowerCase();
      entries.push({
        id: it.id,
        name: it.name,
        description: it.description ?? it.name,
        type: "misc",
        subtype,
        modelUrl: it.modelPath,
        rigged: false,
        tags: ["consumable", subtype, "hyperia"],
      });
    }
  };

  const food = safeRead<ItemRow[]>(
    join(manifestsDir, "items/food.json"),
    "items/food.json",
  );
  if (food) ingest(food, "food");

  const ammo = safeRead<ItemRow[]>(
    join(manifestsDir, "items/ammunition.json"),
    "items/ammunition.json",
  );
  if (ammo) ingest(ammo, "ammunition");

  const runes = safeRead<ItemRow[]>(
    join(manifestsDir, "items/runes.json"),
    "items/runes.json",
  );
  if (runes) ingest(runes, "rune");

  const misc = safeRead<ItemRow[]>(
    join(manifestsDir, "items/misc.json"),
    "items/misc.json",
  );
  if (misc) ingest(misc, "misc");

  return entries;
}

// ════════════════════════════════════════════════════════════════
// Resources (raw mats — ore chunks, logs, etc.)
// ════════════════════════════════════════════════════════════════

function buildResourceEntries(manifestsDir: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const resources = safeRead<
    Array<{
      id: string;
      name: string;
      type?: string;
      modelPath?: string | null;
      description?: string;
    }>
  >(join(manifestsDir, "items/resources.json"), "items/resources.json");
  if (!resources) return entries;
  for (const r of resources) {
    if (!r.modelPath) continue;
    entries.push({
      id: r.id,
      name: r.name,
      description: r.description ?? r.name,
      type: "misc",
      subtype: (r.type ?? "resource").toLowerCase(),
      modelUrl: r.modelPath,
      rigged: false,
      tags: ["resource", r.type ?? "raw-material", "hyperia"],
    });
  }
  return entries;
}

// ════════════════════════════════════════════════════════════════
// Pack assembly + DB upsert
// ════════════════════════════════════════════════════════════════

function buildPackSpecs(manifestsDir: string): PackSpec[] {
  return [
    {
      manifestId: "@hyperforge/asset-pack-hyperia-trees-v1",
      name: "Hyperia Trees",
      description:
        "Pine, oak, maple, palm, banana, eucalyptus, magic, mahogany, " +
        "and bamboo tree variants — every woodcutting model in the " +
        "Hyperia art style.",
      tags: ["hyperia", "trees", "woodcutting", "vegetation"],
      entries: buildTreeEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-rocks-v1",
      name: "Hyperia Rocks & Ores",
      description:
        "Mining rocks: copper, tin, iron, coal, gold, mithril, " +
        "adamant, runite, and essence — every ore-bearing rock in " +
        "the Hyperia art style.",
      tags: ["hyperia", "rocks", "mining", "ore"],
      entries: buildRockEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-fishing-v1",
      name: "Hyperia Fishing Spots",
      description:
        "Net, harpoon, lobster, and shark fishing-spot props for " +
        "fishing-skill content.",
      tags: ["hyperia", "fishing"],
      entries: buildFishingEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-npcs-v1",
      name: "Hyperia NPCs",
      description:
        "Quest givers, merchants, town guards, and ambient " +
        "humanoids in the Hyperia art style.",
      tags: ["hyperia", "npc", "character"],
      entries: buildNpcEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-mobs-v1",
      name: "Hyperia Mobs & Creatures",
      description:
        "Combat creatures — goblins, bandits, and other hostile " +
        "NPCs designed for tile-based MMORPG combat.",
      tags: ["hyperia", "mob", "creature", "combat"],
      entries: buildMobEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-weapons-v1",
      name: "Hyperia Weapons",
      description:
        "Swords, bows, daggers, scimitars, longswords, two-handers, " +
        "and magic staves across every tier.",
      tags: ["hyperia", "weapon", "combat"],
      entries: buildWeaponEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-armor-v1",
      name: "Hyperia Armor",
      description:
        "Helmets, body armor, leg armor, shields, gloves, and boots " +
        "across every tier.",
      tags: ["hyperia", "armor", "equipment"],
      entries: buildArmorEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-tools-v1",
      name: "Hyperia Tools",
      description: "Pickaxes, hatchets, and fishing rods across every tier.",
      tags: ["hyperia", "tool", "gathering"],
      entries: buildToolEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-stations-v1",
      name: "Hyperia Crafting Stations",
      description:
        "Anvils, furnaces, cooking ranges, and other crafting " +
        "station props.",
      tags: ["hyperia", "station", "crafting"],
      entries: buildStationEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-consumables-v1",
      name: "Hyperia Consumables",
      description: "Food items, ammunition, runes, and misc consumables.",
      tags: ["hyperia", "consumable", "food"],
      entries: buildConsumableEntries(manifestsDir),
    },
    {
      manifestId: "@hyperforge/asset-pack-hyperia-resources-v1",
      name: "Hyperia Resources",
      description:
        "Raw materials — ore chunks, logs, fish, hides, and other " +
        "gatherable resources.",
      tags: ["hyperia", "resource", "raw-material"],
      entries: buildResourceEntries(manifestsDir),
    },
  ];
}

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
    assets: spec.entries,
  };
}

async function upsertPack(
  pool: Pool,
  manifestId: string,
  manifest: Record<string, unknown>,
): Promise<void> {
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
    `[seed-hyperia] upserted ${row.manifest_id} (id=${row.id}, source=${row.source}, version=${row.version})`,
  );
}

async function main(): Promise<void> {
  const manifestsDir = findManifestsDir();
  console.log(`[seed-hyperia] manifests dir: ${manifestsDir}`);

  const specs = buildPackSpecs(manifestsDir);

  const url =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.FORGE_POSTGRES_USER || "forge"}:${process.env.FORGE_POSTGRES_PASSWORD || "forge_dev_password"}@localhost:${process.env.FORGE_POSTGRES_PORT || "5489"}/${process.env.FORGE_POSTGRES_DB || "forge"}`;
  const pool = new Pool({ connectionString: url });

  let totalEntries = 0;
  let upserted = 0;
  let skipped = 0;
  for (const spec of specs) {
    if (spec.entries.length === 0) {
      console.log(
        `[seed-hyperia] skipping empty: ${spec.manifestId} (no entries built)`,
      );
      skipped += 1;
      continue;
    }
    const manifest = buildManifest(spec);
    await upsertPack(pool, spec.manifestId, manifest);
    console.log(
      `  └ ${spec.entries.length} ${spec.entries.length === 1 ? "entry" : "entries"}`,
    );
    totalEntries += spec.entries.length;
    upserted += 1;
  }

  console.log(
    `[seed-hyperia] done: ${upserted} pack${upserted === 1 ? "" : "s"} upserted, ${skipped} skipped, ${totalEntries} total entries.`,
  );
  await pool.end();
}

void main().catch((err) => {
  console.error("[seed-hyperia] failed:", err);
  process.exit(1);
});
