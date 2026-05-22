/**
 * Team Routes — CRUD for teams, members, invites
 * All routes require authentication. Team-scoped operations check permissions.
 */

import { Elysia, t } from "elysia";
import { authDerive, requireAuthGuard } from "../middleware/auth";
import { TeamService } from "../services/TeamService";
import { AuditLogService } from "../services/AuditLogService";
import * as WS from "../models/world-studio.models";
import * as Models from "../models";

export const createTeamRoutes = (
  teamService: TeamService,
  auditLogService: AuditLogService,
) => {
  return new Elysia({ prefix: "/api/teams", name: "team-routes" })
    .derive(authDerive)
    .guard({ beforeHandle: [requireAuthGuard] }, (app) =>
      app
        // ==================== Teams ====================

        .post(
          "/",
          async ({ auth, body, set }) => {
            const user = auth.user!;

            // Check slug uniqueness
            const existing = await teamService.getTeamBySlug(body.slug);
            if (existing) {
              set.status = 409;
              return { error: `Team slug "${body.slug}" is already taken` };
            }

            const team = await teamService.createTeam(body, user.id);
            if (!team) {
              set.status = 500;
              return { error: "Failed to create team" };
            }

            await auditLogService.log({
              teamId: team.id,
              userId: user.id,
              action: "team:create",
              targetType: "team",
              targetId: team.id,
            });

            return {
              id: team.id,
              name: team.name,
              slug: team.slug,
              description: team.description,
              avatarUrl: team.avatarUrl,
              plan: team.plan,
              aiBudgetMonthlyCents: team.aiBudgetMonthlyCents,
              aiSpentThisMonthCents: team.aiSpentThisMonthCents,
              createdAt: team.createdAt.toISOString(),
            };
          },
          {
            body: WS.CreateTeamBody,
            response: {
              200: WS.TeamResponse,
              409: Models.ErrorResponse,
              500: Models.ErrorResponse,
            },
            detail: {
              tags: ["Teams"],
              summary: "Create a new team",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        .get(
          "/:teamId",
          async ({ auth, params: { teamId }, set }) => {
            const user = auth.user!;

            // Must be a member
            const role = await teamService.getMemberRole(teamId, user.id);
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            const team = await teamService.getTeam(teamId);
            if (!team) {
              set.status = 404;
              return { error: "Team not found" };
            }

            return {
              id: team.id,
              name: team.name,
              slug: team.slug,
              description: team.description,
              avatarUrl: team.avatarUrl,
              plan: team.plan,
              aiBudgetMonthlyCents: team.aiBudgetMonthlyCents,
              aiSpentThisMonthCents: team.aiSpentThisMonthCents,
              createdAt: team.createdAt.toISOString(),
            };
          },
          {
            params: t.Object({ teamId: t.String() }),
            response: {
              200: WS.TeamResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["Teams"],
              summary: "Get team details",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        .put(
          "/:teamId",
          async ({ auth, params: { teamId }, body, set }) => {
            const user = auth.user!;
            const hasPermission = await teamService.hasRoleLevel(
              teamId,
              user.id,
              "admin",
            );
            if (!hasPermission) {
              set.status = 403;
              return { error: "Admin role required" };
            }

            const team = await teamService.updateTeam(teamId, body);
            if (!team) {
              set.status = 404;
              return { error: "Team not found" };
            }

            await auditLogService.log({
              teamId,
              userId: user.id,
              action: "team:update",
              targetType: "team",
              targetId: teamId,
              details: body as Record<string, unknown>,
            });

            return {
              id: team.id,
              name: team.name,
              slug: team.slug,
              description: team.description,
              avatarUrl: team.avatarUrl,
              plan: team.plan,
              aiBudgetMonthlyCents: team.aiBudgetMonthlyCents,
              aiSpentThisMonthCents: team.aiSpentThisMonthCents,
              createdAt: team.createdAt.toISOString(),
            };
          },
          {
            params: t.Object({ teamId: t.String() }),
            body: WS.UpdateTeamBody,
            response: {
              200: WS.TeamResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["Teams"],
              summary: "Update team",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        .delete(
          "/:teamId",
          async ({ auth, params: { teamId }, set }) => {
            const user = auth.user!;
            const hasPermission = await teamService.hasPermission(
              teamId,
              user.id,
              "team:delete",
            );
            if (!hasPermission) {
              set.status = 403;
              return { error: "Owner role required" };
            }

            const deleted = await teamService.deleteTeam(teamId);
            if (!deleted) {
              set.status = 404;
              return { error: "Team not found" };
            }

            await auditLogService.log({
              teamId,
              userId: user.id,
              action: "team:delete",
              targetType: "team",
              targetId: teamId,
            });

            return { success: true, message: "Team deleted" };
          },
          {
            params: t.Object({ teamId: t.String() }),
            response: {
              200: Models.SuccessResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["Teams"],
              summary: "Delete team",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ==================== Members ====================

        .get(
          "/:teamId/members",
          async ({ auth, params: { teamId }, set }) => {
            const user = auth.user!;
            const role = await teamService.getMemberRole(teamId, user.id);
            if (!role) {
              set.status = 403;
              return { error: "Not a member of this team" };
            }

            const members = await teamService.getMembers(teamId);
            return members.map((m) => ({
              id: m.member.id,
              userId: m.member.userId,
              displayName: m.user.displayName,
              email: m.user.email,
              avatarUrl: m.user.avatarUrl,
              role: m.member.role,
              joinedAt: m.member.joinedAt.toISOString(),
            }));
          },
          {
            params: t.Object({ teamId: t.String() }),
            response: {
              200: t.Array(WS.TeamMemberResponse),
              403: Models.ErrorResponse,
            },
            detail: {
              tags: ["Teams"],
              summary: "List team members",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ==================== Invites ====================

        .post(
          "/:teamId/invites",
          async ({ auth, params: { teamId }, body, set }) => {
            const user = auth.user!;
            const hasPermission = await teamService.hasPermission(
              teamId,
              user.id,
              "team:invite",
            );
            if (!hasPermission) {
              set.status = 403;
              return { error: "Invite permission required" };
            }

            const invite = await teamService.createInvite(
              teamId,
              body.email,
              body.role ?? "viewer",
              user.id,
            );
            if (!invite) {
              set.status = 500;
              return { error: "Failed to create invite" };
            }

            await auditLogService.log({
              teamId,
              userId: user.id,
              action: "team:invite",
              targetType: "team_member",
              details: { email: body.email, role: body.role },
            });

            return {
              id: invite.id,
              teamId: invite.teamId,
              email: invite.email,
              role: invite.role,
              token: invite.token,
              expiresAt: invite.expiresAt.toISOString(),
              acceptedAt: invite.acceptedAt?.toISOString() ?? null,
            };
          },
          {
            params: t.Object({ teamId: t.String() }),
            body: WS.TeamInviteBody,
            response: {
              200: WS.TeamInviteResponse,
              403: Models.ErrorResponse,
              500: Models.ErrorResponse,
            },
            detail: {
              tags: ["Teams"],
              summary: "Invite a user to the team",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        .get(
          "/:teamId/invites",
          async ({ auth, params: { teamId }, set }) => {
            const user = auth.user!;
            const hasPermission = await teamService.hasPermission(
              teamId,
              user.id,
              "team:invite",
            );
            if (!hasPermission) {
              set.status = 403;
              return { error: "Invite permission required" };
            }

            const invites = await teamService.getPendingInvites(teamId);
            return invites.map((inv) => ({
              id: inv.id,
              teamId: inv.teamId,
              email: inv.email,
              role: inv.role,
              token: inv.token,
              expiresAt: inv.expiresAt.toISOString(),
              acceptedAt: inv.acceptedAt?.toISOString() ?? null,
            }));
          },
          {
            params: t.Object({ teamId: t.String() }),
            response: {
              200: t.Array(WS.TeamInviteResponse),
              403: Models.ErrorResponse,
            },
            detail: {
              tags: ["Teams"],
              summary: "List pending invites",
              security: [{ BearerAuth: [] }],
            },
          },
        )

        // ==================== Audit Log ====================
        .get(
          "/:teamId/audit-log",
          async ({ auth, params: { teamId }, query, set }) => {
            const user = auth.user!;
            // Any team member can view audit log (it's their team's history)
            const role = await teamService.getMemberRole(teamId, user.id);
            if (!role) {
              set.status = 403;
              return { error: "Not a team member" };
            }

            const limit = Math.min(
              200,
              Math.max(1, Number(query.limit ?? 50) || 50),
            );
            const offset = Math.max(0, Number(query.offset ?? 0) || 0);

            const entries = await auditLogService.queryByTeam(teamId, {
              limit,
              offset,
            });
            return entries.map((e) => ({
              id: e.id,
              teamId: e.teamId,
              gameId: e.gameId,
              userId: e.userId,
              action: e.action,
              targetType: e.targetType,
              targetId: e.targetId,
              details: e.details,
              createdAt: e.createdAt.toISOString(),
            }));
          },
          {
            params: t.Object({ teamId: t.String() }),
            query: t.Object({
              limit: t.Optional(t.String()),
              offset: t.Optional(t.String()),
            }),
            response: {
              200: t.Array(WS.AuditLogEntryResponse),
              403: Models.ErrorResponse,
            },
            detail: {
              tags: ["Teams"],
              summary: "List team audit log entries",
              security: [{ BearerAuth: [] }],
            },
          },
        ),
    );
};

/**
 * Invite acceptance route — does NOT require the team-scoped auth guard,
 * only requires a valid authenticated user + invite token.
 */
export const createInviteAcceptRoute = (teamService: TeamService) => {
  return new Elysia({ prefix: "/api/invites", name: "invite-accept-routes" })
    .derive(authDerive)
    .guard({ beforeHandle: [requireAuthGuard] }, (app) =>
      app.post(
        "/accept",
        async ({ auth, body, set }) => {
          const user = auth.user!;
          const accepted = await teamService.acceptInvite(body.token, user.id);

          if (!accepted) {
            set.status = 400;
            return {
              error: "Invalid, expired, or already accepted invite",
            };
          }

          return { success: true, message: "Invite accepted" };
        },
        {
          body: t.Object({ token: t.String() }),
          response: {
            200: Models.SuccessResponse,
            400: Models.ErrorResponse,
          },
          detail: {
            tags: ["Teams"],
            summary: "Accept a team invite",
            security: [{ BearerAuth: [] }],
          },
        },
      ),
    );
};
