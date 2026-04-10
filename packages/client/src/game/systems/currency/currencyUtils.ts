/**
 * Currency Utilities
 *
 * Formatting, conversion, and validation utilities for currency display.
 *
 * @packageDocumentation
 */

import { MAX_COINS } from "@hyperscape/shared";

/** Currency type identifier */
export type CurrencyType = "gold" | "silver" | "copper" | "gems" | "tokens";

/** Currency definition */
export interface CurrencyDefinition {
  /** Unique identifier */
  type: CurrencyType;
  /** Display name */
  name: string;
  /** Short name (e.g., "g" for gold) */
  shortName: string;
  /** Color for display */
  color: string;
  /** Background color */
  backgroundColor: string;
  /** Icon (emoji or URL) */
  icon: string;
  /** Conversion rate to base currency (gold = 1) */
  conversionRate: number;
  /** Maximum value allowed */
  maxValue: number;
}

/** Default currency definitions */
export const DEFAULT_CURRENCIES: Record<CurrencyType, CurrencyDefinition> = {
  gold: {
    type: "gold",
    name: "Gold",
    shortName: "g",
    color: "#ffd700",
    backgroundColor: "#3d3224",
    icon: "coins",
    conversionRate: 1,
    maxValue: MAX_COINS, // Max int32
  },
  silver: {
    type: "silver",
    name: "Silver",
    shortName: "s",
    color: "#c0c0c0",
    backgroundColor: "#2a2a2a",
    icon: "coins",
    conversionRate: 0.01, // 100 silver = 1 gold
    maxValue: MAX_COINS,
  },
  copper: {
    type: "copper",
    name: "Copper",
    shortName: "c",
    color: "#b87333",
    backgroundColor: "#2d1a0d",
    icon: "coins",
    conversionRate: 0.0001, // 10000 copper = 1 gold
    maxValue: MAX_COINS,
  },
  gems: {
    type: "gems",
    name: "Gems",
    shortName: "gem",
    color: "#9b59b6",
    backgroundColor: "#1a0d2d",
    icon: "gem",
    conversionRate: 100, // 1 gem = 100 gold
    maxValue: 999999,
  },
  tokens: {
    type: "tokens",
    name: "Tokens",
    shortName: "tk",
    color: "#3498db",
    backgroundColor: "#0d1a2d",
    icon: "ticket",
    conversionRate: 10, // 1 token = 10 gold
    maxValue: 999999,
  },
};

/** Formatting options */
export interface FormatOptions {
  /** Use compact notation (1k, 1M, 1B) */
  compact?: boolean;
  /** Show currency suffix */
  showSuffix?: boolean;
  /** Decimal places for compact notation */
  decimals?: number;
  /** Include thousands separator */
  thousandsSeparator?: boolean;
  /** Custom separator character */
  separator?: string;
}

/** Formatted currency result */
export interface FormattedCurrency {
  /** The formatted value string */
  value: string;
  /** The suffix (k, M, B) if compact */
  suffix: string;
  /** The currency short name */
  currencySuffix: string;
  /** Full display string */
  full: string;
}

/**
 * Format a currency value with compact notation
 *
 * @example
 * ```ts
 * formatCurrency(1234, 'gold', { compact: true }) // { value: "1.2", suffix: "k", full: "1.2k g" }
 * formatCurrency(1500000, 'gold', { compact: true }) // { value: "1.5", suffix: "M", full: "1.5M g" }
 * ```
 */
export function formatCurrency(
  amount: number,
  type: CurrencyType = "gold",
  options: FormatOptions = {},
): FormattedCurrency {
  const {
    compact = true,
    showSuffix = true,
    decimals = 1,
    thousandsSeparator = true,
    separator = ",",
  } = options;

  const currency = DEFAULT_CURRENCIES[type];
  const currencySuffix = showSuffix ? currency.shortName : "";

  if (compact) {
    const { value, suffix } = compactNumber(amount, decimals);
    return {
      value,
      suffix,
      currencySuffix,
      full: `${value}${suffix}${currencySuffix ? " " + currencySuffix : ""}`,
    };
  }

  // Full number formatting
  let value = amount.toString();
  if (thousandsSeparator) {
    value = addThousandsSeparator(amount, separator);
  }

  return {
    value,
    suffix: "",
    currencySuffix,
    full: `${value}${currencySuffix ? " " + currencySuffix : ""}`,
  };
}

/**
 * Compact a number to k, M, B notation
 */
export function compactNumber(
  num: number,
  decimals: number = 1,
): { value: string; suffix: string } {
  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum >= 1_000_000_000) {
    return {
      value: sign + (absNum / 1_000_000_000).toFixed(decimals),
      suffix: "B",
    };
  }
  if (absNum >= 1_000_000) {
    return {
      value: sign + (absNum / 1_000_000).toFixed(decimals),
      suffix: "M",
    };
  }
  if (absNum >= 1_000) {
    return {
      value: sign + (absNum / 1_000).toFixed(decimals),
      suffix: "k",
    };
  }

  return {
    value: sign + absNum.toString(),
    suffix: "",
  };
}

/**
 * Add thousands separator to a number
 */
export function addThousandsSeparator(
  num: number,
  separator: string = ",",
): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Parse a currency string back to a number
 *
 * @example
 * ```ts
 * parseCurrency("1.5k") // 1500
 * parseCurrency("2.3M") // 2300000
 * parseCurrency("1,234,567") // 1234567
 * ```
 */
export function parseCurrency(value: string): number {
  // Remove any spaces and currency suffixes
  const cleaned = value.replace(/[gs,\s]/gi, "");

  // Check for compact notation
  const match = cleaned.match(/^(-?[\d.]+)([kKmMbB])?$/);
  if (!match) {
    return 0;
  }

  const [, numStr, suffix] = match;
  let num = parseFloat(numStr);

  if (isNaN(num)) {
    return 0;
  }

  // Apply multiplier based on suffix
  switch (suffix?.toLowerCase()) {
    case "k":
      num *= 1_000;
      break;
    case "m":
      num *= 1_000_000;
      break;
    case "b":
      num *= 1_000_000_000;
      break;
  }

  return Math.floor(num);
}

/**
 * Convert between currency types
 */
export function convertCurrency(
  amount: number,
  fromType: CurrencyType,
  toType: CurrencyType,
): number {
  const from = DEFAULT_CURRENCIES[fromType];
  const to = DEFAULT_CURRENCIES[toType];

  // Convert to gold (base), then to target
  const goldValue = amount * from.conversionRate;
  return Math.floor(goldValue / to.conversionRate);
}

/**
 * Validate a currency amount
 */
export function validateAmount(
  amount: number,
  type: CurrencyType = "gold",
  currentBalance?: number,
): {
  valid: boolean;
  error?: string;
} {
  const currency = DEFAULT_CURRENCIES[type];

  if (isNaN(amount)) {
    return { valid: false, error: "Invalid amount" };
  }

  if (amount < 0) {
    return { valid: false, error: "Amount cannot be negative" };
  }

  if (!Number.isInteger(amount)) {
    return { valid: false, error: "Amount must be a whole number" };
  }

  if (amount > currency.maxValue) {
    return {
      valid: false,
      error: `Amount exceeds maximum (${formatCurrency(currency.maxValue, type).full})`,
    };
  }

  if (currentBalance !== undefined && amount > currentBalance) {
    return { valid: false, error: "Insufficient funds" };
  }

  return { valid: true };
}

/**
 * Calculate gold/silver/copper breakdown
 *
 * @example
 * ```ts
 * calculateBreakdown(12345) // { gold: 1, silver: 23, copper: 45 }
 * ```
 */
export function calculateBreakdown(totalCopper: number): {
  gold: number;
  silver: number;
  copper: number;
} {
  const gold = Math.floor(totalCopper / 10000);
  const remainder = totalCopper % 10000;
  const silver = Math.floor(remainder / 100);
  const copper = remainder % 100;

  return { gold, silver, copper };
}

/**
 * Format a breakdown as a display string
 */
export function formatBreakdown(breakdown: {
  gold: number;
  silver: number;
  copper: number;
}): string {
  const parts: string[] = [];

  if (breakdown.gold > 0) {
    parts.push(`${breakdown.gold}g`);
  }
  if (breakdown.silver > 0) {
    parts.push(`${breakdown.silver}s`);
  }
  if (breakdown.copper > 0 || parts.length === 0) {
    parts.push(`${breakdown.copper}c`);
  }

  return parts.join(" ");
}

/**
 * Format gold value for OSRS-style wealth display (K/M/B suffixes).
 * Delegates to compactNumber to avoid duplicate formatting logic.
 */
export function formatGoldValue(value: number): string {
  if (value < 1000) return value.toLocaleString();
  const { value: v, suffix } = compactNumber(value);
  return `${v}${suffix}`;
}

/** Change indicator for value changes */
export type ChangeIndicator = "gain" | "loss" | "neutral";

/**
 * Determine the change indicator for a delta
 */
export function getChangeIndicator(delta: number): ChangeIndicator {
  if (delta > 0) return "gain";
  if (delta < 0) return "loss";
  return "neutral";
}

/**
 * Get color for change indicator
 */
export function getChangeColor(indicator: ChangeIndicator): string {
  switch (indicator) {
    case "gain":
      return "#5cb85c"; // Green
    case "loss":
      return "#d9534f"; // Red
    case "neutral":
    default:
      return "#b8a88a"; // Muted
  }
}

/**
 * Format a change delta with sign and color indicator
 */
export function formatChange(
  delta: number,
  type: CurrencyType = "gold",
  compact: boolean = true,
): {
  formatted: string;
  indicator: ChangeIndicator;
  color: string;
} {
  const indicator = getChangeIndicator(delta);
  const color = getChangeColor(indicator);
  const sign = delta > 0 ? "+" : "";
  const { full } = formatCurrency(Math.abs(delta), type, { compact });

  return {
    formatted: `${sign}${delta < 0 ? "-" : ""}${full}`,
    indicator,
    color,
  };
}
