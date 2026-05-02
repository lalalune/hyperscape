/**
 * Content Packs Routes
 *
 * Phase B of `PLAN_AAA_CONTENT_SYSTEM.md`. Project-scoped read
 * endpoint for the unified content pack pipeline. Resolves the
 * project's `assetPacks` column (the column that today stores
 * content pack ids — rename to `contentPacks` is queued in a
 * later phase) into full manifest blobs.
 *
 * Endpoints:
 *   GET  /api/content-packs/installed?projectId=X
 *     — Returns the resolved manifests for every content pack
 *       the project has installed. The studio's project loader
 *       extracts each pack's typed sections (biomes,
 *       terrainShaders, vegetationSpecies, …) and dispatches
 *       them to the unified contentRegistry.
 *
 * The existing `/api/asset-packs` routes (marketplace browse,
 * pack creation, addEntry, publish/unpublish) are preserved
 * as-is — they target the same underlying table and continue
 * to work for the assets-only use case. This route is a
 * project-scoped read view layered on top.
 */

import { Elysia, t } from "elysia";
import { authDerive, requireAuthGuard } from "../middleware/auth";
import type { AssetPackService } from "../services/AssetPackService";
import type { WorldProjectService } from "../services/WorldProjectService";

const ContentPackResponse = t.Object({
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

const ContentPackListResponse = t.Array(ContentPackResponse);

export const createContentPackRoutes = (
  assetPackService: AssetPackService,
  worldProjectService: WorldProjectService,
) => {
  return new Elysia({ prefix: "/api/content-packs", name: "content-packs" })
    .derive(authDerive)
    .guard({ beforeHandle: [requireAuthGuard] }, (app) =>
      app.get(
        "/installed",
        async ({ query }) => {
          const projectId = String(query?.projectId ?? "");
          if (!projectId) return [];
          const project = await worldProjectService.getById(projectId);
          if (!project) return [];
          const ids = project.assetPacks ?? [];
          if (ids.length === 0) return [];
          const packs = await assetPackService.resolveByManifestIds(ids);
          return packs.map(formatPack);
        },
        {
          query: t.Object({ projectId: t.String() }),
          response: { 200: ContentPackListResponse },
          detail: {
            tags: ["Content Packs"],
            summary: "Resolve a project's installed content packs",
            description:
              "Returns full manifest blobs for each content pack id in the project's `assetPacks` column. Empty when the project has no content packs installed or doesn't exist. The studio's project loader walks each manifest's typed sections (biomes, terrainShaders, etc.) into the runtime contentRegistry.",
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
