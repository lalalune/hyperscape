import { createHash, timingSafeEqual } from "node:crypto";

type BettingFeedTokenParams = {
  authorizationHeader?: string | string[];
};

export type BettingFeedAccessTokenResolution = {
  token: string | null;
  source: "betting-feed" | null;
};

export type OracleProofAccessTokenResolution = {
  token: string | null;
  source: "oracle-proof" | null;
};

export function shouldSkipBettingFeedAuth(
  env: Record<string, string | undefined>,
): boolean {
  return (
    env.NODE_ENV === "development" &&
    (env.BETTING_FEED_SKIP_AUTH || "").trim().toLowerCase() === "true"
  );
}

export function assertSafeBettingFeedAuthConfig(
  env: Record<string, string | undefined>,
): void {
  if (
    env.NODE_ENV === "production" &&
    (env.BETTING_FEED_SKIP_AUTH || "").trim().toLowerCase() === "true"
  ) {
    throw new Error(
      "BETTING_FEED_SKIP_AUTH=true is forbidden when NODE_ENV=production",
    );
  }
}

function digestToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export function extractBettingFeedToken(
  params: BettingFeedTokenParams,
): string | null {
  const authHeader = Array.isArray(params.authorizationHeader)
    ? params.authorizationHeader[0]
    : params.authorizationHeader;
  const match = authHeader?.match(/^Bearer\s+(\S+)\s*$/i);
  if (match) {
    return match[1];
  }
  return null;
}

export function hasValidBettingFeedToken(
  requiredToken: string,
  providedToken: string | null | undefined,
): boolean {
  const expected = requiredToken.trim();
  const presented = providedToken?.trim() ?? "";
  // Early return for missing/empty tokens is intentional: whether a token was
  // provided is already observable from the request headers and is not a secret.
  // Timing-safe comparison only matters when comparing two non-empty values.
  if (!expected || !presented) {
    return false;
  }

  return timingSafeEqual(digestToken(expected), digestToken(presented));
}

export function resolveBettingFeedAccessToken(
  env: Record<string, string | undefined>,
): BettingFeedAccessTokenResolution {
  const bettingFeedToken = env.BETTING_FEED_ACCESS_TOKEN?.trim() || null;
  if (bettingFeedToken) {
    return {
      token: bettingFeedToken,
      source: "betting-feed",
    };
  }

  return {
    token: null,
    source: null,
  };
}

// Oracle-proof retrieval (`/api/streaming/results/:duelId`) exposes
// `duelKeyHex` + `seed` + `replayHash` — the material needed to submit a
// Solana resolution. It intentionally has one dedicated secret boundary and
// never falls back to the general betting feed token.
export function resolveOracleProofAccessToken(
  env: Record<string, string | undefined>,
): OracleProofAccessTokenResolution {
  const keeperAlignedToken =
    env.HYPERSCAPES_RESULT_LOOKUP_BEARER_TOKEN?.trim() || null;
  if (keeperAlignedToken) {
    return { token: keeperAlignedToken, source: "oracle-proof" };
  }
  return { token: null, source: null };
}
