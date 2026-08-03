/**
 * Skill Unlocks Data - classic MMORPG-style content unlocks per skill level
 *
 * Defines what content is unlocked at each level for display in
 * the level-up notification popup.
 *
 * ARCHITECTURE:
 * - All skill unlocks are loaded from skill-unlocks.json manifest
 * - Single source of truth - no auto-generation
 *
 * @see packages/server/world/assets/manifests/skill-unlocks.json
 */

/** Type of unlock */
export type UnlockType = "item" | "ability" | "area" | "quest" | "activity";

/** A single skill unlock entry */
export interface SkillUnlock {
  level: number;
  description: string;
  type: UnlockType;
}

/** Manifest format for skill-unlocks.json */
export interface SkillUnlocksManifest {
  skills: Record<string, SkillUnlock[]>;
}

/** Loaded skill unlocks from manifest */
let loadedUnlocks: Record<string, SkillUnlock[]> | null = null;

/**
 * Load skill unlocks from manifest data
 * Called by DataManager after loading skill-unlocks.json
 */
export function loadSkillUnlocks(manifest: SkillUnlocksManifest): void {
  if (!manifest?.skills) {
    console.warn(
      "[SkillUnlocks] Invalid manifest format, expected { skills: {...} }",
    );
    return;
  }

  loadedUnlocks = {};

  for (const [skill, unlocks] of Object.entries(manifest.skills)) {
    if (!Array.isArray(unlocks)) continue;

    // Validate and normalize each unlock
    loadedUnlocks[skill.toLowerCase()] = unlocks
      .filter(
        (u) =>
          typeof u.level === "number" &&
          typeof u.description === "string" &&
          typeof u.type === "string",
      )
      .map((u) => ({
        level: u.level,
        description: u.description,
        type: u.type as UnlockType,
      }))
      .sort((a, b) => a.level - b.level);
  }

  // Normalize British/American spelling: "defence" -> "defense"
  // JSON uses rules-accurate British spelling, but UI uses American spelling
  // Replace the British spelling entirely to keep skill count at 12
  if (loadedUnlocks["defence"] && !loadedUnlocks["defense"]) {
    loadedUnlocks["defense"] = loadedUnlocks["defence"];
    delete loadedUnlocks["defence"];
  }

  const skillCount = Object.keys(loadedUnlocks).length;
  const unlockCount = Object.values(loadedUnlocks).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  console.log(
    `[SkillUnlocks] Loaded ${unlockCount} unlocks across ${skillCount} skills from manifest`,
  );
}

/**
 * Check if skill unlocks have been loaded from manifest
 */
export function isSkillUnlocksLoaded(): boolean {
  return loadedUnlocks !== null;
}

/**
 * Get all unlocks for a specific skill, sorted by level
 *
 * @param skill - Skill name (case-insensitive)
 * @returns All unlocks for this skill, sorted ascending by level
 */
export function getUnlocksForSkill(skill: string): readonly SkillUnlock[] {
  const skillKey = skill.toLowerCase();

  if (loadedUnlocks && skillKey in loadedUnlocks) {
    return loadedUnlocks[skillKey];
  }

  return [];
}

/**
 * Get unlocks for a specific skill at a specific level
 *
 * @param skill - Skill name (case-insensitive)
 * @param level - The level to get unlocks for
 * @returns Array of unlocks at exactly this level (empty if none)
 */
export function getUnlocksAtLevel(skill: string, level: number): SkillUnlock[] {
  const unlocks = getUnlocksForSkill(skill);
  return unlocks.filter((unlock) => unlock.level === level);
}

/**
 * Get all unlocks for a skill up to and including a level
 *
 * @param skill - Skill name (case-insensitive)
 * @param level - Maximum level to include
 * @returns Array of all unlocks up to this level
 */
export function getUnlocksUpToLevel(
  skill: string,
  level: number,
): SkillUnlock[] {
  const unlocks = getUnlocksForSkill(skill);
  return unlocks.filter((unlock) => unlock.level <= level);
}

/**
 * Get all loaded skill unlocks
 */
export function getAllSkillUnlocks(): Readonly<
  Record<string, readonly SkillUnlock[]>
> {
  if (!loadedUnlocks) {
    return {};
  }
  return loadedUnlocks;
}

/**
 * Clear skill unlocks cache (for testing)
 */
export function clearSkillUnlocksCache(): void {
  // No-op since we no longer have auto-generation caches
  // Kept for API compatibility
}

/**
 * Reset all skill unlock data (for testing)
 */
export function resetSkillUnlocks(): void {
  loadedUnlocks = null;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getUnlocksAtLevel, getUnlocksUpToLevel, or getAllSkillUnlocks instead
 */
export const SKILL_UNLOCKS: Readonly<Record<string, readonly SkillUnlock[]>> =
  new Proxy({} as Record<string, readonly SkillUnlock[]>, {
    get(_, prop: string) {
      if (loadedUnlocks && prop in loadedUnlocks) {
        return loadedUnlocks[prop];
      }
      return undefined;
    },
    has(_, prop: string) {
      return loadedUnlocks ? prop in loadedUnlocks : false;
    },
    ownKeys() {
      return loadedUnlocks ? Object.keys(loadedUnlocks) : [];
    },
    getOwnPropertyDescriptor(_, prop: string) {
      if (loadedUnlocks && prop in loadedUnlocks) {
        return {
          enumerable: true,
          configurable: true,
          value: loadedUnlocks[prop],
        };
      }
      return undefined;
    },
  });
