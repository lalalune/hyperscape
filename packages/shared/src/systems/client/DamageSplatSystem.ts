/**
 * DamageSplatSystem - RuneScape-style Damage Splats
 *
 * Creates visual damage numbers (hit splats) that appear above entities when they take damage.
 * Mimics Old School RuneScape's iconic damage feedback system.
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
 */

import THREE from "../../extras/three/three";
import { System } from "../shared/infrastructure/System";
import { EventType } from "../../types/events";
import type { World } from "../../core/World";

interface DamageSplat {
  sprite: THREE.Sprite;
  startTime: number;
  duration: number;
  startY: number;
  riseDistance: number;
}

export class DamageSplatSystem extends System {
  name = "damage-splat";

  private activeSplats: DamageSplat[] = [];
  private readonly SPLAT_DURATION = 1500; // 1.5 seconds
  private readonly RISE_DISTANCE = 1.5; // Units to float upward
  private readonly SPLAT_SIZE = 0.6; // Size of the splat sprite

  constructor(world: World) {
    super(world);
    console.log("[DamageSplatSystem] 🏗️ Constructor called");
  }

  async init(): Promise<void> {
    // Only run on client
    if (!this.world.isClient) {
      console.log(
        "[DamageSplatSystem] Skipping initialization (not on client)",
      );
      return;
    }

    console.log("[DamageSplatSystem] Initializing on client...");
    console.log(
      `[DamageSplatSystem] EventType.COMBAT_DAMAGE_DEALT = "${EventType.COMBAT_DAMAGE_DEALT}"`,
    );

    // Listen for combat damage events
    console.log("[DamageSplatSystem] Registering event listener...");
    this.world.on(
      EventType.COMBAT_DAMAGE_DEALT,
      this.onDamageDealt.bind(this),
      this,
    );
    console.log("[DamageSplatSystem] Event listener registered");

    // Verify listener was added
    const listeners = (this.world as any)._events?.[
      EventType.COMBAT_DAMAGE_DEALT
    ];
    console.log(
      `[DamageSplatSystem] Event listeners for COMBAT_DAMAGE_DEALT:`,
      listeners ? listeners.length : "none",
    );

    console.log(
      "[DamageSplatSystem] ✅ Initialized and listening for COMBAT_DAMAGE_DEALT events",
    );
  }

  private onDamageDealt = (data: unknown): void => {
    const payload = data as {
      damage: number;
      targetId: string;
      position?: { x: number; y: number; z: number };
    };

    const { damage, targetId, position } = payload;

    console.log(
      `[DamageSplatSystem] 💥 onDamageDealt: ${damage} damage to ${targetId}, position:`,
      position,
    );

    // Get target entity for position
    const target = this.world.entities.get(targetId);
    if (!target) {
      console.warn(
        `[DamageSplatSystem] Target entity ${targetId} not found, using provided position`,
      );
      if (!position) {
        console.error(
          "[DamageSplatSystem] No position provided and target not found, cannot show splat",
        );
        return;
      }
      this.createDamageSplat(damage, position);
      return;
    }

    // Use provided position or entity position
    const targetPos = position || target.position;
    if (!targetPos) {
      console.error(
        `[DamageSplatSystem] No position available for target ${targetId}`,
      );
      return;
    }

    console.log(`[DamageSplatSystem] Creating splat at position:`, targetPos);

    // Create damage splat
    this.createDamageSplat(damage, targetPos);
  };

  private createDamageSplat(
    damage: number,
    position: { x: number; y: number; z: number },
  ): void {
    console.log(
      `[DamageSplatSystem] 🎨 Creating splat: damage=${damage}, pos=(${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`,
    );

    // Check if scene is available
    if (!this.world.stage?.scene) {
      console.error(
        "[DamageSplatSystem] Cannot create splat: world.stage.scene not available",
      );
      return;
    }

    // Create canvas for the damage number
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      console.error("[DamageSplatSystem] Failed to get 2D context for canvas");
      return;
    }

    const size = 256;
    canvas.width = size;
    canvas.height = size;

    // Draw OSRS-style hit splat
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

    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false, // Always render on top
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(this.SPLAT_SIZE, this.SPLAT_SIZE, 1);

    // Position above the entity (add random offset to prevent overlapping)
    const offsetX = (Math.random() - 0.5) * 0.3;
    const offsetZ = (Math.random() - 0.5) * 0.3;
    sprite.position.set(
      position.x + offsetX,
      position.y + 1.5,
      position.z + offsetZ,
    );

    // Add to scene
    this.world.stage.scene.add(sprite);

    console.log(
      `[DamageSplatSystem] ✅ Splat added to scene at (${sprite.position.x.toFixed(1)}, ${sprite.position.y.toFixed(1)}, ${sprite.position.z.toFixed(1)}), active splats: ${this.activeSplats.length + 1}`,
    );

    // Track splat for animation
    this.activeSplats.push({
      sprite,
      startTime: performance.now(),
      duration: this.SPLAT_DURATION,
      startY: sprite.position.y,
      riseDistance: this.RISE_DISTANCE,
    });
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
    const toRemove: number[] = [];

    // Animate all active splats
    for (let i = 0; i < this.activeSplats.length; i++) {
      const splat = this.activeSplats[i];
      const elapsed = now - splat.startTime;
      const progress = Math.min(elapsed / splat.duration, 1);

      // Float upward
      splat.sprite.position.y = splat.startY + progress * splat.riseDistance;

      // Fade out
      if (splat.sprite.material instanceof THREE.SpriteMaterial) {
        splat.sprite.material.opacity = 1 - progress;
      }

      // Mark for removal when done
      if (progress >= 1) {
        this.world.stage.scene.remove(splat.sprite);
        splat.sprite.material.dispose();
        if (splat.sprite.material.map) {
          splat.sprite.material.map.dispose();
        }
        toRemove.push(i);
      }
    }

    // Remove completed splats (reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.activeSplats.splice(toRemove[i], 1);
    }
  }

  destroy(): void {
    // Clean up all active splats
    for (const splat of this.activeSplats) {
      this.world.stage.scene.remove(splat.sprite);
      splat.sprite.material.dispose();
      if (splat.sprite.material.map) {
        splat.sprite.material.map.dispose();
      }
    }
    this.activeSplats = [];
  }
}
