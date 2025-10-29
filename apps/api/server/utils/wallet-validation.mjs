/**
 * Wallet Address Validation Utilities
 * Supports Ethereum and Solana address validation
 */

/**
 * Validate Ethereum address
 * - Must start with 0x
 * - Must be exactly 42 characters (0x + 40 hex chars)
 * - Must contain only hex characters
 */
export function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') {
    return false
  }

  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Validate Solana address
 * - Must be base58 encoded
 * - Must be 32-44 characters long (typically 32-44 base58 chars)
 * - Must not contain confusing characters (0, O, I, l)
 */
export function isValidSolanaAddress(address) {
  if (!address || typeof address !== 'string') {
    return false
  }

  // Solana addresses are base58 encoded and typically 32-44 characters
  // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

  return base58Regex.test(address)
}

/**
 * Validate wallet address for a specific chain
 * @param {string} address - The wallet address to validate
 * @param {string} chainType - The chain type ('ethereum' or 'solana')
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidWalletAddress(address, chainType) {
  switch (chainType.toLowerCase()) {
    case 'ethereum':
    case 'eth':
      return isValidEthereumAddress(address)
    case 'solana':
    case 'sol':
      return isValidSolanaAddress(address)
    default:
      return false
  }
}

/**
 * Detect chain type from address format
 * @param {string} address - The wallet address
 * @returns {string|null} - 'ethereum', 'solana', or null if unknown
 */
export function detectChainType(address) {
  if (isValidEthereumAddress(address)) {
    return 'ethereum'
  }
  if (isValidSolanaAddress(address)) {
    return 'solana'
  }
  return null
}

/**
 * Format wallet address for display (shorten middle part)
 * @param {string} address - The wallet address
 * @param {number} startChars - Number of characters to show at start (default: 6)
 * @param {number} endChars - Number of characters to show at end (default: 4)
 * @returns {string} - Formatted address like "0x1234...5678"
 */
export function formatWalletAddress(address, startChars = 6, endChars = 4) {
  if (!address || address.length <= startChars + endChars) {
    return address
  }

  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`
}

/**
 * Get chain display name
 * @param {string} chainType - The chain type identifier
 * @returns {string} - Human-readable chain name
 */
export function getChainDisplayName(chainType) {
  switch (chainType.toLowerCase()) {
    case 'ethereum':
    case 'eth':
      return 'Ethereum'
    case 'solana':
    case 'sol':
      return 'Solana'
    default:
      return chainType
  }
}
