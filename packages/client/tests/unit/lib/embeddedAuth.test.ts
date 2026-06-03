import { describe, expect, it } from "vitest";
import {
  applyHyperiaAuthMessage,
  isTrustedEmbedOrigin,
  normalizeTrustedOrigin,
  parseHyperiaAuthMessage,
  resolveEmbedReadyTargetOrigin,
  resolveTrustedEmbedOrigins,
} from "../../../src/lib/embeddedAuth";

describe("embeddedAuth", () => {
  it("accepts only explicit http(s) origins", () => {
    expect(normalizeTrustedOrigin("https://embed.example.com")).toBe(
      "https://embed.example.com",
    );
    expect(normalizeTrustedOrigin("http://localhost:3333")).toBe(
      "http://localhost:3333",
    );
    expect(normalizeTrustedOrigin("*")).toBeNull();
    expect(normalizeTrustedOrigin("null")).toBeNull();
    expect(normalizeTrustedOrigin("https://embed.example.com/path")).toBeNull();
    expect(
      normalizeTrustedOrigin("https://embed.example.com?foo=bar"),
    ).toBeNull();
    expect(normalizeTrustedOrigin("javascript:alert(1)")).toBeNull();
  });

  it("builds the trusted embed-origin allowlist from current, app, and configured origins", () => {
    expect(
      resolveTrustedEmbedOrigins({
        currentOrigin: "https://game.example.com",
        publicAppUrl: "https://app.example.com/play",
        embedAllowedOrigins:
          "https://embed.example.com, https://partner.example.com , *",
      }),
    ).toEqual([
      "https://game.example.com",
      "https://app.example.com",
      "https://embed.example.com",
      "https://partner.example.com",
    ]);
  });

  it("ignores untrusted origins and parses valid bootstrap messages", () => {
    const trustedOrigins = resolveTrustedEmbedOrigins({
      currentOrigin: "https://game.example.com",
      publicAppUrl: "https://app.example.com",
      embedAllowedOrigins: "https://embed.example.com",
    });

    expect(
      isTrustedEmbedOrigin("https://embed.example.com", trustedOrigins),
    ).toBe(true);
    expect(
      isTrustedEmbedOrigin("https://evil.example.com", trustedOrigins),
    ).toBe(false);

    expect(
      parseHyperiaAuthMessage({
        type: "HYPERIA_AUTH",
        authToken: "auth-token",
        sessionToken: "session-token",
        agentId: "agent-1",
        characterId: "char-1",
        followEntity: "char-1",
      }),
    ).toEqual({
      authToken: "auth-token",
      sessionToken: "session-token",
      agentId: "agent-1",
      characterId: "char-1",
      followEntity: "char-1",
    });

    expect(
      parseHyperiaAuthMessage({
        type: "HYPERIA_AUTH",
        authToken: "   ",
      }),
    ).toBeNull();
  });

  it("applies trusted auth bootstrap fields onto the embedded config", () => {
    const config = {
      agentId: "",
      authToken: "",
      wsUrl: "ws://localhost:5555/ws",
      mode: "spectator" as const,
      sessionToken: "",
    };

    applyHyperiaAuthMessage(config, {
      authToken: "auth-token",
      sessionToken: "session-token",
      agentId: "agent-1",
      characterId: "char-1",
    });

    expect(config).toMatchObject({
      authToken: "auth-token",
      sessionToken: "session-token",
      agentId: "agent-1",
      characterId: "char-1",
      followEntity: "char-1",
    });
  });

  it("targets HYPERIA_READY to a trusted referrer or explicit allowed origin", () => {
    const trustedOrigins = resolveTrustedEmbedOrigins({
      currentOrigin: "https://game.example.com",
      publicAppUrl: "https://app.example.com",
      embedAllowedOrigins: "https://embed.example.com",
    });

    expect(
      resolveEmbedReadyTargetOrigin({
        currentOrigin: "https://game.example.com",
        trustedOrigins,
        referrer: "https://embed.example.com/frame",
      }),
    ).toBe("https://embed.example.com");

    expect(
      resolveEmbedReadyTargetOrigin({
        currentOrigin: "https://game.example.com",
        trustedOrigins: ["https://game.example.com"],
        referrer: null,
      }),
    ).toBe("https://game.example.com");

    expect(
      resolveEmbedReadyTargetOrigin({
        currentOrigin: "https://game.example.com",
        trustedOrigins: ["https://embed.example.com"],
        referrer: null,
      }),
    ).toBe("https://embed.example.com");

    expect(
      resolveEmbedReadyTargetOrigin({
        currentOrigin: "https://game.example.com",
        trustedOrigins: [
          "https://game.example.com",
          "https://embed-a.example.com",
          "https://embed-b.example.com",
        ],
        referrer: null,
      }),
    ).toBeNull();

    expect(
      resolveEmbedReadyTargetOrigin({
        currentOrigin: "https://game.example.com",
        trustedOrigins: [
          "https://game.example.com",
          "https://embed-a.example.com",
          "https://embed-b.example.com",
        ],
        referrer: null,
        allowWildcardFallback: true,
      }),
    ).toBe("*");
  });
});
