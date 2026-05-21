/**
 * LayoutOutliner — list of widget instances in the current layout.
 *
 * Click an entry to select it (drives the inspector). Uses the
 * widget manifest's icon/name when available.
 */

import { Link2, Trash2 } from "lucide-react";
import { uiLayoutRegistry } from "./registry";
import { useUILayoutStore } from "./store";

export function LayoutOutliner() {
  const instances = useUILayoutStore((s) => s.layout.instances);
  const selectedId = useUILayoutStore((s) => s.selectedInstanceId);
  const select = useUILayoutStore((s) => s.selectInstance);
  const remove = useUILayoutStore((s) => s.removeInstance);

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      {instances.length === 0 ? (
        <p className="text-xs text-text-tertiary">
          No widgets yet. Add one from the palette.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {instances.map((inst) => {
            const widget = uiLayoutRegistry.getWidget(inst.widgetId);
            const isSelected = inst.instanceId === selectedId;
            return (
              <li key={inst.instanceId}>
                <div
                  className={`group flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? "border-primary/60 bg-primary/10 text-text-primary"
                      : "border-bg-tertiary bg-bg-secondary text-text-primary hover:border-bg-tertiary/80 hover:bg-bg-tertiary"
                  } ease-out`}
                >
                  <button
                    onClick={() => select(inst.instanceId)}
                    className="flex flex-1 flex-col items-start"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      {inst.label ?? inst.instanceId}
                      {inst.bindings &&
                        Object.keys(inst.bindings).length > 0 && (
                          <Link2
                            size={10}
                            className="text-primary/70"
                            aria-label={`${Object.keys(inst.bindings).length} binding(s)`}
                          />
                        )}
                    </span>
                    <span className="text-[10px] text-text-tertiary">
                      {widget?.manifest.name ?? inst.widgetId} ·{" "}
                      {inst.instanceId}
                    </span>
                  </button>
                  <button
                    onClick={() => remove(inst.instanceId)}
                    className="text-text-tertiary opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 ease-out"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
