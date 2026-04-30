/**
 * ManifestRenderer — renders a `UILayoutManifest` against an injected
 * `WidgetRegistry`, resolving each instance's props through the
 * runtime-bindings layer before handing them to the bound React
 * component.
 *
 * Lives in `@hyperforge/ui-widgets` (not `@hyperforge/client`) so any
 * consumer with a populated registry can render manifests — the live
 * client HUD, the World Studio UI Layout Editor preview, the PIE
 * viewport overlay, etc. The client wraps this with its own
 * registry + a `MovableWidgetShell` for drag-to-edit; PIE wraps it
 * with a static shell for read-only rendering.
 *
 * Positioning:
 *   - `anchored` instances are absolutely positioned within a
 *     full-viewport overlay, anchored to one of the 9 documented
 *     corners/edges with a pixel offset (matches the editor preview).
 *   - `grid` / `flex` positions are not rendered yet — the editor
 *     preview demonstrates their intended behavior, but the live HUD
 *     only needs `anchored` for the current builtin set.
 *
 * The overlay itself is `pointer-events: none` so widgets don't block
 * underlying input; individual widget adapters opt back in via their
 * own styles when they need interaction (inventory, chat, tooltip).
 */

import {
  isWidgetVisible,
  parseCommandBinding,
  resolveWidgetProps,
  themeToCssVars,
  type AnchoredPosition,
  type CommandDispatchResult,
  type CommandRegistry,
  type DataContext,
  type PropResolutionIssue,
  type ThemeManifest,
  type UILayoutManifest,
  type WidgetCustomization,
  type WidgetInstance,
  type WidgetRegistry,
} from "@hyperforge/ui-framework";
import {
  memo,
  useMemo,
  type CSSProperties,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

import type { UIWidgetComponent } from "./bindings";

/**
 * Props handed to a `widgetShell` adapter. The built-in default is
 * `PassthroughShell` — renders `children` with no extra structure.
 * The client supplies its `MovableWidgetShell` here to layer drag-
 * to-edit behavior on top.
 */
export interface ManifestWidgetShellProps {
  instanceId: string;
  layoutId: string;
  layoutRevision: number | undefined;
  /**
   * Anchored position the renderer chose for this instance. Narrowed
   * to `AnchoredPosition` because the renderer only invokes the
   * shell for `kind === "anchored"` instances — grid/flex render
   * paths bypass the shell entirely.
   */
  position: AnchoredPosition;
  /** Customization policy from the manifest (movable, etc.). */
  customization: WidgetCustomization | undefined;
  /** Inline absolute-position style the renderer already computed. */
  anchorStyle: CSSProperties;
  children: ReactNode;
}

export type ManifestWidgetShell = ComponentType<ManifestWidgetShellProps>;

/**
 * Default shell — renders children inside a positioned div, no edit
 * affordance. Consumers that want movable widgets pass their own
 * shell component instead.
 */
const PassthroughShell: ManifestWidgetShell = function PassthroughShell({
  anchorStyle,
  children,
}) {
  return <div style={anchorStyle}>{children}</div>;
};

export interface ManifestRendererProps {
  /** Layout manifest to render. */
  layout: UILayoutManifest;
  /** Registry of widget schemas + bound React components. */
  registry: WidgetRegistry<UIWidgetComponent>;
  /** Runtime context consulted when resolving `bindings` on each instance. */
  dataContext: DataContext;
  /**
   * Optional theme resolver — called once per render when the layout
   * declares `themeId` (but no inline `theme`). Returning `null`
   * falls back to the host's default styles. Inline `layout.theme`
   * always wins over this lookup.
   */
  resolveTheme?: (themeId: string) => ThemeManifest | null;
  /**
   * Current game-mode context string. Matched against each instance's
   * `visibility.contexts` / `visibility.hiddenIn`. Pass `null` when no
   * context is modelled — expression-only visibility rules still work.
   * Common values: `"world"`, `"combat"`, `"menu"`, `"cutscene"`,
   * `"loading"`.
   */
  gameContext?: string | null;
  /**
   * Optional sink for non-fatal resolution issues (binding-failed,
   * invalid-expression, props-validation-failed). Fires once per
   * render per instance that has any issues. Defaults to a no-op so
   * production renders are silent; the editor passes a collector.
   */
  onIssues?: (instanceId: string, issues: PropResolutionIssue[]) => void;
  /**
   * Optional shell wrapper component. Defaults to `PassthroughShell`
   * (plain positioning, no edit affordance). The live client passes
   * its `MovableWidgetShell` here to enable drag-to-edit for widgets
   * whose customization policy permits it.
   */
  widgetShell?: ManifestWidgetShell;
  /**
   * Position scheme for the outer overlay div.
   *   - `"fixed"` (default) — covers the whole window. The live game
   *     HUD renders this way.
   *   - `"absolute"` — sized to the nearest positioned ancestor.
   *     Use this when embedding the renderer inside a bounded
   *     container (e.g. the World Studio PIE viewport overlay).
   */
  overlayPosition?: "fixed" | "absolute";
  /**
   * Optional command registry used to dispatch `actions` declared
   * on widget instances (Phase A2 of
   * `PLAN_AI_AUTHORING_FOUNDATIONS.md`). When omitted, widget
   * actions on the layout are rendered as no-ops — useful for
   * editor previews that show layout structure without firing
   * commands.
   */
  commandRegistry?: CommandRegistry;
  /**
   * Optional sink for the result of every action-binding dispatch.
   * Fires after each command resolves (or rejects). Defaults to a
   * no-op; the live client wires it to a toast / telemetry
   * pipeline so unknown-command / invalid-args / handler-threw
   * errors surface to the player.
   */
  onActionResult?: (
    instanceId: string,
    callbackName: string,
    result: CommandDispatchResult<unknown>,
  ) => void;
}

/**
 * Map an anchor name + pixel offset to a `CSSProperties` fragment
 * that pins the widget to the correct viewport edge.
 *
 * Anchors use the same axis convention as the editor preview:
 *   - positive X is always "further from the anchored side"
 *   - positive Y is always "further from the anchored side"
 *
 * So `{ anchor: "bottom-left", offset: { x: 24, y: -24 } }` reads as
 * "24px right of the left edge, 24px up from the bottom". Negative
 * offsets mirror the editor's screen-space semantics.
 */
function anchorStyle(
  anchor:
    | "top-left"
    | "top-center"
    | "top-right"
    | "middle-left"
    | "center"
    | "middle-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right",
  offset: { x: number; y: number },
): CSSProperties {
  const style: CSSProperties = { position: "absolute" };
  const { x, y } = offset;

  // Vertical
  if (anchor.startsWith("top")) {
    style.top = y;
  } else if (anchor.startsWith("bottom")) {
    style.bottom = -y;
  } else {
    style.top = "50%";
    style.transform = "translateY(-50%)";
  }

  // Horizontal
  if (anchor.endsWith("left")) {
    style.left = x;
  } else if (anchor.endsWith("right")) {
    style.right = -x;
  } else {
    style.left = "50%";
    const existing = style.transform;
    style.transform = existing
      ? `${existing} translateX(-50%)`
      : "translateX(-50%)";
  }

  return style;
}

interface InstanceViewProps {
  instance: WidgetInstance;
  registry: WidgetRegistry<UIWidgetComponent>;
  dataContext: DataContext;
  layoutId: string;
  layoutRevision: number | undefined;
  shell: ManifestWidgetShell;
  onIssues?: (instanceId: string, issues: PropResolutionIssue[]) => void;
  commandRegistry?: CommandRegistry;
  onActionResult?: (
    instanceId: string,
    callbackName: string,
    result: CommandDispatchResult<unknown>,
  ) => void;
}

function InstanceView({
  instance,
  registry,
  dataContext,
  layoutId,
  layoutRevision,
  shell: Shell,
  onIssues,
  commandRegistry,
  onActionResult,
}: InstanceViewProps): ReactElement | null {
  const widget = registry.getWidget(instance.widgetId);
  if (!widget) {
    // Validation should have caught this upstream; rendering nothing
    // here rather than throwing keeps the HUD resilient to late
    // manifest changes.
    return null;
  }

  const Component = registry.getComponent(instance.widgetId);
  const resolved = resolveWidgetProps(
    instance.props,
    instance.bindings,
    widget.propsSchema,
    dataContext,
  );

  if (resolved.issues.length > 0 && onIssues) {
    onIssues(instance.instanceId, resolved.issues);
  }

  if (!resolved.ok) {
    // Drop the instance if the merged props don't satisfy the schema
    // — surfacing it via onIssues is enough.
    return null;
  }

  // Build action callbacks. Each entry on `instance.actions` becomes
  // a (arg) => void prop spread into the component. Without a
  // command registry we leave the prop undefined; the widget's
  // *RuntimeProps callback signature already treats it as optional.
  const actionCallbacks: Record<string, (arg?: unknown) => void> = {};
  if (commandRegistry && instance.actions) {
    for (const [callbackName, expression] of Object.entries(instance.actions)) {
      // Parse once outside the callback so a malformed expression
      // surfaces synchronously rather than on first click.
      let commandId: string;
      try {
        ({ commandId } = parseCommandBinding(expression));
      } catch (err) {
        if (onIssues) {
          onIssues(instance.instanceId, [
            {
              code: "invalid-expression",
              key: callbackName,
              message:
                err instanceof Error
                  ? err.message
                  : `Failed to parse action binding "${expression}"`,
            },
          ]);
        }
        continue;
      }
      actionCallbacks[callbackName] = (arg?: unknown) => {
        // Fire-and-forget dispatch. The result is surfaced through
        // `onActionResult`; callers that need to await dispatch
        // (rare in click handlers) can capture the promise via the
        // result sink.
        void commandRegistry.dispatch(commandId, arg ?? {}).then(
          (result) => {
            if (onActionResult) {
              onActionResult(instance.instanceId, callbackName, result);
            }
          },
          // `.dispatch` already catches handler-thrown errors and
          // returns them as `ok: false`. The reject branch should
          // be unreachable, but defensive coverage keeps a
          // promise-rejection from going to console.
          /* istanbul ignore next */ () => {},
        );
      };
    }
  }

  // Only `anchored` positions are rendered in the live HUD so far.
  // Grid and flex come when the editor's layout canvas is flipped to
  // match (tracked in the D6 exit criterion).
  if (instance.position.kind !== "anchored") return null;

  const style = anchorStyle(instance.position.anchor, instance.position.offset);

  return (
    <Shell
      instanceId={instance.instanceId}
      layoutId={layoutId}
      layoutRevision={layoutRevision}
      position={instance.position}
      customization={instance.customization}
      anchorStyle={style}
    >
      <div data-widget-id={instance.widgetId} style={{ pointerEvents: "auto" }}>
        <Component {...resolved.props} {...actionCallbacks} />
      </div>
    </Shell>
  );
}

/**
 * Top-level renderer: wraps all instances in a fixed-position
 * overlay. The overlay is pointer-events:none so the manifest layer
 * is non-blocking; individual widgets opt back into pointer events
 * via their own styles.
 */
export const ManifestRenderer = memo(function ManifestRenderer({
  layout,
  registry,
  dataContext,
  gameContext = null,
  resolveTheme,
  onIssues,
  widgetShell,
  overlayPosition = "fixed",
  commandRegistry,
  onActionResult,
}: ManifestRendererProps) {
  const Shell = widgetShell ?? PassthroughShell;

  const visibleInstances = useMemo(
    () =>
      layout.instances.filter((inst) =>
        isWidgetVisible({
          instance: inst,
          gameContext,
          data: dataContext,
        }),
      ),
    [layout, gameContext, dataContext],
  );

  // Resolve the scoped theme: inline wins, then themeId lookup, then
  // nothing (inherit host defaults). `themeToCssVars` returns a flat
  // `{ --var: value }` map that spreads directly onto the overlay's
  // inline style, scoping the tokens to the HUD subtree instead of
  // polluting :root.
  const themeVars = useMemo<Record<string, string>>(() => {
    const inline = layout.theme;
    if (inline) return themeToCssVars(inline);
    const id = layout.themeId;
    if (id && resolveTheme) {
      const resolved = resolveTheme(id);
      if (resolved) return themeToCssVars(resolved);
    }
    return {};
  }, [layout.theme, layout.themeId, resolveTheme]);

  return (
    <div
      data-layout-id={layout.id}
      style={{
        position: overlayPosition,
        inset: 0,
        pointerEvents: "none",
        // Layer above the runtime client's hand-coded HUD. The
        // native HUD widgets at localhost:3333 (status bars, action
        // bar, modals, draggable windows) use Tailwind z-10 / z-20
        // / z-50 — at the previous zIndex: 10 the manifest layer
        // sat at or below them and an agent-built pack rendered
        // *underneath* the native HUD. Lift to a value above any
        // realistic z-stack so manifest-driven HUDs are reliably
        // on top during the A/B migration.
        zIndex: 9999,
        ...(themeVars as CSSProperties),
      }}
    >
      {visibleInstances.map((instance) => (
        <InstanceView
          key={instance.instanceId}
          instance={instance}
          registry={registry}
          dataContext={dataContext}
          layoutId={layout.id}
          layoutRevision={layout.revision}
          shell={Shell}
          onIssues={onIssues}
          commandRegistry={commandRegistry}
          onActionResult={onActionResult}
        />
      ))}
    </div>
  );
});
