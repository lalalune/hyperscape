/**
 * VisualFeedbackService
 *
 * Handles visual feedback for interactions:
 * - classic fantasy MMORPG-style movement indicator (arrow + circle)
 * - Click indicators for entity interactions (red X)
 * - Minimap destination sync
 *
 * Consolidates visual feedback logic from legacy InteractionSystem.
 */

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import type { World } from "../../../../core/World";
import type { Position3D } from "../../../../types/core/base-types";
import { VISUAL, TIMING } from "../constants";
import {
  TILE_SIZE,
  worldToTile,
  tileToWorld,
} from "../../../shared/movement/TileSystem";

// Pre-allocated vectors to avoid per-frame allocations
const _playerPos = new THREE.Vector3();

// Movement indicator color (bright yellow)
const MOVEMENT_INDICATOR_COLOR = 0xffff00;

export class VisualFeedbackService {
  private targetMarker: THREE.Mesh | null = null;
  private targetPosition: THREE.Vector3 | null = null;
  private clickIndicatorRed: THREE.Sprite | null = null;
  private activeClickIndicator: THREE.Sprite | null = null;
  private clickIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;

  // classic fantasy MMORPG-style movement indicator components
  private movementIndicatorGroup: THREE.Group | null = null;
  private movementArrow: THREE.Group | null = null;
  private movementCircle: THREE.Mesh | null = null;
  private movementIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;
  private animationStartTime: number = 0;

  constructor(private world: World) {}

  /**
   * Initialize visual feedback elements
   */
  initialize(): void {
    if (this.world.isServer) return;

    if (VISUAL.TARGET_MARKER_ENABLED) {
      this.createTargetMarker();
    }
    this.createMovementIndicator();
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

    // Use MeshBasicNodeMaterial for WebGPU compatibility
    const material = new MeshBasicNodeMaterial();
    material.color = new THREE.Color(VISUAL.TARGET_MARKER_COLOR);
    material.side = THREE.DoubleSide;
    material.transparent = true;
    material.opacity = VISUAL.TARGET_MARKER_OPACITY;
    material.depthWrite = false;
    material.depthTest = true;

    this.targetMarker = new THREE.Mesh(geometry, material);
    this.targetMarker.visible = false;
    this.targetMarker.renderOrder = 999;
    scene.add(this.targetMarker);
  }

  /**
   * Create classic fantasy MMORPG-style movement indicator (V chevron + circle on tile)
   */
  private createMovementIndicator(): void {
    const scene = this.world.stage?.scene;
    if (!scene) return;

    // Create container group
    this.movementIndicatorGroup = new THREE.Group();
    this.movementIndicatorGroup.visible = false;
    this.movementIndicatorGroup.renderOrder = 1000;

    // === Create ground circle (thin ring) ===
    const circleRadius = TILE_SIZE * 0.4;
    const circleGeometry = new THREE.RingGeometry(
      circleRadius * 0.92, // Thinner ring (was 0.7)
      circleRadius,
      32,
    );
    circleGeometry.rotateX(-Math.PI / 2); // Lay flat on ground

    // Use MeshBasicNodeMaterial for WebGPU compatibility
    const circleMaterial = new MeshBasicNodeMaterial();
    circleMaterial.color = new THREE.Color(MOVEMENT_INDICATOR_COLOR);
    circleMaterial.side = THREE.DoubleSide;
    circleMaterial.depthTest = false;
    circleMaterial.depthWrite = false;

    this.movementCircle = new THREE.Mesh(circleGeometry, circleMaterial);
    this.movementCircle.position.y = 0.02;
    this.movementCircle.renderOrder = 999;
    this.movementIndicatorGroup.add(this.movementCircle);

    // === Create V/chevron arrow pointing down (single geometry) ===
    this.movementArrow = new THREE.Group();

    const chevronHeight = 0.55; // Height off ground
    const chevronWidth = 0.22; // Half-width of the V
    const chevronDepth = 0.16; // Vertical extent of the V
    const thickness = 0.04; // Thickness of the V arms
    const extrudeDepth = 0.06; // 3D depth

    // Create chevron shape (V pointing down)
    const shape = new THREE.Shape();
    // Start at top-left outer
    shape.moveTo(-chevronWidth, chevronDepth);
    // Down to bottom point
    shape.lineTo(0, 0);
    // Up to top-right outer
    shape.lineTo(chevronWidth, chevronDepth);
    // Inner right (thickness inward)
    shape.lineTo(chevronWidth - thickness * 0.7, chevronDepth);
    // Down to inner bottom point
    shape.lineTo(0, thickness * 1.2);
    // Up to inner left
    shape.lineTo(-chevronWidth + thickness * 0.7, chevronDepth);
    // Close back to start
    shape.lineTo(-chevronWidth, chevronDepth);

    const extrudeSettings = {
      depth: extrudeDepth,
      bevelEnabled: false,
    };

    // Main chevron
    const chevronGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center the extrusion
    chevronGeometry.translate(0, 0, -extrudeDepth / 2);

    // Use MeshBasicNodeMaterial for WebGPU compatibility
    const chevronMaterial = new MeshBasicNodeMaterial();
    chevronMaterial.color = new THREE.Color(MOVEMENT_INDICATOR_COLOR);
    chevronMaterial.side = THREE.DoubleSide;

    const chevron = new THREE.Mesh(chevronGeometry, chevronMaterial);
    chevron.position.y = chevronHeight;

    this.movementArrow.add(chevron);

    this.movementIndicatorGroup.add(this.movementArrow);
    scene.add(this.movementIndicatorGroup);
  }

  /**
   * Create click indicator sprites (red X for entity interactions)
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

    this.clickIndicatorRed = createXSprite(VISUAL.CLICK_INDICATOR_ENTITY_COLOR);
    scene.add(this.clickIndicatorRed);
  }

  /**
   * Show target marker at position (for movement destination)
   * NOTE: 3D marker disabled per design preference, but minimap marker still shown
   */
  showTargetMarker(position: Position3D): void {
    // Snap to tile center
    const tile = worldToTile(position.x, position.z);
    const snappedPos = tileToWorld(tile);

    // Sync with minimap (3D marker hidden, but minimap still shows destination)
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
   * For ground clicks: shows classic fantasy MMORPG-style arrow + circle
   * For entity clicks: shows red X marker
   */
  showClickIndicator(position: Position3D, type: "ground" | "entity"): void {
    if (type === "ground") {
      // Use classic fantasy MMORPG-style movement indicator for ground clicks
      this.showMovementIndicator(position);
      return;
    }

    // Entity clicks still use red X
    const indicator = this.clickIndicatorRed;
    if (!indicator) return;

    // Hide movement indicator if showing
    this.hideMovementIndicator();

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
   * Show classic fantasy MMORPG-style movement indicator at position
   */
  private showMovementIndicator(position: Position3D): void {
    if (!this.movementIndicatorGroup) return;

    // Hide red X if visible and clear its timeout
    if (this.activeClickIndicator) {
      this.activeClickIndicator.visible = false;
      this.activeClickIndicator = null;
    }
    if (this.clickIndicatorTimeout) {
      clearTimeout(this.clickIndicatorTimeout);
      this.clickIndicatorTimeout = null;
    }

    // Clear any existing movement indicator timeout
    if (this.movementIndicatorTimeout) {
      clearTimeout(this.movementIndicatorTimeout);
      this.movementIndicatorTimeout = null;
    }

    // Position the indicator at the click position
    // The position.y should already be the correct floor height from raycast
    this.movementIndicatorGroup.position.set(
      position.x,
      position.y,
      position.z,
    );
    this.movementIndicatorGroup.visible = true;

    // Record animation start time
    this.animationStartTime = Date.now();

    // No timeout - indicator stays visible until player arrives (handled in update())
  }

  /**
   * Hide movement indicator (public for external cancellation)
   */
  hideMovementIndicator(): void {
    if (this.movementIndicatorGroup) {
      this.movementIndicatorGroup.visible = false;
    }
    if (this.movementIndicatorTimeout) {
      clearTimeout(this.movementIndicatorTimeout);
      this.movementIndicatorTimeout = null;
    }
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
    }

    // Animate movement indicator (arrow bobbing + circle pulsing + billboard)
    if (this.movementIndicatorGroup && this.movementIndicatorGroup.visible) {
      const elapsed = (Date.now() - this.animationStartTime) / 1000;

      // Arrow bobbing animation (up and down)
      if (this.movementArrow) {
        const bobAmount = Math.sin(elapsed * 8) * 0.1;
        this.movementArrow.position.y = bobAmount;

        // Billboard: make arrow face the camera (rotate around Y axis only)
        const camera = this.world.camera;
        if (camera) {
          const indicatorPos = this.movementIndicatorGroup.position;
          const angle = Math.atan2(
            camera.position.x - indicatorPos.x,
            camera.position.z - indicatorPos.z,
          );
          this.movementArrow.rotation.y = angle;
        }
      }

      // Circle pulsing animation (scale only, material is opaque)
      if (this.movementCircle) {
        const pulseScale = 1 + Math.sin(elapsed * 6) * 0.15;
        this.movementCircle.scale.set(pulseScale, 1, pulseScale);
      }
    }

    // Hide when player reaches target using pre-allocated vector
    const player = this.world.getPlayer();
    if (player && this.targetPosition) {
      _playerPos.set(player.position.x, player.position.y, player.position.z);
      const distance = _playerPos.distanceTo(this.targetPosition);
      if (distance < 0.5) {
        this.hideTargetMarker();
      }
    }

    // Hide movement indicator when player reaches destination
    if (player && this.movementIndicatorGroup?.visible) {
      _playerPos.set(player.position.x, player.position.y, player.position.z);
      const indicatorPos = this.movementIndicatorGroup.position;
      const dx = _playerPos.x - indicatorPos.x;
      const dz = _playerPos.z - indicatorPos.z;
      const distance2D = Math.sqrt(dx * dx + dz * dz);
      if (distance2D < 0.5) {
        this.hideMovementIndicator();
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

    const terrainSystem = this.world.getSystem("terrain") as
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

    if (this.clickIndicatorRed && scene) {
      scene.remove(this.clickIndicatorRed);
      const material = this.clickIndicatorRed.material as THREE.SpriteMaterial;
      if (material.map) material.map.dispose();
      material.dispose();
    }

    // Clean up movement indicator
    if (this.movementIndicatorGroup && scene) {
      scene.remove(this.movementIndicatorGroup);

      // Dispose geometries and materials
      this.movementIndicatorGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }

    if (this.clickIndicatorTimeout) {
      clearTimeout(this.clickIndicatorTimeout);
    }

    if (this.movementIndicatorTimeout) {
      clearTimeout(this.movementIndicatorTimeout);
    }

    this.clearMinimapDestination();
  }
}
