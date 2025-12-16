/**
 * Multicoin Paymaster Integration
 * Server-side wrapper for paymaster discovery with stake filtering
 */

import { ethers } from "ethers";
import {
  getAvailablePaymasters as getAvailablePaymastersShared,
  type PaymasterInfo,
} from "@hyperscape/shared/blockchain/paymaster";

export class PaymasterService {
  /**
   * Get available paymasters filtered by ETH stake threshold
   * 
   * @param minETH - Minimum ETH stake required (default: 0.01 ETH)
   * @returns Array of paymaster addresses that meet the stake requirement
   */
  async getAvailablePaymasters(
    minETH: bigint = BigInt(10 ** 19), // 0.01 ETH default
  ): Promise<string[]> {
    try {
      // Use shared paymaster discovery which already filters by stake
      const paymasters = await getAvailablePaymastersShared(minETH);
      return paymasters.map((pm: PaymasterInfo) => pm.address);
    } catch (error) {
      console.error(
        "[PaymasterService] Failed to get available paymasters:",
        error,
      );
      // Return empty array if query fails (fail closed)
      return [];
    }
  }

  generatePaymasterData(paymasterAddr: string, appAddr: string): string {
    const verificationGas = ethers.zeroPadValue(ethers.toBeHex(100000), 16);
    const postOpGas = ethers.zeroPadValue(ethers.toBeHex(50000), 16);
    return ethers.concat([paymasterAddr, verificationGas, postOpGas, appAddr]);
  }
}

export const paymaster = new PaymasterService();
