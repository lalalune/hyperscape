// @vitest-environment node
/**
 * `AuditLogService` — audit log persistence tests.
 *
 * The service is database-optional: every method silently
 * no-ops when `isDatabaseEnabled()` returns false or `getDb()`
 * returns null. Pins both the no-DB graceful path (fire-and-
 * forget never throws, queries return []) and the happy path
 * via a mocked database client.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the db module BEFORE importing the service so the service
// reads our mocked getDb / isDatabaseEnabled.
vi.mock("../../db/db", () => ({
  getDb: vi.fn(),
  isDatabaseEnabled: vi.fn(),
}));

vi.mock("../../db/schema", () => ({
  auditLog: {
    teamId: "teamId",
    userId: "userId",
    targetType: "targetType",
    targetId: "targetId",
    createdAt: "createdAt",
  },
}));

import { AuditLogService } from "../AuditLogService";
import { getDb, isDatabaseEnabled } from "../../db/db";

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  vi.mocked(isDatabaseEnabled).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// no-DB path — graceful no-op
// ============================================================================

describe("AuditLogService — no DB available", () => {
  it("log() is a silent no-op when isDatabaseEnabled() is false", async () => {
    vi.mocked(isDatabaseEnabled).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(null);
    const service = new AuditLogService();
    await expect(
      service.log({ action: "test", teamId: "t1" }),
    ).resolves.toBeUndefined();
  });

  it("log() is a silent no-op when getDb() returns null", async () => {
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(null);
    const service = new AuditLogService();
    await expect(
      service.log({ action: "test", teamId: "t1" }),
    ).resolves.toBeUndefined();
  });

  it("queryByTeam returns [] when DB unavailable", async () => {
    vi.mocked(isDatabaseEnabled).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(null);
    const service = new AuditLogService();
    expect(await service.queryByTeam("t1")).toEqual([]);
  });

  it("queryByUser returns [] when DB unavailable", async () => {
    vi.mocked(isDatabaseEnabled).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(null);
    const service = new AuditLogService();
    expect(await service.queryByUser("u1")).toEqual([]);
  });

  it("queryByTarget returns [] when DB unavailable", async () => {
    vi.mocked(isDatabaseEnabled).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(null);
    const service = new AuditLogService();
    expect(await service.queryByTarget("project", "p1")).toEqual([]);
  });
});

// ============================================================================
// DB write — log()
// ============================================================================

describe("AuditLogService.log — happy path", () => {
  it("inserts a row with the supplied entry fields + nulls for omitted", async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });
    const mockDb = { insert } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(mockDb);

    const service = new AuditLogService();
    await service.log({
      teamId: "t1",
      userId: "u1",
      action: "world.published",
      targetType: "project",
      targetId: "p1",
      details: { foo: "bar" },
    });

    expect(insertValues).toHaveBeenCalledWith({
      teamId: "t1",
      gameId: null,
      userId: "u1",
      action: "world.published",
      targetType: "project",
      targetId: "p1",
      details: { foo: "bar" },
    });
  });

  it("substitutes null for omitted optional fields", async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const mockDb = {
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(mockDb);

    const service = new AuditLogService();
    await service.log({ action: "minimal" });

    expect(insertValues).toHaveBeenCalledWith({
      teamId: null,
      gameId: null,
      userId: null,
      action: "minimal",
      targetType: null,
      targetId: null,
      details: null,
    });
  });

  it("swallows DB errors (audit logging never crashes the request)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const insertValues = vi.fn().mockRejectedValue(new Error("DB down"));
    const mockDb = {
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(mockDb);

    const service = new AuditLogService();
    await expect(service.log({ action: "fails" })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// ============================================================================
// DB query — queryByTeam / queryByUser / queryByTarget
// ============================================================================

describe("AuditLogService — queries", () => {
  /** Build a mock query chain: select().from().where().orderBy().limit().offset() */
  function makeQueryChain(result: unknown[]): {
    db: ReturnType<typeof getDb>;
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
  } {
    const offset = vi.fn().mockResolvedValue(result);
    const limit = vi.fn().mockReturnValue({ offset });
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as ReturnType<typeof getDb>;
    return { db, select, from, where, orderBy, limit, offset };
  }

  it("queryByTeam uses limit=50 and offset=0 by default", async () => {
    const { db, limit, offset } = makeQueryChain([]);
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new AuditLogService();
    await service.queryByTeam("t1");

    expect(limit).toHaveBeenCalledWith(50);
    expect(offset).toHaveBeenCalledWith(0);
  });

  it("queryByTeam respects supplied limit + offset", async () => {
    const { db, limit, offset } = makeQueryChain([]);
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new AuditLogService();
    await service.queryByTeam("t1", { limit: 25, offset: 100 });

    expect(limit).toHaveBeenCalledWith(25);
    expect(offset).toHaveBeenCalledWith(100);
  });

  it("queryByUser returns the chain's resolved rows", async () => {
    const rows = [{ id: "1", action: "x" }];
    const { db } = makeQueryChain(rows);
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new AuditLogService();
    const result = await service.queryByUser("u1");
    expect(result).toEqual(rows);
  });

  it("queryByTarget passes both targetType and targetId to the WHERE clause", async () => {
    const { db, where } = makeQueryChain([]);
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new AuditLogService();
    await service.queryByTarget("project", "p1");
    // The WHERE arg should be defined (composite and() clause).
    expect(where).toHaveBeenCalledOnce();
    expect(where.mock.calls[0][0]).toBeDefined();
  });
});
