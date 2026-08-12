import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerConfig } from "../config.js";
import {
  checkDatabaseHealth,
  registerHealthRoutes,
} from "../routes/health-routes.js";

const originalStrictDatabaseHealth = process.env.HEALTH_CHECK_STRICT_DB;
const originalLegacyDatabaseHealth = process.env.HEALTH_CHECK_DATABASE;

afterEach(() => {
  if (originalStrictDatabaseHealth === undefined) {
    delete process.env.HEALTH_CHECK_STRICT_DB;
  } else {
    process.env.HEALTH_CHECK_STRICT_DB = originalStrictDatabaseHealth;
  }
  if (originalLegacyDatabaseHealth === undefined) {
    delete process.env.HEALTH_CHECK_DATABASE;
  } else {
    process.env.HEALTH_CHECK_DATABASE = originalLegacyDatabaseHealth;
  }
});

function createWorld(checkHealthAsync?: () => Promise<unknown>) {
  return {
    getSystem: vi.fn(() =>
      checkHealthAsync ? { checkHealthAsync } : undefined,
    ),
    network: { sockets: new Map() },
    time: 0,
  };
}

async function requestHealth(checkHealthAsync?: () => Promise<unknown>) {
  const fastify = Fastify();
  const world = createWorld(checkHealthAsync);
  registerHealthRoutes(
    fastify,
    world as never,
    { commitHash: "health-test" } as ServerConfig,
  );
  try {
    const response = await fastify.inject({ method: "GET", url: "/health" });
    return { response, world };
  } finally {
    await fastify.close();
  }
}

describe("database health policy", () => {
  it("always executes the real database probe and reports measured state", async () => {
    process.env.HEALTH_CHECK_DATABASE = "false";
    const checkHealthAsync = vi.fn(async () => ({
      healthy: true,
      latencyMs: 7,
      poolInfo: { totalCount: 3, idleCount: 2, waitingCount: 0 },
    }));

    const { response } = await requestHealth(checkHealthAsync);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      database: {
        healthy: true,
        status: "healthy",
        latencyMs: 7,
        poolInfo: { totalCount: 3, idleCount: 2, waitingCount: 0 },
      },
    });
    expect(checkHealthAsync).toHaveBeenCalledOnce();
  });

  it("fails closed by default when the checked database is unhealthy", async () => {
    const { response } = await requestHealth(async () => ({
      healthy: false,
      latencyMs: 11,
      error: "connection unavailable",
    }));

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "degraded",
      database: {
        healthy: false,
        status: "unhealthy",
        latencyMs: 11,
      },
    });
  });

  it("supports an explicit non-strict liveness response without hiding failure", async () => {
    process.env.HEALTH_CHECK_STRICT_DB = "false";
    const { response } = await requestHealth(async () => ({
      healthy: false,
      latencyMs: 4,
      error: "database offline",
    }));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "degraded",
      database: {
        healthy: false,
        status: "unhealthy",
        error: "database offline",
      },
    });
  });

  it("distinguishes an unavailable database system from a skipped check", async () => {
    const { response } = await requestHealth();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "degraded",
      database: {
        healthy: false,
        status: "unavailable",
        error: "Database system not available",
      },
    });
  });

  it("bounds a stalled probe and reports a timeout", async () => {
    const result = await checkDatabaseHealth(
      {
        checkHealthAsync: () => new Promise(() => {}),
      },
      5,
    );

    expect(result).toEqual({
      healthy: false,
      status: "timeout",
      latencyMs: 5,
      error: "Database health check timed out after 5ms",
    });
  });
});
