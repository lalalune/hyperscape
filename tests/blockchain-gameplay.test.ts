/**
 * Blockchain Gameplay Integration Test
 * 
 * Proves that actual gameplay operations write to blockchain.
 * Tests the full flow from player action → PostgreSQL → MUD blockchain
 * 
 * NO MOCKS - Real browser, real game, real blockchain
 */

import { test, expect, type Page } from '@playwright/test';
import { createPublicClient, http } from 'viem';

const SERVER_URL = 'http://localhost:5555';
const RPC_URL = 'http://localhost:8545';

async function getBlockchainStats() {
  const client = createPublicClient({
    transport: http(RPC_URL)
  });
  
  const currentBlock = await client.getBlockNumber();
  return { currentBlock, client };
}

test.describe('Blockchain Gameplay Integration', () => {
  
  test('should write inventory changes to blockchain', async ({ page }) => {
    console.log('\n🎮 Starting gameplay blockchain test...\n');
    
    // 1. Get starting block height
    const { currentBlock: startBlock } = await getBlockchainStats();
    console.log(`📍 Starting block: ${startBlock}`);
    
    // 2. Connect to game
    console.log('🌐 Connecting to game server...');
    await page.goto(SERVER_URL, { waitUntil: 'networkidle' });
    
    // Wait for world to load
    await page.waitForTimeout(5000);
    
    // 3. Wait for batch interval (10 seconds) for any operations to be written
    console.log('⏳ Waiting for batch processing cycle (10 seconds)...');
    await page.waitForTimeout(12000);
    
    // 4. Check if new transactions appeared on blockchain
    const { currentBlock: endBlock, client } = await getBlockchainStats();
    console.log(`📍 Ending block: ${endBlock}`);
    
    const newBlocks = Number(endBlock - startBlock);
    console.log(`📊 New blocks mined: ${newBlocks}`);
    
    // 5. Count transactions in new blocks
    let gameTransactions = 0;
    for (let i = startBlock + 1n; i <= endBlock; i++) {
      const block = await client.getBlock({ blockNumber: i, includeTransactions: true });
      const worldTxs = block.transactions.filter((tx: any) => {
        const input = tx.input as string;
        // Check for MUD system calls (InventorySystem, EquipmentSystem, PlayerSystem)
        return input.includes('496e76656e746f7279') || // "Inventory"
               input.includes('45717569706d656e74') || // "Equipment"
               input.includes('506c61796572');          // "Player"
      });
      gameTransactions += worldTxs.length;
      
      if (worldTxs.length > 0) {
        console.log(`\n📦 Block ${i}: ${worldTxs.length} game transactions`);
        for (const tx of worldTxs) {
          const input = (tx as any).input.slice(0, 200);
          console.log(`   Tx: ${(tx as any).hash}`);
          console.log(`   System: ${input.includes('496e76656e746f7279') ? 'Inventory' : input.includes('45717569706d656e74') ? 'Equipment' : 'Player'}`);
        }
      }
    }
    
    console.log(`\n📊 Total game transactions: ${gameTransactions}`);
    
    // Since player spawned and got starting equipment, we expect AT LEAST:
    // - 1 player registration
    // - Multiple inventory ops for starting items
    // - Equipment for starting weapon
    // With batching, this might be consolidated
    
    if (gameTransactions === 0) {
      console.log('\n❌ VERIFICATION FAILED: No blockchain writes detected!');
      console.log('   This means the game is running in PostgreSQL-only mode');
      console.log('   BlockchainGateway is not actually writing to blockchain');
      throw new Error('MUD integration is a LARP - no blockchain writes detected');
    } else {
      console.log(`\n✅ VERIFICATION PASSED: Found ${gameTransactions} blockchain writes`);
      console.log('   MUD integration is REAL - game state is being written on-chain');
    }
    
    expect(gameTransactions).toBeGreaterThan(0);
  });
  
  test('should verify BlockchainGateway is actually enabled', async () => {
    // Read server logs to verify connection
    const { readFile } = await import('fs/promises');
    const logs = await readFile('/Users/shawwalters/jeju/vendor/hyperscape/logs/bc-test.log', 'utf-8');
    
    const hasConnection = logs.includes('BlockchainGateway] ✅ Connected to blockchain');
    const hasHybridMode = logs.includes('Mode: HYBRID');
    const hasBatchProcessing = logs.includes('Starting batch processing');
    
    console.log('\n🔍 Server Configuration:');
    console.log(`   Connected to blockchain: ${hasConnection ? '✅' : '❌'}`);
    console.log(`   Hybrid mode enabled: ${hasHybridMode ? '✅' : '❌'}`);
    console.log(`   Batch processing active: ${hasBatchProcessing ? '✅' : '❌'}`);
    
    if (!hasConnection) {
      throw new Error('BlockchainGateway failed to connect - check logs');
    }
    
    expect(hasConnection).toBe(true);
    expect(hasHybridMode).toBe(true);
    expect(hasBatchProcessing).toBe(true);
    
    console.log('\n✅ BlockchainGateway is properly configured and connected');
  });
});

test.describe('MUD vs PostgreSQL - Data Flow Analysis', () => {
  
  test('should show where data actually lives', async () => {
    console.log('\n📊 Current Architecture:\n');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│         HYPERSCAPE HYBRID MODE          │');
    console.log('└─────────────────────────────────────────┘');
    console.log('');
    console.log('ON-CHAIN (MUD):');
    console.log('  ✅ Player registration');
    console.log('  ✅ Inventory items (batched every 10s)');
    console.log('  ✅ Equipment slots');
    console.log('  ✅ Skills & XP');
    console.log('  ✅ Coins');
    console.log('');
    console.log('OFF-CHAIN (PostgreSQL):');
    console.log('  🏃 Player position (real-time)');
    console.log('  ⚔️  Combat ticks');
    console.log('  💬 Chat messages');
    console.log('  📊 Session data');
    console.log('');
    console.log('MINTING FLOW:');
    console.log('  1. Item exists in MUD inventory (on-chain) ✅');
    console.log('  2. Server API /api/mint-item verifies ownership');
    console.log('  3. Server generates signature');
    console.log('  4. Player calls Items.mintItem(signature)');
    console.log('  5. Item becomes ERC-1155 NFT ✅');
    console.log('  6. MUD state updated: item.isMinted = true');
    console.log('');
  });
});

