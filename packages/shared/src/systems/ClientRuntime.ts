import { System } from "./System";
import THREE from "../extras/three";
import { initYoga } from "../extras/yoga";
import type { World, WorldOptions } from "../types";
import type { Entity } from "../entities/Entity";
import type { Entities } from "./Entities";

// Pre-allocated temp objects to avoid allocations
const _diagnosticPos = new THREE.Vector3();

// Single worker instance shared across all ClientRuntime instances
let sharedWorker: Worker | null = null;
let sharedWorkerUrl: string | null = null;

// Optimized player search interface
interface PlayerEntity extends Entity {
  isLocal?: boolean;
  isPlayer: boolean;
  base?: THREE.Object3D & { visible: boolean; children: THREE.Object3D[] };
  avatar?: {
    position?: THREE.Vector3;
    visible?: boolean;
    parent: THREE.Object3D | null;
    vrm?: unknown;
    children?: THREE.Object3D[];
    traverse?(callback: (child: THREE.Object3D) => void): void;
  };
  avatarUrl?: string;
  capsule?: { getGlobalPose?(): { p: { x: number; y: number; z: number } } };
  moving?: boolean;
  clickMoveTarget?: { x: number; z: number };
}

/**
 * Client Runtime System
 *
 * Manages client-side initialization, game loop, and diagnostics
 */
export class ClientRuntime extends System {
  // Diagnostics state
  private diagnosticsEnabled = false;
  private diagnosticsInterval = 5000; // Report every 5 seconds
  private lastDiagnosticTime = 0;
  private localPlayer: PlayerEntity | null = null;

  // Scene stats tracking
  private sceneStats = {
    totalObjects: 0,
    totalMeshes: 0,
    visibleMeshes: 0,
  };

  constructor(world: World) {
    super(world);

    // Only set window properties in development
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      type WindowWithDebug = { world?: World; THREE?: typeof THREE };
      (window as WindowWithDebug).world = world;
      (window as WindowWithDebug).THREE = THREE;
    }
  }

  async init(
    options: WorldOptions & {
      loadYoga?: Promise<void>;
      enableDiagnostics?: boolean;
    },
  ): Promise<void> {
    if (options.loadYoga) {
      await options.loadYoga;
    }
    initYoga();

    this.diagnosticsEnabled = options.enableDiagnostics ?? false;
  }

  start() {
    // Start render loop
    if (this.world.graphics?.renderer) {
      (
        this.world.graphics.renderer as {
          setAnimationLoop: (fn: (time?: number) => void | null) => void;
        }
      ).setAnimationLoop((time?: number) =>
        this.world.tick(time ?? performance.now()),
      );
    }

    // Setup visibility change handler
    document.addEventListener("visibilitychange", this.onVisibilityChange);

    // Listen for settings changes
    this.world.settings.on("change", this.onSettingsChange);

    // Start diagnostics if enabled
    if (this.diagnosticsEnabled) {
      setTimeout(() => this.findLocalPlayer(), 2000);
    }
  }

  update(delta: number): void {
    // Run diagnostics periodically
    if (this.diagnosticsEnabled && this.localPlayer) {
      this.lastDiagnosticTime += delta * 1000;
      if (this.lastDiagnosticTime >= this.diagnosticsInterval) {
        this.runDiagnostics();
        this.lastDiagnosticTime = 0;
      }
    }
  }

  private findLocalPlayer(): void {
    const entities = this.world.entities as Entities;

    // Direct iteration without allocations
    if (entities.items instanceof Map) {
      for (const [_id, entity] of entities.items) {
        const player = entity as PlayerEntity;
        if (player.isLocal && player.isPlayer) {
          this.localPlayer = player;
          return;
        }
      }
    }

    // Retry if not found
    if (!this.localPlayer) {
      setTimeout(() => this.findLocalPlayer(), 1000);
    }
  }

  private runDiagnostics(): void {
    if (!this.localPlayer) return;

    console.group("[ClientRuntime Diagnostics]");

    // Player position (reuse temp vector)
    _diagnosticPos.copy(this.localPlayer.position);

    // Base object status
    const base = this.localPlayer.base;
    if (base) {
      // Check scene hierarchy efficiently
      let parent = base.parent;
      let depth = 0;
      while (parent && depth < 10) {
        if (parent === this.world.stage?.scene) {
          break;
        }
        parent = parent.parent;
        depth++;
      }
    }

    // Avatar status
    const avatar = this.localPlayer.avatar;
    if (avatar) {
      // Count meshes efficiently
      let meshCount = 0;
      avatar.traverse?.((child) => {
        if (child instanceof THREE.Mesh) meshCount++;
      });
    }

    // Physics capsule
    const capsule = this.localPlayer.capsule;
    if (capsule?.getGlobalPose) {
      const pose = capsule.getGlobalPose();
    }

    // Camera position
    const camera = this.world.camera;
    if (camera) {
    }

    // Scene statistics (cache and update periodically)
    if (this.world.stage?.scene) {
      this.sceneStats.totalObjects = 0;
      this.sceneStats.totalMeshes = 0;
      this.sceneStats.visibleMeshes = 0;

      this.world.stage.scene.traverse((obj) => {
        this.sceneStats.totalObjects++;
        if (obj instanceof THREE.Mesh) {
          this.sceneStats.totalMeshes++;
          if (obj.visible) this.sceneStats.visibleMeshes++;
        }
      });
    }

    console.groupEnd();
  }

  private onSettingsChange = (changes: { title?: { value?: string } }) => {
    if (changes.title) {
      document.title = changes.title.value || "World";
    }
  };

  private onVisibilityChange = () => {
    // Use shared worker for background ticking to save resources
    if (!sharedWorker) {
      const script = `
        const rate = 1000 / 5 // 5 FPS
        let intervalId = null;
        self.onmessage = (e) => {
          if (e.data === 'start' && !intervalId) {
            intervalId = setInterval(() => {
              self.postMessage(1);
            }, rate);
          }
          if (e.data === 'stop' && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      `;
      const blob = new Blob([script], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      sharedWorkerUrl = url;
      sharedWorker = new Worker(url);
      sharedWorker.onmessage = () => {
        const time = performance.now();
        this.world.tick(time);
      };
    }

    if (document.hidden) {
      // Stop rAF
      if (this.world.graphics?.renderer) {
        (
          this.world.graphics.renderer as {
            setAnimationLoop: (fn: ((time?: number) => void) | null) => void;
          }
        ).setAnimationLoop(null);
      }
      // Start worker
      sharedWorker.postMessage("start");
    } else {
      // Stop worker
      sharedWorker.postMessage("stop");
      // Resume rAF
      if (this.world.graphics?.renderer) {
        (
          this.world.graphics.renderer as {
            setAnimationLoop: (fn: (time?: number) => void) => void;
          }
        ).setAnimationLoop((time?: number) =>
          this.world.tick(time ?? performance.now()),
        );
      }
    }
  };

  destroy() {
    if (this.world.graphics?.renderer) {
      (
        this.world.graphics.renderer as {
          setAnimationLoop: (fn: ((time?: number) => void) | null) => void;
        }
      ).setAnimationLoop(null);
    }
    // Stop background worker and revoke URL
    if (sharedWorker) {
      sharedWorker.postMessage("stop");
      (sharedWorker as unknown as { terminate: () => void }).terminate();
      if (sharedWorkerUrl) URL.revokeObjectURL(sharedWorkerUrl);
      sharedWorker = null;
      sharedWorkerUrl = null;
    }
    // Unsubscribe settings listener
    this.world.settings.off("change", this.onSettingsChange);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.localPlayer = null;
  }
}
