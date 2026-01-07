/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `kohai_staking.json`.
 */
export type KohaiStaking = {
  address: "Bmtrb34ikPyAwdsobDBpiJWhRjh5adZWaRQ8kV9qDJ3d";
  metadata: {
    name: "kohaiStaking";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "claimRewards";
      discriminator: [4, 144, 132, 71, 116, 23, 151, 80];
      accounts: [
        {
          name: "stakingPool";
          writable: true;
        },
        {
          name: "userStake";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [117, 115, 101, 114, 95, 115, 116, 97, 107, 101];
              },
              {
                kind: "account";
                path: "stakingPool";
              },
              {
                kind: "account";
                path: "user";
              }
            ];
          };
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "userTokenAccount";
          writable: true;
        },
        {
          name: "rewardVault";
          writable: true;
        },
        {
          name: "tokenProgram";
        }
      ];
      args: [];
    },
    {
      name: "initialize";
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: "stakingPool";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ];
              },
              {
                kind: "account";
                path: "tokenMint";
              }
            ];
          };
        },
        {
          name: "tokenMint";
        },
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "rewardVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ];
              },
              {
                kind: "account";
                path: "stakingPool";
              }
            ];
          };
        },
        {
          name: "stakeVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ];
              },
              {
                kind: "account";
                path: "stakingPool";
              }
            ];
          };
        },
        {
          name: "tokenProgram";
        },
        {
          name: "systemProgram";
        },
        {
          name: "rent";
        }
      ];
      args: [
        {
          name: "totalRewardAmount";
          type: "u64";
        }
      ];
    },
    {
      name: "stake";
      discriminator: [206, 176, 202, 18, 200, 209, 179, 108];
      accounts: [
        {
          name: "stakingPool";
          writable: true;
        },
        {
          name: "userStake";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [117, 115, 101, 114, 95, 115, 116, 97, 107, 101];
              },
              {
                kind: "account";
                path: "stakingPool";
              },
              {
                kind: "account";
                path: "user";
              }
            ];
          };
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "userTokenAccount";
          writable: true;
        },
        {
          name: "stakeVault";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "systemProgram";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "unstake";
      discriminator: [90, 95, 107, 42, 205, 124, 50, 225];
      accounts: [
        {
          name: "stakingPool";
          writable: true;
        },
        {
          name: "userStake";
          writable: true;
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "userTokenAccount";
          writable: true;
        },
        {
          name: "stakeVault";
          writable: true;
        },
        {
          name: "tokenProgram";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "stakingPool";
      discriminator: [203, 19, 214, 220, 220, 154, 24, 102];
    },
    {
      name: "userStake";
      discriminator: [102, 53, 163, 107, 9, 138, 87, 153];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "invalidAmount";
      msg: "Invalid amount";
    },
    {
      code: 6001;
      name: "stakingEnded";
      msg: "Staking period has ended";
    },
    {
      code: 6002;
      name: "insufficientStake";
      msg: "Insufficient stake";
    },
    {
      code: 6003;
      name: "stillLocked";
      msg: "Tokens still locked, cannot unstake yet";
    },
    {
      code: 6004;
      name: "noRewardsToClaim";
      msg: "No rewards to claim";
    },
    {
      code: 6005;
      name: "overflow";
      msg: "Overflow error";
    },
    {
      code: 6006;
      name: "underflow";
      msg: "Underflow error";
    },
    {
      code: 6007;
      name: "divisionByZero";
      msg: "Division by zero";
    }
  ];
  types: [
    {
      name: "stakingPool";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "tokenMint";
            type: "pubkey";
          },
          {
            name: "rewardVault";
            type: "pubkey";
          },
          {
            name: "stakeVault";
            type: "pubkey";
          },
          {
            name: "totalRewardAmount";
            type: "u64";
          },
          {
            name: "totalStaked";
            type: "u64";
          },
          {
            name: "totalRewardsDistributed";
            type: "u64";
          },
          {
            name: "startTime";
            type: "i64";
          },
          {
            name: "endTime";
            type: "i64";
          },
          {
            name: "lockPeriodSeconds";
            type: "i64";
          },
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "userStake";
      type: {
        kind: "struct";
        fields: [
          {
            name: "owner";
            type: "pubkey";
          },
          {
            name: "stakingPool";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "rewardDebt";
            type: "u64";
          },
          {
            name: "stakeTimestamp";
            type: "i64";
          },
          {
            name: "lastClaimTimestamp";
            type: "i64";
          },
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    }
  ];
};
