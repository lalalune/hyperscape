/**
 * Plugin Registry Service
 *
 * Phase B0'.D of `PLAN_PROJECT_AS_DATA.md`. Discovers HyperForge
 * plugins by walking known locations for `plugin.json` files,
 * validating each against `PluginContributionManifestSchema`, and
 * caching the registry for the lifetime of the asset-forge server
 * process.
 *
 * Discovery sources (each scanned at startup, results merged):
 *
 *   1. **Workspace packages** — `packages/* /plugin.json` from the
 *      monorepo root. Active in dev (this is how Hyperia +
 *      shooter-demo + future first-party plugins are discovered).
 *   2. **node_modules** — `@hyperforge/* /plugin.json` from
 *      installed packages. Active in installed deployments where
 *      plugins ship via npm.
 *
 * Both sources can coexist; the workspace path wins on id collision
 * because dev iteration on a checked-out plugin shouldn't be
 * shadowed by an older installed version.
 *
 * Future (B0'.D follow-up): hot-reload on plugin.json changes via
 * file-watcher — useful when authoring a plugin in dev. Out of
 * scope for the first cut; today's plugins stabilize at boot.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  validatePluginManifest,
  type PluginManifest,
} from "@hyperforge/manifest-schema";

/**
 * Registry entry — the manifest plus the resolution sources we
 * discovered it from.
 */
export interface PluginRegistryEntry {
  /** The validated plugin manifest. */
  readonly manifest: PluginManifest;
  /**
   * Companion `package.json` `name` field if discoverable, else
   * `null`. Used as the user-facing surface (e.g.
   * `"@hyperforge/hyperscape"` matches the npm convention).
   */
  readonly npmName: string | null;
  /**
   * Absolute filesystem path to the plugin.json that contributed
   * this entry. Useful for logs + the editor's "view source" pane.
   */
  readonly manifestPath: string;
  /** Discovery source — `"workspace"` or `"node_modules"`. */
  readonly source: "workspace" | "node_modules";
}

/** Options for `PluginRegistryService`. */
export interface PluginRegistryServiceOptions {
  /**
   * Root directory used as the anchor for scanning. Defaults to a
   * walk-up from `__dirname` to the nearest workspace root (the
   * directory containing a top-level `package.json` with
   * `workspaces`).
   */
  readonly workspaceRoot?: string;
  /**
   * Override the discovery sources. Useful for tests that point at
   * a fixture directory. Defaults to both workspace + node_modules.
   */
  readonly sources?: ReadonlyArray<"workspace" | "node_modules">;
}

export class PluginRegistryService {
  private cache: ReadonlyArray<PluginRegistryEntry> | null = null;
  private readonly workspaceRoot: string;
  private readonly sources: ReadonlyArray<"workspace" | "node_modules">;

  constructor(options: PluginRegistryServiceOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot();
    this.sources = options.sources ?? ["workspace", "node_modules"];
  }

  /** Force a re-scan on the next `list()` / `getById()` call. */
  invalidate(): void {
    this.cache = null;
  }

  /** Return all discovered plugins in stable id order. */
  async list(): Promise<ReadonlyArray<PluginRegistryEntry>> {
    if (this.cache !== null) return this.cache;
    const entries = await this.discover();
    this.cache = entries;
    return entries;
  }

  /** Resolve a plugin by manifest id. Returns null when unknown. */
  async getById(id: string): Promise<PluginRegistryEntry | null> {
    const list = await this.list();
    return list.find((e) => e.manifest.id === id) ?? null;
  }

  /**
   * Resolve a plugin by either manifest id (`com.hyperforge.x`) or
   * npm name (`@hyperforge/x`). Both resolve to the same plugin —
   * the registry surfaces both ids per entry, so callers can use
   * whichever convention fits their context.
   */
  async resolve(idOrNpmName: string): Promise<PluginRegistryEntry | null> {
    const list = await this.list();
    return (
      list.find(
        (e) => e.manifest.id === idOrNpmName || e.npmName === idOrNpmName,
      ) ?? null
    );
  }

  // ───────────────────── private ─────────────────────

  private async discover(): Promise<ReadonlyArray<PluginRegistryEntry>> {
    const entries: PluginRegistryEntry[] = [];
    const seenIds = new Set<string>();

    for (const src of this.sources) {
      const roots =
        src === "workspace"
          ? [path.join(this.workspaceRoot, "packages")]
          : [path.join(this.workspaceRoot, "node_modules", "@hyperforge")];
      for (const root of roots) {
        const found = await scanDir(root, src);
        for (const entry of found) {
          if (seenIds.has(entry.manifest.id)) continue;
          seenIds.add(entry.manifest.id);
          entries.push(entry);
        }
      }
    }

    // Stable sort by manifest id.
    entries.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
    return entries;
  }
}

// ───────────────────── helpers ─────────────────────

/**
 * Walk a directory tree, validate any `plugin.json` files, return
 * one registry entry per valid manifest. Errors per-file are logged
 * and skipped (one bad plugin doesn't kill discovery).
 */
async function scanDir(
  rootDir: string,
  source: "workspace" | "node_modules",
): Promise<PluginRegistryEntry[]> {
  const entries: PluginRegistryEntry[] = [];
  let children: Array<{ name: string; isDirectory(): boolean }> = [];
  try {
    children = await fs.readdir(rootDir, { withFileTypes: true });
  } catch {
    // Root doesn't exist (e.g. no node_modules in dev) — that's ok.
    return entries;
  }

  for (const child of children) {
    if (!child.isDirectory()) continue;
    const dir = path.join(rootDir, child.name);
    const manifestPath = path.join(dir, "plugin.json");
    let raw: string;
    try {
      raw = await fs.readFile(manifestPath, "utf-8");
    } catch {
      // No plugin.json in this dir — skip silently.
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn(
        `[PluginRegistry] ${manifestPath}: invalid JSON — ${(err as Error).message}`,
      );
      continue;
    }
    const result = validatePluginManifest(parsed);
    if (!result.ok) {
      console.warn(
        `[PluginRegistry] ${manifestPath}: schema validation failed — ${result.issues
          .map((i) => `${i.path}: ${i.message}`)
          .join("; ")}`,
      );
      continue;
    }
    const npmName = await readNpmName(dir);
    entries.push({
      manifest: result.manifest,
      npmName,
      manifestPath,
      source,
    });
  }

  return entries;
}

/**
 * Read the companion `package.json` in the same directory as
 * `plugin.json` and return its `name` field. Used to surface the
 * npm-style plugin id alongside the reverse-DNS manifest id.
 */
async function readNpmName(dir: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(dir, "package.json"), "utf-8");
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.length > 0
      ? parsed.name
      : null;
  } catch {
    return null;
  }
}

/**
 * Walk up from `__dirname` until we find a directory whose
 * `package.json` declares `workspaces`. That's the monorepo root.
 * Falls back to `process.cwd()` if no workspaces field is found
 * (single-package install).
 */
function findWorkspaceRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    try {
      const pkgPath = path.join(dir, "package.json");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const raw = require("node:fs").readFileSync(pkgPath, "utf-8");
      const parsed = JSON.parse(raw) as { workspaces?: unknown };
      if (parsed.workspaces) return dir;
    } catch {
      // No package.json here — keep walking up.
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
