/**
 * UI Stores
 *
 * Central export point for all UI state management stores.
 * These stores use Zustand for state management with persistence.
 *
 * @packageDocumentation
 */

// Window management
export { useWindowStore, type WindowStoreState } from "./windowStore";

// Edit mode
export { useEditStore, type EditStoreState } from "./editStore";

// Layout presets
export { usePresetStore, type PresetStoreState } from "./presetStore";

// Theme management
export {
  useThemeStore,
  useTheme,
  baseTheme,
  hyperscapeTheme,
  type ThemeStoreState,
} from "./themeStore";

// Accessibility settings
export {
  useAccessibilityStore,
  useAccessibility,
  initializeAccessibility,
  type AccessibilityStoreState,
} from "./accessibilityStore";

// Progressive complexity
export {
  useComplexityStore,
  useFeatureEnabled,
  useComplexityMode,
  useComplexityFeatures,
  type ComplexityStoreState,
} from "./complexityStore";

// Re-export complexity types and configs for convenience
export {
  COMPLEXITY_MODE_CONFIGS,
  type ComplexityMode,
  type ComplexityFeatures,
  type ComplexityModeConfig,
} from "../types/complexity";

// Keybind management
export {
  useKeybindStore,
  useKeybind,
  useActionBarKeybinds,
  useIsListeningFor,
  DEFAULT_ACTIONBAR_KEYBINDS,
  DEFAULT_PRESET_KEYBINDS,
  DEFAULT_INTERFACE_KEYBINDS,
  ALL_DEFAULT_KEYBINDS,
  type KeybindStoreState,
  type KeybindCategory,
  type KeybindDefinition,
  type KeybindProfile,
} from "./keybindStore";

// Quest selection
export { useQuestSelectionStore, type QuestSelectionState } from "./questStore";

// Drag and drop
export { useDragStore, type DragStoreState } from "./dragStore";

// Notification system
export {
  useNotificationStore,
  useNotifications,
  useNotificationList,
  getUserFriendlyError,
  ERROR_MESSAGES,
  type NotificationStoreState,
  type Notification,
  type NotificationType,
  type NotificationAction,
} from "./notificationStore";
