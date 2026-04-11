/**
 * Quest System
 *
 * Headless hooks and utilities for quest log functionality.
 *
 * @packageDocumentation
 */

// Quest utilities and types
export {
  // Types
  type QuestState,
  type QuestCategory,
  type ObjectiveType,
  type RewardType,
  type QuestObjective,
  type QuestReward,
  type Quest,
  type QuestSortOption,
  type SortDirection,
  type QuestFilterOptions,
  type CategoryConfig,
  type StateConfig,
  type ObjectiveTypeConfig,
  // Functions
  calculateQuestProgress,
  isObjectiveComplete,
  areAllObjectivesComplete,
  sortQuests,
  filterQuests,
  groupQuestsByCategory,
  groupQuestsByState,
  getQuestChain,
  formatTimeRemaining,
  getNextChainQuest,
  arePrerequisitesMet,
  getRewardSummary,
  // Constants
  CATEGORY_CONFIG,
  STATE_CONFIG,
  OBJECTIVE_TYPE_CONFIG,
} from "./questUtils";

// Quest tracker hook
export {
  useQuestTracker,
  type UseQuestTrackerOptions,
  type UseQuestTrackerResult,
  type TrackedQuest,
} from "./useQuestTracker";
