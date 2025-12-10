/**
 * Client-only systems
 * These systems only run in browser/client contexts
 */

export { ClientActions } from "./ClientActions";
export { ClientAudio } from "./ClientAudio";
export { ClientCameraSystem } from "./ClientCameraSystem";
export { ClientGraphics } from "./ClientGraphics";
export { ClientInput } from "./ClientInput";
export { ClientInterface } from "./ClientInterface";
export { ClientLiveKit } from "./ClientLiveKit";
export { ClientLoader } from "./ClientLoader";
export { ClientNetwork } from "./ClientNetwork";
export { ClientRuntime } from "./ClientRuntime";
export { Nametags } from "./Nametags";
export { XR } from "./XR";
export { NodeClient } from "./NodeClient";
export { ControlPriorities } from "./ControlPriorities";
export { EquipmentVisualSystem } from "./EquipmentVisualSystem";
export { DamageSplatSystem } from "./DamageSplatSystem";
export { PerformanceMonitor } from "./PerformanceMonitor";
export type {
  PerformanceSnapshot,
  PhaseTiming,
  SystemTiming,
  EntityStats,
  MemoryStats,
  TerrainStats,
} from "./PerformanceMonitor";

// Mob instanced rendering for performance
export { MobInstancedRenderer } from "./MobInstancedRenderer";
export type { MobInstanceHandle } from "./MobInstancedRenderer";

// New interaction system (replaces legacy InteractionSystem)
export { InteractionRouter } from "./interaction";
