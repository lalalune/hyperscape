/**
 * Combat Types
 * All combat-related type definitions
 */

import type { Position3D } from "./base-types";
import type { AttackType } from "./item-types";

export enum CombatStyle {
  AGGRESSIVE = "aggressive",
  CONTROLLED = "controlled",
  DEFENSIVE = "defensive",
  ACCURATE = "accurate",
  LONGRANGE = "longrange",
}

export interface CombatData {
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  startTime: number;
  lastAttackTime: number;
  combatStyle: CombatStyle | null;
}

export interface CombatStateData {
  isInCombat: boolean;
  target: string | null;
  lastAttackTime: number;
  attackCooldown: number;
  damage: number;
  range: number;
}

export interface CombatTarget {
  entityId: string;
  entityType: "player" | "mob";
  distance: number;
  playerId: string;
  threat: number;
  position: Position3D;
  lastSeen: number;
}

// Attack style interfaces
export interface AttackStyle {
  id: string;
  name: string;
  description: string;
  xpDistribution: {
    attack: number;
    strength: number;
    defense: number;
    constitution: number;
  };
  damageModifier: number; // Multiplier for damage calculation
  accuracyModifier: number; // Multiplier for hit chance
  icon: string;
}

// Animation system types
export interface AnimationTask {
  id: string;
  entityId: string;
  targetId?: string;
  animationName: string;
  duration: number;
  attackType: AttackType;
  style: CombatStyle;
  damage?: number;
  startTime: number;
  progress: number;
  cancelled?: boolean;
}

// Combat utility result types
export interface CanAttackResult {
  canAttack: boolean;
  reason?: string;
}

export interface CombatAttackResult {
  success: boolean;
  reason?: string;
  damage?: number;
}
