/**
 * Client-only systems
 * These systems only run in browser/client contexts
 */

export { ClientActions } from "./ClientActions";
export { ClientAudio } from "./ClientAudio";
export { ClientCameraSystem } from "./ClientCameraSystem";
export { ClientGraphics } from "./ClientGraphics";
export { ClientInput } from "./ClientInput";
export {
  GamepadInput,
  GamepadButton,
  GamepadAxis,
  DEFAULT_ACTION_MAPPING,
  GAMEPAD_BUTTON_GLYPHS,
  getButtonGlyph,
} from "./GamepadInput";
export type {
  StickState,
  GameAction,
  GamepadInputEvents,
} from "./GamepadInput";
export { ClientInterface } from "./ClientInterface";
export { ClientLiveKit } from "./ClientLiveKit";
export { ClientLoader } from "./ClientLoader";
export { ClientNetwork } from "./ClientNetwork";
export { ClientRuntime } from "./ClientRuntime";
export { NodeClient } from "./NodeClient";
export { ControlPriorities } from "./ControlPriorities";
export { EquipmentVisualSystem } from "./EquipmentVisualSystem";
export { DamageSplatSystem } from "./DamageSplatSystem";
export { XPDropSystem } from "./XPDropSystem";
export { ZoneVisualsSystem } from "./ZoneVisualsSystem";
export { ResourceTileDebugSystem } from "./ResourceTileDebugSystem";

// New interaction system (replaces legacy InteractionSystem)
export { InteractionRouter } from "./interaction";
