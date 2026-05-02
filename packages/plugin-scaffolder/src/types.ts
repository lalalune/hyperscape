/**
 * Public types for `@hyperforge/plugin-scaffolder`.
 *
 * The scaffolder is a pure function: spec in, files out. It does
 * not touch the filesystem. A separate helper applies the result
 * to a workspace.
 *
 * `WidgetSpec` is the abstract description an agent or human
 * provides. It mirrors the established `*Widget.tsx` shape used by
 * the meta-plugin: each widget exports a Zod props schema, a
 * `defineWidget(...)` definition with a stable manifest id, a
 * React renderer, and a bundled `WidgetRegistration`.
 *
 * The scaffolder lowers a spec into one or more files. Currently
 * shipped: `*Widget.tsx` source + `__tests__/*Widget.test.ts`
 * companion. More templates can join by registering new generators.
 */

import type { WidgetCategory } from "@hyperforge/ui-framework";

/**
 * Best-effort prop type. Intentionally narrow — matches the
 * widget-catalog `WidgetPropSummary.type` set so a catalog entry
 * can be round-tripped back into a spec without information loss.
 */
export type ScaffoldPropType = "string" | "number" | "boolean" | "enum";

/**
 * A single prop on a scaffolded widget. The scaffolder uses these
 * to emit Zod schema fields, a TypeScript prop type, defaults, and
 * test fixtures.
 */
export interface PropSpec {
  /** Field name in the props object. Must be a valid identifier. */
  readonly name: string;
  /** Best-effort kind. Drives Zod / TypeScript generation. */
  readonly type: ScaffoldPropType;
  /**
   * Default value used in `defaultProps` and as the schema's
   * `.default(...)`. For `"enum"` types, must be one of `enumValues`.
   */
  readonly defaultValue: string | number | boolean;
  /**
   * Required when `type === "enum"`. The set of allowed string
   * literals. Ignored for other types.
   */
  readonly enumValues?: ReadonlyArray<string>;
  /**
   * One-line description. Emitted as a JSDoc comment above the
   * schema field and as `.describe(...)` on the Zod field so the
   * widget-catalog can read it back.
   */
  readonly description?: string;
}

/**
 * A widget the scaffolder will generate. The shape closely mirrors
 * `Widget.manifest` plus a list of props.
 */
export interface WidgetSpec {
  /**
   * PascalCase widget name. Drives the file name (`{name}Widget.tsx`),
   * the schema variable (`{camel}PropsSchema`), the component
   * function (`{name}`), and the registration (`{camel}Registration`).
   * Validated to match `/^[A-Z][A-Za-z0-9]+$/`.
   */
  readonly name: string;
  /**
   * Stable manifest id. Conventionally
   * `com.<org>.<plugin>.<lowercase-name>`. Validated to match
   * `/^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/`.
   */
  readonly manifestId: string;
  /** Palette category — feeds `Widget.manifest.category`. */
  readonly category: WidgetCategory;
  /** Authoring-time size hint, in grid cells. */
  readonly defaultSize: { readonly width: number; readonly height: number };
  /** Optional human-readable name. Defaults to `name`. */
  readonly displayName?: string;
  /** Optional one-line description for the manifest + JSDoc header. */
  readonly description?: string;
  /** Props the widget accepts. May be empty. */
  readonly props: ReadonlyArray<PropSpec>;
}

/**
 * A scaffolded file — pure data. Path is workspace-relative and
 * uses forward slashes. Content is the full text to write, ending
 * in a trailing newline.
 */
export interface ScaffoldedFile {
  readonly path: string;
  readonly content: string;
}

/**
 * One callsite that has to be touched to register the new artifact
 * with the rest of the codebase. The scaffolder doesn't perform
 * the edit — it surfaces the location + a hint so a CLI, agent, or
 * human can do it.
 *
 * Example: when scaffolding a widget into the meta-plugin, the
 * registration site is the plugin's `src/index.ts` where every
 * `*Registration` gets aggregated into the contributions list.
 */
export interface RegistrationSite {
  /** Workspace-relative path of the file that needs an edit. */
  readonly path: string;
  /** One-line description of the edit ("import + add to contributions"). */
  readonly hint: string;
}

/**
 * Output of `scaffoldWidget(spec)`. Pure data. The caller decides
 * what to do with it — write to disk, post to a PR, return to an
 * agent, etc.
 */
export interface ScaffoldResult {
  readonly files: ReadonlyArray<ScaffoldedFile>;
  readonly registrationSites: ReadonlyArray<RegistrationSite>;
}

/**
 * Options for `scaffoldWidget`.
 */
export interface ScaffoldWidgetOptions {
  /**
   * Workspace-relative directory the widget source lives in.
   * Required (R4.P14) — caller must point at the target plugin
   * explicitly. E.g. `packages/<your-plugin>/src/widgets`.
   */
  readonly widgetsDir: string;
  /**
   * Workspace-relative directory the test companion lives in.
   * Defaults to `${widgetsDir}/__tests__`.
   */
  readonly testsDir?: string;
  /**
   * Workspace-relative file that aggregates registrations. Surfaces
   * as a `RegistrationSite`. Required (R4.P14) — caller must pick
   * the target plugin's index file explicitly. E.g.
   * `packages/<your-plugin>/src/index.ts`.
   */
  readonly indexFile: string;
  /**
   * When true, skip emitting the test file. Default false.
   */
  readonly skipTest?: boolean;
}
