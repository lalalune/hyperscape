import * as ElizaCore from "@elizaos/core";
import type { Character, IDatabaseAdapter } from "@elizaos/core";

export type InMemoryDatabaseAdapterLike = IDatabaseAdapter<
  Record<string, never>
> & {
  log?: (params: unknown) => Promise<void>;
  logs?: unknown[];
};

type InMemoryDatabaseAdapterCtor = new () => InMemoryDatabaseAdapterLike;

export const InMemoryDatabaseAdapter = (
  ElizaCore as typeof ElizaCore & {
    InMemoryDatabaseAdapter: InMemoryDatabaseAdapterCtor;
  }
).InMemoryDatabaseAdapter;

export type CharacterWithModelProvider = Character & {
  modelProvider?: string;
};
