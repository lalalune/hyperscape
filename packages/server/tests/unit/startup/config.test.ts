import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultElizaOsApiUrl,
  getDefaultPublicAppUrl,
  getDefaultPublicWsUrl,
  isProductionRuntime,
} from "../../../src/shared/public-ws-url.js";

describe("public URL defaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Railway API defaults in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_WS_URL", undefined);
    vi.stubEnv("SERVER_HOST", undefined);
    vi.stubEnv("PORT", undefined);
    vi.stubEnv("UWS_PORT", undefined);
    vi.stubEnv("UWS_ENABLED", undefined);

    expect(isProductionRuntime()).toBe(true);
    expect(getDefaultElizaOsApiUrl()).toBe(
      "https://hyperia-production.up.railway.app",
    );
    expect(getDefaultPublicAppUrl()).toBe("https://hyperia.club");
    expect(getDefaultPublicWsUrl()).toBe(
      "wss://hyperia-production.up.railway.app/ws",
    );
  });

  it("uses the uWS websocket port in local development by default", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SERVER_HOST", undefined);
    vi.stubEnv("PORT", undefined);
    vi.stubEnv("UWS_PORT", undefined);
    vi.stubEnv("UWS_ENABLED", undefined);

    expect(isProductionRuntime()).toBe(false);
    expect(getDefaultElizaOsApiUrl()).toBe("http://localhost:4001");
    expect(getDefaultPublicAppUrl()).toBe("http://localhost:3333");
    expect(getDefaultPublicWsUrl()).toBe("ws://localhost:5556/ws");
  });

  it("falls back to the fastify port when uWS is disabled in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SERVER_HOST", "127.0.0.1");
    vi.stubEnv("PORT", "7777");
    vi.stubEnv("UWS_PORT", "8888");
    vi.stubEnv("UWS_ENABLED", "false");

    expect(getDefaultPublicWsUrl()).toBe("ws://127.0.0.1:7777/ws");
  });
});
