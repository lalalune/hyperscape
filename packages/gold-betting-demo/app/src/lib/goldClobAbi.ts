/**
 * ABI for the GoldClob EVM contract (native currency version).
 * placeOrder is payable — sends native currency (BNB/ETH/AVAX) with the tx.
 */

export const GOLD_CLOB_ABI = [
  // Constructor
  {
    inputs: [
      { internalType: "address", name: "_treasury", type: "address" },
      { internalType: "address", name: "_marketMaker", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  // Errors
  { inputs: [], name: "ReentrancyGuardReentrantCall", type: "error" },
  // Events
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
    ],
    name: "MatchCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum GoldClob.Side",
        name: "winner",
        type: "uint8",
      },
    ],
    name: "MatchResolved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint64",
        name: "orderId",
        type: "uint64",
      },
    ],
    name: "OrderCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "makerOrderId",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "takerOrderId",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "matchedAmount",
        type: "uint256",
      },
      { indexed: false, internalType: "uint16", name: "price", type: "uint16" },
    ],
    name: "OrderMatched",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint64",
        name: "orderId",
        type: "uint64",
      },
      {
        indexed: true,
        internalType: "address",
        name: "maker",
        type: "address",
      },
      { indexed: false, internalType: "bool", name: "isBuy", type: "bool" },
      { indexed: false, internalType: "uint16", name: "price", type: "uint16" },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "OrderPlaced",
    type: "event",
  },
  // View functions
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "bestAsks",
    outputs: [{ internalType: "uint16", name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "bestBids",
    outputs: [{ internalType: "uint16", name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "feeBps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "marketMaker",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "matches",
    outputs: [
      {
        internalType: "enum GoldClob.MatchStatus",
        name: "status",
        type: "uint8",
      },
      { internalType: "enum GoldClob.Side", name: "winner", type: "uint8" },
      { internalType: "uint256", name: "yesPool", type: "uint256" },
      { internalType: "uint256", name: "noPool", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextMatchId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextOrderId",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    name: "orders",
    outputs: [
      { internalType: "uint64", name: "id", type: "uint64" },
      { internalType: "uint16", name: "price", type: "uint16" },
      { internalType: "bool", name: "isBuy", type: "bool" },
      { internalType: "address", name: "maker", type: "address" },
      { internalType: "uint128", name: "amount", type: "uint128" },
      { internalType: "uint128", name: "filled", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "positions",
    outputs: [
      { internalType: "uint256", name: "yesShares", type: "uint256" },
      { internalType: "uint256", name: "noShares", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "treasury",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // State-changing functions
  {
    inputs: [{ internalType: "uint256", name: "matchId", type: "uint256" }],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "matchId", type: "uint256" },
      { internalType: "uint64", name: "orderId", type: "uint64" },
      { internalType: "uint16", name: "price", type: "uint16" },
    ],
    name: "cancelOrder",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "createMatch",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "matchId", type: "uint256" },
      { internalType: "bool", name: "isBuy", type: "bool" },
      { internalType: "uint16", name: "price", type: "uint16" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "placeOrder",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "matchId", type: "uint256" },
      { internalType: "enum GoldClob.Side", name: "winner", type: "uint8" },
    ],
    name: "resolveMatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
