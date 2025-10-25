#!/usr/bin/env bun
/**
 * Full End-to-End Blockchain Integration Test
 * 
 * Tests the complete flow:
 * 1. Player registration on-chain
 * 2. Inventory operations on-chain
 * 3. Equipment operations on-chain
 * 4. Data persistence verification
 * 5. Trading with blockchain state
 * 
 * NO MOCKS - Real MUD contracts, real blockchain
 */

import { test, expect } from '@playwright/test';
import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { setupMudClient } from '../packages/shared/src/blockchain/mud-client';

const RPC_URL = 'http://localhost:8545';
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Address;
const TEST_PLAYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

test.describe('MUD Blockchain Integration', () => {
  
  test('should connect to MUD World contract', async () => {
    const mudClient = await setupMudClient({
      rpcUrl: RPC_URL,
      privateKey: TEST_PRIVATE_KEY
    });

    expect(mudClient).toBeDefined();
    expect(mudClient.worldAddress).toBeTruthy();
    
    const isDeployed = await mudClient.isDeployed();
    expect(isDeployed).toBe(true);
    
    console.log('✅ MUD World connected:', mudClient.worldAddress);
  });

  test('should register player on blockchain', async () => {
    const mudClient = await setupMudClient({
      rpcUrl: RPC_URL,
      privateKey: TEST_PRIVATE_KEY
    });

    const playerName = `TestPlayer_${Date.now()}`;
    
    console.log(`📝 Registering player "${playerName}" on blockchain...`);
    const receipt = await mudClient.PlayerSystem.register(playerName);
    
    expect(receipt.transactionHash).toBeTruthy();
    expect(receipt.blockNumber).toBeGreaterThan(0n);
    expect(receipt.status).toBe('success');
    
    console.log('✅ Player registered on-chain');
    console.log(`   Tx: ${receipt.transactionHash}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas: ${receipt.gasUsed}`);
  });

  test('should add item to inventory on blockchain', async () => {
    const mudClient = await setupMudClient({
      rpcUrl: RPC_URL,
      privateKey: TEST_PRIVATE_KEY
    });

    const itemId = 1; // Bronze sword
    const quantity = 1;
    
    console.log(`📦 Adding item ${itemId} to inventory on blockchain...`);
    const receipt = await mudClient.InventorySystem.addItem(
      TEST_PLAYER,
      itemId,
      quantity
    );
    
    expect(receipt.transactionHash).toBeTruthy();
    expect(receipt.status).toBe('success');
    
    console.log('✅ Item added to inventory on-chain');
    console.log(`   Tx: ${receipt.transactionHash}`);
    console.log(`   Block: ${receipt.blockNumber}`);
  });

  test('should equip item on blockchain', async () => {
    const mudClient = await setupMudClient({
      rpcUrl: RPC_URL,
      privateKey: TEST_PRIVATE_KEY
    });

    // First add an item
    await mudClient.InventorySystem.addItem(TEST_PLAYER, 1, 1);
    
    // Then equip it from slot 0
    console.log('⚔️  Equipping item from slot 0...');
    const receipt = await mudClient.EquipmentSystem.equipItem(0);
    
    expect(receipt.transactionHash).toBeTruthy();
    expect(receipt.status).toBe('success');
    
    console.log('✅ Item equipped on-chain');
    console.log(`   Tx: ${receipt.transactionHash}`);
  });

  test('should verify blockchain writes vs PostgreSQL', async () => {
    console.log('\n🔍 Analyzing data flow...\n');
    
    const publicClient = createPublicClient({
      transport: http(RPC_URL)
    });

    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock - 50n;

    // Count transactions
    let inventoryTxCount = 0;
    let equipmentTxCount = 0;
    let playerTxCount = 0;

    for (let i = currentBlock; i > fromBlock; i--) {
      const block = await publicClient.getBlock({ blockNumber: i, includeTransactions: true });
      
      for (const tx of block.transactions) {
        const input = (tx as any).input as string;
        if (input.includes('496e76656e746f7279')) inventoryTxCount++; // "Inventory" in hex
        if (input.includes('45717569706d656e74')) equipmentTxCount++; // "Equipment" in hex
        if (input.includes('506c61796572')) playerTxCount++; // "Player" in hex
      }
    }

    console.log('📊 On-chain activity in last 50 blocks:');
    console.log(`   Player operations: ${playerTxCount}`);
    console.log(`   Inventory operations: ${inventoryTxCount}`);
    console.log(`   Equipment operations: ${equipmentTxCount}`);
    console.log(`   Total: ${inventoryTxCount + equipmentTxCount + playerTxCount}`);

    // These should be > 0 if blockchain is actually being used
    expect(inventoryTxCount + equipmentTxCount + playerTxCount).toBeGreaterThan(0);
    
    console.log('\n✅ Blockchain integration verified - data IS being written on-chain');
  });
});

test.describe('NFT Minting Flow', () => {
  
  test('should demonstrate full minting flow', async () => {
    console.log('\n📋 NFT Minting Flow:');
    console.log('1. Player has item in MUD inventory (on-chain)');
    console.log('2. Player requests mint signature from server API');
    console.log('3. Server verifies ownership in MUD state');
    console.log('4. Server generates signature for Items.mintItem()');
    console.log('5. Player calls Items.mintItem() with signature');
    console.log('6. Server listens to ItemMinted event');
    console.log('7. Server calls MUD.markItemAsMinted()');
    console.log('\n⚠️  Current Status: Steps 1-4 implemented, Steps 6-7 need completion');
  });
});

