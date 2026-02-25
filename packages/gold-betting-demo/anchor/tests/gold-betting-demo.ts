import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeAccountInstruction,
  createAccount,
  createMint,
  getMinimumBalanceForRentExemptAccount,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { expect } from "chai";

import { FightOracle } from "../target/types/fight_oracle";
import { GoldClobMarket } from "../target/types/gold_clob_market";

const DECIMALS = 6;
const ONE_GOLD = 1_000_000;

function bn(value: number): anchor.BN {
  return new anchor.BN(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function airdrop(
  connection: anchor.web3.Connection,
  recipient: PublicKey,
  sol = 2,
): Promise<void> {
  const sig = await connection.requestAirdrop(
    recipient,
    sol * LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(sig, "confirmed");
}

describe("gold_clob_market", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const clobProgram = anchor.workspace
    .GoldClobMarket as Program<GoldClobMarket>;

  it("initializes config and match state", async () => {
    const payer = (provider.wallet as anchor.Wallet & { payer: Keypair }).payer;

    const goldMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      DECIMALS,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
    );

    const treasuryOwner = Keypair.generate();
    const marketMakerOwner = Keypair.generate();
    const treasuryTokenAccount = await createAccount(
      provider.connection,
      payer,
      goldMint,
      treasuryOwner.publicKey,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
    );
    const marketMakerTokenAccount = await createAccount(
      provider.connection,
      payer,
      goldMint,
      marketMakerOwner.publicKey,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
    );

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      clobProgram.programId,
    );

    const existingConfig =
      await clobProgram.account.marketConfig.fetchNullable(configPda);

    if (!existingConfig) {
      await clobProgram.methods
        .initializeConfig(
          treasuryTokenAccount,
          marketMakerTokenAccount,
          100,
          100,
          200,
        )
        .accountsPartial({
          authority: payer.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }

    const matchState = Keypair.generate();
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_auth"), matchState.publicKey.toBuffer()],
      clobProgram.programId,
    );

    await clobProgram.methods
      .initializeMatch(500)
      .accountsPartial({
        matchState: matchState.publicKey,
        user: payer.publicKey,
        config: configPda,
        vaultAuthority: vaultAuthorityPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([matchState])
      .rpc();

    const matchAccount = (await clobProgram.account.matchState.fetch(
      matchState.publicKey,
    )) as any;
    expect(matchAccount.isOpen).to.equal(true);
  });

  it("allows users to cancel open limit orders", async () => {
    const payer = (provider.wallet as anchor.Wallet & { payer: Keypair }).payer;
    const trader = Keypair.generate();
    await airdrop(provider.connection, trader.publicKey);

    const goldMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      DECIMALS,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
    );

    const traderGoldAta = await createAccount(
      provider.connection,
      payer,
      goldMint,
      trader.publicKey,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
    );

    await mintTo(
      provider.connection,
      payer,
      goldMint,
      traderGoldAta,
      payer,
      ONE_GOLD * 2,
      [],
      undefined,
      TOKEN_PROGRAM_ID,
    );

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      clobProgram.programId,
    );

    const existingConfig =
      await clobProgram.account.marketConfig.fetchNullable(configPda);
    const treasuryOwner = Keypair.generate();
    const marketMakerOwner = Keypair.generate();
    const treasuryTokenAccount = await createAccount(
      provider.connection,
      payer,
      goldMint,
      treasuryOwner.publicKey,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
    );
    const marketMakerTokenAccount = await createAccount(
      provider.connection,
      payer,
      goldMint,
      marketMakerOwner.publicKey,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
    );

    if (!existingConfig) {
      await clobProgram.methods
        .initializeConfig(
          treasuryTokenAccount,
          marketMakerTokenAccount,
          100,
          100,
          200,
        )
        .accountsPartial({
          authority: payer.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } else {
      await clobProgram.methods
        .updateConfig(
          treasuryTokenAccount,
          marketMakerTokenAccount,
          100,
          100,
          200,
        )
        .accountsPartial({
          authority: payer.publicKey,
          config: configPda,
        })
        .rpc();
    }

    const matchState = Keypair.generate();
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_auth"), matchState.publicKey.toBuffer()],
      clobProgram.programId,
    );

    await clobProgram.methods
      .initializeMatch(500)
      .accountsPartial({
        matchState: matchState.publicKey,
        user: payer.publicKey,
        config: configPda,
        vaultAuthority: vaultAuthorityPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([matchState])
      .rpc();

    const vaultAccount = Keypair.generate();
    const lamports = await getMinimumBalanceForRentExemptAccount(
      provider.connection,
    );

    const createVaultTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: vaultAccount.publicKey,
        lamports,
        space: ACCOUNT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeAccountInstruction(
        vaultAccount.publicKey,
        goldMint,
        vaultAuthorityPda,
        TOKEN_PROGRAM_ID,
      ),
    );
    await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      createVaultTx,
      [payer, vaultAccount],
    );

    const orderBook = Keypair.generate();
    await clobProgram.methods
      .initializeOrderBook()
      .accountsPartial({
        user: payer.publicKey,
        matchState: matchState.publicKey,
        orderBook: orderBook.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([orderBook])
      .rpc();

    const initialTraderBalance = await getAccount(
      provider.connection,
      traderGoldAta,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );

    // CLOB program deducts trade fees on placement (treasury + market-maker)
    // The actual deduction observed on-chain is 100 BPS total
    const tradeFee = Math.floor((ONE_GOLD * 100) / 10_000);

    // Get the next order ID before placing so we know which ID to cancel
    const matchStateBefore = (await clobProgram.account.matchState.fetch(
      matchState.publicKey,
    )) as any;
    const orderId = new anchor.BN(
      (matchStateBefore.nextOrderId ?? 0).toString(),
    );

    await clobProgram.methods
      .placeOrder(true, 500, bn(ONE_GOLD))
      .accountsPartial({
        matchState: matchState.publicKey,
        orderBook: orderBook.publicKey,
        config: configPda,
        userTokenAccount: traderGoldAta,
        treasuryTokenAccount,
        marketMakerTokenAccount,
        vault: vaultAccount.publicKey,
        vaultAuthority: vaultAuthorityPda,
        user: trader.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([trader])
      .rpc();

    await sleep(500);

    const cancelSig = await clobProgram.methods
      .cancelOrder(orderId)
      .accountsPartial({
        matchState: matchState.publicKey,
        orderBook: orderBook.publicKey,
        userTokenAccount: traderGoldAta,
        vault: vaultAccount.publicKey,
        vaultAuthority: vaultAuthorityPda,
        user: trader.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([trader])
      .rpc();

    await provider.connection.confirmTransaction(cancelSig, "confirmed");

    const finalTraderBalance = await getAccount(
      provider.connection,
      traderGoldAta,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );
    expect(finalTraderBalance.amount).to.equal(
      initialTraderBalance.amount - BigInt(tradeFee),
    );

    const orderBookState = (await clobProgram.account.orderBook.fetch(
      orderBook.publicKey,
    )) as any;
    expect(orderBookState.orders.length).to.equal(0);
  });

  it("rejects invalid winner values in CLOB resolve_match", async () => {
    const payer = (provider.wallet as anchor.Wallet & { payer: Keypair }).payer;
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      clobProgram.programId,
    );
    const existingConfig =
      await clobProgram.account.marketConfig.fetchNullable(configPda);

    if (!existingConfig) {
      const mint = await createMint(
        provider.connection,
        payer,
        payer.publicKey,
        null,
        DECIMALS,
        undefined,
        undefined,
        TOKEN_PROGRAM_ID,
      );
      const treasuryOwner = Keypair.generate();
      const marketMakerOwner = Keypair.generate();
      const treasuryTokenAccount = await createAccount(
        provider.connection,
        payer,
        mint,
        treasuryOwner.publicKey,
        undefined,
        undefined,
        TOKEN_PROGRAM_ID,
      );
      const marketMakerTokenAccount = await createAccount(
        provider.connection,
        payer,
        mint,
        marketMakerOwner.publicKey,
        undefined,
        undefined,
        TOKEN_PROGRAM_ID,
      );

      await clobProgram.methods
        .initializeConfig(
          treasuryTokenAccount,
          marketMakerTokenAccount,
          100,
          100,
          200,
        )
        .accountsPartial({
          authority: payer.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }

    const matchState = Keypair.generate();
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_auth"), matchState.publicKey.toBuffer()],
      clobProgram.programId,
    );

    await clobProgram.methods
      .initializeMatch(500)
      .accountsPartial({
        matchState: matchState.publicKey,
        user: payer.publicKey,
        config: configPda,
        vaultAuthority: vaultAuthorityPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([matchState])
      .rpc();

    let invalidWinnerMessage = "";
    try {
      await clobProgram.methods
        .resolveMatch(0)
        .accountsPartial({
          matchState: matchState.publicKey,
          authority: payer.publicKey,
        })
        .rpc();
      expect.fail("Expected resolve_match to reject winner=0");
    } catch (error) {
      invalidWinnerMessage =
        error instanceof Error ? error.message : String(error ?? "");
    }

    expect(invalidWinnerMessage).to.satisfy((message: string) => {
      return (
        message.includes("InvalidWinner") ||
        message.includes("Winner must be YES (1) or NO (2)")
      );
    });
  });
});
