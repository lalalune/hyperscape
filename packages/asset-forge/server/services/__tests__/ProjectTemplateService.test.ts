/**
 * ProjectTemplateService — tests.
 *
 * Phase B0'.B. Covers the in-memory template registry: seeded
 * templates exist, lookup works, cloning produces a fresh layers
 * value, and seed overrides apply correctly.
 */

import { describe, expect, it } from "vitest";
import { ProjectTemplateService } from "../ProjectTemplateService.js";

describe("ProjectTemplateService — built-in templates", () => {
  it("seeds 'blank' and 'hyperia' templates", () => {
    const svc = new ProjectTemplateService();
    const list = svc.list();
    const ids = list.map((t) => t.id);
    expect(ids).toContain("blank");
    expect(ids).toContain("hyperia");
  });

  it("'blank' template has empty plugins + worldContent", () => {
    const svc = new ProjectTemplateService();
    const blank = svc.getById("blank");
    expect(blank).not.toBeNull();
    expect(blank?.seed.plugins).toEqual([]);
    expect(blank?.seed.worldContent).toEqual({});
    expect(blank?.seed.templateId).toBe("blank");
  });

  it("'hyperia' template installs the hyperscape plugin", () => {
    const svc = new ProjectTemplateService();
    const hyp = svc.getById("hyperia");
    expect(hyp).not.toBeNull();
    expect(hyp?.seed.plugins).toEqual(["@hyperforge/hyperscape"]);
    expect(hyp?.seed.templateId).toBe("hyperia");
  });

  it("'blank' is the default pick", () => {
    const svc = new ProjectTemplateService();
    expect(svc.getDefault().id).toBe("blank");
  });

  it("returns null for unknown template id", () => {
    const svc = new ProjectTemplateService();
    expect(svc.getById("does-not-exist")).toBeNull();
  });
});

describe("ProjectTemplateService — clone()", () => {
  it("returns a fresh layers value, not a reference into the template", () => {
    const svc = new ProjectTemplateService();
    const a = svc.clone("blank");
    const b = svc.clone("blank");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
    // Mutate one — the other should remain pristine.
    if (a) {
      (a.plugins as string[]).push("@hyperforge/test-plugin");
      expect(b?.plugins).toEqual([]);
    }
  });

  it("returns null for unknown id", () => {
    const svc = new ProjectTemplateService();
    expect(svc.clone("does-not-exist")).toBeNull();
  });

  it("applies seed override into the config", () => {
    const svc = new ProjectTemplateService();
    const cloned = svc.clone("blank", { seed: 12345 });
    expect(cloned).not.toBeNull();
    expect((cloned?.config as { seed?: number })?.seed).toBe(12345);
  });

  it("preserves templateId on the cloned layers", () => {
    const svc = new ProjectTemplateService();
    const cloned = svc.clone("hyperia");
    expect(cloned?.templateId).toBe("hyperia");
    expect(cloned?.plugins).toEqual(["@hyperforge/hyperscape"]);
  });

  it("seed override does not pollute the template registry", () => {
    const svc = new ProjectTemplateService();
    svc.clone("blank", { seed: 999 });
    const original = svc.getById("blank");
    // Template registry's seed config should be untouched.
    expect((original?.seed.config as { seed?: number })?.seed).toBe(0);
  });
});

describe("ProjectTemplateService — custom registry", () => {
  it("accepts an injected template list", () => {
    const svc = new ProjectTemplateService([
      {
        id: "custom-only",
        name: "Custom",
        description: "Just one",
        defaultPick: true,
        seed: {
          schemaVersion: 1,
          config: { seed: 1 },
          plugins: [],
          worldContent: {},
          templateId: "custom-only",
        },
      },
    ]);
    expect(svc.list()).toHaveLength(1);
    expect(svc.getDefault().id).toBe("custom-only");
  });
});
