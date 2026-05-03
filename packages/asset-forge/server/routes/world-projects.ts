/**
 * World Project Routes — CRUD + lock/unlock/snapshot for world projects
 * All routes require authentication and team membership with appropriate permissions.
 */

import { Elysia, t } from "elysia";
import { authDerive, requireAuthGuard } from "../middleware/auth";
import { TeamService } from "../services/TeamService";
import { WorldProjectService } from "../services/WorldProjectService";
import { AuditLogService } from "../services/AuditLogService";
import * as WS from "../models/world-studio.models";
import * as Models from "../models";
import { validateEmbeddedGraphs } from "../utils/scriptGraphValidator";

export const createWorldProjectRoutes = (
  teamService: TeamService,
  worldProjectService: WorldProjectService,
  auditLogService: AuditLogService,
) => {
  return new Elysia({
    prefix: "/api/world/projects",
    name: "world-project-routes",
  })
    .derive(authDerive)
    .guard({ beforeHandle: [requireAuthGuard] }, (app) =>
      app
        // ==================== CRUD ====================

        .post(
          "/",
          async ({ auth, body, set }) => {
            const user = auth.user!;

            // Resolve team from game
            const game = await teamService.getGame(body.gameId);
            if (!game) {
              set.status = 404;
              return { error: "Game not found" };
            }

            const hasPermission = await teamService.hasPermission(
              game.teamId,
              user.id,
              "project:create",
            );
            if (!hasPermission) {
              set.status = 403;
              return { error: "project:create permission required" };
            }

            // Phase E of `PLAN_AAA_CONTENT_SYSTEM.md` consolidated
            // the "create from template" path. ProjectPackService
            // (POST /api/project-packs/fork) handles the AAA
            // "fork an entire game" flow — plugins + content
            // packs + initial config + worldContent from a
            // ProjectPackManifest. This route's `templateId`
            // field stays as a marker on the project record (so
            // analytics / project listing know the source) but
            // doesn't trigger any clone-from-template behavior.
            // Pre-Phase-E callers passing `templateId: "blank"`
            // continue to work — the "blank" string just lands
            // on the column verbatim.

            const project = await worldProjectService.create({
              teamId: game.teamId,
              gameId: body.gameId,
              name: body.name,
              description: body.description,
              ...(body.templateId
                ? {
                    templateId: body.templateId,
                  }
                : {}),
              ...(body.worldData
                ? { worldData: body.worldData as Record<string, unknown> }
                : {}),
              createdBy: user.id,
            });

            if (!project) {
              set.status = 500;
              return { error: "Failed to create project" };
            }

            await auditLogService.log({
              teamId: game.teamId,
              gameId: body.gameId,
              userId: user.id,
              action: "project:create",
              targetType: "project",
              targetId: project.id,
            });

            return formatProjectResponse(project);
          },
          {
            body: WS.CreateWorldProjectBody,
            response: {
              200: WS.WorldProjectResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
              500: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Create a new world project",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        .get(
          "/",
          async ({ auth, query, set }) => {
            const user = auth.user!;
            const { teamId, gameId, limit, offset } = query;

            if (!teamId || !gameId) {
              set.status = 400;
              return { error: "teamId and gameId query params required" };
            }

            const role = await teamService.getMemberRole(teamId, user.id);
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            const parsedLimit = limit
              ? Math.min(Math.max(parseInt(limit) || 50, 1), 100)
              : 50;
            const parsedOffset = offset
              ? Math.max(parseInt(offset) || 0, 0)
              : 0;

            const projects = await worldProjectService.list(teamId, gameId, {
              limit: parsedLimit,
              offset: parsedOffset,
            });

            return projects.map(formatProjectResponse);
          },
          {
            query: t.Object({
              teamId: t.String(),
              gameId: t.String(),
              limit: t.Optional(t.String()),
              offset: t.Optional(t.String()),
            }),
            response: {
              200: WS.WorldProjectListResponse,
              400: Models.ErrorResponse,
              403: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "List world projects for a team + game",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        .get(
          "/:projectId",
          async ({ auth, params: { projectId }, set }) => {
            const user = auth.user!;

            const project = await worldProjectService.getById(projectId);
            if (!project) {
              set.status = 404;
              return { error: "Project not found" };
            }

            const role = await teamService.getMemberRole(
              project.teamId,
              user.id,
            );
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            return {
              ...formatProjectResponse(project),
              config: project.config as Record<string, unknown> | null,
              worldContent:
                (project.worldContent as Record<string, unknown>) ?? {},
              worldData: project.worldData,
              manifestSnapshot: project.manifestSnapshot,
            };
          },
          {
            params: t.Object({ projectId: t.String() }),
            response: {
              200: WS.WorldProjectDetailResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Get full world project with data",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        .put(
          "/:projectId",
          async ({ auth, params: { projectId }, body, set }) => {
            const user = auth.user!;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }

            const hasPermission = await teamService.hasPermission(
              existing.teamId,
              user.id,
              "project:edit",
            );
            if (!hasPermission) {
              set.status = 403;
              return { error: "project:edit permission required" };
            }

            // Validate any embedded behaviorGraph objects before persisting
            if (body.worldData) {
              const graphValidation = validateEmbeddedGraphs(body.worldData);
              if (!graphValidation.valid) {
                set.status = 400;
                return {
                  error: `Invalid behavior graph: ${graphValidation.errors[0]}`,
                };
              }
            }

            try {
              const project = await worldProjectService.save(
                projectId,
                {
                  name: body.name,
                  description: body.description,
                  worldData: body.worldData as
                    | Record<string, unknown>
                    | undefined,
                },
                user.id,
              );

              if (!project) {
                set.status = 500;
                return { error: "Failed to save project" };
              }

              await auditLogService.log({
                teamId: existing.teamId,
                gameId: existing.gameId,
                userId: user.id,
                action: "project:save",
                targetType: "project",
                targetId: projectId,
                details: { version: project.version },
              });

              return formatProjectResponse(project);
            } catch (error) {
              if (error instanceof Error && error.message.includes("locked")) {
                set.status = 409;
                return { error: error.message };
              }
              throw error;
            }
          },
          {
            params: t.Object({ projectId: t.String() }),
            body: WS.UpdateWorldProjectBody,
            response: {
              200: WS.WorldProjectResponse,
              400: Models.ErrorResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
              409: Models.ErrorResponse,
              500: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Save world project (increments version)",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        .delete(
          "/:projectId",
          async ({ auth, params: { projectId }, set }) => {
            const user = auth.user!;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }

            const hasPermission = await teamService.hasPermission(
              existing.teamId,
              user.id,
              "project:delete",
            );
            if (!hasPermission) {
              set.status = 403;
              return { error: "project:delete permission required" };
            }

            await worldProjectService.delete(projectId);

            await auditLogService.log({
              teamId: existing.teamId,
              gameId: existing.gameId,
              userId: user.id,
              action: "project:delete",
              targetType: "project",
              targetId: projectId,
            });

            return { success: true, message: "Project deleted" };
          },
          {
            params: t.Object({ projectId: t.String() }),
            response: {
              200: Models.SuccessResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Delete a world project",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ==================== Lock / Unlock ====================

        .post(
          "/:projectId/lock",
          async ({ auth, params: { projectId }, set }) => {
            const user = auth.user!;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }

            const role = await teamService.getMemberRole(
              existing.teamId,
              user.id,
            );
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            const result = await worldProjectService.acquireLock(
              projectId,
              user.id,
            );
            if (!result.success) {
              set.status = 409;
              return {
                error: `Project is locked by another user: ${result.lockedBy}`,
              };
            }

            return { success: true, message: "Lock acquired" };
          },
          {
            params: t.Object({ projectId: t.String() }),
            response: {
              200: Models.SuccessResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
              409: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Acquire edit lock",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        .post(
          "/:projectId/unlock",
          async ({ auth, params: { projectId }, set }) => {
            const user = auth.user!;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }

            const released = await worldProjectService.releaseLock(
              projectId,
              user.id,
            );
            if (!released) {
              set.status = 409;
              return { error: "Cannot release lock — held by another user" };
            }

            return { success: true, message: "Lock released" };
          },
          {
            params: t.Object({ projectId: t.String() }),
            response: {
              200: Models.SuccessResponse,
              404: Models.ErrorResponse,
              409: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Release edit lock",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ==================== Snapshot ====================

        .post(
          "/:projectId/snapshot",
          async ({ auth, params: { projectId }, body, set }) => {
            const user = auth.user!;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }

            const hasPermission = await teamService.hasPermission(
              existing.teamId,
              user.id,
              "project:edit",
            );
            if (!hasPermission) {
              set.status = 403;
              return { error: "project:edit permission required" };
            }

            // Validate any embedded behaviorGraph objects in manifest snapshot
            const graphValidation = validateEmbeddedGraphs(
              body.manifestSnapshot,
            );
            if (!graphValidation.valid) {
              set.status = 400;
              return {
                error: `Invalid behavior graph in manifest: ${graphValidation.errors[0]}`,
              };
            }

            const project = await worldProjectService.createSnapshot(
              projectId,
              body.manifestSnapshot as Record<string, unknown>,
            );
            if (!project) {
              set.status = 500;
              return { error: "Failed to create snapshot" };
            }

            await auditLogService.log({
              teamId: existing.teamId,
              gameId: existing.gameId,
              userId: user.id,
              action: "project:snapshot",
              targetType: "project",
              targetId: projectId,
            });

            return formatProjectResponse(project);
          },
          {
            params: t.Object({ projectId: t.String() }),
            body: t.Object({
              manifestSnapshot: t.Record(t.String(), t.Unknown()),
            }),
            response: {
              200: WS.WorldProjectResponse,
              400: Models.ErrorResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
              500: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Create manifest snapshot",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ──────── Phase G1 — Revision History ────────
        .get(
          "/:projectId/revisions",
          async ({ auth, params, query, set }) => {
            const user = auth.user!;
            const { projectId } = params;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }
            const role = await teamService.getMemberRole(
              existing.teamId,
              user.id,
            );
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            const limit = query?.limit ? Number(query.limit) : undefined;
            const offset = query?.offset ? Number(query.offset) : undefined;
            const rows = await worldProjectService.listRevisions(projectId, {
              limit,
              offset,
            });
            return rows.map((r) => ({
              id: r.id,
              projectId: r.projectId,
              version: r.version,
              author: r.author,
              authorId: r.authorId ?? null,
              changeReason: r.changeReason ?? null,
              schemaVersion: r.schemaVersion,
              config: r.config ?? null,
              plugins: r.plugins,
              worldContent: r.worldContent ?? {},
              templateId: r.templateId ?? null,
              createdAt: r.createdAt.toISOString(),
            }));
          },
          {
            params: t.Object({ projectId: t.String() }),
            query: t.Optional(
              t.Object({
                limit: t.Optional(t.String()),
                offset: t.Optional(t.String()),
              }),
            ),
            response: {
              200: WS.WorldProjectRevisionListResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "List project revision history (G1)",
              description:
                "Returns project revisions newest first. Each revision is the BEFORE state captured before a write — use `version` to reconstruct history. Optional `limit` (1-200, default 50) and `offset`.",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ──────── Phase G1.b — Restore Revision ────────
        .post(
          "/:projectId/revisions/:revisionId/restore",
          async ({ auth, params, set }) => {
            const user = auth.user!;
            const { projectId, revisionId } = params;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }
            const role = await teamService.getMemberRole(
              existing.teamId,
              user.id,
            );
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            try {
              const project = await worldProjectService.restoreRevision(
                projectId,
                revisionId,
                user.id,
              );
              if (!project) {
                set.status = 404;
                return { error: "Revision not found" };
              }

              await auditLogService.log({
                teamId: existing.teamId,
                gameId: existing.gameId,
                userId: user.id,
                action: "project:revision:restore",
                targetType: "project",
                targetId: projectId,
              });

              return formatProjectResponse(project);
            } catch (err) {
              if (err instanceof Error && err.message.includes("locked by")) {
                set.status = 409;
                return { error: err.message };
              }
              throw err;
            }
          },
          {
            params: t.Object({
              projectId: t.String(),
              revisionId: t.String(),
            }),
            response: {
              200: WS.WorldProjectResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
              409: Models.ErrorResponse,
              500: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Restore project to a prior revision (G1.b)",
              description:
                "Writes the revision's snapshot back into the project. Captures the current state as a new revision first so restore itself is reversible. Bumps the project version.",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ──────── Phase AP3 — Asset Packs ────────
        .post(
          "/:projectId/asset-packs",
          async ({ auth, params, body, set }) => {
            const user = auth.user!;
            const { projectId } = params;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }
            const role = await teamService.getMemberRole(
              existing.teamId,
              user.id,
            );
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            try {
              const project = await worldProjectService.setAssetPacks(
                projectId,
                body.assetPacks,
                user.id,
              );
              if (!project) {
                set.status = 500;
                return { error: "Failed to set asset packs" };
              }

              await auditLogService.log({
                teamId: existing.teamId,
                gameId: existing.gameId,
                userId: user.id,
                action: "project:asset-packs:set",
                targetType: "project",
                targetId: projectId,
              });

              return formatProjectResponse(project);
            } catch (err) {
              if (err instanceof Error && err.message.includes("locked by")) {
                set.status = 409;
                return { error: err.message };
              }
              throw err;
            }
          },
          {
            params: t.Object({ projectId: t.String() }),
            body: t.Object({
              /**
               * Replacement asset-pack id list. Empty = blank
               * library (uninstall all). Each id must be an
               * `asset_packs.manifest_id`.
               */
              assetPacks: t.Array(t.String()),
            }),
            response: {
              200: WS.WorldProjectResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
              409: Models.ErrorResponse,
              500: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Replace project's installed asset packs (AP3)",
              description:
                "Set the project's `assetPacks` array. The studio's Asset Library shows the union of installed packs' catalogs.",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ──────── Replace project's plugin set ────────
        .post(
          "/:projectId/plugins",
          async ({ auth, params, body, set }) => {
            const user = auth.user!;
            const { projectId } = params;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }
            const role = await teamService.getMemberRole(
              existing.teamId,
              user.id,
            );
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            try {
              const project = await worldProjectService.setPlugins(
                projectId,
                body.plugins,
                user.id,
              );
              if (!project) {
                set.status = 500;
                return { error: "Failed to set plugins" };
              }

              await auditLogService.log({
                teamId: existing.teamId,
                gameId: existing.gameId,
                userId: user.id,
                action: "project:plugins:set",
                targetType: "project",
                targetId: projectId,
              });

              return formatProjectResponse(project);
            } catch (err) {
              if (err instanceof Error && err.message.includes("locked by")) {
                set.status = 409;
                return { error: err.message };
              }
              throw err;
            }
          },
          {
            params: t.Object({ projectId: t.String() }),
            body: t.Object({
              /**
               * Replacement plugin id list. Empty = no plugins
               * (the engine still boots, but no game-mode logic).
               * Each id is an npm-style package name like
               * `@hyperforge/hyperscape`.
               */
              plugins: t.Array(t.String()),
            }),
            response: {
              200: WS.WorldProjectResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
              409: Models.ErrorResponse,
              500: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Replace project's installed plugin set",
              description:
                "Set the project's `plugins` array. Used by the AI agent's PROPOSE_PLUGIN_SET action and by the studio's plugin browser.",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ──────── Phase B0'.G — World Content Patch ────────
        .post(
          "/:projectId/world-content",
          async ({ auth, params, body, set }) => {
            const user = auth.user!;
            const { projectId } = params;

            const existing = await worldProjectService.getById(projectId);
            if (!existing) {
              set.status = 404;
              return { error: "Project not found" };
            }

            const role = await teamService.getMemberRole(
              existing.teamId,
              user.id,
            );
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            try {
              const project = await worldProjectService.patchWorldContent(
                projectId,
                body.patch as Record<string, unknown>,
                user.id,
              );

              if (!project) {
                set.status = 500;
                return { error: "Failed to patch world content" };
              }

              await auditLogService.log({
                teamId: existing.teamId,
                gameId: existing.gameId,
                userId: user.id,
                action: "project:world-content:patch",
                targetType: "project",
                targetId: projectId,
              });

              return formatProjectResponse(project);
            } catch (err) {
              if (err instanceof Error && err.message.includes("locked by")) {
                set.status = 409;
                return { error: err.message };
              }
              throw err;
            }
          },
          {
            params: t.Object({ projectId: t.String() }),
            body: t.Object({
              /**
               * Partial `WorldContent` patch — npcs / zones /
               * spawns / quests / uiPack. Top-level keys overlay
               * onto the existing content; explicit `null` removes
               * a key.
               */
              patch: t.Record(t.String(), t.Unknown()),
            }),
            response: {
              200: WS.WorldProjectResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
              409: Models.ErrorResponse,
              500: Models.ErrorResponse,
            },
            detail: {
              tags: ["World Projects"],
              summary: "Patch project worldContent (B0'.G)",
              description:
                "Merge a partial WorldContent patch into the project. Used by agent actions (PROPOSE_NPC_PLACEMENT, etc.) to persist authored content. Top-level keys are replaced; null removes.",
              security: [{ BearerAuth: [] }],
            },
          },
        ),
    );
};

/**
 * Format a WorldProject row to the JSON-safe summary response.
 *
 * B0'.A: includes the typed-layer surface (`schemaVersion`,
 * `templateId`, `plugins`) on the summary so list views can show
 * template badges + filter by plugin set without needing the
 * detail endpoint.
 */
function formatProjectResponse(project: {
  id: string;
  teamId: string;
  gameId: string;
  name: string;
  description: string | null;
  version: number;
  createdBy: string | null;
  lockedBy: string | null;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion?: number;
  templateId?: string | null;
  plugins?: string[] | null;
  assetPacks?: string[] | null;
}) {
  return {
    id: project.id,
    teamId: project.teamId,
    gameId: project.gameId,
    name: project.name,
    description: project.description,
    version: project.version,
    createdBy: project.createdBy,
    lockedBy: project.lockedBy,
    lockedAt: project.lockedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    schemaVersion: project.schemaVersion ?? 1,
    templateId: project.templateId ?? null,
    plugins: project.plugins ?? [],
    assetPacks: project.assetPacks ?? [],
  };
}
