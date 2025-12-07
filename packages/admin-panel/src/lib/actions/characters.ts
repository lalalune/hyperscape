'use server';

/**
 * Character Server Actions
 * 
 * Server-side functions for fetching and managing characters from the admin panel.
 */

import { getDatabase } from '@/lib/db';
import { characters, inventory, equipment, bankStorage, npcKills } from '@/lib/schema';
import { desc, eq, sql, count, like, or } from 'drizzle-orm';

export interface CharacterWithDetails {
  id: string;
  accountId: string;
  name: string;
  createdAt: number | null;
  lastLogin: number | null;
  combatLevel: number | null;
  health: number | null;
  maxHealth: number | null;
  coins: number | null;
  isAgent: boolean;
  avatar: string | null;
  wallet: string | null;
  // Skills
  attackLevel: number | null;
  strengthLevel: number | null;
  defenseLevel: number | null;
  constitutionLevel: number | null;
  rangedLevel: number | null;
  miningLevel: number | null;
  woodcuttingLevel: number | null;
  fishingLevel: number | null;
  firemakingLevel: number | null;
  cookingLevel: number | null;
  // Position
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
}

/**
 * Get paginated list of characters
 */
export async function getCharacters(options: {
  page?: number;
  limit?: number;
  search?: string;
  accountId?: string;
} = {}): Promise<{ characters: CharacterWithDetails[]; total: number }> {
  const db = getDatabase();
  const { page = 1, limit = 20, search = '', accountId } = options;
  const offset = (page - 1) * limit;
  
  // Build conditions
  const conditions = [];
  
  if (search) {
    conditions.push(
      or(
        like(characters.name, `%${search}%`),
        like(characters.id, `%${search}%`),
        like(characters.wallet, `%${search}%`)
      )
    );
  }
  
  if (accountId) {
    conditions.push(eq(characters.accountId, accountId));
  }
  
  const whereClause = conditions.length > 0 
    ? sql`${sql.join(conditions, sql` AND `)}`
    : undefined;
  
  // Get characters
  const characterResults = await db
    .select()
    .from(characters)
    .where(whereClause)
    .orderBy(desc(characters.lastLogin))
    .limit(limit)
    .offset(offset);
  
  // Get total count
  const countResults = await db
    .select({ count: count() })
    .from(characters)
    .where(whereClause);
  
  return {
    characters: characterResults.map(c => ({
      ...c,
      isAgent: c.isAgent === 1,
    })),
    total: countResults[0]?.count || 0,
  };
}

/**
 * Get single character with full details
 */
export async function getCharacterById(characterId: string) {
  const db = getDatabase();
  
  const charResult = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  
  if (charResult.length === 0) {
    return null;
  }
  
  const char = charResult[0];
  
  // Get inventory, equipment, bank, kills
  const [inventoryItems, equipmentItems, bankItems, kills] = await Promise.all([
    db.select().from(inventory).where(eq(inventory.playerId, characterId)),
    db.select().from(equipment).where(eq(equipment.playerId, characterId)),
    db.select().from(bankStorage).where(eq(bankStorage.playerId, characterId)),
    db.select().from(npcKills).where(eq(npcKills.playerId, characterId)),
  ]);
  
  return {
    ...char,
    isAgent: char.isAgent === 1,
    inventory: inventoryItems,
    equipment: equipmentItems,
    bank: bankItems,
    kills: kills,
  };
}

/**
 * Get character count statistics
 */
export async function getCharacterStats() {
  const db = getDatabase();
  
  const [total, agents, humans] = await Promise.all([
    db.select({ count: count() }).from(characters),
    db.select({ count: count() }).from(characters).where(eq(characters.isAgent, 1)),
    db.select({ count: count() }).from(characters).where(eq(characters.isAgent, 0)),
  ]);
  
  return {
    total: total[0]?.count || 0,
    agents: agents[0]?.count || 0,
    humans: humans[0]?.count || 0,
  };
}
