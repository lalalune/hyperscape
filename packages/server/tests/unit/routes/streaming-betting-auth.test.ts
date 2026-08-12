import { describe, expect, it } from "vitest";
import {
  extractBettingFeedToken,
  hasValidBettingFeedToken,
  hasValidBettingFeedTokenSet,
  resolveBettingFeedAccessToken,
  shouldSkipBettingFeedAuth,
} from "../../../src/routes/streaming-betting-auth.js";

describe("streaming-betting-auth", () => {
  it("accepts a matching token", () => {
    expect(hasValidBettingFeedToken("secret-token", "secret-token")).toBe(true);
  });

  it("rejects a missing token", () => {
    expect(hasValidBettingFeedToken("secret-token", null)).toBe(false);
  });

  it("rejects a mismatched token", () => {
    expect(hasValidBettingFeedToken("secret-token", "secret-token-2")).toBe(
      false,
    );
  });

  it("rejects a token with a different length", () => {
    expect(hasValidBettingFeedToken("secret-token", "short")).toBe(false);
  });

  it("accepts either current or previous token during a bounded rotation", () => {
    expect(
      hasValidBettingFeedTokenSet(
        ["current-secret", "previous-secret"],
        "current-secret",
      ),
    ).toBe(true);
    expect(
      hasValidBettingFeedTokenSet(
        ["current-secret", "previous-secret"],
        "previous-secret",
      ),
    ).toBe(true);
    expect(
      hasValidBettingFeedTokenSet(
        ["current-secret", "previous-secret"],
        "retired-secret",
      ),
    ).toBe(false);
  });

  it("extracts a bearer token case-insensitively from the authorization header", () => {
    expect(
      extractBettingFeedToken({
        authorizationHeader: "bearer secret-token",
      }),
    ).toBe("secret-token");
  });

  it("does not accept query tokens unless the route explicitly allows them", () => {
    expect(extractBettingFeedToken({})).toBeNull();
  });

  it("prefers BETTING_FEED_ACCESS_TOKEN over the viewer token", () => {
    expect(
      resolveBettingFeedAccessToken({
        BETTING_FEED_ACCESS_TOKEN: "bet-secret",
        STREAMING_VIEWER_ACCESS_TOKEN: "viewer-secret",
      }),
    ).toEqual({
      token: "bet-secret",
      previousToken: null,
      source: "betting-feed",
    });
  });

  it("does not fall back to STREAMING_VIEWER_ACCESS_TOKEN when needed", () => {
    expect(
      resolveBettingFeedAccessToken({
        BETTING_FEED_ACCESS_TOKEN: "",
        STREAMING_VIEWER_ACCESS_TOKEN: "viewer-secret",
      }),
    ).toEqual({
      token: null,
      previousToken: null,
      source: null,
    });
  });

  it("reports missing auth when neither token is configured", () => {
    expect(resolveBettingFeedAccessToken({})).toEqual({
      token: null,
      previousToken: null,
      source: null,
    });
  });

  it("normalizes a distinct previous token and ignores a duplicate", () => {
    expect(
      resolveBettingFeedAccessToken({
        BETTING_FEED_ACCESS_TOKEN: "current",
        BETTING_FEED_ACCESS_TOKEN_PREVIOUS: "previous",
      }),
    ).toMatchObject({ token: "current", previousToken: "previous" });
    expect(
      resolveBettingFeedAccessToken({
        BETTING_FEED_ACCESS_TOKEN: "same",
        BETTING_FEED_ACCESS_TOKEN_PREVIOUS: "same",
      }),
    ).toMatchObject({ token: "same", previousToken: null });
  });

  it("allows skip-auth only in development", () => {
    expect(
      shouldSkipBettingFeedAuth({
        NODE_ENV: "development",
        BETTING_FEED_SKIP_AUTH: "true",
      }),
    ).toBe(true);
    expect(
      shouldSkipBettingFeedAuth({
        NODE_ENV: "staging",
        BETTING_FEED_SKIP_AUTH: "true",
      }),
    ).toBe(false);
  });
});
