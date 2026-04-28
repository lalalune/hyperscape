import { describe, expect, it } from "vitest";
import {
  buildDefaultCaptureLaunchArgs,
  resolveAllowedCaptureOrigins,
  resolveUnexpectedCaptureOrigin,
  shouldAcceptCaptureReadiness,
} from "../captureBrowserPolicy";

describe("captureBrowserPolicy", () => {
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

  it("does NOT emit kiosk/window-size flags without fullScreenPin", () => {
    const args = buildDefaultCaptureLaunchArgs({
      angleBackend: "vulkan",
      featureFlags: "--enable-features=Vulkan,UseSkiaRenderer,WebGPU",
    });
    expect(args).not.toContain("--kiosk");
    expect(args.some((a) => a.startsWith("--window-size="))).toBe(false);
    expect(args.some((a) => a.startsWith("--window-position="))).toBe(false);
  });

  it("pins Chromium full-screen at (0,0) when fullScreenPin is supplied (x11_nvenc mode)", () => {
    const args = buildDefaultCaptureLaunchArgs({
      angleBackend: "vulkan",
      featureFlags: "--enable-features=Vulkan,UseSkiaRenderer,WebGPU",
      fullScreenPin: { width: 1920, height: 1080 },
    });
    expect(args).toContain("--kiosk");
    expect(args).toContain("--window-size=1920,1080");
    expect(args).toContain("--window-position=0,0");
    expect(args).toContain("--hide-scrollbars");
    expect(args).toContain("--disable-infobars");
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
