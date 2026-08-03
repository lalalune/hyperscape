/**
 * Trade Panel Utilities
 *
 * Utility functions for formatting and parsing in the trade panel.
 */

// ============================================================================
// Quantity Formatting
// ============================================================================

/**
 * Format quantity for classic MMORPG-style display
 * Shows K/M suffixes for large numbers with appropriate colors
 */
export function formatQuantity(qty: number): { text: string; color: string } {
  if (qty < 100000) {
    return { text: qty.toLocaleString(), color: "rgba(255, 255, 255, 0.95)" };
  } else if (qty < 10000000) {
    const k = Math.floor(qty / 1000);
    return { text: `${k}K`, color: "rgba(0, 255, 128, 0.95)" };
  } else {
    const m = Math.floor(qty / 1000000);
    return { text: `${m}M`, color: "rgba(0, 255, 128, 0.95)" };
  }
}

// ============================================================================
// Gold Value Formatting
// ============================================================================

/**
 * Format gold value for wealth indicator display (classic MMORPG-style)
 * Shows K/M/B suffixes with decimal places
 */
export function formatGoldValue(value: number): string {
  if (value < 1000) {
    return value.toLocaleString();
  } else if (value < 1000000) {
    const k = Math.floor(value / 1000);
    const remainder = Math.floor((value % 1000) / 100);
    return remainder > 0 ? `${k}.${remainder}K` : `${k}K`;
  } else if (value < 1000000000) {
    const m = Math.floor(value / 1000000);
    const remainder = Math.floor((value % 1000000) / 100000);
    return remainder > 0 ? `${m}.${remainder}M` : `${m}M`;
  } else {
    const b = Math.floor(value / 1000000000);
    return `${b}B`;
  }
}

/**
 * Get color for wealth difference indicator
 * Green = gaining value, Red = losing value, White = neutral
 */
export function getWealthDifferenceColor(
  myValue: number,
  theirValue: number,
): string {
  const diff = theirValue - myValue;
  if (diff > 0) return "#22c55e"; // Green - gaining
  if (diff < 0) return "#ef4444"; // Red - losing
  return "#ffffff"; // White - equal
}

// ============================================================================
// Input Parsing
// ============================================================================

/**
 * Parse quantity input with K/M notation
 * Examples: "10k" -> 10000, "1.5m" -> 1500000, "500" -> 500
 */
export function parseQuantityInput(input: string): number {
  const normalized = input.toLowerCase().trim();
  const match = normalized.match(/^(\d+\.?\d*)(k|m)?$/);
  if (!match) return 0;

  let value = parseFloat(match[1]);
  if (match[2] === "k") value *= 1000;
  if (match[2] === "m") value *= 1000000;
  return Math.floor(value);
}
