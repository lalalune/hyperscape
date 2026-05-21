/**
 * ViewportOverlay -- UE5-inspired info overlay for the 3D viewport.
 *
 * Clean, minimal HUD with frosted-glass chips in four corners:
 *   Top-left:     Selected entity chip
 *   Top-right:    Grid/snap toggles, coordinate system
 *   Bottom-left:  Camera position + minimap toggle
 *   Bottom-right: FPS, tile progress, entity count, active tool
 *
 * IMPORTANT: All text/backgrounds use explicit colors (NOT theme tokens)
 * because this overlay sits on an unpredictable 3D scene background.
 *
 * PERFORMANCE: This overlay must be lightweight. No requestAnimationFrame
 * loops — minimap redraws only when data changes, FPS uses a simple interval.
 */

import {
  Grid3x3,
  Magnet,
  Mountain,
  Globe,
  Box,
  MapPin,
  Crosshair,
  Paintbrush,
  Route,
  Sparkles,
  MousePointer2,
  Layers,
  Map,
  X,
  HelpCircle,
  Flame,
  Hexagon,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Minimal biome data for minimap rendering */
export interface MinimapBiome {
  type: string;
  tileKeys: string[];
}

export interface MinimapRoad {
  path: Array<{ x: number; z: number }>;
}

export interface ViewportOverlayProps {
  selection: { type: string; id: string; name?: string } | null;
  entityCount: number;
  activeTool: string;
  transformMode: string;
  transformSpace: string;
  cameraPosition?: { x: number; y: number; z: number };
  gridEnabled: boolean;
  snapEnabled: boolean;
  surfaceSnap: boolean;
  /** Current grid snap size in meters */
  gridSize: number;
  tileProgress?: { loaded: number; total: number } | null;
  /** World size in tiles (for minimap) */
  worldSizeTiles?: number;
  /** Tile size in meters */
  tileSize?: number;
  /** Biome data for minimap */
  biomes?: MinimapBiome[];
  /** Roads for minimap */
  roads?: MinimapRoad[];
  /** Towns for minimap markers */
  towns?: Array<{
    id: string;
    name: string;
    position: { x: number; z: number };
    size: string;
  }>;
  /** Teleport camera to world position */
  onNavigateCamera?: (x: number, z: number) => void;
  /** Whether the camera is in RMB fly mode */
  flyMode?: boolean;
  /** Current camera move speed (m/s) */
  cameraMoveSpeed?: number;
  /** Whether difficulty heatmap is shown */
  showDifficultyHeatmap?: boolean;
  /** Toggle difficulty heatmap */
  onToggleDifficultyHeatmap?: () => void;
  /** Populate all regions with procgen entities */
  onPopulateAllRegions?: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onToggleSurfaceSnap: () => void;
  /** Cycle to next grid size */
  onCycleGridSize: () => void;
  /** GPU renderer stats (updated every 2s) */
  rendererStats?: {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number): string {
  return v.toFixed(1);
}

const TYPE_ICONS: Record<string, typeof MapPin> = {
  spawnPoint: MapPin,
  teleport: MapPin,
  mobSpawn: Crosshair,
  resource: Box,
  station: Box,
  poi: MapPin,
  waterBody: MapPin,
  gameNpc: MapPin,
  gameStation: Box,
  gameResource: Box,
  gameMobSpawn: Crosshair,
  npc: MapPin,
  quest: MapPin,
  boss: Crosshair,
  town: MapPin,
  building: Box,
  vegetation: MapPin,
  tile: Grid3x3,
};

const TOOL_LABELS: Record<
  string,
  { label: string; icon: typeof MousePointer2 }
> = {
  select: { label: "Select", icon: MousePointer2 },
  place: { label: "Place", icon: MapPin },
  brush: { label: "Brush", icon: Paintbrush },
  path: { label: "Path", icon: Route },
  procgen: { label: "Procgen", icon: Sparkles },
  zonePaint: { label: "Paint Zone", icon: Hexagon },
};

/** Biome type → minimap color */
const BIOME_COLORS: Record<string, string> = {
  forest: "#2d5a27",
  plains: "#7ab648",
  desert: "#c4a35a",
  mountain: "#8b7d6b",
  swamp: "#4a5a3a",
  tundra: "#c8d4d8",
  volcanic: "#5a2a1a",
  coastal: "#6aafe0",
  caves: "#3a3a4a",
  canyon: "#a0764a",
};

/** Shared chip style — deep frosted glass for passive HUD */
const CHIP =
  "inline-flex items-center gap-1.5 bg-[rgba(8,9,14,0.78)] backdrop-blur-xl rounded-[5px] px-2.5 py-1 border border-white/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.5)]";

/** Button — opaque surface for interactive controls */
const CHIP_BTN_OFF =
  "flex items-center gap-1 px-2 py-1 rounded-[4px] bg-[#141416] text-white/50 hover:text-white/80 hover:bg-[#1e1f28] border border-[#1C1E22] transition-all duration-120";
const CHIP_BTN_ON =
  "flex items-center gap-1 px-2 py-1 rounded-[4px] bg-[rgba(99,102,241,0.12)] text-primary border border-primary/40 shadow-[0_0_8px_rgba(99,102,241,0.15)] transition-all duration-120";

// ---------------------------------------------------------------------------
// Minimap Popover — draws once per data change, NO animation loop
// ---------------------------------------------------------------------------

const MINIMAP_SIZE = 220;

function MinimapPopover({
  worldSizeTiles,
  tileSize,
  biomes,
  roads,
  towns,
  cameraPosition,
  onNavigate,
  onClose,
}: {
  worldSizeTiles: number;
  tileSize: number;
  biomes: MinimapBiome[];
  roads: MinimapRoad[];
  towns: Array<{
    id: string;
    name: string;
    position: { x: number; z: number };
    size: string;
  }>;
  cameraPosition: { x: number; y: number; z: number };
  onNavigate: (x: number, z: number) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldExtent = worldSizeTiles * tileSize;
  const scale = MINIMAP_SIZE / worldExtent;

  // Pre-build a tile→color lookup from biomes (only when biomes change)
  const tileColorMap = useMemo(() => {
    const map = new window.Map<string, string>();
    for (const biome of biomes) {
      const color = BIOME_COLORS[biome.type] ?? "#3a3a3a";
      for (const key of biome.tileKeys) {
        map.set(key, color);
      }
    }
    return map;
  }, [biomes]);

  // Pre-render the static biome layer to an offscreen canvas (expensive, only when biomes change)
  const biomeImageRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const offscreen = document.createElement("canvas");
    offscreen.width = MINIMAP_SIZE;
    offscreen.height = MINIMAP_SIZE;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    // Ocean background
    ctx.fillStyle = "#0a1628";
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Draw each biome tile
    const tilePx = Math.max(1, Math.ceil(tileSize * scale));
    for (const [key, color] of tileColorMap) {
      const [xStr, zStr] = key.split(",");
      const tx = parseInt(xStr) * tileSize * scale;
      const tz = parseInt(zStr) * tileSize * scale;
      ctx.fillStyle = color;
      ctx.fillRect(tx, tz, tilePx, tilePx);
    }

    biomeImageRef.current = offscreen;
  }, [tileColorMap, tileSize, scale]);

  // Draw the full minimap (static biome + dynamic overlays) — called once per prop change
  useEffect(() => {
    const canvas = canvasRef.current;
    const biomeCanvas = biomeImageRef.current;
    if (!canvas || !biomeCanvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Stamp the pre-rendered biome layer
    ctx.drawImage(biomeCanvas, 0, 0);

    // Roads
    ctx.strokeStyle = "#8a7a6a";
    ctx.lineWidth = Math.max(1, 2 * scale);
    for (const road of roads) {
      if (road.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(road.path[0].x * scale, road.path[0].z * scale);
      for (let i = 1; i < road.path.length; i++) {
        ctx.lineTo(road.path[i].x * scale, road.path[i].z * scale);
      }
      ctx.stroke();
    }

    // Towns
    ctx.fillStyle = "#ffa500";
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    for (const town of towns) {
      const tx = town.position.x * scale;
      const tz = town.position.z * scale;
      const r = town.size === "town" ? 5 : 3;

      ctx.beginPath();
      ctx.arc(tx, tz, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();

      // Name
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(town.name, tx, tz - r - 3);
      ctx.fillStyle = "#ffa500";
    }

    // Camera
    const cx = cameraPosition.x * scale;
    const cz = cameraPosition.z * scale;
    ctx.strokeStyle = "#F5F5F5";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cz, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(cx, cz, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [cameraPosition, roads, towns, scale]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const wx = (e.clientX - rect.left) / scale;
      const wz = (e.clientY - rect.top) / scale;
      onNavigate(wx, wz);
    },
    [scale, onNavigate],
  );

  return (
    <div className="bg-[rgba(10,11,16,0.92)] backdrop-blur-xl border border-[#1C1E22] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-2 mb-1.5">
      <div className="flex items-center justify-between mb-1 px-0.5">
        <span className="text-[9px] text-white/50 uppercase tracking-wider font-medium">
          World Map
        </span>
        <button
          className="p-0.5 rounded text-white/40 hover:text-white hover:bg-[#333] transition-colors"
          onClick={onClose}
        >
          <X size={10} />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className="rounded cursor-crosshair"
        onClick={handleClick}
        title="Click to teleport"
      />
      <div className="flex items-center justify-between mt-1 px-0.5 text-[8px] text-white/30">
        <span>Click to teleport</span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 bg-[#ffa500] inline-block rounded-full" />{" "}
            Town
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />{" "}
            You
          </span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FPS hook — simple interval, no RAF loop
// ---------------------------------------------------------------------------

function useFps(): number {
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  // Count frames via a lightweight RAF callback that does NO work except increment
  useEffect(() => {
    let rafId: number;
    const countFrame = () => {
      frameCountRef.current++;
      rafId = requestAnimationFrame(countFrame);
    };
    rafId = requestAnimationFrame(countFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Read accumulated count every 2 seconds (not every second — halves React re-renders)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      if (elapsed > 0) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
      }
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return fps;
}

// ---------------------------------------------------------------------------
// Controls Help Tooltip — hover to reveal camera/editing shortcuts
// ---------------------------------------------------------------------------

const CONTROLS_ROWS: Array<[string, string]> = [
  ["LMB Drag", "Orbit"],
  ["MMB Drag", "Pan"],
  ["Scroll", "Zoom"],
  ["RMB Hold", "Fly mode"],
  ["WASD", "Move (fly)"],
  ["Q / E", "Down / Up (fly)"],
  ["Scroll (fly)", "Adjust speed"],
  ["[ / ]", "Speed −/+ (fly)"],
  ["F", "Focus selection"],
  ["W / E / R", "Translate / Rotate / Scale"],
  ["Del", "Delete selection"],
  ["—", "— Zone Paint (Z) —"],
  ["LMB / Drag", "Paint tiles"],
  ["RMB / Drag", "Erase tiles"],
  ["[ / ]", "Brush size −/+"],
  ["E", "Toggle paint/erase"],
];

function ControlsTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={`${CHIP_BTN_OFF} text-[10px]`}
        title="Camera & Editing Controls"
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle size={10} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-1.5 bg-[rgba(8,9,14,0.92)] backdrop-blur-xl rounded-lg border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-3 w-56 pointer-events-auto">
          <div className="text-[9px] text-white/50 uppercase tracking-wider font-medium mb-1.5">
            Controls
          </div>
          <div className="space-y-0.5">
            {CONTROLS_ROWS.map(([key, action]) => (
              <div
                key={key}
                className="flex items-center justify-between text-[10px]"
              >
                <span className="text-white/50 font-medium">{key}</span>
                <span className="text-white/80">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewportOverlay({
  selection,
  entityCount,
  activeTool,
  transformMode,
  transformSpace,
  cameraPosition,
  gridEnabled,
  snapEnabled,
  surfaceSnap,
  gridSize,
  tileProgress,
  worldSizeTiles,
  tileSize,
  biomes,
  roads,
  towns,
  onNavigateCamera,
  flyMode,
  cameraMoveSpeed,
  showDifficultyHeatmap,
  onToggleDifficultyHeatmap,
  onPopulateAllRegions,
  onToggleGrid,
  onToggleSnap,
  onToggleSurfaceSnap,
  onCycleGridSize,
  rendererStats,
}: ViewportOverlayProps) {
  const fps = useFps();
  const [showMinimap, setShowMinimap] = useState(false);

  const toolInfo = TOOL_LABELS[activeTool] ?? {
    label: activeTool,
    icon: MousePointer2,
  };
  const ToolIcon = toolInfo.icon;
  const SelectionIcon = selection ? (TYPE_ICONS[selection.type] ?? Box) : Box;

  const tilesLoading = tileProgress && tileProgress.loaded < tileProgress.total;
  const hasMinimapData =
    worldSizeTiles && tileSize && biomes && cameraPosition && onNavigateCamera;

  return (
    <div className="absolute inset-0 pointer-events-none z-[5] flex flex-col justify-between p-2.5 font-mono text-[10px]">
      {/* ---- Top row ---- */}
      <div className="flex items-start justify-between">
        {/* Top-left: selected entity chip */}
        <div className="min-w-0">
          {selection && (
            <div className={CHIP}>
              <SelectionIcon size={10} className="text-primary shrink-0" />
              <span className="text-white/90 font-medium truncate max-w-[200px]">
                {selection.name ?? selection.id}
              </span>
              <span className="text-white/40">{selection.type}</span>
            </div>
          )}
        </div>

        {/* Top-right: viewport controls — right margin clears Player Preview + ViewModeDropdown */}
        <div className="flex items-center gap-1 pointer-events-auto mr-[220px]">
          <button
            className={`${gridEnabled ? CHIP_BTN_ON : CHIP_BTN_OFF} text-[10px]`}
            onClick={onToggleGrid}
            title={gridEnabled ? "Hide Grid" : "Show Grid"}
          >
            <Grid3x3 size={10} />
          </button>

          <button
            className={`${snapEnabled ? CHIP_BTN_ON : CHIP_BTN_OFF} text-[10px]`}
            onClick={onToggleSnap}
            title={snapEnabled ? "Snap ON" : "Snap OFF"}
          >
            <Magnet size={10} />
          </button>

          {snapEnabled && (
            <button
              className={`${CHIP_BTN_ON} text-[10px]`}
              onClick={onCycleGridSize}
              title={`Grid: ${gridSize}m (click to cycle)`}
            >
              <span className="text-primary font-medium">{gridSize}m</span>
            </button>
          )}

          <button
            className={`${surfaceSnap ? CHIP_BTN_ON : CHIP_BTN_OFF} text-[10px]`}
            onClick={onToggleSurfaceSnap}
            title={surfaceSnap ? "Surface Snap ON" : "Surface Snap OFF"}
          >
            <Mountain size={10} />
          </button>

          {onToggleDifficultyHeatmap && (
            <button
              className={`${showDifficultyHeatmap ? CHIP_BTN_ON : CHIP_BTN_OFF} text-[10px]`}
              onClick={onToggleDifficultyHeatmap}
              title={
                showDifficultyHeatmap
                  ? "Hide Difficulty Heatmap"
                  : "Show Difficulty Heatmap"
              }
            >
              <Flame size={10} />
            </button>
          )}

          {onPopulateAllRegions && (
            <button
              className={`${CHIP_BTN_OFF} text-[10px]`}
              onClick={onPopulateAllRegions}
              title="Populate All Regions (procgen entities)"
            >
              <Sparkles size={10} />
            </button>
          )}

          {/* Coordinate system */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-[#141416] text-white/50 border border-[#1C1E22] text-[10px]">
            {transformSpace === "world" ? (
              <Globe size={10} />
            ) : (
              <Box size={10} />
            )}
            <span>{transformSpace === "world" ? "World" : "Local"}</span>
          </div>
        </div>
      </div>

      {/* ---- Bottom row ---- */}
      <div className="flex items-end justify-between">
        {/* Bottom-left: minimap popover + camera position */}
        <div className="flex flex-col items-start gap-1 pointer-events-auto">
          {/* Minimap popover — only mounted when visible */}
          {showMinimap && hasMinimapData && (
            <MinimapPopover
              worldSizeTiles={worldSizeTiles}
              tileSize={tileSize}
              biomes={biomes}
              roads={roads ?? []}
              towns={towns ?? []}
              cameraPosition={cameraPosition}
              onNavigate={onNavigateCamera}
              onClose={() => setShowMinimap(false)}
            />
          )}

          {/* Camera position + map toggle */}
          <div className="flex items-center gap-1">
            {/* Map toggle button */}
            {hasMinimapData && (
              <button
                className={`${showMinimap ? CHIP_BTN_ON : CHIP_BTN_OFF} text-[10px]`}
                onClick={() => setShowMinimap((v) => !v)}
                title={showMinimap ? "Hide Map" : "Show Map (M)"}
              >
                <Map size={10} />
              </button>
            )}

            {/* Camera coordinates */}
            {cameraPosition && (
              <div className={CHIP}>
                <span>
                  <span className="text-red-400 font-semibold">X</span>
                  <span className="text-white/80 ml-0.5">
                    {fmt(cameraPosition.x)}
                  </span>
                </span>
                <span>
                  <span className="text-green-400 font-semibold">Y</span>
                  <span className="text-white/80 ml-0.5">
                    {fmt(cameraPosition.y)}
                  </span>
                </span>
                <span>
                  <span className="text-blue-400 font-semibold">Z</span>
                  <span className="text-white/80 ml-0.5">
                    {fmt(cameraPosition.z)}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom-right: status bar + controls help */}
        <div className="flex items-end gap-1 pointer-events-auto">
          {/* Controls help tooltip */}
          <ControlsTooltip />

          <div className={CHIP}>
            {/* FPS */}
            <span
              className={`font-semibold ${
                fps >= 50
                  ? "text-green-400"
                  : fps >= 30
                    ? "text-amber-400"
                    : "text-red-400"
              }`}
            >
              {fps}
            </span>
            <span className="text-white/40">FPS</span>

            <span className="text-white/15 mx-0.5">|</span>

            {/* Tile progress (only while loading) */}
            {tilesLoading && (
              <>
                <span className="text-amber-400 font-medium">
                  {tileProgress.loaded}
                </span>
                <span className="text-white/40">
                  /{tileProgress.total} tiles
                </span>
                <span className="text-white/15 mx-0.5">|</span>
              </>
            )}

            {/* Entity count */}
            <Layers size={9} className="text-white/40" />
            <span className="text-white/70">{entityCount}</span>

            {/* Renderer stats */}
            {rendererStats && (
              <>
                <span className="text-white/15 mx-0.5">|</span>
                <span className="text-white/50">{rendererStats.drawCalls}</span>
                <span className="text-white/30 text-[8px]">draws</span>
                <span className="text-white/15 mx-0.5">|</span>
                <span className="text-white/50">
                  {rendererStats.triangles >= 1_000_000
                    ? `${(rendererStats.triangles / 1_000_000).toFixed(1)}M`
                    : `${(rendererStats.triangles / 1_000).toFixed(0)}K`}
                </span>
                <span className="text-white/30 text-[8px]">tris</span>
              </>
            )}

            <span className="text-white/15 mx-0.5">|</span>

            {/* Fly mode speed */}
            {flyMode && cameraMoveSpeed != null && (
              <>
                <span className="text-sky-400 font-medium">
                  {Math.round(cameraMoveSpeed)}
                </span>
                <span className="text-white/40">m/s</span>
                <span className="text-white/15 mx-0.5">|</span>
              </>
            )}

            {/* Active tool */}
            <ToolIcon size={10} className="text-white/50" />
            <span className="text-white/70">
              {flyMode ? "Fly" : toolInfo.label}
            </span>
            {!flyMode && activeTool === "select" && (
              <span className="text-white/40">{transformMode}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
