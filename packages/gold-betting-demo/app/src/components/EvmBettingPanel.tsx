/**
 * EvmBettingPanel — EVM-specific betting panel for GoldClob contract.
 * Handles simple A/B order placement on BSC / Base.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import {
  createWalletClient,
  http,
  type Address,
  formatUnits,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { useChain } from "../lib/ChainContext";
import { getEvmChainConfig } from "../lib/chainConfig";
import { GAME_API_URL, buildArenaWriteHeaders } from "../lib/config";
import { getStoredInviteCode } from "../lib/invite";
import {
  claimWinnings,
  createEvmPublicClient,
  createMatch,
  getMatchMeta,
  getPosition,
  getNextMatchId,
  getBestBid,
  getBestAsk,
  getNativeBalance,
  placeOrder,
  resolveMatch,
  getFeeBps,
  getRecentTrades,
  getRecentOrders,
  type MatchMeta,
  type Position,
} from "../lib/evmClient";

import {
  PredictionMarketPanel,
  type ChartDataPoint,
} from "./PredictionMarketPanel";
import { type Trade } from "./RecentTrades";
import { type OrderLevel } from "./OrderBook";
import { PointsDisplay } from "./PointsDisplay";

// ============================================================================
// Types
// ============================================================================

type BetSide = "YES" | "NO";

function normalizePrivateKey(value: string): `0x${string}` | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) return null;
  return withPrefix as `0x${string}`;
}

// ============================================================================
// Component
// ============================================================================

interface EvmBettingPanelProps {
  agent1Name: string;
  agent2Name: string;
}

export function EvmBettingPanel({
  agent1Name,
  agent2Name,
}: EvmBettingPanelProps) {
  const { activeChain } = useChain();
  const { address } = useAccount();
  const connectedChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const isE2eMode = import.meta.env.MODE === "e2e";

  const chainConfig = useMemo(
    () =>
      activeChain === "bsc" || activeChain === "base"
        ? getEvmChainConfig(activeChain)
        : null,
    [activeChain],
  );

  const headlessPrivateKey = normalizePrivateKey(
    (import.meta.env.VITE_EVM_PRIVATE_KEY as string | undefined) ??
      (import.meta.env.VITE_HEADLESS_EVM_PRIVATE_KEY as string | undefined) ??
      (import.meta.env.VITE_E2E_EVM_PRIVATE_KEY as string | undefined) ??
      "",
  );

  const e2eAccount = useMemo(() => {
    if (!headlessPrivateKey) return null;
    try {
      return privateKeyToAccount(headlessPrivateKey);
    } catch {
      return null;
    }
  }, [headlessPrivateKey]);

  const e2eWalletClient = useMemo(() => {
    if (!chainConfig || !e2eAccount) return null;
    return createWalletClient({
      account: e2eAccount,
      chain: chainConfig.wagmiChain,
      transport: http(chainConfig.rpcUrl),
    });
  }, [chainConfig, e2eAccount]);

  const effectiveWalletClient = walletClient ?? e2eWalletClient;
  const effectiveAddress = (address ?? e2eAccount?.address) as
    | Address
    | undefined;
  const walletConnected = Boolean(effectiveWalletClient && effectiveAddress);

  const [status, setStatus] = useState("Connect wallet to place bet");
  const [matchId, setMatchId] = useState<bigint>(1n);
  const [matchMeta, setMatchMeta] = useState<MatchMeta | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [nativeBalance, setNativeBalance] = useState<bigint>(0n);
  const nativeDecimals = chainConfig?.nativeCurrency.decimals ?? 18;
  const nativeSymbol = chainConfig?.nativeCurrency.symbol ?? "ETH";
  const [bestBid, setBestBid] = useState(0);
  const [bestAsk, setBestAsk] = useState(1000);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // New states for real-time UI
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [bids, setBids] = useState<OrderLevel[]>([]);
  const [asks, setAsks] = useState<OrderLevel[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const [lastOrderTx, setLastOrderTx] = useState("-");
  const [lastCreateTx, setLastCreateTx] = useState("-");
  const [lastResolveTx, setLastResolveTx] = useState("-");
  const [lastClaimTx, setLastClaimTx] = useState("-");
  const [tradeFeeBps, setTradeFeeBps] = useState(200);
  const autoClaimedMatchesRef = useRef<Set<string>>(new Set());

  // Form state
  const [side, setSide] = useState<BetSide>("YES");
  const [amountInput, setAmountInput] = useState("1");

  const isWrongChain = e2eWalletClient
    ? false
    : chainConfig
      ? connectedChainId !== chainConfig.evmChainId
      : false;
  const shortAddress = effectiveAddress
    ? `${effectiveAddress.slice(0, 6)}...${effectiveAddress.slice(-4)}`
    : null;

  const publicClient = useMemo(() => {
    if (!chainConfig) return null;
    return createEvmPublicClient(chainConfig);
  }, [chainConfig]);

  useEffect(() => {
    if (walletConnected && status === "Connect wallet to place bet") {
      setStatus("Wallet connected");
    }
  }, [walletConnected, status]);

  // ============================================================================
  // Data loading
  // ============================================================================

  const refreshData = useCallback(async () => {
    if (!publicClient || !chainConfig) return;
    setIsRefreshing(true);

    try {
      const contractAddr = chainConfig.goldClobAddress as Address;

      // Get latest match ID
      const nextId = await getNextMatchId(publicClient, contractAddr);
      const currentMatchId = nextId > 1n ? nextId - 1n : 1n;
      setMatchId(currentMatchId);

      // Get match meta
      const meta = await getMatchMeta(
        publicClient,
        contractAddr,
        currentMatchId,
      );
      setMatchMeta(meta);

      // Get best bid/ask
      const bid = await getBestBid(publicClient, contractAddr, currentMatchId);
      const ask = await getBestAsk(publicClient, contractAddr, currentMatchId);
      setBestBid(bid);
      setBestAsk(ask);
      const feeBps = await getFeeBps(publicClient, contractAddr);
      setTradeFeeBps(feeBps);

      // User-specific data
      if (effectiveAddress) {
        const pos = await getPosition(
          publicClient,
          contractAddr,
          currentMatchId,
          effectiveAddress,
        );
        setPosition(pos);

        const bal = await getNativeBalance(publicClient, effectiveAddress);
        setNativeBalance(bal);
      }

      // Fetch recent trades and orders for pump.fun UI
      const [fetchedTrades, fetchedOrders] = await Promise.all([
        getRecentTrades(publicClient, contractAddr, currentMatchId),
        getRecentOrders(publicClient, contractAddr, currentMatchId),
      ]);

      const tradesForUi = fetchedTrades.map((t) => ({
        id: t.id,
        side: t.side,
        amount: Number(formatUnits(t.amount, nativeDecimals)),
        time: t.time,
        price: t.price,
      }));
      setRecentTrades(tradesForUi.slice(0, 50));

      const newChartData = fetchedTrades
        .map((t) => ({
          time: t.time,
          pct: Math.round(t.price * 100),
        }))
        .reverse(); // Oldest first for chart

      if (newChartData.length === 0) {
        // Mock a starting point if no trades yet
        newChartData.push({ time: Date.now(), pct: 50 });
      } else {
        // Append current state to the end
        const latestPrice =
          bid > 0 && ask < 1000
            ? (bid + ask) / 2
            : newChartData[newChartData.length - 1].pct * 10;
        newChartData.push({
          time: Date.now(),
          pct: Math.round(latestPrice / 10),
        });
      }
      setChartData(newChartData);

      // Simple OrderBook aggregation
      const bidMap = new Map<number, bigint>();
      const askMap = new Map<number, bigint>();
      for (const o of fetchedOrders) {
        if (o.isBuy)
          bidMap.set(o.price, (bidMap.get(o.price) || 0n) + o.amount);
        else askMap.set(o.price, (askMap.get(o.price) || 0n) + o.amount);
      }

      // Inject best bid/ask heavily so the UI always has depth
      if (bid > 0)
        bidMap.set(
          bid / 1000,
          (bidMap.get(bid / 1000) || 0n) + 500n * 10n ** BigInt(nativeDecimals),
        );
      if (ask < 1000)
        askMap.set(
          ask / 1000,
          (askMap.get(ask / 1000) || 0n) + 500n * 10n ** BigInt(nativeDecimals),
        );

      const sortedBids = Array.from(bidMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([price, amount]) => ({
          price,
          amount: Number(formatUnits(amount, nativeDecimals)),
          total: 0,
        }));

      const sortedAsks = Array.from(askMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([price, amount]) => ({
          price,
          amount: Number(formatUnits(amount, nativeDecimals)),
          total: 0,
        }));

      let bTotal = 0;
      setBids(
        sortedBids.slice(0, 10).map((b) => {
          bTotal += b.amount;
          return { ...b, total: bTotal };
        }),
      );

      let aTotal = 0;
      setAsks(
        sortedAsks.slice(0, 10).map((a) => {
          aTotal += a.amount;
          return { ...a, total: aTotal };
        }),
      );
    } catch (err) {
      console.error("[EvmBettingPanel] refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [publicClient, chainConfig, effectiveAddress]);

  useEffect(() => {
    void refreshData();
    const id = setInterval(() => void refreshData(), 5000);
    return () => clearInterval(id);
  }, [refreshData]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleSwitchChain = async () => {
    if (!chainConfig) return;
    if (e2eWalletClient) {
      setStatus("Headless EVM wallet is pinned to configured RPC");
      return;
    }
    try {
      await switchChainAsync({ chainId: chainConfig.evmChainId });
    } catch (err) {
      setStatus(`Chain switch failed: ${(err as Error).message}`);
    }
  };

  const handleCreateMatch = async () => {
    if (
      !effectiveWalletClient ||
      !effectiveAddress ||
      !chainConfig ||
      !publicClient
    ) {
      setStatus("Wallet not connected");
      return;
    }

    try {
      const contractAddr = chainConfig.goldClobAddress as Address;
      setStatus("Creating match...");
      const tx = await createMatch(
        effectiveWalletClient,
        contractAddr,
        effectiveAddress,
      );
      setLastCreateTx(tx);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus("Match created");
      void refreshData();
    } catch (err) {
      setStatus(`Create match failed: ${(err as Error).message}`);
    }
  };

  const handleResolveYes = async () => {
    if (
      !effectiveWalletClient ||
      !effectiveAddress ||
      !chainConfig ||
      !publicClient
    ) {
      setStatus("Wallet not connected");
      return;
    }

    try {
      const contractAddr = chainConfig.goldClobAddress as Address;
      setStatus("Resolving match (YES)...");
      const tx = await resolveMatch(
        effectiveWalletClient,
        contractAddr,
        matchId,
        1,
        effectiveAddress,
      );
      setLastResolveTx(tx);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus("Match resolved");
      void refreshData();
    } catch (err) {
      setStatus(`Resolve failed: ${(err as Error).message}`);
    }
  };

  const handleClaim = async (source: "manual" | "auto" = "manual") => {
    if (
      !effectiveWalletClient ||
      !effectiveAddress ||
      !chainConfig ||
      !publicClient
    ) {
      if (source === "manual") setStatus("Wallet not connected");
      return;
    }

    try {
      const contractAddr = chainConfig.goldClobAddress as Address;
      setStatus(
        source === "auto"
          ? "Auto-claiming winnings..."
          : "Claiming winnings...",
      );
      const tx = await claimWinnings(
        effectiveWalletClient,
        contractAddr,
        matchId,
        effectiveAddress,
      );
      setLastClaimTx(tx);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus("Claim complete");
      void refreshData();
    } catch (err) {
      if (source === "manual") {
        setStatus(`Claim failed: ${(err as Error).message}`);
      }
    }
  };

  const handlePlaceOrder = async () => {
    if (
      !effectiveWalletClient ||
      !effectiveAddress ||
      !chainConfig ||
      !publicClient
    ) {
      setStatus("Wallet not connected");
      return;
    }

    const contractAddr = chainConfig.goldClobAddress as Address;
    const price = executionPrice;

    try {
      const amount = parseUnits(amountInput, nativeDecimals);
      if (amount <= 0n) {
        setStatus("Amount must be > 0");
        return;
      }

      // Calculate cost in native currency
      const isBuy = side === "YES";
      const costPrice = BigInt(isBuy ? price : 1000 - price);
      const cost = (amount * costPrice) / 1000n;
      const tradeFee = (cost * BigInt(Math.max(0, tradeFeeBps))) / 10000n;
      const totalValue = cost + tradeFee;

      setStatus("Placing order...");
      const tx = await placeOrder(
        effectiveWalletClient,
        contractAddr,
        matchId,
        isBuy,
        price,
        amount,
        effectiveAddress,
        totalValue,
      );
      setLastOrderTx(tx);
      setStatus(`Order sent: ${tx.slice(0, 10)}...`);
      await publicClient.waitForTransactionReceipt({ hash: tx });

      let trackingError: string | null = null;
      try {
        const response = await fetch(
          `${GAME_API_URL}/api/arena/bet/record-external`,
          {
            method: "POST",
            headers: buildArenaWriteHeaders(),
            body: JSON.stringify({
              bettorWallet: effectiveAddress,
              chain: chainConfig.chainId === "bsc" ? "BSC" : "BASE",
              sourceAsset: nativeSymbol,
              sourceAmount: amountInput,
              goldAmount: amountInput,
              feeBps: tradeFeeBps,
              txSignature: tx,
              inviteCode: getStoredInviteCode(),
              externalBetRef: `evm:${chainConfig.chainId}:match:${matchId.toString()}`,
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
          : "Order placed!",
      );
      void refreshData();
    } catch (err) {
      setStatus(`Order failed: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    if (!isE2eMode) return;
    if (!walletConnected || isWrongChain || !effectiveAddress || !chainConfig)
      return;
    if (!matchMeta || matchMeta.status !== "RESOLVED") return;
    if (!position) return;

    const winningShares =
      matchMeta.winner === "YES"
        ? position.yesShares
        : matchMeta.winner === "NO"
          ? position.noShares
          : 0n;
    if (winningShares <= 0n) return;

    const claimKey = `${chainConfig.chainId}:${matchId.toString()}:${effectiveAddress.toLowerCase()}`;
    if (autoClaimedMatchesRef.current.has(claimKey)) return;
    autoClaimedMatchesRef.current.add(claimKey);

    void handleClaim("auto");
  }, [
    chainConfig,
    effectiveAddress,
    handleClaim,
    isE2eMode,
    isWrongChain,
    matchId,
    matchMeta,
    position,
    walletConnected,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!chainConfig) {
    return (
      <div
        style={{
          background: "rgba(0,0,0,0.65)",
          padding: 24,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          color: "#fff",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.78)",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {activeChain.toUpperCase()} market unavailable right now.
        </div>
      </div>
    );
  }

  const yesPool = matchMeta
    ? Number(formatUnits(matchMeta.yesPool, nativeDecimals))
    : 0;
  const noPool = matchMeta
    ? Number(formatUnits(matchMeta.noPool, nativeDecimals))
    : 0;
  const totalPool = yesPool + noPool;
  const yesPercent =
    totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
  const noPercent = 100 - yesPercent;
  const midPrice =
    bestBid > 0 && bestAsk < 1000
      ? ((bestBid + bestAsk) / 2 / 1000).toFixed(3)
      : "—";
  const executionPrice =
    side === "YES"
      ? bestAsk > 0 && bestAsk < 1000
        ? bestAsk
        : bestBid > 0 && bestBid < 1000
          ? Math.min(999, bestBid + 25)
          : 500
      : bestBid > 0 && bestBid < 1000
        ? bestBid
        : bestAsk > 0 && bestAsk < 1000
          ? Math.max(1, bestAsk - 25)
          : 500;

  if (isE2eMode) {
    return (
      <div
        data-testid="evm-panel"
        style={{
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 12,
          padding: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <div data-testid="evm-status">{status}</div>
        <div data-testid="evm-match-id">Match #{matchId.toString()}</div>
        <div data-testid="evm-last-order-tx">{lastOrderTx}</div>
        <div data-testid="evm-last-create-tx">{lastCreateTx}</div>
        <div data-testid="evm-last-resolve-tx">{lastResolveTx}</div>
        <div data-testid="evm-last-claim-tx">{lastClaimTx}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            data-testid="evm-refresh-market"
            onClick={() => void refreshData()}
            disabled={isRefreshing}
          >
            Refresh
          </button>
          <button
            type="button"
            data-testid="evm-pick-yes"
            onClick={() => setSide("YES")}
          >
            Pick YES
          </button>
          <button
            type="button"
            data-testid="evm-pick-no"
            onClick={() => setSide("NO")}
          >
            Pick NO
          </button>
          <input
            data-testid="evm-amount-input"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
          />
          <button
            type="button"
            data-testid="evm-place-order"
            onClick={() => void handlePlaceOrder()}
            disabled={!walletConnected || isWrongChain}
          >
            Place Order
          </button>
          <button
            type="button"
            data-testid="evm-resolve-match"
            onClick={() => void handleResolveYes()}
            disabled={!walletConnected || isWrongChain}
          >
            Resolve Match
          </button>
          <button
            type="button"
            data-testid="evm-claim-payout"
            onClick={() => void handleClaim("manual")}
            disabled={!walletConnected || isWrongChain}
          >
            Claim Payout
          </button>
          <button
            type="button"
            data-testid="evm-create-match"
            onClick={() => void handleCreateMatch()}
            disabled={!walletConnected || isWrongChain}
          >
            Create Match
          </button>
        </div>
      </div>
    );
  }

  return (
    <PredictionMarketPanel
      yesPercent={yesPercent}
      noPercent={noPercent}
      yesPool={yesPool}
      noPool={noPool}
      side={side}
      setSide={setSide}
      amountInput={amountInput}
      setAmountInput={setAmountInput}
      onPlaceBet={handlePlaceOrder}
      isWalletReady={walletConnected && !isWrongChain}
      programsReady={true}
      agent1Name={agent1Name}
      agent2Name={agent2Name}
      isEvm={true}
      currencySymbol={nativeSymbol}
      chartData={chartData}
      bids={bids}
      asks={asks}
      recentTrades={recentTrades}
      pointsDisplay={
        <PointsDisplay walletAddress={effectiveAddress ?? null} compact />
      }
    />
  );
}
