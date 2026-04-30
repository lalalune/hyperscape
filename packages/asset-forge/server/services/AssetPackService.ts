/**
 * AssetPackService — Read/write for the `asset_packs` table.
 *
 * Phase AP1+ of `PLAN_ASSET_PACKS.md`. Today's surface:
 *
 *   - listAvailable() — every pack the team can install (built-in
 *     + team-owned + future marketplace)
 *   - getByManifestId(id) — fetch one pack
 *
 * The studio's Asset Library + agent's `LIST_ASSET_PACKS` action
 * both read through this service.
 */

import { eq, or, desc, and, inArray } from "drizzle-orm";
import {
  AssetPackEntrySchema,
  type AssetPackEntry,
} from "@hyperforge/manifest-schema";
import { getDb, isDatabaseEnabled } from "../db/db";
import { assetPacks, type AssetPack } from "../db/schema";

/**
 * AP9.1 — visibility tier (see migration 0010).
 *   - "private" → only the owning team can see the row
 *   - "team"    → installable by any team member
 *   - "public"  → installable by anyone (built-ins + marketplace)
 */
export type AssetPackVisibility = "private" | "team" | "public";

export class AssetPackService {
  /**
   * List packs the team can install:
   *   - Every public pack (built-in + marketplace listings)
   *   - Plus team-visibility packs owned by the caller's team
   * Newest first. Private packs are excluded — those are drafts
   * shown only through the dedicated team-management surface.
   */
  async listAvailable(teamId: string | null): Promise<AssetPack[]> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    const publicWhere = eq(assetPacks.visibility, "public");
    const where = teamId
      ? or(
          publicWhere,
          and(eq(assetPacks.teamId, teamId), eq(assetPacks.visibility, "team")),
        )
      : publicWhere;

    return db
      .select()
      .from(assetPacks)
      .where(where)
      .orderBy(desc(assetPacks.createdAt));
  }

  /**
   * AP9.1 — marketplace browse query. Returns every public pack,
   * newest-published first. No auth scope: marketplace is, by
   * definition, world-readable. Pagination is the caller's
   * responsibility (limit/offset args).
   */
  async listMarketplace(
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<AssetPack[]> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);

    return db
      .select()
      .from(assetPacks)
      .where(eq(assetPacks.visibility, "public"))
      .orderBy(desc(assetPacks.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Pack-creation entry point — used by `POST /api/asset-packs`
   * to author a fresh, empty team pack. The manifest blob is
   * synthesized from the form fields with `assets: []`; entries
   * are added through a separate "Add to Pack" surface (or the
   * seeder, or the agent's bake pipeline routing assets here).
   *
   * Visibility starts at "team" — pack is immediately visible to
   * teammates but NOT to the public marketplace until the owner
   * calls publish.
   *
   * Throws if `manifestId` collides with an existing pack (the
   * unique constraint on `manifest_id` is the source of truth).
   */
  async create(input: {
    manifestId: string;
    name: string;
    description: string;
    packVersion: string;
    license?: string;
    tags?: ReadonlyArray<string>;
    teamId: string;
    authorName: string;
  }): Promise<AssetPack | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const manifest = {
      version: 1 as const,
      id: input.manifestId,
      name: input.name,
      description: input.description,
      packVersion: input.packVersion,
      author: { name: input.authorName },
      license: input.license ?? "UNLICENSED",
      tags: input.tags ?? [],
      assets: [] as Array<unknown>,
    };

    const [row] = await db
      .insert(assetPacks)
      .values({
        teamId: input.teamId,
        manifestId: input.manifestId,
        manifest,
        source: "user",
        version: input.packVersion,
        visibility: "team",
        publishedAt: null,
      })
      .returning();
    return row ?? null;
  }

  /**
   * Append an entry to a pack's manifest. Caller is responsible
   * for authorization (route checks team ownership). Throws if
   * the entry id collides with an existing entry in the same
   * pack — pack-scoped ids must be unique within a pack.
   *
   * Today this only updates the JSON manifest. Cross-linking the
   * `assets.pack_id` FK happens in a separate step (when an
   * existing baked asset is being routed into a pack via a future
   * "Add Existing Asset" UI). For pure manual entries (modelUrl
   * pointing at a CDN), there's no asset row to link.
   *
   * Returns the updated pack row, or null when the pack doesn't
   * exist.
   */
  async addEntry(
    manifestId: string,
    rawEntry: unknown,
  ): Promise<
    | { ok: true; pack: AssetPack }
    | { ok: false; reason: "not-found" | "duplicate"; message: string }
    | { ok: false; reason: "invalid"; issues: ReadonlyArray<string> }
  > {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) {
      return {
        ok: false,
        reason: "not-found",
        message: "Database disabled",
      };
    }

    const parsed = AssetPackEntrySchema.safeParse(rawEntry);
    if (!parsed.success) {
      return {
        ok: false,
        reason: "invalid",
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      };
    }
    const entry: AssetPackEntry = parsed.data;

    const existing = await this.getByManifestId(manifestId);
    if (!existing) {
      return {
        ok: false,
        reason: "not-found",
        message: `No pack with manifest_id "${manifestId}"`,
      };
    }

    const manifest = (existing.manifest ?? {}) as {
      assets?: Array<{ id?: string }>;
      [k: string]: unknown;
    };
    const currentAssets = Array.isArray(manifest.assets) ? manifest.assets : [];
    if (currentAssets.some((a) => a?.id === entry.id)) {
      return {
        ok: false,
        reason: "duplicate",
        message: `Pack "${manifestId}" already has an entry with id "${entry.id}"`,
      };
    }

    const updatedManifest = {
      ...manifest,
      assets: [...currentAssets, entry],
    };
    const [row] = await db
      .update(assetPacks)
      .set({
        manifest: updatedManifest,
        updatedAt: new Date(),
      })
      .where(eq(assetPacks.manifestId, manifestId))
      .returning();
    return { ok: true, pack: row };
  }

  /**
   * AP9 — flip a team-visibility pack to public so it lands in
   * the marketplace browse query. Idempotent: a pack already
   * `public` is returned unchanged. Returns the updated row, or
   * null if the pack doesn't exist (caller decides 404 vs error
   * messaging).
   *
   * Authorization is the caller's responsibility — this service
   * method assumes the route layer has already checked that the
   * caller owns the pack's team. Setting `published_at` is
   * idempotent: if already set (an earlier publish), it's
   * preserved so original publish date sticks.
   */
  async publish(manifestId: string): Promise<AssetPack | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const existing = await this.getByManifestId(manifestId);
    if (!existing) return null;

    if (existing.visibility === "public") {
      // Idempotent — already published. Return as-is.
      return existing;
    }

    const [updated] = await db
      .update(assetPacks)
      .set({
        visibility: "public",
        publishedAt: existing.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(assetPacks.manifestId, manifestId))
      .returning();
    return updated ?? null;
  }

  /**
   * AP9 — flip a public pack back to team-visibility. Useful for
   * "unpublish" / takedown. Resets `published_at` to NULL so a
   * future re-publish gets a fresh timestamp.
   */
  async unpublish(manifestId: string): Promise<AssetPack | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const existing = await this.getByManifestId(manifestId);
    if (!existing) return null;
    if (existing.visibility !== "public") return existing;

    const [updated] = await db
      .update(assetPacks)
      .set({
        visibility: "team",
        publishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(assetPacks.manifestId, manifestId))
      .returning();
    return updated ?? null;
  }

  /** Fetch a single pack by its manifest_id (e.g. "@hyperforge/asset-pack-hyperia-v1"). */
  async getByManifestId(manifestId: string): Promise<AssetPack | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;
    const [row] = await db
      .select()
      .from(assetPacks)
      .where(eq(assetPacks.manifestId, manifestId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Verify all the manifest_ids exist in the installable scope
   * for the team. Returns the subset that are missing — useful
   * for `setAssetPacks` to reject installs of unknown / unauthorized
   * packs early.
   */
  async findMissingPackIds(
    manifestIds: ReadonlyArray<string>,
    teamId: string | null,
  ): Promise<string[]> {
    if (manifestIds.length === 0) return [];
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [...manifestIds];

    const publicWhere = eq(assetPacks.visibility, "public");
    const scopeWhere = teamId
      ? or(
          publicWhere,
          and(eq(assetPacks.teamId, teamId), eq(assetPacks.visibility, "team")),
        )
      : publicWhere;

    const rows = await db
      .select({ manifestId: assetPacks.manifestId })
      .from(assetPacks)
      .where(and(inArray(assetPacks.manifestId, [...manifestIds]), scopeWhere));
    const known = new Set(rows.map((r) => r.manifestId));
    return manifestIds.filter((id) => !known.has(id));
  }
}
