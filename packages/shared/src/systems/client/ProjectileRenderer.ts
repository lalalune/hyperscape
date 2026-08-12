/**
 * ProjectileRenderer - Renders combat projectiles (arrows and spells)
 *
 * Creates visual projectiles that fly from attacker to target for ranged/magic attacks.
 * Uses THREE.Sprite for efficient rendering with proper arc trajectory for arrows
 * and straight-line path for spells.
 *
 * Features:
 * - Arrow projectiles with arc trajectory and rotation
 * - Spell projectiles with element-based coloring and trails
 * - Configurable visual properties via spell-visuals.ts
 * - Pulsing effects for stronger spells
 * - Smooth interpolation from source to target
 * - Auto-cleanup after reaching target or timeout
 *
 * Architecture:
 * - Listens to COMBAT_PROJECTILE_LAUNCHED events
 * - Creates THREE.Sprite for main projectile and trail sprites
 * - Animates with lerp interpolation
 * - Auto-removes after hit or timeout
 *
 * @see DamageSplatSystem for similar sprite-based rendering pattern
 * @see spell-visuals.ts for visual configuration
 */

import THREE from "../../extras/three/three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { System } from "../shared/infrastructure/System";
import { EventType } from "../../types/events";
import type { World } from "../../core/World";
import type { WorldOptions } from "../../types/index";
import {
  getSpellVisual,
  getArrowVisual,
  type SpellVisualConfig,
  type ArrowVisualConfig,
} from "../../data/spell-visuals";
import {
  createArrowVisualGeometries,
  createArrowVisualInstance,
  type ArrowVisualGeometries,
} from "./ArrowVisualHelpers";

/**
 * Trail sprite for spell effects
 */
interface TrailSprite {
  mesh: THREE.Mesh;
  /** Position in trail (0 = oldest, length-1 = newest) */
  index: number;
}

/**
 * Active projectile being rendered
 */
interface ActiveProjectile {
  /** Monotonic visual-spawn identity exposed to the stream acceptance probe. */
  diagnosticSequence: number;
  /** Main visual - Group for both spells (multi-layer) and arrows (mesh parts) */
  sprite: THREE.Sprite | THREE.Group;
  /** Current position of projectile */
  currentPos: THREE.Vector3;
  /** Starting position (for arc calculation) */
  startPos: THREE.Vector3;
  /** Target position (updated each frame for tracking) */
  targetPos: THREE.Vector3;
  /** Total distance from start to original target (for arc calculation) */
  totalDistance: number;
  /** Distance traveled so far */
  distanceTraveled: number;
  /** Movement speed in units per second */
  speed: number;
  /** Max lifetime in ms (safety timeout) */
  maxLifetime: number;
  /** Server-derived visual flight duration, excluding any launch delay. */
  travelDurationMs?: number;
  startTime: number;
  type: "arrow" | "spell";
  spellId?: string;
  arrowId?: string;
  attackerId: string;
  targetId: string;
  networkEventId?: string;
  /** Visual config for this projectile */
  visualConfig: SpellVisualConfig | ArrowVisualConfig;
  /** Trail sprites for spell effects */
  trailSprites: TrailSprite[];
  /** Previous positions for trail (circular buffer) */
  trailPositions: THREE.Vector3[];
  /** Current trail position index */
  trailIndex: number;
  /** Orbiting spark meshes for bolt-tier spells (animated in update) */
  sparkMeshes?: THREE.Mesh[];
  /** Billboard mesh children that need to face camera each frame */
  billboardMeshes?: THREE.Mesh[];
}

export interface StreamingArrowVisualSpawnEvent {
  sequence: number;
  attackerId: string;
  targetId: string;
  arrowId: string | null;
  networkEventId: string | null;
  performanceTimeMs: number;
  startPosition: [number, number, number];
  targetPosition: [number, number, number];
  travelDurationMs: number | null;
}

export interface StreamingProjectileVisualDiagnostics {
  schemaVersion: 1;
  updatedAt: number;
  latestSequence: number;
  arrowLaunchEventCount: number;
  arrowSpawnCount: number;
  arrowCancelledBeforeSpawnCount: number;
  pendingArrowCount: number;
  activeArrows: Array<
    StreamingArrowVisualSpawnEvent & {
      currentPosition: [number, number, number];
    }
  >;
  recentArrowSpawns: StreamingArrowVisualSpawnEvent[];
}

/**
 * Impact particle from a spell hit burst
 */
interface ImpactParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

/**
 * ProjectileRenderer - Client-side projectile visualization
 */
export class ProjectileRenderer extends System {
  name = "projectile-renderer";

  private activeProjectiles: ActiveProjectile[] = [];
  private activeImpactParticles: ImpactParticle[] = [];
  private projectileDiagnosticSequence = 0;
  private arrowLaunchEventCount = 0;
  private arrowSpawnCount = 0;
  private arrowCancelledBeforeSpawnCount = 0;
  private readonly recentArrowSpawns: StreamingArrowVisualSpawnEvent[] = [];
  private static readonly MAX_RECENT_ARROW_SPAWNS = 128;

  /**
   * Arrow meshes are short-lived, but their dimensions come from a small
   * manifest-backed set. Reuse transformed geometry across launches so a
   * long-running ranged duel stream does not allocate and retain two new GPU
   * geometry records for every arrow.
   */
  private arrowGeometryCache = new Map<string, ArrowVisualGeometries>();

  // Projectile movement constants
  private readonly PROJECTILE_SPEED = 12; // Units per second (tiles ~= 1 unit)
  private readonly ARROW_SPEED = 15; // Arrows are slightly faster
  private readonly HIT_THRESHOLD = 0.5; // Distance to consider projectile "hit"
  private readonly MAX_LIFETIME = 5000; // Safety timeout in ms
  private readonly TRAIL_UPDATE_INTERVAL = 16; // ~60fps trail updates

  // Pre-allocated for performance
  private readonly _toRemove: number[] = [];
  private readonly _tempVec3 = new THREE.Vector3();
  private readonly _tempVec3b = new THREE.Vector3();
  private readonly _spawnOrigin = new THREE.Vector3();

  // Bound handlers for cleanup
  private boundLaunchHandler: ((data: unknown) => void) | null = null;
  private boundHitHandler: ((data: unknown) => void) | null = null;
  private boundCombatEndedHandler: ((data: unknown) => void) | null = null;

  // Tracks pending delayed-spawn timers so destroy() can cancel them
  private readonly _pendingDelays = new Map<
    ReturnType<typeof setTimeout>,
    {
      attackerId: string;
      targetId: string;
      type: "arrow" | "spell";
      arrowId?: string;
    }
  >();

  // DataTexture-based glow caches (WebGPU-safe, color baked into pixels)
  // Used for both projectile layers and trail meshes via getCachedGlowTexture()
  private spellGlowTextures: Map<string, THREE.DataTexture> = new Map();

  // Shared geometry for billboard particles (reused across all projectiles)
  private static particleGeometry: THREE.CircleGeometry | null = null;

  // Reference count — particleGeometry is only disposed when the last instance tears down
  private static _instanceCount = 0;

  // Last trail update time
  private lastTrailUpdate = 0;

  constructor(world: World) {
    super(world);
  }

  async init(options?: WorldOptions): Promise<void> {
    await super.init(options as WorldOptions);
    ProjectileRenderer._instanceCount++;

    // Only run on client
    if (!this.world.isClient) {
      return;
    }

    // Prevent duplicate subscriptions
    if (this.boundLaunchHandler) {
      return;
    }

    // Create bound handlers
    this.boundLaunchHandler = this.onProjectileLaunched.bind(this);
    this.boundHitHandler = this.onProjectileHit.bind(this);
    this.boundCombatEndedHandler = this.onCombatEnded.bind(this);

    // Listen for projectile events
    this.world.on(
      EventType.COMBAT_PROJECTILE_LAUNCHED,
      this.boundLaunchHandler,
      this,
    );
    this.world.on(EventType.COMBAT_PROJECTILE_HIT, this.boundHitHandler, this);
    this.world.on(EventType.COMBAT_ENDED, this.boundCombatEndedHandler, this);
  }

  getStreamingProjectileVisualDiagnostics(): StreamingProjectileVisualDiagnostics {
    return {
      schemaVersion: 1,
      updatedAt: Date.now(),
      latestSequence: this.projectileDiagnosticSequence,
      arrowLaunchEventCount: this.arrowLaunchEventCount,
      arrowSpawnCount: this.arrowSpawnCount,
      arrowCancelledBeforeSpawnCount: this.arrowCancelledBeforeSpawnCount,
      pendingArrowCount: [...this._pendingDelays.values()].filter(
        (pending) => pending.type === "arrow",
      ).length,
      activeArrows: this.activeProjectiles.flatMap((projectile) =>
        projectile.type === "arrow"
          ? [
              {
                sequence: projectile.diagnosticSequence,
                attackerId: projectile.attackerId,
                targetId: projectile.targetId,
                arrowId: projectile.arrowId ?? null,
                networkEventId: projectile.networkEventId ?? null,
                performanceTimeMs: projectile.startTime,
                startPosition: [
                  projectile.startPos.x,
                  projectile.startPos.y,
                  projectile.startPos.z,
                ] as [number, number, number],
                targetPosition: [
                  projectile.targetPos.x,
                  projectile.targetPos.y,
                  projectile.targetPos.z,
                ] as [number, number, number],
                travelDurationMs: projectile.travelDurationMs ?? null,
                currentPosition: [
                  projectile.sprite.position.x,
                  projectile.sprite.position.y,
                  projectile.sprite.position.z,
                ] as [number, number, number],
              },
            ]
          : [],
      ),
      recentArrowSpawns: this.recentArrowSpawns.map((event) => ({ ...event })),
    };
  }

  /** Create the same nock-origin, +Z arrow silhouette used by the bow. */
  private create3DArrow(config: ArrowVisualConfig): THREE.Group {
    const geometryKey = `${config.length}:${config.width}`;
    let geometries = this.arrowGeometryCache.get(geometryKey);
    if (!geometries) {
      geometries = createArrowVisualGeometries(config);
      this.arrowGeometryCache.set(geometryKey, geometries);
    }
    return createArrowVisualInstance(config, geometries).group;
  }

  /**
   * Get shared CircleGeometry for billboard particles.
   * Reused across all projectile particles to avoid per-particle geometry allocation.
   */
  private static getParticleGeometry(): THREE.CircleGeometry {
    if (!ProjectileRenderer.particleGeometry) {
      ProjectileRenderer.particleGeometry = new THREE.CircleGeometry(0.5, 16);
    }
    return ProjectileRenderer.particleGeometry;
  }

  /**
   * Create a color-baked radial glow DataTexture.
   * Color is baked directly into RGBA pixels (not via material.color) because
   * material.color tinting doesn't reliably produce colored output in the
   * WebGPU renderer path. Follows the RunecraftingAltarEntity pattern.
   *
   * @param colorHex - Hex color to bake (e.g. 0xff4500)
   * @param size - Texture dimensions (square, e.g. 64)
   * @param sharpness - Falloff exponent: 1.5 = soft glow, 4.0 = sharp spark
   */
  private createColoredGlowTexture(
    colorHex: number,
    size: number,
    sharpness: number,
  ): THREE.DataTexture {
    const r = (colorHex >> 16) & 0xff;
    const g = (colorHex >> 8) & 0xff;
    const b = colorHex & 0xff;
    const data = new Uint8Array(size * size * 4);
    const half = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - half) / half;
        const dy = (y + 0.5 - half) / half;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const falloff = Math.max(0, 1 - dist);
        const strength = Math.pow(falloff, sharpness);
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(r * strength);
        data[idx + 1] = Math.round(g * strength);
        data[idx + 2] = Math.round(b * strength);
        data[idx + 3] = Math.round(255 * strength);
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Get or create a cached DataTexture for the given color/sharpness combo.
   * Avoids creating duplicate textures for the same visual parameters.
   */
  private getCachedGlowTexture(
    colorHex: number,
    size: number,
    sharpness: number,
  ): THREE.DataTexture {
    const key = `${colorHex}-${size}-${sharpness}`;
    let tex = this.spellGlowTextures.get(key);
    if (!tex) {
      tex = this.createColoredGlowTexture(colorHex, size, sharpness);
      this.spellGlowTextures.set(key, tex);
    }
    return tex;
  }

  /**
   * Create a billboard glow material with color baked into the texture.
   * Uses CircleGeometry + MeshBasicMaterial with AdditiveBlending.
   * Textures are cached and shared; materials are per-projectile (unique opacity).
   */
  private createGlowMaterial(
    colorHex: number,
    sharpness: number,
    initialOpacity: number,
  ): THREE.MeshBasicMaterial {
    const tex = this.getCachedGlowTexture(colorHex, 64, sharpness);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: initialOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      fog: false,
    });
    // Store base opacity for fade-out calculations
    mat.userData.baseOpacity = initialOpacity;
    return mat;
  }

  /**
   * Get a 3-color palette from a spell's visual config.
   * Returns core (bright center), mid (primary element), outer (darkened trail/ambient).
   */
  private getSpellColorPalette(config: SpellVisualConfig): {
    core: number;
    mid: number;
    outer: number;
  } {
    const mid = config.color;
    const core = config.coreColor ?? 0xffffff;

    // Darken mid color by ~40% for outer
    const mr = (mid >> 16) & 0xff;
    const mg = (mid >> 8) & 0xff;
    const mb = mid & 0xff;
    const outer =
      (Math.round(mr * 0.6) << 16) |
      (Math.round(mg * 0.6) << 8) |
      Math.round(mb * 0.6);

    return { core, mid, outer };
  }

  /**
   * Create a multi-layer spell projectile group.
   * Returns a THREE.Group with billboard meshes (core orb + outer glow),
   * plus orbiting sparks for bolt-tier spells.
   *
   * Layer structure:
   * - Core orb: bright center, sharp glow (sharpness 3.0)
   * - Outer glow: element color, soft glow (sharpness 1.5), 2x size, semi-transparent
   * - Sparks (bolt only): 2 tiny bright particles that orbit the core
   */
  private createSpellGroup(
    config: SpellVisualConfig,
    startX: number,
    startY: number,
    startZ: number,
  ): {
    group: THREE.Group;
    sparkMeshes: THREE.Mesh[];
    billboardMeshes: THREE.Mesh[];
  } {
    const palette = this.getSpellColorPalette(config);
    const geom = ProjectileRenderer.getParticleGeometry();
    const group = new THREE.Group();
    const billboardMeshes: THREE.Mesh[] = [];
    const sparkMeshes: THREE.Mesh[] = [];

    // Layer 1: Outer glow — soft, larger, semi-transparent
    const outerMat = this.createGlowMaterial(palette.mid, 1.5, 0.6);
    const outerMesh = new THREE.Mesh(geom, outerMat);
    const outerSize = config.size * 2.5;
    outerMesh.scale.set(outerSize, outerSize, outerSize);
    outerMesh.renderOrder = 998;
    outerMesh.frustumCulled = false;
    group.add(outerMesh);
    billboardMeshes.push(outerMesh);

    // Layer 2: Core orb — bright center, sharp
    const coreMat = this.createGlowMaterial(palette.core, 3.0, 0.9);
    const coreMesh = new THREE.Mesh(geom, coreMat);
    coreMesh.scale.set(config.size, config.size, config.size);
    coreMesh.renderOrder = 999;
    coreMesh.frustumCulled = false;
    group.add(coreMesh);
    billboardMeshes.push(coreMesh);

    // Layer 3: Orbiting sparks — bolt-tier spells only (have pulseSpeed > 0)
    if (config.pulseSpeed && config.pulseSpeed > 0) {
      for (let i = 0; i < 2; i++) {
        const sparkMat = this.createGlowMaterial(palette.core, 4.0, 0.8);
        const sparkMesh = new THREE.Mesh(geom, sparkMat);
        const sparkSize = config.size * 0.3;
        sparkMesh.scale.set(sparkSize, sparkSize, sparkSize);
        sparkMesh.renderOrder = 999;
        sparkMesh.frustumCulled = false;
        group.add(sparkMesh);
        billboardMeshes.push(sparkMesh);
        sparkMeshes.push(sparkMesh);
      }
    }

    group.position.set(startX, startY, startZ);

    return { group, sparkMeshes, billboardMeshes };
  }

  /**
   * Type guard for projectile launch event payload
   */
  private isValidLaunchPayload(data: unknown): data is {
    attackerId: string;
    targetId: string;
    projectileType: string;
    sourcePosition: { x: number; y: number; z: number };
    targetPosition: { x: number; y: number; z: number };
    spellId?: string;
    arrowId?: string;
    delayMs?: number;
    travelDurationMs?: number;
    networkEventId?: string;
  } {
    if (typeof data !== "object" || data === null) return false;
    const d = data as Record<string, unknown>;

    // Required string fields
    if (typeof d.attackerId !== "string" || d.attackerId.length === 0)
      return false;
    if (typeof d.targetId !== "string" || d.targetId.length === 0) return false;
    if (typeof d.projectileType !== "string") return false;

    // Required position objects
    if (!this.isValidPosition(d.sourcePosition)) return false;
    if (!this.isValidPosition(d.targetPosition)) return false;

    // Optional fields - validate if present
    if (d.spellId !== undefined && typeof d.spellId !== "string") return false;
    if (d.arrowId !== undefined && typeof d.arrowId !== "string") return false;
    if (
      d.networkEventId !== undefined &&
      (typeof d.networkEventId !== "string" ||
        d.networkEventId.length === 0 ||
        d.networkEventId.length > 160)
    ) {
      return false;
    }
    if (
      d.delayMs !== undefined &&
      (typeof d.delayMs !== "number" ||
        !Number.isFinite(d.delayMs) ||
        d.delayMs < 0 ||
        d.delayMs > 5_000)
    ) {
      return false;
    }
    if (
      d.travelDurationMs !== undefined &&
      (typeof d.travelDurationMs !== "number" ||
        !Number.isFinite(d.travelDurationMs) ||
        d.travelDurationMs < 50 ||
        d.travelDurationMs > 10_000)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Type guard for position object
   */
  private isValidPosition(
    pos: unknown,
  ): pos is { x: number; y: number; z: number } {
    if (typeof pos !== "object" || pos === null) return false;
    const p = pos as Record<string, unknown>;
    return (
      typeof p.x === "number" &&
      Number.isFinite(p.x) &&
      typeof p.y === "number" &&
      Number.isFinite(p.y) &&
      typeof p.z === "number" &&
      Number.isFinite(p.z)
    );
  }

  /**
   * Type guard for projectile hit event payload
   */
  private isValidHitPayload(
    data: unknown,
  ): data is { attackerId: string; targetId: string } {
    if (typeof data !== "object" || data === null) return false;
    const d = data as Record<string, unknown>;
    return (
      typeof d.attackerId === "string" &&
      d.attackerId.length > 0 &&
      typeof d.targetId === "string" &&
      d.targetId.length > 0
    );
  }

  /**
   * Handle projectile launch event
   */
  private onProjectileLaunched = (data: unknown): void => {
    // Validate payload structure before use
    if (!this.isValidLaunchPayload(data)) {
      return;
    }

    const {
      attackerId,
      targetId,
      projectileType,
      sourcePosition,
      targetPosition,
      spellId,
      arrowId,
      delayMs,
      travelDurationMs,
      networkEventId,
    } = data;

    // Determine if this is an arrow or spell
    const isSpell = projectileType !== "arrow" && spellId;
    const type = isSpell ? "spell" : "arrow";
    if (type === "arrow") this.arrowLaunchEventCount++;

    // If there's a delay (e.g., for magic cast animation), wait before spawning
    if (delayMs && delayMs > 0) {
      const handle = setTimeout(() => {
        this._pendingDelays.delete(handle);
        this.createProjectile(
          attackerId,
          targetId,
          type,
          sourcePosition,
          targetPosition,
          spellId,
          arrowId,
          travelDurationMs,
          networkEventId,
        );
      }, delayMs);
      this._pendingDelays.set(handle, {
        attackerId,
        targetId,
        type,
        ...(arrowId ? { arrowId } : {}),
      });
    } else {
      this.createProjectile(
        attackerId,
        targetId,
        type,
        sourcePosition,
        targetPosition,
        spellId,
        arrowId,
        travelDurationMs,
        networkEventId,
      );
    }
  };

  /**
   * Handle projectile hit event - remove projectile early if still in flight
   */
  private onProjectileHit = (data: unknown): void => {
    // Validate payload structure before use
    if (!this.isValidHitPayload(data)) {
      return;
    }

    // A throttled background tab can receive the authoritative impact before
    // its delayed visual-spawn timer fires. Cancel that timer so a projectile
    // cannot appear after its damage splat.
    for (const [handle, pair] of this._pendingDelays) {
      if (
        pair.attackerId === data.attackerId &&
        pair.targetId === data.targetId
      ) {
        if (pair.type === "arrow") this.arrowCancelledBeforeSpawnCount++;
        clearTimeout(handle);
        this._pendingDelays.delete(handle);
      }
    }

    // Find and mark for removal any projectile matching this attacker/target
    for (let i = 0; i < this.activeProjectiles.length; i++) {
      const proj = this.activeProjectiles[i];
      if (
        proj.attackerId === data.attackerId &&
        proj.targetId === data.targetId
      ) {
        // Set maxLifetime to 0 to remove on next update
        proj.maxLifetime = 0;
      }
    }
  };

  /** Remove every pending/active visual for a combat pair without an impact. */
  private onCombatEnded = (data: unknown): void => {
    if (!this.isValidHitPayload(data)) return;

    for (const [handle, pair] of this._pendingDelays) {
      const matchesPair =
        (pair.attackerId === data.attackerId &&
          pair.targetId === data.targetId) ||
        (pair.attackerId === data.targetId &&
          pair.targetId === data.attackerId);
      if (matchesPair) {
        if (pair.type === "arrow") this.arrowCancelledBeforeSpawnCount++;
        clearTimeout(handle);
        this._pendingDelays.delete(handle);
      }
    }

    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.activeProjectiles[i];
      const matchesPair =
        (projectile.attackerId === data.attackerId &&
          projectile.targetId === data.targetId) ||
        (projectile.attackerId === data.targetId &&
          projectile.targetId === data.attackerId);
      if (matchesPair) {
        this.removeProjectile(projectile);
        this.activeProjectiles.splice(i, 1);
      }
    }
  };

  /**
   * Resolve the arrow's release origin from the rendered attacker's actual
   * draw hand at the delayed launch instant. Server positions remain the
   * fail-safe for mobs, unloaded avatars, and malformed client rigs.
   */
  private resolveProjectileStartPosition(
    attackerId: string,
    type: "arrow" | "spell",
    sourcePos: { x: number; y: number; z: number },
  ): THREE.Vector3 {
    const origin = this._spawnOrigin.set(
      sourcePos.x,
      sourcePos.y + 1.1,
      sourcePos.z,
    );
    if (type !== "arrow") return origin;

    const entity = this.world.entities?.get(attackerId) as
      | {
          _avatar?: {
            instance?: {
              raw?: {
                userData?: {
                  vrm?: {
                    humanoid?: {
                      getRawBoneNode?: (name: string) => THREE.Object3D | null;
                    };
                  };
                };
              };
            };
          };
          avatar?: {
            instance?: {
              raw?: {
                userData?: {
                  vrm?: {
                    humanoid?: {
                      getRawBoneNode?: (name: string) => THREE.Object3D | null;
                    };
                  };
                };
              };
            };
          };
        }
      | undefined;
    const raw = entity?._avatar?.instance?.raw ?? entity?.avatar?.instance?.raw;
    const drawHand =
      raw?.userData?.vrm?.humanoid?.getRawBoneNode?.("rightHand");
    if (!drawHand) return origin;

    drawHand.getWorldPosition(origin);
    if (
      !Number.isFinite(origin.x) ||
      !Number.isFinite(origin.y) ||
      !Number.isFinite(origin.z)
    ) {
      origin.set(sourcePos.x, sourcePos.y + 1.1, sourcePos.z);
    }
    return origin;
  }

  /**
   * Create a new projectile sprite with optional trail
   */
  private createProjectile(
    attackerId: string,
    targetId: string,
    type: "arrow" | "spell",
    sourcePos: { x: number; y: number; z: number },
    targetPos: { x: number; y: number; z: number },
    spellId?: string,
    arrowId?: string,
    travelDurationMs?: number,
    networkEventId?: string,
  ): void {
    if (!this.world.stage?.scene) {
      return;
    }

    const start = this.resolveProjectileStartPosition(
      attackerId,
      type,
      sourcePos,
    );
    const startX = start.x;
    const startY = start.y;
    const startZ = start.z;
    const endY = targetPos.y + 1.0;

    // Calculate initial distance for arc calculation
    const dx = targetPos.x - startX;
    const dz = targetPos.z - startZ;
    const totalDistance = Math.sqrt(dx * dx + dz * dz);

    // Get visual config
    let visualConfig: SpellVisualConfig | ArrowVisualConfig;
    let projectileObject: THREE.Sprite | THREE.Group;
    let spellSparkMeshes: THREE.Mesh[] = [];
    let spellBillboardMeshes: THREE.Mesh[] = [];

    if (type === "arrow") {
      // Create 3D arrow mesh that naturally points toward target
      const arrowKey = arrowId ?? "default";
      visualConfig = getArrowVisual(arrowKey);
      const arrowConfig = visualConfig as ArrowVisualConfig;

      projectileObject = this.create3DArrow(arrowConfig);
      projectileObject.position.set(startX, startY, startZ);

      // Point arrow toward target using lookAt
      const targetPoint = new THREE.Vector3(targetPos.x, endY, targetPos.z);
      projectileObject.lookAt(targetPoint);
    } else {
      // Create multi-layer spell projectile group
      visualConfig = getSpellVisual(spellId ?? "");
      const spellConfig = visualConfig as SpellVisualConfig;

      const spellResult = this.createSpellGroup(
        spellConfig,
        startX,
        startY,
        startZ,
      );
      projectileObject = spellResult.group;
      spellSparkMeshes = spellResult.sparkMeshes;
      spellBillboardMeshes = spellResult.billboardMeshes;
    }

    // Add to scene
    this.world.stage.scene.add(projectileObject);

    // Create trail meshes for spells (colored DataTexture billboards)
    const trailSprites: TrailSprite[] = [];
    const trailPositions: THREE.Vector3[] = [];
    const spellConfig = visualConfig as SpellVisualConfig;

    if (
      type === "spell" &&
      spellConfig.trailLength &&
      spellConfig.trailLength > 0
    ) {
      const trailLength = spellConfig.trailLength;
      const palette = this.getSpellColorPalette(spellConfig);
      const trailTex = this.getCachedGlowTexture(palette.outer, 32, 2.0);
      const geom = ProjectileRenderer.getParticleGeometry();

      for (let i = 0; i < trailLength; i++) {
        const baseOpacity = 0.35 * (1 - i / trailLength);
        const trailMaterial = new THREE.MeshBasicMaterial({
          map: trailTex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true,
          side: THREE.DoubleSide,
          fog: false,
        });
        trailMaterial.userData.baseOpacity = baseOpacity;

        const trailMesh = new THREE.Mesh(geom, trailMaterial);
        const trailSize = spellConfig.size * (0.3 + (i / trailLength) * 0.4);
        trailMesh.scale.set(trailSize, trailSize, trailSize);
        trailMesh.position.set(startX, startY, startZ);
        trailMesh.visible = false;
        trailMesh.frustumCulled = false;
        trailMesh.renderOrder = 997;

        this.world.stage.scene.add(trailMesh);
        trailSprites.push({ mesh: trailMesh, index: i });
        trailPositions.push(new THREE.Vector3(startX, startY, startZ));
      }
    }

    // Track projectile with speed-based movement
    const speed = type === "arrow" ? this.ARROW_SPEED : this.PROJECTILE_SPEED;

    // Use the projectile object's actual position (may be offset for arrows)
    const spawnX = projectileObject.position.x;
    const spawnZ = projectileObject.position.z;

    const startTime = performance.now();
    const diagnosticSequence = ++this.projectileDiagnosticSequence;
    this.activeProjectiles.push({
      diagnosticSequence,
      sprite: projectileObject,
      currentPos: new THREE.Vector3(spawnX, startY, spawnZ),
      startPos: new THREE.Vector3(spawnX, startY, spawnZ),
      targetPos: new THREE.Vector3(targetPos.x, endY, targetPos.z),
      totalDistance,
      distanceTraveled: 0,
      speed,
      maxLifetime: Math.max(this.MAX_LIFETIME, (travelDurationMs ?? 0) + 1_000),
      travelDurationMs,
      startTime,
      type,
      spellId,
      arrowId,
      attackerId,
      targetId,
      networkEventId,
      visualConfig,
      trailSprites,
      trailPositions,
      trailIndex: 0,
      sparkMeshes: spellSparkMeshes.length > 0 ? spellSparkMeshes : undefined,
      billboardMeshes:
        spellBillboardMeshes.length > 0 ? spellBillboardMeshes : undefined,
    });
    if (type === "arrow") {
      this.arrowSpawnCount++;
      this.recentArrowSpawns.push({
        sequence: diagnosticSequence,
        attackerId,
        targetId,
        arrowId: arrowId ?? null,
        networkEventId: networkEventId ?? null,
        performanceTimeMs: startTime,
        startPosition: [spawnX, startY, spawnZ],
        targetPosition: [targetPos.x, endY, targetPos.z],
        travelDurationMs: travelDurationMs ?? null,
      });
      if (
        this.recentArrowSpawns.length >
        ProjectileRenderer.MAX_RECENT_ARROW_SPAWNS
      ) {
        this.recentArrowSpawns.shift();
      }
    }
  }

  /**
   * Get current position of a target entity (mob or player)
   * Uses same pattern as DamageSplatSystem for reliable entity lookup
   */
  private getTargetPosition(targetId: string, outVec: THREE.Vector3): boolean {
    // Use world.entities.get() - works for both mobs and players on client
    const target = this.world.entities?.get(targetId) as {
      position?: { x: number; y: number; z: number };
    } | null;

    if (target?.position) {
      outVec.set(target.position.x, target.position.y + 1.0, target.position.z);
      return true;
    }

    return false;
  }

  /**
   * Update projectile positions each frame using speed-based homing
   */
  update(dt: number): void {
    if (!this.world.isClient) return;

    const now = performance.now();
    const shouldUpdateTrail =
      now - this.lastTrailUpdate >= this.TRAIL_UPDATE_INTERVAL;
    if (shouldUpdateTrail) {
      this.lastTrailUpdate = now;
    }

    this._toRemove.length = 0;

    for (let i = 0; i < this.activeProjectiles.length; i++) {
      const proj = this.activeProjectiles[i];
      const elapsed = now - proj.startTime;

      // Safety timeout or forced removal from hit event
      if (elapsed >= proj.maxLifetime) {
        // maxLifetime=0 means forced by hit event — spawn impact burst
        if (proj.maxLifetime === 0) {
          this.spawnImpactBurst(proj);
        }
        this.removeProjectile(proj);
        this._toRemove.push(i);
        continue;
      }

      // Track moving target - update targetPos with current target position
      this.getTargetPosition(proj.targetId, proj.targetPos);

      // The server's impact tick is authoritative. When its derived duration
      // elapses locally, finish the visual even if frame cadence or target
      // motion prevented the distance threshold from being crossed.
      if (
        proj.travelDurationMs !== undefined &&
        elapsed >= proj.travelDurationMs
      ) {
        this.spawnImpactBurst(proj);
        this.removeProjectile(proj);
        this._toRemove.push(i);
        continue;
      }

      // Calculate direction to target
      this._tempVec3.copy(proj.targetPos).sub(proj.currentPos);
      // OPTIMIZATION: use lengthSq for hit check (avoids sqrt), then compute sqrt once
      // for both normalization and fade — saves one sqrt vs length() + normalize()
      const distSqToTarget = this._tempVec3.lengthSq();

      // Check if we've hit the target
      if (
        proj.travelDurationMs === undefined &&
        distSqToTarget < this.HIT_THRESHOLD * this.HIT_THRESHOLD
      ) {
        this.spawnImpactBurst(proj);
        this.removeProjectile(proj);
        this._toRemove.push(i);
        continue;
      }

      // Compute distance once; reuse for normalization and fade (1 sqrt total)
      const distanceToTarget = Math.sqrt(distSqToTarget);
      // divideScalar(dist) is equivalent to normalize() but avoids a second sqrt
      this._tempVec3.divideScalar(distanceToTarget);
      const remainingFlightSeconds =
        proj.travelDurationMs === undefined
          ? null
          : Math.max(0.001, (proj.travelDurationMs - elapsed) / 1_000 + dt);
      const moveDistance =
        remainingFlightSeconds === null
          ? proj.speed * dt
          : Math.min(
              distanceToTarget,
              (distanceToTarget * dt) / remainingFlightSeconds,
            );
      proj.distanceTraveled += moveDistance;

      // Move toward target
      proj.currentPos.addScaledVector(this._tempVec3, moveDistance);

      // For arrows, add arc based on progress through total flight
      if (proj.type === "arrow" && proj.totalDistance > 0) {
        const arrowConfig = proj.visualConfig as ArrowVisualConfig;
        const arcHeight = arrowConfig.arcHeight ?? 1.5;

        // Progress based on distance traveled vs total distance
        const progress =
          proj.travelDurationMs === undefined
            ? Math.min(proj.distanceTraveled / proj.totalDistance, 1)
            : Math.min(elapsed / proj.travelDurationMs, 1);

        // Parabolic arc: height = 4 * h * t * (1 - t)
        const arcOffset = 4 * arcHeight * progress * (1 - progress);

        // Set position with arc
        proj.sprite.position.set(
          proj.currentPos.x,
          proj.currentPos.y + arcOffset,
          proj.currentPos.z,
        );

        // Point arrow toward target
        if (proj.sprite instanceof THREE.Group) {
          proj.sprite.lookAt(proj.targetPos);
        }
      } else {
        // Spell - direct movement, no arc
        proj.sprite.position.copy(proj.currentPos);

        // Billboard rotation: face all mesh children toward camera
        const cam = this.world.camera;
        const camQuat = cam?.quaternion;
        if (camQuat) {
          if (proj.billboardMeshes) {
            for (const mesh of proj.billboardMeshes) {
              mesh.quaternion.copy(camQuat);
            }
          }
          // Trail meshes also need billboard rotation
          for (const trail of proj.trailSprites) {
            trail.mesh.quaternion.copy(camQuat);
          }
        }

        // Animate bolt-tier spells: orbiting sparks + pulsing outer glow
        if (proj.sparkMeshes && proj.sparkMeshes.length > 0) {
          const spellConfig = proj.visualConfig as SpellVisualConfig;
          const orbitRadius = spellConfig.size * 0.8;
          const orbitSpeed = 6.0; // radians per second
          const t = elapsed * 0.001;
          const pulseSpeed = spellConfig.pulseSpeed ?? 0;
          const pulseAmount = spellConfig.pulseAmount ?? 0;
          const pulse = Math.sin(t * pulseSpeed * Math.PI * 2);

          for (let s = 0; s < proj.sparkMeshes.length; s++) {
            const angle = t * orbitSpeed + s * Math.PI; // Evenly spaced
            proj.sparkMeshes[s].position.set(
              Math.cos(angle) * orbitRadius,
              Math.sin(angle) * orbitRadius,
              0,
            );

            // Oscillate spark opacity
            const sparkMat = proj.sparkMeshes[s]
              .material as THREE.MeshBasicMaterial;
            sparkMat.opacity =
              (sparkMat.userData.baseOpacity ?? 0.8) * (0.7 + 0.3 * pulse);
          }

          // Pulse outer glow scale (first billboard mesh is outer glow)
          if (
            pulseSpeed > 0 &&
            proj.billboardMeshes &&
            proj.billboardMeshes[0]
          ) {
            const outerMesh = proj.billboardMeshes[0];
            const baseSize = spellConfig.size * 2.5;
            const scaledSize = baseSize * (1 + pulse * pulseAmount);
            outerMesh.scale.setScalar(scaledSize);
          }
        }
      }

      // Update trail for spells
      if (
        proj.type === "spell" &&
        proj.trailSprites.length > 0 &&
        shouldUpdateTrail
      ) {
        // Progress approximation for trail opacity
        const progress =
          proj.travelDurationMs !== undefined
            ? Math.min(elapsed / proj.travelDurationMs, 1)
            : proj.totalDistance > 0
              ? Math.min(proj.distanceTraveled / proj.totalDistance, 1)
              : 0.5;
        this.updateTrail(proj, progress);
      }

      // Fade out when very close to target
      if (distanceToTarget < this.HIT_THRESHOLD * 3) {
        const fadeProgress = 1 - distanceToTarget / (this.HIT_THRESHOLD * 3);

        if (proj.sprite instanceof THREE.Group) {
          // Fade all mesh children (spell layers + arrow parts)
          proj.sprite.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const mat = child.material as THREE.MeshBasicMaterial;
              mat.transparent = true;
              mat.opacity =
                (1 - fadeProgress) * (mat.userData.baseOpacity ?? 1);
            }
          });
        } else if (proj.sprite instanceof THREE.Sprite) {
          if (proj.sprite.material instanceof THREE.SpriteMaterial) {
            proj.sprite.material.opacity = 1 - fadeProgress;
          }
        }

        // Fade trail meshes
        for (const trail of proj.trailSprites) {
          const mat = trail.mesh.material as THREE.MeshBasicMaterial;
          const baseOpacity =
            mat.userData.baseOpacity ??
            this.getTrailOpacity(
              trail.index,
              proj.trailSprites.length,
              proj.visualConfig as SpellVisualConfig,
            );
          mat.opacity = baseOpacity * (1 - fadeProgress);
        }
      }
    }

    // Remove completed projectiles (reverse order)
    for (let i = this._toRemove.length - 1; i >= 0; i--) {
      this.activeProjectiles.splice(this._toRemove[i], 1);
    }

    // Update impact particles: move, fade, billboard, cleanup
    const cam = this.world.camera;
    const camQuat = cam?.quaternion;
    for (let i = this.activeImpactParticles.length - 1; i >= 0; i--) {
      const p = this.activeImpactParticles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        (p.mesh.material as THREE.Material).dispose();
        this.world.stage?.scene.remove(p.mesh);
        this.activeImpactParticles.splice(i, 1);
        continue;
      }

      // Move by velocity, apply gravity-like deceleration
      const drag = 1 - dt * 3;
      p.velocity.x *= drag;
      p.velocity.z *= drag;
      p.velocity.y -= dt * 3; // gravity pull
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Fade out over lifetime
      const t = p.life / p.maxLife;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - t) * (mat.userData.baseOpacity ?? 0.9);

      // Shrink slightly
      const scale = (1 - t * 0.5) * p.mesh.scale.x;
      p.mesh.scale.setScalar(scale);

      // Billboard
      if (camQuat) {
        p.mesh.quaternion.copy(camQuat);
      }
    }
  }

  /**
   * Update trail positions for a spell projectile
   */
  private updateTrail(proj: ActiveProjectile, progress: number): void {
    // Store current position in trail history
    proj.trailPositions[proj.trailIndex].copy(proj.sprite.position);
    proj.trailIndex = (proj.trailIndex + 1) % proj.trailPositions.length;

    // Update trail meshes
    for (let t = 0; t < proj.trailSprites.length; t++) {
      const trail = proj.trailSprites[t];
      // Get position from history (older positions = lower index in trail)
      const historyIndex =
        (proj.trailIndex - t - 1 + proj.trailPositions.length) %
        proj.trailPositions.length;
      const trailPos = proj.trailPositions[historyIndex];

      trail.mesh.position.copy(trailPos);

      // Only show trail after we have enough history and projectile is moving
      if (progress > 0.05) {
        trail.mesh.visible = true;
        const mat = trail.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = this.getTrailOpacity(
          t,
          proj.trailSprites.length,
          proj.visualConfig as SpellVisualConfig,
        );
      }
    }
  }

  /**
   * Calculate trail sprite opacity based on position
   */
  private getTrailOpacity(
    index: number,
    total: number,
    config: SpellVisualConfig,
  ): number {
    const trailFade = config.trailFade ?? 0.35;
    // Older trail sprites (higher index) are more faded
    const position = index / total;
    return Math.max(0, (1 - position) * trailFade * config.glowIntensity);
  }

  /**
   * Spawn a burst of impact particles at the projectile's current position.
   * Particles fly outward in random XZ directions with upward drift, then fade.
   */
  private spawnImpactBurst(proj: ActiveProjectile): void {
    if (proj.type !== "spell" || !this.world.stage?.scene) return;

    const config = proj.visualConfig as SpellVisualConfig;
    const palette = this.getSpellColorPalette(config);
    const geom = ProjectileRenderer.getParticleGeometry();
    const count = 4 + Math.floor(Math.random() * 3); // 4-6 particles

    for (let i = 0; i < count; i++) {
      const mat = this.createGlowMaterial(palette.mid, 2.5, 0.9);
      const mesh = new THREE.Mesh(geom, mat);
      const size = config.size * (0.2 + Math.random() * 0.3);
      mesh.scale.set(size, size, size);
      mesh.position.copy(proj.currentPos);
      mesh.renderOrder = 1000;
      mesh.frustumCulled = false;

      // Random outward velocity in XZ + upward drift
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        1.0 + Math.random() * 1.5,
        Math.sin(angle) * speed,
      );

      const maxLife = 0.3 + Math.random() * 0.2; // 0.3-0.5s

      this.world.stage.scene.add(mesh);
      this.activeImpactParticles.push({ mesh, velocity, life: 0, maxLife });
    }
  }

  /**
   * Remove a projectile and its trail from the scene
   */
  private removeProjectile(proj: ActiveProjectile): void {
    // Dispose materials for billboard meshes (textures are cached and shared, not disposed here)
    if (proj.billboardMeshes) {
      for (const mesh of proj.billboardMeshes) {
        (mesh.material as THREE.Material).dispose();
      }
    }

    // Dispose arrow mesh materials; geometry is shared by the renderer cache.
    if (proj.type === "arrow" && proj.sprite instanceof THREE.Group) {
      const disposed = new Set<THREE.Material>();
      proj.sprite.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const material of materials) {
            if (!disposed.has(material)) {
              material.dispose();
              disposed.add(material);
            }
          }
        }
      });
    }

    this.world.stage.scene.remove(proj.sprite);

    // Dispose trail mesh materials
    for (const trail of proj.trailSprites) {
      (trail.mesh.material as THREE.Material).dispose();
      this.world.stage.scene.remove(trail.mesh);
    }
  }

  destroy(): void {
    // Cancel any pending delayed-spawn timers so they don't fire after teardown
    for (const handle of this._pendingDelays.keys()) {
      clearTimeout(handle);
    }
    this._pendingDelays.clear();

    // Remove event listeners
    if (this.boundLaunchHandler) {
      this.world.off(
        EventType.COMBAT_PROJECTILE_LAUNCHED,
        this.boundLaunchHandler,
      );
      this.boundLaunchHandler = null;
    }
    if (this.boundHitHandler) {
      this.world.off(EventType.COMBAT_PROJECTILE_HIT, this.boundHitHandler);
      this.boundHitHandler = null;
    }
    if (this.boundCombatEndedHandler) {
      this.world.off(EventType.COMBAT_ENDED, this.boundCombatEndedHandler);
      this.boundCombatEndedHandler = null;
    }

    // Clean up active projectiles
    for (const proj of this.activeProjectiles) {
      this.removeProjectile(proj);
    }
    this.activeProjectiles = [];

    // Clean up impact particles
    for (const p of this.activeImpactParticles) {
      (p.mesh.material as THREE.Material).dispose();
      this.world.stage?.scene.remove(p.mesh);
    }
    this.activeImpactParticles = [];

    for (const tex of this.spellGlowTextures.values()) {
      tex.dispose();
    }
    this.spellGlowTextures.clear();

    for (const geometries of this.arrowGeometryCache.values()) {
      geometries.shaft.dispose();
      geometries.head.dispose();
      geometries.fletching.dispose();
    }
    this.arrowGeometryCache.clear();

    // Dispose shared geometry
    // Only dispose the shared geometry when the last instance is torn down
    ProjectileRenderer._instanceCount = Math.max(
      0,
      ProjectileRenderer._instanceCount - 1,
    );
    if (
      ProjectileRenderer._instanceCount === 0 &&
      ProjectileRenderer.particleGeometry
    ) {
      ProjectileRenderer.particleGeometry.dispose();
      ProjectileRenderer.particleGeometry = null;
    }

    super.destroy();
  }
}
