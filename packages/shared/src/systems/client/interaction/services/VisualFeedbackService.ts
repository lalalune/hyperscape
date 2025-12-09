/**
 * VisualFeedbackService
 *
 * Handles visual feedback for interactions:
 * - Target marker (yellow tile indicator for movement destination)
 * - Click indicators (RS3-style X markers)
 * - Minimap destination sync
 *
 * Consolidates visual feedback logic from legacy InteractionSystem.
 */

import * as THREE from "three";
import type { World } from "../../../../core/World";
import type { Position3D } from "../../../../types/core/base-types";
import { VISUAL, TIMING } from "../constants";
import {
  TILE_SIZE,
  worldToTile,
  tileToWorld,
} from "../../../shared/movement/TileSystem";

export class VisualFeedbackService {
  private targetMarker: THREE.Mesh | null = null;
  private targetPosition: THREE.Vector3 | null = null;
  private clickIndicatorYellow: THREE.Sprite | null = null;
  private clickIndicatorRed: THREE.Sprite | null = null;
  private activeClickIndicator: THREE.Sprite | null = null;
  private clickIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private world: World) {}

  /**
   * Initialize visual feedback elements
   */
  initialize(): void {
    if (this.world.isServer) return;

    this.createTargetMarker();
    this.createClickIndicators();
  }

  /**
   * Create target marker (tile indicator for movement destination)
   */
  private createTargetMarker(): void {
    const scene = this.world.stage?.scene;
    if (!scene) return;

    const tileSize = TILE_SIZE * VISUAL.TARGET_MARKER_SCALE;
    const geometry = new THREE.PlaneGeometry(tileSize, tileSize, 4, 4);
    geometry.rotateX(-Math.PI / 2); // Lay flat on ground

    const material = new THREE.MeshBasicMaterial({
      color: VISUAL.TARGET_MARKER_COLOR,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: VISUAL.TARGET_MARKER_OPACITY,
      depthWrite: false,
      depthTest: true,
    });

    this.targetMarker = new THREE.Mesh(geometry, material);
    this.targetMarker.visible = false;
    this.targetMarker.renderOrder = 999;
    scene.add(this.targetMarker);
  }

  /**
   * Create click indicator sprites (RS3-style X markers)
   */
  private createClickIndicators(): void {
    const scene = this.world.stage?.scene;
    if (!scene) return;

    // Helper to create X sprite with given color
    const createXSprite = (color: string): THREE.Sprite => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;

      // Draw X with outline for visibility
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";

      const margin = 12;
      ctx.beginPath();
      ctx.moveTo(margin, margin);
      ctx.lineTo(canvas.width - margin, canvas.height - margin);
      ctx.moveTo(canvas.width - margin, margin);
      ctx.lineTo(margin, canvas.height - margin);
      ctx.stroke();

      // Draw colored X on top
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(margin, margin);
      ctx.lineTo(canvas.width - margin, canvas.height - margin);
      ctx.moveTo(canvas.width - margin, margin);
      ctx.lineTo(margin, canvas.height - margin);
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });

      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 1000;
      return sprite;
    };

    this.clickIndicatorYellow = createXSprite(
      VISUAL.CLICK_INDICATOR_GROUND_COLOR,
    );
    scene.add(this.clickIndicatorYellow);

    this.clickIndicatorRed = createXSprite(VISUAL.CLICK_INDICATOR_ENTITY_COLOR);
    scene.add(this.clickIndicatorRed);
  }

  /**
   * Show target marker at position (for movement destination)
   */
  showTargetMarker(position: Position3D): void {
    if (!this.targetMarker) return;

    // Snap to tile center
    const tile = worldToTile(position.x, position.z);
    const snappedPos = tileToWorld(tile);

    this.targetPosition = new THREE.Vector3(
      snappedPos.x,
      position.y,
      snappedPos.z,
    );
    this.targetMarker.position.set(snappedPos.x, 0, snappedPos.z);

    // Project onto terrain
    this.projectMarkerOntoTerrain(snappedPos.x, snappedPos.z, position.y);

    this.targetMarker.visible = true;

    // Sync with minimap
    this.syncMinimapDestination(snappedPos.x, position.y, snappedPos.z);
  }

  /**
   * Hide target marker
   */
  hideTargetMarker(): void {
    if (this.targetMarker) {
      this.targetMarker.visible = false;
    }
    this.targetPosition = null;
    this.clearMinimapDestination();
  }

  /**
   * Show click indicator at position
   */
  showClickIndicator(position: Position3D, type: "ground" | "entity"): void {
    const indicator =
      type === "ground" ? this.clickIndicatorYellow : this.clickIndicatorRed;
    if (!indicator) return;

    // Hide other indicator
    if (this.activeClickIndicator && this.activeClickIndicator !== indicator) {
      this.activeClickIndicator.visible = false;
    }
    this.activeClickIndicator = indicator;

    // Position slightly above ground
    indicator.position.set(position.x, position.y + 0.1, position.z);

    // Scale based on camera distance
    const camera = this.world.camera;
    if (camera) {
      const distance = camera.position.distanceTo(indicator.position);
      const scale =
        (distance / VISUAL.CLICK_INDICATOR_REFERENCE_DISTANCE) *
        VISUAL.CLICK_INDICATOR_BASE_SCALE;
      const clampedScale = Math.max(
        VISUAL.CLICK_INDICATOR_MIN_SCALE,
        Math.min(VISUAL.CLICK_INDICATOR_MAX_SCALE, scale),
      );
      indicator.scale.set(clampedScale, clampedScale, 1);
    } else {
      indicator.scale.set(
        VISUAL.CLICK_INDICATOR_BASE_SCALE,
        VISUAL.CLICK_INDICATOR_BASE_SCALE,
        1,
      );
    }

    indicator.visible = true;

    // Clear existing timeout
    if (this.clickIndicatorTimeout) {
      clearTimeout(this.clickIndicatorTimeout);
    }

    // Auto-hide after delay
    this.clickIndicatorTimeout = setTimeout(() => {
      if (indicator) {
        indicator.visible = false;
      }
      this.activeClickIndicator = null;
    }, TIMING.CLICK_INDICATOR_MS);
  }

  /**
   * Update visual feedback (called each frame)
   */
  update(): void {
    // Animate target marker
    if (this.targetMarker && this.targetMarker.visible) {
      const time = Date.now() * 0.001;
      const scale = 1 + Math.sin(time * 4) * 0.1;
      this.targetMarker.scale.set(scale, 1, scale);

      // Hide when player reaches target
      const player = this.world.getPlayer();
      if (player && this.targetPosition) {
        const playerPos = new THREE.Vector3(
          player.position.x,
          player.position.y,
          player.position.z,
        );
        const distance = playerPos.distanceTo(this.targetPosition);
        if (distance < 0.5) {
          this.hideTargetMarker();
        }
      }
    }
  }

  /**
   * Project marker onto terrain
   */
  private projectMarkerOntoTerrain(
    centerX: number,
    centerZ: number,
    fallbackY: number,
  ): void {
    if (!this.targetMarker) return;

    const geometry = this.targetMarker.geometry as THREE.BufferGeometry;
    const positionAttribute = geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    if (!positionAttribute) return;

    const terrainSystem = this.world.getSystem("terrain") as unknown as
      | { getHeightAt: (x: number, z: number) => number }
      | undefined;

    if (!terrainSystem) {
      this.targetMarker.position.setY(fallbackY);
      for (let i = 0; i < positionAttribute.count; i++) {
        positionAttribute.setY(i, 0.05);
      }
      positionAttribute.needsUpdate = true;
      return;
    }

    let totalTerrainY = 0;
    let validVertices = 0;

    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const z = positionAttribute.getZ(i);
      const terrainY = terrainSystem.getHeightAt(centerX + x, centerZ + z);

      if (Number.isFinite(terrainY)) {
        totalTerrainY += terrainY;
        validVertices++;
        positionAttribute.setY(i, terrainY + 0.05);
      } else {
        positionAttribute.setY(i, fallbackY + 0.05);
      }
    }

    if (validVertices > 0) {
      const avgTerrainY = totalTerrainY / validVertices;
      this.targetMarker.position.setY(avgTerrainY);

      for (let i = 0; i < positionAttribute.count; i++) {
        const worldY = positionAttribute.getY(i);
        positionAttribute.setY(i, worldY - avgTerrainY);
      }
    } else {
      this.targetMarker.position.setY(fallbackY);
      for (let i = 0; i < positionAttribute.count; i++) {
        positionAttribute.setY(i, 0.05);
      }
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  /**
   * Sync destination with minimap
   */
  private syncMinimapDestination(x: number, y: number, z: number): void {
    (
      window as {
        __lastRaycastTarget?: {
          x: number;
          y: number;
          z: number;
          method: string;
        };
      }
    ).__lastRaycastTarget = { x, y, z, method: "interaction" };
  }

  /**
   * Clear minimap destination marker
   */
  private clearMinimapDestination(): void {
    delete (window as { __lastRaycastTarget?: unknown }).__lastRaycastTarget;
  }

  /**
   * Destroy - clean up resources
   */
  destroy(): void {
    const scene = this.world.stage?.scene;

    if (this.targetMarker && scene) {
      scene.remove(this.targetMarker);
      this.targetMarker.geometry.dispose();
      (this.targetMarker.material as THREE.Material).dispose();
    }

    if (this.clickIndicatorYellow && scene) {
      scene.remove(this.clickIndicatorYellow);
    }

    if (this.clickIndicatorRed && scene) {
      scene.remove(this.clickIndicatorRed);
    }

    if (this.clickIndicatorTimeout) {
      clearTimeout(this.clickIndicatorTimeout);
    }

    this.clearMinimapDestination();
  }
}
