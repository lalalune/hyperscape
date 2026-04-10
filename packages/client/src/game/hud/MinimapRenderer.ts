/**
 * MinimapRenderer.ts - Pure canvas 2D drawing functions for the minimap.
 *
 * All functions take a CanvasRenderingContext2D (or compatible interface) and
 * data as input. They are completely free of React dependencies.
 */

import { THREE } from "@hyperscape/shared";
import type { MinimapRoadWithAABB, MinimapTown } from "./useMinimapWorldCaches";
import type { EntityPip } from "./useMinimapEntityPips";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Fixed road/building pixel widths -- do NOT scale with zoom */
const ROAD_LINE_WIDTH_PX = 5;
const ROAD_OUTLINE_WIDTH_PX = 7;
const BUILDING_LINE_WIDTH_PX = 0.5;
const ROAD_OUTLINE_COLOR = "rgb(56, 60, 68)";
const ROAD_FILL_COLOR = "rgb(164, 151, 128)";
const BUILDING_FILL_COLOR = "rgba(84, 92, 104, 0.92)";
const BUILDING_STROKE_COLOR = "rgb(34, 39, 46)";

/** Color palette for group members (up to 8 unique) */
const GROUP_COLORS = [
  "#4CAF50", // Green - party leader
  "#2196F3", // Blue
  "#9C27B0", // Purple
  "#FF9800", // Orange
  "#00BCD4", // Cyan
  "#E91E63", // Pink
  "#CDDC39", // Lime
  "#607D8B", // Blue-grey
];

/** Flyweight icon cache size in px */
const ICON_SIZE = 16;

// ─── Types ─────────────────────────────────────────────────────────────────────

/** 2D context interface for minimap drawing -- satisfied by both CanvasRenderingContext2D and OffscreenCanvasRenderingContext2D */
interface MinimapDrawContext {
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  stroke(): void;
  fill(): void;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: "butt" | "round" | "square";
  lineJoin: "bevel" | "round" | "miter";
}

/** Per-road projected data -- populated once per frame, two-pass rendered */
export interface ProjectedRoad {
  pts: Float32Array;
  len: number;
  fill: number;
  outline: number;
}

/** Per-instance render state factory. Each Minimap instance gets isolated scratch data. */
export interface MinimapRenderState {
  /** Camera forward direction (XZ) */
  forwardVec: THREE.Vector3;
  /** Pip world->screen projection scratch */
  projectVec: THREE.Vector3;
  /** Destination marker projection scratch */
  destVec: THREE.Vector3;
  /** screenToWorldXZ unprojection scratch */
  unprojectVec: THREE.Vector3;
  /** Camera follow target position scratch */
  targetPos: { x: number; z: number };
  /** Combined projection-view matrix, updated once per frame */
  projectionViewMatrix: THREE.Matrix4;
  /** Whether projectionViewMatrix has been populated this session */
  hasCachedMatrix: boolean;
}

/** Augmented window type covering all Hyperscape globals written to window */
export type HyperscapeWindow = Window &
  typeof globalThis & {
    __lastRaycastTarget?: { x: number; y: number; z: number; method: string };
    __HYPERSCAPE_CONFIG__?: { mode?: string; followEntity?: string };
  };

// ─── Render State ──────────────────────────────────────────────────────────────

export function createRenderState(): MinimapRenderState {
  return {
    forwardVec: new THREE.Vector3(),
    projectVec: new THREE.Vector3(),
    destVec: new THREE.Vector3(),
    unprojectVec: new THREE.Vector3(),
    targetPos: { x: 0, z: 0 },
    projectionViewMatrix: new THREE.Matrix4(),
    hasCachedMatrix: false,
  };
}

// ─── Road Pixel Buffer ─────────────────────────────────────────────────────────

/**
 * Pre-allocated flat pixel-path buffer -- zero heap allocation per road per frame.
 * Grows by doubling when capacity is exceeded; never shrinks.
 */
export function ensureRoadPixelBufCapacity(
  buf: Float32Array,
  needed: number,
): Float32Array {
  if (buf.length >= needed * 2) return buf;
  let n = buf.length;
  while (n < needed * 2) n *= 2;
  return new Float32Array(n);
}

// ─── Projection ────────────────────────────────────────────────────────────────

/**
 * Project a world XZ point to canvas pixel coordinates using the camera's
 * projection-view matrix. Mutates scratchVec in place for zero-alloc perf.
 */
export function worldToPx(
  wx: number,
  wz: number,
  projectionViewMatrix: THREE.Matrix4,
  scratchVec: THREE.Vector3,
  cw: number,
  ch: number,
): void {
  scratchVec.set(wx, 0, wz);
  scratchVec.applyMatrix4(projectionViewMatrix);
  scratchVec.x = (scratchVec.x * 0.5 + 0.5) * cw;
  scratchVec.y = (scratchVec.y * -0.5 + 0.5) * ch;
}

// ─── Shape Primitives ──────────────────────────────────────────────────────────

/** Draw a star shape on canvas for quest markers */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number = 5,
): void {
  const step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < 2 * points; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

/** Draw a diamond shape on canvas */
export function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size); // Top
  ctx.lineTo(cx + size, cy); // Right
  ctx.lineTo(cx, cy + size); // Bottom
  ctx.lineTo(cx - size, cy); // Left
  ctx.closePath();
}

/**
 * Draw a red flag destination marker (RS3-style).
 * Simple: thin pole + small filled triangle flag.
 */
export function drawFlag(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  // Pole
  ctx.strokeStyle = "#880000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 3);
  ctx.lineTo(cx, cy - 5);
  ctx.stroke();

  // Flag (small filled triangle off the pole)
  ctx.fillStyle = "#ff0000";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx + 5, cy - 3);
  ctx.lineTo(cx, cy - 1);
  ctx.closePath();
  ctx.fill();
}

// ─── Icon Cache ────────────────────────────────────────────────────────────────

/**
 * Flyweight icon cache: each distinct subType is rendered exactly ONCE into a
 * 16x16 OffscreenCanvas and stored here. Every subsequent call uses drawImage()
 * which is GPU-accelerated and ~10-20x faster than re-executing path drawing code.
 *
 * The cache is populated lazily so fonts are guaranteed to be loaded by first use.
 */
const iconCache = new Map<string, OffscreenCanvas | null>();

/** Inner glyph renderer -- only called once per subType. */
function drawIconGlyph(
  ctx: MinimapDrawContext & {
    font: string;
    textAlign: "left" | "right" | "center" | "start" | "end";
    textBaseline:
      | "top"
      | "hanging"
      | "middle"
      | "alphabetic"
      | "ideographic"
      | "bottom";
    fillText(text: string, x: number, y: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    strokeRect(x: number, y: number, w: number, h: number): void;
    arc(x: number, y: number, r: number, sA: number, eA: number): void;
    ellipse(
      x: number,
      y: number,
      rX: number,
      rY: number,
      rot: number,
      sA: number,
      eA: number,
    ): void;
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  },
  cx: number,
  cy: number,
  subType: string,
): boolean {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000000";

  switch (subType) {
    // --- Bank: gold coin ($) ---
    case "bank":
      ctx.fillStyle = "#daa520";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", cx + 0.5, cy + 1);
      break;

    // --- Shop: small open-top bag ---
    case "shop":
      ctx.fillStyle = "#daa520";
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 4);
      ctx.lineTo(cx - 4, cy + 5);
      ctx.lineTo(cx + 4, cy + 5);
      ctx.lineTo(cx + 5, cy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    // --- Prayer altar: simple cross ---
    case "altar":
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx - 1.5, cy - 6, 3, 12);
      ctx.fillRect(cx - 5, cy - 2.5, 10, 3);
      ctx.strokeRect(cx - 1.5, cy - 6, 3, 12);
      ctx.strokeRect(cx - 5, cy - 2.5, 10, 3);
      break;

    // --- Runecrafting altar: purple circle ---
    case "runecrafting_altar":
      ctx.fillStyle = "#7744cc";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("R", cx + 0.5, cy + 1);
      break;

    // --- Anvil: dark flat anvil silhouette ---
    case "anvil":
      ctx.fillStyle = "#666666";
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 4);
      ctx.lineTo(cx - 4, cy - 1);
      ctx.lineTo(cx - 5, cy - 4);
      ctx.lineTo(cx + 5, cy - 4);
      ctx.lineTo(cx + 4, cy - 1);
      ctx.lineTo(cx + 6, cy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    // --- Furnace: orange circle with flame ---
    case "furnace":
      ctx.fillStyle = "#dd5500";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Simple flame (inverted drop)
      ctx.fillStyle = "#ffcc00";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.quadraticCurveTo(cx + 3, cy + 1, cx, cy + 4);
      ctx.quadraticCurveTo(cx - 3, cy + 1, cx, cy - 4);
      ctx.fill();
      break;

    // --- Cooking range: brown circle with steam ---
    case "range":
      ctx.fillStyle = "#8b5e3c";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Two short steam lines
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy + 1);
      ctx.lineTo(cx - 2, cy - 3);
      ctx.moveTo(cx + 2, cy + 1);
      ctx.lineTo(cx + 2, cy - 3);
      ctx.stroke();
      break;

    // --- Fishing spot: cyan dot with fish ---
    case "fishing":
      ctx.fillStyle = "#2288cc";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      // Tiny fish shape
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx - 1, cy, 3.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(cx + 2.5, cy);
      ctx.lineTo(cx + 5, cy - 2.5);
      ctx.lineTo(cx + 5, cy + 2.5);
      ctx.closePath();
      ctx.fill();
      break;

    // --- Mining rock: brown dot with pickaxe ---
    case "mining":
      ctx.fillStyle = "#8b6914";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      // Diagonal pick handle
      ctx.strokeStyle = "#dddddd";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 3.5, cy + 3.5);
      ctx.lineTo(cx + 3.5, cy - 3.5);
      ctx.stroke();
      // Pick head
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy - 5);
      ctx.lineTo(cx + 5, cy - 1);
      ctx.stroke();
      break;

    // --- Tree: green circle ---
    case "tree":
      ctx.fillStyle = "#228822";
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#115511";
      ctx.stroke();
      break;

    // --- Quest NPC (available): blue circle with white "!" ---
    case "quest_available":
    case "quest":
      ctx.fillStyle = "#2196F3";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", cx + 0.5, cy + 1);
      break;

    // --- Quest NPC (in progress): blue circle with white "?" ---
    case "quest_in_progress":
      ctx.fillStyle = "#2196F3";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", cx + 0.5, cy + 1);
      break;

    default:
      ctx.restore();
      return false;
  }

  ctx.restore();
  return true;
}

function renderIconOnce(subType: string): OffscreenCanvas | null {
  const offscreen = new OffscreenCanvas(ICON_SIZE, ICON_SIZE);
  const raw = offscreen.getContext("2d");
  if (!raw) return null;
  // OffscreenCanvasRenderingContext2D satisfies all properties in the extended
  // MinimapDrawContext intersection -- this cast is safe.
  const ictx = raw as Parameters<typeof drawIconGlyph>[0];
  const cx = ICON_SIZE / 2;
  const cy = ICON_SIZE / 2;
  const drawn = drawIconGlyph(ictx, cx, cy, subType);
  return drawn ? offscreen : null;
}

/**
 * Draw minimap icon for a location type.
 * Returns true if drawn, false for unknown subType (caller falls back to a dot).
 *
 * On first call per subType, renders to an OffscreenCanvas and caches it.
 * All subsequent calls use drawImage() -- zero path drawing overhead.
 */
export function drawMinimapIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  subType: string,
): boolean {
  let icon = iconCache.get(subType);
  if (icon === undefined) {
    // First time -- render and cache (null = unknown type, skip caching a blank canvas)
    icon = renderIconOnce(subType);
    iconCache.set(subType, icon);
  }
  if (!icon) return false;
  ctx.drawImage(
    icon,
    cx - ICON_SIZE / 2,
    cy - ICON_SIZE / 2,
    ICON_SIZE,
    ICON_SIZE,
  );
  return true;
}

/** Clear the icon flyweight cache so OffscreenCanvas objects can be GC'd */
export function clearIconCache(): void {
  iconCache.clear();
}

// ─── Roads & Buildings ─────────────────────────────────────────────────────────

/** Mutable holder for the road pixel buffer -- allows drawRoadsAndBuildings to grow it without caller needing to track the return. */
export interface RoadPixelBufHolder {
  current: Float32Array;
}

/** Options for drawRoadsAndBuildings */
export interface DrawRoadsAndBuildingsOptions {
  ctx: CanvasRenderingContext2D;
  roads: MinimapRoadWithAABB[] | null;
  towns: MinimapTown[] | null;
  roadPixelBufHolder: RoadPixelBufHolder;
  projectedRoads: ProjectedRoad[];
  projectionViewMatrix: THREE.Matrix4;
  scratchVec: THREE.Vector3;
  camX: number;
  camZ: number;
  viewRadius: number;
  /** Pixels per world unit: cw / (2 * extent). Used to scale road widths with zoom. */
  worldToPixel: number;
  cw: number;
  ch: number;
}

/**
 * Draw roads and buildings on an overlay canvas.
 *
 * Uses camera-matrix projection (same as entity pips) so roads zoom, pan, and
 * rotate in perfect lockstep with pips -- no separate coordinate system, no
 * terrain-cache dependency, no desync on zoom or rotation.
 *
 * Roads use fixed pixel widths (ROAD_LINE_WIDTH_PX / ROAD_OUTLINE_WIDTH_PX) so
 * they don't visually scale when the player zooms in/out -- only the terrain
 * background scales.
 *
 */
export function drawRoadsAndBuildings(
  opts: DrawRoadsAndBuildingsOptions,
): void {
  const {
    ctx,
    roads,
    towns,
    roadPixelBufHolder,
    projectedRoads,
    projectionViewMatrix,
    scratchVec,
    camX,
    camZ,
    viewRadius,
    worldToPixel,
    cw,
    ch,
  } = opts;

  if (roads && roads.length > 0) {
    // Two-pass rendering: all outlines first, all fills second.
    // Drawing per-road (outline->fill->outline->fill...) leaves dark outline bands
    // wherever roads cross because each road's outline paints over the previous
    // road's fill. Batching outlines then fills means every fill covers every
    // outline edge, so intersections look seamless.

    // Pass 0 -- count total visible points so we can pre-size the global buffer
    // in one shot, avoiding any mid-loop reallocation.
    let totalVisiblePts = 0;
    for (const road of roads) {
      if (road.path.length < 2) continue;
      if (
        road.maxX < camX - viewRadius ||
        road.minX > camX + viewRadius ||
        road.maxZ < camZ - viewRadius ||
        road.minZ > camZ + viewRadius
      )
        continue;
      totalVisiblePts += road.path.length;
    }
    roadPixelBufHolder.current = ensureRoadPixelBufCapacity(
      roadPixelBufHolder.current,
      totalVisiblePts,
    );
    const roadPixelBuf = roadPixelBufHolder.current;

    // Pass 1 (projection) -- write XY pairs into roadPixelBuf, store subarray
    // views in projectedRoads. Zero Float32Array allocations per frame.
    projectedRoads.length = 0;
    let bufOffset = 0;

    for (const road of roads) {
      if (road.path.length < 2) continue;
      if (
        road.maxX < camX - viewRadius ||
        road.minX > camX + viewRadius ||
        road.maxZ < camZ - viewRadius ||
        road.minZ > camZ + viewRadius
      )
        continue;

      const worldWidth = road.width > 0 ? road.width : 4;
      const scaledFill = Math.max(
        ROAD_LINE_WIDTH_PX,
        Math.min(40, worldWidth * worldToPixel),
      );
      const scaledOutline = Math.max(ROAD_OUTLINE_WIDTH_PX, scaledFill + 2);

      const ptsBase = bufOffset;
      for (let ri = 0; ri < road.path.length; ri++) {
        worldToPx(
          road.path[ri].x,
          road.path[ri].z,
          projectionViewMatrix,
          scratchVec,
          cw,
          ch,
        );
        roadPixelBuf[bufOffset++] = scratchVec.x;
        roadPixelBuf[bufOffset++] = scratchVec.y;
      }
      projectedRoads.push({
        pts: roadPixelBuf.subarray(ptsBase, bufOffset),
        len: road.path.length,
        fill: scaledFill,
        outline: scaledOutline,
      });
    }

    if (projectedRoads.length > 0) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Pass 2 -- outlines only (all roads)
      ctx.strokeStyle = ROAD_OUTLINE_COLOR;
      for (const r of projectedRoads) {
        ctx.lineWidth = r.outline;
        ctx.beginPath();
        ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 1; i < r.len; i++)
          ctx.lineTo(r.pts[i * 2], r.pts[i * 2 + 1]);
        ctx.stroke();
      }

      // Pass 3 -- fills only (all roads)
      ctx.strokeStyle = ROAD_FILL_COLOR;
      for (const r of projectedRoads) {
        ctx.lineWidth = r.fill;
        ctx.beginPath();
        ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 1; i < r.len; i++)
          ctx.lineTo(r.pts[i * 2], r.pts[i * 2 + 1]);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  if (towns && towns.length > 0) {
    ctx.save();
    // Building stroke scales with zoom but clamped to a thin line
    ctx.lineWidth = Math.max(
      BUILDING_LINE_WIDTH_PX + 0.25,
      Math.min(3.25, worldToPixel * 0.35),
    );
    for (const town of towns) {
      for (const building of town.buildings) {
        const bx = building.position.x;
        const bz = building.position.z;
        if (
          Math.abs(bx - camX) > viewRadius ||
          Math.abs(bz - camZ) > viewRadius
        )
          continue;

        const hw = building.size.width * 0.5;
        const hd = building.size.depth * 0.5;
        const cos = Math.cos(building.rotation);
        const sin = Math.sin(building.rotation);

        // Project 4 rotated corners through the camera matrix
        worldToPx(
          bx + cos * hw - sin * hd,
          bz + sin * hw + cos * hd,
          projectionViewMatrix,
          scratchVec,
          cw,
          ch,
        );
        const p0x = scratchVec.x;
        const p0y = scratchVec.y;

        worldToPx(
          bx - cos * hw - sin * hd,
          bz - sin * hw + cos * hd,
          projectionViewMatrix,
          scratchVec,
          cw,
          ch,
        );
        const p1x = scratchVec.x;
        const p1y = scratchVec.y;

        worldToPx(
          bx - cos * hw + sin * hd,
          bz - sin * hw - cos * hd,
          projectionViewMatrix,
          scratchVec,
          cw,
          ch,
        );
        const p2x = scratchVec.x;
        const p2y = scratchVec.y;

        worldToPx(
          bx + cos * hw + sin * hd,
          bz + sin * hw - cos * hd,
          projectionViewMatrix,
          scratchVec,
          cw,
          ch,
        );
        const p3x = scratchVec.x;
        const p3y = scratchVec.y;

        ctx.beginPath();
        ctx.moveTo(p0x, p0y);
        ctx.lineTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.lineTo(p3x, p3y);
        ctx.closePath();
        ctx.fillStyle = BUILDING_FILL_COLOR;
        ctx.fill();
        ctx.strokeStyle = BUILDING_STROKE_COLOR;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ─── Entity Pips ───────────────────────────────────────────────────────────────

/** Options for drawEntityPips */
export interface DrawEntityPipsOptions {
  ctx: CanvasRenderingContext2D;
  pips: EntityPip[];
  projectionViewMatrix: THREE.Matrix4;
  scratchVec: THREE.Vector3;
  camX: number;
  camZ: number;
  /** Half-extent + margin for world-space culling */
  pipCullRadius: number;
  viewportW: number;
  viewportH: number;
  /** performance.now() cached once per frame */
  frameTimeMs: number;
}

/**
 * Draw entity pips (players, mobs, items, quests, etc.) on the overlay canvas.
 */
export function drawEntityPips(opts: DrawEntityPipsOptions): void {
  const {
    ctx,
    pips,
    projectionViewMatrix,
    scratchVec,
    camX,
    camZ,
    pipCullRadius,
    viewportW,
    viewportH,
    frameTimeMs,
  } = opts;

  for (let pipIdx = 0; pipIdx < pips.length; pipIdx++) {
    const pip = pips[pipIdx];
    // World-space pre-cull: skip projection entirely for off-screen pips.
    // Uses Chebyshev distance (max of |dx|, |dz|) -- tighter than circle,
    // safe because the minimap is square-ish.
    if (
      Math.abs(pip.position.x - camX) > pipCullRadius ||
      Math.abs(pip.position.z - camZ) > pipCullRadius
    )
      continue;

    // Convert world position to screen position using cached matrix
    // Reuse pre-allocated vector instead of cloning to avoid GC pressure
    scratchVec.copy(pip.position);
    // Apply cached projection-view matrix manually instead of using project()
    scratchVec.applyMatrix4(projectionViewMatrix);

    const x = (scratchVec.x * 0.5 + 0.5) * viewportW;
    const y = (scratchVec.y * -0.5 + 0.5) * viewportH;

    // Only draw if within bounds
    if (x < 0 || x > viewportW || y < 0 || y > viewportH) continue;

    // Pip radius -- default 3px; player and quest are the only exceptions
    let radius = 3;
    const borderColor = "#000000";
    const borderWidth = 1;
    if (pip.type === "player") {
      radius = pip.groupIndex !== undefined && pip.groupIndex >= 0 ? 4 : 3;
    } else if (pip.type === "quest") {
      radius = pip.isActive ? 7 : 5;
    }

    // Determine pip color (group members use GROUP_COLORS)
    let pipColor = pip.color;
    if (
      pip.type === "player" &&
      pip.groupIndex !== undefined &&
      pip.groupIndex >= 0
    ) {
      pipColor = GROUP_COLORS[pip.groupIndex % GROUP_COLORS.length];
    }

    // Apply pulse animation for active pips (quests, etc.)
    let pulseScale = 1;
    if (pip.isActive) {
      // frameTimeMs is cached once per frame -- avoid per-pip Date.now() call
      const pulseTime = frameTimeMs / 500; // 500ms per cycle
      pulseScale = 1 + 0.15 * Math.sin(pulseTime * Math.PI * 2);
    }

    // Draw pip -- subtype icons use drawImage (no path needed).
    // beginPath() is deferred past the icon check to avoid building
    // a path that gets discarded for every icon-bearing pip.
    ctx.fillStyle = pipColor;

    if (pip.subType && drawMinimapIcon(ctx, x, y, pip.subType)) {
      // Icon drawn via cached OffscreenCanvas -- no path work needed
    } else if (pip.isLocalPlayer) {
      // RS3/OSRS: local player is a white square (slightly larger than dots)
      const sqHalf = 2.5;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - sqHalf, y - sqHalf, sqHalf * 2, sqHalf * 2);
    } else if (pip.type === "quest" || pip.icon === "star") {
      // Star for quest markers.
      // Shadow is set BEFORE the fill so one draw call produces both
      // the solid star and its glow ring -- then cleared before stroke
      // so the outline stays crisp with no halo artefacts.
      const scaledRadius = radius * pulseScale;
      if (pip.isActive) {
        ctx.shadowColor = pipColor;
        ctx.shadowBlur = 8;
      }
      drawStar(ctx, x, y, scaledRadius, scaledRadius * 0.5, 5);
      ctx.fill();
      ctx.shadowBlur = 0; // reset before stroke
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    } else if (pip.icon === "diamond") {
      // Diamond shape
      drawDiamond(ctx, x, y, radius);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    } else {
      // Circle for everything else (players, mobs, items)
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Add border for better visibility
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }
  }
}

// ─── Destination Marker ────────────────────────────────────────────────────────

/** Options for drawDestinationMarker */
export interface DrawDestinationMarkerOptions {
  ctx: CanvasRenderingContext2D;
  projectionViewMatrix: THREE.Matrix4;
  scratchVec: THREE.Vector3;
  viewportW: number;
  viewportH: number;
  targetX: number;
  targetZ: number;
}

/**
 * Draw the RS3-style red flag destination marker at a world coordinate.
 */
export function drawDestinationMarker(
  opts: DrawDestinationMarkerOptions,
): void {
  const {
    ctx,
    projectionViewMatrix,
    scratchVec,
    viewportW,
    viewportH,
    targetX,
    targetZ,
  } = opts;

  scratchVec.set(targetX, 0, targetZ);
  scratchVec.applyMatrix4(projectionViewMatrix);
  const sx = (scratchVec.x * 0.5 + 0.5) * viewportW;
  const sy = (scratchVec.y * -0.5 + 0.5) * viewportH;
  drawFlag(ctx, sx, sy);
}

// ─── Spectator Target ──────────────────────────────────────────────────────────

/** Camera info shape returned by the client-camera-system */
export interface SpectatorTarget {
  id?: string;
  position: { x: number; z: number };
}

/**
 * Returns the spectated entity's position when in spectator mode, or null.
 * Centralises the duplicated window.__HYPERSCAPE_CONFIG__ + camera-system reads
 * that previously appeared independently in the entity interval and the RAF loop.
 */
export function getSpectatorTarget(world: {
  getSystem: (name: string) => unknown;
}): SpectatorTarget | null {
  if ((window as HyperscapeWindow).__HYPERSCAPE_CONFIG__?.mode !== "spectator")
    return null;
  const cameraSystem = world.getSystem("client-camera-system") as {
    getCameraInfo?: () => {
      target?: {
        id?: string;
        node?: { position?: THREE.Vector3 };
        position?: { x: number; z: number };
      };
    };
  } | null;
  const info = cameraSystem?.getCameraInfo?.();
  if (!info?.target) return null;
  // Entity-interval callers need node.position (Vector3); RAF needs target.position ({x,z}).
  // Return the first available position shape.
  const pos = info.target.node?.position ?? info.target.position;
  if (!pos) return null;
  return { id: info.target.id, position: { x: pos.x, z: pos.z } };
}
