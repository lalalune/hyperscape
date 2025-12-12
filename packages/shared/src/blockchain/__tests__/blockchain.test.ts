/**
 * Blockchain Integration Tests
 *
 * Tests for the complete blockchain integration module.
 * These tests verify the module structure and exports.
 */

import { describe, test, expect, mock } from "bun:test";

// Test that all modules can be imported
describe("Blockchain Module Exports", () => {
  test("chain module exports correctly", async () => {
    const chain = await import("../chain");

    expect(chain.JEJU_LOCALNET).toBeDefined();
    expect(chain.JEJU_TESTNET).toBeDefined();
    expect(chain.JEJU_MAINNET).toBeDefined();
    expect(chain.ANVIL_CHAIN).toBeDefined();
    expect(chain.CHAINS).toBeDefined();
    expect(chain.CHAIN_IDS).toBeDefined();
    expect(typeof chain.getChain).toBe("function");
    expect(typeof chain.getRpcUrl).toBe("function");
    expect(typeof chain.detectNetwork).toBe("function");
    expect(typeof chain.isBlockchainConfigured).toBe("function");
  });

  test("erc8004 module exports correctly", async () => {
    const erc8004 = await import("../erc8004");

    expect(erc8004.StakeTier).toBeDefined();
    expect(typeof erc8004.checkPlayerAccess).toBe("function");
    expect(typeof erc8004.requirePlayerAccess).toBe("function");
    expect(typeof erc8004.generateAppId).toBe("function");
    expect(erc8004.HYPERSCAPE_APP_ID).toBeDefined();
  });

  test("x402 module exports correctly", async () => {
    const x402 = await import("../x402");

    expect(x402.GAME_PAYMENT_TIERS).toBeDefined();
    expect(typeof x402.createPaymentRequirement).toBe("function");
    expect(typeof x402.createPaymentPayload).toBe("function");
    expect(typeof x402.parsePaymentHeader).toBe("function");
    expect(typeof x402.verifyPaymentSignature).toBe("function");
    expect(typeof x402.checkPayment).toBe("function");
    expect(typeof x402.generate402Headers).toBe("function");
  });

  test("paymaster module exports correctly", async () => {
    const paymaster = await import("../paymaster");

    expect(typeof paymaster.getAvailablePaymasters).toBe("function");
    expect(typeof paymaster.getPaymasterForToken).toBe("function");
    expect(typeof paymaster.findBestPaymaster).toBe("function");
    expect(typeof paymaster.generatePaymasterData).toBe("function");
    expect(typeof paymaster.isGaslessAvailable).toBe("function");
    expect(paymaster.paymasterService).toBeDefined();
  });

  test("game-economy module exports correctly", async () => {
    const economy = await import("../game-economy");

    expect(typeof economy.getGoldBalance).toBe("function");
    expect(typeof economy.getGoldClaimNonce).toBe("function");
    expect(typeof economy.signGoldClaim).toBe("function");
    expect(typeof economy.getItemBalance).toBe("function");
    expect(typeof economy.getItemMetadata).toBe("function");
    expect(typeof economy.signItemMint).toBe("function");
    expect(typeof economy.generateInstanceId).toBe("function");
  });

  test("mud-client module exports correctly", async () => {
    const mud = await import("../mud-client");

    expect(typeof mud.setupMudClient).toBe("function");
    expect(typeof mud.isMudClientAvailable).toBe("function");
    expect(typeof mud.getMudClientOrThrow).toBe("function");
    expect(typeof mud.batchInventoryOperations).toBe("function");
    expect(typeof mud.onMudEvent).toBe("function");
    expect(typeof mud.emitMudEvent).toBe("function");
    expect(typeof mud.isFullIntegrationAvailable).toBe("function");
    expect(typeof mud.getIntegrationStatus).toBe("function");
  });

  test("barrel export includes all modules", async () => {
    const blockchain = await import("../index");

    // Chain exports
    expect(blockchain.CHAINS).toBeDefined();
    expect(blockchain.CHAIN_IDS).toBeDefined();
    expect(typeof blockchain.getChain).toBe("function");

    // ERC-8004 exports
    expect(blockchain.StakeTier).toBeDefined();
    expect(typeof blockchain.checkPlayerAccess).toBe("function");

    // x402 exports
    expect(blockchain.GAME_PAYMENT_TIERS).toBeDefined();
    expect(typeof blockchain.createPaymentRequirement).toBe("function");

    // Paymaster exports
    expect(typeof blockchain.getAvailablePaymasters).toBe("function");

    // Economy exports
    expect(typeof blockchain.getGoldBalance).toBe("function");

    // MUD exports
    expect(typeof blockchain.setupMudClient).toBe("function");
  });
});

describe("Chain Configuration", () => {
  test("detectNetwork returns jeju by default", async () => {
    const { detectNetwork } = await import("../chain");
    expect(detectNetwork()).toBe("jeju");
  });

  test("isBlockchainConfigured returns false without env vars", async () => {
    const { isBlockchainConfigured } = await import("../chain");
    expect(isBlockchainConfigured()).toBe(false);
  });

  test("getChain returns correct chain for jeju", async () => {
    const { getChain } = await import("../chain");
    const chain = getChain("jeju");
    expect(chain.id).toBe(420691);
    expect(chain.name).toBe("Jeju Localnet");
  });

  test("getChain returns correct chain for anvil", async () => {
    const { getChain } = await import("../chain");
    const chain = getChain("anvil");
    expect(chain.id).toBe(31337);
    expect(chain.name).toBe("Anvil");
  });
});

describe("x402 Payment Functions", () => {
  test("createPaymentRequirement creates valid structure", async () => {
    const { createPaymentRequirement } = await import("../x402");
    const { parseEther } = await import("viem");

    const requirement = createPaymentRequirement(
      "/api/game/action",
      parseEther("0.01"),
      "Game action payment",
      "0x1234567890123456789012345678901234567890",
      "0x0000000000000000000000000000000000000000",
      "jeju",
    );

    expect(requirement.x402Version).toBe(1);
    expect(requirement.accepts).toHaveLength(1);
    expect(requirement.accepts[0].scheme).toBe("exact");
    expect(requirement.accepts[0].network).toBe("jeju");
    expect(requirement.accepts[0].resource).toBe("/api/game/action");
  });

  test("parsePaymentHeader returns null for invalid input", async () => {
    const { parsePaymentHeader } = await import("../x402");

    expect(parsePaymentHeader(null)).toBeNull();
    expect(parsePaymentHeader("invalid json")).toBeNull();
    expect(parsePaymentHeader("{}")).toBeNull();
  });

  test("generate402Headers creates proper headers", async () => {
    const { generate402Headers, createPaymentRequirement } =
      await import("../x402");
    const { parseEther } = await import("viem");

    const requirement = createPaymentRequirement(
      "/test",
      parseEther("0.01"),
      "Test",
      "0x1234567890123456789012345678901234567890",
    );

    const headers = generate402Headers(requirement);

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["WWW-Authenticate"]).toBe("x402");
    expect(headers["X-Payment-Requirement"]).toBeDefined();
    expect(headers["Access-Control-Expose-Headers"]).toContain(
      "X-Payment-Requirement",
    );
  });
});

describe("ERC-8004 Functions", () => {
  test("generateAppId creates consistent hashes", async () => {
    const { generateAppId } = await import("../erc8004");

    const id1 = generateAppId("hyperscape");
    const id2 = generateAppId("hyperscape");

    expect(id1).toBe(id2);
    expect(id1.startsWith("0x")).toBe(true);
    expect(id1.length).toBe(66); // 0x + 64 hex chars
  });

  test("HYPERSCAPE_APP_ID is defined and valid", async () => {
    const { HYPERSCAPE_APP_ID } = await import("../erc8004");

    expect(HYPERSCAPE_APP_ID).toBeDefined();
    expect(HYPERSCAPE_APP_ID.startsWith("0x")).toBe(true);
  });
});

describe("Game Economy Functions", () => {
  test("generateInstanceId creates unique IDs", async () => {
    const { generateInstanceId } = await import("../game-economy");

    const id1 = generateInstanceId(
      "0x1234567890123456789012345678901234567890",
      BigInt(1),
      BigInt(Date.now()),
    );

    const id2 = generateInstanceId(
      "0x1234567890123456789012345678901234567890",
      BigInt(1),
      BigInt(Date.now()),
    );

    // IDs should be different due to random component
    expect(id1).not.toBe(id2);
    expect(id1.startsWith("0x")).toBe(true);
    expect(id2.startsWith("0x")).toBe(true);
  });
});

describe("MUD Client Functions", () => {
  test("isMudClientAvailable returns false without WORLD_ADDRESS", async () => {
    const { isMudClientAvailable } = await import("../mud-client");
    expect(isMudClientAvailable()).toBe(false);
  });

  test("getIntegrationStatus returns correct structure", async () => {
    const { getIntegrationStatus } = await import("../mud-client");

    const status = getIntegrationStatus();

    expect(status).toHaveProperty("mud");
    expect(status).toHaveProperty("erc8004");
    expect(status).toHaveProperty("banManager");
    expect(status).toHaveProperty("economy");
    expect(status).toHaveProperty("full");
    expect(typeof status.mud).toBe("boolean");
    expect(typeof status.full).toBe("boolean");
  });

  test("onMudEvent returns unsubscribe function", async () => {
    const { onMudEvent } = await import("../mud-client");

    const handler = mock(() => {});
    const unsubscribe = onMudEvent("player_registered", handler);

    expect(typeof unsubscribe).toBe("function");

    // Cleanup
    unsubscribe();
  });
});

describe("Paymaster Functions", () => {
  test("generatePaymasterData creates valid encoded data", async () => {
    const { generatePaymasterData } = await import("../paymaster");

    const data = generatePaymasterData(
      "0x1234567890123456789012345678901234567890",
    );

    expect(data.startsWith("0x")).toBe(true);
    // Should contain: address (20 bytes) + uint128 (16 bytes) + uint128 (16 bytes) = 52 bytes = 104 hex chars + 0x
    expect(data.length).toBe(106);
  });
});
