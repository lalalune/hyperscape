#!/usr/bin/env bun
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  keccak256,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChainName, resolveChainConfig } from "../config/chains.js";

const DEFAULT_ANVIL_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const WORLD_ABI = [
  {
    name: "hyperia__getItemCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "count", type: "uint32" }],
  },
  {
    name: "hyperia__getNumericId",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "stringId", type: "string" }],
    outputs: [{ name: "numericId", type: "uint32" }],
  },
  {
    name: "hyperia__getPlayerAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "characterId", type: "bytes32" }],
    outputs: [{ name: "playerAddress", type: "address" }],
  },
  {
    name: "hyperia__balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "hyperia__registerPlayer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "playerAddress", type: "address" },
      { name: "characterId", type: "bytes32" },
      { name: "name", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__setInventorySlotBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "slotIndices", type: "uint8[]" },
      { name: "itemIds", type: "uint32[]" },
      { name: "quantities", type: "uint32[]" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__setEquipmentSlotBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "slotTypes", type: "uint8[]" },
      { name: "itemIds", type: "uint32[]" },
      { name: "quantities", type: "uint32[]" },
    ],
    outputs: [],
  },
] as const;

function getOperatorKey(chainId: number): Hex {
  const key = process.env.OPERATOR_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  if (key) return key as Hex;
  if (chainId === 31337) return DEFAULT_ANVIL_PRIVATE_KEY as Hex;
  throw new Error(
    "OPERATOR_PRIVATE_KEY or PRIVATE_KEY must be set for on-chain smoke tests",
  );
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main() {
  const config = resolveChainConfig();
  const chainName = getChainName(config);
  const operatorKey = getOperatorKey(config.chain.id);
  const account = privateKeyToAccount(operatorKey);

  if (!config.worldAddress || config.worldAddress === "0x0") {
    throw new Error("WORLD_ADDRESS is not set");
  }

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  console.log(`[onchain-smoke] Chain: ${chainName}`);
  console.log(`[onchain-smoke] World: ${config.worldAddress}`);
  console.log(`[onchain-smoke] Operator: ${account.address}`);

  const code = await publicClient.getCode({ address: config.worldAddress });
  assert(!!code && code !== "0x", "No contract code found at WORLD_ADDRESS");

  const itemCount = (await publicClient.readContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__getItemCount",
    account: account.address,
  })) as number;
  assert(itemCount > 0, "Item registry is empty");

  const bronzeArrowId = (await publicClient.readContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__getNumericId",
    args: ["bronze_arrow"],
    account: account.address,
  })) as number;
  assert(bronzeArrowId > 0, "bronze_arrow was not registered on-chain");

  const nonceSeed = Date.now().toString();
  const characterId = keccak256(stringToHex(`smoke-character-${nonceSeed}`));
  const playerAddress = `0x${keccak256(
    stringToHex(`smoke-player-${nonceSeed}`),
  ).slice(-40)}` as Address;

  const registerHash = await walletClient.writeContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__registerPlayer",
    args: [playerAddress, characterId, `Smoke-${nonceSeed.slice(-6)}`],
  });
  await publicClient.waitForTransactionReceipt({ hash: registerHash });

  const inventoryHash = await walletClient.writeContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__setInventorySlotBatch",
    args: [characterId, [0], [bronzeArrowId], [5]],
  });
  await publicClient.waitForTransactionReceipt({ hash: inventoryHash });

  const equipmentHash = await walletClient.writeContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__setEquipmentSlotBatch",
    args: [characterId, [0], [bronzeArrowId], [1]],
  });
  await publicClient.waitForTransactionReceipt({ hash: equipmentHash });

  const afterEquip = (await publicClient.readContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__balanceOf",
    args: [playerAddress, BigInt(bronzeArrowId)],
    account: account.address,
  })) as bigint;
  assert(afterEquip === 6n, `Expected balance 6, got ${afterEquip}`);

  const clearInventoryHash = await walletClient.writeContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__setInventorySlotBatch",
    args: [characterId, [0], [0], [0]],
  });
  await publicClient.waitForTransactionReceipt({ hash: clearInventoryHash });

  const clearEquipmentHash = await walletClient.writeContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__setEquipmentSlotBatch",
    args: [characterId, [0], [0], [0]],
  });
  await publicClient.waitForTransactionReceipt({ hash: clearEquipmentHash });

  const finalBalance = (await publicClient.readContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__balanceOf",
    args: [playerAddress, BigInt(bronzeArrowId)],
    account: account.address,
  })) as bigint;
  assert(finalBalance === 0n, `Expected final balance 0, got ${finalBalance}`);

  const resolvedOwner = (await publicClient.readContract({
    address: config.worldAddress,
    abi: WORLD_ABI,
    functionName: "hyperia__getPlayerAddress",
    args: [characterId],
    account: account.address,
  })) as Address;
  assert(
    resolvedOwner.toLowerCase() === playerAddress.toLowerCase(),
    "Character owner lookup mismatch",
  );

  console.log("[onchain-smoke] PASS");
  console.log(
    `[onchain-smoke] Verified item registry, player registration, inventory/equipment writes, and ERC-1155 balances`,
  );
}

main().catch((err) => {
  console.error("[onchain-smoke] FAIL:", err);
  process.exit(1);
});
