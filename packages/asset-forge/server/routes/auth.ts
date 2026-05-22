/**
 * Auth Routes
 *
 *   GET /api/auth/me   — returns the authenticated user's profile +
 *                        team memberships
 *   PUT /api/auth/me   — updates the user's displayName / avatarUrl
 *                        on the forge_users record. Privy-managed
 *                        identity (email, wallet, linked accounts)
 *                        is read-only here — those flow through Privy.
 */

import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { getDb, isDatabaseEnabled } from "../db/db";
import { forgeUsers } from "../db/schema/forge-users.schema";
import { authDerive, requireAuthGuard } from "../middleware/auth";
import { TeamService } from "../services/TeamService";
import * as Models from "../models";
import * as WS from "../models/world-studio.models";

export const createAuthRoutes = (teamService: TeamService) => {
  return new Elysia({ prefix: "/api/auth", name: "auth-routes" })
    .derive(authDerive)
    .guard({ beforeHandle: [requireAuthGuard] }, (app) =>
      app
        .get(
          "/me",
          async ({ auth }) => {
            const user = auth.user!;
            const teamMemberships = await teamService.getTeamsForUser(user.id);

            return {
              user: {
                id: user.id,
                privyUserId: user.privyUserId,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              },
              teams: teamMemberships.map((tm) => ({
                teamId: tm.team.id,
                teamName: tm.team.name,
                teamSlug: tm.team.slug,
                role: tm.role,
              })),
            };
          },
          {
            response: WS.AuthMeResponse,
            detail: {
              tags: ["Auth"],
              summary: "Get current user profile and team memberships",
              security: [{ BearerAuth: [] }],
            },
          },
        )
        .put(
          "/me",
          async ({ auth, body, set }) => {
            const user = auth.user!;
            const db = getDb();
            if (!isDatabaseEnabled() || !db) {
              set.status = 503;
              return { error: "Database unavailable" };
            }

            // Build update map — only include fields the client sent
            const updates: Partial<{
              displayName: string;
              avatarUrl: string | null;
            }> = {};
            if (typeof body.displayName === "string") {
              const trimmed = body.displayName.trim();
              if (!trimmed) {
                set.status = 400;
                return { error: "displayName cannot be empty" };
              }
              updates.displayName = trimmed;
            }
            if (body.avatarUrl !== undefined) {
              // null is allowed (clears the avatar); otherwise trim
              updates.avatarUrl =
                body.avatarUrl === null ? null : body.avatarUrl.trim() || null;
            }

            if (Object.keys(updates).length === 0) {
              // Nothing to change — return current state
              const memberships = await teamService.getTeamsForUser(user.id);
              return {
                user: {
                  id: user.id,
                  privyUserId: user.privyUserId,
                  email: user.email,
                  displayName: user.displayName,
                  avatarUrl: user.avatarUrl,
                },
                teams: memberships.map((tm) => ({
                  teamId: tm.team.id,
                  teamName: tm.team.name,
                  teamSlug: tm.team.slug,
                  role: tm.role,
                })),
              };
            }

            const [updated] = await db
              .update(forgeUsers)
              .set(updates)
              .where(eq(forgeUsers.id, user.id))
              .returning();

            if (!updated) {
              set.status = 404;
              return { error: "User not found" };
            }

            const memberships = await teamService.getTeamsForUser(user.id);
            return {
              user: {
                id: updated.id,
                privyUserId: updated.privyUserId,
                email: updated.email,
                displayName: updated.displayName,
                avatarUrl: updated.avatarUrl,
              },
              teams: memberships.map((tm) => ({
                teamId: tm.team.id,
                teamName: tm.team.name,
                teamSlug: tm.team.slug,
                role: tm.role,
              })),
            };
          },
          {
            body: WS.AuthMeUpdateBody,
            response: {
              200: WS.AuthMeResponse,
              400: Models.ErrorResponse,
              404: Models.ErrorResponse,
              503: Models.ErrorResponse,
            },
            detail: {
              tags: ["Auth"],
              summary: "Update current user profile (displayName + avatarUrl)",
              security: [{ BearerAuth: [] }],
            },
          },
        ),
    );
};
