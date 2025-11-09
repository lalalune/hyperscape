/**
 * Component type definitions
 *
 * These types define component interfaces for the ECS system.
 * Components that are widely used have been moved to core.ts to avoid duplication.
 * This file contains specialized component types used by specific systems.
 */

import type { Position3D, CombatBonuses, EquipmentSlotName } from "./core";
import type * as THREE from "three";

// ECS component interfaces that were previously defined in component classes
export interface CombatComponentData {
  isInCombat?: boolean;
  target?: string | null;
  lastAttackTime?: number;
  attackCooldown?: number;
  damage?: number;
  range?: number;
}

export interface InteractionComponentData {
  type?: string;
  interactable?: boolean;
  distance?: number;
  prompt?: string;
  description?: string;
  cooldown?: number;
  lastInteractionTime?: number;
  usesRemaining?: number;
  maxUses?: number;
  requiredItem?: string | null;
  consumesItem?: boolean;
  effect?: string | null;
}

export interface UsageComponentData {
  usesRemaining?: number;
  maxUses?: number;
  isExhausted?: boolean;
  resetTime?: number | null;
  lastResetTime?: number;
  regenerateRate?: number; // Uses regenerated per hour
}

export interface VisualComponentData {
  mesh?: THREE.Object3D | null;
  nameSprite?: THREE.Object3D | null;
  healthSprite?: THREE.Object3D | null;
  isVisible?: boolean;
}

// NOTE: StatsComponent, InventoryComponent moved to core.ts to avoid duplication

// Item definition interface for equipment system
export interface ItemDefinition {
  id: string;
  name: string;
  type:
    | "weapon"
    | "armor"
    | "shield"
    | "ammunition"
    | "consumable"
    | "tool"
    | "resource";
  bonuses: CombatBonuses | null;
  requirements: {
    level: number;
    attack: number;
    defense: number;
    strength: number;
    ranged: number;
    magic: number;
  } | null;
  equipSlot: EquipmentSlotName | null;
}

// Spawn area interface for mob spawning systems
export interface SpawnArea {
  type: "circular" | "rectangular" | "polygon";
  avoidOverlap: boolean;
  minSpacing: number;
  maxHeight: number;
  minHeight: number;
  center: Position3D;
  radius: number; // For circular areas
  width: number; // For rectangular areas
  height: number; // For rectangular areas
  generatePosition(): Position3D | null;
  isValidPosition(position: Position3D): boolean;
  contains(position: Position3D): boolean;
}
