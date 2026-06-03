import { afterEach, describe, expect, it } from "vitest";
import {
  GAME_API_URL,
  GAME_WS_URL,
  CDN_URL,
  refreshApiConfig,
  resolveApiConfig,
} from "../../../src/lib/api-config";

describe("resolveApiConfig", () => {
  afterEach(() => {
    if (typeof window !== "undefined") {
      delete (window as Window & { env?: unknown }).env;
    }
    refreshApiConfig();
  });

  it("uses Railway API defaults in production", () => {
    const result = resolveApiConfig({
      prod: true,
      runtimeEnv: {},
      buildEnv: {},
    });

    expect(result.elizaOsUrl).toBe("https://hyperia-production.up.railway.app");
    expect(result.gameApiUrl).toBe("https://hyperia-production.up.railway.app");
    expect(result.gameWsUrl).toBe("wss://hyperia-production.up.railway.app/ws");
    expect(result.cdnUrl).toBe("https://assets.hyperia.club");
  });

  it("uses local defaults in development", () => {
    const result = resolveApiConfig({
      prod: false,
      runtimeEnv: {},
      buildEnv: {},
    });

    expect(result.elizaOsUrl).toBe("http://localhost:5555");
    expect(result.gameApiUrl).toBe("http://localhost:5555");
    expect(result.gameWsUrl).toBe("ws://localhost:5556/ws");
    expect(result.cdnUrl).toBe("http://localhost:5555/game-assets");
  });

  it("normalizes loopback runtime overrides to the active browser host", () => {
    const result = resolveApiConfig({
      prod: false,
      browserHref: "http://localhost:3333/apps",
      browserHostname: "localhost",
      runtimeEnv: {
        PUBLIC_API_URL: "http://127.0.0.1:5555",
        PUBLIC_WS_URL: "ws://127.0.0.1:5556/ws",
      },
      buildEnv: {},
    });

    expect(result.gameApiUrl).toBe("http://localhost:5555");
    expect(result.gameWsUrl).toBe("ws://localhost:5556/ws");
  });

  it("prefers runtime overrides over build-time values", () => {
    const result = resolveApiConfig({
      prod: true,
      runtimeEnv: {
        PUBLIC_API_URL: "https://runtime.example",
        PUBLIC_WS_URL: "wss://runtime.example/ws",
        PUBLIC_CDN_URL: "https://cdn.runtime.example",
      },
      buildEnv: {
        PUBLIC_API_URL: "https://build.example",
        PUBLIC_WS_URL: "wss://build.example/ws",
        PUBLIC_CDN_URL: "https://cdn.build.example",
      },
    });

    expect(result.gameApiUrl).toBe("https://runtime.example");
    expect(result.gameWsUrl).toBe("wss://runtime.example/ws");
    expect(result.cdnUrl).toBe("https://cdn.runtime.example");
  });

  it("refreshes live API bindings from runtime env", () => {
    (
      window as Window & {
        env?: Record<string, string>;
      }
    ).env = {
      PUBLIC_API_URL: "https://runtime.example",
      PUBLIC_WS_URL: "wss://runtime.example/ws",
      PUBLIC_CDN_URL: "https://cdn.runtime.example",
    };

    refreshApiConfig();

    expect(GAME_API_URL).toBe("https://runtime.example");
    expect(GAME_WS_URL).toBe("wss://runtime.example/ws");
    expect(CDN_URL).toBe("https://cdn.runtime.example");
  });
});
