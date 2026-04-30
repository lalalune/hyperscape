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
    },
    dependencies: m.dependencies.map((d) => ({
      id: d.id,
      versionRange: d.versionRange,
    })),
    tags: [...m.tags],
    source: entry.source,
  };
}
