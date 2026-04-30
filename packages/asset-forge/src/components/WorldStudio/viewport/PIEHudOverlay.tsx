/**
 * PIEHudOverlay — manifest-driven HUD overlay for the World Studio
 * PIE viewport.
 *
 * Closes the visible loop for criterion #4 ("a new game can be built
 * in World Studio by loading plugins"): the asset-forge editor now
 * actually renders plugin-contributed widgets while PIE is active.
 *
 * Lifecycle (owned by `usePIESession`):
 *   - When PIE starts, the hook creates a session-scoped
 *     `WidgetRegistry<UIWidgetComponent>` via `createUIWidgetRegistry()`
 *     + `bindAllWidgets()`. The registry is then passed both to
 *     `createPIEPluginHooks(gameId, registry)` (so plugin
 *     contributions land in it) AND to this component (so the
 *     overlay reads from the same registry instance).
 *   - When PIE stops, the plugin scope disposers unregister every
 *     contributed widget; the hook drops its reference to the
 *     registry.
 *
 * Layout selection: per-game minimal layouts defined inline below.
 * The hyperscape branch is intentionally empty for now — the full
 * HUD needs a `DataContext` populated from live player state that
 * the editor doesn't yet plumb. The shooter-demo branch mounts the
 * single crosshair instance, which renders without any data context
 * (purely prop-driven).
 *
 * `overlayPosition="absolute"` keeps the renderer scoped to the
 * viewport container — covering the editor's toolbars + dock would
 * be wrong.
 */

import {
  type UILayoutManifest,
  UILayoutManifestSchema,
} from "@hyperforge/ui-framework";
import {
  ManifestRenderer,
  type UIWidgetComponent,
} from "@hyperforge/ui-widgets";
import type { WidgetRegistry } from "@hyperforge/ui-framework";
import { HYPERSCAPE_DEFAULT_HUD_LAYOUT } from "@hyperforge/hyperscape";
import { useEffect, useMemo, useState } from "react";

import type { GamePluginSetId } from "../toolbar/gamePluginResolver";
import { useAgentPack } from "../state/agentPack";

const SHOOTER_DEMO_PIE_LAYOUT: UILayoutManifest = UILayoutManifestSchema.parse({
  id: "shooter-demo.pie",
  name: "Shooter Demo PIE HUD",
  description:
    "Minimal in-PIE HUD for the shooter-demo plugin. Just the crosshair contributed via ctx.widgets.register(crosshairRegistration).",
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

const EMPTY_PIE_LAYOUT: UILayoutManifest = UILayoutManifestSchema.parse({
  id: "pie.empty",
  name: "Empty PIE HUD",
  description: "Placeholder layout used when no game-specific layout exists.",
  instances: [],
});

function pickLayoutForGame(gameId: GamePluginSetId): UILayoutManifest {
  switch (gameId) {
    case "blank":
      // Phase B0'.C — blank projects boot without any game plugin,
      // so PIE renders no HUD. The viewport is just terrain.
      return EMPTY_PIE_LAYOUT;
    case "shooter-demo":
      return SHOOTER_DEMO_PIE_LAYOUT;
    case "hyperscape":
    default:
      // Phase B0'.F — Hyperia plugin contributes its default HUD
      // layout (HP bar, action bar, tooltip overlay). Bindings
      // resolve against the live `DataContext` PIE assembles via
      // `PIEEditorSession.getDataContext()` (B0.3).
      return HYPERSCAPE_DEFAULT_HUD_LAYOUT;
  }
}

export interface PIEHudOverlayProps {
  /**
   * Session-scoped widget registry the `usePIESession` hook owns.
   * Populated with builtins via `bindAllWidgets()` and any plugin
   * contributions made during PIE start. Null when PIE is not
   * running — the overlay returns null in that case.
   */
  registry: WidgetRegistry<UIWidgetComponent> | null;
  /**
   * Active game plugin set id, picked by `resolveGamePluginSetId()`
   * at PIE start. Determines which layout to render.
   */
  gameId: GamePluginSetId;
  /**
   * B0.3 — Live snapshot of player state from PIEEditorSession's
   * in-process server world. Polled every animation frame so widgets
   * with bindings like `$player.hp` reflect real values. Falls back
   * to empty record (which `resolveWidgetProps` handles by keeping
   * each widget's static prop) when PIE isn't running or the player
   * record isn't available.
   */
  getDataContext?: () => Record<string, unknown>;
}

export function PIEHudOverlay({
  registry,
  gameId,
  getDataContext,
}: PIEHudOverlayProps) {
  const agentPack = useAgentPack();
  // Agent-emitted pack wins over the static per-game layout when set.
  // Designers using the AI tab in the right sidebar see their
  // chat-designed HUD render live in PIE.
  const layout = useMemo(
    () => agentPack?.defaultLayout ?? pickLayoutForGame(gameId),
    [agentPack, gameId],
  );

  // Debug: surface what PIE is about to render so the chat-to-HUD
  // loop is observable in the console while the demo flow is new.
  if (typeof window !== "undefined") {
    const unresolved = layout.instances.filter(
      (inst) => !registry?.hasComponent(inst.widgetId),
    );
    // eslint-disable-next-line no-console
    console.info("[PIEHud] mount", {
      source: agentPack ? "agent" : "static",
      instances: layout.instances.length,
      registry: registry ? "ready" : "null",
      unresolvedWidgetIds: unresolved.map((i) => i.widgetId),
    });
  }

  // B0.3 — Poll live player state from PIE every animation frame.
  // `getDataContext` is stable (memo'd in usePIESession via
  // useCallback), so the effect only re-runs when registry mounts.
  // Each tick stores the new context in component state, triggering
  // a re-render of ManifestRenderer with fresh values. Widgets bound
  // to `$player.hp` etc. now show real values; others (purely
  // prop-driven, like the crosshair) ignore the data and behave
  // identically to before.
  const [dataContext, setDataContext] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (!getDataContext || !registry) return;
    let raf = 0;
    const tick = () => {
      const next = getDataContext();
      // Cheap reference compare won't help (new object each frame),
      // but React batching means the re-render itself is cheap when
      // values haven't changed. Skip if no agent pack and the layout
      // has no bindings — avoids work in the hyperscape-no-pack case.
      setDataContext(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getDataContext, registry]);

  if (!registry) return null;
  if (layout.instances.length === 0) return null;

  return (
    <ManifestRenderer
      registry={registry}
      layout={layout}
      dataContext={dataContext}
      overlayPosition="absolute"
    />
  );
}
