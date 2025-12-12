/**
 * Player ID Mapper Utility
 * Maps session IDs (entity/socket IDs) to persistent user IDs for database operations
 *
 * This is critical for Privy authentication where:
 * - playerId/entityId = socket ID (changes every session)
 * - userId = persistent database ID (stays the same)
 */

export class PlayerIdMapper {
  private static playerIdToUserId = new Map<string, string>();

  /**
   * Register a mapping from playerId (entity ID) to userId (database ID)
   */
  static register(playerId: string, userId: string): void {
    if (playerId && userId && playerId !== userId) {
      this.playerIdToUserId.set(playerId, userId);
    }
  }

  /**
   * Get the database ID for a given player ID
   * Returns userId if mapped, otherwise returns playerId (backward compatible)
   */
  static getDatabaseId(playerId: string): string {
    return this.playerIdToUserId.get(playerId) || playerId;
  }

  /**
   * Check if a player ID has a userId mapping
   */
  static hasMappedUserId(playerId: string): boolean {
    return this.playerIdToUserId.has(playerId);
  }

  /**
   * Remove mapping when player disconnects
   */
  static unregister(playerId: string): void {
    this.playerIdToUserId.delete(playerId);
  }

  /**
   * Clear all mappings (for cleanup/testing)
   */
  static clear(): void {
    this.playerIdToUserId.clear();
  }

  /**
   * Get all mapped player IDs
   */
  static getAllMappedPlayerIds(): string[] {
    return Array.from(this.playerIdToUserId.keys());
  }
}
