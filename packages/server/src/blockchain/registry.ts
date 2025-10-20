/**
 * ERC-8004 Registry Integration
 */

import { ethers } from 'ethers';

const REGISTRY_ABI = ['function agentExists(uint256 agentId) external view returns (bool)'];
const BAN_MANAGER_ABI = ['function isAccessAllowed(uint256 agentId, bytes32 appId) external view returns (bool)'];

export class RegistryService {
  private provider: ethers.Provider;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
  }

  async checkBan(agentAddress: string, appId: string): Promise<boolean> {
    const banManager = new ethers.Contract(
      process.env.BAN_MANAGER_ADDRESS || '',
      BAN_MANAGER_ABI,
      this.provider
    );
    
    try {
      const allowed = await banManager.isAccessAllowed(agentAddress, ethers.id(appId));
      return !allowed; // return true if banned
    } catch {
      return false; // fail open
    }
  }
}

export const registry = new RegistryService();
