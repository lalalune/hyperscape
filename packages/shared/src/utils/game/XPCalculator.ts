/**
 * XP Calculator - OSRS-Accurate Experience Point Calculations
 *
 * Standalone utility functions for XP ↔ Level conversions.
 * Implements the exact XP formula from Old School RuneScape.
 *
 * Formula source: https://oldschool.runescape.wiki/w/Experience
 *
 * Note: SkillsSystem uses a pre-computed XP table (instance method) for server
 * performance in hot paths. These standalone functions are intended for client-side
 * UI rendering where occasional on-the-fly computation is acceptable.
 */

/** Maximum skill level */
const MAX_LEVEL = 99;

/**
 * Get the total XP required to reach a given level.
 *
 * Uses the same accumulative formula as SkillsSystem.generateXPTable() and
 * the on-chain XPTable.sol contract to ensure parity across server, client,
 * and blockchain. Produces 13,034,394 at level 99.
 *
 * @param level - Target level (1-99)
 * @returns Total XP required (0 for level 1)
 *
 * @example
 * getXPForLevel(1)  // => 0
 * getXPForLevel(2)  // => 83
 * getXPForLevel(99) // => 13,034,394
 */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  const clampedLevel = Math.min(level, MAX_LEVEL);

  // Accumulative formula matching SkillsSystem.generateXPTable() exactly:
  // xpDelta(L) = floor((L-1 + 300 * 2^((L-1)/7)) / 4)
  // xpForLevel(N) = sum(xpDelta(2)..xpDelta(N))
  let cumulative = 0;
  for (let l = 2; l <= clampedLevel; l++) {
    const xp = Math.floor(l - 1 + 300 * Math.pow(2, (l - 1) / 7)) / 4;
    cumulative = Math.floor(cumulative + xp);
  }
  return cumulative;
}

/**
 * Get the level for a given amount of XP.
 *
 * Scans from MAX_LEVEL down to find the highest level whose XP threshold
 * the given XP meets or exceeds.
 *
 * @param xp - Current XP amount
 * @returns Level (1-99)
 *
 * @example
 * getLevelForXP(0)    // => 1
 * getLevelForXP(83)   // => 2
 * getLevelForXP(100)  // => 2
 */
export function getLevelForXP(xp: number): number {
  if (xp <= 0) return 1;
  for (let level = MAX_LEVEL; level >= 1; level--) {
    if (xp >= getXPForLevel(level)) {
      return level;
    }
  }
  return 1;
}

/**
 * Get XP remaining until the next level.
 *
 * @param currentXP - Current total XP
 * @param currentLevel - Current level
 * @returns XP remaining (0 if at max level)
 */
export function getXPToNextLevel(
  currentXP: number,
  currentLevel: number,
): number {
  if (currentLevel >= MAX_LEVEL) return 0;
  return getXPForLevel(currentLevel + 1) - currentXP;
}

/**
 * Get XP progress percentage toward the next level.
 *
 * @param currentXP - Current total XP
 * @param currentLevel - Current level
 * @returns Progress percentage (0-100)
 */
export function getXPProgress(currentXP: number, currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 100;

  const currentLevelXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  const progressXP = currentXP - currentLevelXP;
  const requiredXP = nextLevelXP - currentLevelXP;

  if (requiredXP <= 0) return 100;
  return Math.min(100, Math.max(0, (progressXP / requiredXP) * 100));
}
