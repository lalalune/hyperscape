/**
 * PayoutKeeper — Processes solanaPayoutJobs and sends winnings to bettors.
 *
 * Custodial model for launch: the server's operator wallet sends SOL/tokens
 * to winning bettors. The fight oracle records results on-chain for verifiability.
 *
 * Polls the solanaPayoutJobs table every 5s for PENDING entries.
 * Implements exponential backoff on failure, max 5 attempts.
 */

import { eq, and, inArray, sql } from "drizzle-orm";
import { getDatabase } from "../../database/client.js";
import {
  solanaPayoutJobs,
  solanaBets,
  arenaRounds,
} from "../../database/schema.js";
import { Logger } from "../ServerNetwork/services";
import { redactWalletAddress } from "./BettingPoolManager.js";

const POLL_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 10_000;
const MAX_BATCH_SIZE = 10;
const PROCESSING_LEASE_MS = 60_000;
const MAX_PERSISTED_ERROR_LENGTH = 240;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let processing = false;

type PayoutDb = ReturnType<typeof getDatabase>;
type PayoutTransaction = Parameters<Parameters<PayoutDb["transaction"]>[0]>[0];
type PayoutDbClient = Pick<PayoutTransaction, "execute" | "select" | "update">;

function sanitizePayoutError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown error";
  const sanitized = raw
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b[1-9A-HJ-NP-Za-km-z]{32,88}\b/g, "[id]")
    .replace(/\s+/g, " ")
    .trim();
  return (sanitized || "Unknown error").slice(0, MAX_PERSISTED_ERROR_LENGTH);
}

/**
 * Start the payout keeper polling loop.
 */
export function startPayoutKeeper(): void {
  if (pollTimer) return;

  Logger.info("PayoutKeeper", "Starting payout keeper");

  // Initial run
  void processJobs();

  pollTimer = setInterval(() => {
    void processJobs();
  }, POLL_INTERVAL_MS);
  pollTimer.unref();
}

/**
 * Stop the payout keeper.
 */
export function stopPayoutKeeper(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  processing = false;
  Logger.info("PayoutKeeper", "Payout keeper stopped");
}

async function processJobs(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    const db = getDatabase();
    const jobs = await db.transaction(async (tx) => {
      const claimedJobIds = await claimDuePayoutJobIds(
        tx,
        Date.now(),
        MAX_BATCH_SIZE,
      );
      return loadClaimedPayoutJobs(tx, claimedJobIds);
    });
    if (jobs.length === 0) {
      return;
    }

    for (const job of jobs) {
      await db.transaction(async (tx) => processOneJob(tx, job));
    }
  } catch (err) {
    Logger.error(
      "PayoutKeeper",
      "Job processing loop failed",
      err instanceof Error ? err : null,
    );
  } finally {
    processing = false;
  }
}

export async function claimDuePayoutJobIds(
  tx: Pick<PayoutTransaction, "execute">,
  now: number,
  limit: number,
): Promise<string[]> {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), MAX_BATCH_SIZE));
  const leaseUntil = now + PROCESSING_LEASE_MS;
  const result = await tx.execute<{ id: string }>(sql`
    WITH due AS (
      SELECT "id"
      FROM "solana_payout_jobs"
      WHERE "status" = 'PENDING'
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
      ORDER BY "createdAt" ASC
      LIMIT ${boundedLimit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "solana_payout_jobs"
    SET "nextAttemptAt" = ${leaseUntil},
        "updatedAt" = ${now}
    WHERE "id" IN (SELECT "id" FROM due)
    RETURNING "id"
  `);

  return result.rows
    .map((row) => (typeof row.id === "string" ? row.id : null))
    .filter((id): id is string => Boolean(id));
}

async function loadClaimedPayoutJobs(
  tx: Pick<PayoutTransaction, "select">,
  jobIds: readonly string[],
): Promise<Array<typeof solanaPayoutJobs.$inferSelect>> {
  if (jobIds.length === 0) {
    return [];
  }

  const jobs = await tx
    .select()
    .from(solanaPayoutJobs)
    .where(inArray(solanaPayoutJobs.id, [...jobIds]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  return jobIds
    .map((jobId) => jobsById.get(jobId) ?? null)
    .filter((job): job is typeof solanaPayoutJobs.$inferSelect => job !== null);
}

async function processOneJob(
  db: PayoutDbClient,
  job: typeof solanaPayoutJobs.$inferSelect,
): Promise<void> {
  try {
    const lockRows = await db.execute<{ acquired: boolean }>(sql`
      SELECT pg_try_advisory_xact_lock(
        hashtext(${job.id}),
        hashtext(${job.bettorWallet})
      ) AS acquired
    `);
    if (!lockRows.rows[0]?.acquired) {
      Logger.warn(
        "PayoutKeeper",
        "Payout job already locked by another worker",
        {
          jobId: job.id,
          roundId: job.roundId,
        },
      );
      return;
    }

    // Look up the round to check if it's resolved and who won
    const rounds = await db
      .select()
      .from(arenaRounds)
      .where(eq(arenaRounds.id, job.roundId))
      .limit(1);

    if (rounds.length === 0) {
      await markFailed(db, job.id, "Round not found");
      return;
    }

    const round = rounds[0];
    if (!round.winnerId) {
      // Round not resolved yet — schedule retry
      await scheduleRetry(db, job.id, job.attempts, "Round not yet resolved");
      return;
    }

    // Get the bettor's bets for this round
    const bets = await db
      .select()
      .from(solanaBets)
      .where(
        and(
          eq(solanaBets.roundId, job.roundId),
          eq(solanaBets.bettorWallet, job.bettorWallet),
          eq(solanaBets.status, "CONFIRMED"),
        ),
      );

    if (bets.length === 0) {
      await markFailed(db, job.id, "No confirmed bets found");
      return;
    }

    // Determine if this bettor won
    // Agent A is the round's agentAId, Agent B is agentBId
    const winningSide =
      round.winnerId === round.agentAId
        ? "A"
        : round.winnerId === round.agentBId
          ? "B"
          : null;
    if (!winningSide) {
      await markFailed(db, job.id, "Round winner does not match either side");
      return;
    }
    const userBetOnWinner = bets.some((b) => b.side === winningSide);

    if (!userBetOnWinner) {
      // Bettor lost — mark job as complete (no payout needed).
      // Guard on status='PENDING' so two instances racing on the same job
      // won't both transition it; the loser's update matches zero rows.
      const lostUpdate = await db
        .update(solanaPayoutJobs)
        .set({ status: "NO_PAYOUT", updatedAt: Date.now() })
        .where(
          and(
            eq(solanaPayoutJobs.id, job.id),
            eq(solanaPayoutJobs.status, "PENDING"),
          ),
        )
        .returning({ id: solanaPayoutJobs.id });
      if (lostUpdate.length === 0) {
        // Another worker beat us to this job; skip logging to avoid noise.
        return;
      }

      Logger.info("PayoutKeeper", "Bettor lost — no payout", {
        jobId: job.id,
        wallet: redactWalletAddress(job.bettorWallet),
        roundId: job.roundId,
      });
      return;
    }

    // Calculate payout: (user's winning bet / total winning pool) * total pool
    // For now, mark as READY_FOR_PAYOUT — actual transfer will be implemented
    // when the token infrastructure is connected.
    // Same status guard as above prevents duplicate transitions under races.
    const readyUpdate = await db
      .update(solanaPayoutJobs)
      .set({
        status: "READY_FOR_PAYOUT",
        updatedAt: Date.now(),
      })
      .where(
        and(
          eq(solanaPayoutJobs.id, job.id),
          eq(solanaPayoutJobs.status, "PENDING"),
        ),
      )
      .returning({ id: solanaPayoutJobs.id });
    if (readyUpdate.length === 0) {
      return;
    }

    Logger.info("PayoutKeeper", "Payout job marked ready", {
      jobId: job.id,
      wallet: redactWalletAddress(job.bettorWallet),
      roundId: job.roundId,
      winningSide,
    });

    // Payout transfer plumbing is not wired in this branch yet. The keeper
    // intentionally stops at READY_FOR_PAYOUT after recording the winner so a
    // transfer-capable follow-up can calculate the final amount, submit the
    // Solana transfer, persist claimSignature, and then mark COMPLETE.
  } catch (err) {
    Logger.error(
      "PayoutKeeper",
      "Failed to process job",
      err instanceof Error ? err : null,
      { jobId: job.id, roundId: job.roundId },
    );
    await scheduleRetry(db, job.id, job.attempts, sanitizePayoutError(err));
  }
}

async function scheduleRetry(
  db: PayoutDbClient,
  jobId: string,
  currentAttempts: number,
  error: string,
): Promise<void> {
  const nextAttempt = currentAttempts + 1;

  if (nextAttempt >= MAX_ATTEMPTS) {
    await markFailed(db, jobId, error);
    return;
  }

  const backoff = BASE_BACKOFF_MS * Math.pow(2, currentAttempts);
  const nextAttemptAt = Date.now() + backoff;

  // Guard on status='PENDING' so a concurrent worker that has already
  // transitioned this job to READY_FOR_PAYOUT / NO_PAYOUT / FAILED can't
  // be rolled back to PENDING by a late scheduleRetry call.
  const retryUpdate = await db
    .update(solanaPayoutJobs)
    .set({
      attempts: nextAttempt,
      lastError: error,
      nextAttemptAt,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(solanaPayoutJobs.id, jobId),
        eq(solanaPayoutJobs.status, "PENDING"),
      ),
    )
    .returning({ id: solanaPayoutJobs.id });
  if (retryUpdate.length === 0) {
    return;
  }

  Logger.warn("PayoutKeeper", "Scheduled retry", {
    jobId,
    attempt: nextAttempt,
    backoffMs: backoff,
    error,
  });
}

async function markFailed(
  db: PayoutDbClient,
  jobId: string,
  error: string,
): Promise<void> {
  // Same PENDING guard as scheduleRetry / processOneJob — prevents a stale
  // worker from overwriting a terminal state set by another instance.
  const failUpdate = await db
    .update(solanaPayoutJobs)
    .set({
      status: "FAILED",
      lastError: error,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(solanaPayoutJobs.id, jobId),
        eq(solanaPayoutJobs.status, "PENDING"),
      ),
    )
    .returning({ id: solanaPayoutJobs.id });
  if (failUpdate.length === 0) {
    return;
  }

  Logger.error("PayoutKeeper", "Job permanently failed", null, {
    jobId,
    error,
  });
}

/** @internal Transactional helpers exposed for payout keeper regression tests. */
export const __payoutKeeperTestInternals = {
  processOneJob,
};
