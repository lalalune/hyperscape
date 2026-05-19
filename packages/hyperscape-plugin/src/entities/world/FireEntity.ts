/**
 * FireEntity - Player-lit fire for cooking
 *
 * Represents a fire that players can cook on.
 * Created when player successfully uses tinderbox on logs.
 * Expires after 60-119 seconds (tile-based-MMORPG-accurate).
 *
 * **Extends**: InteractableEntity (players can interact to cook)
 *
 * **Interaction**:
 * - Left-click: Opens cook interface (if player has raw food)
 * - Right-click: Context menu with "Cook [item]" options and "Examine"
 *
 * **Visual Representation**:
 * - Orange/red fire effect with light
 * - Particle effects (future)
 *
 * **Lifecycle**:
 * - Created by FireManager when fire is lit
 * - Expires after random duration (100-198 ticks)
 * - Removed by FireManager on expiration
 *
 * **Runs on**: Server (authoritative), Client (visual)
 */

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import type { World } from "@hyperforge/shared";
import { EntityType, InteractionType } from "@hyperforge/shared";
import type { EntityInteractionData } from "@hyperforge/shared";
import {
  InteractableEntity,
  type InteractableConfig,
} from "@hyperforge/shared";
import { EventType } from "@hyperforge/shared";
import { getFireInteractionRange } from "@hyperforge/shared";

/**
 * Configuration for creating a FireEntity.
 */
export interface FireEntityConfig {
  id: string;
  position: { x: number; y: number; z: number };
  createdByPlayerId: string;
  expiresAtTick: number;
}

export class FireEntity extends InteractableEntity {
  public readonly entityType = "fire";
  public readonly isInteractable = true;

  /** Player who lit this fire */
  public createdByPlayerId: string;

  /** Tick when fire expires */
  public expiresAtTick: number;

  /** Whether fire is still active */
  public isActive: boolean = true;

  /** Light source (client only) */
  private fireLight: THREE.PointLight | null = null;

  /** Animation time for flickering */
  private animationTime: number = 0;

  constructor(world: World, config: FireEntityConfig) {
    // Convert to InteractableConfig format
    const interactableConfig: InteractableConfig = {
      id: config.id,
      name: "Fire",
      type: EntityType.FIRE,
      position: config.position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.COOKING,
      interactionDistance: getFireInteractionRange(),
      description: "A fire for cooking food.",
      model: null,
      interaction: {
        prompt: "Cook",
        description: "Cook food on this fire",
        range: getFireInteractionRange(),
        cooldown: 0,
        usesRemaining: -1,
        maxUses: -1,
        effect: "cooking",
      },
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: { current: 1, max: 1 },
        level: 1,
      },
    };

    super(world, interactableConfig);

    this.createdByPlayerId = config.createdByPlayerId;
    this.expiresAtTick = config.expiresAtTick;
  }

  protected async createMesh(): Promise<void> {
    // Don't create mesh on server
    if (this.world.isServer) {
      return;
    }

    // Create fire visual group
    const group = new THREE.Group();
    group.name = `Fire_${this.id}`;

    // Create fire mesh (orange/red box for now, can be replaced with particle system)
    const fireGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.6);
    const fireMaterial = new MeshBasicNodeMaterial();
    fireMaterial.color = new THREE.Color(0xff4400);
    fireMaterial.transparent = true;
    fireMaterial.opacity = 0.9;
    const fireMesh = new THREE.Mesh(fireGeometry, fireMaterial);
    fireMesh.name = "FireMesh";
    fireMesh.position.y = 0.2;
    group.add(fireMesh);

    // Add inner flame (brighter)
    const innerGeometry = new THREE.BoxGeometry(0.3, 0.5, 0.3);
    const innerMaterial = new MeshBasicNodeMaterial();
    innerMaterial.color = new THREE.Color(0xffaa00);
    innerMaterial.transparent = true;
    innerMaterial.opacity = 0.95;
    const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
    innerMesh.name = "InnerFlame";
    innerMesh.position.y = 0.25;
    group.add(innerMesh);

    // Add point light for fire illumination
    this.fireLight = new THREE.PointLight(0xff6600, 1.5, 5);
    this.fireLight.position.set(0, 0.5, 0);
    this.fireLight.castShadow = false; // Performance: fires don't cast shadows
    group.add(this.fireLight);

    // Store mesh
    this.mesh = group;

    // Set up userData for interaction detection
    group.userData = {
      type: "fire",
      entityId: this.id,
      name: "Fire",
      interactable: true,
      createdByPlayerId: this.createdByPlayerId,
    };

    // Also set on child meshes for raycast detection
    fireMesh.userData = { ...group.userData };
    innerMesh.userData = { ...group.userData };

    // Add to node
    if (this.node) {
      this.node.add(group);
      this.node.userData.type = "fire";
      this.node.userData.entityId = this.id;
      this.node.userData.interactable = true;
    }
  }

  /**
   * Handle fire interaction - opens cooking interface.
   */
  public async handleInteraction(data: EntityInteractionData): Promise<void> {
    if (!this.isActive) {
      // Fire has gone out
      this.world.emit(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "The fire has gone out.",
      });
      return;
    }

    // Emit event to start cooking interaction
    this.world.emit(EventType.COOKING_INTERACT, {
      playerId: data.playerId,
      fireId: this.id,
      sourceType: "fire" as const,
      position: this.position,
    });
  }

  /**
   * Get context menu actions for this fire.
   * Returns "Cook [item]" for each raw food in player's inventory.
   */
  public getContextMenuActions(playerId: string): Array<{
    id: string;
    label: string;
    priority: number;
    handler: () => void;
  }> {
    const actions: Array<{
      id: string;
      label: string;
      priority: number;
      handler: () => void;
    }> = [];

    if (!this.isActive) {
      return actions;
    }

    // Add "Cook" action that opens cooking interface
    actions.push({
      id: "cook",
      label: "Cook",
      priority: 1,
      handler: () => {
        this.world.emit(EventType.COOKING_INTERACT, {
          playerId,
          fireId: this.id,
          sourceType: "fire" as const,
          position: this.position,
        });
      },
    });

    // Add "Examine" action
    actions.push({
      id: "examine",
      label: "Examine",
      priority: 100,
      handler: () => {
        this.world.emit(EventType.UI_MESSAGE, {
          playerId,
          message: "A fire for cooking food.",
        });
      },
    });

    return actions;
  }

  /**
   * Extinguish the fire (called by FireManager on expiration).
   */
  public extinguish(): void {
    this.isActive = false;

    // Remove light
    if (this.fireLight) {
      this.fireLight.intensity = 0;
    }

    // Fade out visual (client side)
    if (this.mesh && !this.world.isServer) {
      // Could add fade animation here
      this.mesh.visible = false;
    }
  }

  // PERF: Mutates buffer in-place instead of creating new objects
  getNetworkData(): Record<string, unknown> {
    const buf = super.getNetworkData();
    buf.createdByPlayerId = this.createdByPlayerId;
    buf.expiresAtTick = this.expiresAtTick;
    buf.isActive = this.isActive;
    return buf;
  }

  /**
   * Client update - animate fire flickering.
   */
  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);

    if (!this.isActive || !this.fireLight) {
      return;
    }

    // Animate fire flickering
    this.animationTime += deltaTime;
    const flicker = Math.sin(this.animationTime * 10) * 0.2 + 0.1;
    this.fireLight.intensity = 1.3 + flicker;

    // Could also animate mesh scale/color here for more realistic fire
  }

  /**
   * Cleanup resources.
   */
  public dispose(): void {
    if (this.fireLight) {
      this.fireLight.dispose();
      this.fireLight = null;
    }
    // Note: No super.dispose() as InteractableEntity doesn't have one
  }
}
