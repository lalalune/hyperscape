/**
 * Built-in project pack catalog — auto-bootstraps on server
 * start alongside the content pack catalog
 * (`server/builtins/content-packs.ts`).
 *
 * Phase E of `PLAN_AAA_CONTENT_SYSTEM.md`. A `ProjectPack`
 * bundles plugins + content packs + initial config + authored
 * world content into a single forkable manifest. The
 * `ProjectPackService.fork(packId)` action reads this manifest
 * and creates a fully-configured project in one round-trip —
 * UE5 "Create Project From Template" / Unity template-based
 * new-project pattern.
 *
 * Built-in catalog (this cut):
 *
 *   @hyperforge/project-pack-hyperia-v1
 *     — Pulls in the Hyperscape gameplay plugin + the Hyperia
 *       content pack + the trees asset pack. The canonical
 *       "fork an entire Hyperia clone" entry point. User
 *       installs nothing manually; one fork → fully-configured
 *       Hyperia-style RPG project.
 *
 * Future packs land alongside (project-pack-shooter-demo,
 * project-pack-tropical-rpg, etc.) — each is a hand-curated
 * "starter game" plus the content packs that match its theme.
 *
 * Idempotent per the asset_packs table's manifest_id unique
 * constraint; the same upsert path as content packs.
 */

import { Pool } from "pg";

interface BuiltinProjectPack {
  manifestId: string;
  name: string;
  description: string;
  packVersion: string;
  tags: string[];
  pluginIds: string[];
  contentPackIds: string[];
  // initialConfig + initialWorldContent intentionally absent
  // for the v1 cut; project pack fork applies the manifest's
  // pluginIds + contentPackIds and lets procgen generate the
  // world from scratch. Future v2 packs may pre-bake a town
  // layout, NPC placements, etc.
}

const HYPERIA_PROJECT_PACK: BuiltinProjectPack = {
  manifestId: "@hyperforge/project-pack-hyperia-v1",
  name: "Hyperia",
  description:
    "Fork an entire Hyperia-style RPG in one click. Bundles the Hyperscape gameplay plugin (combat, skills, gathering, prayers, banking) + the Hyperia content pack (tundra/forest/canyon biomes) + the Hyperia trees asset pack. Open the resulting project and you have a working RPG world — terrain, biomes, trees, NPCs ready to place via the AI companion.",
  packVersion: "1.0.0",
  tags: ["hyperia", "rpg", "starter", "fork", "project-pack", "built-in"],
  pluginIds: ["@hyperforge/hyperscape"],
  contentPackIds: [
    "@hyperforge/content-pack-hyperia-v1",
    "@hyperforge/asset-pack-hyperia-trees-v1",
  ],
};

export const BUILTIN_PROJECT_PACKS: ReadonlyArray<BuiltinProjectPack> =
  Object.freeze([HYPERIA_PROJECT_PACK]);

function buildManifest(pack: BuiltinProjectPack): Record<string, unknown> {
  return {
    version: 1,
    id: pack.manifestId,
    name: pack.name,
    description: pack.description,
    packVersion: pack.packVersion,
    author: { name: "HyperForge" },
    license: "UNLICENSED",
    tags: pack.tags,
    pluginIds: pack.pluginIds,
    contentPackIds: pack.contentPackIds,
    // initialConfig + initialWorldContent omitted for the v1
    // cut; the schema marks them optional. ProjectPackService.fork
    // skips the initial-config / world-content merge when absent.
  };
}

async function upsertOne(pool: Pool, pack: BuiltinProjectPack): Promise<void> {
  // Project packs share the `asset_packs` table with content
  // packs (Phase A unified the storage). The id-prefix
  // (`@hyperforge/project-pack-*`) is the practical
  // discriminator the service uses when listing forkable
  // packs.
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
 * Upsert every built-in project pack. Called once on server
 * boot from `api-elysia.ts` alongside the content pack
 * bootstrap; safe to call repeatedly. Same per-pack
 * soft-fail policy as content packs.
 */
export async function upsertBuiltinProjectPacks(
  pool: Pool,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const pack of BUILTIN_PROJECT_PACKS) {
    try {
      await upsertOne(pool, pack);
      ok += 1;
    } catch (err) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.warn(
        `[builtins/project-packs] upsert failed for ${pack.manifestId}:`,
        err,
      );
    }
  }
  return { ok, failed };
}
