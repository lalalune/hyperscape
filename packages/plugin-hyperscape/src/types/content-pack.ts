/**
 * Content Pack Type Definitions
 *
 * These types define the structure for extensible content packs that can be
 * added to the Hyperscape plugin, allowing for modular game content.
 */

import type { Action, Provider, Evaluator, IAgentRuntime } from "@elizaos/core";

/**
 * Visual configuration for game entities
 */
export interface IVisualConfig {
  /** Color mappings for different entity types */
  entityColors: Record<string, { color: number; hex: string }>;

  /** Optional UI theme configuration */
  uiTheme?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };

  /** Optional asset manifests */
  assets?: {
    models?: Record<string, string>;
    textures?: Record<string, string>;
    sounds?: Record<string, string>;
    animations?: Record<string, string>;
  };
}

/**
 * Game system interface for modular systems
 */
export interface IGameSystem {
  /** Unique system identifier */
  id: string;

  /** Human-readable system name */
  name: string;

  /** System type/category */
  type:
    | "combat"
    | "inventory"
    | "skills"
    | "movement"
    | "resource"
    | "social"
    | "economy"
    | "custom";

  /** Optional system description */
  description?: string;

  /** Optional dependencies on other systems */
  dependencies?: string[];

  /** Initialize the system */
  init: (world?: any) => Promise<void>;

  /** Optional update loop */
  update?: (deltaTime: number) => void;

  /** Cleanup system resources */
  cleanup: () => void;
}

/**
 * Content Pack interface
 *
 * A content pack bundles actions, providers, evaluators, systems, and visuals
 * into a cohesive package that can be loaded into the Hyperscape plugin.
 */
export interface IContentPack {
  /** Unique content pack identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Content pack description */
  description: string;

  /** Semantic version */
  version: string;

  /** Optional actions provided by this pack */
  actions?: Action[];

  /** Optional providers for state/context */
  providers?: Provider[];

  /** Optional evaluators for decision making */
  evaluators?: Evaluator[];

  /** Optional game systems */
  systems?: IGameSystem[];

  /** Optional visual configuration */
  visuals?: IVisualConfig;

  /** Optional state manager */
  stateManager?: {
    save: (state: any) => Promise<void>;
    load: () => Promise<any>;
    clear: () => Promise<void>;
  };

  /** Called when pack is loaded */
  onLoad?: (runtime: IAgentRuntime, world?: any) => Promise<void>;

  /** Called when pack is unloaded */
  onUnload?: (runtime: IAgentRuntime, world?: any) => Promise<void>;
}
