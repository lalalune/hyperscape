/**
 * useLevelUpState - State management hook for Level-Up Notifications
 *
 * Handles:
 * - Subscribing to SKILLS_LEVEL_UP events (emitted by useXPOrbState)
 * - Queue management for multiple level-ups
 * - Auto-dismiss timing
 *
 * Separated from XPProgressOrb for Single Responsibility Principle (SRP).
 * useXPOrbState is the single source of truth for level-up detection.
 * This hook subscribes to the centralized event to show the popup dialog.
 */

import { useState, useEffect, useCallback } from "react";
import { EventType } from "@hyperforge/shared";
import type { SkillsLevelUpEvent } from "@hyperforge/shared";
import type { ClientWorld } from "../../../types";

/** Level-up event data for popup display */
export interface LevelUpEvent {
  skill: string;
  oldLevel: number;
  newLevel: number;
  timestamp: number;
}

/** Return type for useLevelUpState hook */
export interface UseLevelUpStateResult {
  /** Currently displayed level-up (null if none) */
  currentLevelUp: LevelUpEvent | null;
  /** Dismiss the current level-up popup */
  dismissLevelUp: () => void;
}

/**
 * Hook to track level-up events and manage popup queue
 *
 * @param world - Client world instance for event subscription
 * @returns Current level-up event and dismiss callback
 */
export function useLevelUpState(world: ClientWorld): UseLevelUpStateResult {
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpEvent[]>([]);
  const [currentLevelUp, setCurrentLevelUp] = useState<LevelUpEvent | null>(
    null,
  );

  // Subscribe to centralized SKILLS_LEVEL_UP event (emitted by useXPOrbState)
  // No duplicate level detection needed - single source of truth
  useEffect(() => {
    const handleLevelUp = (data: SkillsLevelUpEvent) => {
      const event: LevelUpEvent = {
        skill: data.skill,
        oldLevel: data.oldLevel,
        newLevel: data.newLevel,
        timestamp: data.timestamp ?? Date.now(),
      };
      // Use concat for single item - slightly more efficient than spread
      setLevelUpQueue((prev) => prev.concat(event));
    };

    world.on(EventType.SKILLS_LEVEL_UP, handleLevelUp);
    return () => {
      world.off(EventType.SKILLS_LEVEL_UP, handleLevelUp);
    };
  }, [world]);

  // Process queue - show one level-up at a time
  useEffect(() => {
    if (!currentLevelUp && levelUpQueue.length > 0) {
      // Use slice(1) instead of destructuring to avoid intermediate array
      setCurrentLevelUp(levelUpQueue[0]);
      setLevelUpQueue(levelUpQueue.slice(1));
    }
  }, [currentLevelUp, levelUpQueue]);

  // Dismiss callback - clears current level-up, allowing next in queue
  const dismissLevelUp = useCallback(() => {
    setCurrentLevelUp(null);
  }, []);

  return { currentLevelUp, dismissLevelUp };
}
