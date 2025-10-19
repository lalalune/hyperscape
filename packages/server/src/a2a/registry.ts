/**
 * ERC-8004 Auto-Registration for Hyperscape
 * Automatically registers the game server to the agent registry on startup
 */

import { ethers } from 'ethers';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface RegistrationResult {
  registered: boolean;
  agentId?: bigint;
  agentDomain?: string;
  transactionHash?: string;
  error?: string;
}

export class ERC8004RegistryClient {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private registryContract: ethers.Contract | null = null;

  constructor(rpcUrl: string, privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  async initialize(): Promise<void> {
    // Load IdentityRegistry contract from Jeju root
    const possiblePaths = [
      join(process.cwd(), 'contracts/deployments/localnet/liquidity-system.json'),
      join(process.cwd(), '../contracts/deployments/localnet/liquidity-system.json'),
      join(process.cwd(), '../../contracts/deployments/localnet/liquidity-system.json'),
      join(process.cwd(), '../../../contracts/deployments/localnet/liquidity-system.json'),
      join(process.cwd(), '../../../../contracts/deployments/localnet/liquidity-system.json'),
      join(process.cwd(), '../../../../../contracts/deployments/localnet/liquidity-system.json')
    ];

    let contractAddress: string | undefined;
    let abi: unknown;

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        const deployment = JSON.parse(content);
        
        if (deployment.identityRegistry) {
          contractAddress = deployment.identityRegistry;
          // Load ABI from separate file
          const abiPath = join(__dirname, '../../../../../contracts/src/registry/IdentityRegistry.sol');
          // For simplicity, use minimal ABI
          abi = [
            'function register(string calldata tokenURI) external returns (uint256 agentId)',
            'function register() external returns (uint256 agentId)',
            'function resolveAgentByAddress(address agent) external view returns (uint256 agentId_, string agentDomain_)',
            'function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external',
            'function agentExists(uint256 agentId) external view returns (bool)',
            'event Registered(uint256 indexed agentId, string tokenURI, address indexed owner)'
          ];
          break;
        }
        
        if (deployment.abi && deployment.address) {
          contractAddress = deployment.address;
          abi = deployment.abi;
          break;
        }
      }
    }

    if (!contractAddress || !abi) {
      throw new Error('IdentityRegistry contract not found. Deploy contracts first.');
    }

    this.registryContract = new ethers.Contract(contractAddress, abi as ethers.InterfaceAbi, this.wallet);
  }

  async register(serverUrl: string, gameName: string): Promise<RegistrationResult> {
    if (!this.registryContract) {
      return { registered: false, error: 'Registry not initialized' };
    }

    // Check if already registered
    const resolution = await this.registryContract.resolveAgentByAddress(this.wallet.address);
    
    if (resolution.agentId_ !== 0n) {
      console.log(`[ERC-8004] Already registered as Agent #${resolution.agentId_}`);
      return {
        registered: true,
        agentId: resolution.agentId_,
        agentDomain: resolution.agentDomain_
      };
    }

    // Create agent card URI
    const agentCardUri = `${serverUrl}/.well-known/agent-card.json`;

    // Register agent
    console.log('[ERC-8004] Registering game server to agent registry...');
    const tx = await this.registryContract.register(agentCardUri);
    const receipt = await tx.wait();

    // Extract agent ID from event
    const event = receipt.logs
      .map((log: ethers.Log) => {
        return this.registryContract!.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
      })
      .find((e: ethers.LogDescription | null) => e?.name === 'Registered');

    const agentId = event!.args.agentId as bigint;

    // Set metadata
    await this.setMetadata(agentId, 'name', gameName);
    await this.setMetadata(agentId, 'type', 'game-server');
    await this.setMetadata(agentId, 'gameType', 'mmorpg');
    await this.setMetadata(agentId, 'url', serverUrl);

    console.log(`[ERC-8004] ✅ Registered as Agent #${agentId}`);
    console.log(`[ERC-8004]    TX: ${receipt.hash}`);

    return {
      registered: true,
      agentId,
      transactionHash: receipt.hash
    };
  }

  private async setMetadata(agentId: bigint, key: string, value: string): Promise<void> {
    if (!this.registryContract) return;

    const encodedValue = ethers.AbiCoder.defaultAbiCoder().encode(['string'], [value]);
    await this.registryContract.setMetadata(agentId, key, encodedValue);
  }

  getWalletAddress(): string {
    return this.wallet.address;
  }
}

/**
 * Smart blockchain detection and contract deployment
 * Tries: Jeju L2 (8004/901/902) → Anvil (31337) → graceful skip
 */
async function detectAndDeployContracts(): Promise<string | null> {
  const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
  
  // Try to connect to blockchain
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  
  console.log(`[ERC-8004] Detected chain ID: ${chainId}`);
  
  // Check if contracts are deployed
  const possiblePaths = [
    join(process.cwd(), 'contracts/deployments/localnet/liquidity-system.json'),
    join(process.cwd(), '../contracts/deployments/localnet/liquidity-system.json'),
    join(process.cwd(), '../../contracts/deployments/localnet/liquidity-system.json'),
    join(process.cwd(), '../../../contracts/deployments/localnet/liquidity-system.json'),
    join(process.cwd(), '../../../../contracts/deployments/localnet/liquidity-system.json'),
    join(process.cwd(), '../../../../../contracts/deployments/localnet/liquidity-system.json')
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      const deployment = JSON.parse(readFileSync(path, 'utf-8'));
      if (deployment.identityRegistry) {
        console.log(`[ERC-8004] Found deployed contracts at ${path}`);
        return deployment.identityRegistry;
      }
    }
  }

  // Contracts not found - auto-deploy to Anvil if it's running
  if (chainId === 31337) {
    console.log('[ERC-8004] Contracts not deployed - auto-deploying to Anvil...');
    
    const { spawn } = await import('bun');
    const contractsDir = join(process.cwd(), '../../../../../contracts');
    
    if (!existsSync(contractsDir)) {
      console.log('[ERC-8004] Contracts directory not found - skipping deployment');
      return null;
    }

    const deployProc = spawn({
      cmd: ['forge', 'script', 'script/DeployLiquiditySystem.s.sol:DeployLiquiditySystem', '--rpc-url', rpcUrl, '--broadcast'],
      cwd: contractsDir,
      stdout: 'pipe',
      stderr: 'pipe'
    });

    await deployProc.exited;

    if (deployProc.exitCode === 0) {
      console.log('[ERC-8004] ✅ Contracts auto-deployed to Anvil');
      
      // Reload deployment file
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          const deployment = JSON.parse(readFileSync(path, 'utf-8'));
          if (deployment.identityRegistry) {
            return deployment.identityRegistry;
          }
        }
      }
    } else {
      console.log('[ERC-8004] Auto-deployment failed - continuing without registry');
    }
  }

  return null;
}

/**
 * Auto-register to ERC-8004 with smart detection
 * Always tries, gracefully falls back if unavailable
 */
export async function autoRegisterToRegistry(serverUrl: string, gameName: string): Promise<RegistrationResult> {
  // Try smart RPC detection
  const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
  const privateKey = process.env.SERVER_PRIVATE_KEY || process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  const client = new ERC8004RegistryClient(rpcUrl, privateKey);
  
  await detectAndDeployContracts();
  await client.initialize();
  const result = await client.register(serverUrl, gameName);

  return result;
}

