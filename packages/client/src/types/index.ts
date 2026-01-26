/**
 * Client Type Definitions
 *
 * Barrel export for all client type definitions.
 * Organized into entities, world/systems, and UI components.
 */

// Re-export game model types from shared package
export type {
  PlayerHealth,
  SkillData,
  Skills,
  Item,
  PlayerEquipmentItems,
  PlayerStats,
  InventorySlotItem,
  InventoryItem,
} from "@hyperscape/shared";

// Entity types
export type {
  EntityData,
  Entity,
  PlayerEntity,
  EntityManager,
} from "./entities";

// World and system types
export type {
  ClientWorld,
  GraphicsSystem,
  ControlsSystem,
  Action,
  TargetSystem,
  ChatSystem,
  NetworkManager,
  LoaderManager,
  BuilderManager,
  FileInfo,
  WorldSettings,
  WorldPreferences,
} from "./world";

// UI and component types
export type {
  Field,
  HintContextType,
  PermissionsInfo,
  PointerEventHandler,
  ChangeEventHandler,
  SelectOption,
} from "./ui";

// Player state types
export type {
  RawEquipmentSlot,
  RawEquipmentData,
  InventorySlotViewItem,
  NetworkEventName,
} from "./player";
export { NetworkEvents } from "./player";

// Type guards for runtime validation
export {
  isInventoryUpdateEvent,
  isCoinUpdateEvent,
  isUIUpdateEvent,
  isSkillsUpdateEvent,
  isEquipmentUpdateEvent,
  isLoadingProgressEvent,
  isDeathScreenEvent,
  isObject,
  hasStringProperty,
  hasNumberProperty,
  hasArrayProperty,
  type InventoryUpdateEvent,
  type CoinUpdateEvent,
  type UIUpdateEvent,
  type SkillsUpdateEvent,
  type EquipmentUpdateEvent,
  type LoadingProgressEvent,
  type DeathScreenEvent,
} from "./guards";
