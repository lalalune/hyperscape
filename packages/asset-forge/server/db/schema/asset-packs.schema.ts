/**
 * Asset Packs Schema
 *
 * Phase AP1 of `PLAN_ASSET_PACKS.md`. An asset pack is a versioned
 * bundle of 3D meshes a project can install. The pack record is
 * the metadata header; per-asset rows in the `assets` table can
 * point back via the `pack_id` FK.
 *
 * Source taxonomy:
 *   - "built-in"   — shipped with the platform (e.g. Hyperia bundle)
 *   - "user"       — generated/uploaded by a team
 *   - "marketplace" — published to the marketplace (future)
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

import { teams } from "./teams.schema";

export const assetPacks = pgTable(
  "asset_packs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    /** npm-style manifest id (globally unique). */
    manifestId: text("manifest_id").notNull().unique(),
    /** Validated AssetPackManifestSchema blob. */
    manifest: jsonb("manifest").notNull(),
    /** "built-in" | "user" | "marketplace" */
    source: text("source").notNull(),
    /** Semver pulled out of the manifest for fast filtering. */
    version: text("version").notNull(),
    /**
     * AP9.1 — visibility tier. CHECK constraint at the DB layer
     * pins values to "private" | "team" | "public":
     *   - "private"  → only the owning team sees the row (drafts,
     *                  in-progress packs not yet team-shared)
     *   - "team"     → installable by any team member (today's
     *                  default for non-null team_id)
     *   - "public"   → installable by anyone (built-ins +
     *                  marketplace listings)
     */
    visibility: text("visibility").notNull().default("team"),
    /**
     * AP9.1 — marketplace publish timestamp. NULL = never
     * published. Set when visibility transitions to "public"
     * through the publish flow. Built-ins are backfilled to
     * their created_at.
     */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    teamIdx: index("idx_asset_packs_team").on(table.teamId),
    sourceIdx: index("idx_asset_packs_source").on(table.source),
    publicPublishedIdx: index("idx_asset_packs_public_published").on(
      table.visibility,
      table.publishedAt,
    ),
  }),
);

export type AssetPack = typeof assetPacks.$inferSelect;
export type NewAssetPack = typeof assetPacks.$inferInsert;

// Note: the `assets.pack_id` column is added to the existing
// `assets` table by the same migration. The Drizzle schema for
// `assets` lives in `assets.schema.ts`; the FK augmentation there
// is a separate edit kept in this same review chunk.

// `world_projects.asset_packs` text[] is added by the same
// migration (see `world-projects.schema.ts`).

// Sentinel reference so drizzle-kit picks up this file.
export const _ASSET_PACKS_TABLE_REGISTERED = "asset_packs"; // eslint-disable-line @typescript-eslint/no-unused-vars
void sql; // keep import for future inline literal SQL needs
