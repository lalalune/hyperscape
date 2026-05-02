/**
 * BiomePackService — read access for the `biome_packs` table.
 *
 * Phase 3 of `PLAN_PACK_TYPES.md`. Mirrors the AssetPackService
 * shape but trimmed to the surface the studio + agent actually
 * read today: list-by-installed and list-marketplace.
 *
 * Write paths (create / publish / addEntry) land alongside a
 * studio UI — until then, biome packs arrive via the seeder
 * (`server/scripts/seed-hyperia-biome-pack.ts`).
 */

import { eq, desc, inArray, or, and } from "drizzle-orm";
import { getDb, isDatabaseEnabled } from "../db/db";
import { biomePacks, type BiomePack } from "../db/schema";

export class BiomePackService {
  /**
   * Resolve a list of biome pack manifest_ids into the full
   * stored rows. Used by the project loader to register each
   * pack's biomes into the runtime registry. Unknown ids are
   * silently dropped (route layer logs a warning); the caller
   * always gets back a subset of installed packs.
   */
  async resolveByManifestIds(
    manifestIds: ReadonlyArray<string>,
  ): Promise<BiomePack[]> {
    if (manifestIds.length === 0) return [];
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    return db
      .select()
      .from(biomePacks)
      .where(inArray(biomePacks.manifestId, [...manifestIds]));
  }

  /** Fetch a single pack by manifest_id. */
  async getByManifestId(manifestId: string): Promise<BiomePack | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;
    const [row] = await db
      .select()
      .from(biomePacks)
      .where(eq(biomePacks.manifestId, manifestId))
      .limit(1);
    return row ?? null;
  }

  /**
   * List packs the team can install — every public pack plus
   * any team-visibility packs owned by the caller's team.
   * Newest first. Mirrors `AssetPackService.listAvailable`.
   */
  async listAvailable(teamId: string | null): Promise<BiomePack[]> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    const publicWhere = eq(biomePacks.visibility, "public");
    const where = teamId
      ? or(
          publicWhere,
          and(eq(biomePacks.teamId, teamId), eq(biomePacks.visibility, "team")),
        )
      : publicWhere;

    return db
      .select()
      .from(biomePacks)
      .where(where)
      .orderBy(desc(biomePacks.createdAt));
  }
}
