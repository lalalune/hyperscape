/**
 * Project Packs Routes
 *
 * Phase E of `PLAN_AAA_CONTENT_SYSTEM.md`. Surface the
 * `ProjectPackService` over HTTP so the studio (and CLI / API
 * clients) can browse forkable project packs and create new
 * projects from them in a single call — UE5 "Create Project
 * From Template" / Unity template-based new-project pattern.
 *
 * Endpoints:
 *   GET  /api/project-packs              — list every project pack
 *                                          (built-in + marketplace + team)
 *   POST /api/project-packs/fork         — fork one into a new project
 *
 * Both endpoints are auth-required. The fork action requires
 * the caller to be a member of the target team — checked via
 * `TeamService.getMemberRole`.
 */

import { Elysia, t } from "elysia";
import { authDerive, requireAuthGuard } from "../middleware/auth";
import type { ProjectPackService } from "../services/ProjectPackService";
import type { TeamService } from "../services/TeamService";

const ProjectPackResponse = t.Object({
  manifestId: t.String(),
  manifest: t.Unknown(),
  visibility: t.String(),
  teamId: t.Nullable(t.String()),
});

const ProjectPackListResponse = t.Array(ProjectPackResponse);

const ForkRequestBody = t.Object({
  projectPackId: t.String(),
  teamId: t.String(),
  gameId: t.String(),
  name: t.Optional(t.String()),
  description: t.Optional(t.Nullable(t.String())),
});

export const createProjectPackRoutes = (
  projectPackService: ProjectPackService,
  teamService: TeamService,
) => {
  return new Elysia({ prefix: "/api/project-packs", name: "project-packs" })
    .derive(authDerive)
    .guard({ beforeHandle: [requireAuthGuard] }, (app) =>
      app
        .get(
          "/",
          async () => {
            const packs = await projectPackService.listForkable();
            return packs.map((p) => ({
              manifestId: p.manifestId,
              manifest: p.manifest,
              visibility: p.visibility,
              teamId: p.teamId,
            }));
          },
          {
            response: { 200: ProjectPackListResponse },
            detail: {
              tags: ["Project Packs"],
              summary: "List forkable project packs",
              description:
                "Returns every pack whose id starts with @hyperforge/project-pack-* and validates against ProjectPackManifestSchema. Built-in project packs auto-bootstrap on server start; marketplace + team packs surface here automatically.",
              security: [{ BearerAuth: [] }],
            },
          },
        )
        .post(
          "/fork",
          async ({ auth, body, set }) => {
            const user = auth.user!;
            // Authorization: caller must be a member of the
            // target team. Server-side gate; clients can't
            // bypass via crafted requests.
            const role = await teamService.getMemberRole(body.teamId, user.id);
            if (!role) {
              set.status = 403;
              return {
                ok: false as const,
                reason: "not-a-team-member",
                message: `User is not a member of team "${body.teamId}".`,
              };
            }

            const result = await projectPackService.fork({
              projectPackId: body.projectPackId,
              teamId: body.teamId,
              gameId: body.gameId,
              name: body.name,
              description: body.description,
              createdBy: user.id,
            });

            if (!result.ok) {
              set.status =
                result.reason === "pack-not-found"
                  ? 404
                  : result.reason === "pack-invalid"
                    ? 400
                    : 500;
              return result;
            }

            return {
              ok: true as const,
              projectId: result.project.id,
              project: {
                id: result.project.id,
                teamId: result.project.teamId,
                gameId: result.project.gameId,
                name: result.project.name,
                description: result.project.description,
                templateId: result.project.templateId,
              },
              forkedFrom: result.manifest.id,
            };
          },
          {
            body: ForkRequestBody,
            detail: {
              tags: ["Project Packs"],
              summary: "Fork a project pack into a new project",
              description:
                "Creates a new world_projects row from the manifest's pluginIds + contentPackIds + initialConfig + initialWorldContent. The new project is fully configured — open it in the studio and the world is ready. Idempotent only by manifest_id check; double-clicks create separate projects (UI is responsible for loading-state guard).",
              security: [{ BearerAuth: [] }],
            },
          },
        ),
    );
};
