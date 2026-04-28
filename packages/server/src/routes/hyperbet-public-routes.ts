/**
 * HyperBet Public Routes — Unauthenticated/wallet-auth endpoints for external viewers
 *
 * These routes serve the HyperBet standalone page where Twitch/YouTube viewers
 * connect their Solana wallet and bet on duel outcomes.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { World } from "@hyperscape/shared";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { checkWalletSignature } from "./hyperbet-wallet-auth.js";
import { BettingPoolManager } from "../systems/DuelScheduler/BettingPoolManager.js";
import { getHlsStreamUrl } from "../streaming/hls-cdn-sync.js";

type DuelBettingBridgeLike = {
  getActiveMarkets(): Array<{
    duelId: string;
    agent1Id: string;
    agent2Id: string;
    agent1Name: string;
    agent2Name: string;
    status: string;
    bettingClosesAt: number;
    createdAt: number;
  }>;
  getMarket(duelId: string): {
    duelId: string;
    agent1Id: string;
    agent2Id: string;
    agent1Name: string;
    agent2Name: string;
    status: string;
    bettingClosesAt: number;
    createdAt: number;
    winnerId?: string;
    winnerSide?: "A" | "B";
  } | null;
};

type WorldWithBridge = World & {
  duelBettingBridge?: DuelBettingBridgeLike;
  hlsCdnStreamUrl?: string;
};

/** SSE clients for betting events */
const sseClients = new Map<number, FastifyReply>();
let nextSseId = 1;
const HYPERBET_PUBLIC_WRITE_RATE_LIMIT = {
  max: 20,
  timeWindow: "1 minute",
};
const HYPERBET_PUBLIC_WRITE_CODEQL_LIMITER = new RateLimiterMemory({
  points: 20,
  duration: 60,
});

export function registerHyperBetPublicRoutes(
  fastify: FastifyInstance,
  world: World,
): void {
  const poolManager = new BettingPoolManager(world);

  // Store pool manager on world for event handlers
  (
    world as World & { bettingPoolManager?: BettingPoolManager }
  ).bettingPoolManager = poolManager;

  // ========================================================================
  // GET /api/hyperbet/config — Stream URL + platform config
  // ========================================================================
  fastify.get("/api/hyperbet/config", async (_req, reply) => {
    const streamUrl =
      (world as WorldWithBridge).hlsCdnStreamUrl || getHlsStreamUrl();
    return reply.send({
      streamUrl,
      bettingEnabled: process.env.DUEL_BETTING_ENABLED === "true",
      twitchChannel: process.env.TWITCH_CHANNEL || null,
      youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || null,
    });
  });

  // ========================================================================
  // GET /api/hyperbet/markets — All active markets
  // ========================================================================
  fastify.get("/api/hyperbet/markets", async (_req, reply) => {
    const bridge = (world as WorldWithBridge).duelBettingBridge;
    if (!bridge) {
      return reply.send({ markets: [] });
    }

    const markets = bridge.getActiveMarkets();
    const enriched = await Promise.all(
      markets.map(async (m) => {
        const pool = await poolManager.getPool(m.duelId);
        return {
          duelId: m.duelId,
          agent1: { id: m.agent1Id, name: m.agent1Name },
          agent2: { id: m.agent2Id, name: m.agent2Name },
          status: m.status,
          bettingClosesAt: m.bettingClosesAt,
          createdAt: m.createdAt,
          pool: pool
            ? {
                sideATotal: pool.sideATotal,
                sideBTotal: pool.sideBTotal,
                sideACount: pool.sideACount,
                sideBCount: pool.sideBCount,
              }
            : null,
        };
      }),
    );

    return reply.send({ markets: enriched });
  });

  // ========================================================================
  // GET /api/hyperbet/markets/:duelId — Single market detail
  // ========================================================================
  fastify.get<{ Params: { duelId: string } }>(
    "/api/hyperbet/markets/:duelId",
    async (req, reply) => {
      const bridge = (world as WorldWithBridge).duelBettingBridge;
      const market = bridge?.getMarket(req.params.duelId);

      if (!market) {
        return reply.code(404).send({ error: "Market not found" });
      }

      const pool = await poolManager.getPool(market.duelId);

      return reply.send({
        duelId: market.duelId,
        agent1: { id: market.agent1Id, name: market.agent1Name },
        agent2: { id: market.agent2Id, name: market.agent2Name },
        status: market.status,
        bettingClosesAt: market.bettingClosesAt,
        createdAt: market.createdAt,
        winnerId: market.winnerId ?? null,
        winnerSide: market.winnerSide ?? null,
        pool: pool
          ? {
              sideATotal: pool.sideATotal,
              sideBTotal: pool.sideBTotal,
              sideACount: pool.sideACount,
              sideBCount: pool.sideBCount,
            }
          : null,
      });
    },
  );

  // ========================================================================
  // GET /api/hyperbet/events — Public SSE stream
  // ========================================================================
  fastify.get("/api/hyperbet/events", async (req, reply) => {
    const clientId = nextSseId++;

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    sseClients.set(clientId, reply);

    // Send initial state
    const bridge = (world as WorldWithBridge).duelBettingBridge;
    if (bridge) {
      const markets = bridge.getActiveMarkets();
      reply.raw.write(
        `data: ${JSON.stringify({ type: "snapshot", markets })}\n\n`,
      );
    }

    req.raw.on("close", () => {
      sseClients.delete(clientId);
    });

    // Keep connection open
    return reply;
  });

  // Forward betting events to SSE clients
  const bettingEvents = [
    "betting:market:created",
    "betting:market:locked",
    "betting:market:resolved",
    "betting:market:aborted",
    "betting:pool:updated",
  ];

  for (const eventName of bettingEvents) {
    world.on(eventName, (payload: unknown) => {
      const frame = `data: ${JSON.stringify({ type: eventName.replace("betting:", ""), payload })}\n\n`;
      for (const [clientId, reply] of sseClients) {
        try {
          reply.raw.write(frame);
        } catch {
          sseClients.delete(clientId);
        }
      }
    });
  }

  // Heartbeat
  const heartbeat = setInterval(() => {
    const frame = `: heartbeat\n\n`;
    for (const [clientId, reply] of sseClients) {
      try {
        reply.raw.write(frame);
      } catch {
        sseClients.delete(clientId);
      }
    }
  }, 15_000);
  heartbeat.unref();

  // ========================================================================
  // POST /api/hyperbet/bets — Place a bet (wallet signature auth)
  // ========================================================================
  fastify.post<{
    Body: {
      roundId: string;
      side: "A" | "B";
      amount: string;
      walletAddress: string;
      signature: string;
      message: string;
    };
  }>(
    "/api/hyperbet/bets",
    {
      config: { rateLimit: HYPERBET_PUBLIC_WRITE_RATE_LIMIT },
    },
    async (req, reply) => {
      try {
        await HYPERBET_PUBLIC_WRITE_CODEQL_LIMITER.consume(req.ip);
      } catch {
        return reply.code(429).send({ error: "Too Many Requests" });
      }

      const { roundId, side, amount, walletAddress, signature, message } =
        req.body || {};

      if (
        !roundId ||
        !side ||
        !amount ||
        !walletAddress ||
        !signature ||
        !message
      ) {
        return reply.code(400).send({ error: "Missing required fields" });
      }

      if (side !== "A" && side !== "B") {
        return reply.code(400).send({ error: "Side must be A or B" });
      }

      // Verify wallet signature
      const auth = checkWalletSignature({ walletAddress, signature, message });
      if (!auth.valid) {
        return reply
          .code(401)
          .send({ error: auth.error || "Invalid signature" });
      }

      // Place the bet
      const result = await poolManager.placeBet({
        roundId,
        side,
        amount,
        walletAddress,
      });

      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }

      return reply.send({ success: true, betId: result.betId });
    },
  );

  // ========================================================================
  // GET /api/hyperbet/bets/:walletAddress — Bet history
  // ========================================================================
  fastify.get<{ Params: { walletAddress: string } }>(
    "/api/hyperbet/bets/:walletAddress",
    async (req, reply) => {
      const bets = await poolManager.getBetsByWallet(req.params.walletAddress);
      return reply.send({ bets });
    },
  );

  // ========================================================================
  // POST /api/hyperbet/claims — Initiate a claim (wallet signature auth)
  // ========================================================================
  fastify.post<{
    Body: {
      roundId: string;
      walletAddress: string;
      signature: string;
      message: string;
    };
  }>(
    "/api/hyperbet/claims",
    {
      config: { rateLimit: HYPERBET_PUBLIC_WRITE_RATE_LIMIT },
    },
    async (req, reply) => {
      try {
        await HYPERBET_PUBLIC_WRITE_CODEQL_LIMITER.consume(req.ip);
      } catch {
        return reply.code(429).send({ error: "Too Many Requests" });
      }

      const { roundId, walletAddress, signature, message } = req.body || {};

      if (!roundId || !walletAddress || !signature || !message) {
        return reply.code(400).send({ error: "Missing required fields" });
      }

      const auth = checkWalletSignature({ walletAddress, signature, message });
      if (!auth.valid) {
        return reply
          .code(401)
          .send({ error: auth.error || "Invalid signature" });
      }

      const result = await poolManager.createClaimJob(roundId, walletAddress);
      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }

      return reply.send({ success: true, jobId: result.jobId });
    },
  );

  // ========================================================================
  // GET /api/hyperbet/leaderboard — Top bettors
  // ========================================================================
  fastify.get("/api/hyperbet/leaderboard", async (_req, reply) => {
    const leaderboard = await poolManager.getLeaderboard();
    return reply.send({ leaderboard });
  });

  console.log("[HyperBet] ✅ Public routes registered");
}
