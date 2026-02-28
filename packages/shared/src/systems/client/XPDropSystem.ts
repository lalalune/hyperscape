/**
 * XPDropSystem - RuneScape 3-style XP Drops
 *
 * Creates visual XP numbers that float up from the player when experience is gained.
 * Mimics RuneScape 3's iconic XP drop feedback system.
 *
 * Features:
 * - Gold/yellow XP text with skill icon
 * - Floating animation (rises up and fades out)
 * - Positioned above the player entity
 * - Shows format: "🪓 +35" (icon + amount)
 *
 * Architecture:
 * - Listens to XP_DROP_RECEIVED events from ClientNetwork
 * - Pre-allocates a pool of canvas+texture+material+sprite objects (no per-event allocation)
 * - Animates with cubic ease-out and fadeout
 * - Auto-returns to pool after animation completes
 */

import * as THREE from "../../extras/three/three";
import { System } from "../shared/infrastructure/System";
import { EventType } from "../../types/events";
import { SKILL_ICONS } from "../../data/skill-icons";
import type { World } from "../../core/World";

/** Pooled GPU resources for a single XP drop sprite. Reused across events. */
interface XPDropPoolItem {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  sprite: THREE.Sprite;
  active: boolean;
}

interface XPDrop {
  poolItem: XPDropPoolItem;
  startTime: number;
  duration: number;
  startY: number;
  riseDistance: number;
}

export class XPDropSystem extends System {
  name = "xp-drop";

  private activeDrops: XPDrop[] = [];
  private readonly DROP_DURATION = 2000; // 2 seconds
  private readonly RISE_DISTANCE = 2.5; // Units to float upward
  private readonly DROP_SIZE = 0.5; // Size of the XP drop sprite
  private readonly CANVAS_SIZE = 256;
  private readonly POOL_SIZE = 10; // Max simultaneous XP drops

  // Pre-allocated array for removal indices to avoid per-frame allocation
  private readonly _toRemove: number[] = [];

  // Reusable sprite pool — eliminates per-event CanvasTexture/SpriteMaterial allocation
  private pool: XPDropPoolItem[] = [];

  // Stored bound handler so it can be removed in destroy()
  private readonly _boundOnXPDrop: (data: unknown) => void;

  constructor(world: World) {
    super(world);
    this._boundOnXPDrop = this.onXPDrop.bind(this);
  }

  async init(): Promise<void> {
    if (!this.world.isClient) return;

    this.initPool();
    this.world.on(EventType.XP_DROP_RECEIVED, this._boundOnXPDrop, this);
  }

  private initPool(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = this.CANVAS_SIZE;
      canvas.height = this.CANVAS_SIZE;
      const context = canvas.getContext("2d")!;

      // NOTE: Do not call texture.dispose() on these during active gameplay.
      // WebGPU texture cache corruption can occur in the dual-renderer setup.
      // Pool objects are reclaimed by GC when pool array is cleared in destroy().
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(this.DROP_SIZE, this.DROP_SIZE, 1);
      sprite.visible = false;

      this.pool.push({
        canvas,
        context,
        texture,
        material,
        sprite,
        active: false,
      });
    }
  }

  private acquirePoolItem(): XPDropPoolItem | null {
    for (const item of this.pool) {
      if (!item.active) {
        item.active = true;
        return item;
      }
    }
    return null; // Pool exhausted — skip this drop
  }

  private releasePoolItem(item: XPDropPoolItem): void {
    item.active = false;
    item.sprite.visible = false;
    item.material.opacity = 1;
    if (item.sprite.parent) {
      item.sprite.parent.remove(item.sprite);
    }
  }

  private onXPDrop = (data: unknown): void => {
    const payload = data as {
      skill: string;
      xpGained: number;
      newXp: number;
      newLevel: number;
      position: { x: number; y: number; z: number };
    };
    this.createXPDrop(payload.skill, payload.xpGained, payload.position);
  };

  private createXPDrop(
    skill: string,
    xpGained: number,
    position: { x: number; y: number; z: number },
  ): void {
    if (!this.world.stage?.scene) return;

    const item = this.acquirePoolItem();
    if (!item) {
      console.warn(
        `[XPDropSystem] Pool exhausted — XP drop skipped. Increase POOL_SIZE (currently ${this.POOL_SIZE}) if this occurs frequently.`,
      );
      return;
    }

    const { canvas, context, texture, material, sprite } = item;
    const size = this.CANVAS_SIZE;

    // Redraw canvas in-place — no new GPU object created
    context.clearRect(0, 0, size, size);

    const bgColor = "rgba(0, 0, 0, 0.6)";
    const textColor = "#f2d08a"; // Hyperscape gold
    const borderColor = "#c9a54a"; // Rich gold border

    context.fillStyle = bgColor;
    this.roundRect(context, 10, 80, 236, 96, 12);
    context.fill();

    context.strokeStyle = borderColor;
    context.lineWidth = 3;
    this.roundRect(context, 10, 80, 236, 96, 12);
    context.stroke();

    const icon = SKILL_ICONS[skill.toLowerCase()] || "⭐";
    context.fillStyle = textColor;
    context.font = "bold 48px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`${icon} +${xpGained}`, size / 2, size / 2);

    // Upload updated canvas pixels to GPU
    texture.needsUpdate = true;

    // Reset visual state
    material.opacity = 1;
    sprite.visible = true;

    const offsetX = (Math.random() - 0.5) * 0.2;
    sprite.position.set(position.x + offsetX, position.y + 2.0, position.z);

    this.world.stage.scene.add(sprite);

    this.activeDrops.push({
      poolItem: item,
      startTime: performance.now(),
      duration: this.DROP_DURATION,
      startY: sprite.position.y,
      riseDistance: this.RISE_DISTANCE,
    });

    // Suppress unused-variable warning (canvas is stored in poolItem)
    void canvas;
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
    this._toRemove.length = 0;

    for (let i = 0; i < this.activeDrops.length; i++) {
      const drop = this.activeDrops[i];
      const elapsed = now - drop.startTime;
      const progress = Math.min(elapsed / drop.duration, 1);

      // Float upward with cubic ease-out
      const easeOut = 1 - Math.pow(1 - progress, 3);
      drop.poolItem.sprite.position.y =
        drop.startY + easeOut * drop.riseDistance;

      // Fade out in last 30% of animation
      if (progress > 0.7) {
        const fadeProgress = (progress - 0.7) / 0.3;
        drop.poolItem.material.opacity = 1 - fadeProgress;
      }

      if (progress >= 1) {
        this.releasePoolItem(drop.poolItem);
        this._toRemove.push(i);
      }
    }

    // Remove completed drops (reverse order to maintain indices)
    for (let i = this._toRemove.length - 1; i >= 0; i--) {
      this.activeDrops.splice(this._toRemove[i], 1);
    }
  }

  destroy(): void {
    this.world.off(EventType.XP_DROP_RECEIVED, this._boundOnXPDrop, this);

    // Return all active drops to pool (removes from scene)
    for (const drop of this.activeDrops) {
      this.releasePoolItem(drop.poolItem);
    }
    this.activeDrops = [];

    // Clear pool — GC reclaims canvas/texture/material without dispose()
    // to avoid WebGPU texture cache corruption with dual-renderer setup
    this.pool = [];
  }
}
