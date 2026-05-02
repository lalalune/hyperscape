/**
 * R2.P12 of `PLAN_HYPERIA_DECOUPLING.md` — engine `Player` type
 * decoupling. The engine carries `externalAccountId` (opaque
 * external-account identifier set by the host's auth bridge);
 * `hyperiaPlayerId` stays as a `@deprecated` alias during the
 * migration window so existing plugin code keeps compiling.
 * Both fields hold the same value when constructed by the
 * factories.
 *
 * Asserts the contract:
 *   - Player factories populate both fields identically
 *   - isPlayer accepts an object with either field present
 *     (so future code that drops the alias still passes)
 *   - isPlayer rejects an object missing both fields
 */
import { describe, it, expect } from "vitest";
import { PlayerMigration, isPlayer } from "../player-types";

describe("R2.P12 — Player externalAccountId / hyperiaPlayerId migration", () => {
  it("createNewPlayer populates both externalAccountId and hyperiaPlayerId", () => {
    const p = PlayerMigration.createNewPlayer("p-123", "ext-acct-abc", "Alice");
    expect(p.externalAccountId).toBe("ext-acct-abc");
    expect(p.hyperiaPlayerId).toBe("ext-acct-abc");
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

  it("isPlayer accepts an object with externalAccountId only (no hyperiaPlayerId)", () => {
    const candidate = { ...makeFullShape(), externalAccountId: "ext-1" };
    expect(isPlayer(candidate)).toBe(true);
  });

  it("isPlayer accepts a legacy object with hyperiaPlayerId only (no externalAccountId)", () => {
    const candidate = { ...makeFullShape(), hyperiaPlayerId: "ext-1" };
    expect(isPlayer(candidate)).toBe(true);
  });

  it("isPlayer rejects an object missing both identity fields", () => {
    const candidate = makeFullShape();
    expect(isPlayer(candidate)).toBe(false);
  });

  it("isPlayer rejects an object where the identity field is the wrong type", () => {
    const candidate = { ...makeFullShape(), externalAccountId: 12345 };
    expect(isPlayer(candidate)).toBe(false);
  });

  it("Player produced by factories satisfies isPlayer", () => {
    const p = PlayerMigration.createNewPlayer("p-1", "ext-1", "Frank");
    expect(isPlayer(p)).toBe(true);
  });
});
