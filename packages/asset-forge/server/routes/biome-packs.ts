/**
 * Biome Packs Routes
 *
 * Phase 3 of `PLAN_PACK_TYPES.md`. Reads the `biome_packs`
 * table for the World Studio biome painter / agent's biome
 * lookup.
 *
 * Endpoints:
 *   GET  /api/biome-packs                — list installable packs for caller
 *                                           (public + caller's team-visibility)
 *   GET  /api/biome-packs/installed      — resolve a project's biomePacks[]
 *                                           array into full manifests
 *
 * The `installed` endpoint is the one the project loader
 * exercises: it takes the `biomePacks` ids the project has
 * persisted and returns the resolved manifest blobs so the
 * client can register their biomes via `setBiomePackBiomes`.
 */

import { Elysia, t } from "elysia";
import { authDerive, requireAuthGuard } from "../middleware/auth";
import type { BiomePackService } from "../services/BiomePackService";
import type { TeamService } from "../services/TeamService";
import type { WorldProjectService } from "../services/WorldProjectService";

const BiomePackResponse = t.Object({
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

const BiomePackListResponse = t.Array(BiomePackResponse);

export const createBiomePackRoutes = (
  biomePackService: BiomePackService,
  worldProjectService: WorldProjectService,
  teamService: TeamService,
) => {
  return new Elysia({ prefix: "/api/biome-packs", name: "biome-packs" })
    .derive(authDerive)
    .guard({ beforeHandle: [requireAuthGuard] }, (app) =>
      app
        .get(
          "/installed",
          async ({ query }) => {
            const projectId = String(query?.projectId ?? "");
            if (!projectId) return [];
            const project = await worldProjectService.getById(projectId);
            if (!project) return [];
            const ids = project.biomePacks ?? [];
            if (ids.length === 0) return [];
            const packs = await biomePackService.resolveByManifestIds(ids);
            return packs.map(formatPack);
          },
          {
            query: t.Object({ projectId: t.String() }),
            response: { 200: BiomePackListResponse },
            detail: {
              tags: ["Biome Packs"],
              summary: "Resolve a project's installed biome packs",
              description:
                "Returns full manifest blobs for each pack id in the project's `biomePacks` column. Empty when the project has no biome packs installed or doesn't exist.",
              security: [{ BearerAuth: [] }],
            },
          },
        )
        .get(
          "/",
          async ({ auth, query }) => {
            const user = auth.user!;
            const teamId = query?.teamId ?? null;
            if (teamId) {
              const role = await teamService.getMemberRole(teamId, user.id);
              if (!role) {
                const publicPacks = await biomePackService.listAvailable(null);
                return publicPacks.map(formatPack);
              }
            }
            const packs = await biomePackService.listAvailable(teamId);
            return packs.map(formatPack);
          },
          {
            query: t.Optional(t.Object({ teamId: t.Optional(t.String()) })),
            response: { 200: BiomePackListResponse },
            detail: {
              tags: ["Biome Packs"],
              summary: "List installable biome packs",
              description:
                "Returns public biome packs + caller's team's biome packs. Use ?teamId= to scope to a specific team membership.",
              security: [{ BearerAuth: [] }],
            },
          },
        ),
    );
};

function formatPack(pack: {
  id: string;
  manifestId: string;
  source: string;
  version: string;
  manifest: unknown;
  teamId: string | null;
  visibility: string;
  publishedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: pack.id,
    manifestId: pack.manifestId,
    source: pack.source,
    version: pack.version,
    manifest: pack.manifest,
    teamId: pack.teamId,
    visibility: pack.visibility,
    publishedAt: pack.publishedAt?.toISOString() ?? null,
    createdAt: pack.createdAt.toISOString(),
  };
}
