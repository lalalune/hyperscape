/**
 * XP Progress Orb module - third-party-client-style XP visual feedback
 *
 * This module provides:
 * - XPProgressOrb: Main component (composition root)
 * - useXPOrbState: State management hook
 * - XPProgressOrbs: Orb rendering component
 * - FloatingXPDrops: Floating XP drop component
 */

export { XPProgressOrb } from "./XPProgressOrb";
export { useXPOrbState } from "./useXPOrbState";
export type {
  XPDropData,
  GroupedXPDrop,
  ActiveSkill,
  SkillWithProgress,
  UseXPOrbStateResult,
} from "./useXPOrbState";
export { XPProgressOrbs } from "./XPProgressOrbs";
export { FloatingXPDrops } from "./FloatingXPDrops";
