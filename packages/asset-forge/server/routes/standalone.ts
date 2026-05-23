/**
 * Standalone Launch routes — Phase 2.2.c of PLAN_AAA_UE5_PARITY.
 *
 * Exposes the StandaloneLauncher singleton (Phase 2.2.b.3) over HTTP
 * so the WorldStudio Launch button (Phase 2.3) can drive it.
 *
 * Three endpoints, all under `/api/standalone`:
 *
 *   POST /:projectId/launch  → boot a session for the project
 *   GET  /status             → poll current state (no projectId needed —
 *                              MVP is single-instance per the plan D1=A)
 *   POST /stop               → tear down the running session
 *
 * Auth: every endpoint requires login (matches /api/world/projects).
 * Team-membership check: launch + stop require `project:read` (anyone
 * who can open the project can play it). Status is membership-only.
 *
 * Single-instance for MVP: the launcher singleton holds at most one
 * Standalone session globally per asset-forge process. Phase 4 (multi-
 * session) introduces per-project ports + per-launcher state.
 */

import { Elysia, t } from "elysia";

import { authDerive, requireAuthGuard } from "../middleware/auth";
import type { TeamService } from "../services/TeamService";
import type { WorldProjectService } from "../services/WorldProjectService";
import {
  configureStandaloneLauncher,
  getStandaloneLauncher,
  type ProductionLauncherOptions,
} from "../services/standaloneLauncherDeps";

/**
 * Wire the singleton at boot. Optional — `getStandaloneLauncher` works
 * with defaults if this isn't called.
 */
export function configureStandaloneRoutes(
  options: ProductionLauncherOptions,
): void {
  configureStandaloneLauncher(options);
}

export const createStandaloneRoutes = (
  teamService: TeamService,
  worldProjectService: WorldProjectService,
) => {
  return new Elysia({
    prefix: "/api/standalone",
    name: "standalone-routes",
  })
    .derive(authDerive)
    .guard({ beforeHandle: [requireAuthGuard] }, (app) =>
      app
        // ---------- POST /api/standalone/:projectId/launch ----------
        .post(
          "/:projectId/launch",
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

            const launcher = getStandaloneLauncher(worldProjectService);
            const state = await launcher.start(projectId);
            if (state.kind === "error") {
              set.status = 409; // conflict: launcher rejected
              return { error: state.message, state };
            }
            return { state };
          },
          {
            params: t.Object({ projectId: t.String() }),
            detail: {
              tags: ["Standalone"],
              summary: "Launch a Standalone game session for the project",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ---------- GET /api/standalone/status ----------
        .get(
          "/status",
          ({ auth }) => {
            // Auth-only — anyone logged in can ask whether a Standalone
            // is running. The state object doesn't leak project content;
            // worst case it surfaces a project id the caller already had
            // visibility into (they authed against the same backend).
            void auth.user; // referenced so the auth guard fires
            const launcher = getStandaloneLauncher(worldProjectService);
            return { state: launcher.status() };
          },
          {
            detail: {
              tags: ["Standalone"],
              summary: "Get the current Standalone launcher state",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ---------- POST /api/standalone/stop ----------
        .post(
          "/stop",
          async ({ auth, set }) => {
            const user = auth.user!;
            const launcher = getStandaloneLauncher(worldProjectService);
            const current = launcher.status();
            // If a session is running, check the caller is a member of
            // the project's team — prevents random logged-in users from
            // shutting down a teammate's playtest.
            if ("projectId" in current && current.projectId) {
              const project = await worldProjectService.getById(
                current.projectId,
              );
              if (project) {
                const role = await teamService.getMemberRole(
                  project.teamId,
                  user.id,
                );
                if (!role) {
                  set.status = 403;
                  return { error: "Not a member of this team" };
                }
              }
            }
            const state = await launcher.stop();
            return { state };
          },
          {
            detail: {
              tags: ["Standalone"],
              summary: "Stop the running Standalone game session",
              security: [{ BearerAuth: [] }],
            },
          },
        ),
    );
};
