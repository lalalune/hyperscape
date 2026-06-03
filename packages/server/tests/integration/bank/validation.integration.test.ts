/**
 * Bank Validation Integration Tests
 */

import { describe, expect, it } from "vitest";
import { SessionType } from "@hyperforge/shared";
import { RateLimitService } from "../../../src/systems/ServerNetwork/services";
import { validateTransactionRequest } from "../../../src/systems/ServerNetwork/handlers/common";
import {
  createTestDatabase,
  createTestPlayer,
  createTestSocket,
  createTestWorld,
} from "./helpers";

describe("validateTransactionRequest", () => {
  it("fails when socket has no player", async () => {
    const db = createTestDatabase();
    const world = createTestWorld(
      db,
      {},
      [],
      "player-test-123",
      "bank-entity-1",
    );
    const socket = createTestSocket();
    const limiter = new RateLimitService();

    const result = validateTransactionRequest(
      socket as never,
      world as never,
      SessionType.BANK,
      limiter,
    );

    expect(result.success).toBe(false);
    await db.cleanup();
  });

  it("fails when player is too far from bank", async () => {
    const db = createTestDatabase();
    const world = createTestWorld(
      db,
      {},
      [],
      "player-test-123",
      "bank-entity-1",
    );
    const socket = createTestSocket();
    socket.player = createTestPlayer({
      id: "player-test-123",
      position: { x: 999, y: 0, z: 999 },
    });
    const limiter = new RateLimitService();

    const result = validateTransactionRequest(
      socket as never,
      world as never,
      SessionType.BANK,
      limiter,
    );

    expect(result.success).toBe(false);
    const toast = socket.sent.find((msg) => msg.packet === "showToast");
    expect(toast?.data).toEqual({
      message: "You are too far from the bank",
      type: "error",
    });
    await db.cleanup();
  });

  it("succeeds when player is in range and db available", async () => {
    const db = createTestDatabase();
    const world = createTestWorld(
      db,
      {},
      [],
      "player-test-123",
      "bank-entity-1",
    );
    const socket = createTestSocket();
    socket.player = createTestPlayer({ id: "player-test-123" });
    const limiter = new RateLimitService();

    const result = validateTransactionRequest(
      socket as never,
      world as never,
      SessionType.BANK,
      limiter,
    );

    expect(result.success).toBe(true);
    await db.cleanup();
  });
});
