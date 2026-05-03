/**
 * ProjectPackService — fork an entire game from a project pack.
 *
 * Phase E of `PLAN_AAA_CONTENT_SYSTEM.md`. A `ProjectPackManifest`
 * bundles references to gameplay plugins + content packs + an
 * optional `initialConfig` (procgen knobs) + an optional
 * `initialWorldContent` snapshot (NPCs, mob spawns, zones,
 * quests, UI pack overrides). The fork action reads this
 * manifest and creates a fully-configured project in one
 * server round-trip — the AAA marketplace pinnacle.
 *
 * Pattern matches UE5 "Create Project From Template" and
 * Unity's template-based new-project flow:
 *
 *   - User browses project packs in the marketplace
 *   - Clicks "Fork Hyperia" (or any other project pack)
 *   - One POST → new project row exists with the right
 *     plugins / content packs / config / authored content
 *   - Open project → world is already populated
 *
 * The actual fork is a single transaction:
 *
 *   1. Resolve ProjectPackManifest by id (from `asset_packs`,
 *      same table holds project packs since Phase A unified)
 *   2. Create world_projects row with:
 *        plugins      = pluginIds from manifest
 *        assetPacks   = contentPackIds from manifest
 *        config       = initialConfig (or null if absent)
 *        worldContent = initialWorldContent (or {} if absent)
 *        templateId   = the project pack id
 *   3. Return the new project record
 *
 * Soft-fails per-step preserved so a partial fork (e.g. missing
 * plugin id) still produces a usable project — the caller logs
 * the warning and the user can fix up via the studio's normal
 * install / config flow.
 */

import { eq } from "drizzle-orm";
import {
  validateProjectPackManifest,
  type ProjectPackManifest,
} from "@hyperforge/manifest-schema";
import { getDb, isDatabaseEnabled } from "../db/db";
import { assetPacks } from "../db/schema";
import type { WorldProject } from "../db/schema";
import type { WorldProjectService } from "./WorldProjectService";

export interface ForkProjectPackInput {
  /** Manifest id of the ProjectPack to fork (e.g. `@hyperforge/project-pack-hyperia-v1`). */
  projectPackId: string;
  /** Team that owns the new project. */
  teamId: string;
  /** Game record the new project belongs to. */
  gameId: string;
  /** Display name for the new project. Defaults to the pack's `name`. */
  name?: string;
  /** Optional description override. */
  description?: string | null;
  /** User id of the creator. */
  createdBy: string;
}

export type ForkProjectPackResult =
  | { ok: true; project: WorldProject; manifest: ProjectPackManifest }
  | {
      ok: false;
      reason:
        | "pack-not-found"
        | "pack-invalid"
        | "db-unavailable"
        | "create-failed";
      message: string;
    };

export class ProjectPackService {
  constructor(private readonly worldProjectService: WorldProjectService) {}

  /**
   * Fork a project pack into a new world project. Idempotent
   * only by manifest_id check — re-running with the same input
   * creates a NEW project (every fork is its own world). The
   * caller is responsible for guarding against accidental
   * double-clicks (UI loading state on the fork button).
   */
  async fork(input: ForkProjectPackInput): Promise<ForkProjectPackResult> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) {
      return {
        ok: false,
        reason: "db-unavailable",
        message: "Database is not configured.",
      };
    }

    // Resolve the project pack manifest by id. Project packs
    // live in the same `asset_packs` table as content packs
    // (Phase A unified the storage); the manifest's `version`
    // field discriminates — ProjectPackManifestSchema validates
    // by parsing the JSON.
    const [row] = await db
      .select()
      .from(assetPacks)
      .where(eq(assetPacks.manifestId, input.projectPackId))
      .limit(1);
    if (!row) {
      return {
        ok: false,
        reason: "pack-not-found",
        message: `Project pack "${input.projectPackId}" not found in catalog. Run the bootstrap or seeder, or browse the marketplace for an installed pack.`,
      };
    }

    // Reject fork attempts on non-project-pack ids. The
    // ProjectPack schema overlaps with ContentPack on the
    // shared header (`PackHeaderShape`), and all
    // ProjectPack-specific fields have defaults — so a content
    // pack manifest passes Zod parse as a (degenerate) project
    // pack. The id-prefix check is the practical guard: any
    // pack authored as a project pack uses the canonical
    // `@hyperforge/project-pack-*` convention.
    if (
      input.projectPackId.startsWith("@hyperforge/content-pack-") ||
      input.projectPackId.startsWith("@hyperforge/asset-pack-")
    ) {
      return {
        ok: false,
        reason: "pack-invalid",
        message: `"${input.projectPackId}" is a content / asset pack, not a project pack. Project packs ship under the @hyperforge/project-pack-* prefix and bundle plugins + content packs + initial config. Install this pack on an existing project instead, or browse for a project pack to fork.`,
      };
    }

    // Validate the manifest. Same Zod-discriminated parse used
    // by tooling — surfaces structured issues if the manifest
    // is malformed.
    const validation = validateProjectPackManifest(row.manifest);
    if (!validation.ok || !validation.manifest) {
      const issueDetail = (validation.issues ?? [])
        .map((i) => `${i.path}: ${i.message}`)
        .join("; ");
      return {
        ok: false,
        reason: "pack-invalid",
        message: `Project pack "${input.projectPackId}" has an invalid manifest. ${issueDetail}`,
      };
    }
    const manifest = validation.manifest;

    // Compose the new project's typed-layer state from the
    // manifest. Plugins + content packs flow through to the
    // project's `plugins` and `assetPacks` columns; initial
    // config (procgen knobs) and initialWorldContent (NPCs /
    // mob spawns / quests / etc.) land on the matching
    // columns when present.
    const project = await this.worldProjectService.create({
      teamId: input.teamId,
      gameId: input.gameId,
      name: input.name ?? manifest.name,
      description: input.description ?? manifest.description ?? undefined,
      // Procgen + project config from manifest, or null to
      // accept the create's defaults.
      config:
        (manifest.initialConfig as
          | Record<string, unknown>
          | null
          | undefined) ?? null,
      plugins: manifest.pluginIds,
      assetPacks: manifest.contentPackIds,
      worldContent:
        (manifest.initialWorldContent as Record<string, unknown> | undefined) ??
        undefined,
      templateId: manifest.id,
      createdBy: input.createdBy,
    });

    if (!project) {
      return {
        ok: false,
        reason: "create-failed",
        message: `Project pack "${input.projectPackId}" resolved + validated, but the database create returned null. Check server logs for the underlying SQL error.`,
      };
    }

    return { ok: true, project, manifest };
  }

  /**
   * List every project pack available to fork. Filters
   * `asset_packs` rows whose manifest validates against
   * `ProjectPackManifestSchema` — that's how project packs and
   * content packs share the table without colliding (a
   * ProjectPackManifest has `pluginIds` + `contentPackIds`,
   * never `assets` / `biomes` / etc.).
   *
   * Built-in project packs land via the same bootstrap path as
   * content packs (`server/builtins/`). Marketplace listings
   * (visibility="public") show up here automatically.
   */
  async listForkable(): Promise<
    Array<{
      manifestId: string;
      manifest: ProjectPackManifest;
      visibility: string;
      teamId: string | null;
    }>
  > {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    // Read every pack row; filter to project packs by id
    // prefix. Project pack ids follow the canonical
    // `@hyperforge/project-pack-*` convention (mirrored by
    // content packs at `@hyperforge/content-pack-*`). Filtering
    // by id prefix is more reliable than schema-shape inference
    // — Zod's permissive parse would accept a content pack as a
    // (degenerate) project pack since both share the
    // PackHeaderShape and project-pack fields default to empty
    // arrays.
    const rows = await db.select().from(assetPacks);
    const out: Array<{
      manifestId: string;
      manifest: ProjectPackManifest;
      visibility: string;
      teamId: string | null;
    }> = [];
    for (const row of rows) {
      if (!row.manifestId.startsWith("@hyperforge/project-pack-")) continue;
      const v = validateProjectPackManifest(row.manifest);
      if (!v.ok || !v.manifest) continue;
      out.push({
        manifestId: row.manifestId,
        manifest: v.manifest,
        visibility: row.visibility,
        teamId: row.teamId,
      });
    }
    return out;
  }
}
