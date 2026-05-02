/**
 * `hyperforge scaffold widget --spec-file=<path>`
 *   `hyperforge scaffold widget --name=Foo --manifest-id=com.x.y.foo`
 *      `--category=panel --width=4 --height=3 [--description=...]`
 *
 * Two input modes:
 *   1. `--spec-file=<path>` — JSON file matching `WidgetSpec`. Best
 *      for AI agents that compose specs programmatically.
 *   2. Inline flags — best for humans scaffolding a quick stub.
 *
 * Default writes to disk under `--workspace-root` (or cwd). Use
 * `--dry-run` to print the plan without writing. Existing files
 * are skipped unless `--force`.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyToWorkspace,
  scaffoldWidget,
  validateWidgetSpec,
  type WidgetSpec,
} from "@hyperforge/plugin-scaffolder";
import type { ParsedArgs } from "../parseArgs.js";
import { boolFlag, stringFlag } from "../parseArgs.js";
import { err, ok, type CommandResult } from "../types.js";

export interface ScaffoldWidgetData {
  readonly spec: WidgetSpec;
  readonly written: ReadonlyArray<string>;
  readonly skipped: ReadonlyArray<string>;
  readonly registrationSites: ReadonlyArray<{
    readonly path: string;
    readonly hint: string;
  }>;
  readonly dryRun: boolean;
}

export function scaffoldWidgetCommand(
  args: ParsedArgs,
): CommandResult<ScaffoldWidgetData | { error: string }> {
  // Build the spec.
  const specFile = stringFlag(args, "specFile");
  let spec: WidgetSpec;
  if (specFile) {
    const abs = resolve(process.cwd(), specFile);
    if (!existsSync(abs)) {
      return err(`Spec file not found: ${abs}`, 2);
    }
    try {
      spec = JSON.parse(readFileSync(abs, "utf8")) as WidgetSpec;
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      return err(`Failed to parse spec file ${abs}: ${cause}`, 3);
    }
  } else {
    const built = buildSpecFromFlags(args);
    if ("error" in built) return err(built.error, 1);
    spec = built.spec;
  }

  // Validate before scaffolding so we can surface every issue.
  const v = validateWidgetSpec(spec);
  if (!v.ok) {
    const lines = v.issues.map((i) => `  ${i.path}: ${i.message}`);
    return err(`Spec is invalid:\n${lines.join("\n")}`, 3, {
      issues: v.issues,
    });
  }

  // R4.P14 — `widgetsDir` and `indexFile` are required flags.
  // The scaffolder no longer defaults them to the Hyperia plugin
  // path; callers must point at the target plugin explicitly.
  const widgetsDir = stringFlag(args, "widgetsDir");
  const indexFile = stringFlag(args, "indexFile");
  if (!widgetsDir || !indexFile) {
    return err(
      "Missing required flags: --widgetsDir and --indexFile.\n" +
        "Pass workspace-relative paths to the target plugin's widgets directory + index file.\n" +
        "  e.g. --widgetsDir packages/<your-plugin>/src/widgets " +
        "--indexFile packages/<your-plugin>/src/index.ts",
      4,
      { missing: { widgetsDir: !widgetsDir, indexFile: !indexFile } },
    );
  }
  const result = scaffoldWidget(spec, {
    widgetsDir,
    testsDir: stringFlag(args, "testsDir"),
    indexFile,
    skipTest: boolFlag(args, "skipTest", false),
  });

  const dryRun = boolFlag(args, "dryRun", false);
  const force = boolFlag(args, "force", false);
  const workspaceRoot = stringFlag(args, "workspaceRoot");

  const report = applyToWorkspace(result, {
    workspaceRoot,
    dryRun,
    force,
  });

  const data: ScaffoldWidgetData = {
    spec,
    written: report.written,
    skipped: report.skipped,
    registrationSites: report.registrationSites,
    dryRun,
  };

  const format = stringFlag(args, "format") ?? "text";
  if (format === "json") {
    return ok(JSON.stringify(data, null, 2), data);
  }

  const lines: string[] = [];
  if (dryRun) {
    lines.push(`Dry run — no files written.`);
    lines.push(`Would have created:`);
    for (const f of result.files) lines.push(`  ${f.path}`);
  } else {
    if (report.written.length > 0) {
      lines.push(`Wrote ${report.written.length} file(s):`);
      for (const p of report.written) lines.push(`  ${p}`);
    }
    if (report.skipped.length > 0) {
      lines.push(
        `Skipped ${report.skipped.length} existing file(s) (use --force to overwrite):`,
      );
      for (const p of report.skipped) lines.push(`  ${p}`);
    }
  }
  if (report.registrationSites.length > 0) {
    lines.push(``);
    lines.push(`Next steps:`);
    for (const s of report.registrationSites) {
      lines.push(`  ${s.path}: ${s.hint}`);
    }
  }

  return ok(lines.join("\n"), data);
}

function buildSpecFromFlags(
  args: ParsedArgs,
): { spec: WidgetSpec } | { error: string } {
  const name = stringFlag(args, "name");
  const manifestId = stringFlag(args, "manifestId");
  const category = stringFlag(args, "category");
  const widthStr = stringFlag(args, "width") ?? "4";
  const heightStr = stringFlag(args, "height") ?? "3";

  if (!name || !manifestId || !category) {
    return {
      error:
        `Inline mode requires --name, --manifest-id, and --category. ` +
        `For richer specs use --spec-file=<path>.`,
    };
  }

  const width = Number.parseInt(widthStr, 10);
  const height = Number.parseInt(heightStr, 10);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { error: `--width and --height must be integers.` };
  }

  const spec: WidgetSpec = {
    name,
    manifestId,
    category: category as WidgetSpec["category"],
    defaultSize: { width, height },
    description: stringFlag(args, "description"),
    props: [],
  };
  return { spec };
}
