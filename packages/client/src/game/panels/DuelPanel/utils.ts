/**
 * Duel Panel Formatting Utilities
 *
 * Shared formatting functions used across StakesScreen, ConfirmScreen,
 * and DuelResultModal.
 */

/**
 * Format item quantity with K/M suffixes for compact display
 */
export function formatQuantity(quantity: number): string {
  if (quantity >= 10_000_000) {
    return `${Math.floor(quantity / 1_000_000)}M`;
  } else if (quantity >= 100_000) {
    return `${Math.floor(quantity / 1_000)}K`;
  }
  return quantity.toString();
}

/**
 * Calculate total value of staked items
 */
export function calculateTotalValue(
  stakes: ReadonlyArray<{ value: number }>,
): number {
  return stakes.reduce((sum, item) => sum + item.value, 0);
}
