import { type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";

/**
 * Derives a deterministic private key and address for a character
 * based on the user's main wallet signature.
 *
 * @param walletClient - The Privy/Viem wallet client
 * @param userAddress - The user's main wallet address
 * @param characterName - The name of the character (used for uniqueness)
 * @param characterIndex - The index of the character (used for uniqueness)
 * @returns Object containing the derived private key and address
 */
export async function deriveCharacterWallet(
  walletClient: WalletClient,
  userAddress: string,
  characterName: string,
  characterIndex: number,
) {
  try {
    // Create a deterministic message to sign
    // We include the user address to ensure the derived wallet is bound to this user
    // We include character info to ensure uniqueness per character
    const message = `Hyperscape:Character:${userAddress}:${characterIndex}:${characterName}`;

    // Request signature from the user's main wallet
    // This prompts the user to sign a message (or happens automatically if using embedded wallet with proper config)
    const signature = await walletClient.signMessage({
      account: userAddress as `0x${string}`,
      message: message,
    });

    // Hash the signature to get a 32-byte private key
    const privateKey = keccak256(toBytes(signature));

    // Create a local account from this private key
    const account = privateKeyToAccount(privateKey);

    return {
      privateKey,
      address: account.address,
    };
  } catch (error) {
    console.error("Failed to derive character wallet:", error);
    throw error;
  }
}
