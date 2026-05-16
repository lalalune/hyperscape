// @vitest-environment node
/**
 * `GameModuleService` — CRUD persistence tests.
 *
 * Mirrors the AuditLogService test pattern: mock the db module
 * to verify both the no-DB graceful path and the happy-path
 * query construction.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/db", () => ({
  getDb: vi.fn(),
  isDatabaseEnabled: vi.fn(),
}));

vi.mock("../../db/schema", () => ({
  gameModules: {
    id: "id",
    teamId: "teamId",
    slug: "slug",
    name: "name",
    version: "version",
    moduleData: "moduleData",
    updatedAt: "updatedAt",
  },
}));

import { GameModuleService } from "../GameModuleService";
import { getDb, isDatabaseEnabled } from "../../db/db";

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  vi.mocked(isDatabaseEnabled).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// no-DB path
// ============================================================================

describe("GameModuleService — no DB available", () => {
  beforeEach(() => {
    vi.mocked(isDatabaseEnabled).mockReturnValue(false);
    vi.mocked(getDb).mockReturnValue(null);
  });

  it("listForTeam returns []", async () => {
    const service = new GameModuleService();
    expect(await service.listForTeam("t1")).toEqual([]);
  });

  it("getById returns null", async () => {
    const service = new GameModuleService();
    expect(await service.getById("m1")).toBeNull();
  });

  it("slugExists returns false", async () => {
    const service = new GameModuleService();
    expect(await service.slugExists("t1", "slug")).toBe(false);
  });

  it("create returns null", async () => {
    const service = new GameModuleService();
    expect(
      await service.create({
        teamId: "t1",
        slug: "test",
        name: "Test",
      } as never),
    ).toBeNull();
  });

  it("update returns null", async () => {
    const service = new GameModuleService();
    expect(await service.update("m1", { name: "New" })).toBeNull();
  });

  it("delete returns false", async () => {
    const service = new GameModuleService();
    expect(await service.delete("m1")).toBe(false);
  });
});

// ============================================================================
// listForTeam / getById
// ============================================================================

describe("GameModuleService — read queries", () => {
  it("listForTeam: select().from().where(eq(teamId, ...))", async () => {
    const rows = [{ id: "m1", teamId: "t1" }];
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    const result = await service.listForTeam("t1");

    expect(result).toBe(rows);
    expect(where).toHaveBeenCalledOnce();
  });

  it("getById: select().from().where().limit(1) returns the first row or null", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "m1" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    const result = await service.getById("m1");

    expect(result).toEqual({ id: "m1" });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("getById returns null when no rows match", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    expect(await service.getById("missing")).toBeNull();
  });
});

// ============================================================================
// slugExists
// ============================================================================

describe("GameModuleService.slugExists", () => {
  it("returns true when at least one row matches teamId + slug", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "m1" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    expect(await service.slugExists("t1", "existing")).toBe(true);
  });

  it("returns false when no rows match", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    expect(await service.slugExists("t1", "missing")).toBe(false);
  });
});

// ============================================================================
// create / update / delete
// ============================================================================

describe("GameModuleService.create", () => {
  it("returns the inserted row from db.insert().values().returning()", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "new" }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    const result = await service.create({
      teamId: "t1",
      slug: "new-slug",
      name: "New",
    } as never);
    expect(result).toEqual({ id: "new" });
    expect(values).toHaveBeenCalledWith({
      teamId: "t1",
      slug: "new-slug",
      name: "New",
    });
  });
});

describe("GameModuleService.update", () => {
  it("sets updatedAt + each supplied field", async () => {
    const returning = vi
      .fn()
      .mockResolvedValue([{ id: "m1", name: "Updated" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    const result = await service.update("m1", { name: "Updated" });

    expect(result).toEqual({ id: "m1", name: "Updated" });
    const setArg = set.mock.calls[0][0];
    expect(setArg.name).toBe("Updated");
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });

  it("omitted fields are not present in the SET clause (preserves their existing values)", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "m1" }]);
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning }),
    });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    await service.update("m1", { name: "OnlyName" });

    const setArg = set.mock.calls[0][0];
    expect(setArg.name).toBe("OnlyName");
    // slug / version / moduleData should NOT appear in the SET object.
    expect(setArg.slug).toBeUndefined();
    expect(setArg.version).toBeUndefined();
    expect(setArg.moduleData).toBeUndefined();
  });

  it("returns null when no row was updated", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning }),
    });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    expect(await service.update("ghost", { name: "x" })).toBeNull();
  });
});

describe("GameModuleService.delete", () => {
  it("returns true when at least one row was deleted", async () => {
    const where = vi.fn().mockResolvedValue({ rowCount: 1 });
    const del = vi.fn().mockReturnValue({ where });
    const db = { delete: del } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    expect(await service.delete("m1")).toBe(true);
  });

  it("returns false when rowCount is 0 (nothing matched the id)", async () => {
    const where = vi.fn().mockResolvedValue({ rowCount: 0 });
    const del = vi.fn().mockReturnValue({ where });
    const db = { delete: del } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    expect(await service.delete("missing")).toBe(false);
  });

  it("returns false when rowCount is undefined (driver doesn't report)", async () => {
    const where = vi.fn().mockResolvedValue({});
    const del = vi.fn().mockReturnValue({ where });
    const db = { delete: del } as unknown as ReturnType<typeof getDb>;
    vi.mocked(isDatabaseEnabled).mockReturnValue(true);
    vi.mocked(getDb).mockReturnValue(db);

    const service = new GameModuleService();
    expect(await service.delete("m1")).toBe(false);
  });
});
