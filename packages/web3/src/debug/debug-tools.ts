#!/usr/bin/env bun
import {
  createPublicClient,
  http,
  keccak256,
  stringToHex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChainName, resolveChainConfig } from "../config/chains.js";

const DEFAULT_ANVIL_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const ABI = [
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
    name: "hyperia__getStringId",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "numericId", type: "uint32" }],
    outputs: [{ name: "stringId", type: "string" }],
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
    name: "hyperia__isPlayerRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "playerAddress", type: "address" }],
    outputs: [{ name: "registered", type: "bool" }],
  },
  {
    name: "hyperia__getCharacterId",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "playerAddress", type: "address" }],
    outputs: [{ name: "characterId", type: "bytes32" }],
  },
  {
    name: "hyperia__getGold",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "characterId", type: "bytes32" }],
    outputs: [{ name: "amount", type: "uint64" }],
  },
  {
    name: "hyperia__getTradeSession",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tradeId", type: "bytes32" }],
    outputs: [
      { name: "initiator", type: "address" },
      { name: "recipient", type: "address" },
      { name: "status", type: "uint8" },
      { name: "initiatorAccepted", type: "bool" },
      { name: "recipientAccepted", type: "bool" },
      { name: "initiatorGold", type: "uint64" },
      { name: "recipientGold", type: "uint64" },
    ],
  },
  {
    name: "hyperia__getTradeOffer",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tradeId", type: "bytes32" },
      { name: "side", type: "uint8" },
      { name: "offerIndex", type: "uint8" },
    ],
    outputs: [
      { name: "itemId", type: "uint32" },
      { name: "quantity", type: "uint32" },
      { name: "sourceSlot", type: "uint8" },
    ],
  },
  {
    name: "hyperia__getPlayerStats",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "characterId", type: "bytes32" }],
    outputs: [
      { name: "totalMobKills", type: "uint32" },
      { name: "totalDeaths", type: "uint32" },
      { name: "totalPlayerKills", type: "uint32" },
      { name: "totalBossKills", type: "uint32" },
      { name: "totalXpEarned", type: "uint64" },
      { name: "totalGoldEarned", type: "uint64" },
      { name: "totalTradesCompleted", type: "uint32" },
      { name: "totalDuelsWon", type: "uint32" },
      { name: "totalDuelsLost", type: "uint32" },
    ],
  },
  {
    name: "hyperia__getNpcKillCount",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "npcId", type: "bytes32" },
    ],
    outputs: [{ name: "killCount", type: "uint32" }],
  },
] as const;

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

function usage(): never {
  console.log("Usage:");
  console.log("  bun src/debug/debug-tools.ts chain");
  console.log(
    "  bun src/debug/debug-tools.ts item --string bronze_arrow | --id 1",
  );
  console.log(
    "  bun src/debug/debug-tools.ts player --address 0x... [--item-id 1 | --item-string bronze_arrow] [--character 0x...]",
  );
  console.log(
    "  bun src/debug/debug-tools.ts trade --id 0x... [--offer-side 0|1 --offer-index 0]",
  );
  console.log(
    "  bun src/debug/debug-tools.ts stats --character 0x... [--npc goblin]",
  );
  process.exit(1);
}

async function main() {
  const command = process.argv[2] ?? "chain";
  const config = resolveChainConfig();
  const chainName = getChainName(config);
  const world = config.worldAddress;

  if (!world || world === "0x0") {
    throw new Error("WORLD_ADDRESS is not set");
  }

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
  const readKey =
    process.env.OPERATOR_PRIVATE_KEY ??
    process.env.PRIVATE_KEY ??
    (config.chain.id === 31337 ? DEFAULT_ANVIL_PRIVATE_KEY : undefined);
  const readAccount = readKey
    ? privateKeyToAccount(readKey as `0x${string}`)
    : undefined;

  if (command === "chain") {
    const block = await client.getBlockNumber();
    const code = await client.getCode({ address: world });
    const itemCount = (await client.readContract({
      address: world,
      abi: ABI,
      functionName: "hyperia__getItemCount",
      account: readAccount?.address,
    })) as number;

    console.log(`[debug:chain] ${chainName}`);
    console.log(`[debug:chain] RPC: ${config.rpcUrl}`);
    console.log(`[debug:chain] World: ${world}`);
    console.log(`[debug:chain] Block: ${block}`);
    console.log(
      `[debug:chain] Code: ${code && code !== "0x" ? "present" : "missing"}`,
    );
    console.log(`[debug:chain] Registered items: ${itemCount}`);
    return;
  }

  if (command === "item") {
    const stringId = getArg("--string");
    const idArg = getArg("--id");

    if (!stringId && !idArg) usage();

    if (stringId) {
      const numericId = (await client.readContract({
        address: world,
        abi: ABI,
        functionName: "hyperia__getNumericId",
        args: [stringId],
        account: readAccount?.address,
      })) as number;
      console.log(`[debug:item] ${stringId} -> ${numericId}`);
      return;
    }

    const numericId = Number(idArg);
    const resolved = (await client.readContract({
      address: world,
      abi: ABI,
      functionName: "hyperia__getStringId",
      args: [numericId],
      account: readAccount?.address,
    })) as string;
    console.log(`[debug:item] ${numericId} -> ${resolved || "<not found>"}`);
    return;
  }

  if (command === "player") {
    const address = getArg("--address") as Address | undefined;
    const characterId = getArg("--character") as `0x${string}` | undefined;
    const itemString = getArg("--item-string");
    const itemIdArg = getArg("--item-id");

    if (!address) usage();

    console.log(`[debug:player] Address: ${address}`);
    const registered = (await client.readContract({
      address: world,
      abi: ABI,
      functionName: "hyperia__isPlayerRegistered",
      args: [address],
      account: readAccount?.address,
    })) as boolean;
    console.log(`[debug:player] Registered: ${registered}`);

    const linkedCharacter = (await client.readContract({
      address: world,
      abi: ABI,
      functionName: "hyperia__getCharacterId",
      args: [address],
      account: readAccount?.address,
    })) as `0x${string}`;
    console.log(`[debug:player] Character: ${linkedCharacter}`);

    if (characterId) {
      const owner = (await client.readContract({
        address: world,
        abi: ABI,
        functionName: "hyperia__getPlayerAddress",
        args: [characterId],
        account: readAccount?.address,
      })) as Address;
      console.log(`[debug:player] Character owner: ${owner}`);

      const gold = (await client.readContract({
        address: world,
        abi: ABI,
        functionName: "hyperia__getGold",
        args: [characterId],
        account: readAccount?.address,
      })) as bigint;
      console.log(`[debug:player] Gold: ${gold}`);
    }

    let itemId: number | undefined;
    if (itemString) {
      itemId = (await client.readContract({
        address: world,
        abi: ABI,
        functionName: "hyperia__getNumericId",
        args: [itemString],
        account: readAccount?.address,
      })) as number;
      console.log(`[debug:player] Item ${itemString} -> ${itemId}`);
    } else if (itemIdArg) {
      itemId = Number(itemIdArg);
    }

    if (itemId !== undefined) {
      const balance = (await client.readContract({
        address: world,
        abi: ABI,
        functionName: "hyperia__balanceOf",
        args: [address, BigInt(itemId)],
        account: readAccount?.address,
      })) as bigint;
      console.log(`[debug:player] balanceOf(${itemId}) = ${balance}`);
    }
    return;
  }

  if (command === "trade") {
    const tradeId = getArg("--id") as `0x${string}` | undefined;
    const offerSideArg = getArg("--offer-side");
    const offerIndexArg = getArg("--offer-index");

    if (!tradeId) usage();

    const [
      initiator,
      recipient,
      status,
      initiatorAccepted,
      recipientAccepted,
      initiatorGold,
      recipientGold,
    ] = (await client.readContract({
      address: world,
      abi: ABI,
      functionName: "hyperia__getTradeSession",
      args: [tradeId],
      account: readAccount?.address,
    })) as readonly [
      Address,
      Address,
      number | bigint,
      boolean,
      boolean,
      bigint,
      bigint,
    ];

    const statusCode = Number(status);
    const statusName =
      statusCode === 0
        ? "Pending"
        : statusCode === 1
          ? "Active"
          : statusCode === 2
            ? "Confirming"
            : statusCode === 3
              ? "Completed"
              : statusCode === 4
                ? "Cancelled"
                : `Unknown(${statusCode})`;

    console.log(`[debug:trade] ID: ${tradeId}`);
    console.log(`[debug:trade] Initiator: ${initiator}`);
    console.log(`[debug:trade] Recipient: ${recipient}`);
    console.log(`[debug:trade] Status: ${statusName}`);
    console.log(
      `[debug:trade] Accepted: initiator=${initiatorAccepted}, recipient=${recipientAccepted}`,
    );
    console.log(
      `[debug:trade] Gold: initiator=${initiatorGold}, recipient=${recipientGold}`,
    );

    if (offerSideArg !== undefined && offerIndexArg !== undefined) {
      const side = Number(offerSideArg);
      const offerIndex = Number(offerIndexArg);
      const [itemId, quantity, sourceSlot] = (await client.readContract({
        address: world,
        abi: ABI,
        functionName: "hyperia__getTradeOffer",
        args: [tradeId, side, offerIndex],
        account: readAccount?.address,
      })) as readonly [number | bigint, number | bigint, number | bigint];
      console.log(
        `[debug:trade] Offer side=${side} index=${offerIndex}: itemId=${itemId}, quantity=${quantity}, sourceSlot=${sourceSlot}`,
      );
    }
    return;
  }

  if (command === "stats") {
    const characterId = getArg("--character") as `0x${string}` | undefined;
    const npcStringId = getArg("--npc");
    if (!characterId) usage();

    const stats = (await client.readContract({
      address: world,
      abi: ABI,
      functionName: "hyperia__getPlayerStats",
      args: [characterId],
      account: readAccount?.address,
    })) as readonly [
      number | bigint,
      number | bigint,
      number | bigint,
      number | bigint,
      bigint,
      bigint,
      number | bigint,
      number | bigint,
      number | bigint,
    ];

    console.log(`[debug:stats] Character: ${characterId}`);
    console.log(`[debug:stats] totalMobKills=${stats[0]}`);
    console.log(`[debug:stats] totalDeaths=${stats[1]}`);
    console.log(`[debug:stats] totalPlayerKills=${stats[2]}`);
    console.log(`[debug:stats] totalBossKills=${stats[3]}`);
    console.log(`[debug:stats] totalXpEarned=${stats[4]}`);
    console.log(`[debug:stats] totalGoldEarned=${stats[5]}`);
    console.log(`[debug:stats] totalTradesCompleted=${stats[6]}`);
    console.log(`[debug:stats] totalDuelsWon=${stats[7]}`);
    console.log(`[debug:stats] totalDuelsLost=${stats[8]}`);

    if (npcStringId) {
      const npcId = keccak256(stringToHex(npcStringId));
      const npcKills = (await client.readContract({
        address: world,
        abi: ABI,
        functionName: "hyperia__getNpcKillCount",
        args: [characterId, npcId],
        account: readAccount?.address,
      })) as number | bigint;
      console.log(`[debug:stats] npc(${npcStringId}) kills=${npcKills}`);
    }
    return;
  }

  usage();
}

main().catch((err) => {
  console.error("[debug-tools] ERROR:", err);
  process.exit(1);
});
