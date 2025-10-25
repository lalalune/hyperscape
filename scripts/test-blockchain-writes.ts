#!/usr/bin/env bun
/**
 * Test MUD Blockchain Integration
 * Verifies that the game actually writes to blockchain, not just PostgreSQL
 */

import { createPublicClient, http, type Address } from 'viem';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const WORLD_ADDRESS = process.env.WORLD_ADDRESS as Address;

if (!WORLD_ADDRESS) {
  console.error('❌ WORLD_ADDRESS not set in environment');
  process.exit(1);
}

const client = createPublicClient({
  transport: http(RPC_URL)
});

async function main() {
  console.log('🔍 Testing MUD Blockchain Integration\n');
  console.log(`📍 World Address: ${WORLD_ADDRESS}`);
  console.log(`🌐 RPC URL: ${RPC_URL}\n`);

  // 1. Check if contract exists
  console.log('1️⃣  Checking if World contract is deployed...');
  const code = await client.getCode({ address: WORLD_ADDRESS });
  if (!code || code === '0x') {
    console.error('❌ No contract at WORLD_ADDRESS');
    process.exit(1);
  }
  console.log(`✅ Contract deployed (${code.length} bytes)\n`);

  // 2. Try to read Player table from MUD
  console.log('2️⃣  Attempting to read MUD Player table...');
  try {
    // MUD stores data in a deterministic way
    // We'll try to call a view function if one exists
    const blockNumber = await client.getBlockNumber();
    console.log(`✅ Connected to blockchain (block: ${blockNumber})\n`);
  } catch (error) {
    console.error('❌ Failed to read from blockchain:', error);
    process.exit(1);
  }

  // 3. Check recent transactions to World contract
  console.log('3️⃣  Checking recent transactions to World contract...');
  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock - 100n < 0n ? 0n : currentBlock - 100n;
  
  // Get block with transactions
  let txCount = 0;
  for (let i = currentBlock; i > fromBlock && i >= 0n; i--) {
    const block = await client.getBlock({ blockNumber: i, includeTransactions: true });
    const worldTxs = block.transactions.filter((tx: any) => 
      tx.to?.toLowerCase() === WORLD_ADDRESS.toLowerCase()
    );
    txCount += worldTxs.length;
    
    if (worldTxs.length > 0) {
      console.log(`\n📦 Block ${i}: ${worldTxs.length} transactions to World`);
      for (const tx of worldTxs.slice(0, 5)) { // Show max 5
        console.log(`   Tx: ${tx.hash}`);
        console.log(`   From: ${tx.from}`);
        console.log(`   Gas: ${tx.gas}`);
        console.log(`   Input: ${tx.input.slice(0, 66)}...`); // Show function selector + first param
      }
    }
  }

  console.log(`\n✅ Found ${txCount} transactions to World contract in last 100 blocks\n`);

  // 4. Verdict
  console.log('═══════════════════════════════════════');
  if (txCount === 0) {
    console.log('⚠️  WARNING: No blockchain writes detected!');
    console.log('   The game might be running in PostgreSQL-only mode.');
    console.log('   Check:');
    console.log('   1. Is BlockchainGateway enabled in server logs?');
    console.log('   2. Are batch operations being processed?');
    console.log('   3. Are errors being silently swallowed?');
    console.log('\n❌ TEST FAILED: No on-chain activity');
    process.exit(1);
  } else {
    console.log('✅ SUCCESS: Blockchain writes are working!');
    console.log(`   Found ${txCount} transactions in last 100 blocks`);
  }
  console.log('═══════════════════════════════════════\n');
}

main().catch(console.error);

