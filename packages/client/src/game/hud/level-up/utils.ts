/**
 * Level-Up Notification Utility Functions
 *
 * Helper functions for skill name normalization, formatting, and type guards.
 */

import type { ClientAudio, Chat } from "@hyperforge/shared";

// ============================================================================
// SKILL NAME UTILITIES
// ============================================================================

/**
 * Normalize skill name to lowercase key (removes spaces)
 * Matches the pattern in useXPOrbState.ts for consistency
 *
 * @example normalizeSkillName("Woodcutting") -> "woodcutting"
 * @example normalizeSkillName("Hit Points") -> "hitpoints"
 */
export function normalizeSkillName(skill: string): string {
  return skill.toLowerCase().replace(/\s+/g, "");
}

/**
 * Capitalize skill name for display
 *
 * @example capitalizeSkill("woodcutting") -> "Woodcutting"
 * @example capitalizeSkill("ATTACK") -> "Attack"
 */
export function capitalizeSkill(skill: string): string {
  return skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase();
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for ClientAudio system
 * Validates the object has required AudioContext properties for level-up audio
 *
 * @param obj - Unknown value to check (typically world.audio)
 * @returns true if obj is a valid ClientAudio instance
 */
export function isClientAudio(obj: unknown): obj is ClientAudio {
  if (typeof obj !== "object" || obj === null) return false;
  const audio = obj as Record<string, unknown>;
  return (
    "ctx" in audio &&
    audio.ctx instanceof AudioContext &&
    "groupGains" in audio &&
    typeof audio.groupGains === "object" &&
    "ready" in audio &&
    typeof audio.ready === "function"
  );
}

/**
 * Type guard for Chat system
 * Validates the object has required add method for sending messages
 *
 * @param obj - Unknown value to check (typically world.chat)
 * @returns true if obj is a valid Chat instance
 */
export function isChat(obj: unknown): obj is Chat {
  if (typeof obj !== "object" || obj === null) return false;
  const chat = obj as Record<string, unknown>;
  return "add" in chat && typeof chat.add === "function";
}
