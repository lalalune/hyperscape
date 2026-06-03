#!/usr/bin/env bun
/**
 * Seed Shops On-Chain
 *
 * Reads stores.json and seeds shop inventories into the MUD World contract.
 * Each shop item gets a row in the ShopItem table with price and stock info.
 *
 * Run after seed-items.ts (items must be registered first):
 *   bun packages/web3/src/mapping/seed-shops.ts
 *
 * Requires env vars:
 *   WORLD_ADDRESS - deployed World contract address
 *   PRIVATE_KEY or OPERATOR_PRIVATE_KEY - deployer/operator private key
 *   CHAIN - "anvil" (default), "base-sepolia", or set MAINNET=true
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  keccak256,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChainConfig, getChainName } from "../config/chains.js";
import { buildItemIdMap, getManifestsDir } from "./ItemIdMapping.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface StoreItem {
  id: string;
  itemId: string;
  name: string;
  price: number;
  stockQuantity: number;
  restockTime: number;
  description: string;
  category: string;
}

interface Store {
  id: string;
  name: string;
  buyback: boolean;
  buybackRate: number;
  description: string;
  items: StoreItem[];
}

const SHOP_BATCH_SIZE = 30;

async function main() {
  const config = resolveChainConfig();
  const chainName = getChainName(config);
  console.log(`[seed-shops] Chain: ${chainName}`);
  console.log(`[seed-shops] World: ${config.worldAddress}`);

  const operatorKey =
    process.env.OPERATOR_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  if (!operatorKey) {
    console.error(
      "[seed-shops] ERROR: OPERATOR_PRIVATE_KEY or PRIVATE_KEY required",
    );
    process.exit(1);
  }

  const account = privateKeyToAccount(operatorKey as `0x${string}`);
  console.log(`[seed-shops] Operator: ${account.address}`);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  // Load item mapping (needed to translate string IDs to numeric IDs)
  const manifestsDir = getManifestsDir();
  const mapping = await buildItemIdMap(manifestsDir);

  // Load stores.json
  const storesPath = join(manifestsDir, "stores.json");
  const storesData = await readFile(storesPath, "utf-8");
  const stores = JSON.parse(storesData) as Store[];

  console.log(`[seed-shops] Found ${stores.length} stores`);

  let totalItems = 0;

  for (const store of stores) {
    const shopId = keccak256(stringToHex(store.id));
    console.log(
      `\n[seed-shops] Seeding store: ${store.name} (${store.items.length} items)`,
    );

    // Prepare batch arrays
    const shopIds: `0x${string}`[] = [];
    const slotIndices: number[] = [];
    const itemIds: number[] = [];
    const basePrices: number[] = [];
    const maxStocks: number[] = [];
    const currentStocks: number[] = [];

    for (let i = 0; i < store.items.length; i++) {
      const storeItem = store.items[i];
      const numericId = mapping.stringToNumeric.get(storeItem.itemId);

      if (numericId === undefined) {
        console.warn(
          `  WARNING: Item "${storeItem.itemId}" not in mapping, skipping`,
        );
        continue;
      }

      shopIds.push(shopId);
      slotIndices.push(i);
      itemIds.push(numericId);
      basePrices.push(storeItem.price);
      maxStocks.push(storeItem.stockQuantity); // -1 = unlimited
      currentStocks.push(storeItem.stockQuantity); // Start at max
    }

    // Send in batches
    for (let i = 0; i < shopIds.length; i += SHOP_BATCH_SIZE) {
      const batchEnd = Math.min(i + SHOP_BATCH_SIZE, shopIds.length);
      const callData = encodeFunctionData({
        abi: SHOP_SYSTEM_ABI,
        functionName: "hyperia__seedShopItemBatch",
        args: [
          shopIds.slice(i, batchEnd),
          slotIndices.slice(i, batchEnd),
          itemIds.slice(i, batchEnd),
          basePrices.slice(i, batchEnd),
          maxStocks.slice(i, batchEnd),
          currentStocks.slice(i, batchEnd),
        ],
      });

      const txHash = await walletClient.sendTransaction({
        to: config.worldAddress,
        data: callData,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      const count = batchEnd - i;
      totalItems += count;
      console.log(
        `  Seeded items ${i + 1}-${batchEnd} ` +
          `(tx: ${txHash.slice(0, 10)}..., gas: ${receipt.gasUsed})`,
      );
    }
  }

  console.log(
    `\n[seed-shops] COMPLETE: ${totalItems} shop items across ${stores.length} stores`,
  );
}

const SHOP_SYSTEM_ABI = [
  {
    name: "hyperia__seedShopItemBatch",
    type: "function",
    inputs: [
      { name: "shopIds", type: "bytes32[]" },
      { name: "slotIndices", type: "uint8[]" },
      { name: "itemIds", type: "uint32[]" },
      { name: "basePrices", type: "uint32[]" },
      { name: "maxStocks", type: "int32[]" },
      { name: "currentStocks", type: "int32[]" },
    ],
    outputs: [],
  },
] as const;

main().catch((err) => {
  console.error("[seed-shops] FATAL:", err);
  process.exit(1);
});
