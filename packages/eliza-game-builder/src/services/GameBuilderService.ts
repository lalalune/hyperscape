/**
 * `GameBuilderService` — long-lived ElizaOS service the actions
 * dispatch to.
 *
 * Mirrors the pattern `HyperiaService` uses in
 * `packages/plugin-hyperia/src/services/`: extends `Service`,
 * declares a static `serviceType`, and exposes the typed API actions
 * call from their handler.
 *
 * The service holds two things:
 *   1. A `StaticCatalogDocument` (the widget catalog) — read once
 *      from disk at start, cached for the runtime's lifetime.
 *   2. A workspace root path — needed by the scaffolder to know
 *      where generated files land.
 *
 * Both can be overridden for tests via `GameBuilderService.create({
 * catalog, workspaceRoot })`. In a normal runtime the service reads
 * the standard `WIDGET_CATALOG_PATH` setting (or falls back to the
 * monorepo default).
 */

import { Service, type IAgentRuntime } from "@elizaos/core";
import { type StaticCatalogDocument } from "@hyperforge/widget-catalog";
import {
  applyToWorkspace,
  scaffoldWidget,
  validateWidgetSpec,
  type ApplyToWorkspaceReport,
  type ScaffoldResult,
  type ScaffoldValidationResult,
  type WidgetSpec,
} from "@hyperforge/plugin-scaffolder";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_CATALOG_RELATIVE = "packages/widget-catalog/dist/catalog.json";

export interface GameBuilderServiceOptions {
  /**
   * In-memory catalog document. Wins over `catalogPath`. Tests pass
   * a fixture; normal runtime relies on disk.
   */
  readonly catalog?: StaticCatalogDocument;
  /**
   * Workspace-relative or absolute path to `catalog.json`. Defaults
   * to the monorepo location.
   */
  readonly catalogPath?: string;
  /**
   * Workspace root. Where scaffolded files land. Defaults to
   * `process.cwd()`.
   */
  readonly workspaceRoot?: string;
}

export interface ScaffoldOutcome {
  readonly validation: ScaffoldValidationResult;
  readonly result?: ScaffoldResult;
  readonly applied?: ApplyToWorkspaceReport;
}

/**
 * Public surface — the methods action handlers call.
 */
export interface IGameBuilderService {
  getCatalog(): StaticCatalogDocument;
  listWidgets(filter?: {
    readonly category?: string;
  }): StaticCatalogDocument["widgets"];
  getWidget(id: string): StaticCatalogDocument["widgets"][number] | undefined;
  scaffold(
    spec: WidgetSpec,
    options?: {
      readonly dryRun?: boolean;
      readonly force?: boolean;
      readonly widgetsDir?: string;
      readonly testsDir?: string;
      readonly indexFile?: string;
      readonly skipTest?: boolean;
    },
  ): ScaffoldOutcome;
  getWorkspaceRoot(): string;
}

export class GameBuilderService extends Service implements IGameBuilderService {
  static override readonly serviceType = "gameBuilderService";

  override readonly capabilityDescription =
    "Exposes the HyperForge widget catalog + plugin scaffolder so an agent can list widgets, inspect their schemas, and scaffold new widgets during a chat-driven game-design session.";

  private readonly catalog: StaticCatalogDocument;
  private readonly workspaceRoot: string;

  /**
   * Direct constructor used by the static factories. Most callers
   * use `GameBuilderService.start(runtime)` (the ElizaOS path) or
   * `GameBuilderService.create(options)` (tests).
   */
  constructor(
    runtime?: IAgentRuntime,
    options: GameBuilderServiceOptions = {},
  ) {
    super(runtime);
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();

    if (options.catalog) {
      this.catalog = options.catalog;
      return;
    }

    const catalogPath = resolveCatalogPath(
      this.workspaceRoot,
      options.catalogPath,
    );
    if (!existsSync(catalogPath)) {
      throw new Error(
        `GameBuilderService: catalog not found at ${catalogPath}. ` +
          `Run 'bun run --filter @hyperforge/widget-catalog build:catalog' ` +
          `or pass options.catalogPath / options.catalog.`,
      );
    }
    const raw = readFileSync(catalogPath, "utf8");
    this.catalog = JSON.parse(raw) as StaticCatalogDocument;
  }

  /**
   * Test-friendly factory. Lets the caller hand in a fixture
   * catalog without disk I/O.
   */
  static create(options: GameBuilderServiceOptions): GameBuilderService {
    return new GameBuilderService(undefined, options);
  }

  /**
   * ElizaOS entry point. The runtime calls this when the plugin's
   * `services` array is registered.
   */
  static async start(runtime: IAgentRuntime): Promise<GameBuilderService> {
    const settings = runtime as unknown as {
      getSetting?: (k: string) => string | undefined;
    };
    const catalogPath = settings.getSetting?.("HYPERFORGE_CATALOG_PATH");
    const workspaceRoot = settings.getSetting?.("HYPERFORGE_WORKSPACE_ROOT");
    return new GameBuilderService(runtime, {
      catalogPath,
      workspaceRoot,
    });
  }

  /**
   * Required by `@elizaos/core::Service`. Idempotent — the service
   * holds no resources that need releasing.
   */
  async stop(): Promise<void> {}

  // -------------- public surface --------------

  getCatalog(): StaticCatalogDocument {
    return this.catalog;
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  listWidgets(filter: { readonly category?: string } = {}) {
    if (!filter.category) return this.catalog.widgets;
    return this.catalog.widgets.filter((w) => w.category === filter.category);
  }

  getWidget(id: string) {
    return this.catalog.widgets.find((w) => w.id === id);
  }

  scaffold(
    spec: WidgetSpec,
    options: {
      readonly dryRun?: boolean;
      readonly force?: boolean;
      readonly widgetsDir?: string;
      readonly testsDir?: string;
      readonly indexFile?: string;
      readonly skipTest?: boolean;
    } = {},
  ): ScaffoldOutcome {
    const validation = validateWidgetSpec(spec);
    if (!validation.ok) {
      return { validation };
    }
    // R4.P14 — scaffoldWidget requires widgetsDir + indexFile.
    // Surface missing values as a validation failure rather than
    // throwing, so the agent's scaffold action returns a clean
    // structured error to the caller.
    if (!options.widgetsDir || !options.indexFile) {
      return {
        validation: {
          ok: false,
          issues: [
            ...(!options.widgetsDir
              ? [
                  {
                    path: "widgetsDir",
                    message:
                      "widgetsDir is required — pass the workspace-relative path to the target plugin's widgets directory (e.g. packages/<your-plugin>/src/widgets).",
                  },
                ]
              : []),
            ...(!options.indexFile
              ? [
                  {
                    path: "indexFile",
                    message:
                      "indexFile is required — pass the workspace-relative path to the target plugin's contributions barrel (e.g. packages/<your-plugin>/src/index.ts).",
                  },
                ]
              : []),
          ],
        },
      };
    }
    const result = scaffoldWidget(spec, {
      widgetsDir: options.widgetsDir,
      testsDir: options.testsDir,
      indexFile: options.indexFile,
      skipTest: options.skipTest,
    });
    const applied = applyToWorkspace(result, {
      workspaceRoot: this.workspaceRoot,
      dryRun: options.dryRun,
      force: options.force,
    });
    return { validation, result, applied };
  }
}

function resolveCatalogPath(workspaceRoot: string, override?: string): string {
  if (override) return resolve(workspaceRoot, override);
  return resolve(workspaceRoot, DEFAULT_CATALOG_RELATIVE);
}
