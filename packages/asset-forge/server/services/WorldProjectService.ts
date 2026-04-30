/**
 * World Project Service
 * CRUD operations for world projects with optimistic locking and versioning.
 *
 * Database is optional — all operations return null/empty when DB is unavailable.
 *
 * Phase B0'.A of `PLAN_PROJECT_AS_DATA.md`: a project is now a typed
 * `{ schemaVersion, config, plugins, worldContent, templateId }`
 * record. The legacy opaque `worldData` blob is preserved for one
 * release as a read-fallback for rows that predate the migration —
 * see `decodeProjectLayers()` below. New writes go through the
 * typed columns.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb, isDatabaseEnabled } from "../db/db";
import {
  worldProjects,
  worldProjectRevisions,
  worldDeployments,
  type WorldProject,
  type WorldDeployment,
  type WorldProjectRevision,
} from "../db/schema";
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  decodeProjectLayers,
  mergeWorldContent,
  resolveLayersFromCreateInput,
  synthLegacyBlob,
  type ProjectLayers,
} from "./projectLayers";

// Re-export for callers that expect these on `WorldProjectService`'s
// module surface. Implementations live in `projectLayers.ts` so they
// can be unit-tested without dragging in the DB import chain.
export {
  CURRENT_PROJECT_SCHEMA_VERSION,
  decodeProjectLayers,
  mergeWorldContent,
  type ProjectLayers,
};

/** Lock expiry: 30 minutes */
const LOCK_EXPIRY_MS = 30 * 60 * 1000;

export class WorldProjectService {
  // ==================== CRUD ====================

  async create(data: {
    teamId: string;
    gameId: string;
    name: string;
    description?: string;
    /**
     * Typed project layers. New writes should populate these.
     * `worldData` legacy blob is computed from the layers for
     * backwards-read compatibility during the deprecation window.
     */
    config?: Record<string, unknown> | null;
    plugins?: ReadonlyArray<string>;
    /** AP1: asset packs the project installs at create time. */
    assetPacks?: ReadonlyArray<string>;
    worldContent?: Record<string, unknown>;
    templateId?: string;
    /**
     * @deprecated B0'.A — pass typed layers instead. When supplied,
     * this is written to the legacy `world_data` column verbatim and
     * the typed columns are derived from it via the same decode
     * rules the migration uses. Useful only for compatibility with
     * callers that haven't migrated yet.
     */
    worldData?: Record<string, unknown>;
    createdBy: string;
  }): Promise<WorldProject | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    // Resolve typed layers. If caller supplies them, use as-is.
    // If caller supplies legacy `worldData`, derive typed layers
    // from it. If neither is supplied, default to a blank project
    // shape.
    const resolved = resolveLayersFromCreateInput(data);

    const [project] = await db
      .insert(worldProjects)
      .values({
        teamId: data.teamId,
        gameId: data.gameId,
        name: data.name,
        description: data.description ?? null,
        schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
        config: resolved.config,
        plugins: [...resolved.plugins],
        assetPacks: [...resolved.assetPacks],
        worldContent: resolved.worldContent,
        templateId: resolved.templateId,
        // Legacy blob — keep populated until 0008_drop_world_data
        // migration. Synthesizes the legacy shape from typed layers
        // for read-back compatibility on tools that still consume
        // `worldData`.
        worldData: data.worldData ?? synthLegacyBlob(resolved),
        createdBy: data.createdBy,
      })
      .returning();

    return project;
  }

  async list(
    teamId: string,
    gameId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<WorldProject[]> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    return db
      .select()
      .from(worldProjects)
      .where(
        and(eq(worldProjects.teamId, teamId), eq(worldProjects.gameId, gameId)),
      )
      .orderBy(desc(worldProjects.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  async getById(projectId: string): Promise<WorldProject | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [project] = await db
      .select()
      .from(worldProjects)
      .where(eq(worldProjects.id, projectId))
      .limit(1);

    return project ?? null;
  }

  /**
   * Save (update) a world project.
   * Increments version, checks optimistic lock, updates timestamp.
   *
   * Accepts typed project layers (`config`, `plugins`, `worldContent`,
   * `templateId`) and/or the legacy `worldData` blob. When both are
   * supplied, typed layers win and `worldData` is overwritten with a
   * synthesized legacy shape for read-back compatibility.
   */
  async save(
    projectId: string,
    data: {
      name?: string;
      description?: string;
      // Typed project layers (B0'.A).
      config?: Record<string, unknown> | null;
      plugins?: ReadonlyArray<string>;
      worldContent?: Record<string, unknown>;
      templateId?: string | null;
      /**
       * @deprecated B0'.A. Pass typed layers instead. Still
       * accepted for compatibility; mapped through the decode
       * rules.
       */
      worldData?: Record<string, unknown>;
    },
    userId: string,
  ): Promise<WorldProject | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    // Check lock
    const existing = await this.getById(projectId);
    if (!existing) return null;

    if (existing.lockedBy && existing.lockedBy !== userId) {
      // Check if lock expired
      if (existing.lockedAt) {
        const lockAge = Date.now() - new Date(existing.lockedAt).getTime();
        if (lockAge < LOCK_EXPIRY_MS) {
          throw new Error(
            `Project is locked by another user. Lock expires in ${Math.ceil((LOCK_EXPIRY_MS - lockAge) / 60000)} minutes.`,
          );
        }
      }
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      version: sql`${worldProjects.version} + 1`,
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;

    // Typed layer updates: each field is independently patchable.
    if (data.config !== undefined) updates.config = data.config;
    if (data.plugins !== undefined) updates.plugins = [...data.plugins];
    if (data.worldContent !== undefined)
      updates.worldContent = data.worldContent;
    if (data.templateId !== undefined) updates.templateId = data.templateId;

    // Legacy worldData write — synthesize from the post-update
    // typed layer view so read-fallback consumers stay consistent
    // with the typed columns.
    const typedLayersTouched =
      data.config !== undefined ||
      data.plugins !== undefined ||
      data.worldContent !== undefined ||
      data.templateId !== undefined;
    if (data.worldData !== undefined) {
      updates.worldData = data.worldData;
    } else if (typedLayersTouched) {
      const merged = decodeProjectLayers({
        ...existing,
        config:
          data.config !== undefined
            ? (data.config as WorldProject["config"])
            : existing.config,
        plugins:
          data.plugins !== undefined ? [...data.plugins] : existing.plugins,
        worldContent:
          data.worldContent !== undefined
            ? (data.worldContent as WorldProject["worldContent"])
            : existing.worldContent,
        templateId:
          data.templateId !== undefined ? data.templateId : existing.templateId,
      });
      updates.worldData = synthLegacyBlob(merged);
    }

    const [updated] = await db
      .update(worldProjects)
      .set(updates)
      .where(eq(worldProjects.id, projectId))
      .returning();

    return updated ?? null;
  }

  async delete(projectId: string): Promise<boolean> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return false;

    const result = await db
      .delete(worldProjects)
      .where(eq(worldProjects.id, projectId));

    return (result?.rowCount ?? 0) > 0;
  }

  // ==================== Locking ====================

  async acquireLock(
    projectId: string,
    userId: string,
  ): Promise<{ success: boolean; lockedBy?: string }> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return { success: false };

    const project = await this.getById(projectId);
    if (!project) return { success: false };

    // Already locked by this user
    if (project.lockedBy === userId) {
      // Refresh lock timestamp
      await db
        .update(worldProjects)
        .set({ lockedAt: new Date() })
        .where(eq(worldProjects.id, projectId));
      return { success: true };
    }

    // Locked by someone else — check expiry
    if (project.lockedBy && project.lockedAt) {
      const lockAge = Date.now() - new Date(project.lockedAt).getTime();
      if (lockAge < LOCK_EXPIRY_MS) {
        return { success: false, lockedBy: project.lockedBy };
      }
    }

    // Acquire lock
    await db
      .update(worldProjects)
      .set({ lockedBy: userId, lockedAt: new Date() })
      .where(eq(worldProjects.id, projectId));

    return { success: true };
  }

  async releaseLock(projectId: string, userId: string): Promise<boolean> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return false;

    const project = await this.getById(projectId);
    if (!project) return false;

    // Only the lock holder (or expired lock) can release
    if (project.lockedBy && project.lockedBy !== userId) {
      if (project.lockedAt) {
        const lockAge = Date.now() - new Date(project.lockedAt).getTime();
        if (lockAge < LOCK_EXPIRY_MS) return false;
      }
    }

    await db
      .update(worldProjects)
      .set({ lockedBy: null, lockedAt: null })
      .where(eq(worldProjects.id, projectId));

    return true;
  }

  // ==================== Snapshots ====================

  /**
   * Create a manifest snapshot on the project (saves current manifests state).
   */
  async createSnapshot(
    projectId: string,
    manifestSnapshot: Record<string, unknown>,
  ): Promise<WorldProject | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [updated] = await db
      .update(worldProjects)
      .set({
        manifestSnapshot,
        updatedAt: new Date(),
      })
      .where(eq(worldProjects.id, projectId))
      .returning();

    return updated ?? null;
  }

  // ==================== Deployments ====================

  async createDeployment(data: {
    projectId: string;
    gameId: string;
    target: "staging" | "production";
    version: number;
    manifestDiff?: Record<string, unknown>;
    assetDiff?: Record<string, unknown>;
    deployedBy: string;
    approvedBy?: string;
    rollbackData?: Record<string, unknown>;
  }): Promise<WorldDeployment | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [deployment] = await db
      .insert(worldDeployments)
      .values({
        projectId: data.projectId,
        gameId: data.gameId,
        target: data.target,
        version: data.version,
        manifestDiff: data.manifestDiff ?? null,
        assetDiff: data.assetDiff ?? null,
        deployedBy: data.deployedBy,
        approvedBy: data.approvedBy ?? null,
        rollbackData: data.rollbackData ?? null,
      })
      .returning();

    return deployment;
  }

  async getDeployments(
    projectId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<WorldDeployment[]> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;

    return db
      .select()
      .from(worldDeployments)
      .where(eq(worldDeployments.projectId, projectId))
      .orderBy(desc(worldDeployments.deployedAt))
      .limit(limit)
      .offset(offset);
  }

  async getLatestDeployment(
    gameId: string,
    target: "staging" | "production",
  ): Promise<WorldDeployment | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [deployment] = await db
      .select()
      .from(worldDeployments)
      .where(
        and(
          eq(worldDeployments.gameId, gameId),
          eq(worldDeployments.target, target),
        ),
      )
      .orderBy(desc(worldDeployments.deployedAt))
      .limit(1);

    return deployment ?? null;
  }

  // ==================== Phase B0'.G — World Content Patch ====================

  /**
   * Merge a partial `worldContent` into the project. Used by agent
   * actions (PROPOSE_NPC_PLACEMENT, etc.) so the agent's authored
   * additions persist into the project, not just into editor-local
   * memory.
   *
   * Merge semantics:
   *   - Top-level keys in the patch overlay onto the existing
   *     `worldContent`. e.g. patching `{ npcs: [...] }` replaces
   *     the npcs array entirely; other keys (zones, quests, etc.)
   *     are untouched.
   *   - Pass `null` for a key to remove it (e.g. `{ uiPack: null }`
   *     clears the agent's UI pack).
   *
   * Returns the updated project row, or null on lock/permission
   * failure. Increments `version` like other writes so concurrent
   * editors see the change.
   */
  async patchWorldContent(
    projectId: string,
    patch: Record<string, unknown>,
    userId: string,
  ): Promise<WorldProject | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const existing = await this.getById(projectId);
    if (!existing) return null;

    if (existing.lockedBy && existing.lockedBy !== userId) {
      if (existing.lockedAt) {
        const lockAge = Date.now() - new Date(existing.lockedAt).getTime();
        if (lockAge < LOCK_EXPIRY_MS) {
          throw new Error(
            `Project is locked by another user. Lock expires in ${Math.ceil((LOCK_EXPIRY_MS - lockAge) / 60000)} minutes.`,
          );
        }
      }
    }

    const currentContent =
      (existing.worldContent as Record<string, unknown>) ?? {};
    const merged = mergeWorldContent(currentContent, patch);

    // G1 — snapshot the BEFORE state into the revision history.
    // Best-effort: a failed snapshot doesn't block the patch (we
    // log + continue). Patch atomicity matters more than audit.
    try {
      await db.insert(worldProjectRevisions).values({
        projectId: existing.id,
        version: existing.version,
        author: "agent",
        authorId: userId,
        changeReason: this.summarizePatch(patch),
        schemaVersion: existing.schemaVersion ?? 1,
        config: existing.config,
        plugins: existing.plugins,
        worldContent: existing.worldContent,
        templateId: existing.templateId,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[WorldProjectService] revision snapshot failed (non-fatal):",
        err,
      );
    }

    const [updated] = await db
      .update(worldProjects)
      .set({
        worldContent: merged,
        version: sql`${worldProjects.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(worldProjects.id, projectId))
      .returning();

    return updated ?? null;
  }

  /**
   * AP3 — replace the project's asset-packs list. Snapshots the
   * BEFORE state into the revision history (consistent with
   * patchWorldContent / restore semantics) and bumps version.
   *
   * Returns the updated project, or null on lock/permission
   * failure. Validates that the caller is a team member upstream
   * (the route handler does that); this method is the
   * mutate-and-persist primitive.
   */
  async setAssetPacks(
    projectId: string,
    assetPacks: ReadonlyArray<string>,
    userId: string,
  ): Promise<WorldProject | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const existing = await this.getById(projectId);
    if (!existing) return null;

    if (existing.lockedBy && existing.lockedBy !== userId) {
      if (existing.lockedAt) {
        const lockAge = Date.now() - new Date(existing.lockedAt).getTime();
        if (lockAge < LOCK_EXPIRY_MS) {
          throw new Error(
            `Project is locked by another user. Lock expires in ${Math.ceil((LOCK_EXPIRY_MS - lockAge) / 60000)} minutes.`,
          );
        }
      }
    }

    // Snapshot BEFORE state into revision history (best-effort).
    try {
      await db.insert(worldProjectRevisions).values({
        projectId: existing.id,
        version: existing.version,
        author: "user",
        authorId: userId,
        changeReason: `set assetPacks: [${assetPacks.join(", ") || "(empty)"}]`,
        schemaVersion: existing.schemaVersion ?? 1,
        config: existing.config,
        plugins: existing.plugins,
        worldContent: existing.worldContent,
        templateId: existing.templateId,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[WorldProjectService] revision snapshot failed (non-fatal):",
        err,
      );
    }

    const [updated] = await db
      .update(worldProjects)
      .set({
        assetPacks: [...assetPacks],
        version: sql`${worldProjects.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(worldProjects.id, projectId))
      .returning();

    return updated ?? null;
  }

  /**
   * G1 — list revision history for a project, newest first.
   * `limit` defaults to 50, `offset` to 0.
   */
  async listRevisions(
    projectId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<ReadonlyArray<WorldProjectRevision>> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);
    return db
      .select()
      .from(worldProjectRevisions)
      .where(eq(worldProjectRevisions.projectId, projectId))
      .orderBy(desc(worldProjectRevisions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * G1.b — restore a project to a prior revision's snapshot.
   *
   * The current project state is snapshotted into a new revision
   * BEFORE the restore (so restore itself is reversible — undo the
   * undo). The revision being restored becomes the new project
   * state; version bumps by one.
   *
   * Author defaults to `"user"` since the restore endpoint is
   * gated by team membership; the agent doesn't currently have a
   * restore action (would need its own audit trail field if added).
   *
   * Returns the updated project, or `null` when project / revision
   * lookup fails.
   */
  async restoreRevision(
    projectId: string,
    revisionId: string,
    userId: string,
  ): Promise<WorldProject | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const existing = await this.getById(projectId);
    if (!existing) return null;

    if (existing.lockedBy && existing.lockedBy !== userId) {
      if (existing.lockedAt) {
        const lockAge = Date.now() - new Date(existing.lockedAt).getTime();
        if (lockAge < LOCK_EXPIRY_MS) {
          throw new Error(
            `Project is locked by another user. Lock expires in ${Math.ceil((LOCK_EXPIRY_MS - lockAge) / 60000)} minutes.`,
          );
        }
      }
    }

    const [revision] = await db
      .select()
      .from(worldProjectRevisions)
      .where(
        and(
          eq(worldProjectRevisions.id, revisionId),
          eq(worldProjectRevisions.projectId, projectId),
        ),
      )
      .limit(1);
    if (!revision) return null;

    // Capture the BEFORE state so restore is reversible.
    try {
      await db.insert(worldProjectRevisions).values({
        projectId: existing.id,
        version: existing.version,
        author: "user",
        authorId: userId,
        changeReason: `restore from revision ${revisionId.slice(0, 8)}`,
        schemaVersion: existing.schemaVersion ?? 1,
        config: existing.config,
        plugins: existing.plugins,
        worldContent: existing.worldContent,
        templateId: existing.templateId,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[WorldProjectService] pre-restore snapshot failed (non-fatal):",
        err,
      );
    }

    const [updated] = await db
      .update(worldProjects)
      .set({
        schemaVersion: revision.schemaVersion,
        config: revision.config,
        plugins: revision.plugins,
        worldContent: revision.worldContent,
        templateId: revision.templateId,
        version: sql`${worldProjects.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(worldProjects.id, projectId))
      .returning();

    return updated ?? null;
  }

  /**
   * Compose a one-line human label for the patch — surfaces in the
   * revision list ("patch worldContent: npcs, mobSpawns").
   */
  private summarizePatch(patch: Record<string, unknown>): string {
    const keys = Object.keys(patch);
    if (keys.length === 0) return "patch (empty)";
    return `patch worldContent: ${keys.join(", ")}`;
  }
}
