/**
 * Wallet Provider - React Context for HD Wallet Hierarchy
 * Implements ADR-0008: Privy HD Wallet Integration
 *
 * Provides wallet state and operations to components via React Context
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useWallets } from '@privy-io/react-auth'
import { useCreateWallet } from '@privy-io/react-auth'
import type { ConnectedWallet } from '@privy-io/react-auth'
import { walletManager, type WalletHierarchyState } from '../WalletManager'

/**
 * Wallet context value
 * Provides wallet state and operations to consuming components
 */
interface WalletContextValue {
  /** Current wallet hierarchy state */
  state: WalletHierarchyState

  /** Create a character Ethereum wallet (HD Index 1) */
  createCharacterEthWallet: () => Promise<ConnectedWallet | null>

  /** Create a character Solana wallet (HD Index 1) */
  createCharacterSolWallet: () => Promise<ConnectedWallet | null>

  /** Whether wallet creation is in progress */
  isCreating: boolean

  /** Error message if wallet creation fails */
  error: string | null
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

/**
 * Wallet Provider Props
 */
interface WalletProviderProps {
  children: ReactNode
}

/**
 * Wallet Provider Component
 *
 * Manages Privy HD wallet hierarchy and provides wallet state to child components.
 * Must be rendered inside PrivyAuthProvider.
 *
 * @example
 * ```tsx
 * <PrivyAuthProvider>
 *   <WalletProvider>
 *     <App />
 *   </WalletProvider>
 * </PrivyAuthProvider>
 * ```
 */
export function WalletProvider({ children }: WalletProviderProps) {
  const { wallets, ready } = useWallets()
  const { createWallet: createEthWallet } = useCreateWallet()
  const [state, setState] = useState<WalletHierarchyState>(walletManager.getState())
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize wallet manager when wallets are ready
  useEffect(() => {
    if (ready && wallets && wallets.length > 0) {
      walletManager.initializeWallets(wallets)
    }
  }, [ready, wallets])

  // Subscribe to wallet manager state changes
  useEffect(() => {
    const unsubscribe = walletManager.subscribe((newState) => {
      setState(newState)
    })

    // Initialize state immediately
    setState(walletManager.getState())

    return unsubscribe
  }, [])

  /**
   * Create character Ethereum wallet (HD Index 1)
   *
   * Creates an additional embedded Ethereum wallet for the character.
   * This wallet is funded by the main account wallet (HD Index 0).
   */
  const createCharacterEthWallet = async (): Promise<ConnectedWallet | null> => {
    // Check if character wallet already exists
    if (walletManager.hasCharacterWallet('ethereum')) {
      console.warn('[WalletProvider] Character Ethereum wallet already exists')
      return walletManager.getCharacterWallet('ethereum')
    }

    setIsCreating(true)
    setError(null)

    try {
      // Create additional wallet (HD Index 1)
      const wallet = await createEthWallet({
        createAdditional: true, // Create HD Index 1
      })

      if (!wallet) {
        throw new Error('Failed to create character wallet')
      }

      // Register with wallet manager
      walletManager.registerCharacterWallet(wallet, 'ethereum')

      console.log('[WalletProvider] Character Ethereum wallet created:', wallet.address)
      return wallet
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[WalletProvider] Failed to create character Ethereum wallet:', err)
      setError(errorMessage)
      return null
    } finally {
      setIsCreating(false)
    }
  }

  /**
   * Create character Solana wallet (HD Index 1)
   *
   * NOTE: Solana wallet creation requires @privy-io/react-auth/solana
   * This is a placeholder - implement when Solana support is needed
   */
  const createCharacterSolWallet = async (): Promise<ConnectedWallet | null> => {
    console.warn('[WalletProvider] Solana character wallet creation not yet implemented')
    console.warn('[WalletProvider] Install @privy-io/react-auth/solana and update this method')

    // TODO: Implement Solana wallet creation
    // import { useCreateWallet as useCreateSolanaWallet } from '@privy-io/react-auth/solana'
    // const { createWallet: createSolWallet } = useCreateSolanaWallet()
    // const wallet = await createSolWallet({ createAdditional: true })

    setError('Solana wallet creation not yet implemented')
    return null
  }

  const value: WalletContextValue = {
    state,
    createCharacterEthWallet,
    createCharacterSolWallet,
    isCreating,
    error,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

/**
 * Use Wallet Hook
 *
 * Access wallet hierarchy state and operations from any component
 *
 * @throws Error if used outside WalletProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, createCharacterEthWallet } = useWallet()
 *
 *   const handleCreateWallet = async () => {
 *     const wallet = await createCharacterEthWallet()
 *     if (wallet) {
 *       console.log('Character wallet created:', wallet.address)
 *     }
 *   }
 *
 *   return (
 *     <div>
 *       <p>Main ETH Wallet: {state.mainEthWallet?.address}</p>
 *       <p>Character ETH Wallet: {state.characterEthWallet?.address}</p>
 *       <button onClick={handleCreateWallet}>Create Character Wallet</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}
