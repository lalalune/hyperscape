/**
 * TileBasedTerrain - Real tile-based terrain viewer matching the game's terrain system
 *
 * This component renders terrain exactly as it appears in the game:
 * - Individual 100m x 100m tiles as separate THREE.Mesh objects
 * - Same terrain generation via TerrainGenerator from @hyperforge/procgen
 * - Tile loading/unloading based on camera position
 * - Fly camera controls for exploration
 * - Town markers showing generated towns
 *
 * Uses WebGPU renderer for TSL/node materials compatibility.
 */

import { BuildingGenerator } from "@hyperforge/procgen/building";
import { TownGenerator } from "@hyperforge/procgen/building/town";
import {
  TerrainGenerator,
  createConfigFromPreset,
  TERRAIN_PRESETS,
  createTerrainMaterial as createGameTerrainMaterial,
  type TerrainConfig,
  type TerrainUniforms,
} from "@hyperforge/procgen/terrain";
import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import {
  MeshStandardNodeMaterial,
  MeshBasicNodeMaterial,
  LineBasicNodeMaterial,
} from "three/webgpu";

import { buildingWalkabilityService } from "./BuildingWalkabilityService";
import type { WorldCreationConfig, GeneratedRoad } from "./types";

import {
  THREE,
  createWebGPURenderer,
  type AssetForgeRenderer,
} from "@/utils/webgpu-renderer";

// Type aliases for clarity (all WebGPU-compatible NodeMaterials)
const TownBasicMat = MeshBasicNodeMaterial;
const TownLineMat = LineBasicNodeMaterial;
const TownStdMat = MeshStandardNodeMaterial;
const VegStdMat = MeshStandardNodeMaterial;

// ============== CONSTANTS ==============

const TILE_LOAD_RADIUS = 5; // tiles in each direction from camera
const TILE_UNLOAD_RADIUS = 7; // tiles beyond this are unloaded
const MAX_TILES_PER_FRAME = 2; // limit tile generation per frame for performance

// LOD distances for buildings
const BUILDING_LOD_FULL_DISTANCE = 200; // Full detail within this distance
const BUILDING_LOD_SIMPLE_DISTANCE = 500; // Simple boxes beyond this distance

// Biome colors matching the game's BIOMES data
const BIOME_COLORS: Record<string, { r: number; g: number; b: number }> = {
  plains: { r: 0.486, g: 0.729, b: 0.373 },
  forest: { r: 0.227, g: 0.42, b: 0.208 },
  valley: { r: 0.353, g: 0.541, b: 0.31 },
  desert: { r: 0.769, g: 0.639, b: 0.353 },
  tundra: { r: 0.722, g: 0.784, b: 0.784 },
  swamp: { r: 0.29, g: 0.353, b: 0.227 },
  mountains: { r: 0.541, g: 0.541, b: 0.541 },
  lakes: { r: 0.29, g: 0.478, b: 0.722 },
};

// Shoreline tint color (sandy brown)
const SHORELINE_COLOR = { r: 0.545, g: 0.451, b: 0.333 };

// Water colors
const WATER_COLOR = 0x2a5599;
const WATER_OPACITY = 0.75;

// Town marker colors by size
const TOWN_SIZE_COLORS: Record<string, number> = {
  town: 0xff0000, // Red - large towns
  village: 0xff8800, // Orange - medium villages
  hamlet: 0xffff00, // Yellow - small hamlets
};

// ============== TYPES ==============

interface TileData {
  mesh: THREE.Mesh;
  water: THREE.Mesh | null;
  tileX: number;
  tileZ: number;
  lastAccessed: number;
}

interface CameraState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  euler: THREE.Euler;
  moveSpeed: number;
  lookSpeed: number;
}

/** Selection info returned when clicking objects in the viewport */
export interface ViewportSelection {
  type: "terrain" | "chunk" | "tile" | "biome" | "town" | "building" | "road";
  id: string;
  position: { x: number; y: number; z: number };
  townId?: string;
  townName?: string;
  buildingType?: string;
  biomeType?: string;
  tileKey?: string;
  /** Tile inspector data for terrain selections */
  tileData?: {
    tileX: number;
    tileZ: number;
    chunkX: number;
    chunkZ: number;
    worldX: number;
    worldZ: number;
    height: number;
    biome: string;
    slope: number;
    walkable: boolean;
    inTown: boolean;
    townId?: string;
    inWilderness: boolean;
    difficultyLevel: number;
  };
}

export interface TileBasedTerrainProps {
  config: WorldCreationConfig;
  className?: string;
  onTileCountChange?: (loaded: number, total: number) => void;
  /** Called when user clicks on an object in the viewport */
  onSelect?: (selection: ViewportSelection | null) => void;
  /** Currently selected object ID for highlighting */
  selectedId?: string | null;
  /** Whether to show vegetation (trees, grass, rocks) - GPU instanced */
  showVegetation?: boolean;
  /** Whether fly mode is enabled (controlled externally) */
  flyModeEnabled?: boolean;
  /** Called when fly mode state changes */
  onFlyModeChange?: (enabled: boolean) => void;
  /** Pre-generated road network (uses actual pathfinding data) */
  roads?: GeneratedRoad[];
}

// Vegetation types and their visual appearance
const VEGETATION_TYPES = {
  tree: {
    color: 0x2d5016,
    trunkColor: 0x4a3728,
    height: { min: 6, max: 12 },
    width: { min: 2, max: 4 },
  },
  bush: {
    color: 0x3d6b1e,
    height: { min: 1, max: 2 },
    width: { min: 1.5, max: 3 },
  },
  rock: {
    color: 0x6b6b6b,
    height: { min: 0.5, max: 2 },
    width: { min: 0.5, max: 2 },
  },
  grass: {
    color: 0x4a7c23,
    height: { min: 0.3, max: 0.8 },
    width: { min: 0.1, max: 0.3 },
  },
};

// Biome vegetation density settings
const BIOME_VEGETATION: Record<
  string,
  { trees: number; bushes: number; rocks: number; grass: number }
> = {
  plains: { trees: 0.02, bushes: 0.05, rocks: 0.01, grass: 0.3 },
  forest: { trees: 0.15, bushes: 0.1, rocks: 0.02, grass: 0.2 },
  valley: { trees: 0.08, bushes: 0.08, rocks: 0.03, grass: 0.25 },
  desert: { trees: 0.005, bushes: 0.02, rocks: 0.08, grass: 0.01 },
  tundra: { trees: 0.01, bushes: 0.03, rocks: 0.05, grass: 0.05 },
  swamp: { trees: 0.1, bushes: 0.15, rocks: 0.01, grass: 0.15 },
  mountains: { trees: 0.03, bushes: 0.02, rocks: 0.15, grass: 0.05 },
  lakes: { trees: 0, bushes: 0, rocks: 0, grass: 0 },
};

// ============== MINIMAP COMPONENT ==============

interface MinimapProps {
  worldSize: number; // World size in meters
  cameraPosition: THREE.Vector3;
  cameraRotationY: number;
  towns: Array<{
    id: string;
    name: string;
    position: { x: number; z: number };
    size: string;
  }>;
  roads: Array<{ path: Array<{ x: number; z: number }> }>;
  className?: string;
  onNavigate?: (x: number, z: number) => void;
  showWilderness?: boolean;
}

const MINIMAP_SIZE = 180; // pixels
const WILDERNESS_START_PERCENT = 0.7; // Wilderness starts at 70% from south

const Minimap: React.FC<MinimapProps> = ({
  worldSize,
  cameraPosition,
  cameraRotationY,
  towns,
  roads,
  className = "",
  onNavigate,
  showWilderness = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Convert world coords to minimap coords
  // World coordinates: X increases east, Z increases north
  // Minimap coordinates: X increases right, Y increases DOWN (canvas standard)
  // So we need to flip Z to Y: high Z (north) should be low Y (top of minimap)
  const worldToMinimap = useCallback(
    (worldX: number, worldZ: number) => {
      const normalizedX = worldX / worldSize;
      const normalizedZ = worldZ / worldSize;
      return {
        x: Math.max(0, Math.min(MINIMAP_SIZE, normalizedX * MINIMAP_SIZE)),
        y: Math.max(
          0,
          Math.min(MINIMAP_SIZE, (1 - normalizedZ) * MINIMAP_SIZE),
        ), // Flip Z to Y
      };
    },
    [worldSize],
  );

  // Convert minimap coords to world coords
  // Reverse the flip: low Y (top/north) should be high Z
  const minimapToWorld = useCallback(
    (minimapX: number, minimapY: number) => {
      const normalizedX = minimapX / MINIMAP_SIZE;
      const normalizedZ = 1 - minimapY / MINIMAP_SIZE; // Flip Y back to Z
      return {
        x: normalizedX * worldSize,
        z: normalizedZ * worldSize,
      };
    },
    [worldSize],
  );

  // Update minimap on each frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const drawMinimap = () => {
      // Clear with dark background
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      const centerX = MINIMAP_SIZE / 2;
      const centerY = MINIMAP_SIZE / 2;
      const radius = MINIMAP_SIZE / 2 - 4;

      // Water background
      ctx.fillStyle = "#1e3a5f";
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      // Create clipping path for island shape
      ctx.save();
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
        const variation =
          0.85 + Math.sin(angle * 8) * 0.1 + Math.cos(angle * 5) * 0.05;
        const r = radius * variation;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.clip();

      // Draw safe zone (southern green area)
      const wildernessY = MINIMAP_SIZE * (1 - WILDERNESS_START_PERCENT);
      ctx.fillStyle = "#2d4a1c";
      ctx.fillRect(0, wildernessY, MINIMAP_SIZE, MINIMAP_SIZE - wildernessY);

      // Draw wilderness zone (northern red-tinted area) if enabled
      if (showWilderness) {
        // Gradient from green to red as you go north
        const gradient = ctx.createLinearGradient(0, wildernessY, 0, 0);
        gradient.addColorStop(0, "#3d5a2c"); // Transition zone
        gradient.addColorStop(0.3, "#4a3c2c"); // Dark transition
        gradient.addColorStop(1, "#5a2a2a"); // Deep wilderness (red-brown)
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, MINIMAP_SIZE, wildernessY + 10);

        // Add wilderness danger line
        ctx.strokeStyle = "rgba(255, 50, 50, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, wildernessY);
        ctx.lineTo(MINIMAP_SIZE, wildernessY);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Just green if wilderness not shown
        ctx.fillStyle = "#2d4a1c";
        ctx.fillRect(0, 0, MINIMAP_SIZE, wildernessY);
      }

      // Restore clipping
      ctx.restore();

      // Redraw island outline
      ctx.strokeStyle = "rgba(100, 150, 100, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
        const variation =
          0.85 + Math.sin(angle * 8) * 0.1 + Math.cos(angle * 5) * 0.05;
        const r = radius * variation;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Draw grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const pos = (i / 4) * MINIMAP_SIZE;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, MINIMAP_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(MINIMAP_SIZE, pos);
        ctx.stroke();
      }

      // Draw roads
      ctx.strokeStyle = "#8b7355";
      ctx.lineWidth = 2;
      for (const road of roads) {
        if (road.path.length < 2) continue;
        ctx.beginPath();
        const start = worldToMinimap(road.path[0].x, road.path[0].z);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < road.path.length; i++) {
          const point = worldToMinimap(road.path[i].x, road.path[i].z);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      }

      // Draw towns
      for (const town of towns) {
        const pos = worldToMinimap(town.position.x, town.position.z);

        // Town size determines marker size
        const markerSize =
          town.size === "town" ? 6 : town.size === "village" ? 4 : 3;
        const color =
          town.size === "town"
            ? "#ffd700"
            : town.size === "village"
              ? "#c0c0c0"
              : "#cd7f32";

        // Draw town marker (square)
        ctx.fillStyle = color;
        ctx.fillRect(
          pos.x - markerSize / 2,
          pos.y - markerSize / 2,
          markerSize,
          markerSize,
        );

        // Draw town border
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          pos.x - markerSize / 2,
          pos.y - markerSize / 2,
          markerSize,
          markerSize,
        );
      }

      // Draw camera position and view cone
      const camPos = worldToMinimap(cameraPosition.x, cameraPosition.z);

      // View cone (field of view indicator)
      const coneLength = 20;
      const coneAngle = Math.PI / 4; // 45 degree FOV on each side
      const facing = -cameraRotationY - Math.PI / 2; // Adjust for coordinate system

      ctx.fillStyle = "rgba(255, 100, 100, 0.2)";
      ctx.beginPath();
      ctx.moveTo(camPos.x, camPos.y);
      ctx.lineTo(
        camPos.x + Math.cos(facing - coneAngle) * coneLength,
        camPos.y + Math.sin(facing - coneAngle) * coneLength,
      );
      ctx.lineTo(
        camPos.x + Math.cos(facing + coneAngle) * coneLength,
        camPos.y + Math.sin(facing + coneAngle) * coneLength,
      );
      ctx.closePath();
      ctx.fill();

      // Camera marker (triangle pointing in view direction)
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      const triSize = 6;
      ctx.moveTo(
        camPos.x + Math.cos(facing) * triSize,
        camPos.y + Math.sin(facing) * triSize,
      );
      ctx.lineTo(
        camPos.x + Math.cos(facing + 2.5) * triSize,
        camPos.y + Math.sin(facing + 2.5) * triSize,
      );
      ctx.lineTo(
        camPos.x + Math.cos(facing - 2.5) * triSize,
        camPos.y + Math.sin(facing - 2.5) * triSize,
      );
      ctx.closePath();
      ctx.fill();

      // White outline around camera
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(camPos.x, camPos.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      // Compass directions
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", MINIMAP_SIZE / 2, 12);
      ctx.fillText("S", MINIMAP_SIZE / 2, MINIMAP_SIZE - 4);
      ctx.fillText("W", 8, MINIMAP_SIZE / 2 + 4);
      ctx.fillText("E", MINIMAP_SIZE - 8, MINIMAP_SIZE / 2 + 4);

      animationId = requestAnimationFrame(drawMinimap);
    };

    drawMinimap();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [
    worldSize,
    cameraPosition,
    cameraRotationY,
    towns,
    roads,
    worldToMinimap,
    showWilderness,
  ]);

  // Handle click to navigate
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !onNavigate) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert minimap coords to world coords
      const world = minimapToWorld(x, y);
      onNavigate(world.x, world.z);
    },
    [minimapToWorld, onNavigate],
  );

  return (
    <div className={`${className} pointer-events-auto`}>
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className="shadow-lg cursor-crosshair border-2 border-white/30 rounded"
        onClick={handleClick}
        title="Click to teleport camera"
      />
      <div className="flex flex-col gap-0.5 text-xs text-text-muted mt-1 px-1">
        <div className="flex justify-between">
          <span>Click to teleport</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-500" /> Town
          </span>
        </div>
        {showWilderness && (
          <div className="flex items-center gap-1 text-red-400/80">
            <span className="w-2 h-2 bg-red-800/80" />
            <span>Wilderness (PVP)</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============== HELPER FUNCTIONS ==============

/**
 * Create template geometry for tiles (cloned for each tile)
 */
function createTemplateGeometry(
  tileSize: number,
  resolution: number,
): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(
    tileSize,
    tileSize,
    resolution - 1,
    resolution - 1,
  );
  geometry.rotateX(-Math.PI / 2);
  // Center at origin - tiles will be positioned by their mesh
  geometry.translate(tileSize / 2, 0, tileSize / 2);
  return geometry;
}

/**
 * Create terrain material using the game's terrain shader.
 * This ensures Asset Forge renders terrain identically to the game,
 * including road influence blending via the roadInfluence vertex attribute.
 *
 * No fallback - the game shader must load for correct road rendering.
 */
function createTerrainMaterial(): THREE.Material & {
  terrainUniforms: TerrainUniforms;
} {
  // Use the game's terrain shader for unified rendering
  // This material reads the roadInfluence attribute and blends road colors
  const material = createGameTerrainMaterial();
  console.log(
    "[TileBasedTerrain] Created terrain material with road influence support",
  );
  return material;
}

// Road influence calculation constants - must match game engine (TerrainSystem.ts ROAD_BLEND_WIDTH)
const ROAD_INFLUENCE_BLEND_WIDTH = 2; // meters of blending beyond road edge (matches game engine)
const ROAD_INFLUENCE_MINIMUM_WIDTH = 6; // minimum road width for visibility (wider than config default)

// Debug: track which roads we've logged (by their ID to detect changes)
let lastRoadDebugId: string | null = null;
let loggedFirstInfluenceVertex = false;
let _debugVertexCount = 0;

/**
 * Calculate road influence at a point based on distance to nearest road segment.
 * Returns 0-1 where 1 = center of road, 0 = no road influence.
 */
function calculateRoadInfluenceAtPoint(
  worldX: number,
  worldZ: number,
  roads: GeneratedRoad[] | undefined,
  worldCenterOffset: number,
): number {
  if (!roads || roads.length === 0) return 0;

  // Debug: log road coordinates when roads change
  const currentRoadId = roads[0]?.id ?? null;
  if (currentRoadId !== lastRoadDebugId && roads.length > 0) {
    lastRoadDebugId = currentRoadId;
    loggedFirstInfluenceVertex = false;
    _debugVertexCount = 0;
    console.log("[RoadInfluence] ===== ROADS DATA =====");
    console.log("[RoadInfluence] Total roads:", roads.length);
    console.log("[RoadInfluence] World center offset:", worldCenterOffset);

    // Calculate road coordinate bounds
    let minRoadX = Infinity,
      maxRoadX = -Infinity;
    let minRoadZ = Infinity,
      maxRoadZ = -Infinity;

    for (const road of roads) {
      for (const point of road.path) {
        minRoadX = Math.min(minRoadX, point.x);
        maxRoadX = Math.max(maxRoadX, point.x);
        minRoadZ = Math.min(minRoadZ, point.z);
        maxRoadZ = Math.max(maxRoadZ, point.z);
      }
    }

    console.log("[RoadInfluence] Road coordinate bounds:", {
      x: `${minRoadX.toFixed(0)} to ${maxRoadX.toFixed(0)}`,
      z: `${minRoadZ.toFixed(0)} to ${maxRoadZ.toFixed(0)}`,
    });

    // Log first road details
    const firstRoad = roads[0];
    const firstPoint = firstRoad.path[0];
    const lastPoint = firstRoad.path[firstRoad.path.length - 1];
    console.log("[RoadInfluence] First road:", {
      id: firstRoad.id,
      start: { x: firstPoint.x.toFixed(1), z: firstPoint.z.toFixed(1) },
      end: { x: lastPoint.x.toFixed(1), z: lastPoint.z.toFixed(1) },
      width: firstRoad.width,
      pathLength: firstRoad.path.length,
      isMainRoad: firstRoad.isMainRoad,
    });

    // Log sample vertex position for comparison
    console.log("[RoadInfluence] First vertex worldX/worldZ:", {
      worldX: worldX.toFixed(1),
      worldZ: worldZ.toFixed(1),
    });
    console.log("[RoadInfluence] =====================");
  }

  let minDistance = Infinity;
  let closestRoadWidth = ROAD_INFLUENCE_MINIMUM_WIDTH; // Use minimum width for visibility

  for (const road of roads) {
    if (road.path.length < 2) continue;

    // Ensure road width is at least the minimum for visibility
    const effectiveWidth = Math.max(
      road.width || 4,
      ROAD_INFLUENCE_MINIMUM_WIDTH,
    );

    // Check each segment of the road
    for (let i = 0; i < road.path.length - 1; i++) {
      const p1 = road.path[i];
      const p2 = road.path[i + 1];

      // Road paths are in terrain generator coordinates (centered at 0,0)
      // This matches the worldX/worldZ we receive (also in terrain generator coords)
      const x1 = p1.x;
      const z1 = p1.z;
      const x2 = p2.x;
      const z2 = p2.z;

      // Distance from point to line segment
      const distance = distanceToLineSegment(worldX, worldZ, x1, z1, x2, z2);
      if (distance < minDistance) {
        minDistance = distance;
        closestRoadWidth = effectiveWidth;
      }
    }
  }

  // Calculate influence based on distance
  // Use effective width to make roads more visible on terrain
  const halfWidth = closestRoadWidth / 2;
  const totalInfluenceWidth = halfWidth + ROAD_INFLUENCE_BLEND_WIDTH;

  if (minDistance >= totalInfluenceWidth) {
    return 0;
  }

  // Calculate final influence value
  let influence: number;
  if (minDistance <= halfWidth) {
    influence = 1.0;
  } else {
    // Smoothstep blending at edges
    const t = 1.0 - (minDistance - halfWidth) / ROAD_INFLUENCE_BLEND_WIDTH;
    influence = t * t * (3 - 2 * t); // smoothstep
  }

  // Debug: Log first vertex with significant road influence
  if (influence > 0.5 && !loggedFirstInfluenceVertex) {
    console.log(
      `[RoadInfluence] Found vertex with influence=${influence.toFixed(2)} at (${worldX.toFixed(1)}, ${worldZ.toFixed(1)}), minDist=${minDistance.toFixed(1)}, roadWidth=${closestRoadWidth}`,
    );
    loggedFirstInfluenceVertex = true;
  }

  return influence;
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function distanceToLineSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lengthSq = dx * dx + dz * dz;

  if (lengthSq === 0) {
    // Segment is a point
    return Math.sqrt((px - x1) ** 2 + (pz - z1) ** 2);
  }

  // Parameter t of closest point on line
  let t = ((px - x1) * dx + (pz - z1) * dz) / lengthSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  // Closest point on segment
  const closestX = x1 + t * dx;
  const closestZ = z1 + t * dz;

  return Math.sqrt((px - closestX) ** 2 + (pz - closestZ) ** 2);
}

/**
 * Create water material
 * Uses MeshStandardNodeMaterial for WebGPU compatibility
 */
function createWaterMaterial(): THREE.Material {
  const material = new MeshStandardNodeMaterial();
  material.color = new THREE.Color(WATER_COLOR);
  material.transparent = true;
  material.opacity = WATER_OPACITY;
  material.roughness = 0.1;
  material.metalness = 0.3;
  material.side = THREE.DoubleSide;
  return material;
}

/**
 * Generate tile geometry with proper heightmap, colors, and road influence.
 * Uses the same approach as the game's TerrainSystem for unified rendering.
 */
function generateTileGeometry(
  tileX: number,
  tileZ: number,
  templateGeometry: THREE.PlaneGeometry,
  generator: TerrainGenerator,
  tileSize: number,
  waterThreshold: number,
  maxHeight: number,
  worldSizeTiles: number,
  roads?: GeneratedRoad[],
): { geometry: THREE.PlaneGeometry; hasWater: boolean } {
  const geometry = templateGeometry.clone();
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const roadInfluences = new Float32Array(positions.count);
  const biomeIds = new Float32Array(positions.count);

  let hasWater = false;
  const shorelineThreshold = waterThreshold / maxHeight + 0.1; // Normalized

  // Calculate world center offset - island mask is centered at (0,0)
  // so we need to offset our tile coordinates to be centered around the world center
  const worldCenterOffset = (worldSizeTiles * tileSize) / 2;

  // Biome name to ID mapping (matching game's shader expectations)
  const biomeNameToId: Record<string, number> = {
    plains: 0,
    forest: 1,
    valley: 2,
    desert: 3,
    tundra: 4,
    swamp: 5,
    mountains: 6,
    lakes: 7,
  };

  // PlaneGeometry is centered at origin, so vertices range from -tileSize/2 to +tileSize/2
  // We need to offset by half a tile to align with the tile grid system where:
  // - Tile (0,0) covers world coords (0, 0) to (tileSize, tileSize)
  // - In terrain generator coords: (-worldCenterOffset, -worldCenterOffset) to (-worldCenterOffset + tileSize, ...)
  const halfTileSize = tileSize / 2;

  for (let i = 0; i < positions.count; i++) {
    const localX = positions.getX(i);
    const localZ = positions.getZ(i);

    // World coordinates in terrain generator space (centered at 0,0)
    // Add halfTileSize to convert from centered geometry coords to tile-corner coords
    const worldX = localX + halfTileSize + tileX * tileSize - worldCenterOffset;
    const worldZ = localZ + halfTileSize + tileZ * tileSize - worldCenterOffset;

    // Query terrain
    const query = generator.queryPoint(worldX, worldZ);
    const height = query.height;

    // Set vertex height
    positions.setY(i, height);

    // Check if this tile has water
    if (height < waterThreshold) {
      hasWater = true;
    }

    // Get biome color (used for fallback/debug rendering)
    const biomeColor = BIOME_COLORS[query.biome] || BIOME_COLORS.plains;
    let r = biomeColor.r;
    let g = biomeColor.g;
    let b = biomeColor.b;

    // Apply shoreline tinting near water level
    const normalizedHeight = height / maxHeight;
    const waterLevel = waterThreshold / maxHeight;

    if (
      normalizedHeight > waterLevel &&
      normalizedHeight < shorelineThreshold
    ) {
      const shoreFactor =
        (1.0 -
          (normalizedHeight - waterLevel) / (shorelineThreshold - waterLevel)) *
        0.6;
      r = r + (SHORELINE_COLOR.r - r) * shoreFactor;
      g = g + (SHORELINE_COLOR.g - g) * shoreFactor;
      b = b + (SHORELINE_COLOR.b - b) * shoreFactor;
    }

    // Store color
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    // Store biome ID for shader
    biomeIds[i] = biomeNameToId[query.biome] ?? 0;

    // Calculate road influence at this vertex
    // Roads are in terrain-space coordinates, so use worldX/worldZ directly
    roadInfluences[i] = calculateRoadInfluenceAtPoint(
      worldX,
      worldZ,
      roads,
      worldCenterOffset,
    );
  }

  // Debug: count non-zero road influences for this tile
  let nonZeroCount = 0;
  let maxInfluence = 0;
  for (let i = 0; i < roadInfluences.length; i++) {
    if (roadInfluences[i] > 0) {
      nonZeroCount++;
      if (roadInfluences[i] > maxInfluence) maxInfluence = roadInfluences[i];
    }
  }
  // Log for tiles with road influence OR for the first few tiles to debug coords
  const shouldLog =
    nonZeroCount > 0 || (tileX >= 0 && tileX <= 2 && tileZ >= 0 && tileZ <= 2);
  if (shouldLog) {
    // Calculate the world coordinate range for this tile (in terrain generator coords)
    const tileWorldMinX = tileX * tileSize - worldCenterOffset;
    const tileWorldMaxX = (tileX + 1) * tileSize - worldCenterOffset;
    const tileWorldMinZ = tileZ * tileSize - worldCenterOffset;
    const tileWorldMaxZ = (tileZ + 1) * tileSize - worldCenterOffset;
    console.log(
      `[Tile ${tileX},${tileZ}] Road influence: ${nonZeroCount}/${roadInfluences.length} vertices, max=${maxInfluence.toFixed(2)}`,
    );
    console.log(
      `  Tile world bounds: X[${tileWorldMinX.toFixed(0)} to ${tileWorldMaxX.toFixed(0)}], Z[${tileWorldMinZ.toFixed(0)} to ${tileWorldMaxZ.toFixed(0)}]`,
    );
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("biomeId", new THREE.BufferAttribute(biomeIds, 1));
  geometry.setAttribute(
    "roadInfluence",
    new THREE.BufferAttribute(roadInfluences, 1),
  );
  geometry.computeVertexNormals();
  positions.needsUpdate = true;

  return { geometry, hasWater };
}

// ============== MAIN COMPONENT ==============

export const TileBasedTerrain: React.FC<TileBasedTerrainProps> = ({
  config,
  className = "",
  onTileCountChange,
  onSelect,
  selectedId,
  showVegetation = false,
  flyModeEnabled = false,
  onFlyModeChange,
  roads: providedRoads,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AssetForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationIdRef = useRef<number>(0);

  // Terrain state
  const tilesRef = useRef<Map<string, TileData>>(new Map());
  const templateGeometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const terrainMaterialRef = useRef<THREE.Material | null>(null); // MeshStandardNodeMaterial for WebGPU
  const waterMaterialRef = useRef<THREE.Material | null>(null); // MeshStandardNodeMaterial for WebGPU
  const terrainContainerRef = useRef<THREE.Group | null>(null);
  const waterContainerRef = useRef<THREE.Group | null>(null);
  const townMarkersRef = useRef<THREE.Group | null>(null);
  const vegetationContainerRef = useRef<THREE.Group | null>(null);
  const wildernessOverlayRef = useRef<THREE.Mesh | null>(null);
  const generatorRef = useRef<TerrainGenerator | null>(null);

  // Tile generation queue
  const tileQueueRef = useRef<Array<{ tileX: number; tileZ: number }>>([]);

  // Camera state for fly controls
  const cameraStateRef = useRef<CameraState>({
    position: new THREE.Vector3(0, 200, 0),
    velocity: new THREE.Vector3(),
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
    moveSpeed: 200,
    lookSpeed: 0.002,
  });

  // Input state
  const keysRef = useRef<Set<string>>(new Set());
  const isPointerLockedRef = useRef(false);

  // Raycasting for selection
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const selectableObjectsRef = useRef<THREE.Object3D[]>([]);

  // Selection highlighting
  const selectionOutlineRef = useRef<THREE.Mesh | null>(null);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadedTiles, setLoadedTiles] = useState(0);
  const [townCount, setTownCount] = useState(0);
  const [roadCount, setRoadCount] = useState(0);
  const [hoveredObject, setHoveredObject] = useState<string | null>(null);
  const [cameraRotationY, setCameraRotationY] = useState(0);

  // Minimap data
  const [minimapTowns, setMinimapTowns] = useState<
    Array<{
      id: string;
      name: string;
      position: { x: number; z: number };
      size: string;
    }>
  >([]);
  const [minimapRoads, setMinimapRoads] = useState<
    Array<{ path: Array<{ x: number; z: number }> }>
  >([]);

  // Derived values
  const tileSize = config.terrain.tileSize;
  const tileResolution = config.terrain.tileResolution;
  const worldSize = config.terrain.worldSize;
  const maxHeight = config.terrain.maxHeight;
  const waterThreshold = config.terrain.waterThreshold;

  // Create terrain config - pass ALL config including island, noise, biomes, shoreline
  const terrainConfig = useMemo((): Partial<TerrainConfig> => {
    const preset = config.preset || "large-island";

    // Build full override config from WorldCreationConfig
    const overrides: Partial<TerrainConfig> = {
      seed: config.seed,
      worldSize: config.terrain.worldSize,
      tileSize: config.terrain.tileSize,
      tileResolution: config.terrain.tileResolution,
      maxHeight: config.terrain.maxHeight,
      waterThreshold: config.terrain.waterThreshold,
      // Pass through island, noise, biomes, and shoreline configs
      island: config.island,
      noise: config.noise,
      biomes: config.biomes,
      shoreline: config.shoreline,
    };

    if (TERRAIN_PRESETS[preset]) {
      return createConfigFromPreset(preset, overrides);
    }
    return createConfigFromPreset("large-island", overrides);
  }, [config]);

  // Get tile key
  const getTileKey = useCallback(
    (tileX: number, tileZ: number) => `${tileX}_${tileZ}`,
    [],
  );

  // Check if tile is within world bounds
  const isInBounds = useCallback(
    (tileX: number, tileZ: number) => {
      return tileX >= 0 && tileX < worldSize && tileZ >= 0 && tileZ < worldSize;
    },
    [worldSize],
  );

  // Get current camera tile position
  const getCameraTile = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return { tileX: 0, tileZ: 0 };

    const tileX = Math.floor(camera.position.x / tileSize);
    const tileZ = Math.floor(camera.position.z / tileSize);
    return { tileX, tileZ };
  }, [tileSize]);

  // Generate a single tile
  const generateTile = useCallback(
    (tileX: number, tileZ: number) => {
      const scene = sceneRef.current;
      const generator = generatorRef.current;
      const template = templateGeometryRef.current;
      const terrainMaterial = terrainMaterialRef.current;
      const waterMaterial = waterMaterialRef.current;
      const terrainContainer = terrainContainerRef.current;
      const waterContainer = waterContainerRef.current;

      if (
        !scene ||
        !generator ||
        !template ||
        !terrainMaterial ||
        !waterMaterial ||
        !terrainContainer ||
        !waterContainer
      )
        return;

      const key = getTileKey(tileX, tileZ);
      if (tilesRef.current.has(key)) return; // Already exists

      // Generate tile geometry with road influence support
      const { geometry, hasWater } = generateTileGeometry(
        tileX,
        tileZ,
        template,
        generator,
        tileSize,
        waterThreshold,
        maxHeight,
        worldSize,
        providedRoads, // Pass roads for road influence calculation
      );

      // Create terrain mesh
      // NOTE: PlaneGeometry is centered at origin with vertices from -halfTileSize to +halfTileSize.
      // To align the mesh properly with the tile grid, we offset the position by halfTileSize.
      // This ensures that the terrain vertex at local (0,0) aligns with the tile center,
      // which is where centered coordinates map to render coordinates.
      const mesh = new THREE.Mesh(geometry, terrainMaterial);
      const halfTileSizeOffset = tileSize / 2;
      mesh.position.set(
        tileX * tileSize + halfTileSizeOffset,
        0,
        tileZ * tileSize + halfTileSizeOffset,
      );
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      // Add tile metadata for raycasting
      mesh.userData = {
        tileX,
        tileZ,
        tileKey: key,
      };
      terrainContainer.add(mesh);

      // Create water mesh if needed
      let waterMesh: THREE.Mesh | null = null;
      if (hasWater) {
        const waterGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
        waterGeometry.rotateX(-Math.PI / 2);
        waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        waterMesh.position.set(
          tileX * tileSize + tileSize / 2,
          waterThreshold,
          tileZ * tileSize + tileSize / 2,
        );
        waterContainer.add(waterMesh);
      }

      // Store tile data
      tilesRef.current.set(key, {
        mesh,
        water: waterMesh,
        tileX,
        tileZ,
        lastAccessed: performance.now(),
      });

      setLoadedTiles(tilesRef.current.size);
    },
    [getTileKey, tileSize, waterThreshold, maxHeight, worldSize, providedRoads],
  );

  // Unload a tile
  const unloadTile = useCallback((key: string) => {
    const tileData = tilesRef.current.get(key);
    if (!tileData) return;

    const terrainContainer = terrainContainerRef.current;
    const waterContainer = waterContainerRef.current;

    // Remove terrain mesh
    if (terrainContainer) {
      terrainContainer.remove(tileData.mesh);
    }
    tileData.mesh.geometry.dispose();

    // Remove water mesh
    if (tileData.water && waterContainer) {
      waterContainer.remove(tileData.water);
      tileData.water.geometry.dispose();
    }

    tilesRef.current.delete(key);
    setLoadedTiles(tilesRef.current.size);
  }, []);

  // Update tiles based on camera position
  const updateTiles = useCallback(() => {
    const { tileX: cameraTileX, tileZ: cameraTileZ } = getCameraTile();

    // Queue tiles to load
    for (let dx = -TILE_LOAD_RADIUS; dx <= TILE_LOAD_RADIUS; dx++) {
      for (let dz = -TILE_LOAD_RADIUS; dz <= TILE_LOAD_RADIUS; dz++) {
        const tileX = cameraTileX + dx;
        const tileZ = cameraTileZ + dz;

        if (!isInBounds(tileX, tileZ)) continue;

        const key = getTileKey(tileX, tileZ);
        if (tilesRef.current.has(key)) {
          // Update last accessed time
          const tile = tilesRef.current.get(key)!;
          tile.lastAccessed = performance.now();
        } else if (
          !tileQueueRef.current.some(
            (t) => t.tileX === tileX && t.tileZ === tileZ,
          )
        ) {
          // Add to queue (closer tiles first)
          const distance = Math.abs(dx) + Math.abs(dz);
          const insertIndex = tileQueueRef.current.findIndex(
            (t) =>
              Math.abs(t.tileX - cameraTileX) +
                Math.abs(t.tileZ - cameraTileZ) >
              distance,
          );
          if (insertIndex === -1) {
            tileQueueRef.current.push({ tileX, tileZ });
          } else {
            tileQueueRef.current.splice(insertIndex, 0, { tileX, tileZ });
          }
        }
      }
    }

    // Process tile queue (limited per frame)
    let generated = 0;
    while (tileQueueRef.current.length > 0 && generated < MAX_TILES_PER_FRAME) {
      const { tileX, tileZ } = tileQueueRef.current.shift()!;
      if (
        isInBounds(tileX, tileZ) &&
        !tilesRef.current.has(getTileKey(tileX, tileZ))
      ) {
        generateTile(tileX, tileZ);
        generated++;
      }
    }

    // Unload distant tiles
    const now = performance.now();
    for (const [key, tile] of tilesRef.current) {
      const dx = Math.abs(tile.tileX - cameraTileX);
      const dz = Math.abs(tile.tileZ - cameraTileZ);

      if (dx > TILE_UNLOAD_RADIUS || dz > TILE_UNLOAD_RADIUS) {
        // Only unload if not recently accessed
        if (now - tile.lastAccessed > 1000) {
          unloadTile(key);
        }
      }
    }

    // Update generating state
    setIsGenerating(tileQueueRef.current.length > 0);
  }, [getCameraTile, isInBounds, getTileKey, generateTile, unloadTile]);

  // Handle fly camera movement
  const updateCamera = useCallback(
    (deltaTime: number) => {
      const camera = cameraRef.current;
      const state = cameraStateRef.current;
      const keys = keysRef.current;

      if (!camera) return;

      // Movement direction
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(state.euler);
      const right = new THREE.Vector3(1, 0, 0).applyEuler(state.euler);
      const up = new THREE.Vector3(0, 1, 0);

      // Calculate target velocity
      const targetVelocity = new THREE.Vector3();

      if (keys.has("KeyW") || keys.has("ArrowUp")) {
        targetVelocity.add(forward);
      }
      if (keys.has("KeyS") || keys.has("ArrowDown")) {
        targetVelocity.sub(forward);
      }
      if (keys.has("KeyA") || keys.has("ArrowLeft")) {
        targetVelocity.sub(right);
      }
      if (keys.has("KeyD") || keys.has("ArrowRight")) {
        targetVelocity.add(right);
      }
      if (keys.has("Space")) {
        targetVelocity.add(up);
      }
      if (keys.has("ShiftLeft") || keys.has("ShiftRight")) {
        targetVelocity.sub(up);
      }

      // Normalize and apply speed
      if (targetVelocity.length() > 0) {
        targetVelocity.normalize().multiplyScalar(state.moveSpeed);
      }

      // Smooth velocity transition
      state.velocity.lerp(targetVelocity, 1 - Math.exp(-10 * deltaTime));

      // Apply movement
      state.position.add(state.velocity.clone().multiplyScalar(deltaTime));

      // Clamp to world bounds (with some margin)
      const worldSizeMeters = worldSize * tileSize;
      const margin = tileSize * 2;
      state.position.x = Math.max(
        -margin,
        Math.min(worldSizeMeters + margin, state.position.x),
      );
      state.position.z = Math.max(
        -margin,
        Math.min(worldSizeMeters + margin, state.position.z),
      );
      state.position.y = Math.max(10, Math.min(2000, state.position.y));

      // Update camera
      camera.position.copy(state.position);
      camera.quaternion.setFromEuler(state.euler);
    },
    [worldSize, tileSize],
  );

  // Handle mouse movement for camera look
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isPointerLockedRef.current) return;

    const state = cameraStateRef.current;
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    state.euler.y -= movementX * state.lookSpeed;
    state.euler.x -= movementY * state.lookSpeed;

    // Clamp vertical rotation
    state.euler.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, state.euler.x),
    );
  }, []);

  // Handle keyboard input
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    keysRef.current.add(event.code);

    // Speed boost with Ctrl
    if (event.code === "ControlLeft" || event.code === "ControlRight") {
      cameraStateRef.current.moveSpeed = 600;
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    keysRef.current.delete(event.code);

    // Reset speed
    if (event.code === "ControlLeft" || event.code === "ControlRight") {
      cameraStateRef.current.moveSpeed = 200;
    }
  }, []);

  // Handle viewport click for selection
  const handleClick = useCallback(
    (event: MouseEvent) => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;

      if (!container || !camera || !scene) return;

      // If pointer is locked (fly mode active), clicking exits fly mode
      if (isPointerLockedRef.current) {
        document.exitPointerLock();
        onFlyModeChange?.(false);
        return;
      }

      // If fly mode is enabled but not locked, enter fly mode on click
      if (flyModeEnabled) {
        container.requestPointerLock();
        return;
      }

      // Selection mode: perform raycast to find what was clicked
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Check for intersections with selectable objects (towns, buildings) first
      const selectableIntersects = raycasterRef.current.intersectObjects(
        selectableObjectsRef.current,
        true,
      );

      if (selectableIntersects.length > 0) {
        const hit = selectableIntersects[0];
        const object = hit.object;
        const userData = object.userData as {
          selectable?: boolean;
          selectableType?: string;
          selectableId?: string;
          townId?: string;
          townName?: string;
          buildingType?: string;
          biomeType?: string;
        };

        if (
          userData.selectable &&
          userData.selectableType &&
          userData.selectableId
        ) {
          const selection: ViewportSelection = {
            type: userData.selectableType as ViewportSelection["type"],
            id: userData.selectableId,
            position: {
              x: hit.point.x,
              y: hit.point.y,
              z: hit.point.z,
            },
            townId: userData.townId,
            townName: userData.townName,
            buildingType: userData.buildingType,
            biomeType: userData.biomeType,
          };

          onSelect?.(selection);
          return;
        }
      }

      // Check if we hit terrain
      const terrainContainer = terrainContainerRef.current;
      if (terrainContainer) {
        const terrainIntersects = raycasterRef.current.intersectObject(
          terrainContainer,
          true,
        );

        if (terrainIntersects.length > 0) {
          const hit = terrainIntersects[0];
          const mesh = hit.object as THREE.Mesh;
          const tileData = mesh.userData as {
            tileX?: number;
            tileZ?: number;
          };

          if (tileData.tileX !== undefined && tileData.tileZ !== undefined) {
            // Query terrain at this point for detailed info
            const generator = generatorRef.current;
            const worldCenterOffset = (worldSize * tileSize) / 2;
            const worldX = hit.point.x - worldCenterOffset;
            const worldZ = hit.point.z - worldCenterOffset;

            // Get chunk coordinates (10x10 tiles per chunk)
            const chunkX = Math.floor(tileData.tileX / 10);
            const chunkZ = Math.floor(tileData.tileZ / 10);

            let biomeType = "unknown";
            let terrainHeight = hit.point.y;
            let slope = 0;
            let walkable = true;

            if (generator) {
              const query = generator.queryPoint(worldX, worldZ);
              biomeType = query.biome;
              terrainHeight = query.height;
              // Calculate slope from surface normal (1 - y component gives steepness)
              slope = query.normal ? 1 - Math.abs(query.normal.y) : 0;
              // Walkable if not too steep and not underwater
              const terrainWalkable =
                slope < 0.7 && terrainHeight > waterThreshold;

              // Check building walkability (unified with game's BuildingCollisionService logic)
              // Building interiors are walkable even if terrain underneath isn't
              const buildingCheck = buildingWalkabilityService.checkWalkability(
                worldX,
                worldZ,
                terrainWalkable,
              );
              walkable = buildingCheck.walkable;

              // Update terrain height to building floor if inside a building
              if (buildingCheck.inBuilding) {
                const floorHeight = buildingWalkabilityService.getFloorHeight(
                  worldX,
                  worldZ,
                );
                if (floorHeight !== null) {
                  terrainHeight = floorHeight;
                }
              }
            }

            // Check if in a town (approximate - check against generated towns)
            let inTown = false;
            let townIdForTile: string | undefined;
            const townMarkersGroup = townMarkersRef.current;
            if (townMarkersGroup) {
              townMarkersGroup.traverse((child) => {
                if (child.userData.selectableType === "town") {
                  const townPos = child.position;
                  const dist = Math.sqrt(
                    Math.pow(hit.point.x - townPos.x, 2) +
                      Math.pow(hit.point.z - townPos.z, 2),
                  );
                  // Approximate town radius
                  if (dist < 150) {
                    inTown = true;
                    townIdForTile = child.userData.selectableId;
                  }
                }
              });
            }

            // Check wilderness (northern portion of map)
            // Wilderness starts at WILDERNESS_START_PERCENT (0.7 = 70% from south = northern 30%)
            // In world coordinates, Z increases going north, so wilderness is when Z > 70% of world size
            const worldSizeMeters = worldSize * tileSize;
            const wildernessThreshold =
              worldSizeMeters * WILDERNESS_START_PERCENT;
            const inWilderness = hit.point.z > wildernessThreshold;

            // Calculate difficulty based on distance from center (starter area)
            const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
            const maxDist = (worldSize * tileSize) / 2;
            const difficultyLevel = Math.min(
              4,
              Math.floor((distFromCenter / maxDist) * 5),
            );

            const selection: ViewportSelection = {
              type: "tile",
              id: `tile_${tileData.tileX}_${tileData.tileZ}`,
              position: {
                x: hit.point.x,
                y: hit.point.y,
                z: hit.point.z,
              },
              biomeType,
              tileKey: `${tileData.tileX},${tileData.tileZ}`,
              tileData: {
                tileX: tileData.tileX,
                tileZ: tileData.tileZ,
                chunkX,
                chunkZ,
                worldX,
                worldZ,
                height: terrainHeight,
                biome: biomeType,
                slope,
                walkable,
                inTown,
                townId: townIdForTile,
                inWilderness,
                difficultyLevel,
              },
            };

            onSelect?.(selection);
            return;
          }
        }
      }

      // Click on empty space (sky/water) - deselect
      onSelect?.(null);
    },
    [
      onSelect,
      worldSize,
      tileSize,
      waterThreshold,
      flyModeEnabled,
      onFlyModeChange,
    ],
  );

  const handlePointerLockChange = useCallback(() => {
    const wasLocked = isPointerLockedRef.current;
    isPointerLockedRef.current =
      document.pointerLockElement === containerRef.current;

    // Notify parent if fly mode state changed
    if (wasLocked && !isPointerLockedRef.current) {
      onFlyModeChange?.(false);
    } else if (!wasLocked && isPointerLockedRef.current) {
      onFlyModeChange?.(true);
    }
  }, [onFlyModeChange]);

  // Initialize Three.js scene with WebGPU
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;

    // Scene (create before async renderer init)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 500, 3000);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      1,
      10000,
    );
    // Start camera at center of world, looking down
    const worldCenter = (worldSize * tileSize) / 2;
    cameraStateRef.current.position.set(worldCenter, 300, worldCenter);
    cameraStateRef.current.euler.set(-0.5, 0, 0);
    camera.position.copy(cameraStateRef.current.position);
    camera.quaternion.setFromEuler(cameraStateRef.current.euler);
    cameraRef.current = camera;

    // Containers for terrain, water, and town markers
    const terrainContainer = new THREE.Group();
    scene.add(terrainContainer);
    terrainContainerRef.current = terrainContainer;

    const waterContainer = new THREE.Group();
    scene.add(waterContainer);
    waterContainerRef.current = waterContainer;

    const townMarkers = new THREE.Group();
    scene.add(townMarkers);
    townMarkersRef.current = townMarkers;

    const vegetationContainer = new THREE.Group();
    vegetationContainer.visible = showVegetation;
    scene.add(vegetationContainer);
    vegetationContainerRef.current = vegetationContainer;

    // Wilderness zone visual (PVP area in north) - border band + floating skull
    const wildernessStartPercent = 0.3; // Start at 30% from center (north direction)
    const worldSizeForWilderness = worldSize * tileSize;
    const worldCenterForWilderness = worldSizeForWilderness / 2;
    const wildernessBoundaryZ =
      worldCenterForWilderness -
      worldSizeForWilderness * wildernessStartPercent;
    const wildernessDepth = wildernessBoundaryZ; // From boundary to north edge (z=0)
    const wildernessWidth = worldSizeForWilderness;

    // Create wilderness border group
    const wildernessGroup = new THREE.Group();
    const borderHeight = 8.0; // Height of border walls
    const borderColor = 0xff0000; // Bright red

    // Border wall material (very transparent to not block grass)
    const borderWallMaterial = new MeshBasicNodeMaterial();
    borderWallMaterial.color = new THREE.Color(borderColor);
    borderWallMaterial.transparent = true;
    borderWallMaterial.opacity = 0.15;
    borderWallMaterial.side = THREE.DoubleSide;
    borderWallMaterial.depthWrite = false;

    // South wall (the main boundary line players cross)
    const southWallGeom = new THREE.PlaneGeometry(
      wildernessWidth,
      borderHeight,
    );
    const southWall = new THREE.Mesh(southWallGeom, borderWallMaterial);
    southWall.position.set(0, borderHeight / 2, wildernessDepth / 2);
    southWall.rotation.y = Math.PI;
    wildernessGroup.add(southWall);

    // East wall
    const eastWallGeom = new THREE.PlaneGeometry(wildernessDepth, borderHeight);
    const eastWall = new THREE.Mesh(eastWallGeom, borderWallMaterial);
    eastWall.position.set(wildernessWidth / 2, borderHeight / 2, 0);
    eastWall.rotation.y = -Math.PI / 2;
    wildernessGroup.add(eastWall);

    // West wall
    const westWallGeom = new THREE.PlaneGeometry(wildernessDepth, borderHeight);
    const westWall = new THREE.Mesh(westWallGeom, borderWallMaterial);
    westWall.position.set(-wildernessWidth / 2, borderHeight / 2, 0);
    westWall.rotation.y = Math.PI / 2;
    wildernessGroup.add(westWall);

    // North wall (at z=0, edge of world)
    const northWallGeom = new THREE.PlaneGeometry(
      wildernessWidth,
      borderHeight,
    );
    const northWall = new THREE.Mesh(northWallGeom, borderWallMaterial);
    northWall.position.set(0, borderHeight / 2, -wildernessDepth / 2);
    wildernessGroup.add(northWall);

    // Border edge lines
    const lineMaterial = new LineBasicNodeMaterial();
    lineMaterial.color = new THREE.Color(borderColor);

    // Top edge outline
    const topEdgePoints = [
      new THREE.Vector3(
        -wildernessWidth / 2,
        borderHeight,
        -wildernessDepth / 2,
      ),
      new THREE.Vector3(
        wildernessWidth / 2,
        borderHeight,
        -wildernessDepth / 2,
      ),
      new THREE.Vector3(wildernessWidth / 2, borderHeight, wildernessDepth / 2),
      new THREE.Vector3(
        -wildernessWidth / 2,
        borderHeight,
        wildernessDepth / 2,
      ),
      new THREE.Vector3(
        -wildernessWidth / 2,
        borderHeight,
        -wildernessDepth / 2,
      ),
    ];
    const topEdgeGeom = new THREE.BufferGeometry().setFromPoints(topEdgePoints);
    const topEdgeLine = new THREE.Line(topEdgeGeom, lineMaterial);
    wildernessGroup.add(topEdgeLine);

    // Position wilderness group at center (lifted 10m above terrain)
    wildernessGroup.position.set(
      worldCenterForWilderness,
      12,
      wildernessDepth / 2,
    );
    scene.add(wildernessGroup);

    // Create floating skull sprite
    const skullCanvas = document.createElement("canvas");
    const skullSize = 256;
    skullCanvas.width = skullSize;
    skullCanvas.height = skullSize;
    const skullCtx = skullCanvas.getContext("2d");
    if (skullCtx) {
      skullCtx.clearRect(0, 0, skullSize, skullSize);
      skullCtx.font = `${skullSize * 0.8}px serif`;
      skullCtx.textAlign = "center";
      skullCtx.textBaseline = "middle";
      skullCtx.fillText("💀", skullSize / 2, skullSize / 2);
      // Add glow
      skullCtx.shadowColor = "rgba(255, 0, 0, 0.8)";
      skullCtx.shadowBlur = 20;
      skullCtx.fillText("💀", skullSize / 2, skullSize / 2);
    }
    const skullTexture = new THREE.CanvasTexture(skullCanvas);

    const skullMaterial = new THREE.SpriteMaterial({
      map: skullTexture,
      transparent: true,
      depthWrite: false,
    });
    const skullSprite = new THREE.Sprite(skullMaterial);
    const skullSpriteSize = 30.0;
    skullSprite.scale.set(skullSpriteSize, skullSpriteSize, 1);
    skullSprite.position.set(
      worldCenterForWilderness,
      50, // High above terrain
      wildernessDepth / 4, // Centered in wilderness zone
    );
    scene.add(skullSprite);

    // Store reference for cleanup (use group as main reference)
    wildernessOverlayRef.current = wildernessGroup as unknown as THREE.Mesh;
    // Store skull for animation
    (
      wildernessGroup as THREE.Group & { skullSprite?: THREE.Sprite }
    ).skullSprite = skullSprite;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(1000, 2000, 1000);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 5000;
    sun.shadow.camera.left = -1000;
    sun.shadow.camera.right = 1000;
    sun.shadow.camera.top = 1000;
    sun.shadow.camera.bottom = -1000;
    scene.add(sun);

    // Create terrain resources
    templateGeometryRef.current = createTemplateGeometry(
      tileSize,
      tileResolution,
    );
    terrainMaterialRef.current = createTerrainMaterial();
    waterMaterialRef.current = createWaterMaterial();

    // Create terrain generator
    const generator = new TerrainGenerator(terrainConfig);
    generatorRef.current = generator;

    // Generate towns using the factory method for proper terrain integration
    const worldSizeMeters = worldSize * tileSize;
    const worldCenterOffset = worldSizeMeters / 2;

    // Scale town spacing based on world size (smaller worlds need closer towns)
    // Minimum spacing should allow at least 3-5 towns to fit
    const scaledMinSpacing = Math.min(
      config.towns.minTownSpacing,
      worldSizeMeters / 5, // Ensure at least ~5 potential town spots
    );

    const townGenerator = TownGenerator.fromTerrainGenerator(generator, {
      seed: config.seed,
      config: {
        townCount: config.towns.townCount,
        worldSize: worldSizeMeters,
        minTownSpacing: scaledMinSpacing,
        waterThreshold: waterThreshold,
        landmarks: {
          fencesEnabled: config.towns.landmarks.fencesEnabled,
          fenceDensity: config.towns.landmarks.fenceDensity,
          fencePostHeight: config.towns.landmarks.fencePostHeight,
          lamppostsInVillages: config.towns.landmarks.lamppostsInVillages,
          lamppostSpacing: config.towns.landmarks.lamppostSpacing,
          marketStallsEnabled: config.towns.landmarks.marketStallsEnabled,
          decorationsEnabled: config.towns.landmarks.decorationsEnabled,
        },
      },
    });

    const townResult = townGenerator.generate();
    console.log(
      `[TileBasedTerrain] Generated ${townResult.towns.length} towns in ${townResult.stats.generationTime.toFixed(0)}ms`,
    );
    setTownCount(townResult.towns.length);

    // Clear selectable objects array
    selectableObjectsRef.current = [];

    // Create town markers and internal roads
    for (const town of townResult.towns) {
      const color = TOWN_SIZE_COLORS[town.size] ?? 0xffff00;
      // Offset town position to match our tile grid (towns are generated with origin at center)
      const markerX = town.position.x + worldCenterOffset;
      const markerY = town.position.y;
      const markerZ = town.position.z + worldCenterOffset;

      // Town userData for selection
      const townUserData = {
        selectable: true,
        selectableType: "town",
        selectableId: town.id,
        townId: town.id,
        townName: town.name,
      };

      // Cone marker pointing down at town location (main selectable element)
      const coneGeometry = new THREE.ConeGeometry(20, 50, 8);
      const coneMaterial = new MeshBasicNodeMaterial();
      coneMaterial.color = new THREE.Color(color);
      const marker = new THREE.Mesh(coneGeometry, coneMaterial);
      marker.position.set(markerX, markerY + 60, markerZ);
      marker.rotation.x = Math.PI; // Point downward
      marker.userData = townUserData;
      townMarkers.add(marker);
      selectableObjectsRef.current.push(marker);

      // Safe zone ring around town (also selectable as town)
      const ringGeometry = new THREE.RingGeometry(
        town.safeZoneRadius - 5,
        town.safeZoneRadius,
        48,
      );
      const ringMaterial = new MeshBasicNodeMaterial();
      ringMaterial.color = new THREE.Color(color);
      ringMaterial.side = THREE.DoubleSide;
      ringMaterial.transparent = true;
      ringMaterial.opacity = 0.4;
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(markerX, markerY + 2, markerZ);
      ring.userData = townUserData;
      townMarkers.add(ring);
      selectableObjectsRef.current.push(ring);

      // Town center marker (small pillar) - also selectable
      const pillarGeometry = new THREE.CylinderGeometry(3, 3, 30, 8);
      const pillarMaterial = new TownBasicMat();
      pillarMaterial.color = new THREE.Color(0xffffff);
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(markerX, markerY + 15, markerZ);
      pillar.userData = townUserData;
      townMarkers.add(pillar);
      selectableObjectsRef.current.push(pillar);

      // Draw internal roads if available
      if (town.internalRoads && town.internalRoads.length > 0) {
        for (const road of town.internalRoads) {
          const roadPoints: THREE.Vector3[] = [];
          const startX = road.start.x + worldCenterOffset;
          const startZ = road.start.z + worldCenterOffset;
          const endX = road.end.x + worldCenterOffset;
          const endZ = road.end.z + worldCenterOffset;

          // Get height at road points
          const startY = generator.getHeightAt(road.start.x, road.start.z) + 1;
          const endY = generator.getHeightAt(road.end.x, road.end.z) + 1;

          roadPoints.push(new THREE.Vector3(startX, startY, startZ));
          roadPoints.push(new THREE.Vector3(endX, endY, endZ));

          const roadGeometry = new THREE.BufferGeometry().setFromPoints(
            roadPoints,
          );
          const roadLineMat = new TownLineMat();
          // Match terrain dirt color for town internal roads
          roadLineMat.color = new THREE.Color(0.45, 0.32, 0.18); // dirtBrown
          roadLineMat.linewidth = 2;
          const roadLine = new THREE.Line(roadGeometry, roadLineMat);
          townMarkers.add(roadLine);
        }
      }

      // Draw building footprints with LOD support
      for (const building of town.buildings) {
        const bx = building.position.x + worldCenterOffset;
        const bz = building.position.z + worldCenterOffset;
        const by = building.position.y;

        // Building dimensions (use defaults if not specified)
        const buildingWidth = building.size?.width || 10;
        const buildingDepth = building.size?.depth || 10;
        const buildingHeight = 8; // Default height for visualization

        // Create LOD group for this building
        const buildingLOD = new THREE.LOD();
        buildingLOD.position.set(bx, by, bz);
        buildingLOD.rotation.y = building.rotation || 0;

        // LOD 0: Full detail - try to generate procedural building
        let fullDetailMesh: THREE.Object3D | null = null;
        const buildingGen = new BuildingGenerator();
        const generatedBuilding = buildingGen.generate(
          building.type || "house",
          {
            includeRoof: true,
            seed: `${town.id}-${building.id}`,
          },
        );

        if (generatedBuilding && generatedBuilding.mesh) {
          fullDetailMesh = generatedBuilding.mesh;
          fullDetailMesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Register building for walkability tracking (unified with game logic)
          if (generatedBuilding.layout) {
            buildingWalkabilityService.registerBuilding(
              building.id,
              town.id,
              { x: bx, y: by, z: bz },
              building.rotation || 0,
              generatedBuilding.layout,
              by, // maxGroundY approximation
            );
          }
        } else {
          // Fallback to detailed box if generation fails
          const detailGeometry = new THREE.BoxGeometry(
            buildingWidth,
            buildingHeight,
            buildingDepth,
          );
          const detailMaterial = new TownStdMat();
          detailMaterial.color = new THREE.Color(0xd4a373);
          detailMaterial.roughness = 0.7;
          detailMaterial.metalness = 0.1;
          fullDetailMesh = new THREE.Mesh(detailGeometry, detailMaterial);
          fullDetailMesh.position.y = buildingHeight / 2;
          fullDetailMesh.castShadow = true;
          fullDetailMesh.receiveShadow = true;
        }

        // LOD 1: Simple box (medium distance)
        const simpleGeometry = new THREE.BoxGeometry(
          buildingWidth,
          buildingHeight,
          buildingDepth,
        );
        const simpleMaterial = new TownStdMat();
        simpleMaterial.color = new THREE.Color(0xd4a373);
        simpleMaterial.roughness = 0.9;
        const simpleMesh = new THREE.Mesh(simpleGeometry, simpleMaterial);
        simpleMesh.position.y = buildingHeight / 2;
        simpleMesh.castShadow = false;
        simpleMesh.receiveShadow = true;

        // LOD 2: Very simple box (far distance) - less geometry
        const farGeometry = new THREE.BoxGeometry(
          buildingWidth,
          buildingHeight,
          buildingDepth,
          1,
          1,
          1,
        );
        const farMaterial = new TownBasicMat();
        farMaterial.color = new THREE.Color(0xc9a577);
        const farMesh = new THREE.Mesh(farGeometry, farMaterial);
        farMesh.position.y = buildingHeight / 2;

        // Building userData for selection
        const buildingUserData = {
          selectable: true,
          selectableType: "building",
          selectableId: building.id,
          townId: town.id,
          townName: town.name,
          buildingType: building.type,
        };

        // Set userData on all meshes and descendants so raycasting works
        // fullDetailMesh might be a group with children, so traverse it
        fullDetailMesh.userData = buildingUserData;
        fullDetailMesh.traverse((child) => {
          child.userData = { ...child.userData, ...buildingUserData };
        });
        simpleMesh.userData = buildingUserData;
        farMesh.userData = buildingUserData;

        // Add LOD levels
        buildingLOD.addLevel(fullDetailMesh, 0);
        buildingLOD.addLevel(simpleMesh, BUILDING_LOD_FULL_DISTANCE);
        buildingLOD.addLevel(farMesh, BUILDING_LOD_SIMPLE_DISTANCE);

        // Also set on LOD parent for consistency
        buildingLOD.userData = buildingUserData;

        townMarkers.add(buildingLOD);
        selectableObjectsRef.current.push(buildingLOD);
      }

      // Render town landmarks (fences, lampposts, wells, signposts, etc.)
      if (town.landmarks && town.landmarks.length > 0) {
        for (const landmark of town.landmarks) {
          const lx = landmark.position.x + worldCenterOffset;
          const lz = landmark.position.z + worldCenterOffset;
          const ly = landmark.position.y;

          // Color based on landmark type
          let color = 0x888888;
          let height = landmark.size.height;

          switch (landmark.type) {
            case "well":
              color = 0x5a5a6a;
              break; // Gray stone
            case "fountain":
              color = 0x4a7aaa;
              break; // Blue-gray
            case "market_stall":
              color = 0xaa7a4a;
              break; // Brown wood
            case "signpost":
              color = 0x8a6a4a;
              break; // Wood brown
            case "bench":
              color = 0x7a5a3a;
              break; // Dark wood
            case "barrel":
              color = 0x6a5a4a;
              break; // Barrel brown
            case "crate":
              color = 0x8a7a5a;
              break; // Crate tan
            case "lamppost":
              color = 0x3a3a3a;
              break; // Dark iron
            case "planter":
              color = 0x5a8a5a;
              break; // Green
            case "tree":
              color = 0x3a6a3a;
              height = 4;
              break; // Tree green
            case "fence_post":
              color = 0x6a5030;
              break; // Rustic wood brown
            case "fence_gate":
              color = 0x7a6040;
              break; // Lighter wood for gate
          }

          const landmarkGeo = new THREE.BoxGeometry(
            landmark.size.width,
            height,
            landmark.size.depth,
          );
          const landmarkMat = new TownStdMat();
          landmarkMat.color = new THREE.Color(color);
          landmarkMat.roughness = 0.7;
          const landmarkMesh = new THREE.Mesh(landmarkGeo, landmarkMat);
          landmarkMesh.position.set(lx, ly + height / 2, lz);
          landmarkMesh.rotation.y = landmark.rotation;
          landmarkMesh.castShadow = true;
          landmarkMesh.receiveShadow = true;
          townMarkers.add(landmarkMesh);
        }
      }
    }

    // Generate roads using actual road network data
    if (providedRoads && providedRoads.length > 0) {
      // DEBUG: Log road coordinate transformation details
      console.log("[TileBasedTerrain] ===== ROAD COORDINATE DEBUG =====");
      console.log(`[TileBasedTerrain] worldCenterOffset: ${worldCenterOffset}`);
      console.log(`[TileBasedTerrain] worldSize: ${worldSize}`);

      // Log first road's first few points in both coordinate systems
      const firstRoad = providedRoads[0];
      if (firstRoad && firstRoad.path.length > 0) {
        console.log(
          `[TileBasedTerrain] First road (${firstRoad.id}) sample points:`,
        );
        const sampleCount = Math.min(3, firstRoad.path.length);
        for (let i = 0; i < sampleCount; i++) {
          const p = firstRoad.path[i];
          const renderX = p.x + worldCenterOffset;
          const renderZ = p.z + worldCenterOffset;
          const terrainY = generator.getHeightAt(p.x, p.z);
          console.log(
            `  Point ${i}: terrain-gen coords (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) -> render coords (${renderX.toFixed(1)}, ${renderZ.toFixed(1)}), height: ${terrainY.toFixed(1)}`,
          );
        }
      }
      console.log("[TileBasedTerrain] ================================");

      // Use pre-generated road network with actual pathfinding data
      // Road colors match terrain dirt colors: dirtBrown (0.45, 0.32, 0.18), dirtDark (0.32, 0.22, 0.12)
      const roadMaterial = new MeshBasicNodeMaterial();
      roadMaterial.color = new THREE.Color(0.42, 0.3, 0.16); // Matches dirtBrown
      roadMaterial.side = THREE.DoubleSide;

      const mainRoadMaterial = new MeshBasicNodeMaterial();
      mainRoadMaterial.color = new THREE.Color(0.32, 0.22, 0.12); // Matches dirtDark - compacted main roads
      mainRoadMaterial.side = THREE.DoubleSide;

      for (const road of providedRoads) {
        if (road.path.length < 2) continue;

        // Convert road path points to THREE.Vector3 with terrain sampling
        const roadPoints: THREE.Vector3[] = road.path.map((point) => {
          // Get actual terrain height at this point, or use provided y
          const y =
            point.y !== undefined
              ? point.y
              : generator.getHeightAt(point.x, point.z) + 0.3;
          return new THREE.Vector3(
            point.x + worldCenterOffset,
            y,
            point.z + worldCenterOffset,
          );
        });

        // Create road as a tube/ribbon with appropriate width
        const roadWidth = road.isMainRoad
          ? (road.width || 4) * 1.2
          : road.width || 4;
        const segments = Math.max(roadPoints.length * 2, 20);

        const roadCurve = new THREE.CatmullRomCurve3(roadPoints);
        const roadGeometry = new THREE.TubeGeometry(
          roadCurve,
          segments,
          roadWidth / 2, // radius = half width
          4,
          false,
        );

        const material = road.isMainRoad ? mainRoadMaterial : roadMaterial;
        const roadMesh = new THREE.Mesh(roadGeometry, material);
        roadMesh.userData = {
          selectable: true,
          selectableType: "road",
          selectableId: road.id,
          connectedTowns: road.connectedTowns,
          isMainRoad: road.isMainRoad,
        };

        townMarkers.add(roadMesh);
        selectableObjectsRef.current.push(roadMesh);
      }

      console.log(
        `[TileBasedTerrain] Created ${providedRoads.length} roads from road network data`,
      );
      setRoadCount(providedRoads.length);

      // DEBUG: Create elevated road visualization 5m above ground
      // This helps verify road coordinates align with terrain road influence
      const DEBUG_ROAD_HEIGHT = 5;
      const debugRoadMaterial = new THREE.LineBasicMaterial({
        color: 0xff00ff, // Bright magenta for visibility
        linewidth: 2,
      });
      const debugMainRoadMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff, // Bright cyan for main roads
        linewidth: 3,
      });

      for (const road of providedRoads) {
        if (road.path.length < 2) continue;

        // Create line geometry for debug visualization
        const debugPoints: THREE.Vector3[] = road.path.map((point) => {
          const terrainY = generator.getHeightAt(point.x, point.z);
          return new THREE.Vector3(
            point.x + worldCenterOffset,
            terrainY + DEBUG_ROAD_HEIGHT,
            point.z + worldCenterOffset,
          );
        });

        const debugGeometry = new THREE.BufferGeometry().setFromPoints(
          debugPoints,
        );
        const debugMaterial = road.isMainRoad
          ? debugMainRoadMaterial
          : debugRoadMaterial;
        const debugLine = new THREE.Line(debugGeometry, debugMaterial);
        debugLine.name = `debug-road-${road.id}`;
        townMarkers.add(debugLine);

        // Also add small spheres at road path vertices for point visibility
        const sphereGeometry = new THREE.SphereGeometry(1, 8, 8);
        const sphereMaterial = new THREE.MeshBasicMaterial({
          color: road.isMainRoad ? 0x00ffff : 0xff00ff,
        });
        for (const point of debugPoints) {
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.copy(point);
          townMarkers.add(sphere);
        }
      }

      // Also add ground-level ring markers every 20m along road paths
      // These show where road influence SHOULD be affecting terrain color
      const ringGeometry = new THREE.RingGeometry(1.5, 2, 16);
      ringGeometry.rotateX(-Math.PI / 2); // Lay flat on ground
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00, // Yellow rings
        side: THREE.DoubleSide,
      });

      let ringCount = 0;
      for (const road of providedRoads) {
        if (road.path.length < 2) continue;

        // Sample points every ~20m along the path
        for (let i = 0; i < road.path.length - 1; i++) {
          const p1 = road.path[i];
          const p2 = road.path[i + 1];
          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const segmentLength = Math.sqrt(dx * dx + dz * dz);
          const steps = Math.max(1, Math.floor(segmentLength / 20));

          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const x = p1.x + dx * t;
            const z = p1.z + dz * t;
            const terrainY = generator.getHeightAt(x, z);

            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.set(
              x + worldCenterOffset,
              terrainY + 0.2, // Slightly above ground to avoid z-fighting
              z + worldCenterOffset,
            );
            townMarkers.add(ring);
            ringCount++;
          }
        }
      }

      console.log(
        `[TileBasedTerrain] DEBUG: Created elevated road visualization (${DEBUG_ROAD_HEIGHT}m above ground) for ${providedRoads.length} roads`,
      );
      console.log(
        `[TileBasedTerrain] DEBUG: Created ${ringCount} ground-level road markers (yellow rings)`,
      );

      // Populate minimap roads data from actual road paths
      const minimapRoadData: Array<{ path: Array<{ x: number; z: number }> }> =
        providedRoads.map((road) => ({
          path: road.path.map((point) => ({
            x: point.x + worldCenterOffset,
            z: point.z + worldCenterOffset,
          })),
        }));
      setMinimapRoads(minimapRoadData);
    } else if (townResult.towns.length >= 2) {
      // Fallback: Generate simple MST-like roads for preview when no road data is provided
      console.warn(
        "[TileBasedTerrain] No road network data provided, using simplified preview roads",
      );

      // Match terrain dirt colors for roads
      const roadMaterial = new MeshBasicNodeMaterial();
      roadMaterial.color = new THREE.Color(0.42, 0.3, 0.16); // Matches dirtBrown
      roadMaterial.side = THREE.DoubleSide;

      // Create simple road connections between nearby towns
      const connectedPairs = new Set<string>();
      const sortedTowns = [...townResult.towns];

      for (let i = 0; i < sortedTowns.length; i++) {
        const town1 = sortedTowns[i];
        // Connect to nearest 2 towns not already connected
        const distances = sortedTowns
          .map((town2, j) => ({
            town2,
            index: j,
            dist: Math.sqrt(
              (town2.position.x - town1.position.x) ** 2 +
                (town2.position.z - town1.position.z) ** 2,
            ),
          }))
          .filter((d) => d.index !== i)
          .sort((a, b) => a.dist - b.dist);

        for (const { town2, index } of distances.slice(0, 2)) {
          const pairKey = [Math.min(i, index), Math.max(i, index)].join("-");
          if (connectedPairs.has(pairKey)) continue;
          connectedPairs.add(pairKey);

          // Create road path between towns
          const roadPoints: THREE.Vector3[] = [];
          const steps = 20;

          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const x =
              town1.position.x + (town2.position.x - town1.position.x) * t;
            const z =
              town1.position.z + (town2.position.z - town1.position.z) * t;
            const y = generator.getHeightAt(x, z) + 0.5;

            roadPoints.push(
              new THREE.Vector3(
                x + worldCenterOffset,
                y,
                z + worldCenterOffset,
              ),
            );
          }

          // Create road as a tube/ribbon
          if (roadPoints.length >= 2) {
            const roadCurve = new THREE.CatmullRomCurve3(roadPoints);
            const roadGeometry = new THREE.TubeGeometry(
              roadCurve,
              steps,
              4,
              4,
              false,
            );
            const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
            townMarkers.add(roadMesh);
          }
        }
      }

      console.log(
        `[TileBasedTerrain] Created ${connectedPairs.size} fallback road connections`,
      );
      setRoadCount(connectedPairs.size);

      // Populate minimap roads data (simplified straight lines)
      const minimapRoadData: Array<{ path: Array<{ x: number; z: number }> }> =
        [];
      const sortedTownsForRoads = [...townResult.towns];
      const processedPairs = new Set<string>();

      for (let i = 0; i < sortedTownsForRoads.length; i++) {
        const town1 = sortedTownsForRoads[i];
        const distances = sortedTownsForRoads
          .map((town2, j) => ({
            town2,
            index: j,
            dist: Math.sqrt(
              (town2.position.x - town1.position.x) ** 2 +
                (town2.position.z - town1.position.z) ** 2,
            ),
          }))
          .filter((d) => d.index !== i)
          .sort((a, b) => a.dist - b.dist);

        for (const { town2, index } of distances.slice(0, 2)) {
          const pairKey = [Math.min(i, index), Math.max(i, index)].join("-");
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);

          minimapRoadData.push({
            path: [
              {
                x: town1.position.x + worldCenterOffset,
                z: town1.position.z + worldCenterOffset,
              },
              {
                x: town2.position.x + worldCenterOffset,
                z: town2.position.z + worldCenterOffset,
              },
            ],
          });
        }
      }
      setMinimapRoads(minimapRoadData);
    } else {
      setRoadCount(0);
      setMinimapRoads([]);
    }

    // Populate minimap towns data
    const minimapTownData = townResult.towns.map((town) => ({
      id: town.id,
      name: town.name,
      position: {
        x: town.position.x + worldCenterOffset,
        z: town.position.z + worldCenterOffset,
      },
      size: town.size,
    }));
    setMinimapTowns(minimapTownData);

    // Generate vegetation if enabled
    if (showVegetation) {
      const vegetationSeed = config.seed;
      const seededRandom = (x: number, z: number, offset: number) => {
        const n =
          Math.sin(x * 12.9898 + z * 78.233 + vegetationSeed + offset) *
          43758.5453;
        return n - Math.floor(n);
      };

      // Create instanced meshes for each vegetation type
      const maxInstances = Math.min(
        10000,
        worldSizeMeters * worldSizeMeters * 0.01,
      ); // Cap instances

      // Tree instanced mesh (cone + cylinder)
      const treeGeometry = new THREE.ConeGeometry(3, 8, 6);
      treeGeometry.translate(0, 8, 0);
      const treeMaterial = new MeshStandardNodeMaterial();
      treeMaterial.color = new THREE.Color(VEGETATION_TYPES.tree.color);
      treeMaterial.flatShading = true;
      const treeInstances = new THREE.InstancedMesh(
        treeGeometry,
        treeMaterial,
        maxInstances,
      );
      treeInstances.castShadow = true;
      treeInstances.receiveShadow = true;

      // Trunk instanced mesh
      const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 4, 6);
      trunkGeometry.translate(0, 2, 0);
      const trunkMaterial = new VegStdMat();
      trunkMaterial.color = new THREE.Color(VEGETATION_TYPES.tree.trunkColor);
      const trunkInstances = new THREE.InstancedMesh(
        trunkGeometry,
        trunkMaterial,
        maxInstances,
      );

      // Rock instanced mesh (dodecahedron for irregular shape)
      const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
      rockGeometry.translate(0, 0.5, 0);
      const rockMaterial = new VegStdMat();
      rockMaterial.color = new THREE.Color(VEGETATION_TYPES.rock.color);
      rockMaterial.flatShading = true;
      const rockInstances = new THREE.InstancedMesh(
        rockGeometry,
        rockMaterial,
        maxInstances,
      );
      rockInstances.castShadow = true;
      rockInstances.receiveShadow = true;

      let treeCount = 0;
      let rockCount = 0;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();

      // Sample points across the terrain
      const sampleStep = 15; // Sample every 15 meters
      for (
        let wx = -worldSizeMeters / 2;
        wx < worldSizeMeters / 2;
        wx += sampleStep
      ) {
        for (
          let wz = -worldSizeMeters / 2;
          wz < worldSizeMeters / 2;
          wz += sampleStep
        ) {
          // Get terrain info at this point
          const query = generator.queryPoint(wx, wz);
          const height = query.height;

          // Skip water areas
          if (height < waterThreshold) continue;

          // Skip roads - check road influence at this point
          // Roads should have no vegetation (trees, rocks)
          if (providedRoads && providedRoads.length > 0) {
            const roadInfluence = calculateRoadInfluenceAtPoint(
              wx,
              wz,
              providedRoads,
              worldCenterOffset,
            );
            // Skip placement if on road (influence > 0.1 threshold)
            if (roadInfluence > 0.1) continue;
          }

          // Get vegetation density for this biome
          const vegDensity =
            BIOME_VEGETATION[query.biome] || BIOME_VEGETATION.plains;

          // Random chance for tree
          const treeRandom = seededRandom(wx, wz, 0);
          if (treeRandom < vegDensity.trees && treeCount < maxInstances) {
            const treeScale = 0.6 + seededRandom(wx, wz, 1) * 0.8;
            const treeRotation = seededRandom(wx, wz, 2) * Math.PI * 2;

            position.set(
              wx + worldCenterOffset,
              height,
              wz + worldCenterOffset,
            );
            scale.set(treeScale, treeScale, treeScale);
            quaternion.setFromAxisAngle(
              new THREE.Vector3(0, 1, 0),
              treeRotation,
            );
            matrix.compose(position, quaternion, scale);

            treeInstances.setMatrixAt(treeCount, matrix);
            trunkInstances.setMatrixAt(treeCount, matrix);
            treeCount++;
          }

          // Random chance for rock
          const rockRandom = seededRandom(wx, wz, 3);
          if (rockRandom < vegDensity.rocks && rockCount < maxInstances) {
            const rockScale = 0.3 + seededRandom(wx, wz, 4) * 1.2;
            const rockRotation = seededRandom(wx, wz, 5) * Math.PI * 2;

            position.set(
              wx + worldCenterOffset,
              height,
              wz + worldCenterOffset,
            );
            scale.set(rockScale, rockScale * 0.7, rockScale);
            quaternion.setFromAxisAngle(
              new THREE.Vector3(0, 1, 0),
              rockRotation,
            );
            matrix.compose(position, quaternion, scale);

            rockInstances.setMatrixAt(rockCount, matrix);
            rockCount++;
          }
        }
      }

      // Update instance counts
      treeInstances.count = treeCount;
      trunkInstances.count = treeCount;
      rockInstances.count = rockCount;

      treeInstances.instanceMatrix.needsUpdate = true;
      trunkInstances.instanceMatrix.needsUpdate = true;
      rockInstances.instanceMatrix.needsUpdate = true;

      vegetationContainer.add(treeInstances);
      vegetationContainer.add(trunkInstances);
      vegetationContainer.add(rockInstances);

      console.log(
        `[TileBasedTerrain] Created ${treeCount} trees, ${rockCount} rocks`,
      );
    }

    // Event listeners
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    container.addEventListener("click", handleClick);

    // Async WebGPU renderer initialization
    const initRenderer = async () => {
      const renderer = await createWebGPURenderer({
        antialias: true,
        alpha: true,
      });

      if (!mounted) {
        renderer.dispose();
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Animation loop
      let lastTime = performance.now();
      // Track camera rotation for minimap (throttled updates)
      let lastRotationUpdate = 0;

      const animate = () => {
        if (!mounted) return;
        animationIdRef.current = requestAnimationFrame(animate);

        const now = performance.now();
        const deltaTime = Math.min((now - lastTime) / 1000, 0.1); // Cap delta
        lastTime = now;
        const elapsedSeconds = now / 1000;

        updateCamera(deltaTime);
        updateTiles();

        // Update LOD objects based on camera position
        townMarkers.traverse((child) => {
          if (child instanceof THREE.LOD) {
            child.update(camera);
          }
        });

        // Animate wilderness skull (bobbing and pulsing)
        if (wildernessOverlayRef.current) {
          const wildernessGroup =
            wildernessOverlayRef.current as unknown as THREE.Group & {
              skullSprite?: THREE.Sprite;
            };
          if (wildernessGroup.skullSprite) {
            // Bob up and down
            const baseY = 50;
            const bobAmplitude = 3.0;
            const bobSpeed = 1.2;
            wildernessGroup.skullSprite.position.y =
              baseY + Math.sin(elapsedSeconds * bobSpeed) * bobAmplitude;

            // Subtle scale pulse
            const skullBaseSize = 30.0;
            const scalePulse = 1.0 + Math.sin(elapsedSeconds * 0.5) * 0.05;
            wildernessGroup.skullSprite.scale.set(
              skullBaseSize * scalePulse,
              skullBaseSize * scalePulse,
              1,
            );
          }
        }

        // Update camera rotation for minimap (throttle to every 100ms)
        if (now - lastRotationUpdate > 100) {
          setCameraRotationY(cameraStateRef.current.euler.y);
          lastRotationUpdate = now;
        }

        renderer.render(scene, camera);
      };
      animate();
    };

    initRenderer();

    // Handle resize
    const handleResize = () => {
      if (!container || !camera || !rendererRef.current) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // Capture refs for cleanup
    const currentTiles = tilesRef.current;
    const currentAnimationId = animationIdRef;
    const currentTemplateGeometry = templateGeometryRef;
    const currentTerrainMaterial = terrainMaterialRef;
    const currentWaterMaterial = waterMaterialRef;
    const currentTownMarkers = townMarkers;

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange,
      );
      container.removeEventListener("click", handleClick);

      cancelAnimationFrame(currentAnimationId.current);

      // Dispose all tiles
      for (const [key] of currentTiles) {
        const tile = currentTiles.get(key);
        if (tile) {
          tile.mesh.geometry.dispose();
          if (tile.water) tile.water.geometry.dispose();
        }
      }
      currentTiles.clear();

      // Dispose town markers
      currentTownMarkers.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });

      // Clear building walkability tracking
      buildingWalkabilityService.clear();

      // Dispose vegetation
      vegetationContainer.traverse((child) => {
        if (
          child instanceof THREE.InstancedMesh ||
          child instanceof THREE.Mesh
        ) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });

      // Dispose wilderness overlay
      if (wildernessOverlayRef.current) {
        wildernessOverlayRef.current.geometry.dispose();
        if (wildernessOverlayRef.current.material instanceof THREE.Material) {
          wildernessOverlayRef.current.material.dispose();
        }
      }

      // Dispose shared resources
      currentTemplateGeometry.current?.dispose();
      currentTerrainMaterial.current?.dispose();
      currentWaterMaterial.current?.dispose();

      // Dispose WebGPU renderer
      if (rendererRef.current) {
        if (
          container &&
          rendererRef.current.domElement.parentNode === container
        ) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      // Exit pointer lock if active
      if (document.pointerLockElement === container) {
        document.exitPointerLock();
      }
    };
  }, [
    terrainConfig,
    worldSize,
    tileSize,
    tileResolution,
    waterThreshold,
    config.seed,
    config.towns,
    providedRoads,
    handleMouseMove,
    handleKeyDown,
    handleKeyUp,
    handlePointerLockChange,
    handleClick,
    updateCamera,
    updateTiles,
    showVegetation,
  ]);

  // Regenerate terrain when config changes
  useEffect(() => {
    // Clear existing tiles
    for (const key of tilesRef.current.keys()) {
      unloadTile(key);
    }
    tileQueueRef.current = [];

    // Update generator
    generatorRef.current = new TerrainGenerator(terrainConfig);

    // Update template geometry if resolution changed
    if (templateGeometryRef.current) {
      templateGeometryRef.current.dispose();
      templateGeometryRef.current = createTemplateGeometry(
        tileSize,
        tileResolution,
      );
    }
  }, [terrainConfig, tileSize, tileResolution, unloadTile]);

  // Regenerate tiles when roads change to update road influence on terrain
  // This ensures road colors appear when roads are generated asynchronously
  const prevRoadsLengthRef = useRef<number | undefined>(undefined);
  const initialMountRef = useRef(true);
  useEffect(() => {
    const currentRoadsLength = providedRoads?.length ?? 0;
    const prevRoadsLength = prevRoadsLengthRef.current;

    // Skip on initial mount (tiles aren't loaded yet anyway)
    if (initialMountRef.current) {
      initialMountRef.current = false;
      prevRoadsLengthRef.current = currentRoadsLength;
      return;
    }

    // Check if roads actually changed (by length - simple heuristic)
    if (prevRoadsLength === currentRoadsLength) return;

    prevRoadsLengthRef.current = currentRoadsLength;

    // Regenerate tiles if any are loaded (to include road influence)
    if (tilesRef.current.size > 0) {
      console.log(
        `[TileBasedTerrain] Roads changed: ${prevRoadsLength ?? 0} -> ${currentRoadsLength} roads, regenerating ${tilesRef.current.size} tiles for road influence update`,
      );

      // Clear existing tiles to force regeneration with new road data
      for (const key of tilesRef.current.keys()) {
        unloadTile(key);
      }

      // Reset tile queue to trigger immediate regeneration
      tileQueueRef.current = [];
    }
  }, [providedRoads, unloadTile]);

  // Notify parent of tile count changes
  useEffect(() => {
    const totalTiles = worldSize * worldSize;
    onTileCountChange?.(loadedTiles, totalTiles);
  }, [loadedTiles, worldSize, onTileCountChange]);

  // Toggle vegetation visibility
  useEffect(() => {
    if (vegetationContainerRef.current) {
      vegetationContainerRef.current.visible = showVegetation;
    }
  }, [showVegetation]);

  // Selection highlighting effect
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !selectedId) {
      // Remove existing selection outline
      if (selectionOutlineRef.current) {
        scene?.remove(selectionOutlineRef.current);
        selectionOutlineRef.current.geometry.dispose();
        if (selectionOutlineRef.current.material instanceof THREE.Material) {
          selectionOutlineRef.current.material.dispose();
        }
        selectionOutlineRef.current = null;
      }
      return;
    }

    // Find the selected object
    const selectedObject = selectableObjectsRef.current.find(
      (obj) => obj.userData.selectableId === selectedId,
    );

    if (selectedObject && selectedObject instanceof THREE.Mesh) {
      // Remove existing outline
      if (selectionOutlineRef.current) {
        scene.remove(selectionOutlineRef.current);
        selectionOutlineRef.current.geometry.dispose();
        if (selectionOutlineRef.current.material instanceof THREE.Material) {
          selectionOutlineRef.current.material.dispose();
        }
      }

      // Create outline based on object's bounding box
      const box = new THREE.Box3().setFromObject(selectedObject);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Create a wireframe box as selection indicator
      const outlineGeometry = new THREE.BoxGeometry(
        size.x + 4,
        size.y + 4,
        size.z + 4,
      );
      const outlineMaterial = new MeshBasicNodeMaterial();
      outlineMaterial.color = new THREE.Color(0x00ff00);
      outlineMaterial.wireframe = true;
      outlineMaterial.transparent = true;
      outlineMaterial.opacity = 0.8;
      const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
      outline.position.copy(center);
      outline.renderOrder = 999; // Render on top

      scene.add(outline);
      selectionOutlineRef.current = outline;
    }

    return () => {
      // Cleanup on unmount or selectedId change
      if (selectionOutlineRef.current && scene) {
        scene.remove(selectionOutlineRef.current);
        selectionOutlineRef.current.geometry.dispose();
        if (selectionOutlineRef.current.material instanceof THREE.Material) {
          selectionOutlineRef.current.material.dispose();
        }
        selectionOutlineRef.current = null;
      }
    };
  }, [selectedId]);

  // Hover detection for tooltip
  const handleMouseMoveForHover = useCallback((event: MouseEvent) => {
    if (isPointerLockedRef.current) {
      setHoveredObject(null);
      return;
    }

    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    // Calculate mouse position
    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    raycasterRef.current.setFromCamera(mouseRef.current, camera);

    // Check for intersections (recursive to catch building child meshes)
    const intersects = raycasterRef.current.intersectObjects(
      selectableObjectsRef.current,
      true,
    );

    if (intersects.length > 0) {
      const hit = intersects[0];
      const userData = hit.object.userData as {
        selectableType?: string;
        selectableId?: string;
        townName?: string;
        buildingType?: string;
      };

      if (userData.selectableId) {
        let label = userData.selectableId;
        if (userData.selectableType === "town" && userData.townName) {
          label = `Town: ${userData.townName}`;
        } else if (
          userData.selectableType === "building" &&
          userData.buildingType
        ) {
          label = `Building: ${userData.buildingType}`;
        }
        setHoveredObject(label);
        return;
      }
    }

    setHoveredObject(null);
  }, []);

  // Add hover detection to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mousemove", handleMouseMoveForHover);
    return () => {
      container.removeEventListener("mousemove", handleMouseMoveForHover);
    };
  }, [handleMouseMoveForHover]);

  // Track if fly mode is active for UI
  const [isFlyModeActive, setIsFlyModeActive] = useState(false);

  // Sync internal fly mode state with pointer lock
  useEffect(() => {
    const checkPointerLock = () => {
      setIsFlyModeActive(document.pointerLockElement === containerRef.current);
    };
    document.addEventListener("pointerlockchange", checkPointerLock);
    return () =>
      document.removeEventListener("pointerlockchange", checkPointerLock);
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Fly mode controls overlay - only show when fly mode enabled or active */}
      {(flyModeEnabled || isFlyModeActive) && (
        <div
          className={`absolute top-4 left-4 rounded-lg p-3 text-xs pointer-events-none transition-colors ${
            isFlyModeActive
              ? "bg-blue-500/20 border border-blue-500/50 text-blue-200"
              : "bg-bg-secondary/90 text-text-secondary"
          }`}
        >
          <div className="font-semibold text-text-primary mb-2 flex items-center gap-2">
            {isFlyModeActive ? "✈️ Fly Mode Active" : "✈️ Fly Mode Ready"}
          </div>
          {isFlyModeActive ? (
            <>
              <div>WASD / Arrows - Move</div>
              <div>Space / Shift - Up / Down</div>
              <div>Ctrl - Speed boost</div>
              <div className="text-yellow-300 mt-1">
                Press Esc or Click to exit
              </div>
            </>
          ) : (
            <div>Click anywhere to enter fly mode</div>
          )}
        </div>
      )}

      {/* Selection mode indicator - show when not in fly mode */}
      {!flyModeEnabled && !isFlyModeActive && (
        <div className="absolute top-4 left-4 bg-bg-secondary/90 rounded-lg p-3 text-xs text-text-secondary pointer-events-none">
          <div className="font-semibold text-text-primary mb-2">
            🎯 Selection Mode
          </div>
          <div>Click terrain, towns, or buildings to select</div>
          <div>Enable Fly Mode from toolbar for camera control</div>
        </div>
      )}

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 bg-bg-secondary/90 rounded-lg p-3 text-xs text-text-primary pointer-events-none">
        <div>
          Tiles: {loadedTiles} / {worldSize * worldSize}
        </div>
        <div>
          World: {worldSize * tileSize}m x {worldSize * tileSize}m
        </div>
        <div>
          Towns: {townCount} | Roads: {roadCount}
        </div>
        <div>Vegetation: {showVegetation ? "On" : "Off"}</div>
        {isGenerating && (
          <div className="text-accent-primary mt-1">Loading tiles...</div>
        )}

        {/* LOD Legend */}
        <div className="mt-2 pt-2 border-t border-border-primary">
          <div className="font-semibold mb-1">Building LOD</div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>Full (0-200m)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Simple (200-500m)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span>Box (500m+)</span>
            </div>
          </div>
        </div>

        {/* Zone Legend */}
        <div className="mt-2 pt-2 border-t border-border-primary">
          <div className="font-semibold mb-1">Zones</div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500/50" />
              <span>Wilderness (PVP)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Minimap */}
      <Minimap
        worldSize={worldSize * tileSize}
        cameraPosition={cameraStateRef.current.position}
        cameraRotationY={cameraRotationY}
        towns={minimapTowns}
        roads={minimapRoads}
        className="absolute bottom-4 left-4"
        onNavigate={(x, z) => {
          // Teleport camera to clicked position
          const newY = Math.max(cameraStateRef.current.position.y, 100);
          cameraStateRef.current.position.set(x, newY, z);
        }}
      />

      {/* Hover tooltip */}
      {hoveredObject && !isPointerLockedRef.current && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-bg-primary/95 border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary pointer-events-none shadow-lg">
          {hoveredObject}
          <span className="text-text-muted ml-2">(click to select)</span>
        </div>
      )}

      {/* Selected item indicator */}
      {selectedId && (
        <div className="absolute bottom-4 right-4 bg-green-500/20 border border-green-500/50 rounded-lg px-3 py-2 text-sm text-green-400 pointer-events-none">
          Selected: {selectedId}
        </div>
      )}
    </div>
  );
};

export default TileBasedTerrain;
