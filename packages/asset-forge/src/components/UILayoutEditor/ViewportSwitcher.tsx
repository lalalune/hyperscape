/**
 * ViewportSwitcher — author-time variant selector tabs.
 *
 * Lets the author pick which authored variant they're editing:
 *   - Base   → the authored base manifest
 *   - Mobile / Tablet / Desktop → one of `manifest.variants[key]`
 *
 * Selection is stored on `canvasViewStore.activeVariant` (persisted)
 * so later panels — the inspector, the preview — can branch on it
 * without coordinating local state.
 *
 * Intentionally minimal: this component owns the selector UI only.
 * Wiring the preview to re-render via `applyLayoutVariant`, or
 * pointing the property inspector at `updateVariantOverride`, both
 * read `activeVariant` from the canvas view store.
 */

import {
  ACTIVE_VARIANT_OPTIONS,
  type ActiveVariant,
  useCanvasViewStore,
} from "./canvasViewStore";

const LABELS: Record<ActiveVariant, string> = {
  base: "Base",
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

const TITLES: Record<ActiveVariant, string> = {
  base: "Edit the authored base layout",
  mobile: "Edit the mobile variant overrides",
  tablet: "Edit the tablet variant overrides",
  desktop: "Edit the desktop variant overrides",
};

export function ViewportSwitcher() {
  const activeVariant = useCanvasViewStore((s) => s.activeVariant);
  const setActiveVariant = useCanvasViewStore((s) => s.setActiveVariant);

  return (
    <div
      role="tablist"
      aria-label="Variant selector"
      className="flex items-center gap-0.5 rounded border border-bg-tertiary bg-bg-primary p-0.5"
    >
      {ACTIVE_VARIANT_OPTIONS.map((v) => {
        const active = activeVariant === v;
        return (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={active}
            title={TITLES[v]}
            onClick={() => setActiveVariant(v)}
            className={
              "rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors " +
              (active
                ? "bg-primary/20 text-primary"
                : "text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary")
            }
          >
            {LABELS[v]}
          </button>
        );
      })}
    </div>
  );
}
