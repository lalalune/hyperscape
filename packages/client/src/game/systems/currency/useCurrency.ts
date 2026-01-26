/**
 * Currency State Hook
 *
 * Provides currency state management with history tracking,
 * animated value changes, and gain/loss indicators.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { create } from "zustand";
import { generateTransactionId } from "@hyperscape/shared";
import {
  type CurrencyType,
  type CurrencyDefinition,
  type ChangeIndicator,
  DEFAULT_CURRENCIES,
  formatCurrency,
  validateAmount,
  getChangeIndicator,
  getChangeColor,
} from "./currencyUtils";

/** Currency transaction record */
export interface CurrencyTransaction {
  /** Unique transaction ID */
  id: string;
  /** Currency type */
  type: CurrencyType;
  /** Amount changed (positive for gain, negative for loss) */
  amount: number;
  /** Balance after transaction */
  balanceAfter: number;
  /** Timestamp */
  timestamp: number;
  /** Optional description */
  description?: string;
}

/** Currency balance state */
export interface CurrencyBalance {
  /** Currency type */
  type: CurrencyType;
  /** Current amount */
  amount: number;
  /** Previous amount (for animation) */
  previousAmount: number;
  /** Last change delta */
  lastChange: number;
  /** Last change timestamp */
  lastChangeTime: number;
}

/** Currency store state */
interface CurrencyStoreState {
  /** All currency balances */
  balances: Map<CurrencyType, CurrencyBalance>;
  /** Transaction history */
  history: CurrencyTransaction[];
  /** Maximum history entries to keep */
  maxHistorySize: number;

  /** Get balance for a currency type */
  getBalance: (type: CurrencyType) => CurrencyBalance;
  /** Set balance for a currency type */
  setBalance: (
    type: CurrencyType,
    amount: number,
    description?: string,
  ) => void;
  /** Add to balance */
  addBalance: (
    type: CurrencyType,
    amount: number,
    description?: string,
  ) => void;
  /** Subtract from balance */
  subtractBalance: (
    type: CurrencyType,
    amount: number,
    description?: string,
  ) => boolean;
  /** Transfer between currencies */
  transfer: (
    fromType: CurrencyType,
    toType: CurrencyType,
    amount: number,
    description?: string,
  ) => boolean;
  /** Clear history */
  clearHistory: () => void;
  /** Set max history size */
  setMaxHistorySize: (size: number) => void;
  /** Reset all balances */
  reset: () => void;
}

/** Create initial balance */
function createInitialBalance(type: CurrencyType): CurrencyBalance {
  return {
    type,
    amount: 0,
    previousAmount: 0,
    lastChange: 0,
    lastChangeTime: 0,
  };
}

// Transaction ID generation is now imported from @hyperscape/shared

/**
 * Zustand store for currency management
 */
export const useCurrencyStore = create<CurrencyStoreState>((set, get) => ({
  balances: new Map(),
  history: [],
  maxHistorySize: 100,

  getBalance: (type: CurrencyType) => {
    const state = get();
    return state.balances.get(type) || createInitialBalance(type);
  },

  setBalance: (type: CurrencyType, amount: number, description?: string) => {
    set((state) => {
      const balances = new Map(state.balances);
      const existing = balances.get(type) || createInitialBalance(type);
      const delta = amount - existing.amount;

      const newBalance: CurrencyBalance = {
        type,
        amount,
        previousAmount: existing.amount,
        lastChange: delta,
        lastChangeTime: Date.now(),
      };

      balances.set(type, newBalance);

      // Add to history
      const transaction: CurrencyTransaction = {
        id: generateTransactionId(),
        type,
        amount: delta,
        balanceAfter: amount,
        timestamp: Date.now(),
        description,
      };

      const history = [transaction, ...state.history].slice(
        0,
        state.maxHistorySize,
      );

      return { balances, history };
    });
  },

  addBalance: (type: CurrencyType, amount: number, description?: string) => {
    const current = get().getBalance(type);
    get().setBalance(
      type,
      current.amount + amount,
      description || `Received ${amount}`,
    );
  },

  subtractBalance: (
    type: CurrencyType,
    amount: number,
    description?: string,
  ) => {
    const current = get().getBalance(type);

    if (current.amount < amount) {
      return false; // Insufficient funds
    }

    get().setBalance(
      type,
      current.amount - amount,
      description || `Spent ${amount}`,
    );
    return true;
  },

  transfer: (
    fromType: CurrencyType,
    toType: CurrencyType,
    amount: number,
    description?: string,
  ) => {
    const from = get().getBalance(fromType);

    if (from.amount < amount) {
      return false;
    }

    // Perform the transfer
    get().setBalance(
      fromType,
      from.amount - amount,
      description || `Transferred ${amount} to ${toType}`,
    );

    const to = get().getBalance(toType);
    get().setBalance(
      toType,
      to.amount + amount,
      description || `Received ${amount} from ${fromType}`,
    );

    return true;
  },

  clearHistory: () => {
    set({ history: [] });
  },

  setMaxHistorySize: (size: number) => {
    set((state) => ({
      maxHistorySize: size,
      history: state.history.slice(0, size),
    }));
  },

  reset: () => {
    set({
      balances: new Map(),
      history: [],
    });
  },
}));

/** Options for useCurrency hook */
export interface UseCurrencyOptions {
  /** Enable animated value transitions */
  animated?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Currency definitions to use */
  currencies?: Record<CurrencyType, CurrencyDefinition>;
  /** Show change indicator duration (ms) */
  changeIndicatorDuration?: number;
}

/** Return value from useCurrency hook */
export interface UseCurrencyResult {
  /** Current balance */
  balance: CurrencyBalance;
  /** Currency definition */
  currency: CurrencyDefinition;
  /** Formatted current value */
  formatted: string;
  /** Formatted compact value */
  formattedCompact: string;
  /** Whether balance is animating */
  isAnimating: boolean;
  /** Current animated value (for smooth transitions) */
  animatedValue: number;
  /** Last change amount */
  lastChange: number;
  /** Change indicator type */
  changeIndicator: ChangeIndicator;
  /** Change indicator color */
  changeColor: string;
  /** Whether change indicator is visible */
  showingChange: boolean;
  /** Whether funds are insufficient for a given amount */
  isInsufficientFor: (amount: number) => boolean;

  // Actions
  /** Set balance to a specific amount */
  setBalance: (amount: number, description?: string) => void;
  /** Add to balance */
  add: (amount: number, description?: string) => void;
  /** Subtract from balance */
  subtract: (amount: number, description?: string) => boolean;
  /** Validate an amount */
  validate: (amount: number) => { valid: boolean; error?: string };
}

/**
 * Hook for managing a single currency type
 *
 * @example
 * ```tsx
 * function GoldDisplay() {
 *   const {
 *     formattedCompact,
 *     lastChange,
 *     showingChange,
 *     changeIndicator,
 *     changeColor,
 *     add,
 *     subtract,
 *   } = useCurrency('gold');
 *
 *   return (
 *     <div>
 *       <span>{formattedCompact}</span>
 *       {showingChange && (
 *         <span style={{ color: changeColor }}>
 *           {lastChange > 0 ? '+' : ''}{lastChange}
 *         </span>
 *       )}
 *       <button onClick={() => add(100)}>+100</button>
 *       <button onClick={() => subtract(50)}>-50</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCurrency(
  type: CurrencyType,
  options: UseCurrencyOptions = {},
): UseCurrencyResult {
  const {
    animated = true,
    animationDuration = 500,
    currencies = DEFAULT_CURRENCIES,
    changeIndicatorDuration = 2000,
  } = options;

  // Select the balances Map and extract the specific balance
  const balanceMap = useCurrencyStore((s) => s.balances);
  const storedBalance = balanceMap.get(type);

  // Memoize the balance to avoid creating new objects each render
  const balance = useMemo((): CurrencyBalance => {
    if (storedBalance) {
      return storedBalance;
    }
    return {
      type,
      amount: 0,
      previousAmount: 0,
      lastChange: 0,
      lastChangeTime: 0,
    };
  }, [storedBalance, type]);

  const storeSetBalance = useCurrencyStore((s) => s.setBalance);
  const storeAddBalance = useCurrencyStore((s) => s.addBalance);
  const storeSubtractBalance = useCurrencyStore((s) => s.subtractBalance);

  const currency = currencies[type];

  // Animation state
  const [animatedValue, setAnimatedValue] = useState(balance.amount);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Change indicator state
  const [showingChange, setShowingChange] = useState(false);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate value changes
  useEffect(() => {
    if (!animated || balance.amount === animatedValue) {
      setAnimatedValue(balance.amount);
      return;
    }

    setIsAnimating(true);
    const startValue = animatedValue;
    const endValue = balance.amount;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * eased);

      setAnimatedValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        setAnimatedValue(endValue);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [balance.amount, animated, animationDuration]);

  // Show change indicator
  useEffect(() => {
    if (balance.lastChange !== 0 && balance.lastChangeTime > 0) {
      setShowingChange(true);

      if (changeTimerRef.current) {
        clearTimeout(changeTimerRef.current);
      }

      changeTimerRef.current = setTimeout(() => {
        setShowingChange(false);
      }, changeIndicatorDuration);
    }

    return () => {
      if (changeTimerRef.current) {
        clearTimeout(changeTimerRef.current);
      }
    };
  }, [balance.lastChange, balance.lastChangeTime, changeIndicatorDuration]);

  // Formatted values
  const formatted = useMemo(
    () => formatCurrency(balance.amount, type, { compact: false }).full,
    [balance.amount, type],
  );

  const formattedCompact = useMemo(
    () => formatCurrency(balance.amount, type, { compact: true }).full,
    [balance.amount, type],
  );

  // Change indicator
  const changeIndicator = useMemo(
    () => getChangeIndicator(balance.lastChange),
    [balance.lastChange],
  );

  const changeColor = useMemo(
    () => getChangeColor(changeIndicator),
    [changeIndicator],
  );

  // Actions
  const setBalance = useCallback(
    (amount: number, description?: string) => {
      storeSetBalance(type, amount, description);
    },
    [type, storeSetBalance],
  );

  const add = useCallback(
    (amount: number, description?: string) => {
      storeAddBalance(type, amount, description);
    },
    [type, storeAddBalance],
  );

  const subtract = useCallback(
    (amount: number, description?: string) => {
      return storeSubtractBalance(type, amount, description);
    },
    [type, storeSubtractBalance],
  );

  const validate = useCallback(
    (amount: number) => {
      return validateAmount(amount, type, balance.amount);
    },
    [type, balance.amount],
  );

  const isInsufficientFor = useCallback(
    (amount: number) => {
      return balance.amount < amount;
    },
    [balance.amount],
  );

  return {
    balance,
    currency,
    formatted,
    formattedCompact,
    isAnimating,
    animatedValue,
    lastChange: balance.lastChange,
    changeIndicator,
    changeColor,
    showingChange,
    isInsufficientFor,
    setBalance,
    add,
    subtract,
    validate,
  };
}

/** Return value from useCurrencies hook */
export interface UseCurrenciesResult {
  /** All currency balances */
  balances: CurrencyBalance[];
  /** Transaction history */
  history: CurrencyTransaction[];
  /** Get balance for a type */
  getBalance: (type: CurrencyType) => CurrencyBalance;
  /** Get formatted balance for a type */
  getFormattedBalance: (type: CurrencyType, compact?: boolean) => string;
  /** Set balance for a type */
  setBalance: (
    type: CurrencyType,
    amount: number,
    description?: string,
  ) => void;
  /** Transfer between currencies */
  transfer: (
    fromType: CurrencyType,
    toType: CurrencyType,
    amount: number,
    description?: string,
  ) => boolean;
  /** Clear all history */
  clearHistory: () => void;
  /** Reset all balances */
  reset: () => void;
  /** Total value in gold */
  totalValueInGold: number;
}

/**
 * Hook for managing all currencies
 *
 * @example
 * ```tsx
 * function CurrencyOverview() {
 *   const { balances, totalValueInGold, history } = useCurrencies();
 *
 *   return (
 *     <div>
 *       <div>Total Value: {totalValueInGold}g</div>
 *       {balances.map(b => (
 *         <div key={b.type}>{b.type}: {b.amount}</div>
 *       ))}
 *       <h3>Recent Transactions</h3>
 *       {history.slice(0, 5).map(tx => (
 *         <div key={tx.id}>{tx.description}: {tx.amount}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCurrencies(): UseCurrenciesResult {
  const balanceMap = useCurrencyStore((s) => s.balances);
  const history = useCurrencyStore((s) => s.history);
  const storeGetBalance = useCurrencyStore((s) => s.getBalance);
  const storeSetBalance = useCurrencyStore((s) => s.setBalance);
  const storeTransfer = useCurrencyStore((s) => s.transfer);
  const storeClearHistory = useCurrencyStore((s) => s.clearHistory);
  const storeReset = useCurrencyStore((s) => s.reset);

  const balances = useMemo(() => Array.from(balanceMap.values()), [balanceMap]);

  const getFormattedBalance = useCallback(
    (type: CurrencyType, compact: boolean = true) => {
      const balance = storeGetBalance(type);
      return formatCurrency(balance.amount, type, { compact }).full;
    },
    [storeGetBalance],
  );

  const totalValueInGold = useMemo(() => {
    let total = 0;
    for (const balance of balances) {
      const currency = DEFAULT_CURRENCIES[balance.type];
      total += balance.amount * currency.conversionRate;
    }
    return Math.floor(total);
  }, [balances]);

  return {
    balances,
    history,
    getBalance: storeGetBalance,
    getFormattedBalance,
    setBalance: storeSetBalance,
    transfer: storeTransfer,
    clearHistory: storeClearHistory,
    reset: storeReset,
    totalValueInGold,
  };
}
