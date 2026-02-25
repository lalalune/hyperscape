import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AnchorProvider, BN, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  Connection,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";

import fightOracleIdl from "../../../anchor/target/idl/fight_oracle.json";

type SignableTx = Transaction | VersionedTransaction;
type AnchorLikeWallet = Wallet & { payer: Keypair };

function seedKeypair(offset: number): Keypair {
  const seed = new Uint8Array(32);
  for (let i = 0; i < seed.length; i += 1) {
    seed[i] = (offset + i) % 256;
  }
  return Keypair.fromSeed(seed);
}

function findDeterministicAuthority(target: PublicKey): Keypair | null {
  for (let offset = 0; offset < 256; offset += 1) {
    const candidate = seedKeypair(offset);
    if (candidate.publicKey.equals(target)) {
      return candidate;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toWallet(keypair: Keypair): AnchorLikeWallet {
  const sign = <T extends SignableTx>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([keypair]);
    else tx.partialSign(keypair);
    return tx;
  };

  return {
    payer: keypair,
    publicKey: keypair.publicKey,
    signTransaction: async <T extends SignableTx>(tx: T): Promise<T> =>
      sign(tx),
    signAllTransactions: async <T extends SignableTx[]>(txs: T): Promise<T> => {
      txs.forEach((tx) => sign(tx));
      return txs;
    },
  };
}

async function airdrop(
  connection: Connection,
  recipient: PublicKey,
): Promise<void> {
  let lastError: unknown = new Error("Airdrop did not settle");
  const initialBalance = await connection.getBalance(recipient, "confirmed");
  const expectedFloor = initialBalance + LAMPORTS_PER_SOL;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const signature = await connection.requestAirdrop(
        recipient,
        10 * LAMPORTS_PER_SOL,
      );

      const startedAt = Date.now();
      while (Date.now() - startedAt < 20_000) {
        const balance = await connection.getBalance(recipient, "confirmed");
        if (balance >= expectedFloor) return;

        const statuses = await connection.getSignatureStatuses([signature], {
          searchTransactionHistory: true,
        });
        const status = statuses.value[0];
        if (status?.err) {
          throw new Error(
            `Airdrop failed for signature ${signature}: ${JSON.stringify(status.err)}`,
          );
        }
        await sleep(600);
      }

      throw new Error(`Airdrop signature ${signature} did not settle in time`);
    } catch (error) {
      lastError = error;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const appDir = path.resolve(__dirname, "../..");
  const statePath = path.resolve(__dirname, "./state.json");
  const envPath = path.resolve(appDir, ".env.e2e");
  const solanaRpcUrl =
    process.env.E2E_SOLANA_RPC_URL || "http://127.0.0.1:8899";
  const solanaWsUrl = process.env.E2E_SOLANA_WS_URL || "ws://127.0.0.1:8900";
  const localTokenProgram = TOKEN_PROGRAM_ID;

  const connection = new Connection(solanaRpcUrl, "confirmed");
  let authority = seedKeypair(17);
  let provider = new AnchorProvider(connection, toWallet(authority), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });

  let fightProgram = new Program(fightOracleIdl as Idl, provider);
  let fight: any = fightProgram;

  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_config")],
    fightProgram.programId,
  );

  const existingOracleConfig = await (
    fightProgram as any
  ).account.oracleConfig.fetchNullable(oracleConfigPda);
  if (
    existingOracleConfig?.authority &&
    !existingOracleConfig.authority.equals(authority.publicKey)
  ) {
    const matchedAuthority = findDeterministicAuthority(
      existingOracleConfig.authority,
    );
    if (matchedAuthority) {
      authority = matchedAuthority;
      provider = new AnchorProvider(connection, toWallet(authority), {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      });
      fightProgram = new Program(fightOracleIdl as Idl, provider);
      fight = fightProgram;
    }
  }

  const authorityBalance = await connection.getBalance(
    authority.publicKey,
    "confirmed",
  );
  if (authorityBalance < LAMPORTS_PER_SOL) {
    await airdrop(connection, authority.publicKey);
  }

  const goldMint = await createMint(
    connection,
    authority,
    authority.publicKey,
    null,
    6,
    undefined,
    undefined,
    localTokenProgram,
  );

  const authorityGoldAta = await createAccount(
    connection,
    authority,
    goldMint,
    authority.publicKey,
    undefined,
    undefined,
    localTokenProgram,
  );

  await mintTo(
    connection,
    authority,
    goldMint,
    authorityGoldAta,
    authority,
    100_000_000,
    [],
    undefined,
    localTokenProgram,
  );

  await fight.methods
    .initializeOracle()
    .accountsPartial({
      authority: authority.publicKey,
      oracleConfig: oracleConfigPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const deriveMarket = (matchId: number) => {
    const [matchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("match"), new BN(matchId).toArrayLike(Buffer, "le", 8)],
      fightProgram.programId,
    );
    return {
      matchPda,
    };
  };

  const resolvedMatchId = Date.now() - 100_000;
  const resolved = deriveMarket(resolvedMatchId);
  await fight.methods
    .createMatch(
      new BN(resolvedMatchId),
      new BN(2),
      JSON.stringify({
        agent1: "E2E Resolved Agent A",
        agent2: "E2E Resolved Agent B",
      }),
    )
    .accountsPartial({
      authority: authority.publicKey,
      oracleConfig: oracleConfigPda,
      matchResult: resolved.matchPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  await sleep(2_500);

  await fight.methods
    .postResult({ yes: {} }, new BN(42), Array.from(new Uint8Array(32)))
    .accountsPartial({
      authority: authority.publicKey,
      oracleConfig: oracleConfigPda,
      matchResult: resolved.matchPda,
    })
    .rpc();

  const currentMatchId = Date.now();
  const current = deriveMarket(currentMatchId);
  await fight.methods
    .createMatch(
      new BN(currentMatchId),
      new BN(45),
      JSON.stringify({
        agent1: "E2E Active Agent A",
        agent2: "E2E Active Agent B",
      }),
    )
    .accountsPartial({
      authority: authority.publicKey,
      oracleConfig: oracleConfigPda,
      matchResult: current.matchPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const envBody = [
    "VITE_SOLANA_CLUSTER=localnet",
    `VITE_SOLANA_RPC_URL=${solanaRpcUrl}`,
    `VITE_SOLANA_WS_URL=${solanaWsUrl}`,
    `VITE_GOLD_MINT=${goldMint.toBase58()}`,
    `VITE_ACTIVE_MATCH_ID=${currentMatchId}`,
    "VITE_BET_WINDOW_SECONDS=300",
    "VITE_NEW_ROUND_BET_WINDOW_SECONDS=300",
    "VITE_AUTO_SEED_DELAY_SECONDS=10",
    "VITE_MARKET_MAKER_SEED_GOLD=1",
    "VITE_BET_FEE_BPS=200",
    "VITE_GOLD_DECIMALS=6",
    "VITE_REFRESH_INTERVAL_MS=1500",
    "VITE_ENABLE_AUTO_SEED=false",
    "VITE_E2E_FORCE_WINNER=YES",
    `VITE_HEADLESS_WALLET_SECRET_KEY=${Array.from(authority.secretKey).join(",")}`,
    "VITE_HEADLESS_WALLET_NAME=E2E Wallet",
    "VITE_HEADLESS_WALLET_AUTO_CONNECT=true",
  ].join("\n");

  await fs.writeFile(envPath, `${envBody}\n`, "utf8");
  await fs.writeFile(
    statePath,
    JSON.stringify(
      {
        mode: "localnet",
        cluster: "localnet",
        solanaRpcUrl,
        authority: authority.publicKey.toBase58(),
        goldMint: goldMint.toBase58(),
        currentMatchId,
        currentMatchPda: current.matchPda.toBase58(),
        lastResolvedMatchId: resolvedMatchId,
        expectedSeedSuccess: true,
        canStartNewRound: true,
        placeBetPayAsset: "GOLD",
        placeBetAmount: "1",
        placeBetSide: "YES",
        currentBetWindowSeconds: 45,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        envPath,
        statePath,
        authority: authority.publicKey.toBase58(),
        goldMint: goldMint.toBase58(),
        currentMatchId,
        lastResolvedMatchId: resolvedMatchId,
      },
      null,
      2,
    ),
  );
}

void main();
