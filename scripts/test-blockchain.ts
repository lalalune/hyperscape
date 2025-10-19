#!/usr/bin/env bun
/**
 * Comprehensive Blockchain Integration Test
 * Tests actual on-chain functionality end-to-end
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║                                                              ║');
console.log('║   🧪 HYPERSCAPE BLOCKCHAIN INTEGRATION TEST                  ║');
console.log('║   Comprehensive On-Chain Verification                       ║');
console.log('║                                                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Load from environment (set by start-localnet.ts)
// Read directly from deployment file for accuracy
import { readFileSync } from 'fs';
const worldsData = JSON.parse(readFileSync('../../contracts/src/hyperscape/worlds.json', 'utf-8'));
const WORLD_ADDRESS = (worldsData['31337']?.address || process.env.WORLD_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3') as `0x${string}`;
const RPC_URL = process.env.ANVIL_RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = (process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as `0x${string}`;

console.log(`${colors.gray}Using world address: ${WORLD_ADDRESS}${colors.reset}`);

const localChain = {
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] }
  },
  testnet: true
};

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`${colors.blue}▶ ${name}...${colors.reset} `);
  try {
    await fn();
    console.log(`${colors.green}✅ PASS${colors.reset}`);
    passed++;
  } catch (error) {
    console.log(`${colors.red}❌ FAIL${colors.reset}`);
    console.log(`   ${colors.gray}${error instanceof Error ? error.message : error}${colors.reset}`);
    failed++;
  }
}

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: localChain,
    transport: http(RPC_URL)
  });
  
  console.log(`${colors.gray}Testing with account: ${account.address}${colors.reset}\n`);
  
  // Test 1: Anvil is running
  await test('Anvil is running', async () => {
    const blockNumber = await publicClient.getBlockNumber();
    if (blockNumber < 0n) throw new Error('Invalid block number');
  });
  
  // Test 2: Contract is deployed
  await test('Contract deployed at world address', async () => {
    const code = await publicClient.getCode({ address: WORLD_ADDRESS });
    if (!code || code === '0x') throw new Error('No contract code at address');
  });
  
  // Test 3: World is initialized
  await test('World is initialized', async () => {
    const initialized = await publicClient.readContract({
      address: WORLD_ADDRESS,
      abi: [{
        name: 'getInitialized',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bool' }]
      }],
      functionName: 'getInitialized'
    }) as boolean;
    
    if (!initialized) throw new Error('World not initialized');
  });
  
  // Test 4: Items were created
  await test('Items created on-chain', async () => {
    const itemName = await publicClient.readContract({
      address: WORLD_ADDRESS,
      abi: [{
        name: 'getName',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'itemId', type: 'uint16' }],
        outputs: [{ name: '', type: 'string' }]
      }],
      functionName: 'getName',
      args: [1]  // Item ID 1 should be "Logs"
    }) as string;
    
    if (itemName !== 'Logs') throw new Error(`Expected "Logs", got "${itemName}"`);
  });
  
  // Test 5: Register a player
  await test('Register player on-chain', async () => {
    const hash = await walletClient.writeContract({
      address: WORLD_ADDRESS,
      abi: [{
        name: 'hyperscape__register',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'name', type: 'string' }],
        outputs: []
      }],
      functionName: 'hyperscape__register',
      args: ['TestHero'],
      chain: localChain,
      account
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Transaction failed');
    
    console.log(`\n   ${colors.gray}Tx: ${hash}${colors.reset}`);
  });
  
  // Test 6: Verify player exists
  await test('Player exists on-chain', async () => {
    const exists = await publicClient.readContract({
      address: WORLD_ADDRESS,
      abi: [{
        name: 'hyperscape__isAlive',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'player', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }]
      }],
      functionName: 'hyperscape__isAlive',
      args: [account.address]
    }) as boolean;
    
    if (!exists) throw new Error('Player not found on-chain');
  });
  
  // Test 7: Get player position
  await test('Read player position from chain', async () => {
    const position = await publicClient.readContract({
      address: WORLD_ADDRESS,
      abi: [{
        name: 'hyperscape__getPosition',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'player', type: 'address' }],
        outputs: [
          { name: 'x', type: 'int32' },
          { name: 'y', type: 'int32' },
          { name: 'z', type: 'int32' }
        ]
      }],
      functionName: 'hyperscape__getPosition',
      args: [account.address]
    }) as [number, number, number];
    
    console.log(`\n   ${colors.gray}Position: (${position[0]}, ${position[1]}, ${position[2]})${colors.reset}`);
  });
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n${colors.blue}Results:${colors.reset} ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.gray}${failed} failed${colors.reset}\n`);
  
  if (failed === 0) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║   ✅ ALL TESTS PASSED - BLOCKCHAIN FULLY FUNCTIONAL          ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    process.exit(0);
  } else {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log(`║   ❌ ${failed} TEST(S) FAILED - BLOCKCHAIN NOT READY              ║`);
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});

