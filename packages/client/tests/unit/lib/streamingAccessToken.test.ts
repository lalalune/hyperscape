import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getStreamingAccessToken,
  primeStreamingAccessTokenFromWindow,
  resetStreamingAccessTokenForTests,
  resolveStreamingAccessTokenFromHref,
} from "../../../src/lib/streamingAccessToken";

afterEach(() => {
  resetStreamingAccessTokenForTests();
});

describe("streamingAccessToken", () => {
  it("prefers the hash token and scrubs it from both hash and query", () => {
    const resolved = resolveStreamingAccessTokenFromHref(
      "https://example.com/stream?page=1&streamToken=query-token#streamToken=hash-token&mode=stream",
    );

    expect(resolved.token).toBe("hash-token");
    expect(resolved.nextUrl).toBe("/stream?page=1#mode=stream");
  });

  it("scrubs a query-only token while preserving the rest of the URL", () => {
    const resolved = resolveStreamingAccessTokenFromHref(
      "https://example.com/stream?streamToken=query-token&foo=bar",
    );

    expect(resolved.token).toBe("query-token");
    expect(resolved.nextUrl).toBe("/stream?foo=bar");
  });

  it("scrubs sessionToken from the URL without treating it as a streaming token", () => {
    const resolved = resolveStreamingAccessTokenFromHref(
      "https://example.com/stream?sessionToken=session-secret&foo=bar#mode=stream",
    );

    expect(resolved.token).toBeNull();
    expect(resolved.nextUrl).toBe("/stream?foo=bar#mode=stream");
  });

  it("does nothing when no token is present", () => {
    const resolved = resolveStreamingAccessTokenFromHref(
      "https://example.com/stream?foo=bar#mode=stream",
    );

    expect(resolved.token).toBeNull();
    expect(resolved.nextUrl).toBeNull();
  });

  it("falls back to the runtime viewer token when the URL is not tokenized", () => {
    const replaceState = vi.fn();
    const fakeWindow = {
      env: {
        PUBLIC_STREAMING_VIEWER_ACCESS_TOKEN: "viewer-token",
      },
      location: {
        href: "https://example.com/stream?foo=bar#mode=stream",
      },
      history: {
        state: { page: "stream" },
        replaceState,
      },
    } as unknown as Window;

    expect(primeStreamingAccessTokenFromWindow(fakeWindow)).toBe(
      "viewer-token",
    );
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("retries runtime env resolution when primed before env.js populates window.env", () => {
    const replaceState = vi.fn();
    const fakeWindow = {
      location: {
        href: "https://example.com/stream?foo=bar#mode=stream",
      },
      history: {
        state: { page: "stream" },
        replaceState,
      },
    } as unknown as Window & {
      env?: { PUBLIC_STREAMING_VIEWER_ACCESS_TOKEN?: string };
    };

    expect(primeStreamingAccessTokenFromWindow(fakeWindow)).toBeNull();

    fakeWindow.env = {
      PUBLIC_STREAMING_VIEWER_ACCESS_TOKEN: "viewer-token",
    };

    expect(primeStreamingAccessTokenFromWindow(fakeWindow)).toBe("viewer-token");
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("primes from window state, scrubs the URL, and caches the token", () => {
    const fakeWindow = {
      location: {
        href: "https://example.com/stream?foo=bar&streamToken=query-token#mode=stream",
      },
      history: {
        state: { page: "stream" },
        replaceState: vi.fn((_: unknown, __: string, nextUrl: string) => {
          fakeWindow.location.href = `https://example.com${nextUrl}`;
        }),
      },
    } as unknown as Window;

    expect(primeStreamingAccessTokenFromWindow(fakeWindow)).toBe("query-token");
    expect(fakeWindow.history.replaceState).toHaveBeenCalledWith(
      fakeWindow.history.state,
      "",
      "/stream?foo=bar#mode=stream",
    );
    expect(primeStreamingAccessTokenFromWindow(fakeWindow)).toBe("query-token");
    expect(fakeWindow.history.replaceState).toHaveBeenCalledTimes(1);
  });

  it("reads the cached token without rereading window state", () => {
    const replaceState = vi.fn();
    const fakeWindow = {
      location: {
        href: "https://example.com/stream#streamToken=hash-token",
      },
      history: {
        state: null,
        replaceState,
      },
    } as unknown as Window;

    primeStreamingAccessTokenFromWindow(fakeWindow);
    const originalWindow = globalThis.window;
    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: {
            href: "https://example.com/stream",
          },
          history: {
            state: null,
            replaceState: vi.fn(),
          },
        },
      });

      expect(getStreamingAccessToken()).toBe("hash-token");
      expect(replaceState).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("replaces the cached token when a later URL carries a new stream token", () => {
    const replaceStateA = vi.fn();
    const replaceStateB = vi.fn();
    const firstWindow = {
      location: {
        href: "https://example.com/stream?streamToken=token-a",
      },
      history: {
        state: null,
        replaceState: replaceStateA,
      },
    } as unknown as Window;
    const secondWindow = {
      location: {
        href: "https://example.com/stream?streamToken=token-b&foo=bar",
      },
      history: {
        state: { page: "stream" },
        replaceState: replaceStateB,
      },
    } as unknown as Window;

    expect(primeStreamingAccessTokenFromWindow(firstWindow)).toBe("token-a");
    expect(primeStreamingAccessTokenFromWindow(secondWindow)).toBe("token-b");
    expect(replaceStateA).toHaveBeenCalledWith(null, "", "/stream");
    expect(replaceStateB).toHaveBeenCalledWith(
      secondWindow.history.state,
      "",
      "/stream?foo=bar",
    );
  });

  it("replaces the cached token when the runtime env publishes a new viewer token", () => {
    const firstWindow = {
      env: {
        PUBLIC_STREAMING_VIEWER_ACCESS_TOKEN: "viewer-a",
      },
      location: {
        href: "https://example.com/stream",
      },
      history: {
        state: null,
        replaceState: vi.fn(),
      },
    } as unknown as Window;
    const secondWindow = {
      env: {
        PUBLIC_STREAMING_VIEWER_ACCESS_TOKEN: "viewer-b",
      },
      location: {
        href: "https://example.com/stream",
      },
      history: {
        state: null,
        replaceState: vi.fn(),
      },
    } as unknown as Window;

    expect(primeStreamingAccessTokenFromWindow(firstWindow)).toBe("viewer-a");
    expect(primeStreamingAccessTokenFromWindow(secondWindow)).toBe("viewer-b");
  });

  it("resets the cached token for later calls", () => {
    const fakeWindow = {
      location: {
        href: "https://example.com/stream#streamToken=hash-token",
      },
      history: {
        state: null,
        replaceState: vi.fn(),
      },
    } as unknown as Window;

    expect(primeStreamingAccessTokenFromWindow(fakeWindow)).toBe("hash-token");
    resetStreamingAccessTokenForTests();

    const freshWindow = {
      location: {
        href: "https://example.com/stream#streamToken=fresh-token",
      },
      history: {
        state: null,
        replaceState: vi.fn(),
      },
    } as unknown as Window;

    expect(primeStreamingAccessTokenFromWindow(freshWindow)).toBe(
      "fresh-token",
    );
  });
});
