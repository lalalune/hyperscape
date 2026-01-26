/**
 * Skill Data - Definitions and metadata for OSRS-style skills
 *
 * Shared constant used by:
 * - XPProgressOrb (HUD orbs)
 * - XPDropSystem (3D floating drops)
 * - SkillsPanel (skill grid display)
 * - Other UI components displaying skill information
 */

import type { Skills } from "../types/entities/entity-types";

// ============================================================================
// SKILL CATEGORIES
// ============================================================================

/** Skill category for grouping in UI */
export type SkillCategory = "combat" | "gathering" | "production";

// ============================================================================
// SKILL DEFINITIONS
// ============================================================================

/** Complete skill definition with metadata for UI display */
export interface SkillDefinition {
  /** Skill key matching the Skills interface */
  key: keyof Skills;
  /** Display label */
  label: string;
  /** Emoji icon */
  icon: string;
  /** Category for grouping */
  category: SkillCategory;
  /** Default starting level (usually 1, constitution starts at 10) */
  defaultLevel: number;
}

/**
 * All skill definitions in display order.
 * Combat skills first, then gathering, then production.
 * Prayer is excluded (displayed in separate PrayerPanel).
 */
export const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  // Combat skills
  {
    key: "attack",
    label: "Attack",
    icon: "⚔️",
    category: "combat",
    defaultLevel: 1,
  },
  {
    key: "strength",
    label: "Strength",
    icon: "💪",
    category: "combat",
    defaultLevel: 1,
  },
  {
    key: "defense",
    label: "Defence",
    icon: "🛡️",
    category: "combat",
    defaultLevel: 1,
  },
  {
    key: "constitution",
    label: "Constitution",
    icon: "❤️",
    category: "combat",
    defaultLevel: 10,
  },
  {
    key: "ranged",
    label: "Ranged",
    icon: "🏹",
    category: "combat",
    defaultLevel: 1,
  },
  {
    key: "magic",
    label: "Magic",
    icon: "🔮",
    category: "combat",
    defaultLevel: 1,
  },
  // Gathering skills
  {
    key: "woodcutting",
    label: "Woodcutting",
    icon: "🪓",
    category: "gathering",
    defaultLevel: 1,
  },
  {
    key: "mining",
    label: "Mining",
    icon: "⛏️",
    category: "gathering",
    defaultLevel: 1,
  },
  {
    key: "fishing",
    label: "Fishing",
    icon: "🐟",
    category: "gathering",
    defaultLevel: 1,
  },
  // Production skills
  {
    key: "firemaking",
    label: "Firemaking",
    icon: "🔥",
    category: "production",
    defaultLevel: 1,
  },
  {
    key: "cooking",
    label: "Cooking",
    icon: "🍖",
    category: "production",
    defaultLevel: 1,
  },
  {
    key: "smithing",
    label: "Smithing",
    icon: "🔨",
    category: "production",
    defaultLevel: 1,
  },
  {
    key: "agility",
    label: "Agility",
    icon: "🏃",
    category: "production",
    defaultLevel: 1,
  },
] as const;

/**
 * Get skill definitions by category
 * @param category - The skill category to filter by
 * @returns Array of skill definitions in that category
 */
export function getSkillsByCategory(
  category: SkillCategory,
): SkillDefinition[] {
  return SKILL_DEFINITIONS.filter((skill) => skill.category === category);
}

/**
 * Get a skill definition by key
 * @param key - The skill key (e.g., "attack", "agility")
 * @returns The skill definition or undefined if not found
 */
export function getSkillDefinition(
  key: keyof Skills,
): SkillDefinition | undefined {
  return SKILL_DEFINITIONS.find((skill) => skill.key === key);
}

// ============================================================================
// SKILL ICONS (Legacy - kept for backward compatibility)
// ============================================================================

/** Emoji icons for each skill, keyed by lowercase skill name */
export const SKILL_ICONS: Readonly<Record<string, string>> = {
  attack: "⚔️",
  strength: "💪",
  defence: "🛡️",
  defense: "🛡️", // US spelling alias
  constitution: "❤️",
  hitpoints: "❤️", // OSRS alias
  ranged: "🏹",
  prayer: "✨",
  magic: "🔮",
  cooking: "🍖",
  woodcutting: "🪓",
  fishing: "🐟",
  firemaking: "🔥",
  mining: "⛏️",
  smithing: "🔨",
  herblore: "🧪",
  agility: "🏃",
  thieving: "🗝️",
  slayer: "💀",
  farming: "🌱",
  runecrafting: "🔮",
  hunter: "🦌",
  construction: "🏠",
  summoning: "🐺",
  dungeoneering: "🚪",
  divination: "✨",
  invention: "⚙️",
  archaeology: "🏺",
} as const;

/**
 * Get the emoji icon for a skill
 * @param skill - Skill name (case-insensitive)
 * @returns Emoji icon or star fallback
 */
export function getSkillIcon(skill: string): string {
  return SKILL_ICONS[skill.toLowerCase()] ?? "⭐";
}
