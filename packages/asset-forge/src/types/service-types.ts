/**
 * Service-specific types
 */

import type { MeshFittingParameters } from "./fitting";

// import type { BoundingBox } from './index'

/**
 * JSON-serializable value type for GLTF extras and extensions
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * Debug configuration for debugger store
 */
export interface DebugConfiguration {
  viewMode?: "sphereCube" | "avatarArmor" | "helmetFitting";
  showWireframe?: boolean;
  fittingParameters?: Partial<MeshFittingParameters>;
  helmetSettings?: {
    method?: "auto" | "manual";
    sizeMultiplier?: number;
    fitTightness?: number;
    verticalOffset?: number;
    forwardOffset?: number;
    rotation?: Partial<{ x: number; y: number; z: number }>;
  };
  debugVisualization?: {
    showHeadBounds?: boolean;
    showCollisionDebug?: boolean;
    showHull?: boolean;
    showDebugArrows?: boolean;
    debugArrowDensity?: number;
    debugColorMode?: "direction" | "magnitude" | "sidedness";
  };
  timestamp?: string;
}

/**
 * TensorFlow hand detection types
 */
export interface TensorFlowKeypoint {
  x: number;
  y: number;
  z?: number;
}

export interface TensorFlowHand {
  keypoints: TensorFlowKeypoint[];
  keypoints3D?: TensorFlowKeypoint[];
  handedness: "Left" | "Right";
  score: number;
}

/**
 * Meshy API response types
 */
export interface MeshyTaskResult {
  status: string;
  progress?: number;
  model_url?: string;
  model_urls?: { glb?: string; fbx?: string; obj?: string };
  texture_url?: string;
  texture_urls?: Array<{
    base_color?: string;
    normal?: string;
    metallic?: string;
    roughness?: string;
  }>;
  error?: string;
  task_error?: { message: string } | string;
  created_at?: number;
  finished_at?: number;
}

/**
 * GLTF Export JSON structure
 */
export interface GLTFExportJSON {
  nodes?: Array<{
    name?: string;
    skin?: number;
    mesh?: number;
    children?: number[];
  }>;
  skins?: Array<{
    joints?: number[];
    skeleton?: number;
    name?: string;
  }>;
  meshes?: Array<{
    name?: string;
    primitives?: Array<{
      attributes?: Record<string, number>;
      indices?: number;
      material?: number;
    }>;
  }>;
  animations?: Array<{
    name?: string;
    channels?: Array<{
      sampler?: number;
      target?: {
        node?: number;
        path?: "translation" | "rotation" | "scale" | "weights";
        extensions?: Record<string, JSONValue>;
        extras?: JSONValue;
      };
      extensions?: Record<string, JSONValue>;
      extras?: JSONValue;
    }>;
    samplers?: Array<{
      input?: number;
      interpolation?: "LINEAR" | "STEP" | "CUBICSPLINE";
      output?: number;
      extensions?: Record<string, JSONValue>;
      extras?: JSONValue;
    }>;
    extensions?: Record<string, JSONValue>;
    extras?: JSONValue;
  }>;
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  [key: string]: JSONValue | undefined;
}
