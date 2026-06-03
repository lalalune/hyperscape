/**
 * Trade Handler Types
 *
 * Handler-specific types for trade packet handlers.
 * These are internal types used by the handler modules.
 */

import type { World } from "@hyperforge/shared";
import type { ServerSocket } from "../../../../shared/types";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type pg from "pg";
import type * as schema from "../../../../database/schema";

// ============================================================================
// Database Connection Type
// ============================================================================

/**
 * Database connection for handler operations
 */
export interface DatabaseConnection {
  drizzle: NodePgDatabase<typeof schema>;
  pool: pg.Pool;
}

// ============================================================================
// Handler Context Types
// ============================================================================

/**
 * Common handler context
 */
export interface TradeHandlerContext {
  socket: ServerSocket;
  world: World;
  playerId: string;
}

/**
 * Handler context with database
 */
export interface TradeHandlerContextWithDB extends TradeHandlerContext {
  db: DatabaseConnection;
}

// ============================================================================
// Inventory Row Types (for swap operations)
// ============================================================================

/**
 * Inventory row from database
 */
export interface InventoryDBRow {
  id: number;
  playerId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
  metadata: string | null;
}

// ============================================================================
// Trade Swap Result Types
// ============================================================================

/**
 * Result from executing a trade swap
 */
export interface TradeSwapResult {
  initiatorReceived: Array<{ itemId: string; quantity: number }>;
  recipientReceived: Array<{ itemId: string; quantity: number }>;
}
