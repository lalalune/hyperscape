/**
 * LootPermissionService
 *
 * Pure function for loot permission checks.
 * Shared by HeadstoneEntity (interaction gating) and GravestoneLootSystem (loot processing).
 *
 * Rules (tile-based-MMORPG-style):
 * - Owner can always loot their own gravestone
 * - Safe area deaths (lootProtectionUntil=0): owner-only, no expiration
 * - Wilderness/PvP deaths: protectedFor (killer) can loot during protection period
 * - After protection expires: anyone can loot (wilderness only)
 */

export interface LootProtectionData {
  ownerId: string;
  lootProtectionUntil: number;
  protectedFor?: string;
}

export function canPlayerLoot(
  data: LootProtectionData,
  playerId: string,
): boolean {
  // Owner can always loot their own gravestone
  if (playerId === data.ownerId) {
    return true;
  }

  // Safe area deaths have no protection timer (lootProtectionUntil: 0)
  // Only owner can loot — no expiration
  if (!data.lootProtectionUntil || data.lootProtectionUntil === 0) {
    return false;
  }

  const now = Date.now();

  // Check if loot protection is still active
  if (now < data.lootProtectionUntil) {
    // During protection: only the designated player (killer in PvP) can loot
    if (data.protectedFor && data.protectedFor === playerId) {
      return true;
    }
    return false;
  }

  // Protection expired — anyone can loot (wilderness behavior)
  return true;
}
