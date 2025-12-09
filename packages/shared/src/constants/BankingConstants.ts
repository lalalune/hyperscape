/**
 * Banking system constants
 */

export const BANKING_CONSTANTS = {
  // Bank sizes
  MAX_BANK_SLOTS: 480, // 12 tabs * 40 slots per tab
  SLOTS_PER_TAB: 40,
  MAX_TABS: 12,

  // Default bank configuration
  DEFAULT_TABS: 1,
  DEFAULT_SLOTS: 40,

  // UI Settings
  ITEMS_PER_ROW: 8,

  // Transaction limits
  MAX_ITEM_STACK: 2147483647, // Max int32
  MIN_ITEM_QUANTITY: 1,

  // Error messages
  ERRORS: {
    BANK_FULL: "Bank is full",
    INVALID_QUANTITY: "Invalid quantity",
    ITEM_NOT_FOUND: "Item not found",
    INSUFFICIENT_QUANTITY: "Insufficient quantity in bank",
    INVALID_SLOT: "Invalid slot number",
    NO_BANK_DATA: "No bank data found",
    BANK_NOT_OPEN: "Bank is not open",
    // Coin-specific errors
    INSUFFICIENT_POUCH_COINS: "Not enough coins in money pouch",
    INSUFFICIENT_BANK_COINS: "Not enough coins in bank",
    COIN_OVERFLOW: "Cannot carry that many coins",
  },

  // Success messages
  MESSAGES: {
    ITEM_DEPOSITED: "Item deposited successfully",
    ITEM_WITHDRAWN: "Item withdrawn successfully",
    BANK_OPENED: "Bank opened",
    BANK_CLOSED: "Bank closed",
    // Coin-specific messages
    COINS_DEPOSITED: "Coins deposited to bank",
    COINS_WITHDRAWN: "Coins withdrawn from bank",
  },
} as const;

export type BankingError =
  (typeof BANKING_CONSTANTS.ERRORS)[keyof typeof BANKING_CONSTANTS.ERRORS];
export type BankingMessage =
  (typeof BANKING_CONSTANTS.MESSAGES)[keyof typeof BANKING_CONSTANTS.MESSAGES];
