/**
 * On-Chain Integration Tests
 *
 * These tests require a running anvil instance with deployed contracts.
 * Run: ~/.foundry/bin/anvil --port 8545
 * Deploy: cd packages/contracts && forge script script/DeployGameTokens.s.sol --broadcast --rpc-url http://localhost:8545
 *
 * SKIPPED when Anvil is not running.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { createPublicClient, http, parseEther, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import type { SessionKey } from "../session-keys";

// Contract addresses from deployment (anvil default)
const GOLD_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707" as Address;
const ITEMS_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F" as Address;
const IDENTITY_REGISTRY =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address;

// Anvil default accounts
const GAME_SIGNER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const PLAYER_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const RPC_URL = "http://localhost:8545";

// Check if Anvil is running (synchronous check using env var or always skip without anvil)
const SKIP_BLOCKCHAIN_TESTS = process.env.SKIP_BLOCKCHAIN_TESTS !== "false";

// Helper to skip tests that require blockchain
const testWithBlockchain = SKIP_BLOCKCHAIN_TESTS ? test.skip : test;

describe("On-Chain Integration Tests", () => {
  let publicClient: ReturnType<typeof createPublicClient>;

  // Always create accounts - they're needed for non-blockchain tests too
  const gameSignerAccount = privateKeyToAccount(
    GAME_SIGNER_KEY as `0x${string}`,
  );
  const playerAccount = privateKeyToAccount(PLAYER_KEY as `0x${string}`);

  beforeAll(async () => {
    if (SKIP_BLOCKCHAIN_TESTS) return;

    publicClient = createPublicClient({
      chain: anvil,
      transport: http(RPC_URL),
    });
  });

  describe("Contract Deployment Verification", () => {
    testWithBlockchain("Gold contract is deployed", async () => {
      const code = await publicClient.getCode({ address: GOLD_ADDRESS });
      expect(code).toBeDefined();
      expect(code?.length).toBeGreaterThan(2);
    });

    testWithBlockchain("Items contract is deployed", async () => {
      const code = await publicClient.getCode({ address: ITEMS_ADDRESS });
      expect(code).toBeDefined();
      expect(code?.length).toBeGreaterThan(2);
    });

    testWithBlockchain("IdentityRegistry is deployed", async () => {
      const code = await publicClient.getCode({ address: IDENTITY_REGISTRY });
      expect(code).toBeDefined();
      expect(code?.length).toBeGreaterThan(2);
    });
  });

  describe("Gold Contract Integration", () => {
    testWithBlockchain("can read Gold balance", async () => {
      const balance = await publicClient.readContract({
        address: GOLD_ADDRESS,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [playerAccount.address],
      });

      expect(typeof balance).toBe("bigint");
    });

    testWithBlockchain("can read Gold nonce", async () => {
      const nonce = await publicClient.readContract({
        address: GOLD_ADDRESS,
        abi: [
          {
            name: "getNonce",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "player", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "getNonce",
        args: [playerAccount.address],
      });

      expect(typeof nonce).toBe("bigint");
      expect(nonce).toBeGreaterThanOrEqual(0n);
    });

    testWithBlockchain("Gold contract has correct game signer", async () => {
      const signer = await publicClient.readContract({
        address: GOLD_ADDRESS,
        abi: [
          {
            name: "gameSigner",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "address" }],
          },
        ],
        functionName: "gameSigner",
      });

      expect(signer.toLowerCase()).toBe(
        gameSignerAccount.address.toLowerCase(),
      );
    });
  });

  describe("Items Contract Integration", () => {
    testWithBlockchain("can read item balance", async () => {
      const balance = await publicClient.readContract({
        address: ITEMS_ADDRESS,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [
              { name: "account", type: "address" },
              { name: "id", type: "uint256" },
            ],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [playerAccount.address, 1n], // Item ID 1 (Bronze Arrows)
      });

      expect(typeof balance).toBe("bigint");
    });

    testWithBlockchain("can read item metadata", async () => {
      const metadata = await publicClient.readContract({
        address: ITEMS_ADDRESS,
        abi: [
          {
            name: "getItemMetadata",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "itemId", type: "uint256" }],
            outputs: [
              {
                type: "tuple",
                components: [
                  { name: "itemId", type: "uint256" },
                  { name: "name", type: "string" },
                  { name: "stackable", type: "bool" },
                  { name: "attack", type: "int16" },
                  { name: "defense", type: "int16" },
                  { name: "strength", type: "int16" },
                  { name: "rarity", type: "uint8" },
                ],
              },
            ],
          },
        ],
        functionName: "getItemMetadata",
        args: [1n], // Bronze Arrows
      });

      expect(metadata.name).toBe("Bronze Arrows");
      expect(metadata.stackable).toBe(true);
      expect(metadata.rarity).toBe(0); // Common
    });

    testWithBlockchain("Legendary Sword is non-stackable", async () => {
      const metadata = await publicClient.readContract({
        address: ITEMS_ADDRESS,
        abi: [
          {
            name: "getItemMetadata",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "itemId", type: "uint256" }],
            outputs: [
              {
                type: "tuple",
                components: [
                  { name: "itemId", type: "uint256" },
                  { name: "name", type: "string" },
                  { name: "stackable", type: "bool" },
                  { name: "attack", type: "int16" },
                  { name: "defense", type: "int16" },
                  { name: "strength", type: "int16" },
                  { name: "rarity", type: "uint8" },
                ],
              },
            ],
          },
        ],
        functionName: "getItemMetadata",
        args: [2n], // Legendary Sword
      });

      expect(metadata.name).toBe("Legendary Sword");
      expect(metadata.stackable).toBe(false);
      expect(metadata.rarity).toBe(4); // Legendary
    });
  });

  describe("Game Economy Module Integration", () => {
    test("signGoldClaim creates valid signature", async () => {
      const { signGoldClaim } = await import("../game-economy");

      const signature = await signGoldClaim(
        playerAccount.address,
        parseEther("100"),
        0n,
        GAME_SIGNER_KEY as `0x${string}`,
      );

      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(signature.length).toBeGreaterThan(100);
    });

    test("signItemMint creates valid signature", async () => {
      const { signItemMint, generateInstanceId } =
        await import("../game-economy");

      const instanceId = generateInstanceId(
        playerAccount.address,
        1n,
        BigInt(Date.now()),
      );

      const signature = await signItemMint(
        playerAccount.address,
        1n,
        10n,
        instanceId,
        GAME_SIGNER_KEY as `0x${string}`,
      );

      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(signature.length).toBeGreaterThan(100);
    });

    test("generateInstanceId creates unique IDs", async () => {
      const { generateInstanceId } = await import("../game-economy");

      const id1 = generateInstanceId(
        playerAccount.address,
        1n,
        BigInt(Date.now()),
      );
      const id2 = generateInstanceId(
        playerAccount.address,
        1n,
        BigInt(Date.now()),
      );

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe("Session Keys Module", () => {
    test("creates session key pair", async () => {
      const { createSessionKeyPair } = await import("../session-keys");

      const { privateKey, address } = createSessionKeyPair();

      expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test("encrypts and decrypts session key", async () => {
      const { encryptSessionKey, decryptSessionKey, createSessionKeyPair } =
        await import("../session-keys");

      const { privateKey } = createSessionKeyPair();
      const encrypted = encryptSessionKey(privateKey);
      const decrypted = decryptSessionKey(encrypted);

      expect(decrypted).toBe(privateKey);
    });

    test("hasPermission works correctly", async () => {
      const { hasPermission } = await import("../session-keys");

      const sessionKey: SessionKey = {
        address: playerAccount.address,
        encryptedPrivateKey: "encrypted",
        owner: playerAccount.address,
        permissions: [
          {
            target: GOLD_ADDRESS,
            selector: "0x12345678",
          },
        ],
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        createdAt: Math.floor(Date.now() / 1000),
        isValid: true,
        transactionCount: 0,
        ownerSignature: "0x" as `0x${string}`,
      };

      // Should have permission
      expect(hasPermission(sessionKey, GOLD_ADDRESS, "0x12345678")).toBe(true);

      // Should not have permission for different selector
      expect(hasPermission(sessionKey, GOLD_ADDRESS, "0x87654321")).toBe(false);

      // Should not have permission for different target
      expect(hasPermission(sessionKey, ITEMS_ADDRESS, "0x12345678")).toBe(
        false,
      );
    });

    test("expired session has no permission", async () => {
      const { hasPermission } = await import("../session-keys");

      const expiredSession: SessionKey = {
        address: playerAccount.address,
        encryptedPrivateKey: "encrypted",
        owner: playerAccount.address,
        permissions: [
          {
            target: GOLD_ADDRESS,
            selector: "*",
          },
        ],
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        createdAt: Math.floor(Date.now() / 1000) - 7200,
        isValid: true,
        transactionCount: 0,
        ownerSignature: "0x" as `0x${string}`,
      };

      expect(hasPermission(expiredSession, GOLD_ADDRESS, "0x12345678")).toBe(
        false,
      );
    });
  });

  describe("Smart Account Module", () => {
    test("getSmartAccountAddress computes deterministic address", async () => {
      // This would require SimpleAccountFactory to be deployed
      // For now, just verify the function exists and returns expected type
      const { getSmartAccountAddress, SIMPLE_ACCOUNT_FACTORY } =
        await import("../smart-account");

      expect(SIMPLE_ACCOUNT_FACTORY).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(typeof getSmartAccountAddress).toBe("function");
    });

    test("createInitCode produces valid bytes", async () => {
      const { createInitCode } = await import("../smart-account");

      const initCode = createInitCode(playerAccount.address);

      expect(initCode).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(initCode.length).toBeGreaterThan(42); // More than just an address
    });

    test("createBundlerClient has expected methods", async () => {
      const { createBundlerClient } = await import("../smart-account");

      const client = createBundlerClient("http://localhost:4337", anvil);

      expect(typeof client.sendUserOperation).toBe("function");
      expect(typeof client.estimateUserOperationGas).toBe("function");
      expect(typeof client.getUserOperationReceipt).toBe("function");
      expect(typeof client.waitForUserOperationReceipt).toBe("function");
    });
  });

  describe("Chain Configuration", () => {
    test("getChain returns anvil config", async () => {
      const { getChain } = await import("../chain");

      const chain = getChain("anvil");
      expect(chain.id).toBe(31337);
      expect(chain.name).toBe("Anvil");
    });

    test("isBlockchainConfigured checks env vars", async () => {
      const { isBlockchainConfigured } = await import("../chain");

      // Without env vars set, should return false
      const result = isBlockchainConfigured();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("On-Chain Write Operations", () => {
    testWithBlockchain("can claim gold with valid signature", async () => {
      const { signGoldClaim } = await import("../game-economy");
      const { createWalletClient } = await import("viem");

      // Get initial balance
      const initialBalance = await publicClient.readContract({
        address: GOLD_ADDRESS,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [playerAccount.address],
      });

      // Get current nonce
      const nonce = await publicClient.readContract({
        address: GOLD_ADDRESS,
        abi: [
          {
            name: "getNonce",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "player", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "getNonce",
        args: [playerAccount.address],
      });

      // Sign gold claim
      const amount = parseEther("100");
      const signature = await signGoldClaim(
        playerAccount.address,
        amount,
        nonce,
        GAME_SIGNER_KEY as `0x${string}`,
      );

      // Create wallet client for player
      const walletClient = createWalletClient({
        account: playerAccount,
        chain: anvil,
        transport: http(RPC_URL),
      });

      // Execute claim
      const hash = await walletClient.writeContract({
        address: GOLD_ADDRESS,
        abi: [
          {
            name: "claimGold",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "amount", type: "uint256" },
              { name: "nonce", type: "uint256" },
              { name: "signature", type: "bytes" },
            ],
            outputs: [],
          },
        ],
        functionName: "claimGold",
        args: [amount, nonce, signature],
      });

      // Wait for transaction
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe("success");

      // Verify balance increased by claimed amount
      const newBalance = await publicClient.readContract({
        address: GOLD_ADDRESS,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [playerAccount.address],
      });

      expect(newBalance).toBe(initialBalance + amount);
    });

    testWithBlockchain(
      "can mint stackable items with valid signature",
      async () => {
        const { signItemMint, generateInstanceId } =
          await import("../game-economy");
        const { createWalletClient } = await import("viem");

        const itemId = 1n; // Bronze Arrows (stackable)
        const amount = 50n;
        const instanceId = generateInstanceId(
          playerAccount.address,
          itemId,
          BigInt(Date.now()),
        );

        // Get initial balance
        const initialBalance = await publicClient.readContract({
          address: ITEMS_ADDRESS,
          abi: [
            {
              name: "balanceOf",
              type: "function",
              stateMutability: "view",
              inputs: [
                { name: "account", type: "address" },
                { name: "id", type: "uint256" },
              ],
              outputs: [{ name: "", type: "uint256" }],
            },
          ],
          functionName: "balanceOf",
          args: [playerAccount.address, itemId],
        });

        // Sign item mint
        const signature = await signItemMint(
          playerAccount.address,
          itemId,
          amount,
          instanceId,
          GAME_SIGNER_KEY as `0x${string}`,
        );

        // Create wallet client for player
        const walletClient = createWalletClient({
          account: playerAccount,
          chain: anvil,
          transport: http(RPC_URL),
        });

        // Execute mint
        const hash = await walletClient.writeContract({
          address: ITEMS_ADDRESS,
          abi: [
            {
              name: "mintItem",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "itemId", type: "uint256" },
                { name: "amount", type: "uint256" },
                { name: "instanceId", type: "bytes32" },
                { name: "signature", type: "bytes" },
              ],
              outputs: [],
            },
          ],
          functionName: "mintItem",
          args: [itemId, amount, instanceId as `0x${string}`, signature],
        });

        // Wait for transaction
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        expect(receipt.status).toBe("success");

        // Verify balance increased by minted amount
        const newBalance = await publicClient.readContract({
          address: ITEMS_ADDRESS,
          abi: [
            {
              name: "balanceOf",
              type: "function",
              stateMutability: "view",
              inputs: [
                { name: "account", type: "address" },
                { name: "id", type: "uint256" },
              ],
              outputs: [{ name: "", type: "uint256" }],
            },
          ],
          functionName: "balanceOf",
          args: [playerAccount.address, itemId],
        });

        expect(newBalance).toBe(initialBalance + amount);
      },
    );

    testWithBlockchain("rejects gold claim with wrong nonce", async () => {
      const { signGoldClaim } = await import("../game-economy");
      const { createWalletClient } = await import("viem");

      const wrongNonce = 9999n;
      const amount = parseEther("100");

      const signature = await signGoldClaim(
        playerAccount.address,
        amount,
        wrongNonce,
        GAME_SIGNER_KEY as `0x${string}`,
      );

      const walletClient = createWalletClient({
        account: playerAccount,
        chain: anvil,
        transport: http(RPC_URL),
      });

      // Should revert
      await expect(
        walletClient.writeContract({
          address: GOLD_ADDRESS,
          abi: [
            {
              name: "claimGold",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "amount", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "signature", type: "bytes" },
              ],
              outputs: [],
            },
          ],
          functionName: "claimGold",
          args: [amount, wrongNonce, signature],
        }),
      ).rejects.toThrow();
    });

    testWithBlockchain("rejects item mint with invalid signature", async () => {
      const { generateInstanceId } = await import("../game-economy");
      const { createWalletClient } = await import("viem");

      const itemId = 1n;
      const amount = 10n;
      const instanceId = generateInstanceId(
        playerAccount.address,
        itemId,
        BigInt(Date.now()),
      );
      const invalidSignature = "0x" + "00".repeat(65); // Invalid signature

      const walletClient = createWalletClient({
        account: playerAccount,
        chain: anvil,
        transport: http(RPC_URL),
      });

      // Should revert
      await expect(
        walletClient.writeContract({
          address: ITEMS_ADDRESS,
          abi: [
            {
              name: "mintItem",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "itemId", type: "uint256" },
                { name: "amount", type: "uint256" },
                { name: "instanceId", type: "bytes32" },
                { name: "signature", type: "bytes" },
              ],
              outputs: [],
            },
          ],
          functionName: "mintItem",
          args: [
            itemId,
            amount,
            instanceId as `0x${string}`,
            invalidSignature as `0x${string}`,
          ],
        }),
      ).rejects.toThrow();
    });
  });
});
