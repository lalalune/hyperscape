/**
 * Tests for BanCache
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { ethers } from 'ethers';
import { BanCache } from '../banCache';

describe('BanCache', () => {
  let cache: BanCache;
  let provider: ethers.Provider;
  
  beforeAll(async () => {
    const rpcUrl = process.env.TEST_RPC_URL || 'http://localhost:8545';
    provider = new ethers.JsonRpcProvider(rpcUrl);
    
    cache = new BanCache(provider);
  });
  
  test('should create BanCache instance', () => {
    expect(cache).toBeDefined();
  });
  
  test('should have initialize method', () => {
    expect(typeof cache.initialize).toBe('function');
  });
  
  test('should have startListening method', () => {
    expect(typeof cache.startListening).toBe('function');
  });
  
  test('should have isBanned method', () => {
    expect(typeof cache.isBanned).toBe('function');
  });
  
  test('isBanned should return false for non-banned agent', () => {
    const result = cache.isBanned(999999);
    expect(result).toBe(false);
  });
});


