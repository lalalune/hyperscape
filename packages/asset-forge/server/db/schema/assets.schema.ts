/**
 * Assets Schema
 * 3D asset management and metadata
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  bigint,
  integer,
  index,
} from "drizzle-orm/pg-core";

/**
 * Assets table
 * Links file-based assets to database records with metadata
 */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Asset identification
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 100 }).notNull(), // character, item, environment, equipment
    category: varchar("category", { length: 100 }),
    ownerId: varchar("owner_id", { length: 255 }),

    // File storage (paths relative to gdd-assets directory)
    filePath: varchar("file_path", { length: 512 }), // e.g., "asset-id/model.glb"
    fileSize: bigint("file_size", { mode: "number" }),
    fileType: varchar("file_type", { length: 100 }),
    thumbnailPath: varchar("thumbnail_path", { length: 512 }),

    // Generation metadata
    prompt: text("prompt"),
    negativePrompt: text("negative_prompt"),
    modelUsed: varchar("model_used", { length: 255 }),
    generationParams: jsonb("generation_params").notNull().default({}),

    // Asset properties
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata").notNull().default({}),

    // Versioning
    version: integer("version").notNull().default(1),
    parentAssetId: uuid("parent_asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),

    // Status: 'draft' | 'processing' | 'completed' | 'failed' | 'approved' | 'published' | 'archived'
    status: varchar("status", { length: 50 }).notNull().default("draft"),

    // Visibility: 'private' | 'public'
    visibility: varchar("visibility", { length: 50 })
      .notNull()
      .default("private"),

    // Export tracking
    exportedToRepo: timestamp("exported_to_repo", { withTimezone: true }),
    manifestPath: varchar("manifest_path", { length: 512 }), // Path in assets repo manifest

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => ({
    typeIdx: index("idx_assets_type").on(table.type),
    statusIdx: index("idx_assets_status").on(table.status),
    tagsIdx: index("idx_assets_tags").using("gin", table.tags),
  }),
);

// Type exports
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
