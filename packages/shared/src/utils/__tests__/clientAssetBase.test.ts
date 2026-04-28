// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  getRuntimeClientAssetBase,
  resolveClientAssetBase,
} from "../clientAssetBase";

type TestWindow = Window & {
  env?: Record<string, string>;
  __CDN_URL?: string;
  __ASSETS_URL?: string;
};

describe("clientAssetBase", () => {
  afterEach(() => {
    if (typeof window !== "undefined") {
      delete (window as TestWindow).env;
      delete (window as TestWindow).__CDN_URL;
      delete (window as TestWindow).__ASSETS_URL;
    }
  });

  it("maps problematic sslip snapshot asset hosts to the runtime CDN", () => {
    (window as TestWindow).env = {
      PUBLIC_CDN_URL:
        "https://hyperscapes-staging-production.up.railway.app/game-assets",
      PUBLIC_API_URL: "https://hyperscapes-staging-production.up.railway.app",
    };

    expect(
      resolveClientAssetBase(
        "https://46.4.80.150.sslip.io/game-assets",
        "https://46.4.80.150.sslip.io",
        "https://enoomian-staging.hyperscape-enoomian-staging.pages.dev/stream",
        { preferRuntimeAssetBase: true },
      ),
    ).toBe("https://hyperscapes-staging-production.up.railway.app/game-assets");
  });

  it("prefers runtime env asset bases over stale window overrides", () => {
    (window as TestWindow).env = {
      PUBLIC_CDN_URL:
        "https://hyperscapes-staging-production.up.railway.app/game-assets",
    };
    (window as TestWindow).__ASSETS_URL =
      "https://46.4.80.150.sslip.io/game-assets";

    expect(
      getRuntimeClientAssetBase("https://46.4.80.150.sslip.io/game-assets"),
    ).toBe("https://hyperscapes-staging-production.up.railway.app/game-assets");
  });

  it("preserves the server asset base for generic clients when runtime override is not requested", () => {
    (window as TestWindow).env = {
      PUBLIC_CDN_URL:
        "https://hyperscapes-staging-production.up.railway.app/game-assets",
    };

    expect(
      resolveClientAssetBase(
        "https://cdn.example.com/game-assets",
        "https://api.example.com",
        "https://example.com/play",
      ),
    ).toBe("https://cdn.example.com/game-assets");
  });
});
