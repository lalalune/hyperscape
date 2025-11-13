/**
 * Interaction Types
 * All player-world interaction related type definitions including interactable entities,
 * interaction actions, tooltips, and damage numbers
 */

import THREE from "../../extras/three/three";
import type { Position3D } from "../core/base-types";
import type { System } from "../../systems/shared";

// ============== INTERACTABLE ENTITY TYPES ==============

/**
 * InteractableEntity - represents any entity in the world that can be interacted with
 */
export interface InteractableEntity {
  id: string;
  type: "mob" | "npc" | "resource" | "item" | "store" | "bank" | "other";
  name: string;
  position: Position3D;
  interactionDistance: number;
  actions?: string[] | InteractionAction[];
  object?: THREE.Object3D;
  distance?: number;
  enabled?: boolean;
  callback?: () => void;
  description?: string;
  level?: number;
  health?: number;
  maxHealth?: number;
  instanceId?: number; // For instanced resources
}

/**
 * InteractionAction - represents a single action that can be performed on an entity
 */
export interface InteractionAction {
  id: string;
  label: string;
  icon?: string;
  enabled: boolean;
  distance?: number;
  callback: () => void;
}

/**
 * InteractionTargetEntity - enhanced entity data for interaction targeting
 */
export interface InteractionTargetEntity {
  id: string;
  object: THREE.Object3D;
  type:
    | "attack"
    | "pickup"
    | "talk"
    | "gather"
    | "use"
    | "move"
    | "mob"
    | "item"
    | "resource"
    | "npc";
  distance: number;
  description: string;
  name: string;
  level?: number;
  health?: number;
  maxHealth?: number;
  actions: InteractionAction[];
}

/**
 * InteractionHover - tracks hover state for interactable entities
 */
export interface InteractionHover {
  entity: InteractableEntity;
  originalMaterial?: THREE.Material | THREE.Material[] | null;
}

// ============== INTERACTION SYSTEM TYPES ==============

/**
 * InteractionSystemEvents - event types emitted by the interaction system
 */
export interface InteractionSystemEvents {
  "interaction:attack": { targetId: string; targetType: string };
  "interaction:gather": {
    targetId: string;
    resourceType: string;
    tool?: string;
  };
  "interaction:loot": { targetId: string };
  "interaction:talk": { targetId: string };
  "interaction:pickup": { targetId: string };
  "interaction:use": { targetId: string; itemId: string };
}

/**
 * InteractionSystem - interface for the interaction system
 */
export interface InteractionSystem extends System {
  registerMob(
    mesh: THREE.Mesh,
    data: {
      id: string;
      name: string;
      level: number;
      health: number;
      maxHealth: number;
    },
  ): void;
  registerItem(
    mesh: THREE.Mesh,
    data: { id: string; name: string; canPickup: boolean },
  ): void;
  registerResource(
    mesh: THREE.Mesh,
    data: {
      id: string;
      name: string;
      type: string;
      requiredTool: string;
      canGather: boolean;
    },
  ): void;
  registerNPC(
    mesh: THREE.Mesh,
    data: { id: string; name: string; canTalk: boolean; isShop: boolean },
  ): void;
}

// ============== UI INTERACTION TYPES ==============

/**
 * TooltipElement - extended HTMLElement for tooltips
 */
export interface TooltipElement extends HTMLElement {
  _removeListener?: () => void;
}

/**
 * DamageNumber - floating damage/heal/xp numbers displayed in UI
 */
export interface DamageNumber {
  id: string;
  value: number;
  type: "damage" | "heal" | "xp" | "miss";
  position: Position3D;
  timestamp: number;
}
