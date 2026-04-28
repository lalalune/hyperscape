/**
 * MinimapWorker - Offloads minimap rendering to a Web Worker
 *
 * Uses 2D Canvas API (OffscreenCanvas) to render a top-down view.
 * No Three.js needed - pure 2D rendering based on terrain height/color data.
 *
 * Architecture:
 * - Main thread sends terrain tile data (heights, colors)
 * - Worker renders to OffscreenCanvas using 2D context
 * - Either renders directly to transferred canvas, or returns ImageBitmap
 *
 * Features:
 * - Height-based terrain coloring
 * - Entity pip rendering
 * - Camera rotation support (RS3-style)
 * - Zoom/extent controls
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/** Terrain tile data for rendering */
export interface MinimapTile {
  tileX: number;
  tileZ: number;
  /** World-space size of tile */
  size: number;
  /** Resolution (pixels per axis) */
  resolution: number;
  /** RGB colors as Float32Array (resolution * resolution * 3) */
  colors: Float32Array;
  /** Heights as Float32Array (resolution * resolution) for water masking */
  heights: Float32Array;
  /** Water level threshold */
  waterLevel: number;
}

/** Entity pip for rendering on minimap */
export interface MinimapEntity {
  id: string;
  x: number;
  z: number;
  type: "player" | "enemy" | "item" | "building" | "resource" | "npc" | "quest";
  color: string;
  size?: number;
  /** Render as white square (local player) */
  isLocalPlayer?: boolean;
  /** Party member slot (0-7) for group color */
  groupIndex?: number;
  /** POI icon subtype: "bank", "shop", "quest", "mining", etc. */
  subType?: string;
  /** Pulse animation active */
  isActive?: boolean;
  /** Shape override: star, diamond, or default circle */
  icon?: "star" | "circle" | "diamond";
}

/** Road polyline with AABB for culling */
export interface MinimapRoad {
  path: Array<{ x: number; z: number }>;
  width: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Rotated building rectangle */
export interface MinimapBuilding {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: number;
}

/** Camera state for minimap rendering */
export interface MinimapCamera {
  /** Center X in world coords */
  x: number;
  /** Center Z in world coords */
  z: number;
  /** View extent (half-width in world units) */
  extent: number;
  /** Rotation in radians (0 = north up) */
  rotation: number;
}

/** Minimap configuration */
export interface MinimapConfig {
  /** Water color (hex) */
  waterColor: number;
  /** Background color when no terrain (hex) */
  backgroundColor: number;
  /** Whether to show grid lines */
  showGrid: boolean;
  /** Grid line color (hex) */
  gridColor: number;
  /** Grid cell size in world units */
  gridSize: number;
}

// ============================================================================
// WORKER MESSAGE TYPES
// ============================================================================

/** Messages sent TO the worker */
export type MinimapWorkerInput =
  | {
      type: "init";
      width: number;
      height: number;
      config?: Partial<MinimapConfig>;
    }
  | { type: "resize"; width: number; height: number }
  | { type: "setConfig"; config: Partial<MinimapConfig> }
  | { type: "addTiles"; tiles: MinimapTile[] }
  | { type: "removeTiles"; tileKeys: string[] }
  | { type: "updateCamera"; camera: MinimapCamera }
  | { type: "updateEntities"; entities: MinimapEntity[] }
  | { type: "updateRoads"; roads: MinimapRoad[] }
  | { type: "updateBuildings"; buildings: MinimapBuilding[] }
  | { type: "updateDestination"; x: number; z: number }
  | { type: "clearDestination" }
  | { type: "render" }
  | { type: "dispose" };

/** Messages sent FROM the worker */
export type MinimapWorkerOutput =
  | { type: "initialized"; success: boolean; error?: string }
  | { type: "rendered"; frameTime: number }
  | { type: "frame"; bitmap: ImageBitmap }
  | { type: "error"; message: string };

// ============================================================================
// WORKER CODE
// ============================================================================

/**
 * 2D Canvas-based minimap renderer.
 * Runs in worker with OffscreenCanvas for smooth main thread.
 */
const MINIMAP_WORKER_CODE = `
// Canvas and context
let canvas = null;
let ctx = null;
let width = 0;
let height = 0;
let useDirectCanvas = false;

// Terrain data (tileKey -> tile data)
const tiles = new Map();

// Entity data
let entities = [];

// Road data
let roads = [];

// Building data
let buildings = [];

// Destination marker (null = hidden)
let destination = null;

// Frame counter for animations
let frameCount = 0;

// Camera state
let camera = { x: 0, z: 0, extent: 50, rotation: 0 };

// Party colors (OSRS-style, 8 members)
const GROUP_COLORS = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800',
  '#00BCD4', '#E91E63', '#CDDC39', '#607D8B'
];

// Road rendering constants
const ROAD_LINE_WIDTH_PX = 5;
const ROAD_OUTLINE_WIDTH_PX = 7;
const ROAD_OUTLINE_COLOR = 'rgb(56, 60, 68)';
const ROAD_FILL_COLOR = 'rgb(164, 151, 128)';

// Building rendering constants
const BUILDING_FILL_COLOR = 'rgba(84, 92, 104, 0.92)';
const BUILDING_STROKE_COLOR = 'rgb(34, 39, 46)';

// POI icon cache (OffscreenCanvas per subType)
const iconCache = new Map();

// Config
let config = {
  waterColor: 0x3498db,
  backgroundColor: 0x1a1a2e,
  showGrid: false,
  gridColor: 0x333333,
  gridSize: 10
};

/**
 * Convert hex color to CSS string
 */
function hexToRgb(hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

/**
 * Initialize canvas and context
 */
function init(offscreenCanvas, w, h, initialConfig) {
  if (offscreenCanvas) {
    canvas = offscreenCanvas;
    useDirectCanvas = true;
  } else {
    // Check OffscreenCanvas support before creating
    if (typeof OffscreenCanvas === 'undefined') {
      return { success: false, error: 'OffscreenCanvas not supported' };
    }
    canvas = new OffscreenCanvas(w, h);
    useDirectCanvas = false;
  }
  
  width = w;
  height = h;
  canvas.width = w;
  canvas.height = h;
  
  ctx = canvas.getContext('2d');
  if (!ctx) {
    return { success: false, error: 'Failed to get 2D context' };
  }
  
  if (initialConfig) {
    Object.assign(config, initialConfig);
  }
  
  return { success: true };
}

/**
 * Resize canvas
 */
function resize(w, h) {
  width = w;
  height = h;
  canvas.width = w;
  canvas.height = h;
}

/**
 * Add terrain tiles
 */
function addTiles(newTiles) {
  for (const tile of newTiles) {
    const key = tile.tileX + '_' + tile.tileZ;
    
    // Pre-render tile to ImageData for fast blitting
    const pixelCount = tile.resolution * tile.resolution;
    const imageData = new ImageData(tile.resolution, tile.resolution);
    const data = imageData.data;
    
    for (let i = 0; i < pixelCount; i++) {
      const tileHeight = tile.heights[i];
      const isWater = tileHeight < tile.waterLevel;
      
      let r, g, b;
      if (isWater) {
        // Water color
        r = (config.waterColor >> 16) & 0xff;
        g = (config.waterColor >> 8) & 0xff;
        b = config.waterColor & 0xff;
      } else {
        // Terrain color from vertex colors
        r = Math.floor(tile.colors[i * 3] * 255);
        g = Math.floor(tile.colors[i * 3 + 1] * 255);
        b = Math.floor(tile.colors[i * 3 + 2] * 255);
      }
      
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    
    // Store tile data first with the raw ImageData
    const tileData = {
      tileX: tile.tileX,
      tileZ: tile.tileZ,
      size: tile.size,
      resolution: tile.resolution,
      bitmap: null
    };
    tiles.set(key, tileData);
    
    // Create ImageBitmap asynchronously for fast drawing
    // When ready, update the existing tile entry (not overwrite)
    createImageBitmap(imageData).then(bitmap => {
      const existingTile = tiles.get(key);
      if (existingTile) {
        existingTile.bitmap = bitmap;
      }
    });
  }
}

/**
 * Remove terrain tiles
 */
function removeTiles(tileKeys) {
  for (const key of tileKeys) {
    tiles.delete(key);
  }
}

/**
 * Update camera state
 */
function updateCamera(newCamera) {
  camera = newCamera;
}

/**
 * Update entity list
 */
function updateEntities(newEntities) {
  entities = newEntities;
}

/**
 * Convert world coords to screen coords
 */
function worldToScreen(worldX, worldZ) {
  // Apply camera rotation
  const cos = Math.cos(-camera.rotation);
  const sin = Math.sin(-camera.rotation);
  const dx = worldX - camera.x;
  const dz = worldZ - camera.z;
  const rotX = dx * cos - dz * sin;
  const rotZ = dx * sin + dz * cos;
  
  // Convert to screen coords
  const screenX = (rotX / camera.extent + 1) * width / 2;
  const screenY = (rotZ / camera.extent + 1) * height / 2;
  
  return { x: screenX, y: screenY };
}

/**
 * Render the minimap
 */
function render() {
  if (!ctx) return { frameTime: 0 };
  
  const startTime = performance.now();
  
  // Clear to transparent — this canvas is an overlay composited on top of terrain
  ctx.clearRect(0, 0, width, height);
  
  // Save context for rotation
  ctx.save();
  
  // Apply camera rotation around center
  ctx.translate(width / 2, height / 2);
  ctx.rotate(camera.rotation);
  ctx.translate(-width / 2, -height / 2);
  
  // Calculate visible world bounds
  const halfExtent = camera.extent;
  const worldMinX = camera.x - halfExtent * 1.5;
  const worldMaxX = camera.x + halfExtent * 1.5;
  const worldMinZ = camera.z - halfExtent * 1.5;
  const worldMaxZ = camera.z + halfExtent * 1.5;
  
  // Render terrain tiles
  for (const [key, tile] of tiles) {
    const tileWorldX = tile.tileX * tile.size;
    const tileWorldZ = tile.tileZ * tile.size;
    
    // Skip tiles outside view
    if (tileWorldX + tile.size < worldMinX || tileWorldX > worldMaxX) continue;
    if (tileWorldZ + tile.size < worldMinZ || tileWorldZ > worldMaxZ) continue;
    
    // Calculate screen position and size
    const topLeft = worldToScreen(tileWorldX, tileWorldZ);
    const bottomRight = worldToScreen(tileWorldX + tile.size, tileWorldZ + tile.size);
    const screenWidth = bottomRight.x - topLeft.x;
    const screenHeight = bottomRight.y - topLeft.y;
    
    // Draw tile (only if bitmap is ready - bitmap is created async)
    if (tile.bitmap) {
      ctx.drawImage(tile.bitmap, topLeft.x, topLeft.y, screenWidth, screenHeight);
    }
    // Note: We skip tiles without bitmaps - they'll render on next frame when bitmap is ready
    // This avoids putImageData which doesn't respect canvas transforms
  }
  
  // Draw grid if enabled
  if (config.showGrid) {
    ctx.strokeStyle = hexToRgb(config.gridColor);
    ctx.lineWidth = 1;

    const gridWorldMin = Math.floor(worldMinX / config.gridSize) * config.gridSize;
    const gridWorldMax = Math.ceil(worldMaxX / config.gridSize) * config.gridSize;

    for (let gx = gridWorldMin; gx <= gridWorldMax; gx += config.gridSize) {
      const start = worldToScreen(gx, worldMinZ);
      const end = worldToScreen(gx, worldMaxZ);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    for (let gz = gridWorldMin; gz <= gridWorldMax; gz += config.gridSize) {
      const start = worldToScreen(worldMinX, gz);
      const end = worldToScreen(worldMaxX, gz);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }

  ctx.restore();

  // Roads, buildings, entities drawn AFTER ctx.restore() because worldToScreen()
  // already applies camera rotation — no double-rotation from ctx.rotate().

  // Draw roads (two-pass: outlines first, then fills to avoid dark bands at intersections)
  if (roads.length > 0) {
    const viewRadius = camera.extent * 2;
    const worldToPixel = width / (2 * camera.extent);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pass 1: outlines
    ctx.strokeStyle = ROAD_OUTLINE_COLOR;
    for (const road of roads) {
      if (Math.abs((road.minX + road.maxX) / 2 - camera.x) > viewRadius) continue;
      if (Math.abs((road.minZ + road.maxZ) / 2 - camera.z) > viewRadius) continue;
      const outlineW = Math.max(ROAD_OUTLINE_WIDTH_PX, Math.min(40, road.width * worldToPixel) + 2);
      ctx.lineWidth = outlineW;
      ctx.beginPath();
      for (let i = 0; i < road.path.length; i++) {
        const p = worldToScreen(road.path[i].x, road.path[i].z);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // Pass 2: fills
    ctx.strokeStyle = ROAD_FILL_COLOR;
    for (const road of roads) {
      if (Math.abs((road.minX + road.maxX) / 2 - camera.x) > viewRadius) continue;
      if (Math.abs((road.minZ + road.maxZ) / 2 - camera.z) > viewRadius) continue;
      const fillW = Math.max(ROAD_LINE_WIDTH_PX, Math.min(40, road.width * worldToPixel));
      ctx.lineWidth = fillW;
      ctx.beginPath();
      for (let i = 0; i < road.path.length; i++) {
        const p = worldToScreen(road.path[i].x, road.path[i].z);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  // Draw buildings (rotated rectangles)
  if (buildings.length > 0) {
    const viewRadius = camera.extent * 2;
    ctx.fillStyle = BUILDING_FILL_COLOR;
    ctx.strokeStyle = BUILDING_STROKE_COLOR;
    ctx.lineWidth = 0.5;

    for (const b of buildings) {
      if (Math.abs(b.x - camera.x) > viewRadius || Math.abs(b.z - camera.z) > viewRadius) continue;
      const hw = b.width / 2;
      const hd = b.depth / 2;
      const cos = Math.cos(b.rotation);
      const sin = Math.sin(b.rotation);
      const corners = [
        worldToScreen(b.x + cos * hw - sin * hd, b.z + sin * hw + cos * hd),
        worldToScreen(b.x - cos * hw - sin * hd, b.z - sin * hw + cos * hd),
        worldToScreen(b.x - cos * hw + sin * hd, b.z - sin * hw - cos * hd),
        worldToScreen(b.x + cos * hw + sin * hd, b.z + sin * hw - cos * hd),
      ];
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  frameCount++;

  // Render entities
  for (const entity of entities) {
    const pos = worldToScreen(entity.x, entity.z);

    // Skip if off-screen
    if (pos.x < -10 || pos.x > width + 10 || pos.y < -10 || pos.y > height + 10) {
      continue;
    }

    const baseSize = entity.size || 4;
    const pulseScale = entity.isActive ? (Math.sin(frameCount * 0.1) * 0.15 + 1) : 1;
    const size = baseSize * pulseScale;

    // Determine color (party group override for players)
    let pipColor = entity.color;
    if (entity.type === 'player' && entity.groupIndex !== undefined && entity.groupIndex >= 0) {
      pipColor = GROUP_COLORS[entity.groupIndex % GROUP_COLORS.length];
    }

    // Try POI icon first
    if (entity.subType && drawIcon(ctx, pos.x, pos.y, entity.subType)) {
      continue;
    }

    ctx.fillStyle = pipColor;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    if (entity.isLocalPlayer) {
      // White square for local player
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pos.x - 2.5, pos.y - 2.5, 5, 5);
    } else if (entity.icon === 'star' || entity.type === 'quest') {
      // Star shape
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? size : size * 0.5;
        const sx = pos.x + Math.cos(angle) * r;
        const sy = pos.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (entity.icon === 'diamond') {
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - size);
      ctx.lineTo(pos.x + size * 0.7, pos.y);
      ctx.lineTo(pos.x, pos.y + size);
      ctx.lineTo(pos.x - size * 0.7, pos.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (entity.type === 'player') {
      // Circle with white border for players
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    } else {
      // Circle for everything else
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Draw destination marker (red flag)
  if (destination) {
    const dp = worldToScreen(destination.x, destination.z);
    if (dp.x > -20 && dp.x < width + 20 && dp.y > -20 && dp.y < height + 20) {
      // Pole
      ctx.strokeStyle = '#880000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dp.x, dp.y + 3);
      ctx.lineTo(dp.x, dp.y - 5);
      ctx.stroke();
      // Flag triangle
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.moveTo(dp.x, dp.y - 5);
      ctx.lineTo(dp.x + 5, dp.y - 3);
      ctx.lineTo(dp.x, dp.y - 1);
      ctx.closePath();
      ctx.fill();
    }
  }

  const frameTime = performance.now() - startTime;
  return { frameTime };
}

/**
 * Draw a POI icon from flyweight cache.
 * Returns true if icon was drawn, false if subType unknown.
 */
function drawIcon(ctx, cx, cy, subType) {
  if (!iconCache.has(subType)) {
    // Create icon on first use
    try {
      const ic = new OffscreenCanvas(16, 16);
      const ictx = ic.getContext('2d');
      if (ictx) {
        renderIconGlyph(ictx, subType);
        iconCache.set(subType, ic);
      } else {
        iconCache.set(subType, null);
      }
    } catch (e) {
      iconCache.set(subType, null);
    }
  }
  const cached = iconCache.get(subType);
  if (!cached) return false;
  ctx.drawImage(cached, cx - 8, cy - 8, 16, 16);
  return true;
}

/**
 * Render a glyph onto a 16x16 icon canvas.
 */
function renderIconGlyph(ctx, subType) {
  const w = 16, h = 16, cx = 8, cy = 8, r = 6;
  ctx.clearRect(0, 0, w, h);

  const glyphs = {
    bank:                { bg: '#ffd700', fg: '#000000', label: '$' },
    shop:                { bg: '#d4a574', fg: '#000000', label: 'S' },
    altar:               { bg: '#ffffff', fg: '#000000', label: '+' },
    runecrafting_altar:  { bg: '#9b59b6', fg: '#ffffff', label: 'R' },
    anvil:               { bg: '#555555', fg: '#ffffff', label: 'A' },
    furnace:             { bg: '#ff6600', fg: '#ffffff', label: 'F' },
    range:               { bg: '#8b4513', fg: '#ffffff', label: '~' },
    fishing:             { bg: '#00bcd4', fg: '#ffffff', label: 'f' },
    mining:              { bg: '#8b6914', fg: '#ffffff', label: 'P' },
    tree:                { bg: '#22c55e', fg: '#000000', label: 'T' },
    quest_available:     { bg: '#2196f3', fg: '#ffffff', label: '!' },
    quest:               { bg: '#2196f3', fg: '#ffffff', label: '!' },
    quest_in_progress:   { bg: '#2196f3', fg: '#ffffff', label: '?' },
  };

  const glyph = glyphs[subType];
  if (!glyph) return;

  // Circle background
  ctx.fillStyle = glyph.bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.fillStyle = glyph.fg;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph.label, cx, cy + 1);
}

// Message handler
self.onmessage = function(e) {
  const msg = e.data;
  
  switch (msg.type) {
    case 'init': {
      const result = init(msg.canvas, msg.width, msg.height, msg.config);
      self.postMessage({ type: 'initialized', ...result });
      break;
    }
    
    case 'resize': {
      resize(msg.width, msg.height);
      break;
    }
    
    case 'setConfig': {
      Object.assign(config, msg.config);
      break;
    }
    
    case 'addTiles': {
      addTiles(msg.tiles);
      break;
    }
    
    case 'removeTiles': {
      removeTiles(msg.tileKeys);
      break;
    }
    
    case 'updateCamera': {
      updateCamera(msg.camera);
      break;
    }
    
    case 'updateEntities': {
      updateEntities(msg.entities);
      break;
    }

    case 'updateRoads': {
      roads = msg.roads || [];
      break;
    }

    case 'updateBuildings': {
      buildings = msg.buildings || [];
      break;
    }

    case 'updateDestination': {
      destination = { x: msg.x, z: msg.z };
      break;
    }

    case 'clearDestination': {
      destination = null;
      break;
    }

    case 'render': {
      const result = render();
      
      if (useDirectCanvas) {
        self.postMessage({ type: 'rendered', frameTime: result.frameTime });
      } else {
        // Transfer ImageBitmap to main thread
        createImageBitmap(canvas).then(bitmap => {
          self.postMessage({ type: 'frame', bitmap }, [bitmap]);
        });
      }
      break;
    }
    
    case 'dispose': {
      tiles.clear();
      entities = [];
      roads = [];
      buildings = [];
      destination = null;
      iconCache.clear();
      canvas = null;
      ctx = null;
      break;
    }
  }
};
`;

// ============================================================================
// MAIN THREAD API
// ============================================================================

/**
 * Manager for minimap rendering worker
 */
export class MinimapWorkerManager {
  private worker: Worker | null = null;
  private ready = false;
  private width: number;
  private height: number;
  private onFrame: ((frameTime: number) => void) | null = null;
  private onBitmap: ((bitmap: ImageBitmap) => void) | null = null;
  private usesDirectCanvas: boolean;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.usesDirectCanvas = false;
  }

  /**
   * Initialize with transferred OffscreenCanvas (direct rendering)
   */
  async initWithCanvas(
    offscreenCanvas: OffscreenCanvas,
    config?: Partial<MinimapConfig>,
  ): Promise<boolean> {
    this.usesDirectCanvas = true;
    return this.initInternal(offscreenCanvas, config);
  }

  /**
   * Initialize without canvas (returns ImageBitmaps)
   */
  async init(config?: Partial<MinimapConfig>): Promise<boolean> {
    this.usesDirectCanvas = false;
    return this.initInternal(undefined, config);
  }

  private async initInternal(
    offscreenCanvas?: OffscreenCanvas,
    config?: Partial<MinimapConfig>,
  ): Promise<boolean> {
    if (typeof Worker === "undefined" || typeof Blob === "undefined") {
      console.warn("[MinimapWorker] Workers not available");
      return false;
    }

    return new Promise((resolve) => {
      try {
        const blob = new Blob([MINIMAP_WORKER_CODE], {
          type: "application/javascript",
        });
        const url = URL.createObjectURL(blob);
        this.worker = new Worker(url);
        URL.revokeObjectURL(url);

        this.worker.onmessage = (e: MessageEvent<MinimapWorkerOutput>) => {
          const msg = e.data;

          switch (msg.type) {
            case "initialized":
              this.ready = msg.success;
              if (!msg.success) {
                console.error("[MinimapWorker] Init failed:", msg.error);
              }
              resolve(msg.success);
              break;

            case "rendered":
              this.onFrame?.(msg.frameTime);
              break;

            case "frame":
              this.onBitmap?.(msg.bitmap);
              break;

            case "error":
              console.error("[MinimapWorker] Error:", msg.message);
              break;
          }
        };

        this.worker.onerror = (e) => {
          console.error("[MinimapWorker] Worker error:", e.message);
          resolve(false);
        };

        // Send init message
        const initMsg: MinimapWorkerInput & { canvas?: OffscreenCanvas } = {
          type: "init",
          width: this.width,
          height: this.height,
          config,
        };

        if (offscreenCanvas) {
          initMsg.canvas = offscreenCanvas;
          this.worker.postMessage(initMsg, [offscreenCanvas]);
        } else {
          this.worker.postMessage(initMsg);
        }
      } catch (error) {
        console.error("[MinimapWorker] Failed to create worker:", error);
        resolve(false);
      }
    });
  }

  /** Check if worker is ready */
  isReady(): boolean {
    return this.ready && this.worker !== null;
  }

  /** Set callback for frame completion (direct canvas mode) */
  setOnFrame(callback: ((frameTime: number) => void) | null): void {
    this.onFrame = callback;
  }

  /** Set callback for bitmap frames (ImageBitmap mode) */
  setOnBitmap(callback: ((bitmap: ImageBitmap) => void) | null): void {
    this.onBitmap = callback;
  }

  /** Resize the minimap */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.worker && this.ready) {
      this.worker.postMessage({ type: "resize", width, height });
    }
  }

  /** Update configuration */
  setConfig(config: Partial<MinimapConfig>): void {
    if (this.worker && this.ready) {
      this.worker.postMessage({ type: "setConfig", config });
    }
  }

  /** Add terrain tiles (transfers Float32Arrays) */
  addTiles(tiles: MinimapTile[]): void {
    if (!this.worker || !this.ready) return;

    // Collect transferable buffers (cast ArrayBufferLike to ArrayBuffer)
    const transfers: Transferable[] = [];
    for (const tile of tiles) {
      transfers.push(tile.colors.buffer as ArrayBuffer);
      transfers.push(tile.heights.buffer as ArrayBuffer);
    }

    this.worker.postMessage({ type: "addTiles", tiles }, transfers);
  }

  /** Remove terrain tiles */
  removeTiles(tileKeys: string[]): void {
    if (!this.worker || !this.ready) return;
    this.worker.postMessage({ type: "removeTiles", tileKeys });
  }

  /** Update camera state */
  updateCamera(camera: MinimapCamera): void {
    if (!this.worker || !this.ready) return;
    this.worker.postMessage({ type: "updateCamera", camera });
  }

  /** Update entity list */
  updateEntities(entities: MinimapEntity[]): void {
    if (!this.worker || !this.ready) return;
    this.worker.postMessage({ type: "updateEntities", entities });
  }

  /** Update road polylines */
  updateRoads(roads: MinimapRoad[]): void {
    if (!this.worker || !this.ready) return;
    this.worker.postMessage({ type: "updateRoads", roads });
  }

  /** Update building rectangles */
  updateBuildings(buildings: MinimapBuilding[]): void {
    if (!this.worker || !this.ready) return;
    this.worker.postMessage({ type: "updateBuildings", buildings });
  }

  /** Set destination marker position */
  updateDestination(x: number, z: number): void {
    if (!this.worker || !this.ready) return;
    this.worker.postMessage({ type: "updateDestination", x, z });
  }

  /** Clear destination marker */
  clearDestination(): void {
    if (!this.worker || !this.ready) return;
    this.worker.postMessage({ type: "clearDestination" });
  }

  /** Request a render */
  render(): void {
    if (!this.worker || !this.ready) return;
    this.worker.postMessage({ type: "render" });
  }

  /** Dispose of worker */
  dispose(): void {
    if (this.worker) {
      this.worker.postMessage({ type: "dispose" });
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.onFrame = null;
    this.onBitmap = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check if minimap worker is supported
 */
export function isMinimapWorkerSupported(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof Blob !== "undefined"
  );
}

/**
 * Create minimap worker with transferred canvas
 */
export async function createMinimapWorkerWithCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  config?: Partial<MinimapConfig>,
): Promise<MinimapWorkerManager | null> {
  if (!isMinimapWorkerSupported()) {
    return null;
  }

  if (!("transferControlToOffscreen" in canvas)) {
    console.warn(
      "[MinimapWorker] Canvas does not support transferControlToOffscreen",
    );
    return null;
  }

  const offscreen = (
    canvas as HTMLCanvasElement & {
      transferControlToOffscreen: () => OffscreenCanvas;
    }
  ).transferControlToOffscreen();

  const manager = new MinimapWorkerManager(width, height);
  const success = await manager.initWithCanvas(offscreen, config);

  if (!success) {
    manager.dispose();
    return null;
  }

  return manager;
}

/**
 * Create minimap worker that returns ImageBitmaps
 */
export async function createMinimapWorker(
  width: number,
  height: number,
  config?: Partial<MinimapConfig>,
): Promise<MinimapWorkerManager | null> {
  if (typeof Worker === "undefined" || typeof Blob === "undefined") {
    return null;
  }

  const manager = new MinimapWorkerManager(width, height);
  const success = await manager.init(config);

  if (!success) {
    manager.dispose();
    return null;
  }

  return manager;
}
