/**
 * Wallet Manager - Hierarchical HD Wallet Management
 * Implements ADR-0008: Privy HD Wallet Architecture
 *
 * Main Account Wallet (HD Index 0)
 *   ↓ (funds)
 * Character Wallet 1 (HD Index 1)
 * Character Wallet 2 (HD Index 2) [Future]
 */

import type { ConnectedWallet } from '@privy-io/react-auth'

/**
 * Wallet hierarchy state
 * Tracks main account and character wallets separately
 */
export interface WalletHierarchyState {
  /** Main account Ethereum wallet (HD Index 0) */
  mainEthWallet: ConnectedWallet | null

  /** Main account Solana wallet (HD Index 0) */
  mainSolWallet: ConnectedWallet | null

  /** Character Ethereum wallet (HD Index 1) */
  characterEthWallet: ConnectedWallet | null

  /** Character Solana wallet (HD Index 1) */
  characterSolWallet: ConnectedWallet | null

  /** All connected wallets (embedded + external) */
  allWallets: ConnectedWallet[]

  /** Whether wallets have been initialized */
  isInitialized: boolean
}

/**
 * WalletManager - Manages Privy HD wallet hierarchy
 *
 * Implements the two-tier wallet system from ADR-0008:
 * - Main Account Wallets (HD Index 0): Funding source from exchanges/external wallets
 * - Character Wallets (HD Index 1+): In-game transaction wallets
 *
 * @remarks
 * This is a singleton that manages wallet state separately from authentication.
 * It integrates with Privy's embedded HD wallets.
 *
 * @public
 */
export class WalletManager {
  private static instance: WalletManager
  private state: WalletHierarchyState = {
    mainEthWallet: null,
    mainSolWallet: null,
    characterEthWallet: null,
    characterSolWallet: null,
    allWallets: [],
    isInitialized: false,
  }

  private listeners: Set<(state: WalletHierarchyState) => void> = new Set()

  private constructor() {}

  /**
   * Gets the singleton instance of WalletManager
   */
  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager()
    }
    return WalletManager.instance
  }

  /**
   * Initialize wallet hierarchy from Privy wallets
   *
   * Categorizes wallets into:
   * - Main account wallets (HD Index 0)
   * - Character wallets (HD Index 1)
   * - External wallets (MetaMask, Coinbase, etc.)
   *
   * @param wallets - All connected wallets from useWallets() hook
   */
  initializeWallets(wallets: ConnectedWallet[]): void {
    // Find main account wallets (HD Index 0, embedded)
    const mainEthWallet = wallets.find(
      w => w.walletClientType === 'privy' &&
           w.chainType === 'ethereum' &&
           w.walletIndex === 0
    ) || null

    const mainSolWallet = wallets.find(
      w => w.walletClientType === 'privy' &&
           w.chainType === 'solana' &&
           w.walletIndex === 0
    ) || null

    // Find character wallets (HD Index 1, embedded)
    const characterEthWallet = wallets.find(
      w => w.walletClientType === 'privy' &&
           w.chainType === 'ethereum' &&
           w.walletIndex === 1
    ) || null

    const characterSolWallet = wallets.find(
      w => w.walletClientType === 'privy' &&
           w.chainType === 'solana' &&
           w.walletIndex === 1
    ) || null

    this.updateState({
      mainEthWallet,
      mainSolWallet,
      characterEthWallet,
      characterSolWallet,
      allWallets: wallets,
      isInitialized: true,
    })
  }

  /**
   * Register a new character wallet after creation
   *
   * Called after using createWallet() to create a character wallet
   *
   * @param wallet - The newly created wallet
   * @param chainType - 'ethereum' or 'solana'
   */
  registerCharacterWallet(wallet: ConnectedWallet, chainType: 'ethereum' | 'solana'): void {
    if (chainType === 'ethereum') {
      this.updateState({ characterEthWallet: wallet })
    } else if (chainType === 'solana') {
      this.updateState({ characterSolWallet: wallet })
    }
  }

  /**
   * Get the main account wallet for a specific chain
   *
   * @param chainType - 'ethereum' or 'solana'
   * @returns The main account wallet or null
   */
  getMainWallet(chainType: 'ethereum' | 'solana'): ConnectedWallet | null {
    return chainType === 'ethereum' ? this.state.mainEthWallet : this.state.mainSolWallet
  }

  /**
   * Get the character wallet for a specific chain
   *
   * @param chainType - 'ethereum' or 'solana'
   * @returns The character wallet or null
   */
  getCharacterWallet(chainType: 'ethereum' | 'solana'): ConnectedWallet | null {
    return chainType === 'ethereum' ? this.state.characterEthWallet : this.state.characterSolWallet
  }

  /**
   * Get all external wallets (MetaMask, Coinbase, etc.)
   *
   * @returns Array of external wallets
   */
  getExternalWallets(): ConnectedWallet[] {
    return this.state.allWallets.filter(w => w.walletClientType !== 'privy')
  }

  /**
   * Check if user has character wallet for a chain
   *
   * @param chainType - 'ethereum' or 'solana'
   * @returns true if character wallet exists
   */
  hasCharacterWallet(chainType: 'ethereum' | 'solana'): boolean {
    return this.getCharacterWallet(chainType) !== null
  }

  /**
   * Check if user has main account wallet for a chain
   *
   * @param chainType - 'ethereum' or 'solana'
   * @returns true if main account wallet exists
   */
  hasMainWallet(chainType: 'ethereum' | 'solana'): boolean {
    return this.getMainWallet(chainType) !== null
  }

  /**
   * Get the current wallet hierarchy state
   */
  getState(): WalletHierarchyState {
    return { ...this.state }
  }

  /**
   * Clear all wallet state
   *
   * Called on logout
   */
  clearWallets(): void {
    this.updateState({
      mainEthWallet: null,
      mainSolWallet: null,
      characterEthWallet: null,
      characterSolWallet: null,
      allWallets: [],
      isInitialized: false,
    })
  }

  /**
   * Subscribe to wallet state changes
   *
   * @param listener - Callback function that receives the new state
   * @returns Unsubscribe function
   */
  subscribe(listener: (state: WalletHierarchyState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Update wallet state and notify listeners
   */
  private updateState(updates: Partial<WalletHierarchyState>): void {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener(this.getState())
    })
  }
}

/**
 * Singleton instance of WalletManager
 *
 * Use this throughout the application for wallet hierarchy management.
 *
 * @public
 */
export const walletManager = WalletManager.getInstance()
