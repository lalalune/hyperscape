/**
 * useCharacterWalletCreation Hook
 *
 * Demonstrates integration of character wallet creation (ADR-0008)
 * into the character creation flow.
 *
 * Usage Example in CharacterSelectPage.tsx:
 *
 * ```typescript
 * import { useCharacterWalletCreation } from '../hooks/useCharacterWalletCreation'
 *
 * function CharacterSelectPage() {
 *   const { createCharacterWithWallet, isCreating } = useCharacterWalletCreation()
 *
 *   const handleCreateCharacter = async () => {
 *     const result = await createCharacterWithWallet(characterName)
 *     if (result.success) {
 *       console.log('Character created with wallet:', result.walletAddress)
 *     }
 *   }
 * }
 * ```
 */

import { useState } from 'react'
import { useWallet } from '../components/WalletProvider'

export interface CharacterWalletCreationResult {
  success: boolean
  walletAddress?: string
  error?: string
}

/**
 * Hook for coordinating character creation with wallet setup
 *
 * Implements the hierarchical wallet flow from ADR-0008:
 * 1. User has main account wallet (HD Index 0) - auto-created on login
 * 2. When creating first character, create character wallet (HD Index 1)
 * 3. Character wallet is funded by main account wallet
 */
export function useCharacterWalletCreation() {
  const { state, createCharacterEthWallet, isCreating: isCreatingWallet } = useWallet()
  const [isCreating, setIsCreating] = useState(false)

  /**
   * Create character with associated wallet
   *
   * This function should be called AFTER the server confirms character creation.
   * The character wallet is created on the client side using Privy.
   *
   * Flow:
   * 1. Server creates character in database
   * 2. Client receives characterCreated event
   * 3. Client creates character wallet (HD Index 1)
   * 4. (Optional) Client funds character wallet from main account wallet
   *
   * @param characterName - Name of the character (for logging)
   * @returns Result with wallet address or error
   */
  const createCharacterWallet = async (
    characterName: string
  ): Promise<CharacterWalletCreationResult> => {
    // Check if character wallet already exists
    if (state.characterEthWallet) {
      console.log('[CharacterWallet] Character wallet already exists:', state.characterEthWallet.address)
      return {
        success: true,
        walletAddress: state.characterEthWallet.address,
      }
    }

    // Check if main account wallet exists
    if (!state.mainEthWallet) {
      console.error('[CharacterWallet] Main account wallet not found. This should have been auto-created on login.')
      return {
        success: false,
        error: 'Main account wallet not found. Please log out and log back in.',
      }
    }

    setIsCreating(true)

    try {
      console.log(`[CharacterWallet] Creating wallet for character: ${characterName}`)
      console.log('[CharacterWallet] Main account wallet:', state.mainEthWallet.address)

      // Create character wallet (HD Index 1)
      const wallet = await createCharacterEthWallet()

      if (!wallet) {
        throw new Error('Failed to create character wallet')
      }

      console.log('[CharacterWallet] ✅ Character wallet created:', wallet.address)
      console.log('[CharacterWallet] Main wallet:', state.mainEthWallet.address)
      console.log('[CharacterWallet] Character wallet:', wallet.address)

      // TODO: Implement funding flow
      // Transfer initial funds from main account wallet to character wallet
      // This would require:
      // 1. Get wallet provider: await wallet.getEthereumProvider()
      // 2. Create viem/ethers client
      // 3. Send transaction from main → character wallet

      return {
        success: true,
        walletAddress: wallet.address,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[CharacterWallet] Failed to create character wallet:', error)
      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setIsCreating(false)
    }
  }

  /**
   * Create character with wallet (coordinated flow)
   *
   * NOTE: This is a demonstration. In the actual implementation, you would:
   * 1. Send character creation request to server (via WebSocket)
   * 2. Wait for server response (onCharacterCreated event)
   * 3. THEN call createCharacterWallet()
   *
   * This function shows the concept but would need integration with
   * the actual WebSocket flow in CharacterSelectPage.tsx
   */
  const createCharacterWithWallet = async (
    characterName: string
  ): Promise<CharacterWalletCreationResult> => {
    // Step 1: Create character on server (done via WebSocket in CharacterSelectPage)
    // ws.send(writePacket("characterCreate", { name: characterName }))

    // Step 2: Wait for server confirmation (done via message handler)
    // This would be triggered in the onCharacterCreated handler

    // Step 3: Create character wallet
    return await createCharacterWallet(characterName)
  }

  return {
    createCharacterWallet,
    createCharacterWithWallet,
    isCreating: isCreating || isCreatingWallet,
    walletState: state,
  }
}

/**
 * Integration Example for CharacterSelectPage.tsx
 *
 * Add this to the onCharacterCreated message handler:
 *
 * ```typescript
 * // In CharacterSelectPage.tsx
 * import { useCharacterWalletCreation } from '../hooks/useCharacterWalletCreation'
 *
 * function CharacterSelectPage({ ... }) {
 *   const { createCharacterWallet } = useCharacterWalletCreation()
 *
 *   React.useEffect(() => {
 *     // ... WebSocket setup
 *
 *     ws.addEventListener("message", async (e) => {
 *       const [method, data] = readPacket(e.data)
 *
 *       if (method === "onCharacterCreated") {
 *         const character = data as Character
 *
 *         // Update character list
 *         setCharacters((prev) => [...prev, character])
 *
 *         // Create character wallet (ADR-0008)
 *         const walletResult = await createCharacterWallet(character.name)
 *         if (walletResult.success) {
 *           console.log('✅ Character wallet created:', walletResult.walletAddress)
 *         } else {
 *           console.error('❌ Failed to create character wallet:', walletResult.error)
 *           // Show error to user
 *         }
 *
 *         // Continue with character selection flow
 *         setSelectedCharacterId(character.id)
 *         setView("confirm")
 *       }
 *     })
 *   }, [wsUrl])
 * }
 * ```
 */
