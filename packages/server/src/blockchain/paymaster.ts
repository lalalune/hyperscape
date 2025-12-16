/**
 * Multicoin Paymaster Integration
 */

import { ethers } from "ethers";

const TOKENS = {
  ELIZAOS: process.env.ELIZAOS_TOKEN_ADDRESS || "",
  CLANKER: process.env.CLANKER_TOKEN_ADDRESS || "",
  VIRTUAL: process.env.VIRTUAL_TOKEN_ADDRESS || "",
  CLANKERMON: process.env.CLANKERMON_TOKEN_ADDRESS || "",
};

export class PaymasterService {
  async getAvailablePaymasters(
    _minETH: bigint = BigInt(10 ** 19),
  ): Promise<string[]> {
    // Query PaymasterFactory for deployed paymasters
    // TODO: Filter by ETH stake threshold when implemented
    return Object.values(TOKENS).filter(Boolean);
  }

  generatePaymasterData(paymasterAddr: string, appAddr: string): string {
    const verificationGas = ethers.zeroPadValue(ethers.toBeHex(100000), 16);
    const postOpGas = ethers.zeroPadValue(ethers.toBeHex(50000), 16);
    return ethers.concat([paymasterAddr, verificationGas, postOpGas, appAddr]);
  }
}

export const paymaster = new PaymasterService();
