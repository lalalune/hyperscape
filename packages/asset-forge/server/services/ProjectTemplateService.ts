/**
 * Project Template Service
 *
 * Phase B0'.B of `PLAN_PROJECT_AS_DATA.md`. In-memory registry of
 * project templates. Templates are saved `Project` snapshots a user
 * can clone when creating a new project.
 *
 * Two seeded templates this slice:
 *
 *   - **blank**: empty world. Procgen terrain only. No plugins, no
 *     authored content. The agent's first job is to fill it.
 *   - **hyperia**: marker-only template. `templateId === "hyperia"`
 *     signals the client's `useProjectLoader` to populate the full
 *     `HYPERIA_GAME_WORLD_CONFIG` and (in B0'.E) the
 *     `@hyperforge/hyperscape` plugin's authored content.
 *     The actual content bake-in happens in B0'.E when the plugin
 *     owns its data; this slice keeps the gate simple.
 *
 * Future slices: more templates (shooter-demo, blank-tropical,
 * blank-arctic, etc.). Marketplace templates landing here as data,
 * not code.
 */

import type { ProjectLayers } from "./projectLayers.js";

/** Identifier for a project template. */
export type ProjectTemplateId = string;

/** Template definition surfaced to the editor's "New Project" picker. */
export interface ProjectTemplate {
  /** Stable id used by `templateId` on `Project`. */
  readonly id: ProjectTemplateId;
  /** Display name in the picker. */
  readonly name: string;
  /** Short description shown under the name. */
  readonly description: string;
  /**
   * Optional thumbnail URL. Templates without a thumbnail render
   * with a generic "globe" placeholder in the picker.
   */
  readonly thumbnailUrl?: string;
  /**
   * Whether this template is the default selection in the picker.
   * Exactly one template should have `defaultPick = true`. Today's
   * default is "blank".
   */
  readonly defaultPick?: boolean;
  /**
   * The seed `ProjectLayers` value the template clones into a new
   * project. The cloning layer overlays a fresh seed onto the
   * config and writes through to `WorldProjectService.create()`.
   */
  readonly seed: ProjectLayers;
}

/**
 * Built-in templates. Order is the picker's display order.
 */
const BUILTIN_TEMPLATES: ReadonlyArray<ProjectTemplate> = [
  {
    id: "blank",
    name: "Blank World",
    description:
      "Procgen terrain only. No plugins, no entities — start from scratch and build your game with the AI co-author.",
    defaultPick: true,
    seed: {
      schemaVersion: 1,
      config: { seed: 0 },
      plugins: [],
      worldContent: {},
      templateId: "blank",
    },
  },
  {
    id: "hyperia",
    name: "Hyperia (Sample)",
    description:
      "The reference Hyperia game — full RPG with combat, skills, banking, and authored NPCs. Load to study or fork.",
    seed: {
      schemaVersion: 1,
      config: { seed: 0 },
      plugins: ["@hyperforge/hyperscape"],
      worldContent: {},
      templateId: "hyperia",
    },
  },
];

export class ProjectTemplateService {
  private readonly templates: ReadonlyArray<ProjectTemplate>;

  constructor(templates?: ReadonlyArray<ProjectTemplate>) {
    this.templates = templates ?? BUILTIN_TEMPLATES;
  }

  /** Return all templates in display order. */
  list(): ReadonlyArray<ProjectTemplate> {
    return this.templates;
  }

  /** Resolve a template by id. Returns null when unknown. */
  getById(id: ProjectTemplateId): ProjectTemplate | null {
    return this.templates.find((t) => t.id === id) ?? null;
  }

  /**
   * Clone a template into a fresh `ProjectLayers` value, applying
   * any per-creation overrides (e.g. a random seed). When the
   * template id is unknown, returns null and the caller can fall
   * back to the blank shape.
   */
  clone(
    id: ProjectTemplateId,
    overrides?: { seed?: number },
  ): ProjectLayers | null {
    const template = this.getById(id);
    if (!template) return null;

    const baseConfig =
      (template.seed.config as Record<string, unknown> | null) ?? null;
    const config: Record<string, unknown> | null =
      overrides?.seed !== undefined
        ? { ...(baseConfig ?? {}), seed: overrides.seed }
        : baseConfig;

    return {
      schemaVersion: template.seed.schemaVersion,
      config,
      plugins: [...template.seed.plugins],
      worldContent: { ...(template.seed.worldContent ?? {}) },
      templateId: template.id,
    };
  }

  /**
   * Return the default template (the one with `defaultPick: true`),
   * or the first template if none is marked default.
   */
  getDefault(): ProjectTemplate {
    return (
      this.templates.find((t) => t.defaultPick === true) ?? this.templates[0]!
    );
  }
}
