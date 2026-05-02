/**
 * `scaffoldWidget` — turn a `WidgetSpec` into a list of files +
 * registration sites the caller needs to wire up.
 *
 * Pure function. No filesystem, no shell, no network. The caller
 * (CLI, agent, test) decides what to do with the result.
 */

import { renderWidgetSource } from "./templates/widgetSource.js";
import { renderWidgetTest } from "./templates/widgetTest.js";
import type {
  ScaffoldResult,
  ScaffoldWidgetOptions,
  ScaffoldedFile,
  RegistrationSite,
  WidgetSpec,
} from "./types.js";
import { assertWidgetSpec } from "./validate.js";

/**
 * R4.P14 of `PLAN_HYPERIA_DECOUPLING.md` — `widgetsDir` and
 * `indexFile` are now REQUIRED. Earlier versions defaulted them
 * to `packages/hyperscape-plugin/src/widgets` and `packages/
 * hyperscape-plugin/src/index.ts` so a caller scaffolding without
 * overrides would land their widget inside the Hyperia plugin —
 * a Hyperia-shaped default that violated "blank means blank,
 * Hyperia means Hyperia, anything else is composable."
 *
 * Callers must pick the target plugin explicitly. The CLI's
 * `forge scaffold widget` surfaces missing flags as a typed
 * error.
 */
export function scaffoldWidget(
  spec: WidgetSpec,
  options: ScaffoldWidgetOptions,
): ScaffoldResult {
  assertWidgetSpec(spec);

  if (!options.widgetsDir) {
    throw new Error(
      "scaffoldWidget: `widgetsDir` is required. Pass the workspace-relative path to the target plugin's widgets directory (e.g. `packages/<your-plugin>/src/widgets`).",
    );
  }
  if (!options.indexFile) {
    throw new Error(
      "scaffoldWidget: `indexFile` is required. Pass the workspace-relative path to the target plugin's contributions barrel (e.g. `packages/<your-plugin>/src/index.ts`).",
    );
  }
  const widgetsDir = options.widgetsDir;
  const testsDir = options.testsDir ?? `${widgetsDir}/__tests__`;
  const indexFile = options.indexFile;

  const sourcePath = `${widgetsDir}/${spec.name}Widget.tsx`;
  const testPath = `${testsDir}/${spec.name}Widget.test.ts`;

  const files: ScaffoldedFile[] = [
    {
      path: sourcePath,
      content: renderWidgetSource(spec),
    },
  ];

  if (!options.skipTest) {
    files.push({
      path: testPath,
      content: renderWidgetTest(spec, {
        importPath: `../${spec.name}Widget.js`,
      }),
    });
  }

  const registrationSites: RegistrationSite[] = [
    {
      path: indexFile,
      hint: `Re-export ${spec.name}Widget + register ${spec.name}Registration alongside the existing widget contributions.`,
    },
  ];

  return { files, registrationSites };
}
