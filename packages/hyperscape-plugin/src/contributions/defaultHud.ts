/**
 * Hyperia plugin's default HUD layout contribution.
 *
 * Phase B0'.F of `PLAN_PROJECT_AS_DATA.md`. The plugin owns the
 * canonical Hyperia HUD shape — both the production client at
 * `localhost:3333` and PIE Play of a Hyperia project should render
 * the same layout without per-host duplication.
 *
 * First cut surface (this slice): a minimal layout — HP bar +
 * action bar + tooltip overlay. These widgets are registered by
 * `bindAllWidgets()` (engine builtins) so the layout renders
 * without depending on any further plugin contributions.
 *
 * Follow-up cut migrates the full hand-coded HUD into this manifest
 * — status bars, inventory, minimap, chat, etc. As of B0'.F the
 * client retains its own `DEFAULT_UI_LAYOUT` copy in
 * `packages/client/src/ui-framework/defaultLayout.ts`; B0'.F.2 will
 * dedupe by having the client re-export from this module.
 *
 * Bindings reference the live `DataContext` PIE assembles via
 * `PIEEditorSession.getDataContext()` (B0.3, already shipped):
 *
 *   - `$player.hp`     → current player HP
 *   - `$player.maxHp`  → player's max HP
 *
 * When the binding source isn't populated (pre-spawn), the
 * widget's static `props` provide a fallback so the HUD doesn't
 * blank out.
 */

import {
  UILayoutManifestSchema,
  type UILayoutManifest,
} from "@hyperforge/ui-framework";

export const HYPERSCAPE_DEFAULT_HUD_LAYOUT_ID = "com.hyperforge.hyperscape.hud";

/**
 * Default Hyperia HUD. Validated through `UILayoutManifestSchema`
 * at module load so any schema drift surfaces immediately on
 * import.
 */
export const HYPERSCAPE_DEFAULT_HUD_LAYOUT: UILayoutManifest =
  UILayoutManifestSchema.parse({
    id: HYPERSCAPE_DEFAULT_HUD_LAYOUT_ID,
    name: "Hyperia Default HUD",
    description:
      "Canonical Hyperia HUD layout — HP bar, action bar, and tooltip overlay. Rendered identically by the production client and PIE Play of a Hyperia project. Phase B0'.F first cut; richer HUD (inventory, minimap, chat) lands in B0'.F.2.",
    instances: [
      {
        instanceId: "hp-bar-main",
        widgetId: "hyperforge.hud.hp-bar",
        position: {
          kind: "anchored",
          anchor: "top-left",
          offset: { x: 60, y: 20 },
        },
        props: {
          orientation: "horizontal",
          showNumeric: true,
          // Static fallbacks used when the player-data namespace is
          // not yet populated (pre-spawn / pre-first-stats event).
          current: 10,
          max: 10,
        },
        bindings: {
          current: "$player.hp",
          max: "$player.maxHp",
        },
        label: "HP",
      },
      {
        instanceId: "action-bar-main",
        widgetId: "hyperforge.hud.action-bar",
        position: {
          kind: "anchored",
          anchor: "bottom-center",
          offset: { x: 0, y: -24 },
        },
        props: {
          slotCount: 7,
          slotSize: 36,
          showKeybindings: true,
          showGcd: true,
        },
        label: "Action Bar",
      },
      {
        instanceId: "tooltip-hover",
        widgetId: "hyperforge.overlay.tooltip",
        position: {
          kind: "anchored",
          anchor: "top-left",
          offset: { x: 0, y: 0 },
        },
        props: {
          // Tooltip is invisible until something dispatches the
          // hover event; the renderer just keeps it mounted.
          visible: false,
        },
        label: "Tooltip",
      },
    ],
  });
