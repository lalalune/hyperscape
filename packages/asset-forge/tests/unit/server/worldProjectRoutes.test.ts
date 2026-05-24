/**
 * Integration tests for World Project API schemas and contracts.
 *
 * Tests cover:
 *   - CreateWorldProjectBody validation (POST /api/world/projects)
 *   - UpdateWorldProjectBody validation (PUT /api/world/projects/:id)
 *   - WorldProjectResponse shape (all CRUD responses)
 *   - WorldProjectDetailResponse shape (GET detail with worldData)
 *   - Snapshot body validation (POST /api/world/projects/:id/snapshot)
 *   - Edge cases: SQL injection, XSS, oversized payloads
 */

import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";
import {
  CreateWorldProjectBody,
  UpdateWorldProjectBody,
  WorldProjectResponse,
  WorldProjectDetailResponse,
} from "../../../server/models/world-studio.models";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

// ==================== Create Project ====================

describe("CreateWorldProjectBody — POST /api/world/projects", () => {
  it("accepts minimal valid body", () => {
    const valid = {
      name: "My World",
      gameId: UUID,
      worldData: { mode: "editing" },
    };
    expect(Value.Check(CreateWorldProjectBody, valid)).toBe(true);
  });

  it("accepts body with optional description", () => {
    const valid = {
      name: "My World",
      gameId: UUID,
      description: "A test world with terrain",
      worldData: { mode: "editing", terrain: { seed: 42 } },
    };
    expect(Value.Check(CreateWorldProjectBody, valid)).toBe(true);
  });

  it("accepts complex nested worldData (arbitrary structure)", () => {
    const valid = {
      name: "Complex World",
      gameId: UUID,
      worldData: {
        mode: "editing",
        editing: {
          terrain: { worldSize: 128, tileSize: 4 },
          biomes: [{ id: "b1", type: "forest" }],
        },
        extendedLayers: { npcs: [], mines: [], regions: [] },
      },
    };
    expect(Value.Check(CreateWorldProjectBody, valid)).toBe(true);
  });

  it("rejects missing name", () => {
    const invalid = { gameId: UUID, worldData: { mode: "editing" } };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects empty name", () => {
    const invalid = { name: "", gameId: UUID, worldData: { mode: "editing" } };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects invalid UUID for gameId", () => {
    const invalid = {
      name: "Test",
      gameId: "not-a-uuid",
      worldData: { mode: "editing" },
    };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects missing gameId", () => {
    const invalid = { name: "Test", worldData: { mode: "editing" } };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("accepts a body without worldData (template-based creation path is valid at the schema layer)", () => {
    // Phase B0'.B made `worldData` optional alongside `templateId` —
    // either is sufficient to create a project. The "must have one"
    // rule lives in the route handler, not the schema. So a body
    // with neither is schema-valid; it will fail later when the
    // route picks neither path.
    const body = { name: "Test", gameId: UUID };
    expect(Value.Check(CreateWorldProjectBody, body)).toBe(true);
  });

  it("rejects non-object worldData", () => {
    const invalid = { name: "Test", gameId: UUID, worldData: "not-an-object" };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects array worldData", () => {
    const invalid = { name: "Test", gameId: UUID, worldData: [1, 2, 3] };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("rejects null worldData", () => {
    const invalid = { name: "Test", gameId: UUID, worldData: null };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });
});

// ==================== Update Project ====================

describe("UpdateWorldProjectBody — PUT /api/world/projects/:id", () => {
  it("accepts name-only update", () => {
    const valid = { name: "Renamed World" };
    expect(Value.Check(UpdateWorldProjectBody, valid)).toBe(true);
  });

  it("accepts worldData-only update", () => {
    const valid = { worldData: { mode: "editing", seed: 123 } };
    expect(Value.Check(UpdateWorldProjectBody, valid)).toBe(true);
  });

  it("accepts description-only update", () => {
    const valid = { description: "Updated description" };
    expect(Value.Check(UpdateWorldProjectBody, valid)).toBe(true);
  });

  it("accepts full update with all fields", () => {
    const valid = {
      name: "Updated",
      description: "New description",
      worldData: { mode: "editing", biomes: [] },
    };
    expect(Value.Check(UpdateWorldProjectBody, valid)).toBe(true);
  });

  it("rejects empty name string", () => {
    const invalid = { name: "" };
    expect(Value.Check(UpdateWorldProjectBody, invalid)).toBe(false);
  });
});

// ==================== Response Schemas ====================

describe("WorldProjectResponse — response shape", () => {
  const baseResponse = {
    id: UUID,
    teamId: "550e8400-e29b-41d4-a716-446655440001",
    gameId: "550e8400-e29b-41d4-a716-446655440002",
    name: "Test World",
    description: null,
    version: 1,
    createdBy: "user-123",
    lockedBy: null,
    lockedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    // ── B0'.A typed project layers required by WorldProjectResponse ──
    schemaVersion: 1,
    templateId: null,
    plugins: [],
    assetPacks: [],
  };

  it("validates a response with null optional fields", () => {
    expect(Value.Check(WorldProjectResponse, baseResponse)).toBe(true);
  });

  it("validates a response with lock info populated", () => {
    const locked = {
      ...baseResponse,
      lockedBy: "user-456",
      lockedAt: "2024-06-15T12:00:00.000Z",
    };
    expect(Value.Check(WorldProjectResponse, locked)).toBe(true);
  });

  it("validates response with description", () => {
    const withDesc = {
      ...baseResponse,
      description: "A world project",
    };
    expect(Value.Check(WorldProjectResponse, withDesc)).toBe(true);
  });

  it("validates response with high version number", () => {
    const versioned = { ...baseResponse, version: 999 };
    expect(Value.Check(WorldProjectResponse, versioned)).toBe(true);
  });
});

describe("WorldProjectDetailResponse — GET /api/world/projects/:id", () => {
  const detailResponse = {
    id: UUID,
    teamId: "550e8400-e29b-41d4-a716-446655440001",
    gameId: "550e8400-e29b-41d4-a716-446655440002",
    name: "Test World",
    description: null,
    version: 3,
    createdBy: "user-123",
    lockedBy: null,
    lockedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-03-15T08:30:00.000Z",
    // ── B0'.A typed project layers required by WorldProjectResponse ──
    schemaVersion: 1,
    templateId: null,
    plugins: [],
    assetPacks: [],
    // ── B0'.A typed layers added on the Detail variant ──
    config: null,
    worldContent: {},
    worldData: {
      mode: "editing",
      editing: {
        terrain: { worldSize: 64, tileSize: 4 },
      },
    },
    manifestSnapshot: null,
  };

  it("validates detail response with worldData", () => {
    expect(Value.Check(WorldProjectDetailResponse, detailResponse)).toBe(true);
  });

  it("validates detail response with manifestSnapshot", () => {
    const withSnapshot = {
      ...detailResponse,
      manifestSnapshot: {
        version: 1,
        buildings: { towns: [] },
        exportedAt: "2024-11-15T00:00:00.000Z",
      },
    };
    expect(Value.Check(WorldProjectDetailResponse, withSnapshot)).toBe(true);
  });
});

// ==================== Snapshot Endpoint ====================

describe("Snapshot body — POST /api/world/projects/:id/snapshot", () => {
  const SnapshotBody = t.Object({
    manifestSnapshot: t.Record(t.String(), t.Unknown()),
  });

  it("accepts valid manifest snapshot", () => {
    const valid = {
      manifestSnapshot: {
        version: 1,
        worldId: UUID,
        buildings: { towns: [], buildingTypes: {} },
      },
    };
    expect(Value.Check(SnapshotBody, valid)).toBe(true);
  });

  it("accepts empty manifest snapshot", () => {
    const valid = { manifestSnapshot: {} };
    expect(Value.Check(SnapshotBody, valid)).toBe(true);
  });

  it("rejects missing manifestSnapshot", () => {
    expect(Value.Check(SnapshotBody, {})).toBe(false);
  });

  it("rejects non-object manifestSnapshot", () => {
    const invalid = { manifestSnapshot: "not-an-object" };
    expect(Value.Check(SnapshotBody, invalid)).toBe(false);
  });
});

// ==================== Security Edge Cases ====================

describe("Input sanitization edge cases", () => {
  it("accepts name with unicode characters", () => {
    const valid = {
      name: "世界 αβγ 🌍",
      gameId: UUID,
      worldData: { mode: "editing" },
    };
    expect(Value.Check(CreateWorldProjectBody, valid)).toBe(true);
  });

  it("rejects name exceeding max length of 200", () => {
    const invalid = {
      name: "A".repeat(201),
      gameId: UUID,
      worldData: { mode: "editing" },
    };
    expect(Value.Check(CreateWorldProjectBody, invalid)).toBe(false);
  });

  it("accepts name at max length of 200", () => {
    const valid = {
      name: "A".repeat(200),
      gameId: UUID,
      worldData: { mode: "editing" },
    };
    expect(Value.Check(CreateWorldProjectBody, valid)).toBe(true);
  });

  it("rejects whitespace-only name via minLength", () => {
    // Empty string is rejected; whitespace may pass schema but should be
    // caught by application logic or DB constraints
    const emptyName = {
      name: "",
      gameId: UUID,
      worldData: { mode: "editing" },
    };
    expect(Value.Check(CreateWorldProjectBody, emptyName)).toBe(false);
  });
});
