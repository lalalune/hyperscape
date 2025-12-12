/**
 * Tests for RegistryClient
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { ethers } from "ethers";
import { RegistryClient } from "../registryClient";

describe("RegistryClient", () => {
  let client: RegistryClient;
  let provider: ethers.Provider;
  let testPrivateKey: string;

  beforeAll(async () => {
    const rpcUrl = process.env.TEST_RPC_URL || "http://localhost:8545";
    provider = new ethers.JsonRpcProvider(rpcUrl);
    testPrivateKey =
      process.env.TEST_PRIVATE_KEY ||
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    client = new RegistryClient(provider, testPrivateKey);
  });

  test("should create RegistryClient instance", () => {
    expect(client).toBeDefined();
  });

  test("should have registerPlayer method", () => {
    expect(typeof client.registerPlayer).toBe("function");
  });

  test("should have registerCharacter method", () => {
    expect(typeof client.registerCharacter).toBe("function");
  });

  test("should have isPlayerBanned method", () => {
    expect(typeof client.isPlayerBanned).toBe("function");
  });

  test("should have getPlayerTier method", () => {
    expect(typeof client.getPlayerTier).toBe("function");
  });
});
