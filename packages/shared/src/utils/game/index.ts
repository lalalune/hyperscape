/**
 * Game logic utilities
 * Combat, entity, component helpers
 */

// Export all from CombatCalculations except calculateDistance* (re-exported from MathUtils)
export {
  type CombatStats,
  type DamageResult,
  calculateDamage,
  isInAttackRange,
  calculateDistance3D,
  isAttackOnCooldown,
  shouldCombatTimeout,
} from "./CombatCalculations";

export * from "./CombatUtils";
export * from "./CombatValidation";

// Export all from EntityUtils except calculateDistance* (to avoid duplicates)
export {
  getEntity,
  getComponent,
  getEntityWithComponent,
  getEntitiesInRange,
  getPlayer,
  groundToTerrain,
} from "./EntityUtils";

export * from "./ComponentUtils";
