/**
 * Installed Plugin Registry Route
 *
 * Phase B0'.D of `PLAN_PROJECT_AS_DATA.md`. Surfaces the set of
 * **installed** plugins (discovered by walking workspace +
 * node_modules for `plugin.json` files). Distinct from the existing
 * `/api/plugins/registry/*` namespace which catalogs *published*
 * marketplace bundles.
 *
 * Endpoints:
 *
 *   - `GET /api/plugins/installed`         List all installed plugins
 *   - `GET /api/plugins/installed/:id`     Single plugin by manifest id or npm name
 *
 * Public — installed-plugin metadata is non-sensitive. The agent
 * reads this surface via `LIST_PLUGINS` / `GET_PLUGIN` actions
 * (B0'.D follow-up) to know which plugin sets it can recommend
 * to the user.
 */

import { Elysia, t } from "elysia";
import { PluginRegistryService } from "../services/PluginRegistryService";
import * as Models from "../models";

const PluginRegistryEntryResponse = t.Object({
  /** Reverse-DNS plugin id (e.g. `com.hyperforge.hyperscape`). */
  id: t.String(),
  /** Companion npm package name, when discoverable. */
  npmName: t.Nullable(t.String()),
  name: t.String(),
  version: t.String(),
  description: t.String(),
  /** What surface the plugin contributes. */
  contributions: t.Object({
    systems: t.Array(t.String()),
    entities: t.Array(t.String()),
    widgets: t.Array(t.String()),
    manifestSchemas: t.Array(t.String()),
    paletteCategories: t.Array(t.String()),
    toolbarTools: t.Array(t.String()),
    commands: t.Array(t.String()),
    /**
     * R2.P10 — gameplay-typed entity contributions. Each entry
     * tells the agent that placements with this kind+type are
     * handled by this plugin's runtime systems. The studio's
     * Design with AI dialog forwards these to the agent's
     * LIST_ENTITY_TYPES via PluginCatalogService, replacing the
     * static eliza-game-builder mirror.
     */
    entityTypes: t.Array(
      t.Object({
        kind: t.Union([
          t.Literal("npc"),
          t.Literal("mobSpawn"),
          t.Literal("resource"),
          t.Literal("station"),
        ]),
        type: t.String(),
        description: t.String(),
        requiredFields: t.Array(t.String()),
        acceptedAssetTypes: t.Array(t.String()),
      }),
    ),
    /**
     * R3.P3 — biome contributions. Asset-forge merges these
     * across active plugins into the editor's biome registry
     * so a plugin declaring `desert` / `tropical_jungle` shows
     * up alongside (or instead of) the Hyperia tundra/forest/
     * canyon defaults.
     */
    biomes: t.Array(
      t.Object({
        id: t.String(),
        name: t.String(),
        color: t.Number(),
        terrainMultiplier: t.Number(),
        difficultyLevel: t.Number(),
        heightRange: t.Tuple([t.Number(), t.Number()]),
        maxSlope: t.Number(),
        resourceDensity: t.Number(),
      }),
    ),
  }),
  /** Plugin ids this plugin depends on. */
  dependencies: t.Array(t.Object({ id: t.String(), versionRange: t.String() })),
  /** Free-form tags for picker filtering. */
  tags: t.Array(t.String()),
  /** Discovery source — workspace (dev) vs node_modules (installed). */
  source: t.Union([t.Literal("workspace"), t.Literal("node_modules")]),
});

const PluginRegistryListResponse = t.Array(PluginRegistryEntryResponse);

export const createPluginRegistryRoutes = (
  registryService: PluginRegistryService,
) => {
  return new Elysia({
    prefix: "/api/plugins/installed",
    name: "installed-plugin-registry-routes",
  })
    .get(
      "/",
      async () => {
        const list = await registryService.list();
        return list.map(formatEntry);
      },
      {
        response: { 200: PluginRegistryListResponse },
        detail: {
          tags: ["Plugins"],
          summary: "List installed plugins (workspace + node_modules)",
        },
      },
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        const entry = await registryService.resolve(params.id);
        if (!entry) {
          set.status = 404;
          return { error: `Unknown plugin: ${params.id}` };
        }
        return formatEntry(entry);
      },
      {
        params: t.Object({ id: t.String() }),
        response: {
          200: PluginRegistryEntryResponse,
          404: Models.ErrorResponse,
        },
        detail: {
          tags: ["Plugins"],
          summary: "Get an installed plugin by manifest id or npm name",
        },
      },
    );
};

function formatEntry(
  entry: Awaited<ReturnType<PluginRegistryService["list"]>>[number],
) {
  const m = entry.manifest;
  return {
    id: m.id,
    npmName: entry.npmName,
    name: m.name,
    version: m.version,
    description: m.description,
    contributions: {
      systems: [...m.contributions.systems],
      entities: [...m.contributions.entities],
      widgets: [...m.contributions.widgets],
      manifestSchemas: [...m.contributions.manifestSchemas],
      paletteCategories: [...m.contributions.paletteCategories],
      toolbarTools: [...m.contributions.toolbarTools],
      commands: [...m.contributions.commands],
      entityTypes: m.contributions.entityTypes.map((e) => ({
        kind: e.kind,
        type: e.type,
        description: e.description,
        requiredFields: [...e.requiredFields],
        acceptedAssetTypes: [...e.acceptedAssetTypes],
      })),
      biomes: m.contributions.biomes.map((b) => ({
        id: b.id,
        name: b.name,
        color: b.color,
        terrainMultiplier: b.terrainMultiplier,
        difficultyLevel: b.difficultyLevel,
        heightRange: [b.heightRange[0], b.heightRange[1]] as [number, number],
        maxSlope: b.maxSlope,
        resourceDensity: b.resourceDensity,
      })),
    },
    dependencies: m.dependencies.map((d) => ({
      id: d.id,
      versionRange: d.versionRange,
    })),
    tags: [...m.tags],
    source: entry.source,
  };
}
