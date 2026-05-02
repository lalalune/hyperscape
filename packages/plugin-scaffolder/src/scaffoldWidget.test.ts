/**
 * Round-trip tests. Scaffold a widget, parse the generated
 * TypeScript through `ts.createSourceFile`, and assert it has the
 * expected exports / Zod schema / JSX function. Validates the
 * templates produce real, compilable code.
 */

import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { scaffoldWidget } from "./scaffoldWidget";
import type { WidgetSpec } from "./types";

const fixture: WidgetSpec = {
  name: "FooBar",
  manifestId: "com.acme.demo.foo-bar",
  category: "panel",
  defaultSize: { width: 4, height: 3 },
  description: "A demo widget for round-trip tests.",
  props: [
    {
      name: "label",
      type: "string",
      defaultValue: "Hello",
      description: "Visible text",
    },
    { name: "count", type: "number", defaultValue: 0 },
    {
      name: "size",
      type: "enum",
      enumValues: ["small", "medium", "large"],
      defaultValue: "medium",
    },
  ],
};

function parse(source: string, filename: string): ts.SourceFile {
  return ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.ES2021,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );
}

function topLevelExportNames(sf: ts.SourceFile): string[] {
  const names: string[] = [];
  for (const stmt of sf.statements) {
    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    const exported = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.push(decl.name.text);
      }
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      names.push(stmt.name.text);
    } else if (
      (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) &&
      stmt.name
    ) {
      names.push(stmt.name.text);
    }
  }
  return names;
}

// R4.P14 — `widgetsDir` and `indexFile` are required. Tests
// supply them explicitly to mirror real-world callers (CLI /
// agent action) which now cannot rely on Hyperia-shaped defaults.
const HYPERSCAPE_OPTS = {
  widgetsDir: "packages/hyperscape-plugin/src/widgets",
  indexFile: "packages/hyperscape-plugin/src/index.ts",
};

describe("scaffoldWidget — file shape", () => {
  it("emits source + test file pair by default", () => {
    const r = scaffoldWidget(fixture, HYPERSCAPE_OPTS);
    expect(r.files.length).toBe(2);
    expect(r.files[0]!.path).toBe(
      "packages/hyperscape-plugin/src/widgets/FooBarWidget.tsx",
    );
    expect(r.files[1]!.path).toBe(
      "packages/hyperscape-plugin/src/widgets/__tests__/FooBarWidget.test.ts",
    );
  });

  it("skipTest:true emits only the source", () => {
    const r = scaffoldWidget(fixture, { ...HYPERSCAPE_OPTS, skipTest: true });
    expect(r.files.length).toBe(1);
    expect(r.files[0]!.path.endsWith("FooBarWidget.tsx")).toBe(true);
  });

  it("honors custom widgetsDir + testsDir + indexFile", () => {
    const r = scaffoldWidget(fixture, {
      widgetsDir: "packages/demo/src/widgets",
      testsDir: "packages/demo/tests",
      indexFile: "packages/demo/src/contributions.ts",
    });
    expect(r.files[0]!.path).toBe("packages/demo/src/widgets/FooBarWidget.tsx");
    expect(r.files[1]!.path).toBe("packages/demo/tests/FooBarWidget.test.ts");
    expect(r.registrationSites[0]!.path).toBe(
      "packages/demo/src/contributions.ts",
    );
  });

  it("registration site mentions the registration name", () => {
    const r = scaffoldWidget(fixture, HYPERSCAPE_OPTS);
    expect(r.registrationSites[0]!.hint).toContain("FooBar");
  });

  it("throws when spec is invalid", () => {
    expect(() =>
      scaffoldWidget({ ...fixture, name: "lower" }, HYPERSCAPE_OPTS),
    ).toThrow(/Invalid WidgetSpec/);
  });

  it("throws when widgetsDir is missing", () => {
    expect(() =>
      scaffoldWidget(fixture, {
        indexFile: "packages/demo/src/index.ts",
      } as unknown as Parameters<typeof scaffoldWidget>[1]),
    ).toThrow(/widgetsDir.*required/);
  });

  it("throws when indexFile is missing", () => {
    expect(() =>
      scaffoldWidget(fixture, {
        widgetsDir: "packages/demo/src/widgets",
      } as unknown as Parameters<typeof scaffoldWidget>[1]),
    ).toThrow(/indexFile.*required/);
  });
});

describe("scaffoldWidget — generated source", () => {
  const r = scaffoldWidget(fixture, HYPERSCAPE_OPTS);
  const source = r.files[0]!.content;
  const sf = parse(source, "FooBarWidget.tsx");
  const exports = topLevelExportNames(sf);

  it("parses without syntax errors", () => {
    // ts.createSourceFile reports parse errors in `parseDiagnostics`.
    // We assert there are none — the template should always produce
    // syntactically valid TS.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diags = (sf as any).parseDiagnostics ?? [];
    expect(diags.length).toBe(0);
  });

  it("exports the schema, type, widget, component, and registration", () => {
    expect(exports).toContain("fooBarPropsSchema");
    expect(exports).toContain("FooBarProps");
    expect(exports).toContain("fooBarWidget");
    expect(exports).toContain("FooBar");
    expect(exports).toContain("fooBarRegistration");
  });

  it("emits manifest id, category, and defaultSize literally", () => {
    expect(source).toContain('"com.acme.demo.foo-bar"');
    expect(source).toContain('"panel"');
    expect(source).toContain("width: 4");
    expect(source).toContain("height: 3");
  });

  it("emits each prop as a Zod field with default", () => {
    expect(source).toContain('label: z.string().default("Hello")');
    expect(source).toContain("count: z.number().default(0)");
    expect(source).toContain(
      'size: z.enum(["small", "medium", "large"]).default("medium")',
    );
  });

  it("emits matching defaultProps entries", () => {
    expect(source).toContain('label: "Hello"');
    expect(source).toContain("count: 0");
    expect(source).toContain('size: "medium"');
  });

  it("emits .describe(...) for props with description", () => {
    expect(source).toContain('.describe("Visible text")');
  });

  it("imports React, zod, and the ui-framework helpers", () => {
    expect(source).toContain('from "@hyperforge/ui-framework"');
    expect(source).toContain('from "react"');
    expect(source).toContain('from "zod"');
  });

  it("renders an empty-props widget cleanly", () => {
    const empty = scaffoldWidget({ ...fixture, props: [] }, HYPERSCAPE_OPTS);
    const src = empty.files[0]!.content;
    expect(src).toContain("z.object({})");
    expect(src).toContain("defaultProps: {},");
    // Empty-props case uses _props underscore param to avoid an unused warning.
    expect(src).toContain("_props: FooBarProps");
  });
});

describe("scaffoldWidget — generated test companion", () => {
  const r = scaffoldWidget(fixture, HYPERSCAPE_OPTS);
  const test = r.files[1]!.content;
  const sf = parse(test, "FooBarWidget.test.ts");

  it("parses without syntax errors", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diags = (sf as any).parseDiagnostics ?? [];
    expect(diags.length).toBe(0);
  });

  it("imports the generated artifacts from the peer source file", () => {
    expect(test).toContain('from "../FooBarWidget.js"');
    expect(test).toContain("fooBarWidget");
    expect(test).toContain("fooBarPropsSchema");
    expect(test).toContain("fooBarRegistration");
    expect(test).toContain("FooBar");
  });

  it("asserts the manifest id matches the spec", () => {
    expect(test).toContain('"com.acme.demo.foo-bar"');
  });

  it("asserts default props parse cleanly", () => {
    expect(test).toContain(
      "fooBarPropsSchema.safeParse(fooBarWidget.defaultProps)",
    );
  });
});
