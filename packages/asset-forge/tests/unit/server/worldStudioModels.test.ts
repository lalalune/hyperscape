import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  CreateWorldProjectBody,
  UpdateWorldProjectBody,
  WorldProjectDetailResponse,
} from "../../../server/models/world-studio.models";

describe("CreateWorldProjectBody schema", () => {
  it("accepts valid world data with known fields", () => {
    const valid = {
      name: "Test World",
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      worldData: {
        mode: "editing",
        editing: { terrain: { worldSize: 10 } },
      },
    };
    expect(Value.Check(CreateWorldProjectBody, valid)).toBe(true);
  });

  it("accepts world data with additional properties", () => {
    const valid = {
      name: "Test World",
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      worldData: {
        mode: "editing",
        customField: { foo: "bar" },
      },
    };
    expect(Value.Check(CreateWorldProjectBody, valid)).toBe(true);
  });

  it("rejects missing name", () => {
    const invalid = {
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      worldData: { mode: "editing" },
    };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects empty name", () => {
    const invalid = {
      name: "",
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      worldData: { mode: "editing" },
    };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects invalid gameId format", () => {
    const invalid = {
      name: "Test",
      gameId: "not-a-uuid",
      worldData: { mode: "editing" },
    };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects non-object worldData", () => {
    const invalid = {
      name: "Test",
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      worldData: "not an object",
    };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects worldData as array", () => {
    const invalid = {
      name: "Test",
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      worldData: [1, 2, 3],
    };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects worldData as null", () => {
    const invalid = {
      name: "Test",
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      worldData: null,
    };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("accepts description within length limit", () => {
    const valid = {
      name: "Test",
      description: "A world for testing",
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      worldData: { mode: "creation" },
    };
    expect(Value.Check(CreateWorldProjectBody, valid)).toBe(true);
  });
});

describe("UpdateWorldProjectBody schema", () => {
  it("accepts partial update with name only", () => {
    const valid = { name: "New Name" };
    expect(Value.Check(UpdateWorldProjectBody, valid)).toBe(true);
  });

  it("accepts partial update with worldData only", () => {
    const valid = { worldData: { mode: "editing" } };
    expect(Value.Check(UpdateWorldProjectBody, valid)).toBe(true);
  });

  it("accepts empty object (no-op update)", () => {
    expect(Value.Check(UpdateWorldProjectBody, {})).toBe(true);
  });

  it("rejects non-object worldData in update", () => {
    const invalid = { worldData: 42 };
    expect(Value.Check(UpdateWorldProjectBody, invalid)).toBe(false);
  });
});

describe("WorldProjectDetailResponse schema", () => {
  const base = {
    id: "proj-1",
    teamId: "team-1",
    gameId: "game-1",
    name: "World",
    description: null,
    version: 1,
    createdBy: null,
    lockedBy: null,
    lockedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    // ── B0'.A typed project layers required by the schema ──
    schemaVersion: 1,
    templateId: null,
    plugins: [],
    assetPacks: [],
    config: null,
    worldContent: {},
  };

  it("accepts valid detail response with worldData object", () => {
    const valid = {
      ...base,
      worldData: { mode: "editing" },
      manifestSnapshot: null,
    };
    expect(Value.Check(WorldProjectDetailResponse, valid)).toBe(true);
  });

  it("accepts manifest snapshot with version", () => {
    const valid = {
      ...base,
      worldData: { mode: "editing" },
      manifestSnapshot: { version: 2, exportedAt: "2026-01-01T00:00:00Z" },
    };
    expect(Value.Check(WorldProjectDetailResponse, valid)).toBe(true);
  });

  it("accepts null manifestSnapshot", () => {
    const valid = {
      ...base,
      worldData: {},
      manifestSnapshot: null,
    };
    expect(Value.Check(WorldProjectDetailResponse, valid)).toBe(true);
  });
});
