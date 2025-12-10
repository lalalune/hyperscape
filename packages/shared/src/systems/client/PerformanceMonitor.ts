/**
 * PerformanceMonitor.ts - Performance Instrumentation System
 *
 * Provides comprehensive performance monitoring for the game:
 * - FPS tracking (instantaneous, average, min, max)
 * - Frame time breakdown by game loop phase
 * - Individual system timing
 * - Entity counts and statistics
 * - Memory usage (when available)
 *
 * **Configuration**:
 * - Enabled by default in development, disabled in production
 * - Can be toggled at runtime via `setEnabled()`
 * - Emits 'performanceUpdate' events for UI consumers
 *
 * **Performance Impact**:
 * - Minimal when disabled (no-op)
 * - ~0.1ms overhead when enabled
 * - Uses performance.now() for high-precision timing
 *
 * @module
 */

import { System } from "../shared/infrastructure/System";
import type { World, WorldOptions } from "../../types";

/** Timing data for a single frame phase */
export interface PhaseTiming {
  name: string;
  duration: number;
  percentage: number;
}

/** Timing data for a single system */
export interface SystemTiming {
  name: string;
  duration: number;
  percentage: number;
  callCount: number;
}

/** Entity statistics */
export interface EntityStats {
  total: number;
  players: number;
  mobs: number;
  npcs: number;
  items: number;
  resources: number;
  hot: number; // Entities receiving updates each frame
}

/** Memory statistics (when available) */
export interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/** Terrain statistics */
export interface TerrainStats {
  activeTiles: number;
  pendingTiles: number;
  visibleChunks: number;
}

/** Complete performance snapshot */
export interface PerformanceSnapshot {
  timestamp: number;
  fps: {
    current: number;
    average: number;
    min: number;
    max: number;
    frameTime: number;
    /** 1% low FPS (worst 1% of frames) */
    onePercentLow: number;
  };
  phases: PhaseTiming[];
  systems: SystemTiming[];
  entities: EntityStats;
  memory: MemoryStats | null;
  renderStats: {
    drawCalls: number;
    triangles: number;
    textures: number;
    geometries: number;
    programs: number;
  } | null;
  physics: {
    bodies: number;
    shapes: number;
    contacts: number;
  } | null;
  terrain: TerrainStats | null;
}

/** Rolling buffer for FPS history */
const FPS_HISTORY_SIZE = 60;

/** System timing accumulator */
interface SystemAccumulator {
  totalTime: number;
  callCount: number;
}

/**
 * PerformanceMonitor System
 *
 * Tracks performance metrics and provides data for debug UI.
 * Enabled by default in development mode.
 */
export class PerformanceMonitor extends System {
  private _enabled: boolean = false;
  private _sampleRate: number = 1; // Sample every N frames
  private _frameCount: number = 0;

  // FPS tracking
  private _lastFrameTime: number = 0;
  private _frameTimeHistory: number[] = [];
  private _fpsMin: number = Infinity;
  private _fpsMax: number = 0;

  // Phase timing (preTick, fixedUpdate, update, etc.)
  private _phaseTimings: Map<string, number> = new Map();
  private _currentPhase: string | null = null;
  private _phaseStartTime: number = 0;

  // System timing
  private _systemTimings: Map<string, SystemAccumulator> = new Map();
  private _currentSystem: string | null = null;
  private _systemStartTime: number = 0;

  // Total frame time for percentage calculations
  private _frameStartTime: number = 0;
  private _totalFrameTime: number = 0;

  // Cached snapshot for UI consumption
  private _lastSnapshot: PerformanceSnapshot | null = null;
  private _snapshotInterval: number = 100; // ms between snapshots
  private _lastSnapshotTime: number = 0;

  // Event listeners
  private _listeners: Set<(snapshot: PerformanceSnapshot) => void> = new Set();

  constructor(world: World) {
    super(world);
  }

  override async init(_options: WorldOptions): Promise<void> {
    // Enable by default in development
    // Check multiple ways since we run in both Node.js and browser contexts
    const isDev = this._checkIsDev();
    this._enabled = isDev;
  }

  /** Check if running in development mode (works in Node.js, Vite, and other bundlers) */
  private _checkIsDev(): boolean {
    // Vite injects import.meta.env at build time
    if (typeof import.meta !== "undefined" && import.meta.env) {
      return import.meta.env.DEV === true || import.meta.env.MODE === "development";
    }
    // Node.js / fallback
    if (typeof process !== "undefined" && process.env) {
      return process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
    }
    // Default to enabled if we can't determine
    return true;
  }

  /** Enable or disable performance monitoring */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) {
      this._reset();
    }
  }

  /** Check if monitoring is enabled */
  isEnabled(): boolean {
    return this._enabled;
  }

  /** Set sample rate (1 = every frame, 2 = every other frame, etc.) */
  setSampleRate(rate: number): void {
    this._sampleRate = Math.max(1, Math.floor(rate));
  }

  /** Subscribe to performance updates */
  onUpdate(callback: (snapshot: PerformanceSnapshot) => void): () => void {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /** Get the latest performance snapshot */
  getSnapshot(): PerformanceSnapshot | null {
    return this._lastSnapshot;
  }

  /** Called at the start of each frame */
  override preTick(): void {
    if (!this._enabled) return;

    this._frameCount++;
    if (this._frameCount % this._sampleRate !== 0) return;

    const now = performance.now();

    // Calculate frame time and FPS
    if (this._lastFrameTime > 0) {
      const frameTime = now - this._lastFrameTime;
      this._frameTimeHistory.push(frameTime);
      if (this._frameTimeHistory.length > FPS_HISTORY_SIZE) {
        this._frameTimeHistory.shift();
      }

      const fps = 1000 / frameTime;
      if (fps < this._fpsMin && fps > 0) this._fpsMin = fps;
      if (fps > this._fpsMax) this._fpsMax = fps;
    }
    this._lastFrameTime = now;

    // Reset per-frame accumulators
    this._frameStartTime = now;
    this._phaseTimings.clear();
    this._systemTimings.clear();

    this._startPhase("preTick");
  }

  /** Called at the end of each frame */
  override postTick(): void {
    if (!this._enabled) return;
    if (this._frameCount % this._sampleRate !== 0) return;

    this._endPhase();
    this._totalFrameTime = performance.now() - this._frameStartTime;

    // Generate snapshot periodically
    const now = performance.now();
    if (now - this._lastSnapshotTime >= this._snapshotInterval) {
      this._generateSnapshot();
      this._lastSnapshotTime = now;
    }
  }

  // Phase tracking hooks - call these from World.ts
  startPhase(name: string): void {
    if (!this._enabled) return;
    this._startPhase(name);
  }

  endPhase(): void {
    if (!this._enabled) return;
    this._endPhase();
  }

  // System tracking hooks
  startSystem(name: string): void {
    if (!this._enabled) return;
    this._endSystem(); // End previous system if any
    this._currentSystem = name;
    this._systemStartTime = performance.now();
  }

  endSystem(): void {
    if (!this._enabled) return;
    this._endSystem();
  }

  private _startPhase(name: string): void {
    this._endPhase(); // End previous phase if any
    this._currentPhase = name;
    this._phaseStartTime = performance.now();
  }

  private _endPhase(): void {
    if (this._currentPhase) {
      const duration = performance.now() - this._phaseStartTime;
      const existing = this._phaseTimings.get(this._currentPhase) || 0;
      this._phaseTimings.set(this._currentPhase, existing + duration);
      this._currentPhase = null;
    }
  }

  private _endSystem(): void {
    if (this._currentSystem) {
      const duration = performance.now() - this._systemStartTime;
      const existing = this._systemTimings.get(this._currentSystem) || {
        totalTime: 0,
        callCount: 0,
      };
      existing.totalTime += duration;
      existing.callCount++;
      this._systemTimings.set(this._currentSystem, existing);
      this._currentSystem = null;
    }
  }

  private _generateSnapshot(): void {
    const now = performance.now();

    // Calculate FPS stats
    const avgFrameTime =
      this._frameTimeHistory.length > 0
        ? this._frameTimeHistory.reduce((a, b) => a + b, 0) /
          this._frameTimeHistory.length
        : 16.67;
    const currentFrameTime =
      this._frameTimeHistory[this._frameTimeHistory.length - 1] || 16.67;
    const currentFps = 1000 / currentFrameTime;
    const avgFps = 1000 / avgFrameTime;

    // Calculate 1% low FPS (worst 1% of frame times)
    let onePercentLow = 0;
    if (this._frameTimeHistory.length > 0) {
      const sorted = [...this._frameTimeHistory].sort((a, b) => b - a);
      const worstCount = Math.max(1, Math.floor(sorted.length * 0.01));
      const worstAvg = sorted.slice(0, worstCount).reduce((a, b) => a + b, 0) / worstCount;
      onePercentLow = Math.round(1000 / worstAvg);
    }

    // Calculate phase percentages
    const phases: PhaseTiming[] = [];
    for (const [name, duration] of this._phaseTimings) {
      phases.push({
        name,
        duration,
        percentage:
          this._totalFrameTime > 0 ? (duration / this._totalFrameTime) * 100 : 0,
      });
    }

    // Calculate system percentages
    const systems: SystemTiming[] = [];
    for (const [name, acc] of this._systemTimings) {
      systems.push({
        name,
        duration: acc.totalTime,
        percentage:
          this._totalFrameTime > 0
            ? (acc.totalTime / this._totalFrameTime) * 100
            : 0,
        callCount: acc.callCount,
      });
    }
    // Sort by duration descending
    systems.sort((a, b) => b.duration - a.duration);

    // Gather entity stats
    const entities = this._getEntityStats();

    // Gather memory stats
    const memory = this._getMemoryStats();

    // Gather render stats
    const renderStats = this._getRenderStats();

    // Gather physics stats
    const physics = this._getPhysicsStats();

    // Gather terrain stats
    const terrain = this._getTerrainStats();

    this._lastSnapshot = {
      timestamp: now,
      fps: {
        current: Math.round(currentFps),
        average: Math.round(avgFps),
        min: this._fpsMin === Infinity ? 0 : Math.round(this._fpsMin),
        max: Math.round(this._fpsMax),
        frameTime: currentFrameTime,
        onePercentLow,
      },
      phases,
      systems,
      entities,
      memory,
      renderStats,
      physics,
      terrain,
    };

    // Notify listeners
    for (const listener of this._listeners) {
      listener(this._lastSnapshot);
    }
  }

  private _getEntityStats(): EntityStats {
    const entities = this.world.entities;
    if (!entities) {
      return {
        total: 0,
        players: 0,
        mobs: 0,
        npcs: 0,
        items: 0,
        resources: 0,
        hot: 0,
      };
    }

    let total = 0;
    let players = 0;
    let mobs = 0;
    let npcs = 0;
    let items = 0;
    let resources = 0;

    for (const entity of entities.items.values()) {
      total++;
      const type = (entity as { type?: string }).type;
      switch (type) {
        case "player":
        case "playerLocal":
        case "playerRemote":
          players++;
          break;
        case "mob":
          mobs++;
          break;
        case "npc":
          npcs++;
          break;
        case "item":
          items++;
          break;
        case "resource":
          resources++;
          break;
      }
    }

    // Hot entities count
    const hot = this.world.hot?.size || 0;

    return { total, players, mobs, npcs, items, resources, hot };
  }

  private _getMemoryStats(): MemoryStats | null {
    // Memory API is only available in some browsers
    const perf = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };
    if (perf.memory) {
      return {
        usedJSHeapSize: perf.memory.usedJSHeapSize,
        totalJSHeapSize: perf.memory.totalJSHeapSize,
        jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
      };
    }
    return null;
  }

  private _getRenderStats(): PerformanceSnapshot["renderStats"] {
    const graphics = this.world.graphics;
    if (!graphics?.renderer) return null;

    const renderer = graphics.renderer;
    const info = (renderer as { info?: { render?: { calls: number; triangles: number }; memory?: { textures: number; geometries: number }; programs?: unknown[] } }).info;
    if (!info) return null;

    return {
      drawCalls: info.render?.calls || 0,
      triangles: info.render?.triangles || 0,
      textures: info.memory?.textures || 0,
      geometries: info.memory?.geometries || 0,
      programs: Array.isArray(info.programs) ? info.programs.length : 0,
    };
  }

  private _getPhysicsStats(): PerformanceSnapshot["physics"] {
    const physics = this.world.physics as {
      scene?: {
        getNbActors?: (type: number) => number;
        getNbShapes?: () => number;
        getSimulationStatistics?: () => { nbActiveConstraints?: number };
      };
      controllers?: Map<string, unknown>;
    } | null;
    
    if (!physics) return null;

    // Try to get PhysX scene statistics
    let bodies = 0;
    let shapes = 0;
    let contacts = 0;

    // Count active character controllers as bodies
    if (physics.controllers) {
      bodies = physics.controllers.size;
    }

    // Try to get scene stats if available
    if (physics.scene) {
      // PxActorTypeFlag::eRIGID_DYNAMIC = 1
      if (physics.scene.getNbActors) {
        bodies += physics.scene.getNbActors(1) || 0;
      }
      if (physics.scene.getNbShapes) {
        shapes = physics.scene.getNbShapes() || 0;
      }
      if (physics.scene.getSimulationStatistics) {
        const simStats = physics.scene.getSimulationStatistics();
        contacts = simStats?.nbActiveConstraints || 0;
      }
    }

    return bodies > 0 || shapes > 0 ? { bodies, shapes, contacts } : null;
  }

  private _getTerrainStats(): PerformanceSnapshot["terrain"] {
    const terrain = this.world.getSystem?.("terrain") as {
      terrainTiles?: Map<string, unknown>;
      pendingTileKeys?: unknown[];
      activeChunks?: Set<string>;
      getStats?: () => { activeTiles: number; pendingTiles: number; visibleChunks: number };
    } | undefined;

    if (!terrain) return null;

    // Try getStats method first
    if (terrain.getStats) {
      return terrain.getStats();
    }

    // Fall back to inspecting properties
    const activeTiles = terrain.terrainTiles?.size || 0;
    const pendingTiles = terrain.pendingTileKeys?.length || 0;
    const visibleChunks = terrain.activeChunks?.size || 0;

    return activeTiles > 0 || pendingTiles > 0 ? { activeTiles, pendingTiles, visibleChunks } : null;
  }

  private _reset(): void {
    this._frameTimeHistory = [];
    this._fpsMin = Infinity;
    this._fpsMax = 0;
    this._phaseTimings.clear();
    this._systemTimings.clear();
    this._lastSnapshot = null;
  }

  override destroy(): void {
    this._listeners.clear();
    this._reset();
    super.destroy();
  }
}
