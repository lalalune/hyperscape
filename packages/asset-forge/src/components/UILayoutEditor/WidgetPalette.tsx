/**
 * WidgetPalette — click to drop a widget onto the layout.
 *
 * Widgets are grouped by category for easy scanning. Each entry is
 * a plain button; drag-drop to a specific canvas cell is a future
 * enhancement (Phase D4.5).
 */

import type { Widget, WidgetCategory } from "@hyperforge/ui-framework";
import { Plus } from "lucide-react";
import { uiLayoutRegistry } from "./registry";
import { useUILayoutStore } from "./store";

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  hud: "HUD",
  panel: "Panels",
  overlay: "Overlays",
  modal: "Modals",
  menu: "Menus",
  debug: "Debug",
};

export function WidgetPalette() {
  const addWidget = useUILayoutStore((s) => s.addWidget);
  const widgets = uiLayoutRegistry.listWidgets();

  // Group by category, preserving registration order within each.
  const byCategory = new Map<
    WidgetCategory,
    Widget<Record<string, unknown>>[]
  >();
  for (const w of widgets) {
    const cat = w.manifest.category;
    const arr = byCategory.get(cat);
    if (arr) arr.push(w);
    else byCategory.set(cat, [w]);
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
        Widget Palette
      </h2>

      {Array.from(byCategory.entries()).map(([category, items]) => (
        <section key={category} className="flex flex-col gap-1">
          <h3 className="text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
            {CATEGORY_LABELS[category]}
          </h3>
          {items.map((w) => (
            <button
              key={w.manifest.id}
              onClick={() => addWidget(w.manifest.id)}
              className="group flex items-center justify-between gap-2 rounded-md border border-bg-tertiary bg-bg-secondary px-5 py-4 text-left text-xs transition-colors hover:border-primary/50 hover:bg-bg-tertiary ease-out"
              title={w.manifest.description}
            >
              <span className="font-medium text-text-primary">
                {w.manifest.name}
              </span>
              <Plus
                size={14}
                className="text-text-tertiary transition-colors group-hover:text-primary ease-out"
              />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
