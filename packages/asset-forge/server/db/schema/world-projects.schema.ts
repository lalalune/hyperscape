/**
 * World Projects & Deployments Schema
 * Server-persisted world project data with staging → production deployment tracking
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

import { forgeUsers } from "./forge-users.schema";
import { teams } from "./teams.schema";
import { games } from "./teams.schema";

/**
 * World Projects table
 *
 * Phase B0'.A of `PLAN_PROJECT_AS_DATA.md`. The legacy opaque
 * `world_data` blob is split into typed layers:
 *
 *   - schemaVersion: project shape version (B0'.A = 1)
 *   - config: procgen `WorldCreationConfig` (terrain shape, biomes)
 *   - plugins: plugin ids installed by PIE on Play
 *   - worldContent: authored content (npcs, zones, quests, uiPack)
 *   - templateId: template the project was cloned from
 *
 * `worldData` is preserved (deprecated) for one release as a
 * read-fallback safety net. New writes go through the typed columns.
 */
export const worldProjects = pgTable(
  "world_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Ownership
    teamId: uuid("team_id")
      .references(() => teams.id)
      .notNull(),
    gameId: uuid("game_id")
      .references(() => games.id)
      .notNull(),

    // Identity
    name: text("name").notNull(),
    description: text("description"),

    // Versioning
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => forgeUsers.id),

    // ───── B0'.A typed project layers ─────
    /** Project shape version. B0'.A introduces v1; bump on incompatible changes. */
    schemaVersion: integer("schema_version").notNull().default(1),
    /** Procgen `WorldCreationConfig` (terrain shape, biomes, towns, vegetation). */
    config: jsonb("config"),
    /** Plugin ids installed by PIE on Play. Empty = blank canvas. */
    plugins: text("plugins")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /**
     * Asset pack ids this project has installed (AP1). Each
     * resolves to an `asset_packs.manifest_id`. The studio's Asset
     * Library shows the union of installed packs' catalogs; empty
     * = blank library.
     */
    assetPacks: text("asset_packs")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Authored content layered on top of plugin contributions. */
    worldContent: jsonb("world_content")
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Template the project was cloned from (e.g. "blank", "hyperia"). */
    templateId: text("template_id"),

    // ───── Legacy ─────
    /**
     * @deprecated B0'.A. Replaced by typed `config / plugins /
     * worldContent / templateId` columns. Preserved for one release
     * so `WorldProjectService` can read-fallback decode rows that
     * predate the migration. Drop in a follow-up migration after a
     * backfill verification pass.
     */
    worldData: jsonb("world_data").notNull(),

    // Snapshot of all 38 manifest files at save time
    manifestSnapshot: jsonb("manifest_snapshot"),

    // Optimistic lock
    lockedBy: uuid("locked_by").references(() => forgeUsers.id),
    lockedAt: timestamp("locked_at", { withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    teamGameIdx: index("idx_projects_team_game").on(table.teamId, table.gameId),
    updatedIdx: index("idx_projects_updated").on(table.updatedAt),
  }),
);

/**
 * World Deployments table
 * Records each deployment to staging or production with diffs and rollback data
 */
export const worldDeployments = pgTable(
  "world_deployments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // References
    projectId: uuid("project_id")
      .references(() => worldProjects.id)
      .notNull(),
    gameId: uuid("game_id")
      .references(() => games.id)
      .notNull(),

    // Deployment info
    target: text("target").notNull(), // 'staging' | 'production'
    version: integer("version").notNull(),

    // Diffs for review
    manifestDiff: jsonb("manifest_diff"),
    assetDiff: jsonb("asset_diff"),

    // Audit
    deployedBy: uuid("deployed_by").references(() => forgeUsers.id),
    approvedBy: uuid("approved_by").references(() => forgeUsers.id), // Required for prod

    // Rollback support
    rollbackData: jsonb("rollback_data"),

    // Timestamps
    deployedAt: timestamp("deployed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    projectIdx: index("idx_deployments_project").on(
      table.projectId,
      table.deployedAt,
    ),
    gameTargetIdx: index("idx_deployments_game_target").on(
      table.gameId,
      table.target,
      table.deployedAt,
    ),
  }),
);

/**
 * Project revision history (Phase G1 of the AAA gap audit).
 *
 * Append-only snapshot of a project's typed layers BEFORE each
 * write. The snapshot captures the project at version N; the
 * write that triggered it produces version N+1. Author tracks
 * whether the change came from a user, the agent, or the system
 * (migrations, backfills).
 *
 * Restoring a revision = writing its snapshot back into the
 * project record (and bumping version). The restore endpoint is
 * a follow-up; this table is the substrate.
 */
export const worldProjectRevisions = pgTable(
  "world_project_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => worldProjects.id, { onDelete: "cascade" })
      .notNull(),
    /** Project version this revision captures (the BEFORE state). */
    version: integer("version").notNull(),
    /** "user" | "agent" | "system". */
    author: text("author").notNull().default("system"),
    /** forge_users.id when author = "user". */
    authorId: uuid("author_id").references(() => forgeUsers.id),
    /** Short human label (e.g. "patch worldContent", "PROPOSE_NPC"). */
    changeReason: text("change_reason"),
    schemaVersion: integer("schema_version").notNull().default(1),
    config: jsonb("config"),
    plugins: text("plugins")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    worldContent: jsonb("world_content")
      .notNull()
      .default(sql`'{}'::jsonb`),
    templateId: text("template_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    projectCreatedIdx: index("idx_project_revisions_project_created").on(
      table.projectId,
      table.createdAt,
    ),
    projectVersionIdx: index("idx_project_revisions_project_version").on(
      table.projectId,
      table.version,
    ),
  }),
);

// Type exports
export type WorldProject = typeof worldProjects.$inferSelect;
export type NewWorldProject = typeof worldProjects.$inferInsert;
export type WorldDeployment = typeof worldDeployments.$inferSelect;
export type NewWorldDeployment = typeof worldDeployments.$inferInsert;
export type WorldProjectRevision = typeof worldProjectRevisions.$inferSelect;
export type NewWorldProjectRevision = typeof worldProjectRevisions.$inferInsert;
