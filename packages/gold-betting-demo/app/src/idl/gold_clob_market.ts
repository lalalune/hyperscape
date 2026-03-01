/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/gold_clob_market.json`.
 */
export type GoldClobMarket = {
  address: "ARVJNJp49VZnkB8QBYZAAFJmufvtVSPhnuuenwwSLwpi";
  metadata: {
    name: "goldClobMarket";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "cancelOrder";
      discriminator: [95, 129, 237, 240, 8, 49, 223, 132];
      accounts: [
        {
          name: "matchState";
          writable: true;
          relations: ["orderBook"];
        },
        {
          name: "orderBook";
          writable: true;
        },
        {
          name: "order";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 114, 100, 101, 114];
              },
              {
                kind: "account";
                path: "matchState";
              },
              {
                kind: "account";
                path: "user";
              },
              {
                kind: "arg";
                path: "orderId";
              },
            ];
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "account";
                path: "matchState";
              },
            ];
          };
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "orderId";
          type: "u64";
        },
      ];
    },
    {
      name: "claim";
      discriminator: [62, 198, 214, 193, 213, 159, 108, 210];
      accounts: [
        {
          name: "matchState";
          writable: true;
          relations: ["orderBook"];
        },
        {
          name: "orderBook";
          writable: true;
        },
        {
          name: "userBalance";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 97, 108, 97, 110, 99, 101];
              },
              {
                kind: "account";
                path: "matchState";
              },
              {
                kind: "account";
                path: "user";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "marketMaker";
          writable: true;
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "account";
                path: "matchState";
              },
            ];
          };
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "initializeConfig";
      discriminator: [208, 127, 21, 1, 194, 190, 196, 70];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "treasury";
          type: "pubkey";
        },
        {
          name: "marketMaker";
          type: "pubkey";
        },
        {
          name: "tradeTreasuryFeeBps";
          type: "u16";
        },
        {
          name: "tradeMarketMakerFeeBps";
          type: "u16";
        },
        {
          name: "winningsMarketMakerFeeBps";
          type: "u16";
        },
      ];
    },
    {
      name: "initializeMatch";
      discriminator: [156, 133, 52, 179, 176, 29, 64, 124];
      accounts: [
        {
          name: "matchState";
          writable: true;
          signer: true;
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "account";
                path: "matchState";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "yesPrice";
          type: "u16";
        },
      ];
    },
    {
      name: "initializeOrderBook";
      discriminator: [93, 233, 9, 128, 33, 199, 152, 88];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "matchState";
        },
        {
          name: "orderBook";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "placeOrder";
      discriminator: [51, 194, 155, 175, 109, 130, 96, 106];
      accounts: [
        {
          name: "matchState";
          writable: true;
          relations: ["orderBook"];
        },
        {
          name: "orderBook";
          writable: true;
        },
        {
          name: "userBalance";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 97, 108, 97, 110, 99, 101];
              },
              {
                kind: "account";
                path: "matchState";
              },
              {
                kind: "account";
                path: "user";
              },
            ];
          };
        },
        {
          name: "newOrder";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 114, 100, 101, 114];
              },
              {
                kind: "account";
                path: "matchState";
              },
              {
                kind: "account";
                path: "user";
              },
              {
                kind: "arg";
                path: "orderId";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "treasury";
          writable: true;
        },
        {
          name: "marketMaker";
          writable: true;
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "account";
                path: "matchState";
              },
            ];
          };
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "orderId";
          type: "u64";
        },
        {
          name: "isBuy";
          type: "bool";
        },
        {
          name: "price";
          type: "u16";
        },
        {
          name: "amount";
          type: "u64";
        },
      ];
    },
    {
      name: "resolveMatch";
      discriminator: [73, 0, 15, 197, 178, 47, 21, 193];
      accounts: [
        {
          name: "matchState";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
        },
      ];
      args: [
        {
          name: "winner";
          type: {
            defined: {
              name: "marketSide";
            };
          };
        },
      ];
    },
    {
      name: "updateConfig";
      discriminator: [29, 158, 252, 191, 10, 83, 219, 99];
      accounts: [
        {
          name: "authority";
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "treasury";
          type: "pubkey";
        },
        {
          name: "marketMaker";
          type: "pubkey";
        },
        {
          name: "tradeTreasuryFeeBps";
          type: "u16";
        },
        {
          name: "tradeMarketMakerFeeBps";
          type: "u16";
        },
        {
          name: "winningsMarketMakerFeeBps";
          type: "u16";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "marketConfig";
      discriminator: [119, 255, 200, 88, 252, 82, 128, 24];
    },
    {
      name: "matchState";
      discriminator: [250, 209, 137, 70, 235, 96, 121, 216];
    },
    {
      name: "order";
      discriminator: [134, 173, 223, 185, 77, 86, 28, 51];
    },
    {
      name: "orderBook";
      discriminator: [55, 230, 125, 218, 149, 39, 65, 248];
    },
    {
      name: "userBalance";
      discriminator: [187, 237, 208, 146, 86, 132, 29, 191];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "matchClosed";
      msg: "Match is closed";
    },
    {
      code: 6001;
      name: "matchStillOpen";
      msg: "Match is still open";
    },
    {
      code: 6002;
      name: "invalidPrice";
      msg: "Invalid price";
    },
    {
      code: 6003;
      name: "nothingToClaim";
      msg: "Nothing to claim";
    },
    {
      code: 6004;
      name: "orderNotFound";
      msg: "Order not found";
    },
    {
      code: 6005;
      name: "notOrderMaker";
      msg: "Not the order maker";
    },
    {
      code: 6006;
      name: "alreadyFilled";
      msg: "Order is already fully filled";
    },
    {
      code: 6007;
      name: "costTooLow";
      msg: "Cost is zero, amount too small";
    },
    {
      code: 6008;
      name: "unauthorizedResolver";
      msg: "Unauthorized to resolve match";
    },
    {
      code: 6009;
      name: "orderBookMismatch";
      msg: "Order book does not belong to this match";
    },
    {
      code: 6010;
      name: "invalidFeeAccount";
      msg: "Invalid fee account provided for treasury or market maker";
    },
    {
      code: 6011;
      name: "invalidFeeBps";
      msg: "Invalid fee basis points";
    },
    {
      code: 6012;
      name: "unauthorizedConfigAuthority";
      msg: "Only config authority can update fee config";
    },
    {
      code: 6013;
      name: "mathOverflow";
      msg: "Math overflow";
    },
    {
      code: 6014;
      name: "precisionError";
      msg: "Math precision error";
    },
    {
      code: 6015;
      name: "invalidRemainingAccount";
      msg: "Invalid remaining account provided";
    },
    {
      code: 6016;
      name: "invalidWinner";
      msg: "Winner must be YES (1) or NO (2)";
    },
    {
      code: 6017;
      name: "invalidOrderId";
      msg: "Provided order ID does not match next_order_id";
    },
  ];
  types: [
    {
      name: "marketConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "treasury";
            type: "pubkey";
          },
          {
            name: "marketMaker";
            type: "pubkey";
          },
          {
            name: "tradeTreasuryFeeBps";
            type: "u16";
          },
          {
            name: "tradeMarketMakerFeeBps";
            type: "u16";
          },
          {
            name: "winningsMarketMakerFeeBps";
            type: "u16";
          },
        ];
      };
    },
    {
      name: "marketSide";
      type: {
        kind: "enum";
        variants: [
          {
            name: "none";
          },
          {
            name: "yes";
          },
          {
            name: "no";
          },
        ];
      };
    },
    {
      name: "matchState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "isOpen";
            type: "bool";
          },
          {
            name: "winner";
            type: {
              defined: {
                name: "marketSide";
              };
            };
          },
          {
            name: "nextOrderId";
            type: "u64";
          },
          {
            name: "vaultBump";
            type: "u8";
          },
          {
            name: "authority";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "order";
      type: {
        kind: "struct";
        fields: [
          {
            name: "id";
            type: "u64";
          },
          {
            name: "matchState";
            type: "pubkey";
          },
          {
            name: "maker";
            type: "pubkey";
          },
          {
            name: "isBuy";
            type: "bool";
          },
          {
            name: "price";
            type: "u16";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "filled";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "orderBook";
      type: {
        kind: "struct";
        fields: [
          {
            name: "matchState";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "userBalance";
      type: {
        kind: "struct";
        fields: [
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "matchState";
            type: "pubkey";
          },
          {
            name: "yesShares";
            type: "u64";
          },
          {
            name: "noShares";
            type: "u64";
          },
        ];
      };
    },
  ];
};
