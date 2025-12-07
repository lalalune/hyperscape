'use server';

/**
 * User Server Actions
 * 
 * Server-side functions for fetching and managing users from the admin panel.
 * These use Next.js Server Actions for secure database access.
 */

import { getDatabase } from '@/lib/db';
import { users, characters, playerSessions, inventory, equipment, bankStorage, npcKills } from '@/lib/schema';
import { desc, eq, sql, count, like, or, inArray } from 'drizzle-orm';

export interface UserWithStats {
  id: string;
  name: string;
  roles: string;
  createdAt: string;
  avatar: string | null;
  wallet: string | null;
  privyUserId: string | null;
  farcasterFid: string | null;
  characterCount: number;
  lastActive: number | null;
}

export interface UserFullDetails {
  id: string;
  name: string;
  roles: string;
  createdAt: string;
  avatar: string | null;
  wallet: string | null;
  privyUserId: string | null;
  farcasterFid: string | null;
  characters: Array<{
    id: string;
    name: string;
    combatLevel: number | null;
    health: number | null;
    maxHealth: number | null;
    coins: number | null;
    isAgent: boolean;
    lastLogin: number | null;
    createdAt: number | null;
    inventoryCount: number;
    equipmentCount: number;
    bankCount: number;
  }>;
  totalInventoryItems: number;
  totalEquipmentItems: number;
  totalBankItems: number;
  totalSessions: number;
  totalPlaytimeMinutes: number;
}

/**
 * Get paginated list of users with stats
 */
export async function getUsers(options: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<{ users: UserWithStats[]; total: number }> {
  const db = getDatabase();
  const { page = 1, limit = 20, search = '' } = options;
  const offset = (page - 1) * limit;
  
  // Build search condition
  const searchCondition = search
    ? or(
        like(users.name, `%${search}%`),
        like(users.wallet, `%${search}%`),
        like(users.id, `%${search}%`)
      )
    : undefined;
  
  // Get users with character count
  const usersQuery = db
    .select({
      id: users.id,
      name: users.name,
      roles: users.roles,
      createdAt: users.createdAt,
      avatar: users.avatar,
      wallet: users.wallet,
      privyUserId: users.privyUserId,
      farcasterFid: users.farcasterFid,
      characterCount: sql<number>`(
        SELECT COUNT(*) FROM characters WHERE characters."accountId" = users.id
      )`.as('characterCount'),
      lastActive: sql<number>`(
        SELECT MAX(ps."lastActivity") FROM player_sessions ps
        JOIN characters c ON c.id = ps."playerId"
        WHERE c."accountId" = users.id
      )`.as('lastActive'),
    })
    .from(users)
    .where(searchCondition)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
  
  // Get total count
  const countQuery = db
    .select({ count: count() })
    .from(users)
    .where(searchCondition);
  
  const [userResults, countResults] = await Promise.all([
    usersQuery,
    countQuery,
  ]);
  
  return {
    users: userResults.map(u => ({
      ...u,
      characterCount: Number(u.characterCount) || 0,
      lastActive: u.lastActive ? Number(u.lastActive) : null,
    })),
    total: countResults[0]?.count || 0,
  };
}

/**
 * Get single user by ID with full details including all characters and their data
 */
export async function getUserFullDetails(userId: string): Promise<UserFullDetails | null> {
  const db = getDatabase();
  
  // Get user
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (userResult.length === 0) {
    return null;
  }
  
  const user = userResult[0];
  
  // Get user's characters
  const userCharacters = await db
    .select()
    .from(characters)
    .where(eq(characters.accountId, userId));
  
  const characterIds = userCharacters.map(c => c.id);
  
  // Get counts for each character's related data
  const charactersWithCounts = await Promise.all(
    userCharacters.map(async (char) => {
      const [invCount, equipCount, bankCount] = await Promise.all([
        db.select({ count: count() }).from(inventory).where(eq(inventory.playerId, char.id)),
        db.select({ count: count() }).from(equipment).where(eq(equipment.playerId, char.id)),
        db.select({ count: count() }).from(bankStorage).where(eq(bankStorage.playerId, char.id)),
      ]);
      
      return {
        id: char.id,
        name: char.name,
        combatLevel: char.combatLevel,
        health: char.health,
        maxHealth: char.maxHealth,
        coins: char.coins,
        isAgent: char.isAgent === 1,
        lastLogin: char.lastLogin,
        createdAt: char.createdAt,
        inventoryCount: invCount[0]?.count || 0,
        equipmentCount: equipCount[0]?.count || 0,
        bankCount: bankCount[0]?.count || 0,
      };
    })
  );
  
  // Get total counts
  let totalInventory = 0, totalEquipment = 0, totalBank = 0, totalSessions = 0, totalPlaytime = 0;
  
  if (characterIds.length > 0) {
    const [invTotal, equipTotal, bankTotal, sessionsData] = await Promise.all([
      db.select({ count: count() }).from(inventory).where(inArray(inventory.playerId, characterIds)),
      db.select({ count: count() }).from(equipment).where(inArray(equipment.playerId, characterIds)),
      db.select({ count: count() }).from(bankStorage).where(inArray(bankStorage.playerId, characterIds)),
      db.select({ 
        count: count(),
        playtime: sql<number>`COALESCE(SUM("playtimeMinutes"), 0)`,
      }).from(playerSessions).where(inArray(playerSessions.playerId, characterIds)),
    ]);
    
    totalInventory = invTotal[0]?.count || 0;
    totalEquipment = equipTotal[0]?.count || 0;
    totalBank = bankTotal[0]?.count || 0;
    totalSessions = sessionsData[0]?.count || 0;
    totalPlaytime = Number(sessionsData[0]?.playtime) || 0;
  }
  
  return {
    ...user,
    characters: charactersWithCounts,
    totalInventoryItems: totalInventory,
    totalEquipmentItems: totalEquipment,
    totalBankItems: totalBank,
    totalSessions: totalSessions,
    totalPlaytimeMinutes: totalPlaytime,
  };
}

/**
 * Get single user by ID with full details (legacy - kept for compatibility)
 */
export async function getUserById(userId: string) {
  const db = getDatabase();
  
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (userResult.length === 0) {
    return null;
  }
  
  const user = userResult[0];
  
  // Get user's characters
  const userCharacters = await db
    .select()
    .from(characters)
    .where(eq(characters.accountId, userId));
  
  return {
    ...user,
    characters: userCharacters,
  };
}

/**
 * Delete a user and all associated data (cascading delete)
 * This removes: user, all characters, inventory, equipment, bank, sessions, npc kills
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; deletedCounts: Record<string, number> }> {
  const db = getDatabase();
  
  // First get all character IDs for this user
  const userCharacters = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.accountId, userId));
  
  const characterIds = userCharacters.map(c => c.id);
  
  const deletedCounts: Record<string, number> = {
    inventory: 0,
    equipment: 0,
    bankStorage: 0,
    playerSessions: 0,
    npcKills: 0,
    characters: 0,
    users: 0,
  };
  
  // Delete all related data for each character
  if (characterIds.length > 0) {
    // Delete inventory
    const invResult = await db.delete(inventory).where(inArray(inventory.playerId, characterIds));
    deletedCounts.inventory = (invResult as unknown as { rowCount?: number }).rowCount || characterIds.length;
    
    // Delete equipment
    const equipResult = await db.delete(equipment).where(inArray(equipment.playerId, characterIds));
    deletedCounts.equipment = (equipResult as unknown as { rowCount?: number }).rowCount || 0;
    
    // Delete bank storage
    const bankResult = await db.delete(bankStorage).where(inArray(bankStorage.playerId, characterIds));
    deletedCounts.bankStorage = (bankResult as unknown as { rowCount?: number }).rowCount || 0;
    
    // Delete player sessions
    const sessResult = await db.delete(playerSessions).where(inArray(playerSessions.playerId, characterIds));
    deletedCounts.playerSessions = (sessResult as unknown as { rowCount?: number }).rowCount || 0;
    
    // Delete NPC kills
    const killsResult = await db.delete(npcKills).where(inArray(npcKills.playerId, characterIds));
    deletedCounts.npcKills = (killsResult as unknown as { rowCount?: number }).rowCount || 0;
  }
  
  // Delete all characters
  if (characterIds.length > 0) {
    await db.delete(characters).where(eq(characters.accountId, userId));
    deletedCounts.characters = characterIds.length;
  }
  
  // Finally delete the user
  await db.delete(users).where(eq(users.id, userId));
  deletedCounts.users = 1;
  
  console.log(`[Admin] Deleted user ${userId} with cascading data:`, deletedCounts);
  
  return { success: true, deletedCounts };
}

/**
 * Update user roles
 */
export async function updateUserRoles(userId: string, roles: string) {
  const db = getDatabase();
  
  await db
    .update(users)
    .set({ roles })
    .where(eq(users.id, userId));
  
  return { success: true };
}

/**
 * Get user count statistics
 */
export async function getUserStats() {
  const db = getDatabase();
  
  const [totalUsers, totalCharacters, activeSessions] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(characters),
    db.select({ count: count() })
      .from(playerSessions)
      .where(sql`"sessionEnd" IS NULL`),
  ]);
  
  return {
    totalUsers: totalUsers[0]?.count || 0,
    totalCharacters: totalCharacters[0]?.count || 0,
    activeSessions: activeSessions[0]?.count || 0,
  };
}
