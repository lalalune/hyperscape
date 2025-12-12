/**
 * Operation Result Types
 *
 * Provides explicit result types for operations that can fail.
 * Replaces silent failures with structured results.
 *
 * @example
 * function addItem(data: ItemData): OperationResult<Item> {
 *   if (!data.id) {
 *     return Result.failure("Item ID is required", InventoryErrorCode.INVALID_INPUT);
 *   }
 *   const item = createItem(data);
 *   return Result.success(item);
 * }
 *
 * const result = addItem({ id: "sword" });
 * if (!result.success) {
 *   console.log(`Failed: ${result.error} (${result.errorCode})`);
 * }
 */

/**
 * Result of an operation that can succeed or fail.
 * Use for operations where the caller needs to know if it succeeded.
 *
 * @typeParam T - The data type returned on success
 */
export interface OperationResult<T = void> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable error message (only on failure) */
  error?: string;
  /** Machine-readable error code (only on failure) */
  errorCode?: string;
  /** Result data (only on success, if T is not void) */
  data?: T;
}

/**
 * Factory functions for creating OperationResult instances
 */
export const Result = {
  /**
   * Create a successful result
   * @param data - Optional data to return
   */
  success<T = void>(data?: T): OperationResult<T> {
    return { success: true, data };
  },

  /**
   * Create a failure result
   * @param error - Human-readable error message
   * @param errorCode - Machine-readable error code
   */
  failure<T = void>(error: string, errorCode?: string): OperationResult<T> {
    return { success: false, error, errorCode };
  },
};

/**
 * Error codes for inventory operations
 */
export const InventoryErrorCode = {
  /** Player not found or not initialized */
  PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
  /** Item not found in inventory or database */
  ITEM_NOT_FOUND: "ITEM_NOT_FOUND",
  /** Inventory is full, cannot add item */
  INVENTORY_FULL: "INVENTORY_FULL",
  /** Insufficient quantity in inventory */
  INSUFFICIENT_QUANTITY: "INSUFFICIENT_QUANTITY",
  /** Invalid slot index */
  INVALID_SLOT: "INVALID_SLOT",
  /** Invalid input data */
  INVALID_INPUT: "INVALID_INPUT",
} as const;

export type InventoryErrorCodeType =
  (typeof InventoryErrorCode)[keyof typeof InventoryErrorCode];

/**
 * Error codes for equipment operations
 */
export const EquipmentErrorCode = {
  /** Player not found or not initialized */
  PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
  /** Item not found in inventory or database */
  ITEM_NOT_FOUND: "ITEM_NOT_FOUND",
  /** Level requirement not met */
  INSUFFICIENT_LEVEL: "INSUFFICIENT_LEVEL",
  /** Item cannot be equipped in the requested slot */
  INVALID_SLOT: "INVALID_SLOT",
  /** Cannot equip shield while 2h weapon equipped */
  TWO_HAND_CONFLICT: "TWO_HAND_CONFLICT",
  /** Item is already equipped */
  ALREADY_EQUIPPED: "ALREADY_EQUIPPED",
  /** Item cannot be equipped (wrong type) */
  NOT_EQUIPPABLE: "NOT_EQUIPPABLE",
  /** Inventory is full, cannot unequip */
  INVENTORY_FULL: "INVENTORY_FULL",
  /** Slot is empty */
  SLOT_EMPTY: "SLOT_EMPTY",
} as const;

export type EquipmentErrorCodeType =
  (typeof EquipmentErrorCode)[keyof typeof EquipmentErrorCode];

/**
 * Error codes for coin/currency operations
 */
export const CoinErrorCode = {
  /** Player not found or not initialized */
  PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
  /** Insufficient funds for operation */
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  /** Invalid amount (negative or zero) */
  INVALID_AMOUNT: "INVALID_AMOUNT",
  /** Would exceed maximum coin limit */
  OVERFLOW: "OVERFLOW",
} as const;

export type CoinErrorCodeType =
  (typeof CoinErrorCode)[keyof typeof CoinErrorCode];

/**
 * Combined error codes for all inventory/equipment operations
 */
export const OperationErrorCode = {
  ...InventoryErrorCode,
  ...EquipmentErrorCode,
  ...CoinErrorCode,
} as const;

export type OperationErrorCodeType =
  (typeof OperationErrorCode)[keyof typeof OperationErrorCode];
