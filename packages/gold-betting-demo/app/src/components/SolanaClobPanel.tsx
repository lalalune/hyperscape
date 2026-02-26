import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeAccountInstruction,
  getMinimumBalanceForRentExemptAccount,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import {
  GOLD_CLOB_MARKET_PROGRAM_ID,
  createPrograms,
  createReadonlyPrograms,
} from "../lib/programs";
import { findAnyGoldAccount } from "../lib/token";
import {
  GAME_API_URL,
  GOLD_DECIMALS,
  CONFIG,
  buildArenaWriteHeaders,
  ENABLE_MANUAL_MARKET_ADMIN_CONTROLS,
} from "../lib/config";
import { getStoredInviteCode } from "../lib/invite";
import { findClobConfigPda, findClobVaultAuthorityPda } from "../lib/clobPdas";
import {
  PredictionMarketPanel,
  type ChartDataPoint,
} from "./PredictionMarketPanel";
import { type Trade } from "./RecentTrades";
import { type OrderLevel } from "./OrderBook";
import { PointsDisplay } from "./PointsDisplay";

type BetSide = "YES" | "NO";

type ActiveMatch = {
  matchState: PublicKey;
  orderBook: PublicKey;
  vaultAuthority: PublicKey;
  vault: PublicKey;
  isOpen: boolean;
  winner: number;
  nextOrderId: bigint;
  authority: PublicKey;
};

type ClobConfigAccount = {
  treasuryTokenAccount: PublicKey;
  marketMakerTokenAccount: PublicKey;
  tradeTreasuryFeeBps: number;
  tradeMarketMakerFeeBps: number;
  winningsMarketMakerFeeBps: number;
};

type UserPosition = {
  yesShares: bigint;
  noShares: bigint;
};

const DEFAULT_EXTERNAL_TRACKING_FEE_BPS = 200;
const DEFAULT_TREASURY_FEE_OWNER =
  "JC4LUSsT3DZYGHrukS3WP5wwBGmA5w5jVGNbjDSgexFH";
const DEFAULT_MARKET_MAKER_FEE_OWNER =
  "BpG23aqgtPoNYGhGqn3wZHhzcULZ2Fd7Y8Bm8XNL2JdC";

function parseConfiguredPubkey(value: string | undefined): PublicKey | null {
  if (!value || value.trim().length === 0) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

const TREASURY_FEE_OWNER =
  parseConfiguredPubkey(CONFIG.binaryTradeTreasuryWallet) ||
  new PublicKey(DEFAULT_TREASURY_FEE_OWNER);
const MARKET_MAKER_FEE_OWNER =
  parseConfiguredPubkey(CONFIG.binaryTradeMarketMakerWallet) ||
  parseConfiguredPubkey(CONFIG.binaryMarketMakerWallet) ||
  new PublicKey(DEFAULT_MARKET_MAKER_FEE_OWNER);

function toBaseUnits(amountInput: string): bigint {
  const value = Number(amountInput.trim());
  if (!Number.isFinite(value) || value <= 0) return 0n;
  return BigInt(Math.floor(value * 10 ** GOLD_DECIMALS));
}

function asBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.floor(value));
  if (value && typeof value === "object" && "toString" in value) {
    return BigInt((value as { toString: () => string }).toString());
  }
  return 0n;
}

function clampPrice(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 500;
  return Math.min(999, Math.max(1, Math.floor(parsed)));
}

function fmtAmount(value: bigint): number {
  return Number(value) / 10 ** GOLD_DECIMALS;
}

function walletReady(wallet: ReturnType<typeof useWallet>): boolean {
  return Boolean(
    wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions,
  );
}

interface SolanaClobPanelProps {
  agent1Name: string;
  agent2Name: string;
  /** Sidebar compact mode: hides admin/debug panel, uses single-column PredictionMarketPanel */
  compact?: boolean;
}

export function SolanaClobPanel({
  agent1Name,
  agent2Name,
  compact = false,
}: SolanaClobPanelProps) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [status, setStatus] = useState("Connect Solana wallet to trade");
  const [side, setSide] = useState<BetSide>("YES");
  const [amountInput, setAmountInput] = useState("1");
  const [priceInput, setPriceInput] = useState("500");
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [configAccount, setConfigAccount] = useState<ClobConfigAccount | null>(
    null,
  );
  const [position, setPosition] = useState<UserPosition>({
    yesShares: 0n,
    noShares: 0n,
  });
  const [yesPool, setYesPool] = useState<bigint>(0n);
  const [noPool, setNoPool] = useState<bigint>(0n);
  const [bids, setBids] = useState<OrderLevel[]>([]);
  const [asks, setAsks] = useState<OrderLevel[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<bigint | null>(null);

  const [txs, setTxs] = useState({
    initConfig: "-",
    createMatch: "-",
    initOrderBook: "-",
    placeOrder: "-",
    cancelOrder: "-",
    resolveMatch: "-",
    claim: "-",
  });

  const preferredMatchRef = useRef<string | null>(null);
  const autoClaimedMatchesRef = useRef<Set<string>>(new Set());
  const lastSnapshotRef = useRef<{ yes: bigint; no: bigint }>({
    yes: 0n,
    no: 0n,
  });

  const writablePrograms = useMemo(
    () => (walletReady(wallet) ? createPrograms(connection, wallet) : null),
    [connection, wallet],
  );

  const readonlyPrograms = useMemo(
    () => createReadonlyPrograms(connection),
    [connection],
  );

  const configPda = useMemo(
    () => findClobConfigPda(GOLD_CLOB_MARKET_PROGRAM_ID),
    [],
  );
  const goldMint = useMemo(() => new PublicKey(CONFIG.goldMint), []);

  const createTokenAccountForOwner = useCallback(
    async (owner: PublicKey): Promise<PublicKey> => {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error("Connect wallet first");
      }

      const tokenAccount = Keypair.generate();
      const lamports = await getMinimumBalanceForRentExemptAccount(
        connection,
        "confirmed",
      );

      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: tokenAccount.publicKey,
          lamports,
          space: ACCOUNT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeAccountInstruction(
          tokenAccount.publicKey,
          goldMint,
          owner,
          TOKEN_PROGRAM_ID,
        ),
      );
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (
        await connection.getLatestBlockhash("confirmed")
      ).blockhash;
      tx.partialSign(tokenAccount);

      const signature = await wallet.sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      return tokenAccount.publicKey;
    },
    [connection, goldMint, wallet.publicKey, wallet.sendTransaction],
  );

  const updateChartAndTrades = useCallback(
    (nextYes: bigint, nextNo: bigint) => {
      const now = Date.now();
      const prev = lastSnapshotRef.current;
      const yesDelta = nextYes - prev.yes;
      const noDelta = nextNo - prev.no;

      const total = nextYes + nextNo;
      const pct = total > 0n ? Number((nextYes * 100n) / total) : 50;

      if (chartData.length === 0) {
        setChartData([{ time: now, pct }]);
      } else if (yesDelta !== 0n || noDelta !== 0n) {
        setChartData((prevChart) => {
          const next = [...prevChart, { time: now, pct }];
          return next.length > 100 ? next.slice(next.length - 100) : next;
        });
      }

      if (yesDelta > 0n) {
        setRecentTrades((prevTrades) =>
          [
            {
              id: `sol-clob-yes-${now}`,
              side: "YES" as const,
              amount: fmtAmount(yesDelta),
              price: pct / 100,
              time: now,
            },
            ...prevTrades,
          ].slice(0, 50),
        );
      }
      if (noDelta > 0n) {
        setRecentTrades((prevTrades) =>
          [
            {
              id: `sol-clob-no-${now}`,
              side: "NO" as const,
              amount: fmtAmount(noDelta),
              price: pct / 100,
              time: now + 1,
            },
            ...prevTrades,
          ].slice(0, 50),
        );
      }

      lastSnapshotRef.current = { yes: nextYes, no: nextNo };
    },
    [chartData.length],
  );

  const refreshData = useCallback(async () => {
    const clobProgram: any = readonlyPrograms.goldClobMarket;
    setIsRefreshing(true);

    try {
      const cfg = (await clobProgram.account.marketConfig.fetchNullable(
        configPda,
      )) as any;
      if (cfg) {
        setConfigAccount({
          treasuryTokenAccount: cfg.treasuryTokenAccount as PublicKey,
          marketMakerTokenAccount: cfg.marketMakerTokenAccount as PublicKey,
          tradeTreasuryFeeBps: Number(
            cfg.tradeTreasuryFeeBps ?? cfg.tradingFeeBps ?? 0,
          ),
          tradeMarketMakerFeeBps: Number(cfg.tradeMarketMakerFeeBps ?? 0),
          winningsMarketMakerFeeBps: Number(
            cfg.winningsMarketMakerFeeBps ?? cfg.winningsFeeBps ?? 0,
          ),
        });
      } else {
        setConfigAccount(null);
      }

      const activeMatches = await connection.getProgramAccounts(
        GOLD_CLOB_MARKET_PROGRAM_ID,
        {
          filters: [
            { dataSize: 84 }, // Size of MatchState account (8 discriminator + space)
            { memcmp: { offset: 8, bytes: "2" } }, // isOpen == true (1 byte boolean encoded as true -> 1, false -> 0, Wait, in Borsh bool true is 1. base58 of [1] is '2')
          ],
        },
      );

      // And we need the preferred match if one is active but maybe closed recently
      let preferredMatchAccount: any = null;
      if (preferredMatchRef.current) {
        try {
          preferredMatchAccount = await clobProgram.account.matchState.fetch(
            new PublicKey(preferredMatchRef.current),
          );
        } catch {
          // ignore
        }
      }

      const matchEntries = activeMatches
        .map((m) => ({
          publicKey: m.pubkey,
          account: clobProgram.coder.accounts.decode(
            "matchState",
            m.account.data,
          ),
        }))
        .sort((a, b) =>
          a.publicKey.toBase58().localeCompare(b.publicKey.toBase58()),
        );

      if (matchEntries.length === 0 && !preferredMatchAccount) {
        setActiveMatch(null);
        setYesPool(0n);
        setNoPool(0n);
        setPosition({ yesShares: 0n, noShares: 0n });
        return;
      }

      const preferred =
        preferredMatchRef.current && preferredMatchAccount
          ? {
              publicKey: new PublicKey(preferredMatchRef.current),
              account: preferredMatchAccount,
            }
          : null;

      const open = matchEntries.filter((entry) =>
        Boolean(entry.account.isOpen),
      );
      const selected =
        preferred ??
        open[open.length - 1] ??
        matchEntries[matchEntries.length - 1];

      const matchStatePk = selected.publicKey;
      const vaultAuthority = findClobVaultAuthorityPda(
        GOLD_CLOB_MARKET_PROGRAM_ID,
        matchStatePk,
      );

      const vaultAccounts = await connection.getTokenAccountsByOwner(
        vaultAuthority,
        { mint: goldMint },
        "confirmed",
      );
      const vault = vaultAccounts.value[0]?.pubkey ?? PublicKey.default;

      // Find active orderbook PDAs for 'selected' match
      const orderBookPda = PublicKey.findProgramAddressSync(
        [Buffer.from("order_book"), matchStatePk.toBuffer()], // TODO: The orderbook isn't a PDA right now actually! We need to either read `all()` for the orderbook, or refactor orderbook to a PDA. Let's just keep using `.all()` for orderbooks but filtered manually below.
        GOLD_CLOB_MARKET_PROGRAM_ID,
      )[0];

      const allOrderBooks =
        (await clobProgram.account.orderBook.all()) as Array<{
          publicKey: PublicKey;
          account: any;
        }>;
      const orderBookEntry = allOrderBooks.find((entry) =>
        (entry.account.matchState as PublicKey).equals(matchStatePk),
      );
      if (!orderBookEntry) {
        setActiveMatch({
          matchState: matchStatePk,
          orderBook: PublicKey.default,
          vaultAuthority,
          vault,
          isOpen: Boolean(selected.account.isOpen),
          winner: Number(selected.account.winner),
          nextOrderId: asBigInt(selected.account.nextOrderId),
          authority: selected.account.authority as PublicKey,
        });
        setYesPool(0n);
        setNoPool(0n);
        setBids([]);
        setAsks([]);
        setPosition({ yesShares: 0n, noShares: 0n });
        return;
      }

      const orderBook = orderBookEntry.account;
      const balances = (orderBook.balances as any[]) ?? [];
      let yes = 0n;
      let no = 0n;
      let userPos: UserPosition = { yesShares: 0n, noShares: 0n };
      for (const bal of balances) {
        const yesShares = asBigInt(bal.yesShares);
        const noShares = asBigInt(bal.noShares);
        yes += yesShares;
        no += noShares;
        if (
          wallet.publicKey &&
          (bal.user as PublicKey).equals(wallet.publicKey)
        ) {
          userPos = { yesShares, noShares };
        }
      }

      const openOrders = ((orderBook.orders as any[]) ?? []).filter(
        (order) => asBigInt(order.amount) > asBigInt(order.filled),
      );
      const bidRows = openOrders
        .filter((order) => order.isBuy)
        .sort((a, b) => Number(b.price) - Number(a.price))
        .map((order) => ({
          price: Number(order.price) / 1000,
          amount: fmtAmount(asBigInt(order.amount) - asBigInt(order.filled)),
          total: 0,
        }));
      const askRows = openOrders
        .filter((order) => !order.isBuy)
        .sort((a, b) => Number(a.price) - Number(b.price))
        .map((order) => ({
          price: Number(order.price) / 1000,
          amount: fmtAmount(asBigInt(order.amount) - asBigInt(order.filled)),
          total: 0,
        }));

      let bidTotal = 0;
      const normalizedBids = bidRows.slice(0, 12).map((row) => {
        bidTotal += row.amount;
        return { ...row, total: bidTotal };
      });
      let askTotal = 0;
      const normalizedAsks = askRows.slice(0, 12).map((row) => {
        askTotal += row.amount;
        return { ...row, total: askTotal };
      });

      setActiveMatch({
        matchState: matchStatePk,
        orderBook: orderBookEntry.publicKey,
        vaultAuthority,
        vault,
        isOpen: Boolean(selected.account.isOpen),
        winner: Number(selected.account.winner),
        nextOrderId: asBigInt(selected.account.nextOrderId),
        authority: selected.account.authority as PublicKey,
      });
      setYesPool(yes);
      setNoPool(no);
      setPosition(userPos);
      setBids(normalizedBids);
      setAsks(normalizedAsks);
      updateChartAndTrades(yes, no);

      if (!wallet.publicKey) {
        setStatus("Connect Solana wallet to trade");
      } else if (!selected.account.isOpen) {
        const winnerLabel =
          Number(selected.account.winner) === 1 ? "YES" : "NO";
        setStatus(`Resolved (${winnerLabel})`);
      } else {
        setStatus("Market open");
      }
    } catch (error) {
      setStatus(`Refresh failed: ${(error as Error).message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    connection,
    configPda,
    goldMint,
    readonlyPrograms,
    updateChartAndTrades,
    wallet.publicKey,
  ]);

  useEffect(() => {
    void refreshData();
    const id = window.setInterval(() => void refreshData(), 5000);
    return () => window.clearInterval(id);
  }, [refreshData]);

  const ensureConfig = useCallback(async (): Promise<ClobConfigAccount> => {
    const clobProgram: any = writablePrograms?.goldClobMarket;
    if (!clobProgram || !wallet.publicKey || !wallet.sendTransaction) {
      throw new Error("Connect wallet first");
    }

    const existing = (await clobProgram.account.marketConfig.fetchNullable(
      configPda,
    )) as any;
    if (existing) {
      const cfg: ClobConfigAccount = {
        treasuryTokenAccount: existing.treasuryTokenAccount as PublicKey,
        marketMakerTokenAccount: existing.marketMakerTokenAccount as PublicKey,
        tradeTreasuryFeeBps: Number(
          existing.tradeTreasuryFeeBps ?? existing.tradingFeeBps ?? 0,
        ),
        tradeMarketMakerFeeBps: Number(existing.tradeMarketMakerFeeBps ?? 0),
        winningsMarketMakerFeeBps: Number(
          existing.winningsMarketMakerFeeBps ?? existing.winningsFeeBps ?? 0,
        ),
      };
      setConfigAccount(cfg);
      return cfg;
    }

    const ensureFeeTokenAccount = async (
      owner: PublicKey,
    ): Promise<PublicKey> => {
      const existing = await connection.getTokenAccountsByOwner(
        owner,
        { mint: goldMint },
        "confirmed",
      );
      if (existing.value[0]?.pubkey) return existing.value[0].pubkey;
      return createTokenAccountForOwner(owner);
    };
    const treasuryTokenAccount =
      await ensureFeeTokenAccount(TREASURY_FEE_OWNER);
    const marketMakerTokenAccount = await ensureFeeTokenAccount(
      MARKET_MAKER_FEE_OWNER,
    );

    const initConfigTx = (await clobProgram.methods
      .initializeConfig(
        treasuryTokenAccount,
        marketMakerTokenAccount,
        100,
        100,
        200,
      )
      .accounts({
        authority: wallet.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc()) as string;

    setTxs((prev) => ({ ...prev, initConfig: initConfigTx }));

    const created = (await clobProgram.account.marketConfig.fetch(
      configPda,
    )) as any;
    const cfg: ClobConfigAccount = {
      treasuryTokenAccount: created.treasuryTokenAccount as PublicKey,
      marketMakerTokenAccount: created.marketMakerTokenAccount as PublicKey,
      tradeTreasuryFeeBps: Number(created.tradeTreasuryFeeBps),
      tradeMarketMakerFeeBps: Number(created.tradeMarketMakerFeeBps),
      winningsMarketMakerFeeBps: Number(created.winningsMarketMakerFeeBps),
    };
    setConfigAccount(cfg);
    return cfg;
  }, [
    configPda,
    connection,
    createTokenAccountForOwner,
    goldMint,
    wallet.publicKey,
    wallet.sendTransaction,
    writablePrograms,
  ]);

  const handleCreateMatch = async () => {
    try {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error("Connect wallet first");
      }
      const clobProgram: any = writablePrograms?.goldClobMarket;
      if (!clobProgram) throw new Error("Program unavailable");

      await ensureConfig();

      const matchState = Keypair.generate();
      const orderBook = Keypair.generate();
      const vaultAuthority = findClobVaultAuthorityPda(
        GOLD_CLOB_MARKET_PROGRAM_ID,
        matchState.publicKey,
      );
      const vaultAccounts = await connection.getTokenAccountsByOwner(
        vaultAuthority,
        { mint: goldMint },
        "confirmed",
      );
      if (!vaultAccounts.value[0]?.pubkey) {
        await createTokenAccountForOwner(vaultAuthority);
      }

      const matchTx = (await clobProgram.methods
        .initializeMatch(500)
        .accounts({
          matchState: matchState.publicKey,
          user: wallet.publicKey,
          config: configPda,
          vaultAuthority,
          systemProgram: SystemProgram.programId,
        })
        .signers([matchState])
        .rpc()) as string;
      setTxs((prev) => ({ ...prev, createMatch: matchTx }));

      const orderBookTx = (await clobProgram.methods
        .initializeOrderBook()
        .accounts({
          user: wallet.publicKey,
          matchState: matchState.publicKey,
          orderBook: orderBook.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([orderBook])
        .rpc()) as string;
      setTxs((prev) => ({ ...prev, initOrderBook: orderBookTx }));

      preferredMatchRef.current = matchState.publicKey.toBase58();
      setStatus("Created new Solana CLOB market");
      await refreshData();
    } catch (error) {
      setStatus(`Create match failed: ${(error as Error).message}`);
    }
  };

  const handlePlaceOrder = async () => {
    try {
      if (!wallet.publicKey) throw new Error("Connect wallet first");
      const clobProgram: any = writablePrograms?.goldClobMarket;
      if (!clobProgram) throw new Error("Program unavailable");
      if (
        !activeMatch ||
        !activeMatch.orderBook ||
        activeMatch.orderBook.equals(PublicKey.default)
      ) {
        throw new Error("Create a match first");
      }
      if (activeMatch.vault.equals(PublicKey.default)) {
        throw new Error("Vault account missing for selected match");
      }

      const cfg = configAccount ?? (await ensureConfig());
      const userGold = await findAnyGoldAccount(
        connection,
        wallet.publicKey,
        goldMint,
      );
      if (!userGold) throw new Error("No GOLD token account in wallet");

      const amount = toBaseUnits(amountInput);
      if (amount <= 0n) throw new Error("Amount must be > 0");
      const isBuy = side === "YES";
      const price = clampPrice(priceInput);

      const before = (await clobProgram.account.matchState.fetch(
        activeMatch.matchState,
      )) as any;
      const beforeOrderId = asBigInt(before.nextOrderId);

      const txSignature = (await clobProgram.methods
        .placeOrder(isBuy, price, new BN(amount.toString()))
        .accounts({
          matchState: activeMatch.matchState,
          orderBook: activeMatch.orderBook,
          config: configPda,
          userTokenAccount: userGold,
          treasuryTokenAccount: cfg.treasuryTokenAccount,
          marketMakerTokenAccount: cfg.marketMakerTokenAccount,
          vault: activeMatch.vault,
          vaultAuthority: activeMatch.vaultAuthority,
          user: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()) as string;
      setTxs((prev) => ({ ...prev, placeOrder: txSignature }));

      const after = (await clobProgram.account.matchState.fetch(
        activeMatch.matchState,
      )) as any;
      const afterOrderId = asBigInt(after.nextOrderId);
      if (afterOrderId > beforeOrderId) {
        setLastOrderId(beforeOrderId);
      }

      const referralTrackingFeeBps = Math.max(
        0,
        Number(cfg.tradeTreasuryFeeBps) + Number(cfg.tradeMarketMakerFeeBps),
      );

      let trackingError: string | null = null;
      try {
        const response = await fetch(
          `${GAME_API_URL}/api/arena/bet/record-external`,
          {
            method: "POST",
            headers: buildArenaWriteHeaders(),
            body: JSON.stringify({
              bettorWallet: wallet.publicKey.toBase58(),
              chain: "SOLANA",
              sourceAsset: "GOLD",
              sourceAmount: amountInput,
              goldAmount: amountInput,
              feeBps:
                referralTrackingFeeBps || DEFAULT_EXTERNAL_TRACKING_FEE_BPS,
              txSignature,
              marketPda: activeMatch.matchState.toBase58(),
              inviteCode: getStoredInviteCode(),
              externalBetRef: `solana:clob:${activeMatch.matchState.toBase58()}`,
            }),
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          trackingError = payload.error ?? `HTTP ${response.status}`;
        }
      } catch {
        trackingError = "request failed";
      }

      setStatus(
        trackingError
          ? `Order placed on-chain. Tracking failed: ${trackingError}`
          : "Order placed",
      );
      await refreshData();
    } catch (error) {
      setStatus(`Place order failed: ${(error as Error).message}`);
    }
  };

  const handleCancelOrder = async () => {
    try {
      if (!wallet.publicKey) throw new Error("Connect wallet first");
      const clobProgram: any = writablePrograms?.goldClobMarket;
      if (!clobProgram) throw new Error("Program unavailable");
      if (!activeMatch || activeMatch.orderBook.equals(PublicKey.default)) {
        throw new Error("No active order book");
      }
      if (!lastOrderId) throw new Error("No local open order to cancel");

      const userGold = await findAnyGoldAccount(
        connection,
        wallet.publicKey,
        goldMint,
      );
      if (!userGold) throw new Error("No GOLD token account in wallet");

      const txSignature = (await clobProgram.methods
        .cancelOrder(new BN(lastOrderId.toString()))
        .accounts({
          matchState: activeMatch.matchState,
          orderBook: activeMatch.orderBook,
          userTokenAccount: userGold,
          vault: activeMatch.vault,
          vaultAuthority: activeMatch.vaultAuthority,
          user: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()) as string;

      setTxs((prev) => ({ ...prev, cancelOrder: txSignature }));
      setStatus("Order canceled");
      await refreshData();
    } catch (error) {
      setStatus(`Cancel failed: ${(error as Error).message}`);
    }
  };

  const handleResolve = async () => {
    try {
      if (!wallet.publicKey) throw new Error("Connect wallet first");
      const clobProgram: any = writablePrograms?.goldClobMarket;
      if (!clobProgram) throw new Error("Program unavailable");
      if (!activeMatch) throw new Error("Create/select a match first");

      const winner = side === "YES" ? 1 : 2;
      const txSignature = (await clobProgram.methods
        .resolveMatch(winner)
        .accounts({
          matchState: activeMatch.matchState,
          authority: wallet.publicKey,
        })
        .rpc()) as string;

      setTxs((prev) => ({ ...prev, resolveMatch: txSignature }));
      setStatus(`Resolved. Winner: ${side}`);
      await refreshData();
    } catch (error) {
      setStatus(`Resolve failed: ${(error as Error).message}`);
    }
  };

  const handleClaim = useCallback(
    async (source: "manual" | "auto" = "manual") => {
      try {
        if (!wallet.publicKey) throw new Error("Connect wallet first");
        const clobProgram: any = writablePrograms?.goldClobMarket;
        if (!clobProgram) throw new Error("Program unavailable");
        if (!activeMatch || !configAccount)
          throw new Error("Missing market/config state");

        const userGold = await findAnyGoldAccount(
          connection,
          wallet.publicKey,
          goldMint,
        );
        if (!userGold) throw new Error("No GOLD token account in wallet");

        if (source === "auto") {
          setStatus("Auto-claiming payout...");
        }

        const txSignature = (await clobProgram.methods
          .claim()
          .accounts({
            matchState: activeMatch.matchState,
            orderBook: activeMatch.orderBook,
            config: configPda,
            userTokenAccount: userGold,
            treasuryTokenAccount: configAccount.treasuryTokenAccount,
            marketMakerTokenAccount: configAccount.marketMakerTokenAccount,
            vault: activeMatch.vault,
            vaultAuthority: activeMatch.vaultAuthority,
            user: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc()) as string;

        setTxs((prev) => ({ ...prev, claim: txSignature }));
        setStatus(source === "auto" ? "Auto-claim complete" : "Claim complete");
        await refreshData();
      } catch (error) {
        if (source === "auto") {
          setStatus(`Auto-claim skipped: ${(error as Error).message}`);
        } else {
          setStatus(`Claim failed: ${(error as Error).message}`);
        }
      }
    },
    [
      activeMatch,
      configAccount,
      connection,
      configPda,
      refreshData,
      wallet.publicKey,
      writablePrograms,
    ],
  );

  useEffect(() => {
    if (
      !wallet.publicKey ||
      !activeMatch ||
      activeMatch.isOpen ||
      !configAccount
    ) {
      return;
    }
    if (txs.claim !== "-") return;

    const winningShares =
      activeMatch.winner === 1
        ? position.yesShares
        : activeMatch.winner === 2
          ? position.noShares
          : 0n;
    if (winningShares <= 0n) return;

    const claimKey = `${activeMatch.matchState.toBase58()}:${wallet.publicKey.toBase58()}`;
    if (autoClaimedMatchesRef.current.has(claimKey)) return;
    autoClaimedMatchesRef.current.add(claimKey);

    void handleClaim("auto").catch(() => {
      autoClaimedMatchesRef.current.delete(claimKey);
    });
  }, [
    activeMatch,
    configAccount,
    handleClaim,
    position.noShares,
    position.yesShares,
    txs.claim,
    wallet.publicKey,
  ]);

  const totalPool = yesPool + noPool;
  const yesPercent = totalPool > 0n ? Number((yesPool * 100n) / totalPool) : 50;
  const noPercent = 100 - yesPercent;

  const matchLabel = activeMatch?.matchState.toBase58() ?? "-";
  const walletConnected = walletReady(wallet);
  const marketFeeSummary = configAccount
    ? `${configAccount.tradeTreasuryFeeBps / 100}% trade -> treasury, ${configAccount.tradeMarketMakerFeeBps / 100}% trade -> MM, ${configAccount.winningsMarketMakerFeeBps / 100}% winnings -> MM`
    : "Config not initialized";

  return (
    <div
      data-testid="solana-clob-panel"
      style={{ display: "grid", gap: 10, position: "relative" }}
    >
      {/* Admin / Debug Panel — hidden in compact sidebar mode */}
      {!compact && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "rgba(0, 0, 0, 0.85)",
            border: "1px solid #333",
            padding: 12,
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 100,
            maxWidth: 320,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Admin Panel
          </div>

          {ENABLE_MANUAL_MARKET_ADMIN_CONTROLS ? (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 4,
              }}
            >
              <button
                data-testid="solana-clob-refresh"
                type="button"
                onClick={() => void refreshData()}
                disabled={isRefreshing}
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                data-testid="solana-clob-create-match"
                type="button"
                onClick={() => void handleCreateMatch()}
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                Create Match
              </button>
              <button
                data-testid="solana-clob-resolve"
                type="button"
                onClick={() => void handleResolve()}
                disabled={!activeMatch?.isOpen}
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                Resolve ({side})
              </button>
              <button
                data-testid="solana-clob-claim"
                type="button"
                onClick={() => void handleClaim("manual")}
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                Claim
              </button>
              <button
                data-testid="solana-clob-cancel-order"
                type="button"
                onClick={() => void handleCancelOrder()}
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                Cancel Last Order
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>
              Market lifecycle is automated by keeper bot.
            </span>
          )}

          <div
            style={{
              fontSize: 10,
              opacity: 0.75,
              wordBreak: "break-all",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              data-testid="solana-clob-status"
              style={{ color: "#fff", marginBottom: 4 }}
            >
              {status}
            </div>
            <div data-testid="solana-clob-init-config-tx">
              Init Config Tx: {txs.initConfig}
            </div>
            <div data-testid="solana-clob-create-match-tx">
              Create Match Tx: {txs.createMatch}
            </div>
            <div data-testid="solana-clob-init-orderbook-tx">
              Init OrderBook Tx: {txs.initOrderBook}
            </div>
            <div data-testid="solana-clob-place-order-tx">
              Place Order Tx: {txs.placeOrder}
            </div>
            <div data-testid="solana-clob-cancel-order-tx">
              Cancel Tx: {txs.cancelOrder}
            </div>
            <div data-testid="solana-clob-resolve-tx">
              Resolve Tx: {txs.resolveMatch}
            </div>
            <div data-testid="solana-clob-claim-tx">Claim Tx: {txs.claim}</div>
          </div>
        </div>
      )}

      {/* Debug metadata rows — hidden in compact sidebar mode */}
      {!compact && (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              data-testid="solana-clob-match"
              style={{ opacity: 0.8, fontSize: 12 }}
            >
              Match: {matchLabel}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              fontSize: 12,
              opacity: 0.85,
            }}
          >
            <span>{marketFeeSummary}</span>
            <span>
              Position YES {fmtAmount(position.yesShares).toFixed(4)} | NO{" "}
              {fmtAmount(position.noShares).toFixed(4)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label style={{ fontSize: 12, opacity: 0.9 }}>
              Limit Price (1-999)
              <input
                data-testid="solana-clob-price-input"
                type="number"
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                min={1}
                max={999}
                style={{ marginLeft: 6, width: 90 }}
              />
            </label>
            <span style={{ fontSize: 12, opacity: 0.75 }}>
              Wallet {walletConnected ? "connected" : "not connected"}
            </span>
          </div>
        </>
      )}

      <PredictionMarketPanel
        compact={compact}
        yesPercent={yesPercent}
        noPercent={noPercent}
        yesPool={fmtAmount(yesPool)}
        noPool={fmtAmount(noPool)}
        side={side}
        setSide={setSide}
        amountInput={amountInput}
        setAmountInput={setAmountInput}
        onPlaceBet={handlePlaceOrder}
        isWalletReady={walletConnected}
        programsReady={true}
        agent1Name={agent1Name}
        agent2Name={agent2Name}
        isEvm={false}
        currencySymbol="SOL"
        supportsSell={true}
        chartData={chartData}
        bids={bids}
        asks={asks}
        recentTrades={recentTrades}
        pointsDisplay={
          <PointsDisplay
            walletAddress={wallet.publicKey?.toBase58() ?? null}
            compact
          />
        }
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
            Sell/NO flow uses the same limit order action with side = NO.
          </div>
          <button type="button" onClick={() => void handlePlaceOrder()}>
            Place Limit Order
          </button>
        </div>
      </PredictionMarketPanel>
    </div>
  );
}
