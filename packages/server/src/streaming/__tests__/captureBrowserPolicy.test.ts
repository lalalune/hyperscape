import { describe, expect, it } from "vitest";
import {
  applyCaptureFrameRateToUrl,
  buildDefaultCaptureLaunchArgs,
  DEFAULT_CAPTURE_GAME_URL,
  resolveAllowedCaptureOrigins,
  resolveCaptureUrlCandidates,
  resolveUnexpectedCaptureOrigin,
  shouldAcceptCaptureReadiness,
} from "../captureBrowserPolicy";

describe("captureBrowserPolicy", () => {
  it("uses only the canonical stream page when no fallback is explicit", () => {
    expect(resolveCaptureUrlCandidates({})).toEqual([DEFAULT_CAPTURE_GAME_URL]);
    expect(DEFAULT_CAPTURE_GAME_URL.endsWith("/stream.html")).toBe(true);
  });

  it("passes a bounded render rate to the capture page", () => {
    expect(
      applyCaptureFrameRateToUrl(
        "https://game.example/stream.html?existing=1#access",
        60,
      ),
    ).toBe("https://game.example/stream.html?existing=1&streamFps=60#access");
    expect(
      applyCaptureFrameRateToUrl("https://game.example/stream.html", 240),
    ).toBe("https://game.example/stream.html?streamFps=60");
  });

  it("accepts only explicitly configured capture fallbacks and deduplicates them", () => {
    expect(
      resolveCaptureUrlCandidates({
        primaryUrl: "https://game.example/stream.html",
        fallbackUrls:
          "https://game.example/spectator, https://game.example/stream.html",
      }),
    ).toEqual([
      "https://game.example/stream.html",
      "https://game.example/spectator",
    ]);
  });

  it("does not include disable-web-security in the default launch args", () => {
    const args = buildDefaultCaptureLaunchArgs({
      angleBackend: "metal",
      featureFlags: "--enable-features=Vulkan,UseSkiaRenderer,WebGPU",
    });

    expect(args).not.toContain("--disable-web-security");
    expect(args).not.toContain("--no-sandbox");
  });

  it("only includes no-sandbox when capture sandboxing is explicitly disabled", () => {
    const args = buildDefaultCaptureLaunchArgs({
      angleBackend: "metal",
      featureFlags: "--enable-features=Vulkan,UseSkiaRenderer,WebGPU",
      disableSandbox: true,
    });

    expect(args).toContain("--no-sandbox");
  });

  it("derives one allowed origin per configured game URL", () => {
    expect(
      resolveAllowedCaptureOrigins([
        "https://game.example.com/stream",
        "https://game.example.com/alt",
        "http://fallback.example.com/",
      ]),
    ).toEqual(["https://game.example.com", "http://fallback.example.com"]);
  });

  it("rejects navigation outside the configured origin set", () => {
    const allowedOrigins = ["https://game.example.com"];

    expect(
      resolveUnexpectedCaptureOrigin(
        "https://game.example.com/stream",
        allowedOrigins,
      ),
    ).toBeNull();
    expect(
      resolveUnexpectedCaptureOrigin(
        "https://evil.example.com/stream",
        allowedOrigins,
      ),
    ).toBe("https://evil.example.com");
  });

  it("accepts renderer readiness decisions through one shared helper", () => {
    expect(
      shouldAcceptCaptureReadiness({
        snapshot: {
          ready: true,
          degradedReason: null,
          diagnostics: null,
        },
        startedAt: 0,
        nowMs: 1_000,
      }),
    ).toBe(true);

    expect(
      shouldAcceptCaptureReadiness({
        snapshot: {
          ready: false,
          degradedReason: "loading_overlay_active",
          diagnostics: {
            hasCanvas: true,
            hasStreamingBootUi: true,
            hasCriticalErrorUi: false,
            readyFlag: false,
          },
        },
        startedAt: 0,
        nowMs: 30_000,
      }),
    ).toBe(false);

    expect(
      shouldAcceptCaptureReadiness({
        snapshot: {
          ready: false,
          degradedReason: "loading_overlay_active",
          diagnostics: {
            hasCanvas: true,
            hasStreamingBootUi: true,
            hasCriticalErrorUi: false,
            readyFlag: false,
          },
        },
        startedAt: 0,
        nowMs: 180_000,
      }),
    ).toBe(true);

    expect(
      shouldAcceptCaptureReadiness({
        snapshot: {
          ready: false,
          degradedReason: "initialization_failed",
          diagnostics: {
            hasCanvas: false,
            hasStreamingBootUi: false,
            hasCriticalErrorUi: true,
            readyFlag: false,
          },
        },
        startedAt: 0,
        nowMs: 180_000,
      }),
    ).toBe(false);
  });
});
