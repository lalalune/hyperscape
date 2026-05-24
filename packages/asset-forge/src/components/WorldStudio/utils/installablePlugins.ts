/**
 * Installable-plugin types + response normalization.
 *
 * The DesignWithAIDialog fetches `/api/plugins/installed` to
 * populate the catalog of plugins the agent can recommend. The
 * server payload (`PluginRegistryResponse`) carries optional,
 * nested `contributions` declared in each plugin's `plugin.json`;
 * we hoist those into flat per-kind arrays on the dialog's
 * working shape so the agent context can read them uniformly.
 *
 * Two parallel concerns lived inline before this extract:
 *   - A ~30-line anonymous state type
 *   - A ~30-line `.map()` block that shallow-clones every nested
 *     array and undefined-defaults each contribution kind
 *
 * Centralizing both keeps the dialog focused on UI state and
 * lets the normalization grow (new contribution kinds) in one
 * file with its own tests.
 *
 * @internal
 */

/** Server-side shape — what `/api/plugins/installed` returns. */
export interface PluginRegistryEntry {
  readonly id: string;
  readonly npmName: string | null;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly contributions?: {
    readonly entityTypes?: ReadonlyArray<{
      readonly kind: "npc" | "mobSpawn" | "resource" | "station";
      readonly type: string;
      readonly description: string;
      readonly requiredFields: readonly string[];
      readonly acceptedAssetTypes: readonly string[];
    }>;
    readonly commands?: readonly string[];
    readonly systems?: readonly string[];
    readonly entities?: readonly string[];
    readonly widgets?: readonly string[];
    readonly manifestSchemas?: readonly string[];
    readonly paletteCategories?: readonly string[];
    readonly toolbarTools?: readonly string[];
  };
}

/** Dialog-side shape — what gets stored in state + sent to agent. */
export interface InstallablePlugin {
  id: string;
  npmName: string | null;
  name: string;
  description: string;
  tags: string[];
  entityTypeContributions?: Array<{
    kind: "npc" | "mobSpawn" | "resource" | "station";
    type: string;
    description: string;
    requiredFields: string[];
    acceptedAssetTypes: string[];
  }>;
  // Phase 3.1 of PLAN_AAA_MASTER_AUDIT — six uniform
  // string-array contribution kinds plus toolbar tools. The
  // agent reads these to know what real identifiers it can
  // reference instead of guessing.
  commandContributions?: string[];
  systemContributions?: string[];
  entityContributions?: string[];
  widgetContributions?: string[];
  manifestSchemaContributions?: string[];
  paletteCategoryContributions?: string[];
  toolbarToolContributions?: string[];
}

/**
 * Convert one registry entry into the dialog's working shape.
 *
 * Every nested array is shallow-cloned so future state edits
 * (e.g. filtering installed-vs-available) don't mutate the
 * frozen server response. Missing contribution kinds collapse
 * to `undefined` rather than `[]` so consumers can branch on
 * presence ("did the plugin declare any commands?" vs "the
 * plugin declared an empty command list").
 */
export function normalizeInstallablePlugin(
  entry: PluginRegistryEntry,
): InstallablePlugin {
  return {
    id: entry.id,
    npmName: entry.npmName,
    name: entry.name,
    description: entry.description,
    tags: [...entry.tags],
    entityTypeContributions: entry.contributions?.entityTypes
      ? entry.contributions.entityTypes.map((e) => ({
          kind: e.kind,
          type: e.type,
          description: e.description,
          requiredFields: [...e.requiredFields],
          acceptedAssetTypes: [...e.acceptedAssetTypes],
        }))
      : undefined,
    commandContributions: entry.contributions?.commands
      ? [...entry.contributions.commands]
      : undefined,
    systemContributions: entry.contributions?.systems
      ? [...entry.contributions.systems]
      : undefined,
    entityContributions: entry.contributions?.entities
      ? [...entry.contributions.entities]
      : undefined,
    widgetContributions: entry.contributions?.widgets
      ? [...entry.contributions.widgets]
      : undefined,
    manifestSchemaContributions: entry.contributions?.manifestSchemas
      ? [...entry.contributions.manifestSchemas]
      : undefined,
    paletteCategoryContributions: entry.contributions?.paletteCategories
      ? [...entry.contributions.paletteCategories]
      : undefined,
    toolbarToolContributions: entry.contributions?.toolbarTools
      ? [...entry.contributions.toolbarTools]
      : undefined,
  };
}
