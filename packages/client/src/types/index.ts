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
  XRManager,
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
