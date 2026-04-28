/**
 * Currency System
 *
 * Provides currency state management, formatting, and UI components.
 *
 * @packageDocumentation
 */

// Utilities
export {
  type CurrencyType,
  type CurrencyDefinition,
  type FormatOptions,
  type FormattedCurrency,
  type ChangeIndicator,
  DEFAULT_CURRENCIES,
  formatCurrency,
  compactNumber,
  addThousandsSeparator,
  parseCurrency,
  convertCurrency,
  validateAmount,
  calculateBreakdown,
  formatBreakdown,
  getChangeIndicator,
  getChangeColor,
  formatChange,
  formatGoldValue,
} from "./currencyUtils";

// Hooks
export {
  type CurrencyTransaction,
  type CurrencyBalance,
  type UseCurrencyOptions,
  type UseCurrencyResult,
  type UseCurrenciesResult,
  useCurrencyStore,
  useCurrency,
  useCurrencies,
} from "./useCurrency";
