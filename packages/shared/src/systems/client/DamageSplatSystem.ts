/**
 * DamageSplatSystem - classic fantasy MMORPG-style Damage Splats
 *
 * Creates visual damage numbers (hit splats) that appear above entities when they take damage.
 * Mimics classic fantasy MMORPG's iconic damage feedback system.
 *
 * Features:
 * - Red splats for successful hits (damage > 0)
 * - Blue splats for misses (damage = 0)
 * - Floating animation (rises up and fades out)
 * - Positioned above the damaged entity
 *
 * Architecture:
 * - Listens to COMBAT_DAMAGE_DEALT events
 * - Creates THREE.Sprite for each damage number
 * - Animates with fadeout and upward movement
 * - Auto-removes after animation completes
 *
 */

import * as THREE from "../../extras/three/three";
import { System } from "../shared/infrastructure/System";
import { EventType } from "../../types/events";
import type { World } from "../../core/World";
import type { WorldOptions } from "../../types/index";

interface DamageSplat {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  startTime: number;
  duration: number;
  startY: number;
  riseDistance: number;
  active: boolean;
}

/**
 * Pool size for damage splats.
 * Combat-heavy scenarios may have 20-30 simultaneous splats.
 */
const SPLAT_POOL_SIZE = 50;

export class DamageSplatSystem extends System {
  name = "damage-splat";

  // Object pool for damage splats - avoids GC pressure during combat
  private splatPool: DamageSplat[] = [];
  private activeSplats: DamageSplat[] = [];
  private poolInitialized = false;

  private readonly SPLAT_DURATION = 1500; // 1.5 seconds
  private readonly RISE_DISTANCE = 1.5; // Units to float upward
  private readonly SPLAT_SIZE = 0.6; // Size of the splat sprite
  private readonly CANVAS_SIZE = 256;

  // Pre-allocated array for removal indices to avoid per-frame allocation
  private readonly _toRemove: number[] = [];

  // Bound handler reference for proper cleanup
  private boundDamageHandler: ((data: unknown) => void) | null = null;

  constructor(world: World) {
    super(world);
  }

  /**
   * Initialize the splat pool lazily (only when first damage occurs).
   * This avoids upfront cost if no combat happens.
   */
  private initPool(): void {
    if (this.poolInitialized) return;

    for (let i = 0; i < SPLAT_POOL_SIZE; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = this.CANVAS_SIZE;
      canvas.height = this.CANVAS_SIZE;
      const context = canvas.getContext("2d")!;

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(this.SPLAT_SIZE, this.SPLAT_SIZE, 1);
      sprite.visible = false;

      this.splatPool.push({
        sprite,
        material,
        texture,
        canvas,
        context,
        startTime: 0,
        duration: this.SPLAT_DURATION,
        startY: 0,
        riseDistance: this.RISE_DISTANCE,
        active: false,
      });
    }

    this.poolInitialized = true;
  }

  /**
   * Get a splat from the pool, or null if pool is exhausted.
   */
  private acquireSplat(): DamageSplat | null {
    this.initPool();

    // Find an inactive splat in the pool
    for (const splat of this.splatPool) {
      if (!splat.active) {
        splat.active = true;
        return splat;
      }
    }

    // Pool exhausted - this is fine, just skip the splat
    return null;
  }

  /**
   * Return a splat to the pool for reuse.
   */
  private releaseSplat(splat: DamageSplat): void {
    splat.active = false;
    splat.sprite.visible = false;
    if (splat.sprite.parent) {
      splat.sprite.parent.remove(splat.sprite);
    }
  }

  async init(options?: WorldOptions): Promise<void> {
    // CRITICAL: Call super.init() to set initialized flag and prevent duplicate init calls
    await super.init(options as WorldOptions);

    // Only run on client
    if (!this.world.isClient) {
      return;
    }

    // Prevent duplicate subscriptions if init is called multiple times
    if (this.boundDamageHandler) {
      return;
    }

    // Create bound handler for proper cleanup in destroy()
    this.boundDamageHandler = this.onDamageDealt.bind(this);

    // Listen for combat damage events
    this.world.on(EventType.COMBAT_DAMAGE_DEALT, this.boundDamageHandler, this);
  }

  private onDamageDealt = (data: unknown): void => {
    const payload = data as {
      damage: number;
      targetId: string;
      position?: { x: number; y: number; z: number };
    };

    const { damage, targetId, position } = payload;

    // Get target entity for position
    const target = this.world.entities.get(targetId);
    if (!target) {
      if (!position) {
        return;
      }
      this.createDamageSplat(damage, position);
      return;
    }

    // Prefer entity's visual position (updated by TileInterpolator) over
    // server-provided position (tile center, potentially stale). This ensures
    // damage splats appear where the entity visually is on the client.
    const targetPos = target.position || position;
    if (!targetPos) {
      return;
    }

    // Create damage splat
    this.createDamageSplat(damage, targetPos);
  };

  private createDamageSplat(
    damage: number,
    position: { x: number; y: number; z: number },
  ): void {
    // Check if scene is available
    if (!this.world.stage?.scene) {
      return;
    }

    // Acquire splat from pool (returns null if pool exhausted)
    const splat = this.acquireSplat();
    if (!splat) {
      return; // Pool exhausted, skip this splat
    }

    const { context, texture, sprite, material } = splat;
    const size = this.CANVAS_SIZE;

    // Clear canvas and redraw
    context.clearRect(0, 0, size, size);

    // Draw classic MMORPG-style hit splat
    const isHit = damage > 0;
    const bgColor = isHit ? "#8B0000" : "#000080"; // Dark red or dark blue
    const textColor = "#FFFFFF";

    // Draw rounded rectangle background
    context.fillStyle = bgColor;
    this.roundRect(context, 20, 80, 216, 96, 15);
    context.fill();

    // Add border
    context.strokeStyle = "#000000";
    context.lineWidth = 4;
    this.roundRect(context, 20, 80, 216, 96, 15);
    context.stroke();

    // Draw damage number
    context.fillStyle = textColor;
    context.font = "bold 80px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(damage.toString(), size / 2, size / 2);

    // Update texture
    texture.needsUpdate = true;

    // Reset material opacity
    material.opacity = 1;

    // Position above the entity (add random offset to prevent overlapping)
    const offsetX = (Math.random() - 0.5) * 0.3;
    const offsetZ = (Math.random() - 0.5) * 0.3;
    sprite.position.set(
      position.x + offsetX,
      position.y + 1.5,
      position.z + offsetZ,
    );
    sprite.visible = true;

    // Add to scene
    this.world.stage.scene.add(sprite);

    // Configure splat animation state
    splat.startTime = performance.now();
    splat.startY = sprite.position.y;

    // Track splat for animation
    this.activeSplats.push(splat);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  update(_dt: number): void {
    if (!this.world.isClient) return;

    const now = performance.now();
    // Reuse pre-allocated array to avoid per-frame allocation
    this._toRemove.length = 0;
    const toRemove = this._toRemove;

    // Animate all active splats
    for (let i = 0; i < this.activeSplats.length; i++) {
      const splat = this.activeSplats[i];
      const elapsed = now - splat.startTime;
      const progress = Math.min(elapsed / splat.duration, 1);

      // Float upward
      splat.sprite.position.y = splat.startY + progress * splat.riseDistance;

      // Fade out (material is guaranteed to be SpriteMaterial from pool)
      splat.material.opacity = 1 - progress;

      // Mark for removal when done
      if (progress >= 1) {
        // Return to pool instead of disposing
        this.releaseSplat(splat);
        toRemove.push(i);
      }
    }

    // Remove completed splats (reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.activeSplats.splice(toRemove[i], 1);
    }
  }

  destroy(): void {
    // Remove event listener to prevent duplicate subscriptions on re-init
    if (this.boundDamageHandler) {
      this.world.off(EventType.COMBAT_DAMAGE_DEALT, this.boundDamageHandler);
      this.boundDamageHandler = null;
    }

    // Release all active splats back to pool
    for (const splat of this.activeSplats) {
      this.releaseSplat(splat);
    }
    this.activeSplats = [];

    // Dispose pool resources on destroy
    for (const splat of this.splatPool) {
      if (splat.sprite.parent) {
        splat.sprite.parent.remove(splat.sprite);
      }
      splat.texture.dispose();
      splat.material.dispose();
    }
    this.splatPool = [];
    this.poolInitialized = false;

    // Call parent destroy to reset initialized flag
    super.destroy();
  }
}
