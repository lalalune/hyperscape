import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MappingRow = {
  accountId: string;
  agentId: string;
  agentName: string;
  characterId: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const { agentMappingsTable, charactersTable, usersTable } = vi.hoisted(() => ({
  agentMappingsTable: {
    __table: "agentMappings",
    accountId: "accountId",
    agentId: "agentId",
    agentName: "agentName",
    characterId: "characterId",
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
}));

vi.mock("../../database/schema.js", () => ({
  agentMappings: agentMappingsTable,
  characters: charactersTable,
  users: usersTable,
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (column: string, value: unknown) => ({ column, value }),
  };
});

vi.mock("../../eliza/index.js", () => ({
  getAgentManager: () => null,
  getRunningAgents: () => new Map(),
}));

import { registerAgentRoutes } from "../routes/agent-routes";

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
  const fastify = {
    delete(path: string, handler: Function) {
      routes.set(`DELETE ${path}`, handler);
      return this;
    },
    get(path: string, handler: Function) {
      routes.set(`GET ${path}`, handler);
      return this;
    },
    post(path: string, handler: Function) {
      routes.set(`POST ${path}`, handler);
      return this;
    },
    patch(path: string, handler: Function) {
      routes.set(`PATCH ${path}`, handler);
      return this;
    },
    put(path: string, handler: Function) {
      routes.set(`PUT ${path}`, handler);
      return this;
    },
  };

  return {
    fastify: fastify as never,
    routes,
  };
}

function createMockDatabase(initialMappings: MappingRow[]) {
  const state = {
    mappings: [...initialMappings],
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
      from: (table: { __table: string }) => ({
        where: async (condition: {
          column: keyof MappingRow;
          value: unknown;
        }) => {
          if (table.__table === "agentMappings") {
            return state.mappings.filter(
              (mapping) => mapping[condition.column] === condition.value,
            );
          }
          return [];
        },
      }),
    }),
  };

  return { db, state };
}

function setupRoutes(initialMappings: MappingRow[]) {
  const { fastify, routes } = createFastifyRecorder();
  const { db, state } = createMockDatabase(initialMappings);
  const world = {
    getSystem: (name: string) => (name === "database" ? { db } : undefined),
  };

  registerAgentRoutes(fastify, world as never);

  return {
    deleteMapping: routes.get("DELETE /api/agents/mappings/:agentId")!,
    getMapping: routes.get("GET /api/agents/mapping/:agentId")!,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      { params: { accountId: "account-old" } } as never,
      firstListReply as never,
    );
    expect(firstListReply.payload).toMatchObject({
      agentIds: ["agent-1", "character-1"],
      count: 2,
      success: true,
    });

    const saveReply = createReplyRecorder();
    await saveMapping(
      {
        body: {
          agentId: "agent-1",
          accountId: "account-new",
          characterId: "character-2",
          agentName: "Beta",
        },
      } as never,
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
      { params: { accountId: "account-old" } } as never,
      oldAccountReply as never,
    );
    expect(oldAccountReply.payload).toMatchObject({
      agentIds: [],
      count: 0,
      success: true,
    });

    const newAccountReply = createReplyRecorder();
    await listMappings(
      { params: { accountId: "account-new" } } as never,
      newAccountReply as never,
    );
    expect(newAccountReply.payload).toMatchObject({
      agentIds: ["agent-1", "character-2"],
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
      { params: { accountId: "account-old" } } as never,
      listReply as never,
    );
    expect(listReply.payload).toMatchObject({
      agentIds: ["agent-1", "character-1"],
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
      { params: { agentId: "agent-1" } } as never,
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
      { params: { accountId: "account-old" } } as never,
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
      {
        body: {
          agentId: "agent-2",
          accountId: "account-new",
          characterId: "character-2",
          agentName: "Gamma",
        },
      } as never,
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
});
