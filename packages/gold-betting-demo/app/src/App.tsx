import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

import {
  DEFAULT_AUTO_SEED_DELAY_SECONDS,
  DEFAULT_BET_FEE_BPS,
  DEFAULT_NEW_ROUND_BET_WINDOW_SECONDS,
  DEFAULT_REFRESH_INTERVAL_MS,
  DEFAULT_SEED_GOLD_AMOUNT,
  GOLD_DECIMALS,
  GOLD_MAINNET_MINT,
  GAME_API_URL,
  UI_SYNC_DELAY_MS,
  buildArenaWriteHeaders,
  getFixedMatchId,
  getCluster,
  toBaseUnits,
  STREAM_URLS,
  CONFIG,
} from "./lib/config";
import {
  buildInviteShareLink,
  captureInviteCodeFromLocation,
  getStoredInviteCode,
} from "./lib/invite";
import { StreamPlayer } from "./components/StreamPlayer";
import { ChainSelector } from "./components/ChainSelector";
import { EvmBettingPanel } from "./components/EvmBettingPanel";
import { SolanaClobPanel } from "./components/SolanaClobPanel";
import {
  PredictionMarketPanel,
  type ChartDataPoint,
} from "./components/PredictionMarketPanel";
import { PerpsMarketPanel } from "./components/PerpsMarketPanel";
import { PointsDisplay } from "./components/PointsDisplay";
import { PointsLeaderboard } from "./components/PointsLeaderboard";
import { PointsHistory } from "./components/PointsHistory";
import { ReferralPanel } from "./components/ReferralPanel";
import { AgentStats } from "./components/AgentStats";
import { useChain } from "./lib/ChainContext";
import {
  FIGHT_ORACLE_PROGRAM_ID,
  GOLD_BINARY_MARKET_PROGRAM_ID,
  createPrograms,
  createReadonlyPrograms,
  noEnum,
  toBnAmount,
  yesEnum,
} from "./lib/programs";
import {
  findMarketConfigPda,
  findMarketPda,
  findNoVaultPda,
  findOracleConfigPda,
  findPositionPda,
  findVaultAuthorityPda,
  findYesVaultPda,
} from "./lib/pdas";
import { findAnyGoldAccount } from "./lib/token";
import { simulateFight, type FightResult } from "./lib/fight";
import { isHeadlessWalletEnabled } from "./lib/headlessWallet";
import { useMockStreamingEngine } from "./lib/useMockStreamingEngine";
import { FightOverlay } from "./components/FightOverlay";
import { useStreamingState } from "./spectator/useStreamingState";

type BetSide = "YES" | "NO";

type DiscoveredMatch = {
  matchId: number;
  matchPda: PublicKey;
  status: "open" | "resolved" | "unknown";
  openTs: number;
  closeTs: number;
  resolvedTs: number | null;
  winner: BetSide | null;
  agent1Name: string;
  agent2Name: string;
};

type ProgramDeploymentState = {
  checked: boolean;
  oracle: boolean;
  market: boolean;
};

type SolanaTxState = {
  seed: string;
  placeBet: string;
  resolveOracle: string;
  resolveMarket: string;
  claim: string;
  startMarket: string;
};

const DEFAULT_TRADE_TREASURY_FEE_BPS = 100;
const DEFAULT_TRADE_MARKET_MAKER_FEE_BPS = 100;
const DEFAULT_WINNINGS_MARKET_MAKER_FEE_BPS = 200;

function isWalletReady(wallet: ReturnType<typeof useWallet>): boolean {
  return Boolean(
    wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions,
  );
}

function normalizeTimestamp(value: number): number {
  if (value > 1_000_000_000_000) return Math.floor(value / 1000);
  return Math.floor(value);
}

function normalizeRemainingSeconds(value: number | null | undefined): number {
  if (!Number.isFinite(value as number)) return 0;
  const raw = Math.max(0, Number(value));
  // Streaming API reports ms, while mock mode reports whole seconds.
  return raw > 10_000 ? Math.floor(raw / 1000) : Math.floor(raw);
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function enumIs(value: unknown, variant: string): boolean {
  if (!value || typeof value !== "object") return false;
  const key = Object.keys(value as Record<string, unknown>)[0];
  return key === variant;
}

import { Provider } from "@coral-xyz/anchor";
import { type Trade } from "./components/RecentTrades";
import { type OrderLevel } from "./components/OrderBook";

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number((value as { toString: () => string }).toString());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asPublicKey(value: unknown): PublicKey | null {
  try {
    if (value && typeof value === "object" && "toBase58" in value) {
      return value as PublicKey;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      return new PublicKey(value);
    }
  } catch {
    // noop
  }
  return null;
}

function sideFromEnum(value: unknown): BetSide | null {
  if (enumIs(value, "yes")) return "YES";
  if (enumIs(value, "no")) return "NO";
  return null;
}

function marketStatusLabel(value: unknown): string {
  if (enumIs(value, "open")) return "OPEN";
  if (enumIs(value, "resolved")) return "RESOLVED";
  if (enumIs(value, "void")) return "VOID";
  return "UNKNOWN";
}

function formatUtc(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toISOString();
}

function isMintLookupError(error: unknown): boolean {
  const message = (error as Error)?.message?.toLowerCase?.() ?? "";
  return message.includes("could not find mint");
}

function extractTxSignature(error: unknown): string | null {
  const message = (error as Error)?.message ?? "";
  const match = message.match(/signature\s+([1-9A-HJ-NP-Za-km-z]{32,88})/i);
  return match?.[1] ?? null;
}

async function waitForTxSuccessBySignature(
  connection: Connection,
  signature: string,
  timeoutMs = 60_000,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const statuses = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = statuses.value[0];
    if (status) {
      if (status.err) return false;
      if (status.confirmationStatus) return true;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
  }
  return false;
}

async function recoverTimedOutTransaction(
  connection: Connection,
  error: unknown,
  timeoutMs = 60_000,
): Promise<boolean> {
  const signature = extractTxSignature(error);
  if (!signature) return false;
  try {
    return await waitForTxSuccessBySignature(connection, signature, timeoutMs);
  } catch {
    return false;
  }
}

function goldDisplay(amount: unknown): string {
  const raw = asNumber(amount, 0);
  return (raw / 10 ** GOLD_DECIMALS).toFixed(6);
}

export function App() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: setSolModalVisible } = useWalletModal();
  const { address: evmWalletAddress } = useAccount();
  const { activeChain, setActiveChain, availableChains } = useChain();
  const isE2eMode = import.meta.env.MODE === "e2e";
  const isE2eDebugMode =
    isE2eMode && new URLSearchParams(window.location.search).has("debug");
  const isStreamUIMode = import.meta.env.MODE === "stream-ui";
  const isEvmChain = activeChain === "bsc" || activeChain === "base";
  const autoSeedEnabled = CONFIG.enableAutoSeed;
  const solanaWalletAddress = wallet.publicKey?.toBase58() ?? null;
  // Spectator sessions should not fan out direct Solana RPC polling.
  const shouldPollChainData =
    !isStreamUIMode &&
    Boolean(isE2eMode || wallet.publicKey || wallet.connected);
  const pointsWalletAddress = useMemo(() => {
    if (activeChain === "solana" && solanaWalletAddress)
      return solanaWalletAddress;
    if ((activeChain === "bsc" || activeChain === "base") && evmWalletAddress) {
      return evmWalletAddress;
    }
    return solanaWalletAddress ?? evmWalletAddress ?? null;
  }, [activeChain, evmWalletAddress, solanaWalletAddress]);
  const invitePlatformQuery = useMemo<"solana" | "evm">(() => {
    if (pointsWalletAddress && pointsWalletAddress === solanaWalletAddress) {
      return "solana";
    }
    if (pointsWalletAddress && pointsWalletAddress === evmWalletAddress) {
      return "evm";
    }
    return activeChain === "solana" ? "solana" : "evm";
  }, [activeChain, evmWalletAddress, pointsWalletAddress, solanaWalletAddress]);

  const [amountInput, setAmountInput] = useState<string>("1");
  const [appMode, setAppMode] = useState<"DUEL" | "PERPS">("DUEL");
  const [side, setSide] = useState<BetSide>("YES");
  const [e2ePayAsset, setE2ePayAsset] = useState<"GOLD" | "SOL" | "USDC">(
    "GOLD",
  );
  const [status, setStatus] = useState<string>("");
  const [fightResult, setFightResult] = useState<FightResult | null>(null);
  const [currentMatch, setCurrentMatch] = useState<DiscoveredMatch | null>(
    null,
  );
  const [lastResolvedMatch, setLastResolvedMatch] =
    useState<DiscoveredMatch | null>(null);
  const [currentMarketState, setCurrentMarketState] = useState<any>(null);
  const [marketConfigState, setMarketConfigState] = useState<any>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [configuredGoldTokenProgram, setConfiguredGoldTokenProgram] =
    useState<PublicKey>(TOKEN_2022_PROGRAM_ID);
  const [programDeployment, setProgramDeployment] =
    useState<ProgramDeploymentState>({
      checked: false,
      oracle: false,
      market: false,
    });
  const [solanaTxs, setSolanaTxs] = useState<SolanaTxState>({
    seed: "-",
    placeBet: "-",
    resolveOracle: "-",
    resolveMarket: "-",
    claim: "-",
    startMarket: "-",
  });
  const [inviteCode, setInviteCode] = useState<string | null>(() =>
    getStoredInviteCode(),
  );
  const [inviteShareStatus, setInviteShareStatus] = useState("");
  const [selectedAgentForStats, setSelectedAgentForStats] = useState<any>(null); // For agent stats modal
  const [isShowingStats, setIsShowingStats] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [streamSourceIndex, setStreamSourceIndex] = useState(0);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [showPointsDrawer, setShowPointsDrawer] = useState(false);
  const [pointsDrawerTab, setPointsDrawerTab] = useState<
    "leaderboard" | "history" | "referral"
  >("leaderboard");

  // Real-time tracking for Solana UI
  const [solanaRecentTrades, setSolanaRecentTrades] = useState<Trade[]>([]);
  const [solanaChartData, setSolanaChartData] = useState<ChartDataPoint[]>([]);
  const lastStateRef = useRef({
    yesPot: 0,
    noPot: 0,
    lastUpdate: 0,
  });
  const autoSeededMarketsRef = useRef<Set<string>>(new Set());
  const autoClaimedMarketsRef = useRef<Set<string>>(new Set());
  const appRootRef = useRef<HTMLDivElement | null>(null);
  const bettingDockInnerRef = useRef<HTMLDivElement | null>(null);

  const mock = useMockStreamingEngine({ disabled: !isStreamUIMode });
  const { state: streamingState } = useStreamingState({
    disabled: isStreamUIMode,
  });
  const liveCycle = streamingState?.cycle ?? null;
  const streamSources = STREAM_URLS;
  const activeStreamUrl = streamSources[streamSourceIndex] ?? "";

  const switchToBackupStream = useCallback(() => {
    setStreamSourceIndex((current) =>
      current + 1 < streamSources.length ? current + 1 : current,
    );
  }, [streamSources.length]);

  const cycleStreamSource = useCallback(() => {
    setStreamSourceIndex((current) =>
      streamSources.length > 1 ? (current + 1) % streamSources.length : current,
    );
  }, [streamSources.length]);

  useEffect(() => {
    if (streamSourceIndex < streamSources.length) return;
    setStreamSourceIndex(0);
  }, [streamSourceIndex, streamSources.length]);

  const forcedE2eWinner = useMemo<BetSide | null>(() => {
    const raw = (import.meta.env.VITE_E2E_FORCE_WINNER as string | undefined)
      ?.trim()
      .toUpperCase();
    if (raw === "YES") return "YES";
    if (raw === "NO") return "NO";
    return null;
  }, []);

  useEffect(() => {
    captureInviteCodeFromLocation();
  }, []);

  useEffect(() => {
    if (!pointsWalletAddress) {
      setInviteCode(getStoredInviteCode());
      setInviteShareStatus("");
      return;
    }

    let cancelled = false;

    const fetchInviteCode = async () => {
      try {
        const response = await fetch(
          `${GAME_API_URL}/api/arena/invite/${pointsWalletAddress}?platform=${invitePlatformQuery}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { inviteCode?: string };
        if (!cancelled && payload.inviteCode?.trim()) {
          setInviteCode(payload.inviteCode.trim().toUpperCase());
        }
      } catch {
        // no-op: keep existing stored invite code fallback
      }
    };

    void fetchInviteCode();
    const id = window.setInterval(() => void fetchInviteCode(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [invitePlatformQuery, pointsWalletAddress]);

  useEffect(() => {
    const appRoot = appRootRef.current;
    if (!appRoot) return;

    if (isE2eDebugMode) {
      appRoot.style.setProperty("--betting-dock-height", "0px");
      return;
    }

    const dockInner = bettingDockInnerRef.current;
    if (!dockInner) return;

    const updateDockHeight = () => {
      const nextHeight = Math.ceil(dockInner.getBoundingClientRect().height);
      appRoot.style.setProperty("--betting-dock-height", `${nextHeight}px`);
    };

    updateDockHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateDockHeight())
        : null;
    resizeObserver?.observe(dockInner);
    window.addEventListener("resize", updateDockHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateDockHeight);
    };
  }, [isE2eDebugMode, isEvmChain]);

  const programs = useMemo(() => {
    if (!isWalletReady(wallet)) return null;
    return createPrograms(connection, wallet);
  }, [connection, wallet]);

  const readonlyPrograms = useMemo(
    () => createReadonlyPrograms(connection),
    [connection],
  );

  const configuredGoldMint = GOLD_MAINNET_MINT;
  const fixedMatchId = getFixedMatchId();
  const marketConfigPda = useMemo(
    () => findMarketConfigPda(GOLD_BINARY_MARKET_PROGRAM_ID),
    [],
  );

  const programsReady =
    programDeployment.checked &&
    programDeployment.oracle &&
    programDeployment.market;

  const missingProgramMessage = useMemo(() => {
    if (programDeployment.oracle && programDeployment.market) return "";
    return `Betting is temporarily unavailable on ${getCluster()}. Please try again later or switch chain.`;
  }, [programDeployment.oracle, programDeployment.market]);

  useEffect(() => {
    if (!shouldPollChainData) return;
    let cancelled = false;
    void (async () => {
      try {
        const mintAccount = await connection.getAccountInfo(
          configuredGoldMint,
          "confirmed",
        );
        if (cancelled || !mintAccount) return;
        if (mintAccount.owner.equals(TOKEN_PROGRAM_ID)) {
          setConfiguredGoldTokenProgram(TOKEN_PROGRAM_ID);
          return;
        }
        if (mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID)) {
          setConfiguredGoldTokenProgram(TOKEN_2022_PROGRAM_ID);
        }
      } catch {
        if (!cancelled) setConfiguredGoldTokenProgram(TOKEN_2022_PROGRAM_ID);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, configuredGoldMint, shouldPollChainData]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTs(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!shouldPollChainData) {
      setProgramDeployment({ checked: true, oracle: true, market: true });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [oracleInfo, marketInfo] = await Promise.all([
          connection.getAccountInfo(FIGHT_ORACLE_PROGRAM_ID, "confirmed"),
          connection.getAccountInfo(GOLD_BINARY_MARKET_PROGRAM_ID, "confirmed"),
        ]);
        if (cancelled) return;
        setProgramDeployment({
          checked: true,
          oracle: Boolean(oracleInfo?.executable),
          market: Boolean(marketInfo?.executable),
        });
      } catch {
        if (cancelled) return;
        setProgramDeployment({ checked: true, oracle: false, market: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, shouldPollChainData]);

  useEffect(() => {
    if (!programDeployment.checked) return;
    if (programsReady) return;
    setStatus(missingProgramMessage);
  }, [programDeployment.checked, programsReady, missingProgramMessage]);

  useEffect(() => {
    if (!isHeadlessWalletEnabled()) return;

    const candidate = wallet.wallets.find((entry) => {
      const name = entry.adapter.name.toLowerCase();
      return name.includes("headless") || name.includes("e2e wallet");
    });
    if (!candidate) return;

    const selected = wallet.wallet?.adapter?.name?.toLowerCase?.() ?? "";
    const hasHeadlessSelected =
      selected.includes("headless") || selected.includes("e2e wallet");

    if (!hasHeadlessSelected) {
      wallet.select(candidate.adapter.name);
      return;
    }

    if (wallet.connected || wallet.connecting) return;
    void wallet.connect();
  }, [
    wallet.wallet,
    wallet.wallets,
    wallet.connected,
    wallet.connecting,
    wallet.select,
    wallet.connect,
  ]);

  useEffect(() => {
    if (!shouldPollChainData) return;
    const id = window.setInterval(() => {
      setRefreshNonce((value) => value + 1);
    }, DEFAULT_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [shouldPollChainData]);

  useEffect(() => {
    if (!shouldPollChainData) return;
    let cancelled = false;

    void (async () => {
      setIsRefreshing(true);
      try {
        const fightProgram: any = readonlyPrograms.fightOracle;
        const marketProgram: any = readonlyPrograms.goldBinaryMarket;

        const allMatchesRaw = await fightProgram.account.matchResult.all();
        const matches = (allMatchesRaw as any[])
          .map<DiscoveredMatch>((entry: any) => {
            const account = entry.account;
            const status = enumIs(account.status, "open")
              ? "open"
              : enumIs(account.status, "resolved")
                ? "resolved"
                : "unknown";

            const matchId = asNumber(account.matchId, 0);
            const openTs = normalizeTimestamp(asNumber(account.openTs, 0));
            const closeTs = normalizeTimestamp(asNumber(account.betCloseTs, 0));
            const resolvedTs = account.resolvedTs
              ? normalizeTimestamp(asNumber(account.resolvedTs))
              : null;

            const metadataUri = account.metadataUri ?? "";
            let agent1Name = "Agent A";
            let agent2Name = "Agent B";
            try {
              if (metadataUri.startsWith("{")) {
                const meta = JSON.parse(metadataUri);
                agent1Name = meta.agent1 || "Agent A";
                agent2Name = meta.agent2 || "Agent B";
              }
            } catch {}

            return {
              matchId,
              matchPda: entry.publicKey as PublicKey,
              status,
              openTs,
              closeTs,
              resolvedTs,
              winner: sideFromEnum(account.winner),
              agent1Name,
              agent2Name,
            };
          })
          .sort(
            (a: DiscoveredMatch, b: DiscoveredMatch) =>
              b.openTs - a.openTs ||
              b.matchId - a.matchId ||
              b.closeTs - a.closeTs,
          );

        let nextCurrent: DiscoveredMatch | null = null;
        const openMatches = matches
          .filter((value) => value.status === "open")
          .sort(
            (a, b) =>
              b.openTs - a.openTs ||
              b.matchId - a.matchId ||
              b.closeTs - a.closeTs,
          );

        if (fixedMatchId) {
          nextCurrent =
            matches.find((value) => value.matchId === fixedMatchId) ?? null;
        }

        if (!nextCurrent) {
          nextCurrent = openMatches[0] ?? matches[0] ?? null;
        }

        const resolved = matches.filter((value) => value.status === "resolved");
        const nextLastResolved =
          resolved.find((value) => value.matchId !== nextCurrent?.matchId) ??
          resolved[0] ??
          null;

        let nextMarketState: any = null;
        let nextMarketConfigState: any = null;
        if (nextCurrent) {
          const marketPda = findMarketPda(
            GOLD_BINARY_MARKET_PROGRAM_ID,
            nextCurrent.matchPda,
          );
          try {
            nextMarketState =
              await marketProgram.account.market.fetch(marketPda);
          } catch {
            nextMarketState = null;
          }
        }

        try {
          nextMarketConfigState =
            await marketProgram.account.marketConfig.fetch(marketConfigPda);
        } catch {
          nextMarketConfigState = null;
        }

        if (cancelled) return;

        if (cancelled) return;

        // Delay UI state application to synchronize with public stream latency
        window.setTimeout(() => {
          if (cancelled) return;
          setCurrentMatch(nextCurrent);
          setLastResolvedMatch(nextLastResolved);
          setCurrentMarketState(nextMarketState);
          setMarketConfigState(nextMarketConfigState);
        }, UI_SYNC_DELAY_MS);
      } catch (error) {
        if (!cancelled) {
          setStatus(`Refresh failed: ${(error as Error).message}`);
        }
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    shouldPollChainData,
    readonlyPrograms,
    refreshNonce,
    fixedMatchId,
    marketConfigPda,
    UI_SYNC_DELAY_MS,
  ]);

  const addresses = useMemo(() => {
    if (!currentMatch) return null;
    const market = findMarketPda(
      GOLD_BINARY_MARKET_PROGRAM_ID,
      currentMatch.matchPda,
    );
    const vaultAuthority = findVaultAuthorityPda(
      GOLD_BINARY_MARKET_PROGRAM_ID,
      market,
    );
    const yesVault = findYesVaultPda(GOLD_BINARY_MARKET_PROGRAM_ID, market);
    const noVault = findNoVaultPda(GOLD_BINARY_MARKET_PROGRAM_ID, market);
    return {
      match: currentMatch.matchPda,
      market,
      vaultAuthority,
      yesVault,
      noVault,
    };
  }, [currentMatch]);

  const marketGoldMint = useMemo(() => {
    try {
      const value = currentMarketState?.goldMint;
      if (value && typeof value.toBase58 === "function") {
        return value as PublicKey;
      }
      if (typeof value === "string") {
        return new PublicKey(value);
      }
      return configuredGoldMint;
    } catch {
      return configuredGoldMint;
    }
  }, [currentMarketState, configuredGoldMint]);

  const marketTokenProgram = useMemo(() => {
    try {
      const value = currentMarketState?.tokenProgram;
      if (value && typeof value.toBase58 === "function") {
        return value as PublicKey;
      }
      if (typeof value === "string") {
        return new PublicKey(value);
      }
      return configuredGoldTokenProgram;
    } catch {
      return configuredGoldTokenProgram;
    }
  }, [currentMarketState, configuredGoldTokenProgram]);

  const canAttemptSeed = useMemo(() => {
    if (!addresses || !currentMarketState || !wallet.publicKey) return false;
    if (!enumIs(currentMarketState.status, "open")) return false;
    const marketMaker = currentMarketState.marketMaker as PublicKey | undefined;
    if (!marketMaker) return false;
    if (!wallet.publicKey.equals(marketMaker)) return false;

    const openTs = asNumber(currentMarketState.openTs, 0);
    const autoDelay = asNumber(
      currentMarketState.autoSeedDelaySeconds,
      DEFAULT_AUTO_SEED_DELAY_SECONDS,
    );

    const hasUserBets =
      asNumber(currentMarketState.userYesTotal, 0) > 0 ||
      asNumber(currentMarketState.userNoTotal, 0) > 0;
    const hasMakerBets =
      asNumber(currentMarketState.makerYesTotal, 0) > 0 ||
      asNumber(currentMarketState.makerNoTotal, 0) > 0;

    return nowTs >= openTs + autoDelay && !hasUserBets && !hasMakerBets;
  }, [addresses, currentMarketState, wallet.publicKey, nowTs]);

  const handleRefresh = () => {
    setRefreshNonce((value) => value + 1);
  };

  const ensureMarketConfig = async (marketProgram: any): Promise<any> => {
    if (!wallet.publicKey) {
      throw new Error("Wallet connection is required");
    }

    const existing =
      await marketProgram.account.marketConfig.fetchNullable(marketConfigPda);
    if (existing) return existing;

    const configuredMarketMaker = asPublicKey(CONFIG.binaryMarketMakerWallet);
    const configuredTradeTreasury = asPublicKey(
      CONFIG.binaryTradeTreasuryWallet,
    );
    const configuredTradeMarketMaker =
      asPublicKey(CONFIG.binaryTradeMarketMakerWallet) || configuredMarketMaker;

    if (
      !configuredMarketMaker ||
      !configuredTradeTreasury ||
      !configuredTradeMarketMaker
    ) {
      throw new Error(
        "Missing binary fee wallet config. Set VITE_BINARY_MARKET_MAKER_WALLET, VITE_BINARY_TRADE_TREASURY_WALLET, and VITE_BINARY_TRADE_MARKET_MAKER_WALLET.",
      );
    }
    if (!wallet.publicKey.equals(configuredMarketMaker)) {
      throw new Error(
        "Only the configured market maker wallet can initialize market config.",
      );
    }

    try {
      await marketProgram.methods
        .initializeMarketConfig(
          configuredMarketMaker,
          configuredTradeTreasury,
          configuredTradeMarketMaker,
          DEFAULT_TRADE_TREASURY_FEE_BPS,
          DEFAULT_TRADE_MARKET_MAKER_FEE_BPS,
          DEFAULT_WINNINGS_MARKET_MAKER_FEE_BPS,
        )
        .accounts({
          authority: wallet.publicKey,
          marketConfig: marketConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (error) {
      const recovered = await recoverTimedOutTransaction(connection, error);
      if (!recovered) throw error;
    }

    const config =
      await marketProgram.account.marketConfig.fetchNullable(marketConfigPda);
    if (!config) {
      throw new Error("Market config not initialized");
    }
    return config;
  };

  const createNewRound = async (): Promise<{
    match: DiscoveredMatch;
    market: any;
    roundAddresses: {
      match: PublicKey;
      market: PublicKey;
      vaultAuthority: PublicKey;
      yesVault: PublicKey;
      noVault: PublicKey;
    };
  } | null> => {
    if (!programsReady) {
      setStatus(missingProgramMessage);
      return null;
    }
    if (!programs || !wallet.publicKey) {
      setStatus("Wallet connection is required");
      return null;
    }

    const matchId = Date.now();
    const fightProgram: any = programs.fightOracle;
    const marketProgram: any = programs.goldBinaryMarket;
    const oracleConfig = findOracleConfigPda(FIGHT_ORACLE_PROGRAM_ID);
    const matchIdBn = new BN(matchId.toString());
    const matchPda = PublicKey.findProgramAddressSync(
      [Buffer.from("match"), matchIdBn.toArrayLike(Buffer, "le", 8)],
      FIGHT_ORACLE_PROGRAM_ID,
    )[0];
    const marketPda = findMarketPda(GOLD_BINARY_MARKET_PROGRAM_ID, matchPda);
    const vaultAuthority = findVaultAuthorityPda(
      GOLD_BINARY_MARKET_PROGRAM_ID,
      marketPda,
    );
    const yesVault = findYesVaultPda(GOLD_BINARY_MARKET_PROGRAM_ID, marketPda);
    const noVault = findNoVaultPda(GOLD_BINARY_MARKET_PROGRAM_ID, marketPda);

    try {
      setStatus("Initializing oracle + creating new market...");
      await fightProgram.methods
        .initializeOracle()
        .accounts({
          authority: wallet.publicKey,
          oracleConfig,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const marketConfig = await ensureMarketConfig(marketProgram);
      const configMarketMaker =
        asPublicKey(marketConfig?.marketMaker) ||
        asPublicKey(CONFIG.binaryMarketMakerWallet);
      if (!configMarketMaker) {
        throw new Error("Market config is missing market maker wallet");
      }

      await fightProgram.methods
        .createMatch(
          matchIdBn,
          new BN(DEFAULT_NEW_ROUND_BET_WINDOW_SECONDS.toString()),
          JSON.stringify({
            agent1: "Manual Agent A",
            agent2: "Manual Agent B",
          }),
        )
        .accounts({
          authority: wallet.publicKey,
          oracleConfig,
          matchResult: matchPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const startMarketTxSignature = (await marketProgram.methods
        .initializeMarket(new BN(DEFAULT_AUTO_SEED_DELAY_SECONDS.toString()))
        .accounts({
          payer: wallet.publicKey,
          marketMaker: configMarketMaker,
          oracleMatch: matchPda,
          marketConfig: marketConfigPda,
          market: marketPda,
          vaultAuthority,
          yesVault,
          noVault,
          goldMint: marketGoldMint,
          tokenProgram: marketTokenProgram,
          systemProgram: SystemProgram.programId,
        })
        .rpc()) as string;
      setSolanaTxs((prev) => ({
        ...prev,
        startMarket: startMarketTxSignature,
      }));

      let matchAccount: any = null;
      let marketAccount: any = null;
      try {
        matchAccount =
          await fightProgram.account.matchResult.fetchNullable(matchPda);
      } catch {
        matchAccount = null;
      }
      try {
        marketAccount =
          await marketProgram.account.market.fetchNullable(marketPda);
      } catch {
        marketAccount = null;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const fallbackCloseTs = nowSeconds + DEFAULT_NEW_ROUND_BET_WINDOW_SECONDS;

      const discoveredMatch: DiscoveredMatch = {
        matchId,
        matchPda,
        status: "open",
        openTs: normalizeTimestamp(asNumber(matchAccount?.openTs, nowSeconds)),
        closeTs: normalizeTimestamp(
          asNumber(matchAccount?.betCloseTs, fallbackCloseTs),
        ),
        resolvedTs: null,
        winner: null,
        agent1Name: "Agent A",
        agent2Name: "Agent B",
      };

      const roundAddresses = {
        match: matchPda,
        market: marketPda,
        vaultAuthority,
        yesVault,
        noVault,
      };

      autoSeededMarketsRef.current.delete(marketPda.toBase58());
      setCurrentMatch(discoveredMatch);
      if (marketAccount) setCurrentMarketState(marketAccount);
      setMarketConfigState(marketConfig);
      setStatus(`Created market for match ${matchId}`);
      setRefreshNonce((value) => value + 1);
      return { match: discoveredMatch, market: marketAccount, roundAddresses };
    } catch (error) {
      const recovered = await recoverTimedOutTransaction(connection, error);
      if (recovered) {
        const recoveredSignature = extractTxSignature(error);
        if (recoveredSignature) {
          setSolanaTxs((prev) => ({
            ...prev,
            startMarket: recoveredSignature,
          }));
        }
        setStatus(`Created market for match ${matchId}`);
        setRefreshNonce((value) => value + 1);
        return null;
      }
      setStatus(`Create round failed: ${(error as Error).message}`);
      return null;
    }
  };

  const handleStartNewRound = async () => {
    await createNewRound();
  };

  const handleSeedIfEmpty = async (
    source: "manual" | "auto" = "manual",
  ): Promise<void> => {
    if (!programsReady) {
      if (source === "manual") setStatus(missingProgramMessage);
      return;
    }
    if (!wallet.publicKey || !programs || !addresses || !currentMarketState) {
      if (source === "manual")
        setStatus("Wallet and active market are required");
      return;
    }

    try {
      const marketProgram: any = programs.goldBinaryMarket;
      const marketMaker = currentMarketState.marketMaker as PublicKey;
      if (!wallet.publicKey.equals(marketMaker)) {
        throw new Error("Only market maker wallet can seed liquidity");
      }

      const marketMakerGoldAta = await findAnyGoldAccount(
        connection,
        wallet.publicKey,
        marketGoldMint,
      );
      if (!marketMakerGoldAta) {
        throw new Error("Market maker GOLD token account not found");
      }

      const makerPosition = findPositionPda(
        GOLD_BINARY_MARKET_PROGRAM_ID,
        addresses.market,
        wallet.publicKey,
      );

      const amountEach = toBaseUnits(DEFAULT_SEED_GOLD_AMOUNT, GOLD_DECIMALS);
      setStatus(
        source === "auto"
          ? "Auto-seeding market-maker liquidity..."
          : "Seeding market-maker liquidity...",
      );
      const seedTxSignature = (await marketProgram.methods
        .seedLiquidityIfEmpty(toBnAmount(amountEach))
        .accounts({
          marketMaker: wallet.publicKey,
          market: addresses.market,
          marketMakerGoldAta,
          yesVault: addresses.yesVault,
          noVault: addresses.noVault,
          marketMakerPosition: makerPosition,
          goldMint: marketGoldMint,
          tokenProgram: marketTokenProgram,
        })
        .rpc()) as string;
      setSolanaTxs((prev) => ({ ...prev, seed: seedTxSignature }));

      setStatus("Market-maker liquidity seeded");
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      const recovered = await recoverTimedOutTransaction(connection, error);
      if (recovered) {
        const recoveredSignature = extractTxSignature(error);
        if (recoveredSignature) {
          setSolanaTxs((prev) => ({ ...prev, seed: recoveredSignature }));
        }
        setStatus("Market-maker liquidity seeded");
        setRefreshNonce((value) => value + 1);
        return;
      }
      if (source === "manual") {
        setStatus(`Seed failed: ${(error as Error).message}`);
      }
    }
  };

  useEffect(() => {
    if (!autoSeedEnabled) return;
    if (!canAttemptSeed || !addresses) return;
    const key = addresses.market.toBase58();
    if (autoSeededMarketsRef.current.has(key)) return;
    autoSeededMarketsRef.current.add(key);
    void handleSeedIfEmpty("auto");
  }, [autoSeedEnabled, canAttemptSeed, addresses]);

  const handlePlaceBet = async () => {
    if (!programsReady) {
      setStatus(missingProgramMessage);
      return;
    }
    if (!wallet.publicKey || !programs) {
      setStatus("Wallet connection is required");
      return;
    }

    try {
      const marketProgram: any = programs.goldBinaryMarket;
      let activeAddresses = addresses;
      let activeMarketState = currentMarketState;

      if (!activeAddresses || !activeMarketState) {
        setStatus("No active market found. Auto-creating a fresh round...");
        const created = await createNewRound();
        if (!created) {
          setStatus(
            "Auto-create failed. Start the bot or use oracle authority wallet.",
          );
          return;
        }
        activeAddresses = created.roundAddresses;
        activeMarketState = created.market;
      }

      const activeGoldMint = (() => {
        try {
          const value = activeMarketState.goldMint;
          if (value && typeof value.toBase58 === "function") {
            return value as PublicKey;
          }
          if (typeof value === "string") {
            return new PublicKey(value);
          }
          return configuredGoldMint;
        } catch {
          return configuredGoldMint;
        }
      })();

      const activeTokenProgram = (() => {
        try {
          const value = activeMarketState.tokenProgram;
          if (value && typeof value.toBase58 === "function") {
            return value as PublicKey;
          }
          if (typeof value === "string") {
            return new PublicKey(value);
          }
          return configuredGoldTokenProgram;
        } catch {
          return configuredGoldTokenProgram;
        }
      })();

      const baseAmount = toBaseUnits(Number(amountInput), GOLD_DECIMALS);
      if (baseAmount <= 0n) {
        throw new Error("Order amount must be > 0");
      }

      // Bet using the configured source asset directly
      // The on-chain market will be initialized with the correct mint

      const mintAccountInfo = await connection.getAccountInfo(
        activeGoldMint,
        "confirmed",
      );
      if (!mintAccountInfo) {
        throw new Error(
          `GOLD mint ${activeGoldMint.toBase58()} not found on ${getCluster()}`,
        );
      }

      const goldAccount = await findAnyGoldAccount(
        connection,
        wallet.publicKey,
        activeGoldMint,
      );

      if (!goldAccount) {
        throw new Error("No GOLD token account found in wallet");
      }

      const marketConfig =
        marketConfigState ||
        (await marketProgram.account.marketConfig.fetch(marketConfigPda));
      if (!marketConfigState) {
        setMarketConfigState(marketConfig);
      }
      const tradeTreasuryWallet =
        asPublicKey(marketConfig.tradeTreasuryWallet) ||
        asPublicKey(CONFIG.binaryTradeTreasuryWallet) ||
        asPublicKey(marketConfig.feeWallet) ||
        wallet.publicKey;
      const tradeMarketMakerWallet =
        asPublicKey(marketConfig.tradeMarketMakerWallet) ||
        asPublicKey(CONFIG.binaryTradeMarketMakerWallet) ||
        asPublicKey(CONFIG.binaryMarketMakerWallet) ||
        asPublicKey(marketConfig.marketMaker) ||
        wallet.publicKey;
      const tradeTreasuryWalletGoldAta = await findAnyGoldAccount(
        connection,
        tradeTreasuryWallet,
        activeGoldMint,
      );
      if (!tradeTreasuryWalletGoldAta) {
        throw new Error("Treasury fee wallet GOLD token account not found");
      }
      const tradeMarketMakerWalletGoldAta = await findAnyGoldAccount(
        connection,
        tradeMarketMakerWallet,
        activeGoldMint,
      );
      if (!tradeMarketMakerWalletGoldAta) {
        throw new Error("Market maker fee wallet GOLD token account not found");
      }
      const tradeTreasuryFeeBps = asNumber(marketConfig.tradeTreasuryFeeBps, 0);
      const tradeMarketMakerFeeBps = asNumber(
        marketConfig.tradeMarketMakerFeeBps,
        asNumber(marketConfig.feeBps, DEFAULT_BET_FEE_BPS),
      );
      const referralTrackingFeeBps = Math.max(
        0,
        tradeTreasuryFeeBps + tradeMarketMakerFeeBps,
      );

      const positionPda = findPositionPda(
        GOLD_BINARY_MARKET_PROGRAM_ID,
        activeAddresses.market,
        wallet.publicKey,
      );

      setStatus("Placing order on-chain...");
      const txSignature = (await marketProgram.methods
        .placeBet(side === "YES" ? yesEnum() : noEnum(), toBnAmount(baseAmount))
        .accounts({
          bettor: wallet.publicKey,
          market: activeAddresses.market,
          bettorGoldAta: goldAccount,
          marketConfig: marketConfigPda,
          tradeTreasuryWalletGoldAta,
          tradeMarketMakerWalletGoldAta,
          vaultAuthority: activeAddresses.vaultAuthority,
          yesVault: activeAddresses.yesVault,
          noVault: activeAddresses.noVault,
          position: positionPda,
          goldMint: activeGoldMint,
          tokenProgram: activeTokenProgram,
          systemProgram: SystemProgram.programId,
        })
        .rpc()) as string;
      setSolanaTxs((prev) => ({ ...prev, placeBet: txSignature }));

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
              feeBps: referralTrackingFeeBps,
              txSignature,
              marketPda: activeAddresses.market.toBase58(),
              inviteCode: getStoredInviteCode(),
              externalBetRef: currentMatch
                ? `solana:match:${currentMatch.matchId}`
                : `solana:market:${activeAddresses.market.toBase58()}`,
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
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      if (isMintLookupError(error)) {
        setStatus(
          `Place order failed: configured GOLD mint is unavailable on ${getCluster()}`,
        );
        return;
      }

      const recovered = await recoverTimedOutTransaction(connection, error);
      if (recovered) {
        const recoveredSignature = extractTxSignature(error);
        if (recoveredSignature) {
          setSolanaTxs((prev) => ({ ...prev, placeBet: recoveredSignature }));
        }
        setStatus("Order placed");
        setRefreshNonce((value) => value + 1);
        return;
      }

      setStatus(`Place order failed: ${(error as Error).message}`);
    }
  };

  const handlePostResultAndResolve = async () => {
    if (!programsReady) {
      setStatus(missingProgramMessage);
      return;
    }
    if (!wallet.publicKey || !programs || !addresses || !currentMatch) {
      setStatus("Wallet and active market are required");
      return;
    }

    const fightProgram: any = programs.fightOracle;
    const marketProgram: any = programs.goldBinaryMarket;
    const oracleConfig = findOracleConfigPda(FIGHT_ORACLE_PROGRAM_ID);
    const seed = BigInt(Date.now());
    const simulatedResult = simulateFight(seed);
    const result: FightResult = forcedE2eWinner
      ? {
          ...simulatedResult,
          winner: forcedE2eWinner === "YES" ? "A" : "B",
        }
      : simulatedResult;

    const syncResolvedStateFromChain = async (): Promise<boolean> => {
      try {
        const marketState = await marketProgram.account.market.fetch(
          addresses.market,
        );
        const isResolved =
          enumIs(marketState.status, "resolved") ||
          enumIs(marketState.status, "void");
        if (!isResolved) return false;

        const winner = sideFromEnum(marketState.resolvedWinner);
        setFightResult(result);
        setRefreshNonce((value) => value + 1);
        setStatus(
          `Resolved. Winner: ${winner ?? (result.winner === "A" ? "YES" : "NO")}`,
        );
        return true;
      } catch {
        return false;
      }
    };

    try {
      setStatus("Posting oracle result...");
      const oracleTxSignature = (await fightProgram.methods
        .postResult(
          result.winner === "A" ? yesEnum() : noEnum(),
          new BN(result.seed.toString()),
          Array.from(result.replayHash),
        )
        .accounts({
          authority: wallet.publicKey,
          oracleConfig,
          matchResult: addresses.match,
        })
        .rpc()) as string;
      setSolanaTxs((prev) => ({ ...prev, resolveOracle: oracleTxSignature }));

      setStatus("Resolving market from oracle...");
      const resolveTxSignature = (await marketProgram.methods
        .resolveFromOracle()
        .accounts({
          resolver: wallet.publicKey,
          market: addresses.market,
          oracleMatch: addresses.match,
        })
        .rpc()) as string;
      setSolanaTxs((prev) => ({ ...prev, resolveMarket: resolveTxSignature }));

      setFightResult(result);
      setRefreshNonce((value) => value + 1);
      setStatus(`Resolved. Winner: ${result.winner === "A" ? "YES" : "NO"}`);
    } catch (error) {
      const recovered = await recoverTimedOutTransaction(
        connection,
        error,
        90_000,
      );
      if (recovered) {
        const recoveredOracleSignature = extractTxSignature(error);
        if (recoveredOracleSignature) {
          setSolanaTxs((prev) => ({
            ...prev,
            resolveOracle: recoveredOracleSignature,
          }));
        }
        try {
          const resolveTxSignature = (await marketProgram.methods
            .resolveFromOracle()
            .accounts({
              resolver: wallet.publicKey,
              market: addresses.market,
              oracleMatch: addresses.match,
            })
            .rpc()) as string;
          setSolanaTxs((prev) => ({
            ...prev,
            resolveMarket: resolveTxSignature,
          }));
        } catch (retryError) {
          const recoveredResolveSignature = extractTxSignature(retryError);
          if (recoveredResolveSignature) {
            setSolanaTxs((prev) => ({
              ...prev,
              resolveMarket: recoveredResolveSignature,
            }));
          }
          await recoverTimedOutTransaction(connection, retryError, 90_000);
        }
      }

      const synced = await syncResolvedStateFromChain();
      if (synced) return;
      setStatus(`Resolve failed: ${(error as Error).message}`);
    }
  };

  const handleClaim = async (source: "manual" | "auto" = "manual") => {
    if (!programsReady) {
      if (source === "manual") setStatus(missingProgramMessage);
      return;
    }
    if (!wallet.publicKey || !programs || !addresses) {
      if (source === "manual") setStatus("Wallet and market are required");
      return;
    }

    try {
      const marketProgram: any = programs.goldBinaryMarket;
      const goldAccount = await findAnyGoldAccount(
        connection,
        wallet.publicKey,
        marketGoldMint,
      );
      if (!goldAccount) {
        throw new Error("No GOLD token account found in wallet");
      }

      const positionPda = findPositionPda(
        GOLD_BINARY_MARKET_PROGRAM_ID,
        addresses.market,
        wallet.publicKey,
      );
      const activeClaimMarketState =
        currentMarketState ||
        (await marketProgram.account.market.fetch(addresses.market));
      const marketMaker = (() => {
        const value = activeClaimMarketState?.marketMaker;
        if (value && typeof value.toBase58 === "function") {
          return value as PublicKey;
        }
        if (typeof value === "string") {
          return new PublicKey(value);
        }
        throw new Error("Market maker account unavailable");
      })();
      const marketMakerTokenAccount = await findAnyGoldAccount(
        connection,
        marketMaker,
        marketGoldMint,
      );
      if (!marketMakerTokenAccount) {
        throw new Error("Market maker GOLD token account not found");
      }

      setStatus(
        source === "auto" ? "Auto-claiming payout..." : "Claiming payout...",
      );
      const claimTxSignature = (await marketProgram.methods
        .claim()
        .accounts({
          bettor: wallet.publicKey,
          market: addresses.market,
          position: positionPda,
          bettorGoldAta: goldAccount,
          vaultAuthority: addresses.vaultAuthority,
          yesVault: addresses.yesVault,
          noVault: addresses.noVault,
          marketMakerTokenAccount,
          goldMint: marketGoldMint,
          tokenProgram: marketTokenProgram,
        })
        .rpc()) as string;
      setSolanaTxs((prev) => ({ ...prev, claim: claimTxSignature }));

      setRefreshNonce((value) => value + 1);
      setStatus("Claim complete");
    } catch (error) {
      const recovered = await recoverTimedOutTransaction(connection, error);
      if (recovered) {
        const recoveredSignature = extractTxSignature(error);
        if (recoveredSignature) {
          setSolanaTxs((prev) => ({ ...prev, claim: recoveredSignature }));
        }
        setRefreshNonce((value) => value + 1);
        setStatus("Claim complete");
        return;
      }
      if (source === "manual") {
        setStatus(`Claim failed: ${(error as Error).message}`);
      }
    }
  };

  useEffect(() => {
    if (!isE2eMode) return;
    if (activeChain !== "solana") return;
    if (!programsReady || !wallet.publicKey || !programs || !addresses) return;
    if (!enumIs(currentMarketState?.status, "resolved")) return;

    const winner = sideFromEnum(currentMarketState?.resolvedWinner);
    if (!winner) return;

    const marketKey = addresses.market.toBase58();
    if (autoClaimedMarketsRef.current.has(marketKey)) return;
    autoClaimedMarketsRef.current.add(marketKey);
    const bettor = wallet.publicKey;
    if (!bettor) return;

    let cancelled = false;
    void (async () => {
      try {
        const marketProgram: any = programs.goldBinaryMarket;
        const positionPda = findPositionPda(
          GOLD_BINARY_MARKET_PROGRAM_ID,
          addresses.market,
          bettor,
        );
        const position =
          await marketProgram.account.position.fetchNullable(positionPda);
        if (cancelled || !position || Boolean(position.claimed)) return;

        const yesStake = asNumber(position.yesStake, 0);
        const noStake = asNumber(position.noStake, 0);
        const canClaim =
          (winner === "YES" && yesStake > 0) ||
          (winner === "NO" && noStake > 0);
        if (!canClaim) return;

        await handleClaim("auto");
      } catch {
        autoClaimedMarketsRef.current.delete(marketKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeChain,
    addresses,
    currentMarketState,
    handleClaim,
    isE2eMode,
    programs,
    programsReady,
    wallet.publicKey,
  ]);

  const handleShareInvite = useCallback(async () => {
    const code = inviteCode ?? getStoredInviteCode();
    if (!code) {
      setInviteShareStatus("Invite code unavailable");
      return;
    }
    const link = buildInviteShareLink(code);
    if (!link) {
      setInviteShareStatus("Invite link unavailable");
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Join HyperScape Betting",
          text: "Use my invite link to join HyperScape betting.",
          url: link,
        });
        setInviteShareStatus("Invite shared");
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setInviteShareStatus("Invite link copied");
      } else {
        setInviteShareStatus("Share not supported");
      }
    } catch {
      setInviteShareStatus("Share cancelled");
    }
  }, [inviteCode]);

  useEffect(() => {
    if (!inviteShareStatus) return;
    const id = window.setTimeout(() => setInviteShareStatus(""), 3000);
    return () => window.clearTimeout(id);
  }, [inviteShareStatus]);

  const userYes = asNumber(currentMarketState?.userYesTotal, 0);
  const userNo = asNumber(currentMarketState?.userNoTotal, 0);
  const makerYes = asNumber(currentMarketState?.makerYesTotal, 0);
  const makerNo = asNumber(currentMarketState?.makerNoTotal, 0);
  const yesPot = userYes + makerYes;
  const noPot = userNo + makerNo;
  const totalPot = yesPot + noPot;
  const yesSharePercent =
    totalPot > 0 ? Math.round((yesPot / totalPot) * 100) : 50;
  const noSharePercent = 100 - yesSharePercent;

  // Track deltas for trades and chart manually on Solana
  useEffect(() => {
    if (isEvmChain) return;
    const now = Date.now();
    const prev = lastStateRef.current;

    // Initialize
    if (prev.lastUpdate === 0) {
      if (solanaChartData.length === 0) {
        setSolanaChartData([{ time: now, pct: yesSharePercent }]);
      }
      prev.yesPot = yesPot;
      prev.noPot = noPot;
      prev.lastUpdate = now;
      return;
    }

    const yesDelta = yesPot - prev.yesPot;
    const noDelta = noPot - prev.noPot;

    if (yesDelta > 0 || noDelta > 0) {
      const newTrades: Trade[] = [];
      if (yesDelta > 0) {
        newTrades.push({
          id: `yes-${now}-${Math.random()}`,
          side: "YES",
          amount: yesDelta,
          price: yesSharePercent / 100,
          time: now,
        });
      }
      if (noDelta > 0) {
        newTrades.push({
          id: `no-${now}-${Math.random()}`,
          side: "NO",
          amount: noDelta,
          price: yesSharePercent / 100,
          time: now + 1, // slight offset
        });
      }

      setSolanaRecentTrades((prevTrades) => {
        const copy = [...newTrades, ...prevTrades];
        return copy.slice(0, 50); // Keep last 50
      });

      setSolanaChartData((prevChart) => {
        const copy = [...prevChart, { time: now, pct: yesSharePercent }];
        return copy.length > 100 ? copy.slice(copy.length - 100) : copy;
      });

      prev.yesPot = yesPot;
      prev.noPot = noPot;
      prev.lastUpdate = now;
    }
  }, [yesPot, noPot, yesSharePercent, isEvmChain, solanaChartData.length]);

  const solanaBids: OrderLevel[] = useMemo(() => {
    return [{ price: yesSharePercent / 100, amount: yesPot, total: yesPot }];
  }, [yesSharePercent, yesPot]);

  const solanaAsks: OrderLevel[] = useMemo(() => {
    const askPrice = Math.max(0.01, 1 - yesSharePercent / 100);
    return [{ price: askPrice, amount: noPot, total: noPot }];
  }, [yesSharePercent, noPot]);

  // Stream-UI mode: override chain data with mock engine values
  const effYesPot = isStreamUIMode ? mock.yesPot : yesPot;
  const effNoPot = isStreamUIMode ? mock.noPot : noPot;
  const effYesPercent = isStreamUIMode ? mock.yesPercent : yesSharePercent;
  const effNoPercent = isStreamUIMode ? mock.noPercent : noSharePercent;
  const effChartData = isStreamUIMode ? mock.chartData : solanaChartData;
  const effBids = isStreamUIMode ? mock.bids : solanaBids;
  const effAsks = isStreamUIMode ? mock.asks : solanaAsks;
  const effRecentTrades = isStreamUIMode
    ? mock.recentTrades
    : solanaRecentTrades;
  const liveAgent1Name =
    liveCycle?.agent1?.name?.trim() && liveCycle.agent1.name.trim().length > 0
      ? liveCycle.agent1.name.trim()
      : null;
  const liveAgent2Name =
    liveCycle?.agent2?.name?.trim() && liveCycle.agent2.name.trim().length > 0
      ? liveCycle.agent2.name.trim()
      : null;
  const effAgent1Name = isStreamUIMode
    ? mock.matchAgent1Name
    : (currentMatch?.agent1Name ?? liveAgent1Name ?? "Agent A");
  const effAgent2Name = isStreamUIMode
    ? mock.matchAgent2Name
    : (currentMatch?.agent2Name ?? liveAgent2Name ?? "Agent B");
  const effProgramsReady = isStreamUIMode ? true : programsReady;
  const effWalletReady = isStreamUIMode ? true : isWalletReady(wallet);
  const effStatusColor = isStreamUIMode
    ? mock.statusColor
    : (() => {
        if (/failed|error|unavailable|required|not found/i.test(status))
          return "#fda4af";
        if (/placed|complete|seeded|created|linked/i.test(status))
          return "#86efac";
        return "rgba(255,255,255,0.78)";
      })();
  const effStatus = isStreamUIMode ? mock.status : status;
  const effPhase = isStreamUIMode ? mock.streamState.cycle.phase : null;

  const resolvedWinner = sideFromEnum(currentMarketState?.resolvedWinner);
  const marketTradeTreasuryFeeBps = asNumber(
    marketConfigState?.tradeTreasuryFeeBps,
    0,
  );
  const marketTradeMarketMakerFeeBps = asNumber(
    marketConfigState?.tradeMarketMakerFeeBps,
    asNumber(marketConfigState?.feeBps, DEFAULT_BET_FEE_BPS),
  );
  const marketFeeBps = marketTradeTreasuryFeeBps + marketTradeMarketMakerFeeBps;
  const feeWalletAddress = (() => {
    try {
      const value =
        marketConfigState?.tradeTreasuryWallet ??
        CONFIG.binaryTradeTreasuryWallet ??
        marketConfigState?.feeWallet;
      if (value && typeof value.toBase58 === "function") {
        return (value as PublicKey).toBase58();
      }
      if (typeof value === "string") return value;
      return wallet.publicKey?.toBase58() ?? "-";
    } catch {
      return "-";
    }
  })();
  const statusColor = effStatusColor;
  const streamPhaseText = liveCycle?.phase ?? null;
  const marketStatusText = isStreamUIMode
    ? effStatus
    : isEvmChain
      ? (streamPhaseText ??
        (currentMatch ? currentMatch.status.toUpperCase() : "LIVE"))
      : marketStatusLabel(currentMarketState?.status);
  const countdownText = isStreamUIMode
    ? formatCountdown(
        normalizeRemainingSeconds(mock.streamState.cycle.timeRemaining),
      )
    : isEvmChain
      ? liveCycle
        ? formatCountdown(normalizeRemainingSeconds(liveCycle.timeRemaining))
        : ""
      : formatCountdown(
          currentMatch ? Math.max(0, currentMatch.closeTs - nowTs) : 0,
        );
  const clientSyncDelaySeconds = (Math.max(0, UI_SYNC_DELAY_MS) / 1000).toFixed(
    UI_SYNC_DELAY_MS % 1000 === 0 ? 0 : 1,
  );
  const goldMintText = (() => {
    try {
      return marketGoldMint.toBase58();
    } catch {
      return "-";
    }
  })();
  const displayedInviteCode = (inviteCode ?? getStoredInviteCode() ?? "")
    .trim()
    .toUpperCase();

  const handleAgentClick = (side: BetSide) => {
    if (isStreamUIMode) {
      const agent = side === "YES" ? mock.agent1Context : mock.agent2Context;
      setSelectedAgentForStats(agent);
      setIsShowingStats(true);
      return;
    }
    const fallbackAgent1Name = currentMatch?.agent1Name ?? liveAgent1Name;
    const fallbackAgent2Name = currentMatch?.agent2Name ?? liveAgent2Name;
    const name =
      side === "YES"
        ? (fallbackAgent1Name ?? "Agent A")
        : (fallbackAgent2Name ?? "Agent B");
    const mockAgent = {
      id: side,
      name,
      provider: "Hyperscape",
      model: "v1.0",
      hp: 100,
      maxHp: 100,
      combatLevel: 42,
      wins: side === "YES" ? 12 : 8,
      losses: side === "YES" ? 4 : 5,
      damageDealtThisFight: 0,
      inventory: [],
      monologues: [],
    };
    setSelectedAgentForStats(mockAgent);
    setIsShowingStats(true);
  };

  return (
    <div className="app-root" ref={appRootRef}>
      {/* Stream-UI mode: animated gradient + FightOverlay */}
      {isStreamUIMode && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 0,
              background:
                "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 25%, #0a1a2e 50%, #0a0a1a 75%, #1a1a0a 100%)",
              backgroundSize: "400% 400%",
              animation: "gradientShift 15s ease infinite",
            }}
          />
          <style>{`@keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>
          <div
            style={{
              position: "fixed",
              top: 12,
              left: 12,
              zIndex: 100,
              background: "rgba(234,179,8,0.15)",
              border: "1px solid rgba(234,179,8,0.4)",
              borderRadius: 6,
              padding: "4px 10px",
              color: "#eab308",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 2,
              fontFamily: "'Orbitron', 'Inter', system-ui, sans-serif",
              textTransform: "uppercase",
            }}
          >
            STREAM UI DEV
          </div>
          <FightOverlay
            phase={mock.streamState.cycle.phase}
            agent1={mock.agent1Context}
            agent2={mock.agent2Context}
            countdown={mock.streamState.cycle.countdown}
            timeRemaining={mock.streamState.cycle.timeRemaining}
            winnerId={mock.streamState.cycle.winnerId}
            winnerName={mock.streamState.cycle.winnerName}
            winReason={mock.streamState.cycle.winReason}
          />
        </>
      )}

      {/* Points / Leaderboard / Referral Drawer */}
      {showPointsDrawer && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
          onClick={() => setShowPointsDrawer(false)}
        >
          <div
            style={{
              background:
                "linear-gradient(180deg, rgba(20,22,30,0.85) 0%, rgba(14,16,24,0.9) 100%)",
              backdropFilter: "blur(32px) saturate(1.4)",
              WebkitBackdropFilter: "blur(32px) saturate(1.4)",
              padding: 24,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.12)",
              width: "min(440px, calc(100vw - 32px))",
              maxHeight: "calc(100vh - 64px)",
              overflowY: "auto",
              boxShadow:
                "0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 30px rgba(255,255,255,0.02)",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glass highlight */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "30%",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
                pointerEvents: "none",
                borderRadius: "20px 20px 0 0",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 24,
                right: 24,
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, rgba(242,208,138,0.3), transparent)",
                pointerEvents: "none",
              }}
            />

            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  fontFamily: "'Teko', sans-serif",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#f2d08a",
                  textShadow: "0 0 8px rgba(242,208,138,0.3)",
                }}
              >
                Points & Leaderboard
              </div>
              <button
                type="button"
                onClick={() => setShowPointsDrawer(false)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  fontSize: 14,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab Buttons */}
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 16,
                position: "relative",
                zIndex: 1,
              }}
            >
              {(
                [
                  { key: "leaderboard", label: "Leaderboard" },
                  { key: "history", label: "History" },
                  { key: "referral", label: "Referral" },
                ] as const
              ).map((tab) => {
                const isActive = pointsDrawerTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPointsDrawerTab(tab.key)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 8,
                      border: isActive
                        ? "1px solid rgba(242,208,138,0.35)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: isActive
                        ? "rgba(242,208,138,0.12)"
                        : "rgba(255,255,255,0.03)",
                      color: isActive ? "#f2d08a" : "rgba(255,255,255,0.5)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Non-compact points summary */}
            <div style={{ marginBottom: 16, position: "relative", zIndex: 1 }}>
              <PointsDisplay walletAddress={pointsWalletAddress} />
            </div>

            {/* Tab Content */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                maxHeight: "calc(100vh - 320px)",
                overflowY: "auto",
              }}
            >
              {pointsDrawerTab === "leaderboard" && <PointsLeaderboard />}
              {pointsDrawerTab === "history" && (
                <PointsHistory walletAddress={pointsWalletAddress} />
              )}
              {pointsDrawerTab === "referral" && (
                <ReferralPanel
                  activeChain={activeChain}
                  solanaWallet={solanaWalletAddress}
                  evmWallet={evmWalletAddress ?? null}
                  evmWalletPlatform={
                    activeChain === "bsc"
                      ? "BSC"
                      : activeChain === "base"
                        ? "BASE"
                        : null
                  }
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agent Stats Modal */}
      {isShowingStats && selectedAgentForStats && (
        <div
          className="agent-stats-modal-overlay"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={() => setIsShowingStats(false)}
        >
          <div
            style={{
              background:
                "linear-gradient(180deg, rgba(20,22,30,0.85) 0%, rgba(14,16,24,0.9) 100%)",
              backdropFilter: "blur(32px) saturate(1.4)",
              WebkitBackdropFilter: "blur(32px) saturate(1.4)",
              padding: 24,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.12)",
              width: 340,
              boxShadow:
                "0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 30px rgba(255,255,255,0.02)",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glass highlight */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "40%",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
                pointerEvents: "none",
                borderRadius: "20px 20px 0 0",
              }}
            />
            {/* Top highlight line */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 24,
                right: 24,
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 8,
                position: "relative",
                zIndex: 1,
              }}
            >
              <button
                onClick={() => setIsShowingStats(false)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  fontSize: 14,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <AgentStats
                agent={selectedAgentForStats}
                side={selectedAgentForStats.id === "YES" ? "left" : "right"}
              />
            </div>
          </div>
        </div>
      )}

      {/* We hide the verbose E2E slop by default unless a specific debug param is present. */}
      {isE2eDebugMode ? (
        <div
          style={{
            margin: "12px",
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            position: "relative",
            zIndex: 10,
          }}
        >
          <h1 style={{ margin: 0, fontSize: "18px" }}>
            Ultra Simple Fight Bet
          </h1>
          <div
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
            data-testid="e2e-chain-picker"
          >
            <span>Chain:</span>
            <select
              data-testid="e2e-chain-select"
              value={activeChain}
              onChange={(event) =>
                setActiveChain(event.target.value as "solana" | "bsc" | "base")
              }
            >
              {availableChains.map((chain) => (
                <option key={chain} value={chain}>
                  {chain.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div data-testid="e2e-active-chain">{activeChain}</div>
          <div data-testid="gold-mint">GOLD mint: {goldMintText}</div>
          <div data-testid="current-match-id">
            Current match: {currentMatch?.matchId ?? "-"}
          </div>
          <div data-testid="last-result">
            Last result: {lastResolvedMatch?.matchId ?? "-"}
          </div>
          <div data-testid="market-status">Market: {marketStatusText}</div>
          <div data-testid="pool-totals">
            YES pool: {goldDisplay(yesPot)} GOLD | NO pool: {goldDisplay(noPot)}{" "}
            GOLD
          </div>
          <div data-testid="countdown">{countdownText}</div>
          <div data-testid="status">{status}</div>
          <div data-testid="solana-last-seed-tx">{solanaTxs.seed}</div>
          <div data-testid="solana-last-place-bet-tx">{solanaTxs.placeBet}</div>
          <div data-testid="solana-last-resolve-oracle-tx">
            {solanaTxs.resolveOracle}
          </div>
          <div data-testid="solana-last-resolve-market-tx">
            {solanaTxs.resolveMarket}
          </div>
          <div data-testid="solana-last-claim-tx">{solanaTxs.claim}</div>
          <div data-testid="solana-last-start-market-tx">
            {solanaTxs.startMarket}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setSide("YES")}>
              Pick YES
            </button>
            <button type="button" onClick={() => setSide("NO")}>
              Pick NO
            </button>
            <select
              data-testid="side-select"
              value={side}
              onChange={(event) => setSide(event.target.value as BetSide)}
            >
              <option value="YES">YES</option>
              <option value="NO">NO</option>
            </select>
            <select
              data-testid="pay-asset-select"
              value={e2ePayAsset}
              onChange={(event) =>
                setE2ePayAsset(event.target.value as "GOLD" | "SOL" | "USDC")
              }
            >
              <option value="GOLD">GOLD</option>
              <option value="SOL">SOL</option>
              <option value="USDC">USDC</option>
            </select>
            <input
              data-testid="amount-input"
              type="text"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
            />
            <button
              data-testid="place-bet"
              type="button"
              disabled={
                activeChain !== "solana" ||
                !isWalletReady(wallet) ||
                !programsReady ||
                e2ePayAsset !== "GOLD"
              }
              onClick={() => {
                if (e2ePayAsset !== "GOLD") {
                  setStatus(
                    "Only GOLD is supported in Solana e2e placeBet flow",
                  );
                  return;
                }
                void handlePlaceBet();
              }}
            >
              Place Bet
            </button>
            <button
              data-testid="refresh-market"
              type="button"
              onClick={handleRefresh}
            >
              Refresh
            </button>
            <button
              data-testid="seed-liquidity"
              type="button"
              disabled={activeChain !== "solana" || !canAttemptSeed}
              onClick={() => void handleSeedIfEmpty("manual")}
            >
              Seed
            </button>
            <button
              data-testid="resolve-market"
              type="button"
              disabled={activeChain !== "solana"}
              onClick={() => void handlePostResultAndResolve()}
            >
              Resolve
            </button>
            <button
              data-testid="claim-payout"
              type="button"
              disabled={activeChain !== "solana"}
              onClick={() => void handleClaim()}
            >
              Claim
            </button>
            <button
              data-testid="start-market"
              type="button"
              disabled={activeChain !== "solana"}
              onClick={() => void handleStartNewRound()}
            >
              Start
            </button>
          </div>
          {isEvmChain ? (
            <div style={{ marginTop: "16px" }}>
              <EvmBettingPanel
                agent1Name={currentMatch?.agent1Name ?? "Agent A"}
                agent2Name={currentMatch?.agent2Name ?? "Agent B"}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Main Content */}
      <div className="main-layout">
        <div
          className="stream-stage-placeholder"
          aria-hidden={appMode !== "DUEL"}
        >
          {/* Stream Background (live mode) */}
          {appMode === "DUEL" && !isStreamUIMode && activeStreamUrl && (
            <>
              <div className="stream-bg" style={{ pointerEvents: "auto" }}>
                <StreamPlayer
                  streamUrl={activeStreamUrl}
                  muted={isMuted}
                  autoPlay={true}
                  onStreamUnavailable={switchToBackupStream}
                />
              </div>

              <button
                onClick={() => setIsMuted((m) => !m)}
                style={{
                  position: "absolute",
                  bottom: "20px",
                  left: "20px",
                  zIndex: 50,
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0,0,0,0.8)";
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0,0,0,0.6)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title={isMuted ? "Unmute Stream" : "Mute Stream"}
              >
                {isMuted ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                  </svg>
                ) : (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                  </svg>
                )}
              </button>

              {streamSources.length > 1 && (
                <button
                  onClick={cycleStreamSource}
                  style={{
                    position: "absolute",
                    bottom: "20px",
                    left: "78px",
                    zIndex: 50,
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    borderRadius: "999px",
                    height: "48px",
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0,0,0,0.8)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0,0,0,0.6)";
                  }}
                  title="Switch stream source"
                >
                  Source {streamSourceIndex + 1}/{streamSources.length}
                </button>
              )}
            </>
          )}
        </div>

        {!isE2eDebugMode ? (
          <div className={`betting-dock${isEvmChain ? " is-evm" : ""}`}>
            <div
              className={`betting-dock-inner${isEvmChain ? " is-evm" : ""}${isPanelCollapsed ? " is-collapsed" : ""}`}
              ref={bettingDockInnerRef}
            >
              {/* Wallets + Live Banner + Actions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {/* Inline Live Banner */}
                {(() => {
                  const accentColor =
                    statusColor === "#86efac"
                      ? "#00ffcc"
                      : statusColor === "#fda4af"
                        ? "#ff0d3c"
                        : "#f2d08a";
                  const accentGlow =
                    statusColor === "#86efac"
                      ? "rgba(0,255,204,"
                      : statusColor === "#fda4af"
                        ? "rgba(255,13,60,"
                        : "rgba(242,208,138,";
                  return (
                    <div
                      className="live-banner"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        height: 38,
                        padding: "0 12px",
                        borderRadius: 12,
                        background: `linear-gradient(95deg, ${accentGlow}0.12) 0%, rgba(10,10,18,0.6) 50%, rgba(10,10,18,0.5) 100%)`,
                        border: `1px solid ${accentGlow}0.2)`,
                        position: "relative",
                        overflow: "hidden",
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        boxShadow: `0 0 12px ${accentGlow}0.1), inset 0 1px 0 rgba(255,255,255,0.06)`,
                      }}
                    >
                      {/* Sweep scanline */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: `linear-gradient(90deg, transparent 0%, ${accentGlow}0.05) 50%, transparent 100%)`,
                          animation: "bannerSweep 3s ease-in-out infinite",
                          pointerEvents: "none",
                        }}
                      />

                      {/* Top edge glow */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 1,
                          background: `linear-gradient(90deg, transparent 5%, ${accentGlow}0.5) 30%, ${accentGlow}0.7) 50%, ${accentGlow}0.5) 70%, transparent 95%)`,
                        }}
                      />

                      {/* Left accent bar */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: 2,
                          height: "100%",
                          background: `linear-gradient(180deg, ${accentColor} 0%, ${accentGlow}0.3) 100%)`,
                          boxShadow: `0 0 8px ${accentGlow}0.4)`,
                        }}
                      />

                      {/* LIVE pill */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "4px 8px",
                          borderRadius: 8,
                          background: `linear-gradient(135deg, ${accentGlow}0.18) 0%, ${accentGlow}0.06) 100%)`,
                          border: `1px solid ${accentGlow}0.3)`,
                          flexShrink: 0,
                          zIndex: 1,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: accentColor,
                            boxShadow: `0 0 6px ${accentColor}, 0 0 12px ${accentGlow}0.4)`,
                            animation: "statusPulse 1.5s ease-in-out infinite",
                          }}
                        />
                      </div>

                      {/* Divider */}
                      <div
                        style={{
                          width: 1,
                          height: 20,
                          background: `linear-gradient(180deg, transparent, ${accentGlow}0.25), transparent)`,
                          flexShrink: 0,
                          zIndex: 1,
                        }}
                      />

                      {/* Status text */}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          color: "rgba(255,255,255,0.9)",
                          fontSize: 13,
                          fontWeight: 800,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          fontFamily: "'Teko', sans-serif",
                          textShadow: `0 0 8px ${accentGlow}0.3)`,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          zIndex: 1,
                        }}
                      >
                        {marketStatusText}
                        {countdownText ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              marginLeft: 8,
                              fontWeight: 900,
                              fontSize: 11,
                              fontFamily: "'IBM Plex Mono', monospace",
                              background: "rgba(0,0,0,0.4)",
                              padding: "2px 6px",
                              borderRadius: 3,
                              border: `1px solid ${accentGlow}0.3)`,
                              letterSpacing: 1,
                              lineHeight: 1,
                              verticalAlign: "middle",
                            }}
                          >
                            {countdownText}
                          </span>
                        ) : null}
                      </span>

                      {/* Ticker dots */}
                      <div
                        style={{
                          marginLeft: "auto",
                          display: "flex",
                          gap: 3,
                          alignItems: "center",
                          zIndex: 1,
                        }}
                      >
                        {[0.7, 1, 0.5].map((opacity, i) => (
                          <div
                            key={i}
                            style={{
                              width: 3,
                              height: 3,
                              borderRadius: "50%",
                              background: accentColor,
                              opacity,
                              animation: `statusPulse 1.5s ease-in-out ${i * 0.3}s infinite`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  {/* Mode Toggle */}
                  <div
                    style={{
                      display: "flex",
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: "12px",
                      padding: "4px",
                      marginRight: "8px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setAppMode("DUEL")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background:
                          appMode === "DUEL"
                            ? "rgba(255,255,255,0.1)"
                            : "transparent",
                        color:
                          appMode === "DUEL" ? "#fff" : "rgba(255,255,255,0.5)",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      DUEL
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppMode("PERPS")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background:
                          appMode === "PERPS"
                            ? "rgba(255,255,255,0.1)"
                            : "transparent",
                        color:
                          appMode === "PERPS"
                            ? "#fff"
                            : "rgba(255,255,255,0.5)",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      PERPS
                    </button>
                  </div>
                  <ChainSelector />
                  {!wallet.connected ? (
                    <button
                      type="button"
                      className="sol-connect-btn"
                      onClick={() => setSolModalVisible(true)}
                    >
                      Add SOL Wallet
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="sol-connect-btn is-linked"
                      onClick={() => wallet.disconnect()}
                    >
                      SOL{" "}
                      {wallet.publicKey
                        ? `${wallet.publicKey.toBase58().slice(0, 4)}...${wallet.publicKey.toBase58().slice(-4)}`
                        : ""}
                    </button>
                  )}
                  <ConnectButton.Custom>
                    {({
                      openConnectModal,
                      openAccountModal,
                      openChainModal,
                      account,
                      chain,
                      mounted,
                    }) => {
                      if (!mounted || !account) {
                        return (
                          <button
                            type="button"
                            className="evm-connect-btn"
                            onClick={openConnectModal}
                          >
                            Add EVM Wallet
                          </button>
                        );
                      }
                      if (chain?.unsupported) {
                        return (
                          <button
                            type="button"
                            className="evm-connect-btn"
                            onClick={openChainModal}
                          >
                            Switch EVM Network
                          </button>
                        );
                      }
                      return (
                        <button
                          type="button"
                          className="evm-connect-btn is-linked"
                          onClick={openAccountModal}
                        >
                          EVM {account.displayName}
                        </button>
                      );
                    }}
                  </ConnectButton.Custom>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <PointsDisplay walletAddress={pointsWalletAddress} compact />
                  <button
                    type="button"
                    className="dock-collapse-btn"
                    title="Leaderboard & Stats"
                    onClick={() => setShowPointsDrawer(true)}
                    style={{ width: 38, height: 38, fontSize: 16 }}
                  >
                    🏆
                  </button>
                  <button
                    type="button"
                    className="invite-share-btn"
                    onClick={() => void handleShareInvite()}
                    disabled={!displayedInviteCode}
                  >
                    Share Invite
                  </button>
                  <button
                    onClick={() => setIsPanelCollapsed((p) => !p)}
                    title={isPanelCollapsed ? "Expand panel" : "Collapse panel"}
                    className="dock-collapse-btn"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{
                        transform: isPanelCollapsed
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {inviteShareStatus ? (
                <div className="betting-dock-meta-status">
                  {inviteShareStatus}
                </div>
              ) : null}

              {!isPanelCollapsed &&
                (isEvmChain && !isStreamUIMode ? (
                  <div style={{ marginTop: 16 }}>
                    <EvmBettingPanel
                      agent1Name={effAgent1Name}
                      agent2Name={effAgent2Name}
                    />
                  </div>
                ) : !isStreamUIMode ? (
                  <div style={{ marginTop: 16 }}>
                    {appMode === "DUEL" ? (
                      <SolanaClobPanel
                        agent1Name={effAgent1Name}
                        agent2Name={effAgent2Name}
                      />
                    ) : (
                      <PerpsMarketPanel
                        agent1Name={effAgent1Name}
                        agent2Name={effAgent2Name}
                        agent1Id={1}
                        agent2Id={2}
                      />
                    )}
                  </div>
                ) : (
                  <PredictionMarketPanel
                    yesPercent={effYesPercent}
                    noPercent={effNoPercent}
                    yesPool={effYesPot}
                    noPool={effNoPot}
                    side={side}
                    setSide={setSide}
                    amountInput={amountInput}
                    setAmountInput={setAmountInput}
                    onPlaceBet={handlePlaceBet}
                    isWalletReady={effWalletReady}
                    programsReady={effProgramsReady}
                    agent1Name={effAgent1Name}
                    agent2Name={effAgent2Name}
                    isEvm={false}
                    chartData={effChartData}
                    bids={effBids}
                    asks={effAsks}
                    recentTrades={effRecentTrades}
                    onViewAgent1={() => handleAgentClick("YES")}
                    onViewAgent2={() => handleAgentClick("NO")}
                  />
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
