"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";

type ArenaPhase =
  | "PREVIEW_CAMS"
  | "BET_OPEN"
  | "BET_LOCK"
  | "DUEL_ACTIVE"
  | "RESULT_SHOW"
  | "ORACLE_REPORT"
  | "MARKET_RESOLVE"
  | "RESTORE"
  | "COMPLETE";

type ArenaSide = "A" | "B";
type SourceAsset = "GOLD" | "SOL" | "USDC";

type ArenaRoundSnapshot = {
  id: string;
  roundSeedHex: string;
  phase: ArenaPhase;
  bettingOpensAt: number;
  bettingClosesAt: number;
  duelStartsAt: number | null;
  duelEndsAt: number | null;
  agentAId: string;
  agentBId: string;
  previewAgentAId: string | null;
  previewAgentBId: string | null;
  winnerId: string | null;
  damageA: number;
  damageB: number;
  market: {
    roundId: string;
    roundSeedHex: string;
    programId: string;
    mint: string;
    tokenProgram: string;
    marketPda: string;
    oraclePda: string;
    vaultAta: string;
    feeVaultAta: string;
    status: string;
    closeSlot: number | null;
    resolvedSlot: number | null;
    winnerSide: ArenaSide | null;
    poolA: string;
    poolB: string;
    feeBps: number;
  } | null;
};

type BetQuoteResponse = {
  roundId: string;
  side: ArenaSide;
  sourceAsset: SourceAsset;
  sourceAmount: string;
  expectedGoldAmount: string;
  minGoldAmount: string;
  swapQuote: Record<string, unknown> | null;
  market: NonNullable<ArenaRoundSnapshot["market"]>;
};

type StreamState = {
  state: string;
  cameraMode: "PREVIEW" | "DUEL";
  splitScreen: boolean;
  duelCameraLayout?: string;
  previewAgents: string[];
  activeDuelists?: string[];
};

type DepositAddressResponse = {
  roundId: string;
  side: ArenaSide;
  custodyWallet: string;
  custodyAta: string;
  mint: string;
  tokenProgram: string;
  memoTemplate: string;
};

type PointsSnapshot = {
  wallet: string;
  pointsScope?: "WALLET" | "LINKED";
  identityWalletCount?: number;
  totalPoints: number;
  selfPoints: number;
  referralPoints: number;
  stakingPoints: number;
  multiplier: number;
  goldBalance: string | null;
  liquidGoldBalance: string | null;
  stakedGoldBalance: string | null;
  goldHoldDays: number;
  liquidGoldHoldDays: number;
  stakedGoldHoldDays: number;
  invitedWalletCount: number;
};

type InviteSummary = {
  wallet: string;
  inviteCode: string;
  invitedWalletCount: number;
  invitedWallets: string[];
  pointsFromReferrals: number;
  feeShareFromReferralsGold: string;
  treasuryFeesFromReferredBetsGold: string;
  referredByWallet: string | null;
  referredByCode: string | null;
};

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T,
  ) => Promise<T>;
};

type SolanaCluster = "mainnet-beta" | "devnet" | "testnet" | "localnet";

function normalizeSolanaCluster(rawValue: string | undefined): SolanaCluster {
  const normalized = (rawValue || "").trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "mainnet-beta") {
    return "mainnet-beta";
  }
  if (
    normalized === "devnet" ||
    normalized === "testnet" ||
    normalized === "localnet"
  ) {
    return normalized;
  }
  return "mainnet-beta";
}

const API_BASE = (
  process.env.NEXT_PUBLIC_ARENA_API_BASE_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:5555"
    : "https://hyperia-production.up.railway.app")
).replace(/\/$/, "");
const STREAM_EMBED_URL = (
  process.env.NEXT_PUBLIC_ARENA_STREAM_EMBED_URL || ""
).trim();
const STREAM_HLS_URL = (
  process.env.NEXT_PUBLIC_ARENA_STREAM_HLS_URL || `${API_BASE}/live/stream.m3u8`
).trim();
const SOLANA_CLUSTER = normalizeSolanaCluster(
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
);
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  (SOLANA_CLUSTER === "mainnet-beta"
    ? `${API_BASE}/api/proxy/solana/rpc?cluster=mainnet-beta`
    : SOLANA_CLUSTER === "localnet"
      ? "http://127.0.0.1:8899"
      : `https://api.${SOLANA_CLUSTER}.solana.com`);
const WS_URL =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL ??
  (SOLANA_CLUSTER === "mainnet-beta"
    ? `${API_BASE.replace(/^http/, "ws")}/api/proxy/solana/ws?cluster=mainnet-beta`
    : SOLANA_CLUSTER === "localnet"
      ? "ws://127.0.0.1:8900"
      : `wss://api.${SOLANA_CLUSTER}.solana.com`);
const LOCAL_INVITE_ORIGIN = "http://localhost:4179";
const WEBSITE_INVITE_ORIGIN = "https://hyperia.bet";
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SOLANA_ASSOCIATED_TOKEN_PROGRAM_ID ??
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

function apiPath(path: string): string {
  return `${API_BASE}${path}`;
}

function extractInviteCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("://")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get("invite")?.trim() ?? "";
  } catch {
    return "";
  }
}

function buildInviteShareLink(inviteCode: string): string {
  if (typeof window === "undefined") {
    return `${WEBSITE_INVITE_ORIGIN}/?invite=${encodeURIComponent(inviteCode)}`;
  }
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const shareOrigin = isLocalHost ? LOCAL_INVITE_ORIGIN : WEBSITE_INVITE_ORIGIN;
  const url = new URL(window.location.pathname, `${shareOrigin}/`);
  url.searchParams.set("invite", inviteCode);
  return url.toString();
}

function parseDecimalToBaseUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid decimal amount");
  }
  const [whole, fractionRaw = ""] = normalized.split(".");
  const fraction = fractionRaw.slice(0, decimals).padEnd(decimals, "0");
  const joined = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  return BigInt(joined || "0");
}

function shortId(value: string | null | undefined): string {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function deriveAta(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey,
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

async function anchorDiscriminator(ixName: string): Promise<Uint8Array> {
  const payload = new TextEncoder().encode(`global:${ixName}`);
  const hash = await crypto.subtle.digest("SHA-256", payload);
  return new Uint8Array(hash).slice(0, 8);
}

async function buildPlaceBetData(
  side: ArenaSide,
  amountGold: bigint,
): Promise<Buffer> {
  const discriminator = await anchorDiscriminator("place_bet");
  const data = Buffer.alloc(8 + 1 + 8);
  data.set(discriminator, 0);
  data.writeUInt8(side === "A" ? 1 : 2, 8);
  data.writeBigUInt64LE(amountGold, 9);
  return data;
}

async function buildClaimData(): Promise<Buffer> {
  const discriminator = await anchorDiscriminator("claim");
  const data = Buffer.alloc(8);
  data.set(discriminator, 0);
  return data;
}

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const provider = (window as Window & { solana?: PhantomProvider }).solana;
  if (!provider?.isPhantom) return null;
  return provider;
}

export default function ArenaBettingPage() {
  const [round, setRound] = useState<ArenaRoundSnapshot | null>(null);
  const [streamState, setStreamState] = useState<StreamState | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [side, setSide] = useState<ArenaSide>("A");
  const [sourceAsset, setSourceAsset] = useState<SourceAsset>("GOLD");
  const [sourceAmount, setSourceAmount] = useState<string>("1");
  const [quote, setQuote] = useState<BetQuoteResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("Ready");
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [depositAddress, setDepositAddress] =
    useState<DepositAddressResponse | null>(null);
  const [depositSignature, setDepositSignature] = useState("");
  const [points, setPoints] = useState<PointsSnapshot | null>(null);
  const [inviteSummary, setInviteSummary] = useState<InviteSummary | null>(
    null,
  );
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [streamPlaybackError, setStreamPlaybackError] = useState<string | null>(
    null,
  );
  const streamVideoRef = useRef<HTMLVideoElement | null>(null);
  const roundRefreshInFlightRef = useRef(false);
  const walletRefreshInFlightRef = useRef(false);

  const connection = useMemo(
    () =>
      new Connection(RPC_URL, { commitment: "confirmed", wsEndpoint: WS_URL }),
    [],
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextTick = () => {
      if (timeoutId) clearTimeout(timeoutId);
      const delay = document.visibilityState === "visible" ? 1000 : 5000;
      timeoutId = setTimeout(() => {
        setNow(Date.now());
        scheduleNextTick();
      }, delay);
    };

    scheduleNextTick();
    const onVisibilityChange = () => scheduleNextTick();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (STREAM_EMBED_URL) return;
    const video = streamVideoRef.current;
    if (!video || !STREAM_HLS_URL) return;

    let disposed = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let hls: {
      loadSource: (src: string) => void;
      attachMedia: (media: unknown) => void;
      on: (
        event: string,
        handler: (event?: string, data?: unknown) => void,
      ) => void;
      destroy: () => void;
      startLoad?: (startPosition?: number) => void;
      recoverMediaError?: () => void;
    } | null = null;
    const sourceUrl = `${STREAM_HLS_URL}${STREAM_HLS_URL.includes("?") ? "&" : "?"}ts=${Date.now()}`;

    const playVideo = () => {
      void video.play().catch(() => {});
    };

    const scheduleRetry = (delayMs: number) => {
      if (disposed) return;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      retryTimeout = setTimeout(() => {
        if (disposed) return;
        if (hls?.startLoad) {
          hls.startLoad(-1);
        }
        playVideo();
      }, delayMs);
    };

    const startNativePlayback = () => {
      setStreamPlaybackError(null);
      video.src = sourceUrl;
      playVideo();
    };

    const initHlsPlayback = async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        startNativePlayback();
        return;
      }

      try {
        const module = await import("hls.js");
        if (disposed) return;
        const Hls = module.default;

        if (!Hls.isSupported()) {
          setStreamPlaybackError(
            "HLS playback is not supported in this browser.",
          );
          return;
        }

        const instance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 12,
          liveBackBufferLength: 30,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 800,
          levelLoadingMaxRetry: 6,
          levelLoadingRetryDelay: 800,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 800,
        });
        hls = instance as typeof hls;

        instance.on(Hls.Events.MEDIA_ATTACHED, () => {
          if (disposed) return;
          setStreamPlaybackError(null);
          instance.loadSource(sourceUrl);
        });

        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (disposed) return;
          setStreamPlaybackError(null);
          playVideo();
        });

        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (disposed) return;
          const fatal =
            typeof data === "object" &&
            data !== null &&
            "fatal" in data &&
            Boolean((data as { fatal?: boolean }).fatal);
          if (!fatal) return;

          const dataType =
            typeof data === "object" &&
            data !== null &&
            "type" in data &&
            typeof (data as { type?: string }).type === "string"
              ? (data as { type: string }).type
              : "";

          if (dataType === Hls.ErrorTypes.NETWORK_ERROR) {
            setStreamPlaybackError("Stream reconnecting...");
            instance.startLoad(-1);
            scheduleRetry(1500);
            return;
          }

          if (dataType === Hls.ErrorTypes.MEDIA_ERROR) {
            setStreamPlaybackError("Recovering stream...");
            instance.recoverMediaError();
            scheduleRetry(1000);
            return;
          }

          setStreamPlaybackError("Stream temporarily unavailable.");
        });

        instance.attachMedia(video);
      } catch {
        setStreamPlaybackError("Failed to initialize HLS player.");
      }
    };

    void initHlsPlayback();

    return () => {
      disposed = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (hls) {
        hls.destroy();
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (roundRefreshInFlightRef.current) return;
    roundRefreshInFlightRef.current = true;
    try {
      const [roundRes, streamRes] = await Promise.all([
        fetch(apiPath("/api/arena/current"), { cache: "no-store" }),
        fetch(apiPath("/api/arena/stream-state"), { cache: "no-store" }),
      ]);

      const roundJson = (await roundRes.json()) as {
        round: ArenaRoundSnapshot | null;
      };
      const streamJson = (await streamRes.json()) as StreamState;
      setRound(roundJson.round);
      setStreamState(streamJson);
    } finally {
      roundRefreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextRefresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      const delay = document.visibilityState === "visible" ? 3000 : 12000;
      timeoutId = setTimeout(() => {
        void refresh().finally(scheduleNextRefresh);
      }, delay);
    };

    void refresh().finally(scheduleNextRefresh);
    const onVisibilityChange = () => scheduleNextRefresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [refresh]);

  const refreshWalletStats = useCallback(async () => {
    if (walletRefreshInFlightRef.current) return;
    walletRefreshInFlightRef.current = true;
    if (!wallet) {
      setPoints(null);
      setInviteSummary(null);
      walletRefreshInFlightRef.current = false;
      return;
    }

    try {
      const [pointsRes, inviteRes] = await Promise.all([
        fetch(apiPath(`/api/arena/points/${wallet}?scope=linked`), {
          cache: "no-store",
        }),
        fetch(apiPath(`/api/arena/invite/${wallet}`), { cache: "no-store" }),
      ]);

      if (pointsRes.ok) {
        const payload = (await pointsRes.json()) as PointsSnapshot;
        setPoints(payload);
      } else {
        setPoints(null);
      }

      if (inviteRes.ok) {
        const payload = (await inviteRes.json()) as InviteSummary;
        setInviteSummary(payload);
      } else {
        setInviteSummary(null);
      }
    } catch {
      setPoints(null);
      setInviteSummary(null);
    } finally {
      walletRefreshInFlightRef.current = false;
    }
  }, [wallet]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextRefresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      const delay = document.visibilityState === "visible" ? 15000 : 45000;
      timeoutId = setTimeout(() => {
        void refreshWalletStats().finally(scheduleNextRefresh);
      }, delay);
    };

    void refreshWalletStats().finally(scheduleNextRefresh);
    const onVisibilityChange = () => scheduleNextRefresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [refreshWalletStats]);

  useEffect(() => {
    const inviteFromQuery = new URLSearchParams(window.location.search)
      .get("invite")
      ?.trim();
    if (!inviteFromQuery) return;
    setInviteCodeInput((current) =>
      current.trim() ? current : inviteFromQuery.toUpperCase(),
    );
  }, []);

  const connectWallet = useCallback(async () => {
    const provider = getPhantomProvider();
    if (!provider) {
      setStatus("Phantom wallet not found");
      return;
    }
    const connected = await provider.connect();
    setWallet(connected.publicKey.toString());
    setStatus("Wallet connected");
  }, []);

  const disconnectWallet = useCallback(async () => {
    const provider = getPhantomProvider();
    if (!provider) return;
    await provider.disconnect();
    setWallet(null);
    setStatus("Wallet disconnected");
  }, []);

  const fetchQuote = useCallback(async () => {
    if (!round) return;
    setBusy(true);
    setStatus("Fetching quote...");
    try {
      const response = await fetch(apiPath("/api/arena/bet/quote"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          side,
          sourceAsset,
          sourceAmount,
          bettorWallet: wallet ?? "",
        }),
      });
      const payload = (await response.json()) as
        | { quote: BetQuoteResponse }
        | { error: string };
      if (!response.ok || !("quote" in payload)) {
        throw new Error("error" in payload ? payload.error : "Quote failed");
      }
      setQuote(payload.quote);
      setStatus("Quote ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Quote failed");
    } finally {
      setBusy(false);
    }
  }, [round, side, sourceAsset, sourceAmount, wallet]);

  const redeemInviteCode = useCallback(async () => {
    if (!wallet) {
      setStatus("Connect wallet first");
      return;
    }
    const inviteCode = extractInviteCode(inviteCodeInput).toUpperCase();
    if (!inviteCode) {
      setStatus("Enter an invite code");
      return;
    }

    setBusy(true);
    setStatus("Applying invite code...");
    try {
      const response = await fetch(apiPath("/api/arena/invite/redeem"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          inviteCode,
        }),
      });
      const payload = (await response.json()) as
        | { success: true }
        | { error: string };
      if (!response.ok || !("success" in payload)) {
        throw new Error("error" in payload ? payload.error : "Invite failed");
      }
      setStatus("Invite code applied");
      setInviteCodeInput("");
      await refreshWalletStats();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }, [inviteCodeInput, refreshWalletStats, wallet]);

  const copyInviteCode = useCallback(async () => {
    if (!inviteSummary?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(
        buildInviteShareLink(inviteSummary.inviteCode),
      );
      setStatus("Invite link copied");
    } catch {
      setStatus("Failed to copy invite link");
    }
  }, [inviteSummary?.inviteCode]);

  const sendSignedTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction,
    ): Promise<string> => {
      const provider = getPhantomProvider();
      if (!provider || !wallet) {
        throw new Error("Wallet not connected");
      }

      const signed = await provider.signTransaction(transaction);
      const wire = signed.serialize();
      const signature = await connection.sendRawTransaction(wire, {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    [connection, wallet],
  );

  const buildPlaceBetTx = useCallback(
    async (goldAmount: string): Promise<Transaction> => {
      if (!round?.market || !wallet) {
        throw new Error("Round/market/wallet unavailable");
      }

      const bettor = new PublicKey(wallet);
      const programId = new PublicKey(round.market.programId);
      const mint = new PublicKey(round.market.mint);
      const tokenProgram = new PublicKey(round.market.tokenProgram);
      const marketPda = new PublicKey(round.market.marketPda);
      const vaultAta = new PublicKey(round.market.vaultAta);
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position", "utf8"),
          marketPda.toBuffer(),
          bettor.toBuffer(),
        ],
        programId,
      );
      const bettorTokenAta = deriveAta(mint, bettor, tokenProgram);

      const ix = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: bettor, isSigner: true, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: marketPda, isSigner: false, isWritable: true },
          { pubkey: vaultAta, isSigner: false, isWritable: true },
          { pubkey: bettorTokenAta, isSigner: false, isWritable: true },
          { pubkey: positionPda, isSigner: false, isWritable: true },
          { pubkey: tokenProgram, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: await buildPlaceBetData(
          side,
          parseDecimalToBaseUnits(goldAmount, 6),
        ),
      });

      const latest = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({
        feePayer: bettor,
        recentBlockhash: latest.blockhash,
      }).add(ix);
      return tx;
    },
    [connection, round, side, wallet],
  );

  const runSwapIfNeeded = useCallback(
    async (currentQuote: BetQuoteResponse): Promise<string | null> => {
      if (!wallet) throw new Error("Wallet not connected");
      if (currentQuote.sourceAsset === "GOLD") return null;
      if (!currentQuote.swapQuote) {
        throw new Error("Missing swap quote for non-GOLD source asset");
      }

      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: currentQuote.swapQuote,
          userPublicKey: wallet,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });
      const swapJson = (await swapRes.json()) as {
        swapTransaction?: string;
        error?: string;
      };
      if (!swapRes.ok || !swapJson.swapTransaction) {
        throw new Error(swapJson.error ?? "Jupiter swap build failed");
      }

      const swapTx = VersionedTransaction.deserialize(
        Buffer.from(swapJson.swapTransaction, "base64"),
      );
      return sendSignedTransaction(swapTx);
    },
    [sendSignedTransaction, wallet],
  );

  const placeBet = useCallback(async () => {
    if (!round || !wallet) {
      setStatus("Connect wallet and wait for active round");
      return;
    }
    if (!quote) {
      setStatus("Fetch quote first");
      return;
    }

    setBusy(true);
    setStatus("Submitting bet...");
    try {
      const swapSignature = await runSwapIfNeeded(quote);
      if (swapSignature) {
        setStatus(`Swap confirmed: ${shortId(swapSignature)}`);
      }

      const betTx = await buildPlaceBetTx(quote.expectedGoldAmount);
      const betSignature = await sendSignedTransaction(betTx);

      const recordRes = await fetch(apiPath("/api/arena/bet/record"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          bettorWallet: wallet,
          side,
          sourceAsset,
          sourceAmount,
          goldAmount: quote.expectedGoldAmount,
          txSignature: betSignature,
          quoteJson: quote.swapQuote,
          inviteCode:
            inviteSummary?.referredByCode ??
            (inviteCodeInput.trim() ? inviteCodeInput.trim() : null),
        }),
      });

      if (!recordRes.ok) {
        const payload = (await recordRes.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to record bet");
      }

      setStatus(`Bet confirmed: ${betSignature}`);
      await refresh();
      await refreshWalletStats();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bet failed");
    } finally {
      setBusy(false);
    }
  }, [
    buildPlaceBetTx,
    quote,
    refresh,
    round,
    runSwapIfNeeded,
    sendSignedTransaction,
    side,
    sourceAmount,
    sourceAsset,
    wallet,
    inviteSummary?.referredByCode,
    inviteCodeInput,
    refreshWalletStats,
  ]);

  const claimWinnings = useCallback(async () => {
    if (!round || !wallet) {
      setStatus("Round and wallet required");
      return;
    }

    setBusy(true);
    setStatus("Building claim...");
    try {
      const claimRes = await fetch(apiPath("/api/arena/claim/build"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          bettorWallet: wallet,
        }),
      });
      const claimJson = (await claimRes.json()) as {
        claim?: {
          roundId: string;
          programId: string;
          mint: string;
          tokenProgram: string;
          marketPda: string;
          vaultAta: string;
          positionPda: string;
        };
        error?: string;
      };
      if (!claimRes.ok || !claimJson.claim) {
        throw new Error(claimJson.error ?? "Claim build failed");
      }

      const bettor = new PublicKey(wallet);
      const programId = new PublicKey(claimJson.claim.programId);
      const mint = new PublicKey(claimJson.claim.mint);
      const tokenProgram = new PublicKey(claimJson.claim.tokenProgram);
      const destinationAta = deriveAta(mint, bettor, tokenProgram);

      const ix = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: bettor, isSigner: true, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          {
            pubkey: new PublicKey(claimJson.claim.marketPda),
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: new PublicKey(claimJson.claim.vaultAta),
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: new PublicKey(claimJson.claim.positionPda),
            isSigner: false,
            isWritable: true,
          },
          { pubkey: destinationAta, isSigner: false, isWritable: true },
          { pubkey: tokenProgram, isSigner: false, isWritable: false },
        ],
        data: await buildClaimData(),
      });

      const latest = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({
        feePayer: bettor,
        recentBlockhash: latest.blockhash,
      }).add(ix);

      const signature = await sendSignedTransaction(tx);
      setClaimTx(signature);
      setStatus(`Claim confirmed: ${signature}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }, [connection, round, sendSignedTransaction, wallet]);

  const loadDepositAddress = useCallback(async () => {
    if (!round) return;
    setBusy(true);
    setStatus("Loading deposit address...");
    try {
      const url = new URL(
        apiPath("/api/arena/deposit/address"),
        window.location.origin,
      );
      url.searchParams.set("roundId", round.id);
      url.searchParams.set("side", side);
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load deposit address");
      }
      const payload = (await response.json()) as DepositAddressResponse;
      setDepositAddress(payload);
      setStatus("Deposit address loaded");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to load deposit address",
      );
    } finally {
      setBusy(false);
    }
  }, [round, side]);

  const ingestDeposit = useCallback(async () => {
    if (!round) return;
    if (!depositSignature.trim()) {
      setStatus("Enter a deposit tx signature");
      return;
    }

    setBusy(true);
    setStatus("Ingesting deposit...");
    try {
      const response = await fetch(apiPath("/api/arena/deposit/ingest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          side,
          txSignature: depositSignature.trim(),
        }),
      });
      const payload = (await response.json()) as
        | {
            settled: {
              settleSignature: string;
              bettorWallet: string;
              goldAmount: string;
            };
          }
        | { error: string };

      if (!response.ok || !("settled" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Deposit ingest failed",
        );
      }

      setStatus(
        `Deposit settled: ${payload.settled.goldAmount} GOLD for ${shortId(payload.settled.bettorWallet)} (${shortId(payload.settled.settleSignature)})`,
      );
      setDepositSignature("");
      await refresh();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Deposit ingest failed",
      );
    } finally {
      setBusy(false);
    }
  }, [depositSignature, refresh, round, side]);

  const countdownLabel = useMemo(() => {
    if (!round) return "No active arena round";
    const target =
      round.phase === "PREVIEW_CAMS"
        ? round.bettingOpensAt
        : round.phase === "BET_OPEN"
          ? round.bettingClosesAt
          : round.phase === "DUEL_ACTIVE" && round.duelStartsAt
            ? round.duelStartsAt + 300_000
            : null;
    if (!target) return "";
    const diffMs = Math.max(0, target - now);
    const seconds = Math.floor(diffMs / 1000);
    const mm = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const ss = (seconds % 60).toString().padStart(2, "0");
    if (round.phase === "PREVIEW_CAMS") return `Bet opens in ${mm}:${ss}`;
    if (round.phase === "BET_OPEN") return `Bet closes in ${mm}:${ss}`;
    if (round.phase === "DUEL_ACTIVE") return `Duel max timer ${mm}:${ss}`;
    return "";
  }, [now, round]);

  const bettingOpen =
    round?.phase === "BET_OPEN" || round?.phase === "BET_LOCK";

  return (
    <main className="min-h-screen bg-[var(--bg-depth)] text-[var(--text-primary)]">
      <section className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <header className="mb-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-surface)] p-4 backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-display text-3xl text-gradient-gold">
                Arena Betting
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Watch the live duel feed above and place bets in the centered
                panel below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">
                Phase: {round?.phase ?? "IDLE"}
              </span>
              {countdownLabel ? (
                <span className="rounded-full border border-[var(--border-bronze)] px-3 py-1 text-[var(--gold-essence)]">
                  {countdownLabel}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          {STREAM_EMBED_URL ? (
            <iframe
              src={STREAM_EMBED_URL}
              title="Hyperia Arena Stream"
              className="h-[360px] w-full rounded-xl border border-[var(--border-subtle)] md:h-[520px]"
              allow="autoplay; encrypted-media; picture-in-picture"
            />
          ) : (
            <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] md:h-[520px]">
              <video
                ref={streamVideoRef}
                className="h-full w-full bg-black object-cover"
                autoPlay
                muted
                playsInline
              />
              <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-[var(--border-subtle)] bg-black/55 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Live HLS (Server)
              </div>
              {streamPlaybackError ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 text-xs text-[var(--text-muted)]">
                  {streamPlaybackError}
                </div>
              ) : null}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-6 top-6 flex items-start justify-between gap-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-black/55 px-4 py-3 text-xs backdrop-blur">
              <p className="uppercase tracking-wide text-[var(--text-muted)]">
                Duel Side A
              </p>
              <p className="mt-1 font-mono text-sm">
                {shortId(round?.agentAId)}
              </p>
              <p className="mt-1 text-[var(--text-muted)]">
                Preview:{" "}
                {shortId(
                  round?.previewAgentAId ?? streamState?.previewAgents?.[0],
                )}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-black/55 px-4 py-3 text-right text-xs backdrop-blur">
              <p className="uppercase tracking-wide text-[var(--text-muted)]">
                Duel Side B
              </p>
              <p className="mt-1 font-mono text-sm">
                {shortId(round?.agentBId)}
              </p>
              <p className="mt-1 text-[var(--text-muted)]">
                Preview:{" "}
                {shortId(
                  round?.previewAgentBId ?? streamState?.previewAgents?.[1],
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Camera
            </p>
            <p className="mt-2 text-sm">
              {streamState?.cameraMode ?? "PREVIEW"} /{" "}
              {streamState?.duelCameraLayout ?? "SIDE_BY_SIDE"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Winner
            </p>
            <p className="mt-2 text-sm">{shortId(round?.winnerId)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Pools (GOLD)
            </p>
            <p className="mt-2 text-sm">A: {round?.market?.poolA ?? "0"}</p>
            <p className="text-sm">B: {round?.market?.poolB ?? "0"}</p>
          </div>
        </section>

        <section className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Betting Controls
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Compact controls below the stream to avoid overlap.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {wallet ? (
                <>
                  <span className="rounded-full border border-[var(--border-bronze)] px-3 py-1 text-xs">
                    {shortId(wallet)}
                  </span>
                  <button
                    className="btn-secondary px-3 py-2 text-sm"
                    onClick={() => void disconnectWallet()}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  className="btn-primary px-4 py-2 text-sm"
                  onClick={() => void connectWallet()}
                >
                  Connect Phantom
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`rounded-md border px-3 py-2 text-sm ${
                  side === "A"
                    ? "border-[var(--gold-essence)] bg-[var(--glass-highlight)]"
                    : "border-[var(--border-subtle)]"
                }`}
                onClick={() => setSide("A")}
                type="button"
              >
                Side A
              </button>
              <button
                className={`rounded-md border px-3 py-2 text-sm ${
                  side === "B"
                    ? "border-[var(--gold-essence)] bg-[var(--glass-highlight)]"
                    : "border-[var(--border-subtle)]"
                }`}
                onClick={() => setSide("B")}
                type="button"
              >
                Side B
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-depth)] px-3 py-2 text-sm"
                value={sourceAsset}
                onChange={(event) =>
                  setSourceAsset(event.target.value as SourceAsset)
                }
              >
                <option value="GOLD">GOLD</option>
                <option value="SOL">SOL</option>
                <option value="USDC">USDC</option>
              </select>
              <input
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-depth)] px-3 py-2 text-sm"
                value={sourceAmount}
                onChange={(event) => setSourceAmount(event.target.value)}
                placeholder="Amount"
                inputMode="decimal"
              />
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <button
                className="btn-secondary px-3 py-2 text-sm"
                onClick={() => void fetchQuote()}
                disabled={!round || !bettingOpen || busy}
              >
                Get Quote
              </button>
              <button
                className="btn-primary px-4 py-2 text-sm"
                onClick={() => void placeBet()}
                disabled={!quote || !wallet || !bettingOpen || busy}
              >
                {busy ? "Processing..." : "Place Bet"}
              </button>
              <button
                className="btn-secondary px-3 py-2 text-sm"
                onClick={() => void claimWinnings()}
                disabled={!wallet || !round?.winnerId || busy}
              >
                Claim Winnings
              </button>
            </div>

            {quote ? (
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-depth)] p-3 text-xs">
                <p>
                  Expected GOLD: <strong>{quote.expectedGoldAmount}</strong>
                </p>
                <p>Minimum GOLD: {quote.minGoldAmount}</p>
                <p>Asset: {quote.sourceAsset}</p>
                {quote.sourceAsset !== "GOLD" ? (
                  <p className="text-[var(--text-muted)]">
                    Auto-convert via Jupiter executes before bet placement.
                  </p>
                ) : null}
              </div>
            ) : null}

            <details className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-depth)] p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-[var(--text-secondary)]">
                Invite + Points
              </summary>
              <div className="mt-3 space-y-1">
                <p>
                  My Invite Code:{" "}
                  <code>{inviteSummary?.inviteCode ?? "-"}</code>
                  {inviteSummary?.inviteCode ? (
                    <button
                      className="btn-secondary ml-2 px-2 py-1 text-[10px]"
                      onClick={() => void copyInviteCode()}
                      type="button"
                    >
                      Copy Link
                    </button>
                  ) : null}
                </p>
                <p>
                  Total Points:{" "}
                  <strong>{(points?.totalPoints ?? 0).toLocaleString()}</strong>
                </p>
                <p>
                  Scope: <strong>{points?.pointsScope ?? "LINKED"}</strong>
                  {" ("}
                  <strong>{points?.identityWalletCount ?? 1}</strong>
                  {" wallet"}
                  {(points?.identityWalletCount ?? 1) === 1 ? "" : "s"}
                  {")"}
                </p>
                <p>
                  Self / Referral / Staking:{" "}
                  <strong>{(points?.selfPoints ?? 0).toLocaleString()}</strong>
                  {" / "}
                  <strong>
                    {(points?.referralPoints ?? 0).toLocaleString()}
                  </strong>
                  {" / "}
                  <strong>
                    {(points?.stakingPoints ?? 0).toLocaleString()}
                  </strong>
                </p>
                <p>
                  Active Multiplier: <strong>{points?.multiplier ?? 0}×</strong>
                </p>
                <p>
                  GOLD (wallet + staked):{" "}
                  <strong>{points?.liquidGoldBalance ?? "0"}</strong>
                  {" + "}
                  <strong>{points?.stakedGoldBalance ?? "0"}</strong>
                  {" = "}
                  <strong>{points?.goldBalance ?? "0"}</strong>
                </p>
                <p>
                  Hold Days (wallet/staked/effective):{" "}
                  <strong>{points?.liquidGoldHoldDays ?? 0}</strong>
                  {" / "}
                  <strong>{points?.stakedGoldHoldDays ?? 0}</strong>
                  {" / "}
                  <strong>{points?.goldHoldDays ?? 0}</strong>
                </p>
                <p>
                  Referral Fee Share (GOLD):{" "}
                  <strong>
                    {inviteSummary?.feeShareFromReferralsGold ?? "0"}
                  </strong>
                </p>
                <p>
                  Invited Wallets:{" "}
                  <strong>{inviteSummary?.invitedWalletCount ?? 0}</strong>
                </p>
                {inviteSummary?.referredByCode ? (
                  <p>
                    Active Invite: <code>{inviteSummary.referredByCode}</code> (
                    {shortId(inviteSummary.referredByWallet)})
                  </p>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <input
                      className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-2 text-xs"
                      placeholder="Enter invite code or link"
                      value={inviteCodeInput}
                      onChange={(event) =>
                        setInviteCodeInput(event.target.value)
                      }
                    />
                    <button
                      className="btn-secondary px-3 py-2 text-xs"
                      onClick={() => void redeemInviteCode()}
                      disabled={!wallet || busy}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </details>

            <details className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-depth)] p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-[var(--text-secondary)]">
                Direct Wallet Transfer Mode
              </summary>
              <div className="mt-3 space-y-2">
                <p>1. Send GOLD to custody ATA for this side.</p>
                <p>
                  2. Include memo:{" "}
                  <code>{depositAddress?.memoTemplate ?? "-"}</code>
                </p>
                <p>3. Paste tx signature and ingest.</p>
                <button
                  className="btn-secondary mt-1 px-3 py-2 text-xs"
                  onClick={() => void loadDepositAddress()}
                  disabled={!round || !bettingOpen || busy}
                >
                  Load Deposit Address
                </button>
                {depositAddress ? (
                  <div className="space-y-1 break-all">
                    <p>Custody ATA: {depositAddress.custodyAta}</p>
                    <p>Custody Wallet: {depositAddress.custodyWallet}</p>
                  </div>
                ) : null}
                <input
                  className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-2 text-xs"
                  placeholder="Deposit tx signature"
                  value={depositSignature}
                  onChange={(event) => setDepositSignature(event.target.value)}
                />
                <button
                  className="btn-primary px-3 py-2 text-xs"
                  onClick={() => void ingestDeposit()}
                  disabled={!round || !bettingOpen || busy}
                >
                  Ingest Deposit Tx
                </button>
              </div>
            </details>

            <details className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-depth)] p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-[var(--text-secondary)]">
                Advanced Round Data
              </summary>
              <div className="mt-3 space-y-1">
                <p>Round: {round ? round.id : "No active round"}</p>
                <p>Winner: {shortId(round?.winnerId)}</p>
                <p>
                  Damage A/B: {round?.damageA ?? 0} / {round?.damageB ?? 0}
                </p>
                <p>Fee: {(round?.market?.feeBps ?? 0) / 100}%</p>
              </div>
            </details>
          </div>
        </section>

        <section className="mx-auto mt-4 w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            Status
          </p>
          <p className="mt-2 break-all text-sm">{status}</p>
          {claimTx ? (
            <p className="mt-2 break-all text-xs">Claim TX: {claimTx}</p>
          ) : null}
        </section>
      </section>
    </main>
  );
}
