import { describe, expect, it, beforeEach } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyToWorkspace } from "./applyToWorkspace";
import { scaffoldWidget } from "./scaffoldWidget";
import type { WidgetSpec } from "./types";

const fixture: WidgetSpec = {
  name: "TempProbe",
  manifestId: "com.test.demo.temp-probe",
  category: "panel",
  defaultSize: { width: 4, height: 3 },
  props: [{ name: "label", type: "string", defaultValue: "" }],
};

describe("applyToWorkspace", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "scaffold-apply-"));
  });

  it("writes every file under the workspace root", () => {
    const r = scaffoldWidget(fixture, {
      widgetsDir: "src/widgets",
      testsDir: "src/widgets/__tests__",
      indexFile: "src/index.ts",
    });
    const report = applyToWorkspace(r, { workspaceRoot: root });

    expect(report.written.length).toBe(2);
    expect(report.skipped).toEqual([]);
    const sourcePath = join(root, "src/widgets/TempProbeWidget.tsx");
    expect(existsSync(sourcePath)).toBe(true);
    expect(readFileSync(sourcePath, "utf8")).toContain("tempProbeWidget");
  });

  it("skips existing files unless force=true", () => {
    const r = scaffoldWidget(fixture, {
      widgetsDir: "src/widgets",
      testsDir: "src/widgets/__tests__",
      indexFile: "src/index.ts",
      skipTest: true,
    });
    const sourcePath = join(root, "src/widgets/TempProbeWidget.tsx");
    mkdirSync(join(root, "src/widgets"), { recursive: true });
    writeFileSync(sourcePath, "// preexisting\n", "utf8");

    const report = applyToWorkspace(r, { workspaceRoot: root });
    expect(report.written).toEqual([]);
    expect(report.skipped).toEqual(["src/widgets/TempProbeWidget.tsx"]);
    expect(readFileSync(sourcePath, "utf8")).toContain("preexisting");

    const forced = applyToWorkspace(r, {
      workspaceRoot: root,
      force: true,
    });
    expect(forced.written.length).toBe(1);
    expect(readFileSync(sourcePath, "utf8")).toContain("tempProbeWidget");
  });

  it("dryRun=true performs no writes", () => {
    const r = scaffoldWidget(fixture, {
      widgetsDir: "src/widgets",
      testsDir: "src/widgets/__tests__",
      indexFile: "src/index.ts",
      skipTest: true,
    });
    const report = applyToWorkspace(r, {
      workspaceRoot: root,
      dryRun: true,
    });
    expect(report.written).toEqual([]);
    expect(existsSync(join(root, "src/widgets/TempProbeWidget.tsx"))).toBe(
      false,
    );
  });

  it("surfaces registration sites verbatim", () => {
    const r = scaffoldWidget(fixture, {
      widgetsDir: "src/widgets",
      indexFile: "custom/index.ts",
    });
    const report = applyToWorkspace(r, { workspaceRoot: root });
    expect(report.registrationSites.length).toBe(1);
    expect(report.registrationSites[0]!.path).toBe("custom/index.ts");
    expect(report.registrationSites[0]!.hint).toContain("TempProbe");
  });
});
