/**
 * Faithfulness + defensiveness tests for `XpCurvesManifestSchema`.
 */

import { describe, expect, it } from "vitest";

import { XpCurvesManifestSchema, type XpCurvesManifest } from "./xp-curves.js";

const reference: XpCurvesManifest = [
  {
    id: "rs-classic",
    name: "RS Classic 1-99",
    description: "Exponential table matching tile-based MMORPG",
    kind: "formula",
    formula: "rs-classic",
    maxLevel: 99,
    params: {},
  },
  {
    id: "gentle-linear",
    name: "Gentle Linear",
    kind: "formula",
    formula: "linear",
    maxLevel: 50,
    params: { base: 100, step: 50 },
  },
  {
    id: "handcrafted",
    name: "Handcrafted Lookup",
    kind: "lookup",
    xp: [83, 174, 276, 388, 512],
  },
];

describe("XpCurvesManifestSchema", () => {
  it("parses the reference manifest cleanly", () => {
    const result = XpCurvesManifestSchema.safeParse(reference);
    if (!result.success) {
      throw new Error(
        `Reference manifest failed validation:\n${JSON.stringify(result.error.format(), null, 2)}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it("applies formula params default when omitted", () => {
    const minimal = [
      {
        id: "basic",
        name: "Basic",
        kind: "formula",
        formula: "linear",
        maxLevel: 10,
      },
    ];
    const parsed = XpCurvesManifestSchema.parse(minimal);
    // discriminated-union narrowing — safe to access params when kind==="formula".
    const curve = parsed[0];
    if (curve.kind === "formula") {
      expect(curve.params).toEqual({});
    } else {
      throw new Error("expected formula curve");
    }
  });

  it("rejects unknown formula kind", () => {
    const bad = [{ ...reference[0], formula: "logistic" }];
    expect(XpCurvesManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects maxLevel < 2", () => {
    const bad = [{ ...reference[0], maxLevel: 1 }];
    expect(XpCurvesManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects empty lookup xp array", () => {
    const bad = [{ id: "x", name: "X", kind: "lookup", xp: [] }];
    expect(XpCurvesManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects non-monotonic lookup xp", () => {
    const bad = [{ id: "x", name: "X", kind: "lookup", xp: [100, 50, 200] }];
    expect(XpCurvesManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects duplicate curve ids", () => {
    const bad = [reference[0], { ...reference[0] }];
    expect(XpCurvesManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects negative xp entry in lookup", () => {
    const bad = [{ id: "x", name: "X", kind: "lookup", xp: [-1, 10] }];
    expect(XpCurvesManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects empty id", () => {
    const bad = [{ ...reference[0], id: "" }];
    expect(XpCurvesManifestSchema.safeParse(bad).success).toBe(false);
  });
});
