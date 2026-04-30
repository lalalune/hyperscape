/**
 * PluginRegistryService — discovery + caching tests.
 *
 * Phase B0'.D. Uses fixture directories created in a temp workspace
 * so tests don't depend on the actual repo's plugin.json files.
 *
 * Coverage:
 *   - discovers valid plugin.json under workspace/packages
 *   - skips invalid JSON / schema-fail manifests with a warning
 *   - reads companion package.json for npmName
 *   - de-duplicates by id, workspace > node_modules
 *   - caches the result; invalidate() forces re-scan
 *   - getById + resolve(idOrNpmName) lookup paths
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginRegistryService } from "../PluginRegistryService.js";

let workspaceRoot: string;

function makePlugin(
  parentDir: string,
  packageName: string,
  pluginJson: Record<string, unknown> | string,
  packageJsonName?: string,
) {
  const dir = join(parentDir, packageName);
  mkdirSync(dir, { recursive: true });
  const body =
    typeof pluginJson === "string" ? pluginJson : JSON.stringify(pluginJson);
  writeFileSync(join(dir, "plugin.json"), body);
  if (packageJsonName !== undefined) {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: packageJsonName, version: "0.0.1" }),
    );
  }
}

function validManifest(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    name: id,
    version: "1.0.0",
    description: "test plugin",
    entry: "./dist/index.js",
    author: { name: "Test Author" },
    hyperforgeApi: "0.1.0",
    ...overrides,
  };
}

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "plugin-registry-test-"));
  // Marker package.json with workspaces so findWorkspaceRoot resolves
  // here when the service is constructed without explicit
  // workspaceRoot. (We pass it explicitly anyway, but this keeps
  // the fixture self-consistent.)
  writeFileSync(
    join(workspaceRoot, "package.json"),
    JSON.stringify({ name: "fixture-root", workspaces: ["packages/*"] }),
  );
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

beforeEach(() => {
  // Clear and recreate packages/ each test for isolation.
  rmSync(join(workspaceRoot, "packages"), { recursive: true, force: true });
  mkdirSync(join(workspaceRoot, "packages"), { recursive: true });
  rmSync(join(workspaceRoot, "node_modules"), { recursive: true, force: true });
});

describe("PluginRegistryService — discovery", () => {
  it("returns empty list when no plugin.json files exist", async () => {
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const list = await svc.list();
    expect(list).toEqual([]);
  });

  it("discovers a single valid plugin in packages/", async () => {
    makePlugin(
      join(workspaceRoot, "packages"),
      "alpha",
      validManifest("com.example.alpha"),
      "@example/alpha",
    );
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.manifest.id).toBe("com.example.alpha");
    expect(list[0]?.npmName).toBe("@example/alpha");
    expect(list[0]?.source).toBe("workspace");
  });

  it("returns null npmName when package.json is missing", async () => {
    makePlugin(
      join(workspaceRoot, "packages"),
      "alpha",
      validManifest("com.example.alpha"),
      // no package.json
    );
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const list = await svc.list();
    expect(list[0]?.npmName).toBeNull();
  });

  it("skips packages without plugin.json silently", async () => {
    // Create a package dir with package.json but no plugin.json.
    mkdirSync(join(workspaceRoot, "packages", "not-a-plugin"));
    writeFileSync(
      join(workspaceRoot, "packages", "not-a-plugin", "package.json"),
      JSON.stringify({ name: "not-a-plugin" }),
    );
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const list = await svc.list();
    expect(list).toEqual([]);
  });

  it("skips a plugin.json with invalid JSON", async () => {
    makePlugin(
      join(workspaceRoot, "packages"),
      "broken",
      "{ this is not json",
      "@example/broken",
    );
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const list = await svc.list();
    expect(list).toEqual([]);
  });

  it("skips a plugin.json that fails schema validation", async () => {
    // Missing `entry` and `hyperforgeApi` — required fields.
    makePlugin(
      join(workspaceRoot, "packages"),
      "incomplete",
      { id: "com.example.incomplete", name: "Incomplete", version: "1.0.0" },
      "@example/incomplete",
    );
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const list = await svc.list();
    expect(list).toEqual([]);
  });

  it("returns plugins sorted by manifest id", async () => {
    makePlugin(
      join(workspaceRoot, "packages"),
      "z",
      validManifest("com.zzz.last"),
      "@example/zzz",
    );
    makePlugin(
      join(workspaceRoot, "packages"),
      "a",
      validManifest("com.aaa.first"),
      "@example/aaa",
    );
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const list = await svc.list();
    expect(list.map((e) => e.manifest.id)).toEqual([
      "com.aaa.first",
      "com.zzz.last",
    ]);
  });

  it("merges workspace + node_modules; workspace wins on id collision", async () => {
    // Same plugin id present in both sources; workspace version
    // should be kept (dev iteration wins over installed copy).
    makePlugin(
      join(workspaceRoot, "packages"),
      "alpha",
      validManifest("com.example.alpha", { name: "Alpha (workspace)" }),
      "@example/alpha",
    );
    mkdirSync(join(workspaceRoot, "node_modules", "@hyperforge"), {
      recursive: true,
    });
    makePlugin(
      join(workspaceRoot, "node_modules", "@hyperforge"),
      "alpha",
      validManifest("com.example.alpha", { name: "Alpha (installed)" }),
      "@hyperforge/alpha",
    );
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace", "node_modules"],
    });
    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.manifest.name).toBe("Alpha (workspace)");
    expect(list[0]?.source).toBe("workspace");
  });
});

describe("PluginRegistryService — caching + invalidation", () => {
  it("caches across calls", async () => {
    makePlugin(
      join(workspaceRoot, "packages"),
      "alpha",
      validManifest("com.example.alpha"),
      "@example/alpha",
    );
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const first = await svc.list();
    // Mutate filesystem after the cache is populated; call should
    // still return the cached result (no re-scan).
    rmSync(join(workspaceRoot, "packages", "alpha"), {
      recursive: true,
      force: true,
    });
    const second = await svc.list();
    expect(second).toBe(first);
  });

  it("invalidate() forces a re-scan", async () => {
    makePlugin(
      join(workspaceRoot, "packages"),
      "alpha",
      validManifest("com.example.alpha"),
      "@example/alpha",
    );
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    await svc.list();
    rmSync(join(workspaceRoot, "packages", "alpha"), {
      recursive: true,
      force: true,
    });
    svc.invalidate();
    const second = await svc.list();
    expect(second).toEqual([]);
  });
});

describe("PluginRegistryService — lookup", () => {
  beforeEach(() => {
    makePlugin(
      join(workspaceRoot, "packages"),
      "alpha",
      validManifest("com.example.alpha"),
      "@example/alpha",
    );
    makePlugin(
      join(workspaceRoot, "packages"),
      "beta",
      validManifest("com.example.beta"),
      "@example/beta",
    );
  });

  it("getById returns the matching entry", async () => {
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const entry = await svc.getById("com.example.alpha");
    expect(entry?.manifest.id).toBe("com.example.alpha");
  });

  it("getById returns null for unknown id", async () => {
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    expect(await svc.getById("not-real")).toBeNull();
  });

  it("resolve() matches by manifest id", async () => {
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const entry = await svc.resolve("com.example.alpha");
    expect(entry?.manifest.id).toBe("com.example.alpha");
  });

  it("resolve() matches by npm name", async () => {
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    const entry = await svc.resolve("@example/beta");
    expect(entry?.manifest.id).toBe("com.example.beta");
  });

  it("resolve() returns null for unknown id/name", async () => {
    const svc = new PluginRegistryService({
      workspaceRoot,
      sources: ["workspace"],
    });
    expect(await svc.resolve("not-real")).toBeNull();
  });
});
