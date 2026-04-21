import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MappingRow = {
  accountId: string;
  agentId: string;
  agentName: string;
  characterId: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type ThoughtRow = {
  characterId: string;
  content: string;
  decisionPath?: string | null;
  timestamp: number;
  type: string;
};

const {
  agentMappingsTable,
  agentThoughtsTable,
  charactersTable,
  serverNetworkState,
  usersTable,
} = vi.hoisted(() => ({
  agentMappingsTable: {
    __table: "agentMappings",
    accountId: "accountId",
    agentId: "agentId",
    agentName: "agentName",
    characterId: "characterId",
  },
  agentThoughtsTable: {
    __table: "agentThoughts",
    characterId: "characterId",
    content: "content",
    decisionPath: "decisionPath",
    timestamp: "timestamp",
    type: "type",
  },
  usersTable: {
    __table: "users",
    id: "id",
  },
  charactersTable: {
    __table: "characters",
    accountId: "accountId",
    id: "id",
  },
  serverNetworkState: {
    agentThoughts: new Map<string, ThoughtRow[]>(),
  },
}));

vi.mock("../../database/schema.js", () => ({
  agentMappings: agentMappingsTable,
  agentThoughts: agentThoughtsTable,
  characters: charactersTable,
  users: usersTable,
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: (...conditions: unknown[]) => ({ op: "and", conditions }),
    desc: (column: string) => ({ direction: "desc", column }),
    eq: (column: string, value: unknown) => ({ column, value }),
    gt: (column: string, value: unknown) => ({ column, value, op: "gt" }),
  };
});

vi.mock("../../eliza/index.js", () => ({
  getAgentManager: () => null,
  getRunningAgents: () => new Map(),
}));

vi.mock("../../systems/ServerNetwork/index.js", () => ({
  ServerNetwork: serverNetworkState,
}));

import { registerAgentRoutes } from "../routes/agent-routes";
import { createJWT } from "../../shared/utils";

async function withAuth<T extends Record<string, unknown>>(
  userId: string,
  request: T,
): Promise<T & { headers: { authorization: string } }> {
  return {
    ...request,
    headers: {
      authorization: `Bearer ${await createJWT({ userId })}`,
    },
  };
}

function createReplyRecorder() {
  return {
    payload: undefined as unknown,
    statusCode: 200,
    send(payload: unknown) {
      this.payload = payload;
      return payload;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
}

function createFastifyRecorder() {
  const routes = new Map<string, Function>();
  const pickHandler = (args: unknown[]): Function => {
    const handler = args[args.length - 1];
    if (typeof handler !== "function") {
      throw new Error("Expected route handler");
    }
    return handler;
  };
  const fastify = {
    delete(path: string, ...args: unknown[]) {
      routes.set(`DELETE ${path}`, pickHandler(args));
      return this;
    },
    get(path: string, ...args: unknown[]) {
      routes.set(`GET ${path}`, pickHandler(args));
      return this;
    },
    post(path: string, ...args: unknown[]) {
      routes.set(`POST ${path}`, pickHandler(args));
      return this;
    },
    patch(path: string, ...args: unknown[]) {
      routes.set(`PATCH ${path}`, pickHandler(args));
      return this;
    },
    put(path: string, ...args: unknown[]) {
      routes.set(`PUT ${path}`, pickHandler(args));
      return this;
    },
    rateLimit: () => async () => {},
  };

  return {
    fastify: fastify as never,
    routes,
  };
}

function createMockDatabase(
  initialMappings: MappingRow[],
  initialThoughts: ThoughtRow[] = [],
) {
  const state = {
    mappings: [...initialMappings],
    thoughts: [...initialThoughts],
  };

  const db = {
    delete: (table: { __table: string }) => ({
      where: async (condition: {
        column: keyof MappingRow;
        value: unknown;
      }) => {
        if (table.__table === "agentMappings") {
          state.mappings = state.mappings.filter(
            (mapping) => mapping[condition.column] !== condition.value,
          );
        }
        return undefined;
      },
    }),
    insert: (table: { __table: string }) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: async (config: {
          set: Record<string, unknown>;
          target: keyof MappingRow;
        }) => {
          if (table.__table !== "agentMappings") {
            return undefined;
          }

          const nextMapping = values as MappingRow;
          const existingIndex = state.mappings.findIndex(
            (mapping) => mapping[config.target] === nextMapping[config.target],
          );

          if (existingIndex >= 0) {
            state.mappings[existingIndex] = {
              ...state.mappings[existingIndex],
              ...(config.set as Partial<MappingRow>),
            };
            return undefined;
          }

          state.mappings.push(nextMapping);
          return undefined;
        },
      }),
    }),
    query: {
      characters: {
        findFirst: async () => null,
      },
    },
    select: () => ({
      from: (table: { __table: string }) => {
        const applyCondition = (
          row: MappingRow | ThoughtRow,
          condition: {
            column?: string;
            conditions?: Array<{
              column?: string;
              op?: string;
              value?: unknown;
            }>;
            op?: string;
            value?: unknown;
          },
        ): boolean => {
          if (condition.op === "and" && condition.conditions) {
            return condition.conditions.every((entry) =>
              applyCondition(row, entry),
            );
          }
          if (!condition.column) {
            return true;
          }
          const value = (row as Record<string, unknown>)[condition.column];
          if (condition.op === "gt") {
            return Number(value) > Number(condition.value);
          }
          return value === condition.value;
        };
        const filterRows = (condition: {
          column?: string;
          conditions?: Array<{ column?: string; op?: string; value?: unknown }>;
          op?: string;
          value?: unknown;
        }) => {
          if (table.__table === "agentMappings") {
            return state.mappings.filter((mapping) =>
              applyCondition(mapping, condition),
            );
          }
          if (table.__table === "agentThoughts") {
            return state.thoughts.filter((thought) =>
              applyCondition(thought, condition),
            );
          }
          return [] as Array<MappingRow | ThoughtRow>;
        };
        return {
          where: (condition: {
            column?: string;
            conditions?: Array<{
              column?: string;
              op?: string;
              value?: unknown;
            }>;
            op?: string;
            value?: unknown;
          }) => {
            const rows = filterRows(condition);
            return {
              then: (
                onfulfilled: (value: Array<MappingRow | ThoughtRow>) => unknown,
              ) => Promise.resolve(onfulfilled(rows)),
              orderBy: (order?: {
                column?: string;
                direction?: "desc" | "asc";
              }) => {
                const sorted = [...rows];
                if (order?.column) {
                  sorted.sort((left, right) => {
                    const leftValue = (left as Record<string, unknown>)[
                      order.column!
                    ];
                    const rightValue = (right as Record<string, unknown>)[
                      order.column!
                    ];
                    const direction = order.direction === "desc" ? -1 : 1;
                    if (leftValue === rightValue) return 0;
                    return leftValue! > rightValue! ? direction : -direction;
                  });
                }
                return {
                  limit: async (count: number) => sorted.slice(0, count),
                };
              },
            };
          },
        };
      },
    }),
  };

  return { db, state };
}

function setupRoutes(
  initialMappings: MappingRow[],
  initialThoughts: ThoughtRow[] = [],
) {
  const { fastify, routes } = createFastifyRecorder();
  const { db, state } = createMockDatabase(initialMappings, initialThoughts);
  const world = {
    getSystem: (name: string) => (name === "database" ? { db } : undefined),
  };

  registerAgentRoutes(fastify, world as never);

  return {
    deleteMapping: routes.get("DELETE /api/agents/mappings/:agentId")!,
    getMapping: routes.get("GET /api/agents/mapping/:agentId")!,
    getThoughts: routes.get("GET /api/agents/:agentId/thoughts")!,
    listMappings: routes.get("GET /api/agents/mappings/:accountId")!,
    saveMapping: routes.get("POST /api/agents/mappings")!,
    state,
  };
}

describe("agent route mapping cache", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    serverNetworkState.agentThoughts.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires authentication for account-scoped mapping routes", async () => {
    const { deleteMapping, listMappings, saveMapping } = setupRoutes([
      {
        agentId: "agent-1",
        accountId: "account-old",
        characterId: "character-1",
        agentName: "Alpha",
      },
    ]);

    const listReply = createReplyRecorder();
    await listMappings(
      { params: { accountId: "account-old" } } as never,
      listReply as never,
    );
    expect(listReply.statusCode).toBe(401);

    const saveReply = createReplyRecorder();
    await saveMapping(
      {
        body: {
          agentId: "agent-1",
          accountId: "account-old",
          characterId: "character-1",
          agentName: "Alpha",
        },
      } as never,
      saveReply as never,
    );
    expect(saveReply.statusCode).toBe(401);

    const deleteReply = createReplyRecorder();
    await deleteMapping(
      { params: { agentId: "agent-1" } } as never,
      deleteReply as never,
    );
    expect(deleteReply.statusCode).toBe(401);
  });

  it("rejects cross-account mapping access", async () => {
    const { deleteMapping, listMappings } = setupRoutes([
      {
        agentId: "agent-1",
        accountId: "account-owner",
        characterId: "character-1",
        agentName: "Alpha",
      },
    ]);

    const listReply = createReplyRecorder();
    await listMappings(
      (await withAuth("account-other", {
        params: { accountId: "account-owner" },
      })) as never,
      listReply as never,
    );
    expect(listReply.statusCode).toBe(403);

    const deleteReply = createReplyRecorder();
    await deleteMapping(
      (await withAuth("account-other", {
        params: { agentId: "agent-1" },
      })) as never,
      deleteReply as never,
    );
    expect(deleteReply.statusCode).toBe(403);
  });

  it("invalidates old and new account mapping lists when ownership changes", async () => {
    const { getMapping, listMappings, saveMapping, state } = setupRoutes([
      {
        agentId: "agent-1",
        accountId: "account-old",
        characterId: "character-1",
        agentName: "Alpha",
      },
    ]);

    const firstListReply = createReplyRecorder();
    await listMappings(
      (await withAuth("account-old", {
        params: { accountId: "account-old" },
      })) as never,
      firstListReply as never,
    );
    expect(firstListReply.payload).toMatchObject({
      agentIds: expect.arrayContaining(["agent-1", "character-1"]),
      count: 2,
      success: true,
    });

    const saveReply = createReplyRecorder();
    await saveMapping(
      (await withAuth("account-new", {
        body: {
          agentId: "agent-1",
          accountId: "account-new",
          characterId: "character-2",
          agentName: "Beta",
        },
      })) as never,
      saveReply as never,
    );
    expect(saveReply.payload).toMatchObject({ success: true });
    expect(state.mappings).toEqual([
      expect.objectContaining({
        agentId: "agent-1",
        accountId: "account-new",
        characterId: "character-2",
        agentName: "Beta",
      }),
    ]);

    const oldAccountReply = createReplyRecorder();
    await listMappings(
      (await withAuth("account-old", {
        params: { accountId: "account-old" },
      })) as never,
      oldAccountReply as never,
    );
    expect(oldAccountReply.payload).toMatchObject({
      agentIds: [],
      count: 0,
      success: true,
    });

    const newAccountReply = createReplyRecorder();
    await listMappings(
      (await withAuth("account-new", {
        params: { accountId: "account-new" },
      })) as never,
      newAccountReply as never,
    );
    expect(newAccountReply.payload).toMatchObject({
      agentIds: expect.arrayContaining(["agent-1", "character-2"]),
      count: 2,
      success: true,
    });

    const mappingReply = createReplyRecorder();
    await getMapping(
      { params: { agentId: "agent-1" } } as never,
      mappingReply as never,
    );
    expect(mappingReply.payload).toMatchObject({
      accountId: "account-new",
      agentName: "Beta",
      characterId: "character-2",
      success: true,
    });
  });

  it("invalidates both id and account caches when a mapping is deleted", async () => {
    const { deleteMapping, getMapping, listMappings } = setupRoutes([
      {
        agentId: "agent-1",
        accountId: "account-old",
        characterId: "character-1",
        agentName: "Alpha",
      },
    ]);

    const listReply = createReplyRecorder();
    await listMappings(
      (await withAuth("account-old", {
        params: { accountId: "account-old" },
      })) as never,
      listReply as never,
    );
    expect(listReply.payload).toMatchObject({
      agentIds: expect.arrayContaining(["agent-1", "character-1"]),
      count: 2,
      success: true,
    });

    const mappingReply = createReplyRecorder();
    await getMapping(
      { params: { agentId: "agent-1" } } as never,
      mappingReply as never,
    );
    expect(mappingReply.payload).toMatchObject({
      agentId: "agent-1",
      success: true,
    });

    const deleteReply = createReplyRecorder();
    await deleteMapping(
      (await withAuth("account-old", {
        params: { agentId: "agent-1" },
      })) as never,
      deleteReply as never,
    );
    expect(deleteReply.payload).toMatchObject({ success: true });

    const deletedMappingReply = createReplyRecorder();
    await getMapping(
      { params: { agentId: "agent-1" } } as never,
      deletedMappingReply as never,
    );
    expect(deletedMappingReply.statusCode).toBe(404);
    expect(deletedMappingReply.payload).toMatchObject({
      error: "Agent mapping not found",
      success: false,
    });

    const deletedListReply = createReplyRecorder();
    await listMappings(
      (await withAuth("account-old", {
        params: { accountId: "account-old" },
      })) as never,
      deletedListReply as never,
    );
    expect(deletedListReply.payload).toMatchObject({
      agentIds: [],
      count: 0,
      success: true,
    });
  });

  it("clears negative mapping cache entries when a mapping is later created", async () => {
    const { getMapping, saveMapping } = setupRoutes([]);

    const missingReply = createReplyRecorder();
    await getMapping(
      { params: { agentId: "agent-2" } } as never,
      missingReply as never,
    );
    expect(missingReply.statusCode).toBe(404);

    const saveReply = createReplyRecorder();
    await saveMapping(
      (await withAuth("account-new", {
        body: {
          agentId: "agent-2",
          accountId: "account-new",
          characterId: "character-2",
          agentName: "Gamma",
        },
      })) as never,
      saveReply as never,
    );
    expect(saveReply.payload).toMatchObject({ success: true });

    const mappingReply = createReplyRecorder();
    await getMapping(
      { params: { agentId: "agent-2" } } as never,
      mappingReply as never,
    );
    expect(mappingReply.statusCode).toBe(200);
    expect(mappingReply.payload).toMatchObject({
      accountId: "account-new",
      agentId: "agent-2",
      agentName: "Gamma",
      characterId: "character-2",
      success: true,
    });
  });

  it("defaults invalid thoughts limit before cold-start DB hydrate", async () => {
    const { getThoughts } = setupRoutes(
      [
        {
          agentId: "agent-1",
          accountId: "account-1",
          characterId: "character-1",
          agentName: "Alpha",
        },
      ],
      [
        {
          characterId: "character-1",
          content: "fresh thought",
          decisionPath: null,
          timestamp: 200,
          type: "reasoning",
        },
        {
          characterId: "character-1",
          content: "older thought",
          decisionPath: null,
          timestamp: 100,
          type: "reasoning",
        },
      ],
    );

    const reply = createReplyRecorder();
    await getThoughts(
      {
        params: { agentId: "agent-1" },
        query: { limit: "foo" },
      } as never,
      reply as never,
    );

    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toMatchObject({
      success: true,
      count: 2,
      thoughts: [
        expect.objectContaining({ content: "fresh thought", timestamp: 200 }),
        expect.objectContaining({ content: "older thought", timestamp: 100 }),
      ],
    });
  });
});
