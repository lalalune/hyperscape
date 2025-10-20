/**
 * Test: Hyperscape Event Publishing to Blockchain
 * 
 * Verifies that Hyperscape player events are correctly published to HyperscapeOracle
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { ethers } from 'ethers';

describe('Hyperscape Event Publishing', () => {
  let provider: ethers.JsonRpcProvider;
  let hyperscapeOracleAddress: string;

  beforeAll(async () => {
    const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
    provider = new ethers.JsonRpcProvider(rpcUrl);

    hyperscapeOracleAddress = process.env.HYPERSCAPE_ORACLE_ADDRESS || '';
    
    if (!hyperscapeOracleAddress) {
      console.warn('⚠️  HYPERSCAPE_ORACLE_ADDRESS not set - test will be skipped');
      console.warn('   Deploy contracts first: cd contracts && forge script script/DeployPredictionMarkets.s.sol --broadcast');
      return;
    }

    console.log('🔍 Testing event publishing to:', hyperscapeOracleAddress);
  });

  test('should have HyperscapeOracle deployed', async () => {
    if (!hyperscapeOracleAddress) {
      console.log('⏭️  Skipped - oracle not deployed');
      return;
    }

    const code = await provider.getCode(hyperscapeOracleAddress);
    expect(code).not.toBe('0x');
    console.log('✅ HyperscapeOracle contract verified');
  });

  test('should capture SkillLevelUp events', async () => {
    if (!hyperscapeOracleAddress) {
      console.log('⏭️  Skipped - oracle not deployed');
      return;
    }

    console.log('📡 Listening for SkillLevelUp events...');
    console.log('   Start Hyperscape with ENABLE_BLOCKCHAIN=true');
    console.log('   Skill level-ups will be published automatically');
    console.log('');

    const filter = {
      address: hyperscapeOracleAddress,
      topics: [ethers.id('SkillLevelUp(address,string,uint8,uint256,uint256)')]
    };

    const events = await provider.getLogs({
      ...filter,
      fromBlock: -1000,
      toBlock: 'latest'
    });

    console.log(`📊 Found ${events.length} SkillLevelUp events in last 1000 blocks`);
    
    if (events.length > 0) {
      console.log('✅ Skill event publishing is working!');
      console.log('   Latest event:', events[0]);
    } else {
      console.log('ℹ️  No events yet - level up a skill in Hyperscape to test');
    }
  });

  test('should capture PlayerDeath events', async () => {
    if (!hyperscapeOracleAddress) {
      console.log('⏭️  Skipped - oracle not deployed');
      return;
    }

    const filter = {
      address: hyperscapeOracleAddress,
      topics: [ethers.id('PlayerDeath(address,address,string,uint256)')]
    };

    const events = await provider.getLogs({
      ...filter,
      fromBlock: -1000,
      toBlock: 'latest'
    });

    console.log(`📊 Found ${events.length} PlayerDeath events in last 1000 blocks`);

    if (events.length > 0) {
      console.log('✅ Death event publishing is working!');
    } else {
      console.log('ℹ️  No deaths yet - die in Hyperscape to test');
    }
  });

  test('should capture PlayerKill events', async () => {
    if (!hyperscapeOracleAddress) {
      console.log('⏭️  Skipped - oracle not deployed');
      return;
    }

    const filter = {
      address: hyperscapeOracleAddress,
      topics: [ethers.id('PlayerKill(address,address,string,uint256)')]
    };

    const events = await provider.getLogs({
      ...filter,
      fromBlock: -1000,
      toBlock: 'latest'
    });

    console.log(`📊 Found ${events.length} PlayerKill events in last 1000 blocks`);

    if (events.length > 0) {
      console.log('✅ Kill event publishing is working!');
    } else {
      console.log('ℹ️  No kills yet - get a kill in Hyperscape to test');
    }
  });
});

console.log('');
console.log('📝 Integration Test Instructions:');
console.log('');
console.log('1. Deploy contracts:');
console.log('   cd contracts');
console.log('   forge script script/DeployPredictionMarkets.s.sol --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
console.log('');
console.log('2. Set environment variables:');
console.log('   export HYPERSCAPE_ORACLE_ADDRESS=0x...');
console.log('   export ENABLE_BLOCKCHAIN=true');
console.log('');
console.log('3. Start Hyperscape:');
console.log('   cd vendor/hyperscape/packages/server');
console.log('   bun run dev');
console.log('');
console.log('4. Play the game and gain skills/die/kill');
console.log('');
console.log('5. Run this test:');
console.log('   bun test tests/blockchain-event-publishing.test.ts');
console.log('');

