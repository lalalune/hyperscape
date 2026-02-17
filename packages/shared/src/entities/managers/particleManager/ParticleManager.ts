/**
 * ParticleManager – Unified Particle Manager
 *
 * Single entry point for all particle systems. Consumers call `register`,
 * `unregister`, and `move` with a discriminated-union config
 * (`ParticleConfig`). The manager routes to the correct specialised
 * sub-manager based on `config.type` and maintains an internal ownership
 * map so that `unregister` / `move` don't need a type hint.
 *
 * Currently manages:
 *   - WaterParticleManager  (fishing spots: splash, bubble, shimmer, ripple)
 *   - GlowParticleManager   (instanced glow billboards: altar, fire, etc.)
 *
 * @module ParticleManager
 */

import * as THREE from "../../../extras/three/three";
import { WaterParticleManager } from "./WaterParticleManager";
import { GlowParticleManager, type GlowPreset } from "./GlowParticleManager";

// =============================================================================
// TYPES
// =============================================================================

/** Config for water-type particles (fishing spots). */
export interface WaterParticleConfig {
  type: "water";
  position: { x: number; y: number; z: number };
  resourceId: string;
}

/** Config for glow-type particles (altar, fire, etc.). */
export interface GlowParticleConfig {
  type: "glow";
  preset: GlowPreset;
  position: { x: number; y: number; z: number };
  /** Colour override – single hex or three-tone palette. */
  color?: number | { core: number; mid: number; outer: number };
  /** Mesh root for geometry-aware spark placement (altar preset). */
  meshRoot?: THREE.Object3D;
  /** Scale of the loaded model (default 1.0). */
  modelScale?: number;
  /** Vertical offset applied to the model (default 0). */
  modelYOffset?: number;
}

/** Discriminated union – pass this to `register()`. */
export type ParticleConfig = WaterParticleConfig | GlowParticleConfig;

/** Lightweight event shape emitted by ResourceSystem for spot relocation. */
export interface ParticleResourceEvent {
  id?: string;
  type?: string;
  position?: { x: number; y: number; z: number };
}

/** Internal ownership discriminator. */
type OwnerType = "water" | "glow";

// =============================================================================
// PARTICLE MANAGER
// =============================================================================

export class ParticleManager {
  private waterManager: WaterParticleManager;
  private glowManager: GlowParticleManager;

  /** Tracks which sub-manager owns each emitter id. */
  private ownership = new Map<string, OwnerType>();

  constructor(scene: THREE.Scene) {
    this.waterManager = new WaterParticleManager(scene);
    this.glowManager = new GlowParticleManager(scene);
    console.log(
      "[ParticleManager] Initialized with WaterParticleManager + GlowParticleManager",
    );
  }

  // ===========================================================================
  // UNIFIED LIFECYCLE
  // ===========================================================================

  /**
   * Register a particle emitter.
   *
   * Routes to the correct sub-manager based on `config.type`.
   */
  register(id: string, config: ParticleConfig): void {
    if (this.ownership.has(id)) {
      this.unregister(id);
    }

    switch (config.type) {
      case "water": {
        this.waterManager.registerSpot({
          entityId: id,
          position: config.position,
          resourceId: config.resourceId,
        });
        this.ownership.set(id, "water");
        break;
      }
      case "glow": {
        const { type: _, ...glowConfig } = config;
        this.glowManager.registerGlow(id, glowConfig);
        this.ownership.set(id, "glow");
        break;
      }
    }
  }

  /**
   * Unregister a particle emitter. No type hint required — the ownership
   * map resolves the correct sub-manager automatically.
   */
  unregister(id: string): void {
    const owner = this.ownership.get(id);
    if (!owner) return;

    switch (owner) {
      case "water":
        this.waterManager.unregisterSpot(id);
        break;
      case "glow":
        this.glowManager.unregisterGlow(id);
        break;
    }

    this.ownership.delete(id);
  }

  /**
   * Move an existing emitter to a new position. No type hint required.
   */
  move(id: string, newPos: { x: number; y: number; z: number }): void {
    const owner = this.ownership.get(id);
    if (!owner) return;

    switch (owner) {
      case "water":
        this.waterManager.moveSpot(id, newPos);
        break;
      case "glow":
        this.glowManager.moveGlow(id, newPos);
        break;
    }
  }

  // ===========================================================================
  // EVENT ROUTING (called by systems)
  // ===========================================================================

  /**
   * Handle a resource event (e.g. RESOURCE_SPAWNED) and route to the
   * appropriate particle manager via the ownership map.
   */
  handleResourceEvent(data: ParticleResourceEvent): void {
    if (!data.id || !data.position) return;
    this.move(data.id, data.position);
  }

  // ===========================================================================
  // PER-FRAME UPDATE
  // ===========================================================================

  /**
   * Drive all particle managers. Called once per frame by the owning system.
   */
  update(dt: number, camera: THREE.Camera): void {
    this.waterManager.update(dt, camera);
    this.glowManager.update(dt, camera);
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  dispose(): void {
    this.waterManager.dispose();
    this.glowManager.dispose();
    this.ownership.clear();
    console.log("[ParticleManager] Disposed all particle managers");
  }
}
