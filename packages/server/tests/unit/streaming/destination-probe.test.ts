import type * as dnsPromises from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { probePlaybackUrl } from "../../../src/streaming/destination-probe.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

describe("probePlaybackUrl", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("rejects unsupported playback protocols before fetching", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await probePlaybackUrl("file:///tmp/stream.m3u8");

    expect(result.ready).toBe(false);
    expect(result.lastError).toBe("unsupported_playback_protocol");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks private hosts in production by default", async () => {
    process.env.NODE_ENV = "production";
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await probePlaybackUrl("http://127.0.0.1/live.m3u8");

    expect(result.ready).toBe(false);
    expect(result.lastError).toBe("private_playback_host_blocked");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks private hosts in staging even when bypass is configured", async () => {
    process.env.NODE_ENV = "staging";
    process.env.STREAM_ALLOW_PRIVATE_PLAYBACK_PROBES = "true";
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await probePlaybackUrl("http://169.254.169.254/latest");

    expect(result.ready).toBe(false);
    expect(result.lastError).toBe("private_playback_host_blocked");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks public hostnames that resolve to private addresses in production", async () => {
    process.env.NODE_ENV = "production";
    const lookupSpy = vi
      .fn()
      .mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    const fetchSpy = vi.fn();

    const result = await probePlaybackUrl(
      "https://example.com/live.m3u8",
      4_000,
      {
        lookup: lookupSpy as unknown as typeof dnsPromises.lookup,
        fetch: fetchSpy as unknown as typeof fetch,
      },
    );

    expect(result.ready).toBe(false);
    expect(result.lastError).toBe("private_playback_host_blocked");
    expect(lookupSpy).toHaveBeenCalledWith("example.com", {
      all: true,
      verbatim: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows private hosts in explicit development mode", async () => {
    process.env.NODE_ENV = "development";
    process.env.STREAM_ALLOW_PRIVATE_PLAYBACK_PROBES = "true";
    const response = new Response("#EXTM3U", { status: 200 });
    const fetchSpy = vi.fn().mockResolvedValue(response);

    const result = await probePlaybackUrl("http://127.0.0.1/live.m3u8", 4_000, {
      fetch: fetchSpy as unknown as typeof fetch,
    });

    expect(result.ready).toBe(true);
    expect(result.manifestStatus).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("ignores the private-host bypass in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.STREAM_ALLOW_PRIVATE_PLAYBACK_PROBES = "true";
    const fetchSpy = vi.fn();

    const result = await probePlaybackUrl("http://127.0.0.1/live.m3u8", 4_000, {
      fetch: fetchSpy as unknown as typeof fetch,
    });

    expect(result.ready).toBe(false);
    expect(result.lastError).toBe("private_playback_host_blocked");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("probes with redirect following disabled", async () => {
    const response = new Response("", {
      status: 302,
      headers: { location: "https://elsewhere.example/live.m3u8" },
    });
    const fetchSpy = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await probePlaybackUrl("https://stream.example/live.m3u8");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        redirect: "manual",
      }),
    );
  });
});
