/**
 * defaultLayout.ts — the manifest used by the client when no
 * user-authored layout has been loaded yet.
 *
 * Placements here mirror the current hand-coded HUD so Phase D6
 * migration can be flipped on piecewise: once an existing component
 * has an adapter bound in `bindings.tsx`, remove it from the
 * hand-coded tree and rely on this layout instead.
 *
 * Coordinate system mirrors the editor preview (VIEWPORT_W = 1280,
 * VIEWPORT_H = 720). Real runtime rendering scales the same
 * anchored/offset tuple to whatever viewport the client is on.
 */

import type { UILayoutManifest } from "@hyperforge/ui-framework";
import { UILayoutManifestSchema } from "@hyperforge/ui-framework";
import { HYPERSCAPE_DEFAULT_HUD_LAYOUT } from "@hyperforge/hyperscape";

export const DEFAULT_UI_LAYOUT_ID = "hyperscape.default";

/**
 * The default layout — Phase 1.2 of PLAN_AAA_UE5_PARITY dedupes by
 * sourcing `instances` from the plugin-owned `HYPERSCAPE_DEFAULT_HUD_LAYOUT`
 * so the production client and PIE Play render the same 15-widget
 * panel set without two definitions drifting apart. The legacy
 * `DEFAULT_UI_LAYOUT_ID` ("hyperscape.default") is preserved as the
 * surface id consumed by tests + the UI pack; the underlying
 * placement data is owned by the plugin.
 *
 * Adding a widget to the Hyperia HUD is now a one-place edit in
 * `packages/hyperscape-plugin/src/contributions/defaultHud.ts`.
 */
export const DEFAULT_UI_LAYOUT: UILayoutManifest = UILayoutManifestSchema.parse(
  {
    ...HYPERSCAPE_DEFAULT_HUD_LAYOUT,
    id: DEFAULT_UI_LAYOUT_ID,
    name: "Hyperscape Default UI",
    description:
      "Out-of-the-box HUD — re-exported from @hyperforge/hyperscape's HYPERSCAPE_DEFAULT_HUD_LAYOUT. Single source of truth for the Hyperia panel set.",
  },
);

/**
 * Shooter-demo's default HUD — deliberately minimal. Proves that
 * selecting a different game plugin set changes the USER-VISIBLE
 * layout, not just the in-memory ability service.
 *
 * Just a crosshair, centered. The widget itself is contributed by
 * `@hyperforge/plugin-shooter-demo` via `ctx.widgets.register(...)`
 * during the plugin's `onEnable`; this layout simply places an
 * instance of it.
 */
export const SHOOTER_DEMO_UI_LAYOUT_ID = "shooter-demo.default";
export const SHOOTER_DEMO_UI_LAYOUT: UILayoutManifest =
  UILayoutManifestSchema.parse({
    id: SHOOTER_DEMO_UI_LAYOUT_ID,
    name: "Shooter Demo HUD",
    description:
      "Minimal shooter HUD. Crosshair centered on screen. Plugin-contributed widget from @hyperforge/plugin-shooter-demo.",
    instances: [
      {
        instanceId: "crosshair-center",
        widgetId: "com.hyperforge.shooter-demo.crosshair",
        position: {
          kind: "anchored",
          anchor: "center",
          offset: { x: 0, y: 0 },
        },
        props: {
          size: 32,
          color: "#7ef7b3",
          thickness: 2,
        },
        label: "Crosshair",
      },
    ],
  });

/**
 * Pick the default UI layout for a given game plugin set id.
 * Consumers (useActiveUILayout's fallback path, PIE session, tests)
 * call this instead of importing `DEFAULT_UI_LAYOUT` directly so
 * the choice flows through the plugin game id.
 */
export function getDefaultUILayoutForGame(gameId: string): UILayoutManifest {
  switch (gameId) {
    case "shooter-demo":
      return SHOOTER_DEMO_UI_LAYOUT;
    default:
      return DEFAULT_UI_LAYOUT;
  }
}
