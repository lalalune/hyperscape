/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/fight_oracle.json`.
 */
export type FightOracle = {
  address: "4fvVdiZkMQQGjYWHyKubjkdhh1DfJaYNvaRvRWPeKcMN";
  metadata: {
    name: "fightOracle";
    version: "0.1.0";
    spec: "0.1.0";
  };
  instructions: [
    {
      name: "createMatch";
      discriminator: [107, 2, 184, 145, 70, 142, 17, 165];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
          relations: ["oracleConfig"];
        },
        {
          name: "oracleConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
        {
          name: "matchResult";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 97, 116, 99, 104];
              },
              {
                kind: "arg";
                path: "matchId";
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
          name: "matchId";
          type: "u64";
        },
        {
          name: "betWindowSeconds";
          type: "i64";
        },
        {
          name: "metadataUri";
          type: "string";
        },
      ];
    },
    {
      name: "initializeOracle";
      discriminator: [144, 223, 131, 120, 196, 253, 181, 99];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "oracleConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "postResult";
      discriminator: [209, 11, 193, 110, 192, 1, 142, 9];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
          relations: ["oracleConfig"];
        },
        {
          name: "oracleConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
            ];
          };
          relations: ["matchResult"];
        },
        {
          name: "matchResult";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 97, 116, 99, 104];
              },
              {
                kind: "account";
                path: "match_result.match_id";
                account: "matchResult";
              },
            ];
          };
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
        {
          name: "seed";
          type: "u64";
        },
        {
          name: "replayHash";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: "matchResult";
      discriminator: [234, 166, 33, 250, 153, 92, 223, 196];
    },
    {
      name: "oracleConfig";
      discriminator: [133, 196, 152, 50, 27, 21, 145, 254];
    },
  ];
  events: [
    {
      name: "matchCreated";
      discriminator: [151, 176, 11, 24, 34, 225, 227, 16];
    },
    {
      name: "matchResolved";
      discriminator: [195, 55, 115, 244, 102, 215, 221, 40];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "unauthorized";
      msg: "Only the oracle authority can call this instruction";
    },
    {
      code: 6001;
      name: "invalidBetWindow";
      msg: "The betting window must be positive";
    },
    {
      code: 6002;
      name: "mathOverflow";
      msg: "Math overflow";
    },
    {
      code: 6003;
      name: "betWindowStillOpen";
      msg: "The betting window is still open";
    },
    {
      code: 6004;
      name: "matchAlreadyResolved";
      msg: "Match has already been resolved";
    },
  ];
  types: [
    {
      name: "marketSide";
      type: {
        kind: "enum";
        variants: [
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
      name: "matchCreated";
      type: {
        kind: "struct";
        fields: [
          {
            name: "matchId";
            type: "u64";
          },
          {
            name: "openTs";
            type: "i64";
          },
          {
            name: "betCloseTs";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "matchResolved";
      type: {
        kind: "struct";
        fields: [
          {
            name: "matchId";
            type: "u64";
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
            name: "seed";
            type: "u64";
          },
          {
            name: "resolvedTs";
            type: "i64";
          },
          {
            name: "replayHash";
            type: {
              array: ["u8", 32];
            };
          },
        ];
      };
    },
    {
      name: "matchResult";
      type: {
        kind: "struct";
        fields: [
          {
            name: "matchId";
            type: "u64";
          },
          {
            name: "oracleConfig";
            type: "pubkey";
          },
          {
            name: "openTs";
            type: "i64";
          },
          {
            name: "betCloseTs";
            type: "i64";
          },
          {
            name: "status";
            type: {
              defined: {
                name: "matchStatus";
              };
            };
          },
          {
            name: "winner";
            type: {
              option: {
                defined: {
                  name: "marketSide";
                };
              };
            };
          },
          {
            name: "seed";
            type: {
              option: "u64";
            };
          },
          {
            name: "replayHash";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "resolvedTs";
            type: {
              option: "i64";
            };
          },
          {
            name: "metadataUri";
            type: "string";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "matchStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "open";
          },
          {
            name: "resolved";
          },
        ];
      };
    },
    {
      name: "oracleConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
  ];
};
