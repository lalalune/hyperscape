/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/gold_perps_market.json`.
 */
export type GoldPerpsMarket = {
  address: "HbXhqEFevpkfYdZCN6YmJGRmQmj9vsBun2ZHjeeaLRik";
  metadata: {
    name: "goldPerpsMarket";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "closePosition";
      discriminator: [123, 134, 81, 0, 49, 68, 98, 98];
      accounts: [
        {
          name: "position";
          writable: true;
        },
        {
          name: "owner";
          writable: true;
          signer: true;
          relations: ["position"];
        },
        {
          name: "oracle";
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
            ];
          };
        },
        {
          name: "vaultTokenAccount";
          writable: true;
        },
        {
          name: "ownerTokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
      ];
      args: [];
    },
    {
      name: "initializeVault";
      discriminator: [48, 191, 163, 44, 71, 129, 63, 164];
      accounts: [
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
            ];
          };
        },
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "goldMint";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "liquidate";
      discriminator: [223, 179, 226, 125, 48, 46, 39, 74];
      accounts: [
        {
          name: "position";
          writable: true;
        },
        {
          name: "oracle";
        },
      ];
      args: [];
    },
    {
      name: "openPosition";
      discriminator: [135, 128, 47, 77, 15, 152, 240, 49];
      accounts: [
        {
          name: "position";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "trader";
              },
              {
                kind: "arg";
                path: "agentId";
              },
            ];
          };
        },
        {
          name: "trader";
          writable: true;
          signer: true;
        },
        {
          name: "traderTokenAccount";
          writable: true;
        },
        {
          name: "vaultTokenAccount";
          writable: true;
        },
        {
          name: "oracle";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
      ];
      args: [
        {
          name: "agentId";
          type: "u32";
        },
        {
          name: "positionType";
          type: "u8";
        },
        {
          name: "collateral";
          type: "u64";
        },
        {
          name: "leverage";
          type: "u64";
        },
      ];
    },
    {
      name: "updateOracle";
      discriminator: [112, 41, 209, 18, 248, 226, 252, 188];
      accounts: [
        {
          name: "oracle";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [111, 114, 97, 99, 108, 101];
              },
              {
                kind: "arg";
                path: "agentId";
              },
            ];
          };
        },
        {
          name: "authority";
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
          name: "agentId";
          type: "u32";
        },
        {
          name: "spotIndex";
          type: "u64";
        },
        {
          name: "mu";
          type: "u64";
        },
        {
          name: "sigma";
          type: "u64";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "oracleState";
      discriminator: [97, 156, 157, 189, 194, 73, 8, 15];
    },
    {
      name: "positionState";
      discriminator: [154, 47, 151, 70, 8, 128, 206, 231];
    },
    {
      name: "vaultState";
      discriminator: [228, 196, 82, 165, 98, 210, 235, 152];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "invalidOracle";
      msg: "Invalid Oracle";
    },
    {
      code: 6001;
      name: "notLiquidatable";
      msg: "Position is not liquidatable";
    },
  ];
  types: [
    {
      name: "oracleState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "agentId";
            type: "u32";
          },
          {
            name: "spotIndex";
            type: "u64";
          },
          {
            name: "mu";
            type: "u64";
          },
          {
            name: "sigma";
            type: "u64";
          },
          {
            name: "lastUpdated";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "positionState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "owner";
            type: "pubkey";
          },
          {
            name: "agentId";
            type: "u32";
          },
          {
            name: "positionType";
            type: "u8";
          },
          {
            name: "collateral";
            type: "u64";
          },
          {
            name: "size";
            type: "u64";
          },
          {
            name: "entryPrice";
            type: "u64";
          },
          {
            name: "lastFundingTime";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "vaultState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "goldMint";
            type: "pubkey";
          },
          {
            name: "insuranceFund";
            type: "u64";
          },
          {
            name: "liquidityFund";
            type: "u64";
          },
        ];
      };
    },
  ];
};
