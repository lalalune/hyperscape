/**
 * R2.P12 of `PLAN_HYPERIA_DECOUPLING.md` — engine `Player` type
 * decoupling. The engine carries `externalAccountId` (opaque
 * external-account identifier set by the host's auth bridge);
 * the legacy `hyperiaPlayerId` alias was dropped from the
 * engine type in Phase 3.2 deeper of `PLAN_AAA_MASTER_AUDIT.md`.
 * Hyperia plugin classes (`PlayerLocal`, `PlayerEntity` in
 * `packages/hyperscape-plugin`) keep their own
 * `hyperiaPlayerId` field on their own classes — that's
 * plugin-private and not tied to the engine type.
 *
 * Asserts the contract:
 *   - Player factories populate `externalAccountId`
 *   - isPlayer accepts an object with `externalAccountId`
 *   - isPlayer rejects an object without it
 *   - isPlayer rejects an object that supplies only the legacy
 *     `hyperiaPlayerId` field (legacy clause was removed)
 */
import { describe, it, expect } from "vitest";
import { PlayerMigration, isPlayer } from "../player-types";

describe("R2.P12 — Player externalAccountId (legacy hyperiaPlayerId removed)", () => {
  it("createNewPlayer populates externalAccountId", () => {
    const p = PlayerMigration.createNewPlayer("p-123", "ext-acct-abc", "Alice");
    expect(p.externalAccountId).toBe("ext-acct-abc");
    // Legacy hyperiaPlayerId field no longer exists on the engine type.
    expect((p as Record<string, unknown>).hyperiaPlayerId).toBeUndefined();
  });

  // Build a complete shape isPlayer will accept — only the
  // identity-field strategy varies between tests.
  function makeFullShape(): Record<string, unknown> {
    return {
      id: "p-1",
      name: "Test Player",
      health: { current: 100, max: 100 },
      position: { x: 0, y: 0, z: 0 },
      skills: {},
      equipment: {},
      combat: {},
    };
  }

  it("isPlayer accepts an object with externalAccountId", () => {
    const candidate = { ...makeFullShape(), externalAccountId: "ext-1" };
    expect(isPlayer(candidate)).toBe(true);
  });

  it("isPlayer REJECTS a legacy object with hyperiaPlayerId only (legacy clause removed)", () => {
    const candidate = { ...makeFullShape(), hyperiaPlayerId: "ext-1" };
    expect(isPlayer(candidate)).toBe(false);
  });

  it("isPlayer rejects an object missing externalAccountId", () => {
    const candidate = makeFullShape();
    expect(isPlayer(candidate)).toBe(false);
  });

  it("isPlayer rejects an object where externalAccountId is the wrong type", () => {
    const candidate = { ...makeFullShape(), externalAccountId: 12345 };
    expect(isPlayer(candidate)).toBe(false);
  });

  it("Player produced by factories satisfies isPlayer", () => {
    const p = PlayerMigration.createNewPlayer("p-1", "ext-1", "Frank");
    expect(isPlayer(p)).toBe(true);
  });
});
