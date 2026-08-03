/**
 * Level-Up Notification System
 *
 * classic fantasy MMORPG-style level-up popup with:
 * - Visual popup with skill icon and level
 * - CSS fireworks animation
 * - Placeholder audio fanfare (Web Audio API)
 * - Chat message integration (classic MMORPG-style game message)
 * - Skill unlock display
 */

// Main component
export { LevelUpNotification } from "./LevelUpNotification";

// Sub-components
export { LevelUpPopup } from "./LevelUpPopup";
export { UnlocksSection } from "./UnlocksSection";

// Note: FireworksEffect is exported from UI components

// Hooks
export { useLevelUpState } from "./useLevelUpState";
export type { LevelUpEvent, UseLevelUpStateResult } from "./useLevelUpState";

// Audio
export {
  playLevelUpSound,
  playMilestoneLevelUpSound,
  playLevelUpFanfare,
  isMilestoneLevel,
} from "./levelUpAudio";

// Utilities
export { normalizeSkillName, capitalizeSkill } from "./utils";

// Type guards
export { isClientAudio, isChat } from "./utils";
