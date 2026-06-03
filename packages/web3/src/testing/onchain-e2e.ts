#!/usr/bin/env bun
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEther,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChainName, resolveChainConfig } from "../config/chains.js";

const ANVIL_OPERATOR_KEY =
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
    name: "hyperia__getPlayerAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "characterId", type: "bytes32" }],
    outputs: [{ name: "playerAddress", type: "address" }],
  },
  {
    name: "hyperia__isPlayerRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "playerAddress", type: "address" }],
    outputs: [{ name: "registered", type: "bool" }],
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
  {
    name: "hyperia__getInventorySlot",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "slotIndex", type: "uint8" },
    ],
    outputs: [
      { name: "itemId", type: "uint32" },
      { name: "quantity", type: "uint32" },
    ],
  },
  {
    name: "hyperia__setGold",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "characterId", type: "bytes32" },
      { name: "amount", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__getGold",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "characterId", type: "bytes32" }],
    outputs: [{ name: "amount", type: "uint64" }],
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
    name: "hyperia__createTrade",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tradeId", type: "bytes32" },
      { name: "initiatorAddress", type: "address" },
      { name: "recipientAddress", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__offerItem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tradeId", type: "bytes32" },
      { name: "inventorySlot", type: "uint8" },
      { name: "quantity", type: "uint32" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__offerGold",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tradeId", type: "bytes32" },
      { name: "amount", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__acceptTrade",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "tradeId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "hyperia__cancelTrade",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "tradeId", type: "bytes32" }],
    outputs: [],
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
    name: "hyperia__commitCombatResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "resultId", type: "bytes32" },
      { name: "characterId", type: "bytes32" },
      { name: "targetNpcId", type: "bytes32" },
      { name: "goldDropped", type: "uint32" },
      { name: "lootItemIds", type: "uint32[]" },
      { name: "lootQuantities", type: "uint32[]" },
      { name: "lootTargetSlots", type: "uint8[]" },
    ],
    outputs: [],
  },
  {
    name: "hyperia__recordDeath",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "characterId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "hyperia__recordPlayerKill",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "killerCharacterId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "hyperia__recordDuel",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "duelId", type: "bytes32" },
      { name: "challengerAddress", type: "address" },
      { name: "opponentAddress", type: "address" },
      { name: "winnerAddress", type: "address" },
      { name: "challengerStakeValue", type: "uint64" },
      { name: "opponentStakeValue", type: "uint64" },
      { name: "forfeit", type: "bool" },
    ],
    outputs: [],
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

const TRADE_STATUS_ACTIVE = 1n;
const TRADE_STATUS_COMPLETED = 3n;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function asBigInt(value: bigint | number): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

async function main() {
  const config = resolveChainConfig();
  const chainName = getChainName(config);
  const world = config.worldAddress;

  if (config.chain.id !== 31337) {
    throw new Error(
      `onchain-e2e only supports local Anvil (chainId 31337). Got ${config.chain.id}`,
    );
  }
  if (!world || world === "0x0") {
    throw new Error("WORLD_ADDRESS is not set");
  }

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const operator = privateKeyToAccount(
    (process.env.OPERATOR_PRIVATE_KEY ??
      process.env.PRIVATE_KEY ??
      ANVIL_OPERATOR_KEY) as Hex,
  );

  const operatorClient = createWalletClient({
    account: operator,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const runNonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const keyA = keccak256(stringToHex(`onchain-e2e-agent-a-${runNonce}`));
  const keyB = keccak256(stringToHex(`onchain-e2e-agent-b-${runNonce}`));
  const keyAttacker = keccak256(
    stringToHex(`onchain-e2e-attacker-${runNonce}`),
  );

  const agentA = privateKeyToAccount(keyA);
  const agentB = privateKeyToAccount(keyB);
  const attacker = privateKeyToAccount(keyAttacker);

  const agentAClient = createWalletClient({
    account: agentA,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
  const agentBClient = createWalletClient({
    account: agentB,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
  const attackerClient = createWalletClient({
    account: attacker,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const code = await publicClient.getCode({ address: world });
  assert(!!code && code !== "0x", `No contract code at WORLD_ADDRESS ${world}`);

  const fund = async (to: Address) => {
    const hash = await operatorClient.sendTransaction({
      to,
      value: parseEther("5"),
    });
    await publicClient.waitForTransactionReceipt({ hash });
  };

  const sendAndWait = async (
    label: string,
    write: () => Promise<Hex>,
  ): Promise<Hex> => {
    const hash = await write();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert(
      receipt.status === "success",
      `${label} failed with status ${receipt.status}`,
    );
    console.log(`[onchain-e2e] ok: ${label}`);
    return hash;
  };

  const expectRevert = async (
    label: string,
    action: () => Promise<unknown>,
  ) => {
    try {
      await action();
      throw new Error(`${label} did not revert`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const reverted =
        /revert|denied|unauthorized|simulation|NotTradeParticipant/i.test(msg);
      if (!reverted) {
        throw new Error(`${label} failed with unexpected error: ${msg}`);
      }
      console.log(`[onchain-e2e] ok: ${label} reverted`);
    }
  };

  const readNumericItemId = async (itemStringId: string): Promise<number> => {
    const numericId = (await publicClient.readContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__getNumericId",
      args: [itemStringId],
      account: operator.address,
    })) as number;
    if (numericId <= 0) {
      throw new Error(
        `Missing on-chain item registry entry for '${itemStringId}'`,
      );
    }
    return numericId;
  };

  const readBalance = async (account: Address, tokenId: number) => {
    return (await publicClient.readContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__balanceOf",
      args: [account, BigInt(tokenId)],
      account: operator.address,
    })) as bigint;
  };

  const findInventorySlotWithItem = async (
    characterId: Hex,
    itemId: number,
  ): Promise<number | null> => {
    for (let slot = 0; slot < 28; slot++) {
      const [slotItemId, slotQty] = (await publicClient.readContract({
        address: world,
        abi: WORLD_ABI,
        functionName: "hyperia__getInventorySlot",
        args: [characterId, slot],
        account: operator.address,
      })) as readonly [number | bigint, number | bigint];
      if (Number(slotItemId) === itemId && asBigInt(slotQty) > 0n) {
        return slot;
      }
    }
    return null;
  };

  const findEmptyInventorySlot = async (characterId: Hex): Promise<number> => {
    for (let slot = 0; slot < 28; slot++) {
      const [slotItemId, slotQty] = (await publicClient.readContract({
        address: world,
        abi: WORLD_ABI,
        functionName: "hyperia__getInventorySlot",
        args: [characterId, slot],
        account: operator.address,
      })) as readonly [number | bigint, number | bigint];
      if (Number(slotItemId) === 0 && asBigInt(slotQty) === 0n) {
        return slot;
      }
    }
    throw new Error("No empty inventory slot found");
  };

  console.log(`[onchain-e2e] Chain: ${chainName}`);
  console.log(`[onchain-e2e] RPC: ${config.rpcUrl}`);
  console.log(`[onchain-e2e] World: ${world}`);
  console.log(`[onchain-e2e] Operator: ${operator.address}`);

  const itemCount = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getItemCount",
    account: operator.address,
  })) as number;
  assert(itemCount > 0, "Item registry is empty on-chain");

  const bronzeSwordId = await readNumericItemId("bronze_sword");
  const ironSwordId = await readNumericItemId("iron_sword");
  const bonesId = await readNumericItemId("bones");
  const bronzeArrowId = await readNumericItemId("bronze_arrow");

  const characterA = keccak256(stringToHex(`character-a-${runNonce}`));
  const characterB = keccak256(stringToHex(`character-b-${runNonce}`));

  await fund(agentA.address);
  await fund(agentB.address);
  await fund(attacker.address);

  await sendAndWait("register agent A", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__registerPlayer",
      args: [agentA.address, characterA, `AgentA-${runNonce.slice(-6)}`],
    }),
  );
  await sendAndWait("register agent B", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__registerPlayer",
      args: [agentB.address, characterB, `AgentB-${runNonce.slice(-6)}`],
    }),
  );

  const ownerA = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getPlayerAddress",
    args: [characterA],
    account: operator.address,
  })) as Address;
  const ownerB = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getPlayerAddress",
    args: [characterB],
    account: operator.address,
  })) as Address;
  assertEq(
    ownerA.toLowerCase(),
    agentA.address.toLowerCase(),
    "owner lookup A",
  );
  assertEq(
    ownerB.toLowerCase(),
    agentB.address.toLowerCase(),
    "owner lookup B",
  );

  const registeredA = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__isPlayerRegistered",
    args: [agentA.address],
    account: operator.address,
  })) as boolean;
  const registeredB = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__isPlayerRegistered",
    args: [agentB.address],
    account: operator.address,
  })) as boolean;
  assert(registeredA, "agent A not registered");
  assert(registeredB, "agent B not registered");

  await sendAndWait("seed inventory agent A (trade weapon)", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__setInventorySlotBatch",
      args: [characterA, [0], [bronzeSwordId], [1]],
    }),
  );
  await sendAndWait("seed inventory agent B (trade weapon)", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__setInventorySlotBatch",
      args: [characterB, [0], [ironSwordId], [1]],
    }),
  );
  await sendAndWait("test mode equip insta-damage ammo on agent A", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__setEquipmentSlotBatch",
      args: [characterA, [10], [bronzeArrowId], [1_000_000]],
    }),
  );
  await sendAndWait("set starting gold agent A", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__setGold",
      args: [characterA, 500n],
    }),
  );
  await sendAndWait("set starting gold agent B", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__setGold",
      args: [characterB, 200n],
    }),
  );

  assertEq(
    await readBalance(agentA.address, bronzeSwordId),
    1n,
    "agent A bronze sword balance",
  );
  assertEq(
    await readBalance(agentB.address, ironSwordId),
    1n,
    "agent B iron sword balance",
  );
  assertEq(
    await readBalance(agentA.address, bronzeArrowId),
    1_000_000n,
    "agent A test mode arrow balance",
  );

  const tradeId = keccak256(stringToHex(`trade-main-${runNonce}`));

  await expectRevert(
    "attacker cannot create trade for other agents",
    async () => {
      await attackerClient.writeContract({
        address: world,
        abi: WORLD_ABI,
        functionName: "hyperia__createTrade",
        args: [
          keccak256(stringToHex(`trade-bad-${runNonce}`)),
          agentA.address,
          agentB.address,
        ],
      });
    },
  );
  await expectRevert("self-trade is rejected", async () => {
    await agentAClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__createTrade",
      args: [
        keccak256(stringToHex(`trade-self-${runNonce}`)),
        agentA.address,
        agentA.address,
      ],
    });
  });

  await sendAndWait("create trade (agent A -> agent B)", () =>
    agentAClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__createTrade",
      args: [tradeId, agentA.address, agentB.address],
    }),
  );

  {
    const [initiator, recipient, status] = (await publicClient.readContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__getTradeSession",
      args: [tradeId],
      account: operator.address,
    })) as readonly [
      Address,
      Address,
      number | bigint,
      boolean,
      boolean,
      bigint,
      bigint,
    ];
    assertEq(
      initiator.toLowerCase(),
      agentA.address.toLowerCase(),
      "trade initiator",
    );
    assertEq(
      recipient.toLowerCase(),
      agentB.address.toLowerCase(),
      "trade recipient",
    );
    assertEq(asBigInt(status), TRADE_STATUS_ACTIVE, "trade status active");
  }

  await expectRevert("non-participant cannot cancel trade", async () => {
    await attackerClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__cancelTrade",
      args: [tradeId],
    });
  });
  await expectRevert("non-participant cannot offer trade item", async () => {
    await attackerClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__offerItem",
      args: [tradeId, 0, 1],
    });
  });
  await expectRevert("cannot offer more than available quantity", async () => {
    await agentAClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__offerItem",
      args: [tradeId, 0, 2],
    });
  });

  await sendAndWait("agent A offers sword", () =>
    agentAClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__offerItem",
      args: [tradeId, 0, 1],
    }),
  );
  await sendAndWait("agent A offers 50 gold", () =>
    agentAClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__offerGold",
      args: [tradeId, 50n],
    }),
  );
  await sendAndWait("agent B offers sword", () =>
    agentBClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__offerItem",
      args: [tradeId, 0, 1],
    }),
  );
  await sendAndWait("agent B offers 20 gold", () =>
    agentBClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__offerGold",
      args: [tradeId, 20n],
    }),
  );

  {
    const [
      ,
      ,
      status,
      initiatorAccepted,
      recipientAccepted,
      initiatorGold,
      recipientGold,
    ] = (await publicClient.readContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__getTradeSession",
      args: [tradeId],
      account: operator.address,
    })) as readonly [
      Address,
      Address,
      number | bigint,
      boolean,
      boolean,
      bigint,
      bigint,
    ];
    assertEq(
      asBigInt(status),
      TRADE_STATUS_ACTIVE,
      "trade status remains active",
    );
    assertEq(initiatorAccepted, false, "initiator accepted reset");
    assertEq(recipientAccepted, false, "recipient accepted reset");
    assertEq(initiatorGold, 50n, "initiator gold offer");
    assertEq(recipientGold, 20n, "recipient gold offer");
  }

  await sendAndWait("agent A accepts trade", () =>
    agentAClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__acceptTrade",
      args: [tradeId],
    }),
  );
  await sendAndWait("agent B accepts trade (completes)", () =>
    agentBClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__acceptTrade",
      args: [tradeId],
    }),
  );

  {
    const [, , status] = (await publicClient.readContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__getTradeSession",
      args: [tradeId],
      account: operator.address,
    })) as readonly [
      Address,
      Address,
      number | bigint,
      boolean,
      boolean,
      bigint,
      bigint,
    ];
    assertEq(
      asBigInt(status),
      TRADE_STATUS_COMPLETED,
      "trade status completed",
    );
  }

  assertEq(
    await readBalance(agentA.address, bronzeSwordId),
    0n,
    "agent A bronze sword post-trade",
  );
  assertEq(
    await readBalance(agentA.address, ironSwordId),
    1n,
    "agent A iron sword post-trade",
  );
  assertEq(
    await readBalance(agentB.address, bronzeSwordId),
    1n,
    "agent B bronze sword post-trade",
  );
  assertEq(
    await readBalance(agentB.address, ironSwordId),
    0n,
    "agent B iron sword post-trade",
  );

  const goldAAfterTrade = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getGold",
    args: [characterA],
    account: operator.address,
  })) as bigint;
  const goldBAfterTrade = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getGold",
    args: [characterB],
    account: operator.address,
  })) as bigint;
  assertEq(goldAAfterTrade, 470n, "agent A gold post-trade");
  assertEq(goldBAfterTrade, 230n, "agent B gold post-trade");

  const goblinNpcId = keccak256(stringToHex("goblin"));
  const combatResultId = keccak256(stringToHex(`combat-${runNonce}`));
  await sendAndWait("commit mob kill + loot result for agent A", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__commitCombatResult",
      args: [combatResultId, characterA, goblinNpcId, 75, [bonesId], [2], [2]],
    }),
  );

  assertEq(
    await readBalance(agentA.address, bonesId),
    2n,
    "agent A bones loot balance",
  );
  const goldAAfterMobKill = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getGold",
    args: [characterA],
    account: operator.address,
  })) as bigint;
  assertEq(goldAAfterMobKill, 545n, "agent A gold after mob kill");

  const statsAAfterMob = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getPlayerStats",
    args: [characterA],
    account: operator.address,
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
  const [
    mobKillsA,
    deathsAInitial,
    playerKillsAInitial,
    bossKillsA,
    xpEarnedA,
    goldEarnedA,
  ] = statsAAfterMob;
  assertEq(asBigInt(mobKillsA), 1n, "agent A total mob kills");
  assertEq(asBigInt(deathsAInitial), 0n, "agent A total deaths before pvp");
  assertEq(
    asBigInt(playerKillsAInitial),
    0n,
    "agent A total player kills before pvp",
  );
  assertEq(asBigInt(bossKillsA), 0n, "agent A total boss kills");
  assertEq(xpEarnedA, 0n, "agent A total xp earned");
  assertEq(goldEarnedA, 75n, "agent A total gold earned from combat results");

  const goblinKills = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getNpcKillCount",
    args: [characterA, goblinNpcId],
    account: operator.address,
  })) as number | bigint;
  assertEq(asBigInt(goblinKills), 1n, "agent A goblin kill count");

  const ironSlotA = await findInventorySlotWithItem(characterA, ironSwordId);
  assert(
    ironSlotA !== null,
    "agent A missing iron sword before corpse transfer",
  );
  const emptySlotB = await findEmptyInventorySlot(characterB);

  await sendAndWait("clear dead player gear slot (agent A iron sword)", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__setInventorySlotBatch",
      args: [characterA, [ironSlotA!], [0], [0]],
    }),
  );
  await sendAndWait(
    "collect gear from corpse to killer inventory (agent B)",
    () =>
      operatorClient.writeContract({
        address: world,
        abi: WORLD_ABI,
        functionName: "hyperia__setInventorySlotBatch",
        args: [characterB, [emptySlotB], [ironSwordId], [1]],
      }),
  );
  await sendAndWait("record death for agent A", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__recordDeath",
      args: [characterA],
    }),
  );
  await sendAndWait("record player kill for agent B", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__recordPlayerKill",
      args: [characterB],
    }),
  );
  const duelId = keccak256(stringToHex(`duel-${runNonce}`));
  await sendAndWait("record completed duel (agent B defeats agent A)", () =>
    operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__recordDuel",
      args: [
        duelId,
        agentA.address,
        agentB.address,
        agentB.address,
        100n,
        50n,
        false,
      ],
    }),
  );

  assertEq(
    await readBalance(agentA.address, ironSwordId),
    0n,
    "agent A iron sword after death",
  );
  assertEq(
    await readBalance(agentB.address, ironSwordId),
    1n,
    "agent B iron sword after corpse loot",
  );

  const statsA = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getPlayerStats",
    args: [characterA],
    account: operator.address,
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
  const statsB = (await publicClient.readContract({
    address: world,
    abi: WORLD_ABI,
    functionName: "hyperia__getPlayerStats",
    args: [characterB],
    account: operator.address,
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

  assertEq(asBigInt(statsA[1]), 1n, "agent A death count");
  assertEq(asBigInt(statsB[2]), 1n, "agent B player kill count");
  assertEq(asBigInt(statsA[8]), 1n, "agent A duel loss count");
  assertEq(asBigInt(statsB[7]), 1n, "agent B duel win count");

  await expectRevert("unauthorized inventory write blocked", async () => {
    await attackerClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__setInventorySlotBatch",
      args: [characterA, [0], [bronzeSwordId], [999999]],
    });
  });
  await expectRevert("unauthorized death write blocked", async () => {
    await attackerClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__recordDeath",
      args: [characterA],
    });
  });
  await expectRevert("unauthorized combat result write blocked", async () => {
    await attackerClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__commitCombatResult",
      args: [
        keccak256(stringToHex(`bad-combat-${runNonce}`)),
        characterA,
        goblinNpcId,
        9_999,
        [bonesId],
        [999_999],
        [0],
      ],
    });
  });
  await expectRevert("unauthorized duel write blocked", async () => {
    await attackerClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__recordDuel",
      args: [
        duelId,
        agentA.address,
        agentB.address,
        attacker.address,
        1n,
        1n,
        false,
      ],
    });
  });
  await expectRevert("duel winner must be a participant", async () => {
    await operatorClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__recordDuel",
      args: [
        keccak256(stringToHex(`duel-invalid-winner-${runNonce}`)),
        agentA.address,
        agentB.address,
        attacker.address,
        1n,
        1n,
        false,
      ],
    });
  });
  await expectRevert("completed trade cannot be modified", async () => {
    await agentAClient.writeContract({
      address: world,
      abi: WORLD_ABI,
      functionName: "hyperia__offerItem",
      args: [tradeId, 0, 1],
    });
  });

  console.log("[onchain-e2e] PASS");
  console.log(
    "[onchain-e2e] Verified registration, on-chain trade escrow, anti-cheat access controls, mob kill+loot, death/corpse gear transfer, and PvP/duel stats.",
  );
}

main().catch((err) => {
  console.error("[onchain-e2e] FAIL:", err);
  process.exit(1);
});
