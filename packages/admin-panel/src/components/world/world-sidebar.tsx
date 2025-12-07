import { Search, Map as MapIcon, Box } from "lucide-react";
import type { WorldZone, WorldEntity } from "@/lib/actions/world";

interface WorldSidebarProps {
  zones: WorldZone[];
  entities: WorldEntity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function WorldSidebar({
  zones,
  entities,
  selectedId,
  onSelect,
}: WorldSidebarProps) {
  return (
    <div className="w-72 flex flex-col border-r border-(--border-primary) bg-(--bg-secondary)/30 backdrop-blur-sm min-w-0 min-h-0 overflow-hidden h-full">
      {/* Search */}
      <div className="p-3 border-b border-(--border-primary) bg-(--bg-tertiary)/20">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-(--text-muted)" />
          <input
            type="text"
            placeholder="FIND_COORD..."
            className="w-full bg-(--bg-primary) border border-(--border-primary) rounded-sm pl-8 pr-3 py-1.5 text-xs font-mono text-(--text-primary) focus:outline-none focus:border-(--accent-primary) placeholder-(--text-muted)/50 uppercase"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 py-4 endless-mask-y">
        <div className="space-y-4">
          {zones.map((zone) => {
            const zoneEntities = entities.filter((e) => e.zoneId === zone.id);
            const isSelected = selectedId === zone.id;

            return (
              <div key={zone.id} className="space-y-1">
                {/* Zone Header */}
                <div
                  className={`flex items-center gap-2 py-1 px-2 cursor-pointer border-l-2 transition-all duration-150 font-mono text-xs ${
                    isSelected
                      ? "bg-(--accent-primary)/10 border-(--accent-primary) text-(--text-primary)"
                      : "border-transparent hover:bg-(--bg-hover) text-(--text-secondary) hover:text-(--text-primary)"
                  }`}
                  onClick={() => onSelect(zone.id)}
                >
                  <MapIcon className="h-3 w-3 text-(--text-muted)" />
                  <span className="truncate">{zone.name}</span>
                  <span className="text-[10px] text-(--text-muted) ml-auto">
                    {zone.difficultyLevel}
                  </span>
                </div>

                {/* Entities in Zone */}
                {zoneEntities.length > 0 && (
                  <div className="ml-2 pl-2 border-l border-(--border-primary)/20 space-y-0.5">
                    {zoneEntities.map((entity) => (
                      <div
                        key={entity.id}
                        className={`flex items-center gap-2 py-0.5 px-2 cursor-pointer transition-all duration-150 font-mono text-[10px] ${
                          selectedId === entity.id
                            ? "text-(--accent-secondary) bg-(--accent-secondary)/5"
                            : "text-(--text-muted) hover:text-(--text-primary)"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(entity.id);
                        }}
                      >
                        <Box className="h-2 w-2" />
                        <span className="truncate">{entity.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
