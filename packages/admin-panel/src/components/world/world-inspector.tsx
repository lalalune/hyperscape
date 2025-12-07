import { ChevronRight, Target } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import type { WorldZone, WorldEntity } from "@/lib/actions/world";

interface WorldInspectorProps {
  zone: WorldZone | null;
  entity: WorldEntity | null;
  onClose: () => void;
}

export function WorldInspector({ zone, entity, onClose }: WorldInspectorProps) {
  if (!zone && !entity) return null;

  return (
    <div className="w-80 bg-(--bg-secondary)/50 backdrop-blur-md border-l border-(--border-primary) flex flex-col min-w-0 min-h-0 overflow-hidden h-full">
      <div className="h-10 border-b border-(--border-primary) flex items-center justify-between px-3 bg-(--bg-tertiary)">
        <span className="text-xs font-bold uppercase text-(--text-muted) tracking-wider flex items-center gap-2">
          <Target className="h-3 w-3" /> Node Inspector
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 py-6 endless-mask-y">
        {zone && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-mono font-bold text-(--text-primary) uppercase leading-none">
                {zone.name}
              </h3>
              <p className="text-xs text-(--text-muted) font-mono mt-1">
                {zone.id}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] text-(--text-muted) uppercase font-mono">
                Zone Parameters
              </p>
              <div className="border border-(--border-primary) rounded-sm divide-y divide-(--border-primary)">
                <PropRow label="Level" value={zone.difficultyLevel} />
                <PropRow label="Biome" value={zone.biomeType} />
                <PropRow label="Safe" value={zone.safeZone ? "YES" : "NO"} />
              </div>
            </div>

            {/* Procedural Rules Block */}
            {zone.metadata && (
              <div className="space-y-2">
                <p className="text-[10px] text-(--text-muted) uppercase font-mono">
                  Biome Rules
                </p>
                <div className="p-2 border border-(--border-primary) bg-(--bg-primary)/30 font-mono text-xs space-y-2">
                  {(zone.metadata.resourceTypes as string[]) && (
                    <div>
                      <span className="text-(--text-muted) block mb-1">
                        Potential Resources:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(zone.metadata.resourceTypes as string[]).map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className="text-[10px] h-4 border-(--text-muted) text-(--text-secondary)"
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(zone.metadata.heightRange as number[]) && (
                    <div className="flex justify-between">
                      <span className="text-(--text-muted)">Elevation:</span>
                      <span>
                        {(zone.metadata.heightRange as number[]).join(" - ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[10px] text-(--text-muted) uppercase font-mono">
                Spatial Bounds
              </p>
              <div className="grid grid-cols-2 gap-2 p-2 border border-(--border-primary) bg-(--bg-primary)/30 font-mono text-xs">
                <span className="text-(--text-muted)">Min:</span>
                <span className="text-right">
                  {zone.bounds.minX}, {zone.bounds.minZ}
                </span>
                <span className="text-(--text-muted)">Max:</span>
                <span className="text-right">
                  {zone.bounds.maxX}, {zone.bounds.maxZ}
                </span>
              </div>
            </div>

            <div className="p-3 border border-(--border-primary) bg-(--bg-primary)/30 text-xs text-(--text-secondary) italic">
              &quot;{zone.description || "No description available"}&quot;
            </div>
          </div>
        )}

        {entity && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-mono font-bold text-(--text-primary) uppercase leading-none">
                {entity.name}
              </h3>
              <Badge
                variant="outline"
                className="mt-2 text-[10px] h-5 rounded-none border-(--accent-secondary) text-(--accent-secondary)"
              >
                {entity.type.toUpperCase()}
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] text-(--text-muted) uppercase font-mono">
                Coordinates
              </p>
              <div className="p-2 border border-(--border-primary) bg-(--bg-primary)/30 font-mono text-xs flex justify-between">
                <span className="text-(--text-muted)">XYZ:</span>
                <span className="text-(--text-primary)">
                  {entity.position.x}, {entity.position.y}, {entity.position.z}
                </span>
              </div>
            </div>

            {entity.metadata && (
              <div className="space-y-2">
                <p className="text-[10px] text-(--text-muted) uppercase font-mono">
                  Metadata
                </p>
                <div className="border border-(--border-primary) rounded-sm divide-y divide-(--border-primary)">
                  {Object.entries(entity.metadata).map(([k, v]) => (
                    <PropRow key={k} label={k} value={String(v)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between p-2 bg-(--bg-primary)/30">
      <span className="text-[10px] text-(--text-secondary) uppercase">
        {label}
      </span>
      <span className="text-xs font-mono text-(--text-primary)">{value}</span>
    </div>
  );
}
