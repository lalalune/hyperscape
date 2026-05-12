/**
 * `zodSchemaFromFields` — FieldSchema → Zod object schema tests.
 *
 * The compiler bridges GameModule field declarations to the Zod
 * schemas Vercel AI SDK's `generateObject` consumes for structured
 * LLM output. Drift in the type map silently changes what shape
 * the LLM is constrained to produce.
 *
 * Tests cover the 13 supported field types + the required /
 * optional / readOnly flags + the entity-id extension.
 */

import { describe, expect, it } from "vitest";
import { zodEntitySchema, zodSchemaFromFields } from "../zodSchemaFromFields";
import type { FieldSchema } from "../../../src/gameModules/GameModule";

function makeField(overrides: Partial<FieldSchema>): FieldSchema {
  return {
    key: "f",
    label: "Field",
    type: "string",
    required: true,
    ...overrides,
  } as FieldSchema;
}

describe("zodSchemaFromFields — type mapping", () => {
  it("string field → z.string()", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "name", type: "string" }),
    ]);
    expect(schema.safeParse({ name: "abc" }).success).toBe(true);
    expect(schema.safeParse({ name: 123 }).success).toBe(false);
  });

  it("number field respects min/max config", () => {
    const schema = zodSchemaFromFields([
      makeField({
        key: "n",
        type: "number",
        config: { min: 0, max: 10 },
      } as never),
    ]);
    expect(schema.safeParse({ n: 5 }).success).toBe(true);
    expect(schema.safeParse({ n: -1 }).success).toBe(false);
    expect(schema.safeParse({ n: 11 }).success).toBe(false);
  });

  it("slider field is a constrained number", () => {
    const schema = zodSchemaFromFields([
      makeField({
        key: "s",
        type: "slider",
        config: { min: 0, max: 1 },
      } as never),
    ]);
    expect(schema.safeParse({ s: 0.5 }).success).toBe(true);
    expect(schema.safeParse({ s: 2 }).success).toBe(false);
  });

  it("boolean field → z.boolean()", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "b", type: "boolean" }),
    ]);
    expect(schema.safeParse({ b: true }).success).toBe(true);
    expect(schema.safeParse({ b: "true" }).success).toBe(false);
  });

  it("select field with options → z.enum", () => {
    const schema = zodSchemaFromFields([
      makeField({
        key: "kind",
        type: "select",
        config: {
          options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ],
        },
      } as never),
    ]);
    expect(schema.safeParse({ kind: "a" }).success).toBe(true);
    expect(schema.safeParse({ kind: "b" }).success).toBe(true);
    expect(schema.safeParse({ kind: "c" }).success).toBe(false);
  });

  it("select without options falls back to z.string()", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "k", type: "select" }),
    ]);
    expect(schema.safeParse({ k: "anything" }).success).toBe(true);
  });

  it("position field → z.object({ x, y, z })", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "pos", type: "position" }),
    ]);
    expect(schema.safeParse({ pos: { x: 0, y: 0, z: 0 } }).success).toBe(true);
    // Missing axis fails.
    expect(schema.safeParse({ pos: { x: 0, y: 0 } }).success).toBe(false);
  });

  it("rotation field is [0, 360]", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "r", type: "rotation" }),
    ]);
    expect(schema.safeParse({ r: 0 }).success).toBe(true);
    expect(schema.safeParse({ r: 360 }).success).toBe(true);
    expect(schema.safeParse({ r: -1 }).success).toBe(false);
    expect(schema.safeParse({ r: 361 }).success).toBe(false);
  });

  it("color field matches /#[0-9a-fA-F]{6}/", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "c", type: "color" }),
    ]);
    expect(schema.safeParse({ c: "#ff0000" }).success).toBe(true);
    expect(schema.safeParse({ c: "#FFCC00" }).success).toBe(true);
    expect(schema.safeParse({ c: "ff0000" }).success).toBe(false); // missing #
    expect(schema.safeParse({ c: "#ff00" }).success).toBe(false); // too short
  });

  it("tags field → z.array(z.string())", () => {
    const schema = zodSchemaFromFields([makeField({ key: "t", type: "tags" })]);
    expect(schema.safeParse({ t: ["a", "b"] }).success).toBe(true);
    expect(schema.safeParse({ t: [1, 2] }).success).toBe(false);
  });

  it("polygon field → z.array(z.object({ x, z }))", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "p", type: "polygon" }),
    ]);
    expect(
      schema.safeParse({
        p: [
          { x: 0, z: 0 },
          { x: 1, z: 1 },
        ],
      }).success,
    ).toBe(true);
    // Wrong field shape fails.
    expect(schema.safeParse({ p: [{ x: 0, y: 0 }] }).success).toBe(false);
  });

  it("waypoints field → z.array(z.object({ x, y, z }))", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "wp", type: "waypoints" }),
    ]);
    expect(schema.safeParse({ wp: [{ x: 0, y: 0, z: 0 }] }).success).toBe(true);
    // Missing y fails (waypoints include y, unlike polygon).
    expect(schema.safeParse({ wp: [{ x: 0, z: 0 }] }).success).toBe(false);
  });

  it("json field → z.record(z.string(), z.unknown())", () => {
    const schema = zodSchemaFromFields([makeField({ key: "j", type: "json" })]);
    expect(schema.safeParse({ j: { any: "shape" } }).success).toBe(true);
    expect(schema.safeParse({ j: { nested: { a: 1 } } }).success).toBe(true);
  });

  it("entityId field → z.string()", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "ref", type: "entityId" }),
    ]);
    expect(schema.safeParse({ ref: "some-id" }).success).toBe(true);
    expect(schema.safeParse({ ref: 123 }).success).toBe(false);
  });
});

describe("zodSchemaFromFields — required / optional / readOnly", () => {
  it("required field → present must be valid", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "name", type: "string", required: true }),
    ]);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("non-required field is optional", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "desc", type: "string", required: false }),
    ]);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ desc: "x" }).success).toBe(true);
  });

  it("readOnly fields are SKIPPED entirely (not in schema)", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "id", type: "string", readOnly: true } as never),
      makeField({ key: "name", type: "string" }),
    ]);
    // Passing without the readOnly id succeeds.
    expect(schema.safeParse({ name: "x" }).success).toBe(true);
    // Schema shape only has name.
    expect(Object.keys(schema.shape).sort()).toEqual(["name"]);
  });
});

describe("zodEntitySchema — adds an id field", () => {
  it("entity schema includes id alongside fields", () => {
    const schema = zodEntitySchema([
      makeField({ key: "name", type: "string" }),
    ]);
    expect(Object.keys(schema.shape).sort()).toEqual(["id", "name"]);
    expect(schema.safeParse({ id: "e1", name: "X" }).success).toBe(true);
    expect(schema.safeParse({ name: "X" }).success).toBe(false); // missing id
  });

  it("id is required (not optional)", () => {
    const schema = zodEntitySchema([]);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ id: "e1" }).success).toBe(true);
  });
});

describe("zodSchemaFromFields — multi-field shapes", () => {
  it("compiles a mix of types into a valid object schema", () => {
    const schema = zodSchemaFromFields([
      makeField({ key: "id", type: "string" }),
      makeField({
        key: "level",
        type: "number",
        config: { min: 1, max: 99 },
      } as never),
      makeField({ key: "active", type: "boolean" }),
      makeField({ key: "tags", type: "tags", required: false }),
    ]);
    expect(
      schema.safeParse({
        id: "mob_1",
        level: 5,
        active: true,
        tags: ["aggressive"],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        id: "mob_1",
        level: 5,
        active: true,
      }).success,
    ).toBe(true); // tags optional
  });
});
