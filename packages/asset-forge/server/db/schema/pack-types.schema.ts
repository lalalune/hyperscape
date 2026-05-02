/**
 * Pack-type tables — biome / terrain / water / vegetation packs.
 *
 * Phase 2 of `PLAN_PACK_TYPES.md`. Mirrors the existing
 * `asset_packs` table for the four new orthogonal pack kinds:
 *
 *   - `biome_packs`      — id/name/color/zoning data
 *   - `terrain_packs`    — shader recipe + heightmap presets
 *   - `water_packs`      — water shader recipe + animation profile
 *   - `vegetation_packs` — species + density rules
 *
 * Each table carries the same columns as `asset_packs`
 * (manifest_id, manifest jsonb blob, source, version,
 * visibility, published_at, team scoping). Visibility tiers
 * mirror AP9.1: "private" | "team" | "public".
 *
 * The corresponding `world_projects.{biome,terrain,water,vegetation}_packs`
 * text[] columns track which packs each project has installed —
 * same pattern as `world_projects.asset_packs`.
 *
 * Phase 2 only ships the tables + columns; service classes and
 * route surfaces land in follow-up cuts. Migration `0011`
 * applies all four tables and four columns in one atomic step.
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

// ────────────────────────────────────────────────────────────
// Shared helpers — every pack type's table has the same shape.
// Defining the column factory once keeps the four definitions
// from drifting and makes "add `signature` field" a one-line
// change in a future supply-chain phase.
// ────────────────────────────────────────────────────────────

/**
 * Inline column factory that returns the standard pack columns.
 * Drizzle's `pgTable` builder is positional, so this returns a
 * fresh object each call (column instances are not reusable
 * across tables).
 */
function packColumns() {
  return {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    /** npm-style manifest id (globally unique). */
    manifestId: text("manifest_id").notNull().unique(),
    /** Validated pack manifest blob. Shape per pack-type schema. */
    manifest: jsonb("manifest").notNull(),
    /** "built-in" | "user" | "marketplace" */
    source: text("source").notNull(),
    /** Semver pulled out of the manifest for fast filtering. */
    version: text("version").notNull(),
    /** "private" | "team" | "public" — see asset_packs AP9.1. */
    visibility: text("visibility").notNull().default("team"),
    /** Marketplace publish timestamp; NULL = never published. */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}

// ────────────────────────────────────────────────────────────
// Biome packs
// ────────────────────────────────────────────────────────────
export const biomePacks = pgTable("biome_packs", packColumns(), (table) => ({
  teamIdx: index("idx_biome_packs_team").on(table.teamId),
  sourceIdx: index("idx_biome_packs_source").on(table.source),
  publicPublishedIdx: index("idx_biome_packs_public_published").on(
    table.visibility,
    table.publishedAt,
  ),
}));
export type BiomePack = typeof biomePacks.$inferSelect;
export type NewBiomePack = typeof biomePacks.$inferInsert;

// ────────────────────────────────────────────────────────────
// Terrain packs
// ────────────────────────────────────────────────────────────
export const terrainPacks = pgTable(
  "terrain_packs",
  packColumns(),
  (table) => ({
    teamIdx: index("idx_terrain_packs_team").on(table.teamId),
    sourceIdx: index("idx_terrain_packs_source").on(table.source),
    publicPublishedIdx: index("idx_terrain_packs_public_published").on(
      table.visibility,
      table.publishedAt,
    ),
  }),
);
export type TerrainPack = typeof terrainPacks.$inferSelect;
export type NewTerrainPack = typeof terrainPacks.$inferInsert;

// ────────────────────────────────────────────────────────────
// Water packs
// ────────────────────────────────────────────────────────────
export const waterPacks = pgTable("water_packs", packColumns(), (table) => ({
  teamIdx: index("idx_water_packs_team").on(table.teamId),
  sourceIdx: index("idx_water_packs_source").on(table.source),
  publicPublishedIdx: index("idx_water_packs_public_published").on(
    table.visibility,
    table.publishedAt,
  ),
}));
export type WaterPack = typeof waterPacks.$inferSelect;
export type NewWaterPack = typeof waterPacks.$inferInsert;

// ────────────────────────────────────────────────────────────
// Vegetation packs
// ────────────────────────────────────────────────────────────
export const vegetationPacks = pgTable(
  "vegetation_packs",
  packColumns(),
  (table) => ({
    teamIdx: index("idx_vegetation_packs_team").on(table.teamId),
    sourceIdx: index("idx_vegetation_packs_source").on(table.source),
    publicPublishedIdx: index("idx_vegetation_packs_public_published").on(
      table.visibility,
      table.publishedAt,
    ),
  }),
);
export type VegetationPack = typeof vegetationPacks.$inferSelect;
export type NewVegetationPack = typeof vegetationPacks.$inferInsert;

// Sentinel reference so drizzle-kit picks up this file.
export const _PACK_TYPES_TABLES_REGISTERED = "pack_types"; // eslint-disable-line @typescript-eslint/no-unused-vars
void sql; // keep import for future inline literal SQL needs
