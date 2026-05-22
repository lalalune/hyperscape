/**
 * ViewportRenderLoop — Framework-agnostic WebGPU render loop extracted from TileBasedTerrain.
 *
 * Owns the WebGPURenderer lifecycle, RAF animation loop, post-processing pipeline
 * (FXAA + optional bloom via TSL RenderPipeline), GPU device-loss recovery, tone
 * mapping, time-of-day exposure updates, LOD throttling, and frame timing.
 *
 * This is a plain class (no React hooks) suitable for use in any Three.js context.
 * TileBasedTerrain can be refactored to delegate rendering to this class.
 *
 * PERFORMANCE: Frame delta is capped at 100 ms to prevent physics/animation explosions
 * after tab-switch or debugger pause. LOD updates are throttled to every 10 frames or
 * when the camera moves more than 5 world units.
 */

import { pass } from "three/tsl";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

import {
  THREE,
  createWebGPURenderer,
  type HyperForgeRenderer,
} from "@/utils/webgpu-renderer";
import { EXPOSURE } from "@hyperforge/shared";

// ============== Types ==============

export interface ViewportRenderLoopConfig {
  /** Canvas element to render into. When omitted the renderer creates its own. */
  canvas?: HTMLCanvasElement;
  /** The Three.js scene to render. */
  scene: THREE.Scene;
  /** The camera used for rendering (must be a PerspectiveCamera for resize). */
  camera: THREE.Camera;
  /** Enable MSAA antialiasing on the renderer. Default: true */
  antialias?: boolean;
  /** Cap the device-pixel-ratio (useful for editors). Default: 2 */
  maxPixelRatio?: number;
  /** Enable shadow maps. Default: true */
  enableShadows?: boolean;
  /** Enable bloom post-processing. Default: false */
  enableBloom?: boolean;
  /**
   * Container element — used for resize observation and DOM insertion
   * of the renderer canvas. When provided, the renderer's canvas is
   * appended to this element and a ResizeObserver tracks size changes.
   */
  container?: HTMLElement;
  /** Maximum GPU recovery attempts before giving up. Default: 3 */
  maxRecoveryAttempts?: number;
}

/**
 * Minimal interface for the Three.js RenderPipeline (r183+).
 * @types/three 0.182 still exports it as PostProcessing so we
 * use bracket access on the THREE namespace at runtime.
 */
type RenderPipelineInstance = {
  outputNode: unknown;
  render(): void;
  dispose(): void;
};

/** Callback signature for per-frame subscribers. */
export type FrameCallback = (deltaTime: number, elapsedTime: number) => void;

/** Callback signature for GPU recovery events. */
export type GpuRecoveryCallback = (event: {
  attempt: number;
  maxAttempts: number;
  phase: "started" | "succeeded" | "failed";
  error?: unknown;
}) => void;

/** Callback signature for perf stats (fires every ~2 seconds / 120 frames). */
export type PerfStatsCallback = (stats: {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}) => void;

// ============== Constants ==============

/** Frames between perf-stat logging. ~2 seconds at 60 fps. */
const PERF_LOG_INTERVAL = 120;

/** Frames between LOD updates (when camera is stationary). */
const LOD_FRAME_INTERVAL = 10;

/** Camera movement threshold (squared) to force an LOD update. */
const LOD_CAMERA_MOVE_THRESHOLD_SQ = 25; // 5 units squared

/** Maximum frame delta (seconds) — prevents explosion after tab switch. */
const MAX_DELTA = 0.1;

// ============== Class ==============

export class ViewportRenderLoop {
  // ---- Public state ----
  readonly renderer: HyperForgeRenderer;

  // ---- Private rendering refs ----
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;
  private _container: HTMLElement | null;
  private _postProcessing: RenderPipelineInstance | null = null;

  // ---- Configuration ----
  private _antialias: boolean;
  private _maxPixelRatio: number;
  private _enableShadows: boolean;
  private _enableBloom: boolean;
  private _maxRecoveryAttempts: number;

  // ---- Animation loop ----
  private _rafId = 0;
  private _running = false;
  private _lastTime = 0;

  // ---- Frame callbacks ----
  private _frameCallbacks: FrameCallback[] = [];
  private _postRenderCallbacks: FrameCallback[] = [];

  // ---- GPU recovery ----
  private _gpuRecoveryCount = 0;
  private _gpuRecovering = false;
  private _gpuRecoveryCallback: GpuRecoveryCallback | null = null;

  // ---- Tone mapping / exposure ----
  private _currentExposure: number = EXPOSURE.DAY;
  private _targetExposure: number = EXPOSURE.DAY;

  // ---- LOD throttling ----
  private _lodFrameCounter = 0;
  private _lastLodCameraX = 0;
  private _lastLodCameraZ = 0;
  private _lodObjects: THREE.LOD[] = [];

  // ---- Perf monitoring ----
  private _perfFrameCounter = 0;
  private _perfCallback: PerfStatsCallback | null = null;

  // ---- Resize handling ----
  private _resizeObserver: ResizeObserver | null = null;
  private _resizeHandler: (() => void) | null = null;

  // ---- Disposed flag ----
  private _disposed = false;

  // ====================================================================
  // Construction — NOTE: use the static async `create()` factory instead
  // of `new` because WebGPU renderer requires async initialization.
  // The public constructor is intentionally private-ish via the type
  // system; callers should use `ViewportRenderLoop.create(config)`.
  // ====================================================================

  /**
   * @internal — prefer `ViewportRenderLoop.create()`.
   * The renderer must already be initialized (via `createWebGPURenderer`).
   */
  constructor(renderer: HyperForgeRenderer, config: ViewportRenderLoopConfig) {
    this.renderer = renderer;
    this._scene = config.scene;
    this._camera = config.camera;
    this._container = config.container ?? null;
    this._antialias = config.antialias ?? true;
    this._maxPixelRatio = config.maxPixelRatio ?? 2;
    this._enableShadows = config.enableShadows ?? true;
    this._enableBloom = config.enableBloom ?? false;
    this._maxRecoveryAttempts = config.maxRecoveryAttempts ?? 3;
  }

  // ====================================================================
  // Static async factory
  // ====================================================================

  /**
   * Create and fully initialize a ViewportRenderLoop.
   *
   * This is the primary entry point. It:
   * 1. Creates a WebGPU renderer (async GPU init)
   * 2. Configures tone mapping, shadows, pixel ratio
   * 3. Builds the FXAA (+optional bloom) post-processing pipeline
   * 4. Pre-compiles materials
   * 5. Wires GPU device-loss recovery
   * 6. Attaches the canvas to the container (if provided)
   * 7. Sets up resize observation
   */
  static async create(
    config: ViewportRenderLoopConfig,
  ): Promise<ViewportRenderLoop> {
    const renderer = await createWebGPURenderer({
      canvas: config.canvas,
      antialias: config.antialias ?? true,
      alpha: true,
    });

    const instance = new ViewportRenderLoop(renderer, config);
    instance._configureRenderer();
    instance._buildPostProcessing();
    await instance._precompileMaterials();
    instance._wireDeviceLossHandler(renderer);
    instance._attachToContainer();
    instance._setupResizeObserver();

    return instance;
  }

  // ====================================================================
  // Public API
  // ====================================================================

  /** Start the RAF animation loop. No-op if already running or disposed. */
  start(): void {
    if (this._running || this._disposed) return;
    this._running = true;
    this._lastTime = performance.now();
    this._scheduleFrame();
  }

  /** Stop the RAF animation loop. Safe to call multiple times. */
  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  /** Whether the animation loop is currently running. */
  isRunning(): boolean {
    return this._running;
  }

  /**
   * Set the target tone-mapping exposure based on time-of-day.
   * The renderer lerps toward this value each frame using `EXPOSURE.LERP_SPEED`.
   *
   * @param targetExposure — the target exposure value (e.g. from `computeTargetExposure`)
   */
  setTargetExposure(targetExposure: number): void {
    this._targetExposure = targetExposure;
  }

  /**
   * Convenience: set exposure directly (no lerp). Useful for snapping
   * to a value at startup.
   */
  setExposureImmediate(exposure: number): void {
    this._currentExposure = exposure;
    this._targetExposure = exposure;
    this.renderer.toneMappingExposure = exposure;
  }

  /**
   * Register a callback invoked every frame BEFORE rendering.
   * @param callback receives (deltaTime, elapsedTimeSeconds).
   */
  onFrame(callback: FrameCallback): void {
    this._frameCallbacks.push(callback);
  }

  /**
   * Remove a previously registered frame callback.
   */
  removeFrameCallback(callback: FrameCallback): void {
    const idx = this._frameCallbacks.indexOf(callback);
    if (idx !== -1) this._frameCallbacks.splice(idx, 1);
  }

  /**
   * Register a callback invoked every frame AFTER rendering.
   * Use this for GPU resource disposal, deferred cleanup, or
   * auxiliary render passes (e.g. ViewHelper).
   * @param callback receives (deltaTime, elapsedTimeSeconds).
   */
  onPostRender(callback: FrameCallback): void {
    this._postRenderCallbacks.push(callback);
  }

  /**
   * Remove a previously registered post-render callback.
   */
  removePostRenderCallback(callback: FrameCallback): void {
    const idx = this._postRenderCallbacks.indexOf(callback);
    if (idx !== -1) this._postRenderCallbacks.splice(idx, 1);
  }

  /**
   * Register a callback for GPU device-loss recovery events.
   */
  onGpuRecovery(callback: GpuRecoveryCallback): void {
    this._gpuRecoveryCallback = callback;
  }

  /**
   * Register a callback for periodic perf stats (every ~120 frames).
   */
  onPerfStats(callback: PerfStatsCallback): void {
    this._perfCallback = callback;
  }

  /**
   * Supply LOD objects that should be updated each frame (throttled).
   * The render loop calls `lod.update(camera)` every 10 frames or
   * when the camera moves more than 5 world units.
   */
  setLodObjects(lods: THREE.LOD[]): void {
    this._lodObjects = lods;
  }

  /**
   * Toggle bloom post-processing on or off. Rebuilds the render pipeline.
   */
  setBloomEnabled(enabled: boolean): void {
    if (enabled === this._enableBloom) return;
    this._enableBloom = enabled;
    this._rebuildPostProcessing();
  }

  /** Whether bloom is currently enabled. */
  get bloomEnabled(): boolean {
    return this._enableBloom;
  }

  /**
   * Toggle shadow maps on or off.
   */
  setShadowsEnabled(enabled: boolean): void {
    if (enabled === this._enableShadows) return;
    this._enableShadows = enabled;
    this.renderer.shadowMap.enabled = enabled;
  }

  /** Whether shadows are currently enabled. */
  get shadowsEnabled(): boolean {
    return this._enableShadows;
  }

  /** Whether GPU recovery is currently in progress. */
  get gpuRecovering(): boolean {
    return this._gpuRecovering;
  }

  /** Number of GPU recovery attempts so far. */
  get gpuRecoveryCount(): number {
    return this._gpuRecoveryCount;
  }

  /** Update the scene reference (e.g. after a scene rebuild). */
  set scene(s: THREE.Scene) {
    this._scene = s;
    // Rebuild post-processing since it holds a reference to the old scene
    this._rebuildPostProcessing();
  }

  get scene(): THREE.Scene {
    return this._scene;
  }

  /** Update the camera reference. */
  set camera(c: THREE.Camera) {
    this._camera = c;
    this._rebuildPostProcessing();
  }

  get camera(): THREE.Camera {
    return this._camera;
  }

  /**
   * Manually trigger a single render (outside the RAF loop).
   * Useful for screenshot capture or one-shot renders.
   */
  renderOnce(): void {
    if (this._disposed || this._gpuRecovering) return;
    this._render();
  }

  /**
   * Resize the renderer to match the container or explicit dimensions.
   */
  resize(width?: number, height?: number): void {
    if (this._disposed) return;
    const w = width ?? this._container?.clientWidth ?? 1;
    const h = height ?? this._container?.clientHeight ?? 1;
    if (w <= 0 || h <= 0) return;

    if (this._camera instanceof THREE.PerspectiveCamera) {
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
    }
    this.renderer.setSize(w, h);
  }

  /**
   * Full cleanup — stops the loop, disposes the renderer, disconnects
   * the resize observer, and removes the canvas from the DOM.
   * After calling dispose(), the instance is inert. Do not reuse.
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    this.stop();

    // Tear down resize observation
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener("resize", this._resizeHandler);
      this._resizeHandler = null;
    }

    // Dispose post-processing pipeline
    if (this._postProcessing) {
      try {
        this._postProcessing.dispose();
      } catch {
        /* already disposed */
      }
      this._postProcessing = null;
    }

    // Remove canvas from DOM and dispose renderer
    const domElement = this.renderer.domElement;
    if (this._container && domElement.parentNode === this._container) {
      this._container.removeChild(domElement);
    }
    try {
      this.renderer.dispose();
    } catch {
      /* already lost or disposed */
    }

    // Clear callbacks
    this._frameCallbacks.length = 0;
    this._postRenderCallbacks.length = 0;
    this._gpuRecoveryCallback = null;
    this._perfCallback = null;
    this._lodObjects.length = 0;
    this._container = null;
  }

  // ====================================================================
  // Private — Renderer configuration
  // ====================================================================

  /** Configure the renderer after creation (tone mapping, shadows, pixel ratio). */
  private _configureRenderer(): void {
    const renderer = this.renderer;
    const maxPr = Math.min(window.devicePixelRatio, this._maxPixelRatio);
    renderer.setPixelRatio(maxPr);

    // Guard against zero-size container (can happen during mount before layout)
    const w = this._container?.clientWidth || 1;
    const h = this._container?.clientHeight || 1;
    renderer.setSize(w, h);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = EXPOSURE.DAY;
    this._currentExposure = EXPOSURE.DAY;
    this._targetExposure = EXPOSURE.DAY;

    renderer.shadowMap.enabled = this._enableShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // ====================================================================
  // Private — Post-processing (RenderPipeline with FXAA + optional bloom)
  // ====================================================================

  /**
   * Build the TSL-based post-processing pipeline.
   * Uses THREE.RenderPipeline (r183+) with bracket access to avoid
   * TS errors until @types/three catches up.
   */
  private _buildPostProcessing(): void {
    try {
      const PipelineCtor = (THREE as Record<string, unknown>)[
        "RenderPipeline"
      ] as new (r: unknown) => RenderPipelineInstance;

      const renderPipeline = new PipelineCtor(this.renderer);
      const scenePass = pass(this._scene, this._camera);
      const sceneColor = scenePass.getTextureNode("output");

      if (this._enableBloom) {
        const bloomPass = bloom(sceneColor, 0.5, 0.1);
        renderPipeline.outputNode = fxaa(sceneColor.add(bloomPass));
      } else {
        renderPipeline.outputNode = fxaa(sceneColor);
      }

      this._postProcessing = renderPipeline;
    } catch (err) {
      console.warn(
        "[ViewportRenderLoop] RenderPipeline init failed, falling back to direct render:",
        err,
      );
      this._postProcessing = null;
    }
  }

  /** Dispose and rebuild the post-processing pipeline. */
  private _rebuildPostProcessing(): void {
    if (this._postProcessing) {
      try {
        this._postProcessing.dispose();
      } catch {
        /* already disposed */
      }
      this._postProcessing = null;
    }
    if (!this._disposed) {
      this._buildPostProcessing();
    }
  }

  // ====================================================================
  // Private — Material pre-compilation
  // ====================================================================

  /**
   * Force shader compilation before first render to eliminate ~200-500 ms
   * first-frame stutter. Even though the scene may still be mostly empty,
   * this pre-compiles terrain/water/post-processing pipelines.
   */
  private async _precompileMaterials(): Promise<void> {
    try {
      await this.renderer.compileAsync(this._scene, this._camera);
    } catch {
      // Non-fatal — shaders will compile on first use instead
    }
  }

  // ====================================================================
  // Private — GPU device-loss recovery
  // ====================================================================

  /**
   * Wire the WebGPU device.lost handler on a renderer.
   * The "destroyed" reason is expected during cleanup and is ignored.
   */
  private _wireDeviceLossHandler(renderer: HyperForgeRenderer): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend = (renderer as any).backend;
    if (!backend?.device?.lost) return;
    backend.device.lost.then((info: { reason: string; message: string }) => {
      if (info.reason === "destroyed") {
        console.debug(
          "[ViewportRenderLoop] Device disposed (expected during config change)",
        );
        return;
      }
      this._recoverGpu(info.reason);
    });
  }

  /**
   * Attempt to recover from a GPU device loss by creating a fresh renderer.
   *
   * Uses a re-entrance guard (`_gpuRecovering`) so simultaneous device.lost
   * and render-crash triggers don't race. Caps attempts at `_maxRecoveryAttempts`.
   *
   * Recovery sequence:
   * 1. Save camera state
   * 2. Null out post-processing (prevent stale renders)
   * 3. Dispose old renderer and remove its canvas
   * 4. Create a fresh WebGPU renderer
   * 5. Reconfigure renderer settings
   * 6. Rebuild post-processing pipeline
   * 7. Restore camera state
   * 8. Wire device-loss handler on new renderer
   * 9. Resume rendering
   */
  private async _recoverGpu(reason: string): Promise<void> {
    if (this._gpuRecovering || this._disposed) return;
    this._gpuRecovering = true;

    console.error(
      `[ViewportRenderLoop] GPU DEVICE LOST reason="${reason}" ` +
        `scene=${this._scene.children.length}`,
    );

    this._gpuRecoveryCount++;
    const attempt = this._gpuRecoveryCount;
    const maxAttempts = this._maxRecoveryAttempts;

    this._gpuRecoveryCallback?.({
      attempt,
      maxAttempts,
      phase: "started",
    });

    if (attempt > maxAttempts) {
      console.error(
        `[ViewportRenderLoop] GPU recovery failed after ${maxAttempts} attempts.`,
      );
      this._gpuRecoveryCallback?.({
        attempt,
        maxAttempts,
        phase: "failed",
        error: new Error(
          `GPU recovery failed after ${maxAttempts} attempts. Please reload the page.`,
        ),
      });
      this._gpuRecovering = false;
      return;
    }

    // Save camera state
    const camPos = this._camera.position.clone();
    const camQuat = this._camera.quaternion.clone();

    // Null out post-processing to prevent render loop from using stale objects
    this._postProcessing = null;

    try {
      // Dispose old renderer
      const oldRenderer = this.renderer;
      try {
        oldRenderer.dispose();
      } catch {
        /* already lost */
      }
      if (
        this._container &&
        oldRenderer.domElement.parentNode === this._container
      ) {
        this._container.removeChild(oldRenderer.domElement);
      }

      // Create fresh renderer
      const newRenderer = await createWebGPURenderer({
        antialias: this._antialias,
        alpha: true,
      });

      if (this._disposed) {
        newRenderer.dispose();
        this._gpuRecovering = false;
        return;
      }

      // Reconfigure
      const maxPr = Math.min(window.devicePixelRatio, this._maxPixelRatio);
      newRenderer.setPixelRatio(maxPr);
      const w = this._container?.clientWidth || 1;
      const h = this._container?.clientHeight || 1;
      newRenderer.setSize(w, h);
      newRenderer.outputColorSpace = THREE.SRGBColorSpace;
      newRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      newRenderer.toneMappingExposure = this._currentExposure;
      newRenderer.shadowMap.enabled = this._enableShadows;
      newRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // Attach to DOM
      if (this._container) {
        this._container.appendChild(newRenderer.domElement);
      }

      // Replace the renderer reference — cast away readonly for recovery
      (this as { renderer: HyperForgeRenderer }).renderer = newRenderer;

      // Rebuild post-processing with new renderer
      this._buildPostProcessing();

      // Restore camera
      this._camera.position.copy(camPos);
      this._camera.quaternion.copy(camQuat);

      // Wire device-loss handler on new renderer
      this._wireDeviceLossHandler(newRenderer);

      console.log(
        `[ViewportRenderLoop] Device recovery #${attempt} successful`,
      );
      this._gpuRecoveryCallback?.({
        attempt,
        maxAttempts,
        phase: "succeeded",
      });
    } catch (recoverErr) {
      console.error("[ViewportRenderLoop] Device recovery failed:", recoverErr);
      this._gpuRecoveryCallback?.({
        attempt,
        maxAttempts,
        phase: "failed",
        error: recoverErr,
      });
    } finally {
      this._gpuRecovering = false;
    }
  }

  // ====================================================================
  // Private — DOM attachment and resize
  // ====================================================================

  /** Append the renderer canvas to the container element. */
  private _attachToContainer(): void {
    if (!this._container) return;
    this._container.appendChild(this.renderer.domElement);
  }

  /**
   * Set up resize observation so the renderer tracks container size changes
   * (e.g. sidebar collapse/expand, not just window resize).
   */
  private _setupResizeObserver(): void {
    if (!this._container) return;

    const handleResize = () => {
      if (this._disposed || !this._container) return;
      const w = this._container.clientWidth || 1;
      const h = this._container.clientHeight || 1;
      if (this._camera instanceof THREE.PerspectiveCamera) {
        this._camera.aspect = w / h;
        this._camera.updateProjectionMatrix();
      }
      this.renderer.setSize(w, h);
    };

    this._resizeHandler = handleResize;

    this._resizeObserver = new ResizeObserver(handleResize);
    this._resizeObserver.observe(this._container);
    // Also listen on window resize as fallback (fullscreen changes, etc.)
    window.addEventListener("resize", handleResize);
  }

  // ====================================================================
  // Private — Animation loop
  // ====================================================================

  /** Schedule the next animation frame. */
  private _scheduleFrame(): void {
    if (!this._running || this._disposed) return;
    this._rafId = requestAnimationFrame(this._tick);
  }

  /**
   * The main animation frame callback. Bound via arrow function to
   * preserve `this` context when passed to requestAnimationFrame.
   */
  private _tick = (): void => {
    if (!this._running || this._disposed) return;
    // Schedule next frame first (consistent with TileBasedTerrain pattern)
    this._scheduleFrame();

    const now = performance.now();
    const deltaTime = Math.min((now - this._lastTime) / 1000, MAX_DELTA);
    this._lastTime = now;
    const elapsedSeconds = now / 1000;

    // ---- Exposure lerp ----
    if (this._targetExposure !== this._currentExposure) {
      this._currentExposure +=
        (this._targetExposure - this._currentExposure) * EXPOSURE.LERP_SPEED;
      // Snap when close enough to avoid infinite lerp
      if (Math.abs(this._targetExposure - this._currentExposure) < 0.001) {
        this._currentExposure = this._targetExposure;
      }
      this.renderer.toneMappingExposure = this._currentExposure;
    }

    // ---- Per-frame callbacks (camera updates, tile loading, etc.) ----
    for (let i = 0; i < this._frameCallbacks.length; i++) {
      this._frameCallbacks[i](deltaTime, elapsedSeconds);
    }

    // ---- LOD throttling ----
    if (this._lodObjects.length > 0) {
      this._lodFrameCounter++;
      const camDx = this._camera.position.x - this._lastLodCameraX;
      const camDz = this._camera.position.z - this._lastLodCameraZ;
      if (
        this._lodFrameCounter >= LOD_FRAME_INTERVAL ||
        camDx * camDx + camDz * camDz > LOD_CAMERA_MOVE_THRESHOLD_SQ
      ) {
        this._lodFrameCounter = 0;
        this._lastLodCameraX = this._camera.position.x;
        this._lastLodCameraZ = this._camera.position.z;
        for (let i = 0; i < this._lodObjects.length; i++) {
          this._lodObjects[i].update(this._camera);
        }
      }
    }

    // ---- Render ----
    if (!this._gpuRecovering) {
      this._render();
    }

    // ---- Post-render callbacks (GPU disposal, ViewHelper overlay, etc.) ----
    for (let i = 0; i < this._postRenderCallbacks.length; i++) {
      this._postRenderCallbacks[i](deltaTime, elapsedSeconds);
    }

    // ---- Perf stats ----
    this._perfFrameCounter++;
    if (this._perfFrameCounter >= PERF_LOG_INTERVAL) {
      this._perfFrameCounter = 0;
      this._emitPerfStats();
    }
  };

  /**
   * Execute the actual render call (post-processing or direct).
   * Catches GPU errors and triggers device-loss recovery.
   */
  private _render(): void {
    try {
      if (this._postProcessing) {
        this._postProcessing.render();
      } else {
        this.renderer.render(this._scene, this._camera);
      }
    } catch (err) {
      console.error(
        "[ViewportRenderLoop] Render error, triggering device loss recovery:",
        err,
      );
      this._recoverGpu("render-crash");
    }
  }

  /** Collect and emit performance stats from the renderer info. */
  private _emitPerfStats(): void {
    const info = this.renderer.info;
    const stats = {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };

    // Always log to console (matches TileBasedTerrain behavior)
    console.log(
      `[PERF] calls=${stats.drawCalls} tris=${stats.triangles} ` +
        `geoms=${stats.geometries} textures=${stats.textures}`,
    );

    this._perfCallback?.(stats);
  }
}
