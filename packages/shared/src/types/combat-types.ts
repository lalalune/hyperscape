/**
 * Combat system types
 * 
 * These types are used across various combat-related systems and utilities.
 */

import type { SkillData, PlayerHealth } from './core';

/**
 * Stats component for entities that participate in combat
 * This represents the combat-relevant stats of any entity
 */
export interface CombatStats {
  health: PlayerHealth;
  attack: SkillData;
  strength: SkillData;
  defense: SkillData;
  range: number;
}

/**
 * Re-export StatsComponent from core types to maintain consistency
 * @deprecated Use StatsComponent from '../types/core' instead
 */
export type { StatsComponent } from './core';

/**
 * Result of a combat attack execution
 */
export interface CombatAttackResult {
  success: boolean;
  damage?: number;
  reason?: string;
}

/**
 * Result of checking if an entity can attack
 */
export interface CanAttackResult {
  canAttack: boolean;
  reason?: string;
}