#!/usr/bin/env bun
/**
 * Seed Items On-Chain
 *
 * Reads all item manifests and seeds them into the MUD World contract:
 * 1. Registers all item IDs in the bidirectional mapping (ItemRegistrySystem)
 * 2. Sets item definitions (name, type, value, etc.)
 * 3. Sets combat bonuses for equipment items
 * 4. Sets level requirements for equipment items
 *
 * Run after `mud deploy`:
 *   bun packages/web3/src/mapping/seed-items.ts
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
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChainConfig, getChainName } from "../config/chains.js";
import {
  buildItemIdMap,
  loadAllManifestItems,
  getManifestsDir,
  itemTypeToCategory,
  equipSlotToUint8,
} from "./ItemIdMapping.js";

// Batch size for on-chain writes (too many in one tx = out of gas)
const REGISTRATION_BATCH_SIZE = 50;
const DEFINITION_BATCH_SIZE = 20;
const NOTED_BATCH_SIZE = 50;
const REQUIREMENTS_BATCH_SIZE = 50;

async function main() {
  const config = resolveChainConfig();
  const chainName = getChainName(config);
  console.log(`[seed-items] Chain: ${chainName}`);
  console.log(`[seed-items] World: ${config.worldAddress}`);

  const operatorKey =
    process.env.OPERATOR_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  if (!operatorKey) {
    console.error(
      "[seed-items] ERROR: OPERATOR_PRIVATE_KEY or PRIVATE_KEY required",
    );
    process.exit(1);
  }

  const account = privateKeyToAccount(operatorKey as `0x${string}`);
  console.log(`[seed-items] Operator: ${account.address}`);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  // Load manifests
  const manifestsDir = getManifestsDir();
  const mapping = await buildItemIdMap(manifestsDir);
  const allItems = await loadAllManifestItems(manifestsDir);

  console.log(
    `[seed-items] Found ${allItems.length} base items, ${mapping.totalItemCount} total with noted`,
  );

  // Step 1: Register all item IDs in batches
  console.log("\n[seed-items] Step 1: Registering item IDs...");
  const sortedItems = [...allItems].sort((a, b) => a.id.localeCompare(b.id));
  const stringIds = sortedItems.map((item) => item.id);

  for (let i = 0; i < stringIds.length; i += REGISTRATION_BATCH_SIZE) {
    const batch = stringIds.slice(i, i + REGISTRATION_BATCH_SIZE);
    const callData = encodeFunctionData({
      abi: ITEM_REGISTRY_ABI,
      functionName: "hyperia__registerItemBatch",
      args: [batch],
    });

    const txHash = await walletClient.sendTransaction({
      to: config.worldAddress,
      data: callData,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    console.log(
      `  Registered items ${i + 1}-${Math.min(i + batch.length, stringIds.length)} ` +
        `(tx: ${txHash.slice(0, 10)}..., gas: ${receipt.gasUsed})`,
    );
  }

  // Register noted variants with explicit IDs
  console.log("\n[seed-items] Registering noted variants...");
  const notedNumericIds: number[] = [];
  const notedStringIds: string[] = [];

  for (const item of sortedItems) {
    const shouldNote =
      item.tradeable !== false && !item.stackable && item.type !== "currency";
    if (!shouldNote) continue;

    const notedStringId = `${item.id}_noted`;
    const baseNumericId = mapping.stringToNumeric.get(item.id);
    if (baseNumericId === undefined) continue;

    const notedNumericId = baseNumericId + 10000;
    notedNumericIds.push(notedNumericId);
    notedStringIds.push(notedStringId);
  }
  for (let i = 0; i < notedNumericIds.length; i += NOTED_BATCH_SIZE) {
    const numericBatch = notedNumericIds.slice(i, i + NOTED_BATCH_SIZE);
    const stringBatch = notedStringIds.slice(i, i + NOTED_BATCH_SIZE);
    const callData = encodeFunctionData({
      abi: ITEM_REGISTRY_ABI,
      functionName: "hyperia__registerItemWithIdBatch",
      args: [numericBatch, stringBatch],
    });

    const txHash = await walletClient.sendTransaction({
      to: config.worldAddress,
      data: callData,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
  }
  const notedCount = notedNumericIds.length;
  console.log(`  Registered ${notedCount} noted variants`);

  // Step 2: Set item definitions in batches
  console.log("\n[seed-items] Step 2: Setting item definitions...");
  for (let i = 0; i < sortedItems.length; i += DEFINITION_BATCH_SIZE) {
    const batch = sortedItems.slice(i, i + DEFINITION_BATCH_SIZE);
    const numericIds: number[] = [];
    const names: string[] = [];
    const packedStatics: number[] = [];

    for (const item of batch) {
      const numericId = mapping.stringToNumeric.get(item.id);
      if (numericId === undefined) continue;

      numericIds.push(numericId);
      names.push(item.name);

      const itemType = itemTypeToCategory(item.type);
      const value = item.value ?? 0;
      const stackable = item.stackable ?? false;
      const tradeable = item.tradeable ?? true;
      const equipSlot = equipSlotToUint8(item.equipSlot);
      const healAmount = item.healAmount ?? 0;

      // Pack static fields into 10 bytes:
      // [itemType(1), value(4), stackable(1), tradeable(1), equipSlot(1), healAmount(2)]
      packedStatics.push(itemType & 0xff);
      packedStatics.push((value >>> 24) & 0xff);
      packedStatics.push((value >>> 16) & 0xff);
      packedStatics.push((value >>> 8) & 0xff);
      packedStatics.push(value & 0xff);
      packedStatics.push(stackable ? 1 : 0);
      packedStatics.push(tradeable ? 1 : 0);
      packedStatics.push(equipSlot & 0xff);
      packedStatics.push((healAmount >>> 8) & 0xff);
      packedStatics.push(healAmount & 0xff);
    }

    if (numericIds.length === 0) continue;
    const packedStaticsHex = `0x${Buffer.from(packedStatics).toString("hex")}`;

    const callData = encodeFunctionData({
      abi: ITEM_REGISTRY_ABI,
      functionName: "hyperia__setItemDefinitionBatch",
      args: [numericIds, names, packedStaticsHex],
    });

    const txHash = await walletClient.sendTransaction({
      to: config.worldAddress,
      data: callData,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log(
      `  Defined items ${i + 1}-${Math.min(i + batch.length, sortedItems.length)} ` +
        `(tx: ${txHash.slice(0, 10)}...)`,
    );
  }

  // Step 3: Set level requirements for items that have them
  console.log("\n[seed-items] Step 3: Setting level requirements...");
  const reqNumericIds: number[] = [];
  const packedRequirements: number[] = [];

  for (const item of sortedItems) {
    if (!item.requirements?.skills) continue;
    const numericId = mapping.stringToNumeric.get(item.id);
    if (numericId === undefined) continue;

    const skills = item.requirements.skills;
    reqNumericIds.push(numericId);
    packedRequirements.push(skills.attack ?? 0);
    packedRequirements.push(skills.strength ?? 0);
    packedRequirements.push(skills.defense ?? 0);
    packedRequirements.push(skills.ranged ?? 0);
    packedRequirements.push(skills.magic ?? 0);
    packedRequirements.push(skills.prayer ?? 0);
  }

  for (let i = 0; i < reqNumericIds.length; i += REQUIREMENTS_BATCH_SIZE) {
    const idBatch = reqNumericIds.slice(i, i + REQUIREMENTS_BATCH_SIZE);
    const reqStart = i * 6;
    const reqEnd = (i + idBatch.length) * 6;
    const reqBytes = packedRequirements.slice(reqStart, reqEnd);
    const packedReqHex = `0x${Buffer.from(reqBytes).toString("hex")}`;

    const callData = encodeFunctionData({
      abi: ITEM_REGISTRY_ABI,
      functionName: "hyperia__setItemRequirementsBatch",
      args: [idBatch, packedReqHex],
    });

    const txHash = await walletClient.sendTransaction({
      to: config.worldAddress,
      data: callData,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
  }
  const reqCount = reqNumericIds.length;
  console.log(`  Set requirements for ${reqCount} items`);

  console.log("\n[seed-items] COMPLETE");
  console.log(`  ${mapping.baseItemCount} base items registered`);
  console.log(`  ${notedCount} noted variants registered`);
  console.log(`  ${reqCount} requirement sets`);
}

// ABI fragments for ItemRegistrySystem calls
const ITEM_REGISTRY_ABI = [
  {
    name: "hyperia__registerItemBatch",
    type: "function",
    inputs: [{ name: "stringIds", type: "string[]" }],
    outputs: [{ name: "numericIds", type: "uint32[]" }],
  },
  {
    name: "hyperia__registerItemWithIdBatch",
    type: "function",
    inputs: [
      { name: "numericIds", type: "uint32[]" },
      { name: "stringIds", type: "string[]" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__setItemDefinitionBatch",
    type: "function",
    inputs: [
      { name: "numericIds", type: "uint32[]" },
      { name: "names", type: "string[]" },
      { name: "packedStatics", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__setItemRequirementsBatch",
    type: "function",
    inputs: [
      { name: "numericIds", type: "uint32[]" },
      { name: "packedRequirements", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

main().catch((err) => {
  console.error("[seed-items] FATAL:", err);
  process.exit(1);
});
