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
 * - Camera rotation support (modern MMORPG-style)
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
  type: "player" | "enemy" | "item" | "building" | "resource" | "npc";
  color: string;
  size?: number;
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

// Camera state
let camera = { x: 0, z: 0, extent: 50, rotation: 0 };

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
  
  // Clear with background
  ctx.fillStyle = hexToRgb(config.backgroundColor);
  ctx.fillRect(0, 0, width, height);
  
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
  
  // Render entities (after rotation restore so they're always upright)
  for (const entity of entities) {
    const pos = worldToScreen(entity.x, entity.z);
    
    // Skip if off-screen
    if (pos.x < -10 || pos.x > width + 10 || pos.y < -10 || pos.y > height + 10) {
      continue;
    }
    
    const size = entity.size || 4;
    
    ctx.fillStyle = entity.color;
    ctx.beginPath();
    
    if (entity.type === 'building') {
      // Square for buildings
      ctx.fillRect(pos.x - size, pos.y - size, size * 2, size * 2);
    } else if (entity.type === 'player') {
      // Larger circle for players
      ctx.arc(pos.x, pos.y, size + 1, 0, Math.PI * 2);
      ctx.fill();
      // White border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Circle for everything else
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  const frameTime = performance.now() - startTime;
  return { frameTime };
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
