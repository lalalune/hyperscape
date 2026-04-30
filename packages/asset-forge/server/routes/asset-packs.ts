/**
 * Asset Packs Routes
 *
 * Phase AP1+ of `PLAN_ASSET_PACKS.md`.
 *
 * Endpoints:
 *   GET  /api/asset-packs/marketplace — public browse of public packs
 *                                       (no auth required — marketplace
 *                                       is, by definition, world-readable)
 *   GET  /api/asset-packs             — list installable packs for caller
 *                                       (built-in/public + caller's team)
 *   GET  /api/asset-packs/:id         — fetch one pack by manifest_id
 *
 * Authenticated routes scope to the caller's team. The marketplace
 * endpoint is intentionally pre-auth.
 */

import { Elysia, t } from "elysia";
import { authDerive, requireAuthGuard } from "../middleware/auth";
import { TeamService } from "../services/TeamService";
import type { AssetPackService } from "../services/AssetPackService";
import * as Models from "../models";

const AssetPackResponse = t.Object({
  id: t.String(),
  manifestId: t.String(),
  source: t.String(),
  version: t.String(),
  manifest: t.Unknown(),
  teamId: t.Nullable(t.String()),
  visibility: t.String(),
  publishedAt: t.Nullable(t.String()),
  createdAt: t.String(),
});

const AssetPackListResponse = t.Array(AssetPackResponse);

export const createAssetPackRoutes = (
  assetPackService: AssetPackService,
  teamService: TeamService,
) => {
  return (
    new Elysia({ prefix: "/api/asset-packs", name: "asset-packs" })
      .derive(authDerive)
      // ──────── AP9.2 — Public marketplace browse ────────
      // No auth required. Returns visibility="public" packs only.
      // Pagination via ?limit + ?offset; defaults to 50, max 200.
      .get(
        "/marketplace",
        async ({ query }) => {
          const limit = query?.limit ? Number(query.limit) : undefined;
          const offset = query?.offset ? Number(query.offset) : undefined;
          const packs = await assetPackService.listMarketplace({
            limit: Number.isFinite(limit) ? limit : undefined,
            offset: Number.isFinite(offset) ? offset : undefined,
          });
          return packs.map(formatPack);
        },
        {
          query: t.Optional(
            t.Object({
              limit: t.Optional(t.String()),
              offset: t.Optional(t.String()),
            }),
          ),
          response: { 200: AssetPackListResponse },
          detail: {
            tags: ["Asset Packs"],
            summary: "Browse the public marketplace (AP9.2)",
            description:
              "Returns every public asset pack ordered by published_at DESC. No auth required. Use ?limit (default 50, max 200) + ?offset for pagination.",
          },
        },
      )
      // ──────── Authenticated routes ────────
      .guard({ beforeHandle: [requireAuthGuard] }, (app) =>
        app
          // ──────── Pack creation ────────
          .post(
            "/",
            async ({ auth, body, set }) => {
              const user = auth.user!;
              const role = await teamService.getMemberRole(
                body.teamId,
                user.id,
              );
              if (!role) {
                set.status = 403;
                return { error: "Not a member of this team" };
              }

              // Reject ids that collide with an existing pack — the
              // unique constraint would also catch this, but the
              // pre-check gives a friendlier error.
              const existing = await assetPackService.getByManifestId(
                body.manifestId,
              );
              if (existing) {
                set.status = 409;
                return {
                  error: `An asset pack with id "${body.manifestId}" already exists.`,
                };
              }

              const created = await assetPackService.create({
                manifestId: body.manifestId,
                name: body.name,
                description: body.description ?? "",
                packVersion: body.packVersion,
                license: body.license,
                tags: body.tags,
                teamId: body.teamId,
                authorName: user.displayName ?? user.email ?? "Unknown",
              });
              if (!created) {
                set.status = 500;
                return { error: "Failed to create asset pack" };
              }
              return formatPack(created);
            },
            {
              body: t.Object({
                /**
                 * npm-style id, e.g. `@team-slug/asset-pack-foo-v1`.
                 * Globally unique. The `-vN` suffix convention is
                 * caller-driven — there's no enforcement, but using
                 * it means a "v2" of the same pack ships as a
                 * separate id (the AP1 versioning rule).
                 */
                manifestId: t.String({ minLength: 1, maxLength: 200 }),
                name: t.String({ minLength: 1, maxLength: 200 }),
                description: t.Optional(t.String({ maxLength: 2000 })),
                /** Pack semver, e.g. "1.0.0". */
                packVersion: t.String({ minLength: 1, maxLength: 64 }),
                license: t.Optional(t.String({ maxLength: 64 })),
                tags: t.Optional(t.Array(t.String())),
                teamId: t.String({ minLength: 1 }),
              }),
              response: {
                200: AssetPackResponse,
                403: Models.ErrorResponse,
                409: Models.ErrorResponse,
                500: Models.ErrorResponse,
              },
              detail: {
                tags: ["Asset Packs"],
                summary: "Create a new (empty) team asset pack",
                description:
                  "Creates a fresh pack with `visibility=team` and no asset entries. Entries are added through a separate Add-to-Pack surface or the seeder. Caller must be a member of the named team.",
                security: [{ BearerAuth: [] }],
              },
            },
          )
          .get(
            "/",
            async ({ auth, query }) => {
              const user = auth.user!;
              // Optional ?teamId= scopes to that team. Public packs
              // (built-ins + marketplace listings) are always visible.
              const teamId = query?.teamId ?? null;
              if (teamId) {
                const role = await teamService.getMemberRole(teamId, user.id);
                if (!role) {
                  // Not a member — only public packs visible.
                  const publicPacks =
                    await assetPackService.listAvailable(null);
                  return publicPacks.map(formatPack);
                }
              }
              const packs = await assetPackService.listAvailable(teamId);
              return packs.map(formatPack);
            },
            {
              query: t.Optional(t.Object({ teamId: t.Optional(t.String()) })),
              response: { 200: AssetPackListResponse },
              detail: {
                tags: ["Asset Packs"],
                summary: "List installable asset packs (AP1)",
                description:
                  "Returns public packs + the caller's team's packs. Use ?teamId= to scope to a specific team membership.",
                security: [{ BearerAuth: [] }],
              },
            },
          )
          .get(
            "/:manifestId",
            async ({ params, set }) => {
              const pack = await assetPackService.getByManifestId(
                params.manifestId,
              );
              if (!pack) {
                set.status = 404;
                return { error: "Asset pack not found" };
              }
              return formatPack(pack);
            },
            {
              params: t.Object({ manifestId: t.String() }),
              response: {
                200: AssetPackResponse,
                404: Models.ErrorResponse,
              },
              detail: {
                tags: ["Asset Packs"],
                summary: "Get one asset pack by manifest_id",
                security: [{ BearerAuth: [] }],
              },
            },
          )
          // ──────── Pack entries (append) ────────
          .post(
            "/:manifestId/entries",
            async ({ auth, params, body, set }) => {
              const user = auth.user!;
              const pack = await assetPackService.getByManifestId(
                params.manifestId,
              );
              if (!pack) {
                set.status = 404;
                return { error: "Asset pack not found" };
              }
              if (!pack.teamId) {
                set.status = 403;
                return {
                  error: "Built-in packs are managed by the platform",
                };
              }
              const role = await teamService.getMemberRole(
                pack.teamId,
                user.id,
              );
              if (!role) {
                set.status = 403;
                return { error: "Not a member of the pack's team" };
              }

              const result = await assetPackService.addEntry(
                params.manifestId,
                body,
              );
              if (!result.ok) {
                if (result.reason === "not-found") {
                  set.status = 404;
                  return { error: result.message };
                }
                if (result.reason === "duplicate") {
                  set.status = 409;
                  return { error: result.message };
                }
                set.status = 400;
                return {
                  error: `Invalid entry: ${result.issues.join("; ")}`,
                };
              }
              return formatPack(result.pack);
            },
            {
              params: t.Object({ manifestId: t.String() }),
              // The body is validated by Zod inside the service —
              // Elysia's TypeBox can't easily express the full Zod
              // schema, so we accept Unknown and let the service
              // reject with structured issues.
              body: t.Unknown(),
              response: {
                200: AssetPackResponse,
                400: Models.ErrorResponse,
                403: Models.ErrorResponse,
                404: Models.ErrorResponse,
                409: Models.ErrorResponse,
              },
              detail: {
                tags: ["Asset Packs"],
                summary: "Append an entry to a pack's manifest",
                description:
                  "Validates the entry against AssetPackEntrySchema and appends to manifest.assets[]. Pack-scoped ids must be unique within the pack (409 on collision). Built-in packs are immutable through this endpoint. Caller must be a member of the pack's team.",
                security: [{ BearerAuth: [] }],
              },
            },
          )
          // ──────── AP9 — Publish / Unpublish ────────
          .post(
            "/:manifestId/publish",
            async ({ auth, params, set }) => {
              const user = auth.user!;
              const pack = await assetPackService.getByManifestId(
                params.manifestId,
              );
              if (!pack) {
                set.status = 404;
                return { error: "Asset pack not found" };
              }
              // Built-ins (team_id = NULL) can't be published from
              // the API — they're shipped via seeder. Reject early.
              if (!pack.teamId) {
                set.status = 403;
                return {
                  error: "Built-in packs are managed by the platform",
                };
              }
              // Only team owners can publish their team's packs.
              const role = await teamService.getMemberRole(
                pack.teamId,
                user.id,
              );
              if (role !== "owner") {
                set.status = 403;
                return {
                  error: "Only team owners can publish asset packs",
                };
              }
              const updated = await assetPackService.publish(params.manifestId);
              if (!updated) {
                set.status = 500;
                return { error: "Failed to publish pack" };
              }
              return formatPack(updated);
            },
            {
              params: t.Object({ manifestId: t.String() }),
              response: {
                200: AssetPackResponse,
                403: Models.ErrorResponse,
                404: Models.ErrorResponse,
                500: Models.ErrorResponse,
              },
              detail: {
                tags: ["Asset Packs"],
                summary: "Publish a team pack to the marketplace (AP9)",
                description:
                  "Flips visibility from 'team' to 'public' so the pack lands in the marketplace browse query. Idempotent — re-publishing preserves the original published_at. Requires the caller to be an owner of the pack's team.",
                security: [{ BearerAuth: [] }],
              },
            },
          )
          .post(
            "/:manifestId/unpublish",
            async ({ auth, params, set }) => {
              const user = auth.user!;
              const pack = await assetPackService.getByManifestId(
                params.manifestId,
              );
              if (!pack) {
                set.status = 404;
                return { error: "Asset pack not found" };
              }
              if (!pack.teamId) {
                set.status = 403;
                return {
                  error: "Built-in packs are managed by the platform",
                };
              }
              const role = await teamService.getMemberRole(
                pack.teamId,
                user.id,
              );
              if (role !== "owner") {
                set.status = 403;
                return {
                  error: "Only team owners can unpublish asset packs",
                };
              }
              const updated = await assetPackService.unpublish(
                params.manifestId,
              );
              if (!updated) {
                set.status = 500;
                return { error: "Failed to unpublish pack" };
              }
              return formatPack(updated);
            },
            {
              params: t.Object({ manifestId: t.String() }),
              response: {
                200: AssetPackResponse,
                403: Models.ErrorResponse,
                404: Models.ErrorResponse,
                500: Models.ErrorResponse,
              },
              detail: {
                tags: ["Asset Packs"],
                summary: "Unpublish a pack from the marketplace (AP9)",
                description:
                  "Flips visibility from 'public' back to 'team' and clears published_at. Useful for takedowns / temporary delistings. Requires the caller to be an owner of the pack's team.",
                security: [{ BearerAuth: [] }],
              },
            },
          ),
      )
  );
};

function formatPack(
  pack: Awaited<ReturnType<AssetPackService["getByManifestId"]>>,
) {
  if (!pack) throw new Error("formatPack received null");
  return {
    id: pack.id,
    manifestId: pack.manifestId,
    source: pack.source,
    version: pack.version,
    manifest: pack.manifest,
    teamId: pack.teamId ?? null,
    visibility: pack.visibility,
    publishedAt: pack.publishedAt?.toISOString() ?? null,
    createdAt: pack.createdAt.toISOString(),
  };
}
