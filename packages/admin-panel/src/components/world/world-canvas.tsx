import { useRef, useState } from "react";
import type { WorldZone, WorldEntity } from "@/lib/actions/world";

interface WorldCanvasProps {
  zones: WorldZone[];
  entities: WorldEntity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function WorldCanvas({
  zones,
  entities,
  selectedId,
  onSelect,
}: WorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only pan if clicking on background or unhandled elements
    if ((e.target as HTMLElement).closest(".interactive-node")) return;

    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;

    setTransform((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));

    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Handle Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = 0.1;
    const delta = e.deltaY > 0 ? -scaleFactor : scaleFactor;
    const newScale = Math.max(0.1, Math.min(5, transform.scale + delta));

    setTransform((prev) => ({
      ...prev,
      scale: newScale,
    }));
  };

  // Convert/Scale Game Coordinates to Canvas CSS
  // Game coordinates might be -100 to 100. Canvas is centered.
  const SCALE = 20; // 1 unit in game = 20 pixels
  const toCanvas = (val: number) => val * SCALE;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-[#080808] overflow-hidden cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Infinite Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
              linear-gradient(var(--border-primary) 1px, transparent 1px), 
              linear-gradient(90deg, var(--border-primary) 1px, transparent 1px)
           `,
          backgroundSize: `${40 * transform.scale}px ${40 * transform.scale}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      />

      {/* World Stage */}
      <div
        className="absolute left-1/2 top-1/2 will-change-transform origin-center"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        {/* Render Zones */}
        {zones.map((zone) => {
          const w = toCanvas(zone.bounds.maxX - zone.bounds.minX);
          const h = toCanvas(zone.bounds.maxZ - zone.bounds.minZ);
          const x = toCanvas(zone.bounds.minX);
          const y = toCanvas(zone.bounds.minZ);
          const isSelected = selectedId === zone.id;

          const color =
            ((zone.metadata as Record<string, unknown>)?.color as string) ||
            "#333";

          return (
            <div
              key={zone.id}
              className={`absolute border-2 interactive-node transition-colors duration-200 group ${
                isSelected
                  ? "z-10 bg-opacity-20"
                  : "bg-opacity-10 hover:border-white"
              }`}
              style={{
                left: x,
                top: y,
                width: w,
                height: h,
                borderColor: color,
                backgroundColor: isSelected ? color : `${color}20`, // Hex alpha hack or just use style opacity
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect(zone.id);
              }}
            >
              {/* Zone Label */}
              <div
                className="absolute -top-6 left-0 px-2 py-0.5 border text-[10px] font-mono whitespace-nowrap"
                style={{
                  borderColor: color,
                  backgroundColor: "#000",
                  color: color,
                }}
              >
                {zone.name}
              </div>
            </div>
          );
        })}

        {/* Render Entities */}
        {entities.map((entity) => {
          // Entities position
          const x = toCanvas(entity.position.x);
          const z = toCanvas(entity.position.z);
          const isSelected = selectedId === entity.id;

          // Special rendering for Spawn Points with Radius
          if (
            entity.type === "spawn_point" &&
            (entity.metadata as Record<string, unknown>)?.radius
          ) {
            const radius = toCanvas(
              Number((entity.metadata as Record<string, unknown>).radius),
            );
            return (
              <div
                key={entity.id}
                className={`absolute rounded-full border border-dashed interactive-node transition-all duration-200 flex items-center justify-center ${
                  isSelected
                    ? "border-(--accent-secondary) bg-(--accent-secondary)/10 z-20"
                    : "border-(--text-muted)/50 bg-(--text-muted)/5 hover:border-(--text-secondary) z-10"
                }`}
                style={{
                  left: x - radius,
                  top: z - radius,
                  width: radius * 2,
                  height: radius * 2,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(entity.id);
                }}
                title={entity.name}
              >
                <div className="w-1 h-1 bg-(--text-muted) rounded-full" />
              </div>
            );
          }

          return (
            <div
              key={entity.id}
              className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full flex items-center justify-center interactive-node transition-transform duration-200 ${
                isSelected
                  ? "bg-(--accent-secondary) scale-150 z-20 shadow-[0_0_10px_var(--accent-secondary)]"
                  : "bg-(--text-muted) hover:bg-(--text-primary) hover:scale-125 z-10"
              }`}
              style={{
                left: x,
                top: z,
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect(entity.id);
              }}
              title={entity.name}
            >
              <div className="w-1.5 h-1.5 bg-black rounded-full" />
            </div>
          );
        })}

        {/* Center Origin Crosshair */}
        <div className="absolute left-0 top-0 w-4 h-px bg-red-500/50 -translate-x-2" />
        <div className="absolute left-0 top-0 w-px h-4 bg-red-500/50 -translate-y-2" />
      </div>
    </div>
  );
}
